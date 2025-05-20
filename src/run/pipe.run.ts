import {ClassReflection, ClassReflectionLike, Fqn, PropertyReflectionLike, reflectionPool} from "@leyyo/core";
import {$is, $log, $repo, ClassLike, Dict, Exception, ExceptionLike, Fnc, Func, Obj} from "@leyyo/common";
import {PipeCachedError, PipeCurrent, PipeRunLike, RunResult, TransformResult} from "./index.types";
import {
    callItem,
    callOption,
    CallOptionProcessorSecure,
    CallParams,
    CallScopePro,
    CallWhenAsync,
    CallWhenSync
} from "@leyyo/http-call";
import {FQN_PCK} from "../internal";
import {Ctx} from "@leyyo/http";
import {pipeIgnore} from "../ignore";
import {PipeDirPro, PipeItem, PipeLambdaAsync, PipeLambdaSync, PipeOptPro, pipePool} from "../pool";

@Fqn(FQN_PCK)
class PipeRun implements PipeRunLike {
    private readonly logger = $log.create(PipeRun);
    private readonly _IGNORED = [String, Number, Date, Boolean, BigInt, Array, Object, Buffer, RegExp] as Array<any>;
    private readonly callOptionSecure: CallOptionProcessorSecure;
    private readonly cachedErrors: Map<string, PipeCachedError>;
    private readonly cachedProperties: Map<ClassReflectionLike, Array<PropertyReflectionLike>>;

    constructor() {
        this.callOptionSecure = callOption.$secure;
        this.cachedErrors = $repo.newMap(FQN_PCK, 'cachedErrors');
        this.cachedProperties = $repo.newMap(FQN_PCK, 'cachedProperties');

        setTimeout(() => this._clearCache(), 60 * 60 * 1000);
    }

    private _clearCache(): void {
        if (this.cachedErrors.size > 0) {
            //
        }
        this.cachedErrors.clear();
        this.cachedProperties.clear();

        setTimeout(() => this._clearCache(), 60 * 60 * 1000);
    }

    private _bindError<P extends CallParams = CallParams>(current: PipeCurrent<P>, causedBy: Error): ExceptionLike {
        return new Exception(causedBy.message, {
            field: current.field,
            desc: current.ins.description
        }).causedBy(causedBy);
    }

    private _fromFieldCache(classRef: ClassReflectionLike): Array<PropertyReflectionLike> {
        if (!this.cachedProperties.has(classRef)) {
            this.cachedProperties.set(classRef, classRef.listInstanceProperties({kind: 'field'}));
        }
        return this.cachedProperties.get(classRef);
    }

