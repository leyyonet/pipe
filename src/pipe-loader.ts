import {Fqn} from "@leyyo/core";
import {Loader} from "@leyyo/injection";

import {FQN} from "./internal";
import {IgnorePipes, pipeIgnore} from "./ignore";
import {pipePool} from "./pool";
import {pipeRun} from "./run";

@Loader(pipeIgnore, pipePool, pipeRun, IgnorePipes)
@Fqn(FQN)
export class PipeLoader {
}
