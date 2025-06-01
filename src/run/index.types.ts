import {ClassReflectionLike, PropertyReflectionLike} from "@leyyo/core";
import {ClassLike, Dict, ExceptionLike, Fnc} from "@leyyo/common";
import {Ctx} from "@leyyo/http";
import {PipeDirPro} from "../pool";
import {CallCurrent, CallParams} from "@leyyo/http-call";


export interface PipeRunLike {
    hasClass(dir: PipeDirPro, clazz: ClassReflectionLike | Fnc | ClassLike): boolean;
    runForClass(dir: PipeDirPro, clazz: ClassReflectionLike | Fnc | ClassLike, ctx: Ctx, values: Dict, prevField?: string): Promise<RunResult>;
    hasMethod(dir: PipeDirPro, methodRef: PropertyReflectionLike, ignoredIndexes: Array<number>): boolean;
    runForMethod(dir: PipeDirPro, method: PropertyReflectionLike, ctx: Ctx, values: Array<any>, ignoredIndexes: Array<number>): Promise<Array<any>>;
}

export interface RunResult<E = any> {
    errors: Array<ExceptionLike>;
    value: E;
}

export interface PipeCachedError {
    exception: ExceptionLike;
    fields: Array<string>;
    times: number;
}

export interface PipeCurrent<P extends CallParams = CallParams> extends CallCurrent<P> {
    ignored(): true;

    changed(value: any): TransformResult;
}

export interface TransformResult {
    value?: any;
}