    private async _run<P extends CallParams = CallParams>(
        data: unknown,
        scopes: Array<CallScopePro>,
        current: PipeCurrent<P>,
        item: PipeItem<P>,
    ): Promise<RunResult> {
        const clonedScopes = [...scopes];
        const scope = clonedScopes.shift();

        switch (scope) {
            case this.callOptionSecure.$SCOPE_SELF:
                if (item.is(data)) {
                    try {
                        let transformResult: TransformResult | true;
                        if (item.transforms.isAsync) {
                            transformResult = await (item.transforms.fn as PipeLambdaAsync<P>)(data, current);
                        } else {
                            transformResult = (item.transforms.fn as PipeLambdaSync<P>)(data, current);
                        }
                        if (transformResult !== true) {
                            return {errors: [], value: transformResult.value};
                        }
                        // ignore
                        return {errors: [], value: data};
                    } catch (e) {
                        return {errors: [this._bindError(current, e)], value: data};
                    }
                }
                break;
            case this.callOptionSecure.$SCOPE_ARR_VAL:
                if (data instanceof Set) {
                    if (data.size > 0) {
                        const errors = [] as Array<ExceptionLike>;
                        const cloned = Array.from(data.values());
                        data.clear();

                        let index = 0;
                        for (const currentItem of cloned) {
                            if (!$is.typeOf(currentItem, 'function', 'symbol')) {
                                const runResult = await this._run(currentItem, clonedScopes, {
                                    ...current,
                                    field: `${current.field}#${index}`
                                }, item);
                                data.add(runResult.value);
                                errors.push(...runResult.errors);
                            } else {
                                data.add(currentItem);
                            }
                            index++;
                        }
                        return {errors, value: data};
                    }
                } else if (Array.isArray(data)) {
                    if (data.length > 0) {
                        const cloned = [...data];
                        const errors = [] as Array<ExceptionLike>;
                        data.splice(0, data.length);

                        let index = 0;
                        for (const currentItem of cloned) {
                            if (!$is.typeOf(currentItem, 'function', 'symbol')) {
                                const runResult = await this._run(currentItem, clonedScopes, {
                                    ...current,
                                    field: `${current.field}#${index}`
                                }, item);
                                data.push(runResult.value);
                                errors.push(...runResult.errors);
                            } else {
                                data.push(currentItem);
                            }
                            index++;
                        }
                        return {errors, value: data};
                    }
                }
                break;
            case this.callOptionSecure.$SCOPE_REC_KEY:
                if (data instanceof Map) {
                    if (data.size > 0) {

                        const errors = [] as Array<ExceptionLike>;
                        const cloned = Object.fromEntries(data.entries());
                        data.clear();

                        for (const [currentKey, currentValue] of Object.entries(cloned)) {
                            if (typeof currentKey !== 'symbol' && !$is.typeOf(currentValue, 'function', 'symbol')) {
                                const runResult = await this._run(currentKey, clonedScopes, {
                                    ...current,
                                    field: `${current.field}.${currentKey}`
                                }, item);
                                if ($is.typeOf(runResult.value, 'string', 'number', 'symbol')) {
                                    data.set(runResult.value, currentValue);
                                } else {
                                    console.log('ignored map key');
                                }
                                errors.push(...runResult.errors);
                            } else {
                                data.set(currentKey, currentValue);
                            }
                        }
                        return {errors, value: data};
                    }
                } else if ($is.bareObject(data)) {
                    const keys = Object.keys(data);
                    if (keys.length > 0) {
                        const errors = [] as Array<ExceptionLike>;
                        const cloned = {...(data as Dict)};
                        // clear
                        keys.forEach(key => {
                            try {
                                delete data[key];
                            } catch (e) {
                                // non configurable
                            }
                        });

                        for (const [currentItem, currentValue] of Object.entries(cloned)) {
                            if (typeof currentItem !== 'symbol' && !$is.typeOf(currentValue, 'function', 'symbol')) {
                                const runResult = await this._run(currentItem, clonedScopes, {
                                    ...current,
                                    field: `${current.field}.${currentItem}`
                                }, item);
                                if ($is.typeOf(runResult.value, 'string', 'number', 'symbol')) {
                                    try {
                                        data[runResult.value] = currentValue;
                                    } catch (e) {
                                        // non configurable
                                    }
                                } else {
                                    console.log('ignored map key');
                                }
                                errors.push(...runResult.errors);
                            } else {
                                try {
                                    data[currentItem] = currentValue;
                                } catch (e) {
                                    // non configurable
                                }
                            }
                        }
                        return {errors, value: data};
                    }
                }
                break;
            case this.callOptionSecure.$SCOPE_REC_VAL:
                if (data instanceof Map) {
                    if (data.size > 0) {
                        const errors = [] as Array<ExceptionLike>;
                        const cloned = Object.fromEntries(data.entries());
                        data.clear();

                        for (const [currentKey, currentValue] of Object.entries(cloned)) {
                            if (typeof currentKey !== 'symbol' && !$is.typeOf(currentValue, 'function', 'symbol')) {
                                const runResult = await this._run(currentValue, clonedScopes, {
                                    ...current,
                                    field: `${current.field}.${currentKey}`
                                }, item);
                                data.set(currentKey, runResult.value);
                                errors.push(...runResult.errors);
                            } else {
                                data.set(currentKey, currentValue);
                            }
                        }
                        return {errors, value: data};
                    }
                } else if ($is.bareObject(data)) {
                    const keys = Object.keys(data);
                    if (keys.length > 0) {
                        const errors = [] as Array<ExceptionLike>;
                        const cloned = {...(data as Dict)};
                        // clear
                        keys.forEach(key => {
                            try {
                                delete data[key];
                            } catch (e) {
                                // non configurable
                            }
                        });

                        for (const [currentKey, currentValue] of Object.entries(cloned)) {
                            if (typeof currentKey !== 'symbol' && !$is.typeOf(currentValue, 'function', 'symbol')) {
                                const runResult = await this._run(currentValue, clonedScopes, {
                                    ...current,
                                    field: `${current.field}.${currentKey}`
                                }, item);
                                try {
                                    data[currentKey] = runResult.value;
                                } catch (e) {
                                    // non configurable
                                }
                                errors.push(...runResult.errors);
                            } else {
                                try {
                                    data[currentKey] = currentValue;
                                } catch (e) {
                                    // non configurable
                                }
                            }
                        }
                        return {errors, value: data};
                    }
                }
                break;
        }
        return {
            errors: [],
            value: data,
        }
    }

