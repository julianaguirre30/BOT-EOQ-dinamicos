import { SolverInput, SolverOutput } from '../contracts/eoq';

/**
 * Payload adjunto a mensajes resueltos — contiene el resultado del solver
 * para renderizar la tabla de plan y costos.
 */
export type SolvePayload = {
  sessionId: string;
  solverInput: SolverInput;
  solverOutput: SolverOutput;
};

/**
 * Detected parameter from user input after parsing (kept for formatters compat)
 */
export type DetectedDatum = {
  label: string;
  value: string;
};

/**
 * Single entry in the chat feed (user message or assistant response)
 */
export type ChatEntry =
  | { id: string; role: 'user'; text: string }
  | {
      id: string;
      role: 'assistant';
      text: string;
      solvePayload?: SolvePayload;
      options?: Array<{ label: string; value: string }>;
    };
