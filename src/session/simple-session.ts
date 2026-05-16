import { SolverInput, SolverOutput } from '../contracts/eoq';

export type ConversationMessage = { role: 'user' | 'assistant'; content: string };

export type SimpleSession = {
  sessionId: string;
  solverInput: SolverInput;
  solverOutput: SolverOutput;
  history: ConversationMessage[];
};

const store = new Map<string, SimpleSession>();

export const getSession = (id: string): SimpleSession | undefined => store.get(id);

export const saveSession = (session: SimpleSession): void => {
  store.set(session.sessionId, session);
};
