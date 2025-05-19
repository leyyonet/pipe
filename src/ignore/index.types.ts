import {ClassReflectionLike, DecoIdLike, DecoInstanceLike, PropertyReflectionLike} from "@leyyo/core";
import {Func} from "@leyyo/common";
import {PipeDirPro} from "../pool";

export interface PipeIgnoreLike {
    forApplication(dir: PipeDirPro): IgnoredItem;

    forController(dir: PipeDirPro, clazzRef: ClassReflectionLike): IgnoredItem;

    forEndpoint(dir: PipeDirPro, methodRef: PropertyReflectionLike): IgnoredItem;

    forType(dir: PipeDirPro, clazzRef: ClassReflectionLike): IgnoredItem;

    addClass(clazz: ClassReflectionLike, item: IgnorePipesOpt): void;

    addMethod(method: PropertyReflectionLike, item: IgnorePipesOpt): void;
}

export interface IgnoredItem {
    all?: true;
    decorators: Array<DecoIdLike>;
}

export type IgnoredItems = Record<PipeDirPro, IgnoredItem>;

export interface IgnorePipesOpt {
    dir: PipeDirPro;
    ins: DecoInstanceLike;
    all?: true;
    functions: Array<Func>;
    names: Array<string>;
}
