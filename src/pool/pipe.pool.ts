import {
    ClassReflectionLike,
    CoreReflectionLike,
    DecoInstanceLike,
    decoratorPool,
    footprint,
    Fqn,
    lifecycle,
    ParameterReflectionLike,
    PropertyReflectionLike,
    reflectionPool
} from "@leyyo/core";
import {$assert, $descriptor, $dev, $is, $repo, List} from "@leyyo/common";
import {FQN_PCK} from "../internal";
import {callItem, callOption, CallParams, OptKeyCondition} from "@leyyo/http-call";
import {
    PipeAddGiven,
    PipeDir,
    PipeDirPro,
    PipeEndpointInfo,
    PipeFieldCollection,
    PipeItem,
    PipeItemCollection,
    PipeLambdaAny,
    PipeMetadata,
    PipeOpt,
    PipeOptPro,
    PipePassLambda,
    PipePoolLike,
    PipeStored
} from "./index.types";
import {httpSigner} from "@leyyo/http";
import {IdPipe} from "../index.symbols";

@Fqn(FQN_PCK)
class PipePool implements PipePoolLike {
    private readonly KEYS = ['scope', 'when'] as Array<keyof PipeOpt>;
    private readonly CONDITION = {
        string: ['scope'],
        array: ['scope'],
        function: ['when'],
    } as OptKeyCondition<PipeOpt>;

    private readonly _usedDecoratorInstances: List<DecoInstanceLike>;

    private readonly _endpointInfo: Map<PropertyReflectionLike, PipeEndpointInfo>;
    private readonly _applicationItems: PipeFieldCollection;

    private readonly _controllerItems: Map<ClassReflectionLike, PipeFieldCollection>;
    private readonly _endpointItems: Map<PropertyReflectionLike, PipeFieldCollection>;

    private readonly _parameterItems: Map<ParameterReflectionLike, PipeItemCollection>;

    // @todo if is typeClass ise ignore selectedParameters
    private readonly _typeClassItems: Map<ClassReflectionLike, PipeItemCollection>;
    private readonly _dtoPropertyItems: Map<PropertyReflectionLike, PipeItemCollection>;

    constructor() {
        this._usedDecoratorInstances = $repo.newList(FQN_PCK, 'usedDecoratorInstances');
        this._endpointInfo = $repo.newMap(FQN_PCK, 'endpointInfo');

        this._applicationItems = this._newCollection3d();
        this._controllerItems = $repo.newMap(FQN_PCK, 'controllerItems');
        this._endpointItems = $repo.newMap(FQN_PCK, 'endpointItems');
        this._parameterItems = $repo.newMap(FQN_PCK, 'parameterItems');
        this._typeClassItems = $repo.newMap(FQN_PCK, 'typeClassItems');
        this._dtoPropertyItems = $repo.newMap(FQN_PCK, 'dtoPropertyItems');

        lifecycle.onClear(FQN_PCK, () => {
            this._findRedundant();
            this._usedDecoratorInstances.clear();
        })
    }

    private _newCollection2d(): PipeItemCollection {
        return {
            before: [],
            after: [],
            response: [],
        }
    }

    private _newCollection3d(): PipeFieldCollection {
        return {
            before: {},
            after: {},
            response: {},
        }
    }

    private _append2d(coll: PipeItemCollection, item: PipeItem): void {
        const d = item.opt.dir;
        if (coll[d] === undefined) {
            return;
        }
        switch (item.opt.dir) {
            case "before":
                coll.before.push(item as PipeItem);
                break;
            case "after":
                coll.after.push(item as PipeItem);
                break;
            case "response":
                coll.response.push(item as PipeItem);
                break;
        }
    }

    private _append3d(coll: PipeFieldCollection, item: PipeItem): void {
        const d = item.opt.dir;
        if (coll[d] === undefined) {
            return;
        }
        item.opt.selectedParameters.forEach(f => {
            if (coll[d][f] === undefined) {
                coll[d][f] = [];
            }
            coll[d][f].push(item as PipeItem)
        })
    }

    private _get2d(coll: PipeItemCollection, dir: PipeDirPro): Array<PipeItem> {
        switch (dir) {
            case "before":
                return coll.before;
            case "after":
                return coll.after;
            case "response":
                return coll.response;
            default:
                return [];
        }
    }

    private _get3d(coll: PipeFieldCollection, dir: PipeDirPro, field: string): Array<PipeItem> {
        if (coll[dir] === undefined) {
            return [];
        }
        if (coll[dir][field] === undefined) {
            return [];
        }
        return coll[dir][field];
    }

    // region add

    private _setItemIs(ins: DecoInstanceLike, lambda: PipePassLambda, item: PipeItem): void {
        if ($is.empty(lambda)) {
            item.is = () => true;
            return;
        }
        if (typeof lambda === 'function') {
            item.is = lambda;
            return;
        }
        throw $dev.invalidError({
            issue: 'invalid.is.lambda',
            field: 'item.error',
            type: typeof item.is,
            value: item.is,
            desc: ins.description,
            where: 'leyyo.pipe.PipePool',
            method: '_setItemIs'
        });
    }