    private _checkDeepTypes(fn: Func): boolean {
        return fn && !this._IGNORED.includes(fn);
    }

    private async _runWhen(opt: PipeOptPro, current: PipeCurrent): Promise<boolean | Error> {
        try {
            if (opt.when.isAsync) {
                return await (opt.when.fn as CallWhenAsync)(current);
            }
            return (opt.when.fn as CallWhenSync)(current);
        } catch (e) {
            return e;
        }

    }

    protected _extendCurrent(current: PipeCurrent): void {
        current.ignored = () => true;
        current.changed = value => {
            return {value};
        };
    }

    async forClass(dir: PipeDirPro, clazz: ClassReflectionLike | Fnc | ClassLike, ctx: Ctx, value: Dict, prevField?: string): Promise<RunResult> {
        const result = {errors: [], value} as RunResult;
        if (this._IGNORED.includes(clazz)) {
            return result;
        }
        let ref: ClassReflectionLike;
        if (clazz instanceof ClassReflection) {
            ref = clazz;
        } else {
            ref = reflectionPool.get(clazz, false);
            if (!ref) {
                this._IGNORED.push(clazz);
                return result;
            }
        }
        const typeInfo = pipeIgnore.forType(dir, ref);
        if (typeInfo.all) {
            this._IGNORED.push(ref.creator);
            return result;
        }

        if (!$is.object(result.value)) {
            result.value = {};
        }

        const ignoredDecorators = typeInfo.decorators;

        // for self
        const selfItems = pipePool.typeClassItems(dir, ref);
        for (const item of selfItems) {
            if (item.opt.dir !== dir) {
                continue;
            }
            if (ignoredDecorators.includes(item.deco)) {
                continue;
            }
            const current = await callItem.buildCurrent(ctx, prevField, item) as PipeCurrent;
            this._extendCurrent(current);

            const whenResult = await this._runWhen(item.opt, current);
            if (whenResult === true) {
                const runResult = await this._run(result.value, item.opt.scopes, current, item);
                result.value = runResult.value;
                result.errors.push(...runResult.errors);
            } else if (whenResult !== false) {
                result.errors.push(this._bindError(current, whenResult));
            }
        }

        // for properties
        for (const fieldRef of this._fromFieldCache(ref)) {
            const f = fieldRef.name;
            const field = prevField ? `${prevField}.${f}` : f;

            const propItems = pipePool.dtoPropertyItems(dir, fieldRef);
            for (const item of propItems) {
                if (item.opt.dir !== dir) {
                    continue;
                }
                if (ignoredDecorators.includes(item.deco)) {
                    continue;
                }

                const current = await callItem.buildCurrent(ctx, field, item) as PipeCurrent;
                this._extendCurrent(current);

                const whenResult = await this._runWhen(item.opt, current);
                if (whenResult === true) {
                    const runResult = await this._run(result.value[f], item.opt.scopes, current, item);
                    result.value[f] = runResult.value;
                    result.errors.push(...runResult.errors);
                } else if (whenResult !== false) {
                    result.errors.push(this._bindError(current, whenResult));
                }
            }
            if (this._checkDeepTypes(fieldRef.type)) {
                const classResult = await this.forClass(dir, fieldRef.type as Fnc, ctx, result.value[f], field);
                result.value[f] = classResult.value;
                result.errors.push(...classResult.errors);
            }
            const runtimeValue = result.value[f];
            if ($is.object(runtimeValue)) {
                const runtimeType = (runtimeValue as Obj).constructor;
                if (runtimeType !== fieldRef.type && this._checkDeepTypes(runtimeType)) {
                    const classResult = await this.forClass(dir, runtimeType as Fnc, ctx, runtimeValue, field);
                    result.value[f] = classResult.value;
                    result.errors.push(...classResult.errors);
                }
            }
        }
        return result;
    }

