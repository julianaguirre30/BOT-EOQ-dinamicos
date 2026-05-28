import { SolverInput, SolverOutput } from '../contracts/eoq';

export type ConversationMessage = { role: 'user' | 'assistant'; content: string };

export type SimpleSession = {
  sessionId: string;
  solverInput: SolverInput;
  solverOutput: SolverOutput;
  history: ConversationMessage[];
};

const sessions = new Map<string, SimpleSession>();

export const getSession = (id: string): Promise<SimpleSession | undefined> =>
  Promise.resolve(sessions.get(id));

export const saveSession = (session: SimpleSession): Promise<void> => {
  sessions.set(session.sessionId, session);
  return Promise.resolve();
};