    private _setItemTransforms(ins: DecoInstanceLike, transforms: PipeLambdaAny, item: PipeItem): void {
        $assert.func(transforms, () => $dev.desc(ins, {
            field: 'transforms',
            where: 'leyyo.pipe.PipePool',
            method: '_setItemTransforms'
        }));
        if (footprint.isAsync(transforms)) {
            item.transforms = {isAsync: true, fn: transforms};
        } else {
            item.transforms = {fn: transforms};
        }
    }

    protected _beforeAdd(given: PipeAddGiven): PipeItem {
        if (!$is.object(given)) {
            throw $dev.invalidError({
                issue: 'invalid.add.dto',
                field: 'given',
                type: typeof given,
                value: given,
                where: 'leyyo.pipe.PipePool',
                method: 'add'
            });
        }
        const item = callItem.buildItem(given.ins, given.opt, given.params) as PipeItem;

        this._setItemIs(given.ins, given.is, item);
        this._setItemTransforms(given.ins, given.transforms, item);

        return item;
    }

    protected _add2d<R extends CoreReflectionLike>(ref: R, map: Map<R, PipeItemCollection>, item: PipeItem): void {
        this._usedDecoratorInstances.push(item.ins);
        if (!map.has(ref)) {
            map.set(ref, this._newCollection2d());
        }
        this._append2d(map.get(ref), item);
    }

    protected _add3d<R extends CoreReflectionLike>(ref: R, map: Map<R, PipeFieldCollection>, item: PipeItem): void {
        this._usedDecoratorInstances.push(item.ins);
        if (!map.has(ref)) {
            map.set(ref, this._newCollection3d());
        }
        this._append3d(map.get(ref), item);
    }

    protected _addApplication(given: PipeAddGiven): void {
        const item = this._beforeAdd(given);
        this._usedDecoratorInstances.push(item.ins);
        this._append3d(this._applicationItems, item)
    }

    protected _addControllerClass(given: PipeAddGiven): void {
        const item = this._beforeAdd(given);
        this._add3d(item.ins.asClass, this._controllerItems, item);
    }

    protected _addEndpointMethod(given: PipeAddGiven): void {
        const item = this._beforeAdd(given);
        this._add3d(item.ins.asMethod, this._endpointItems, item);
    }

    protected _addEndpointParameter(given: PipeAddGiven): void {
        const item = this._beforeAdd(given);
        this._add2d(item.ins.asParameter, this._parameterItems, item);
    }

    protected _addTypeClass(given: PipeAddGiven): void {
        const item = this._beforeAdd(given);
        this._add2d(item.ins.asClass, this._typeClassItems, item);
    }

    protected _addDtoProperty(given: PipeAddGiven): void {
        const item = this._beforeAdd(given);
        this._add2d(item.ins.asField, this._dtoPropertyItems, item);
    }

    // endregion add

    options<P extends CallParams = CallParams>(ins: DecoInstanceLike, given: any): PipeOptPro<P> {
        const opt = callOption.read<PipeOpt<P>, PipeOptPro<P>>(ins, given, this.KEYS, this.CONDITION);
        opt.dir = pipePool.dir(ins, opt.dir);
        if (ins.isClass || ins.isMethod) {
            $assert.textArray(opt.selectedParameters, () => $dev.desc(ins, {field: 'selectedParameters'}));
        } else if (!$is.empty(opt.selectedParameters)) {
            throw $dev.developerError({issue: 'parameters.can.be.used.in.class.or.parameter', desc: ins.description});
        }
        return opt;
    }

    dir(ins: DecoInstanceLike, value: PipeDir): PipeDirPro {
        if (typeof value !== 'string') {
            throw $dev.invalidError({
                issue: 'invalid.pipe.dir.type',
                type: typeof value,
                desc: ins.description,
                field: 'dir'
            });
        }
        switch (value) {
            case "before":
            case "after":
            case "response":
                return value;
            case "b":
            case "B":
            case "->":
                return 'before';
            case "a":
            case "A":
            case ">-":
                return 'after';
            case "r":
            case "R":
            case "<":
                return 'response';
            default:
                throw $dev.invalidError({issue: 'invalid.pipe.dir.value', value, desc: ins.description, field: 'dir'});
        }

    }

    protected _findRedundant(): void {
        decoratorPool.decorators()
            .filter(deco => deco.hasKeyword(IdPipe))
            .map(deco => deco.asIdentifier)
            .forEach(deco => {
                deco.instances.forEach(ins => {
                    if (!this._usedDecoratorInstances.includes(ins)) {
                        // todo
                        console.log(`unnecessary: ${ins.description}`);
                    }
                })
            })
    }

    protected _refreshEndpointInfo(methodRef: PropertyReflectionLike, field: keyof PipeEndpointInfo): void {
        if (!this._endpointInfo.has(methodRef)) {
            this._endpointInfo.set(methodRef, {});
        }
        const info = this._endpointInfo.get(methodRef);
        info[field] = true;
        info.$any = true;
    }