    async forMethod(dir: PipeDirPro, methodRef: PropertyReflectionLike, ctx: Ctx, value: Array<any>, ignoredIndexes: Array<number>): Promise<Array<any>> {
        const result = {errors: [], value} as RunResult<Array<any>>;

        if (!Array.isArray(result.value)) {
            result.value = [];
        }
        const paramRefList = methodRef.listParameters();
        if (result.value.length < paramRefList.length) {
            const diff = paramRefList.length - result.value.length;
            for (let i = 0; i < diff; i++) {
                result.value.push(undefined);
            }
        }

        const info = pipePool.endpointInfo(methodRef);
        if (!info.$any) {
            return result.value;
        }

        const appInfo = pipeIgnore.forApplication(dir);
        if (appInfo.all) {
            return result.value;
        }
        const controllerInfo = pipeIgnore.forController(dir, methodRef.clazz);
        if (controllerInfo.all) {
            return result.value;
        }
        const selfInfo = pipeIgnore.forEndpoint(dir, methodRef);
        if (selfInfo.all) {
            return result.value;
        }
        const ignoredDecorators = [...appInfo.decorators, ...controllerInfo.decorators, ...selfInfo.decorators];

        for (const paramRef of paramRefList) {
            if (ignoredIndexes.includes(paramRef.index)) {
                continue;
            }
            const items = pipePool.parameterItems(dir, paramRef);
            items.push(
                ...pipePool.applicationItems(dir, paramRef.name),
                ...pipePool.controllerItems(dir, methodRef.clazz, paramRef.name),
                ...pipePool.endpointItems(dir, methodRef, paramRef.name)
            );

            let field: string;
            if (paramRef.name) {
                field = paramRef.name;
            } else {
                field = `#${paramRef.index}`;
            }
            for (const item of items) {
                if (item.opt.dir !== dir) {
                    continue;
                }
                if (ignoredDecorators.includes(item.deco)) {
                    continue;
                }
                const current = await callItem.buildCurrent(ctx, field, item) as PipeCurrent;
                this._extendCurrent(current);

                const whenResult = await this._runWhen(item.opt, current);
                if (whenResult === true) {
                    const runResult = await this._run(result.value[paramRef.index], item.opt.scopes, current, item);
                    result.value[paramRef.index] = runResult.value;
                    result.errors.push(...runResult.errors);
                } else if (whenResult !== false) {
                    result.errors.push(this._bindError(current, whenResult));
                }
            }
            if (this._checkDeepTypes(paramRef.type)) {
                const classResult = await this.forClass(dir, paramRef.type as Fnc, ctx, result.value[paramRef.index], field);
                result.value[paramRef.index] = classResult.value;
                result.errors.push(...classResult.errors);
            }
            const runtimeValue = result.value[paramRef.index];
            if ($is.object(runtimeValue)) {
                const runtimeType = (runtimeValue as Obj).constructor;
                if (runtimeType !== paramRef.type && this._checkDeepTypes(runtimeType)) {
                    const classResult = await this.forClass(dir, runtimeType as Fnc, ctx, runtimeValue, field);
                    result.value[paramRef.index] = classResult.value;
                    result.errors.push(...classResult.errors);
                }
            }
        }
        if (result.errors.length > 0) {
            // todo
            result.errors.forEach(error => {
                this.logger.error(error);
            });
        }
        return result.value;
    }
}

export const pipeRun: PipeRunLike = new PipeRun();
