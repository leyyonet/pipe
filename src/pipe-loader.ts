import {Fqn, Loader} from "@leyyo/core";
import {FQN_PCK} from "./internal";
import {IgnorePipes, pipeIgnore} from "./ignore";
import {pipePool} from "./pool";
import {pipeRun} from "./run";

@Loader(pipeIgnore, pipePool, pipeRun, IgnorePipes)
@Fqn(FQN_PCK)
export class PipeLoader {
}
