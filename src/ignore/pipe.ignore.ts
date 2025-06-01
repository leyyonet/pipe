import {
    ClassReflectionLike,
    CoreReflectionLike,
    DecoIdLike,
    DecoInstanceLike,
    decoratorPool,
    Fqn,
    fqnHandler,
    lifecycle,
    PropertyReflectionLike
} from "@leyyo/core";
import {$descriptor, $dev, $repo, DevOpt, Func} from "@leyyo/common";
import {FQN} from "../internal";
import {IgnoredItem, IgnoredItems, IgnorePipesOpt, PipeIgnoreLike} from "./index.types";
import {httpSigner} from "@leyyo/http";
import {PipeDirPro} from "../pool";

@Fqn(FQN)
class PipeIgnore implements PipeIgnoreLike {
    private readonly empty: IgnoredItems;
    private readonly application: IgnoredItems;
    private readonly controllers: Map<ClassReflectionLike, IgnoredItems>;
    private readonly endpoints: Map<PropertyReflectionLike, IgnoredItems>;
    private readonly types: Map<ClassReflectionLike, IgnoredItems>;
    private readonly redundantMessages: Array<DevOpt>;

    private readonly temporaryClasses: Map<ClassReflectionLike, Array<IgnorePipesOpt>>;
    private readonly temporaryMethods: Map<PropertyReflectionLike, Array<IgnorePipesOpt>>;

    constructor() {
        this.empty = this._initPro();
        this.application = this._initPro();

        this.controllers = $repo.newMap(FQN, 'ignored.controllers');
        this.endpoints = $repo.newMap(FQN, 'ignored.endpoints');
        this.types = $repo.newMap(FQN, 'ignored.types');
        this.redundantMessages = $repo.newArray(FQN, 'ignored.redundant');

        this.temporaryClasses = $repo.newMap(FQN, 'temp.classes');
        this.temporaryMethods = $repo.newMap(FQN, 'temp.methods');

        lifecycle.onInitialize(FQN, () => this.initialize());
        lifecycle.onClear(FQN, () => {
            this._logRedundants();
            this.temporaryClasses.clear();
            this.temporaryMethods.clear();
            this.redundantMessages.splice(0, this.redundantMessages.length);
        });
    }

    private _logRedundants() {
        this.redundantMessages.forEach(item => {
            $dev.log(item, 'warn');
        });
    }

    private _initPro(): IgnoredItems {
        return {
            before: {decorators: []},
            after: {decorators: []},
            response: {decorators: []},
        };
    }

    private _getItem<R extends CoreReflectionLike>(ref: R, map: Map<R, IgnoredItems>, dir: PipeDirPro): IgnoredItem {
        const items = map.has(ref) ? map.get(ref) : this.empty;
        return items[dir];
    }

    private _setAll(item: IgnoredItem): void {
        item.all = true;
        item.decorators.splice(0, item.decorators.length);
    }

    private _append(item: IgnoredItem, decorators: Array<DecoIdLike>): void {
        decorators.forEach(deco => {
            if (!item.decorators.includes(deco)) {
                item.decorators.push(deco);
            }
        })
    }

    private _findNames(ins: DecoInstanceLike, names: Array<string>): Array<DecoIdLike> {
        const list = [] as Array<DecoIdLike>;
        const wrong = [] as Array<string>;
        for (const name of names) {
            const deco = decoratorPool.get(name, false);
            if (deco) {
                list.push(deco.isIdentifier ? deco.asIdentifier : deco.asClone.id);
            } else if (!wrong.includes(name)) {
                wrong.push(name);
            }
        }
        if (wrong.length > 0) {
            this.redundantMessages.push($dev.opt({
                issue: 'decorators.not.found',
                field: 'names',
                desc: ins.description,
                wrong,
                where: 'leyyo.pipe.PipeIgnore'
            }));
        }
        return list;
    }

