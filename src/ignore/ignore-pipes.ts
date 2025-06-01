import {decoratorPool} from "@leyyo/core";
import {$assert, $dev, Dict, Func} from "@leyyo/common";
import {FQN} from "../internal";
import {IgnorePipesOpt} from "./index.types";
import {pipeIgnore} from "./pipe.ignore";


interface P {
    allOrDecorators: true | Array<Func | string>;
}

export function IgnorePipes(decorators?: Array<Func | string>): ClassDecorator;
export function IgnorePipes(decorators?: Array<Func | string>): MethodDecorator;
export function IgnorePipes(all?: true): ClassDecorator;
export function IgnorePipes(all?: true): MethodDecorator;
export function IgnorePipes(allOrDecorators: true | Array<Func | string> = true): ClassDecorator | MethodDecorator {
    return (clazz: object, property?: PropertyKey, descriptor?: TypedPropertyDescriptor<any>) =>
        deco.process(deco.fork(clazz, property, descriptor), {allOrDecorators});
}

const deco = decoratorPool.newId<IgnorePipesOpt, Dict, P>(IgnorePipes)
    .fqn(FQN)
    .targets('class', 'method')
    .keywords('manageable')
    .processor((ins, p) => {
        const opt = {functions: [], names: []} as IgnorePipesOpt;
        opt.ins = ins;
        if (p.allOrDecorators === true) {
            opt.all = true;
        } else {
            $assert.array(p.allOrDecorators, () => $dev.desc(ins, {field: 'decorators'}));
            if (p.allOrDecorators.length < 1) {
                throw $dev.invalidError({issue: 'empty.array', desc: ins.description, field: 'decorators'});
            }
            opt.functions = p.allOrDecorators.filter(item => typeof item === 'function');
            opt.names = p.allOrDecorators.filter(item => typeof item === 'string');
        }
        ins.set(opt);

        if (ins.isClass) {
            pipeIgnore.addClass(ins.asClass, opt);
        } else if (ins.isMethod) {
            pipeIgnore.addMethod(ins.asMethod, opt);
        }
    });
