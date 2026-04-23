import {
  InterpretationRequest,
  ProblemInterpretation,
  ProblemInterpretationSchema,
} from '../contracts/eoq';
import { EoqInterpreter, parseInterpretationRequest } from './eoq-interpreter';

export class FakeEoqInterpreter implements EoqInterpreter {
  constructor(private readonly scenarios: Record<string, ProblemInterpretation>) {}

  async interpret(request: InterpretationRequest): Promise<ProblemInterpretation> {
    const parsedRequest = parseInterpretationRequest(request);
    const interpretation = this.scenarios[parsedRequest.userText.trim()];

    if (!interpretation) {
      throw new Error(`Fake interpreter has no scenario for input: ${parsedRequest.userText}`);
    }

    return ProblemInterpretationSchema.parse(interpretation);
  }
}