    private _findFunctions(ins: DecoInstanceLike, functions: Array<Func>): Array<DecoIdLike> {
        const list = [] as Array<DecoIdLike>;
        const wrong = [] as Array<string>;
        for (const func of functions) {
            const deco = decoratorPool.get(func, false);
            const name = fqnHandler.get(func);
            if (deco) {
                list.push(deco.isIdentifier ? deco.asIdentifier : deco.asClone.id);
            } else if (!wrong.includes(name)) {
                wrong.push(name);
            }
        }
        if (wrong.length > 0) {
            this.redundantMessages.push($dev.opt({
                issue: 'decorators.not.found',
                field: 'functions',
                desc: ins.description,
                wrong,
                where: 'leyyo.pipe.PipeIgnore'
            }));
        }
        return list;
    }


    private _ignore<R extends CoreReflectionLike>(map: Map<R, Array<IgnorePipesOpt>>, ref: R, item: IgnorePipesOpt): void {
        if (!map.has(ref)) {
            map.set(ref, []);
        }
        map.get(ref).push(item);
    }

    protected _process(items: IgnoredItems, givenList: Array<IgnorePipesOpt>): void {
        givenList.forEach(given => {
            const item = items[given.dir];
            if (!item.all) {
                if (given.all) {
                    this._setAll(item);
                } else {
                    if (given.names.length > 0) {
                        this._append(item, this._findNames(given.ins, given.names));
                    }
                    if (given.functions.length > 0) {
                        this._append(item, this._findFunctions(given.ins, given.functions));
                    }
                }
            } else {
                this.redundantMessages.push($dev.opt({
                    issue: 'already.all',
                    desc: given.ins.description,
                    where: 'leyyo.pipe.PipeIgnore'
                }));
            }
        });
    }

    initialize(): void {
        this.temporaryClasses
            .forEach((givenList, clazzRef) => {
                switch (httpSigner.tag(clazzRef.creator)) {
                    case 'http.app':
                        this._process(this.application, givenList);
                        break;
                    case 'http.controller':
                        if (!this.controllers.has(clazzRef)) {
                            this.controllers.set(clazzRef, this._initPro());
                        }
                        this._process(this.controllers.get(clazzRef), givenList);
                        break;
                    default:
                        if (!this.types.has(clazzRef)) {
                            this.types.set(clazzRef, this._initPro());
                        }
                        this._process(this.types.get(clazzRef), givenList);
                        break;
                }
            });
        this.temporaryClasses.clear();

        this.temporaryMethods
            .forEach((givenList, methodRef) => {
                if (httpSigner.is(methodRef.callable, 'http.endpoint') || httpSigner.isExt(methodRef.clazz.creator, methodRef.name, 'methods')) {
                    if (!this.endpoints.has(methodRef)) {
                        this.endpoints.set(methodRef, this._initPro());
                    }
                    this._process(this.endpoints.get(methodRef), givenList);
                } else {
                    this.redundantMessages.push($dev.opt({
                        issue: 'method.is.not.endpoint',
                        desc: methodRef.description,
                        where: 'leyyo.pipe.PipeIgnore'
                    }));
                }
            });
        this.temporaryMethods.clear();
    }

    forApplication(dir: PipeDirPro): IgnoredItem {
        return this.application[dir];
    }

    forController(dir: PipeDirPro, clazzRef: ClassReflectionLike): IgnoredItem {
        return this._getItem(clazzRef, this.controllers, dir);
    }

    forEndpoint(dir: PipeDirPro, methodRef: PropertyReflectionLike): IgnoredItem {
        return this._getItem(methodRef, this.endpoints, dir);
    }

    forType(dir: PipeDirPro, clazzRef: ClassReflectionLike): IgnoredItem {
        return this._getItem(clazzRef, this.types, dir);
    }

    addClass(clazz: ClassReflectionLike, item: IgnorePipesOpt): void {
        this._ignore(this.temporaryClasses, clazz, item);
    }

    addMethod(method: PropertyReflectionLike, item: IgnorePipesOpt): void {
        this._ignore(this.temporaryMethods, method, item);
    }
}

export const pipeIgnore: PipeIgnoreLike = new PipeIgnore();