    initialize(): void {
        let hasApplication = false;
        reflectionPool.classes()
            .forEach(clazzRef => {
                const objectType = httpSigner.tag(clazzRef.creator);
                let hasController = false;

                clazzRef.docsAll<PipeStored>()
                    .forEach((docC, indexC) => {
                        const deco = docC.ins.identifier;
                        if (!deco.hasKeyword(IdPipe)) {
                            return;
                        }

                        const metadata = deco.getMetadata<PipeMetadata>();
                        const given = {
                            ins: docC.ins,
                            opt: docC.value.opt,
                            params: docC.value.params,
                            is: metadata.is,
                            transforms: metadata.transforms,
                            index: indexC,
                        } as PipeAddGiven;
                        switch (objectType) {
                            case 'http.app':
                                this._addApplication(given);
                                hasApplication = true;
                                break;
                            case 'http.controller':
                                this._addControllerClass(given);
                                hasController = true;
                                break;
                            // on dto
                            default:
                                this._addTypeClass(given);
                                break;
                        }
                    });

                clazzRef.listInstanceProperties()
                    .forEach(propPref => {
                        if (hasApplication) {
                            this._refreshEndpointInfo(propPref, 'application');
                        }
                        if (hasController && propPref.kind === 'method') {
                            this._refreshEndpointInfo(propPref, 'controller');
                        }
                        propPref.docsAll<PipeStored>()
                            .forEach((docM, indexM) => {
                                const deco = docM.ins.identifier;
                                if (!deco.hasKeyword(IdPipe)) {
                                    return;
                                }
                                const metadata = deco.getMetadata<PipeMetadata>();
                                const given = {
                                    ins: docM.ins,
                                    opt: docM.value.opt,
                                    params: docM.value.params,
                                    is: metadata.is,
                                    transforms: metadata.transforms,
                                    index: indexM,
                                } as PipeAddGiven;

                                let isEndpoint = false;
                                switch (objectType) {
                                    // on controller endpoint
                                    case 'http.controller':
                                        if (propPref.kind === 'method') {
                                            if (httpSigner.isExt(clazzRef.creator, propPref.name, 'methods') || httpSigner.is(propPref.callable, 'http.endpoint')) {
                                                this._addEndpointMethod(given);
                                                isEndpoint = true;
                                                this._refreshEndpointInfo(propPref, 'self');
                                            }
                                        }
                                        break;
                                    case 'http.app':
                                        break;
                                    // on dto field
                                    default:
                                        if (propPref.kind === 'field') {
                                            this._addDtoProperty(given);
                                        }
                                        break;
                                }

                                if (isEndpoint) {
                                    propPref.listParameters()
                                        .forEach(paramRef => {
                                            paramRef.docsAll<PipeStored>()
                                                .forEach((docP, indexP) => {
                                                    const deco = docP.ins.identifier;
                                                    if (!deco.hasKeyword(IdPipe)) {
                                                        return;
                                                    }
                                                    const metadata = deco.getMetadata<PipeMetadata>();
                                                    const given = {
                                                        ins: docP.ins,
                                                        opt: docP.value.opt,
                                                        params: docP.value.params,
                                                        is: metadata.is,
                                                        transforms: metadata.transforms,
                                                        index: indexP,
                                                    } as PipeAddGiven;
                                                    this._addEndpointParameter(given);
                                                    this._refreshEndpointInfo(propPref, 'parameter');
                                                });
                                        });
                                }
                            });
                    });
            });
    }

    endpointInfo(methodRef: PropertyReflectionLike): PipeEndpointInfo {
        return this._endpointInfo.get(methodRef) ?? {};
    }

    applicationItems(dir: PipeDirPro, name: string): Array<PipeItem> {
        return this._get3d(this._applicationItems, dir, name);
    }

    controllerItems(dir: PipeDirPro, classRef: ClassReflectionLike, name: string): Array<PipeItem> {
        if (!this._controllerItems.has(classRef)) {
            return [];
        }
        return this._get3d(this._controllerItems.get(classRef), dir, name);
    }

    endpointItems(dir: PipeDirPro, methodRef: PropertyReflectionLike, name: string): Array<PipeItem> {
        if (!this._endpointItems.has(methodRef)) {
            return [];
        }
        return this._get3d(this._endpointItems.get(methodRef), dir, name);
    }


    dtoPropertyItems(dir: PipeDirPro, fieldRef: PropertyReflectionLike): Array<PipeItem> {
        if (!this._dtoPropertyItems.has(fieldRef)) {
            return [];
        }
        return this._get2d(this._dtoPropertyItems.get(fieldRef), dir);
    }

    parameterItems(dir: PipeDirPro, paramRef: ParameterReflectionLike): Array<PipeItem> {
        if (!this._parameterItems.has(paramRef)) {
            return [];
        }
        return this._get2d(this._parameterItems.get(paramRef), dir);
    }

    typeClassItems(dir: PipeDirPro, classRef: ClassReflectionLike): Array<PipeItem> {
        if (!this._typeClassItems.has(classRef)) {
            return [];
        }
        return this._get2d(this._typeClassItems.get(classRef), dir);
    }

}

export const pipePool: PipePoolLike = new PipePool();
