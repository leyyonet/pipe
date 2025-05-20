import {ClassReflectionLike, DecoInstanceLike, ParameterReflectionLike, PropertyReflectionLike} from "@leyyo/core";
import {CallItem, CallOpt, CallOptPro, CallParams} from "@leyyo/http-call";
import {PipeCurrent, TransformResult} from "../run";

/**
 * before: During request, before Validation
 * after: During request, after Validation
 * response: During response
 * */
export type PipeDirPro = 'before' | 'after' | 'response';
export type PipeDir = PipeDirPro | 'b' | 'B' | '->' | 'a' | 'A' | '>-' | 'r' | 'R' | '<';

/**
 * Options used to pass to validation decorators.
 */
export interface PipeOpt<P extends CallParams = CallParams> extends CallOpt<P> {
    dir?: PipeDir;
}

export interface PipeOptExt<P extends CallParams = CallParams> extends PipeOpt<P> {
    selectedParameters: Array<string>;
}

export interface PipeOptPro<P extends CallParams = CallParams> extends CallOptPro<P> {
    dir: PipeDirPro;
    selectedParameters: Array<string>;
}

// deco metadata
export interface PipeMetadata<P extends CallParams = CallParams, E = any> {
    is?: PipePassLambda<E>;
    transforms: PipeLambdaAny<P, E>;
}

// deco instance value
export interface PipeStored<P extends CallParams = CallParams> {
    opt: PipeOptPro;
    params: P;
}

export interface PipeAddGiven<P extends CallParams = CallParams, E = any> {
    ins: DecoInstanceLike;
    opt: PipeOptPro;
    params: P;
    index: number;

    is?: PipePassLambda<E>;
    transforms: PipeLambdaAny<P, E>;
}


export type PipeItemCollection<P extends CallParams = CallParams, E = any> = Record<PipeDirPro, Array<PipeItem<P, E>>>;
export type PipeFieldCollection<P extends CallParams = CallParams, E = any> = Record<PipeDirPro, Record<string, Array<PipeItem<P, E>>>>;

export interface PipeItem<P extends CallParams = CallParams, E = any> extends CallItem<P, PipeOptPro> {
    index: number;
    is: PipePassLambda<E>;
    transforms: PipeLambdaPro<P, E>;
}


export interface PipeLambdaPro<P extends CallParams = CallParams, E = any> {
    isAsync?: boolean;
    fn: PipeLambdaAny<P, E>;
}

export type PipeLambdaAny<P extends CallParams = CallParams, E = any> =
    PipeLambdaSync<P, E>
    | PipeLambdaAsync<P, E>;
export type PipeLambdaSync<P extends CallParams = CallParams, E = any> = (data: E, current: PipeCurrent<P>) => TransformResult | true;
export type PipeLambdaAsync<P extends CallParams = CallParams, E = any> = (data: E, current: PipeCurrent<P>) => Promise<TransformResult | true>;

export type PipePassLambda<E = any> = (data: E) => boolean;


export interface PipeParam<P = any> {
    params?: P;
    opt: PipeOpt;
}

export interface PipeEndpointInfo {
    controller?: true;
    application?: true;
    self?: true;
    parameter?: true;
    $any?: true;
}

export interface PipePoolLike {

    endpointInfo(method: PropertyReflectionLike): PipeEndpointInfo;

    applicationItems(dir: PipeDirPro, name: string): Array<PipeItem>;

    controllerItems(dir: PipeDirPro, classRef: ClassReflectionLike, name: string): Array<PipeItem>;

    endpointItems(dir: PipeDirPro, methodRef: PropertyReflectionLike, name: string): Array<PipeItem>;

    parameterItems(dir: PipeDirPro, paramRef: ParameterReflectionLike): Array<PipeItem>;

    typeClassItems(dir: PipeDirPro, classRef: ClassReflectionLike): Array<PipeItem>;

    dtoPropertyItems(dir: PipeDirPro, fieldRef: PropertyReflectionLike): Array<PipeItem>;

    options<P extends CallParams = CallParams>(ins: DecoInstanceLike, given: any): PipeOptPro<P>;

    dir(ins: DecoInstanceLike, value: PipeDir): PipeDirPro;

    initialize(): void;
}
