import { SessionState, SessionStateSchema, createEmptySessionState } from '../contracts/eoq';

export interface SessionStore {
  get(sessionId: string): Promise<SessionState | undefined>;
  set(state: SessionState): Promise<SessionState>;
  patch(sessionId: string, patch: Partial<SessionState>): Promise<SessionState>;
  delete(sessionId: string): Promise<boolean>;
  clear(): Promise<void>;
}

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, SessionState>();

  async get(sessionId: string): Promise<SessionState | undefined> {
    const state = this.sessions.get(sessionId);
    return state ? structuredClone(state) : undefined;
  }

  async set(state: SessionState): Promise<SessionState> {
    const parsed = SessionStateSchema.parse(state);
    this.sessions.set(parsed.sessionId, structuredClone(parsed));
    return structuredClone(parsed);
  }

  async patch(sessionId: string, patch: Partial<SessionState>): Promise<SessionState> {
    const current = this.sessions.get(sessionId) ?? createEmptySessionState(sessionId);
    const merged = SessionStateSchema.parse({
      ...current,
      ...patch,
      sessionId,
    });

    this.sessions.set(sessionId, structuredClone(merged));
    return structuredClone(merged);
  }

  async delete(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }

  async clear(): Promise<void> {
    this.sessions.clear();
  }
}
