import { mkdir, readFile, readdir, rm, writeFile } from 'fs/promises';
import path from 'path';

import { SolverInput, SolverOutput } from '../contracts/eoq';

export type ConversationMessage = { role: 'user' | 'assistant'; content: string };

export type SimpleSession = {
  sessionId: string;
  solverInput: SolverInput;
  solverOutput: SolverOutput;
  history: ConversationMessage[];
};

export interface SessionRepository {
  get(sessionId: string): Promise<SimpleSession | undefined>;
  set(session: SimpleSession): Promise<void>;
  delete(sessionId: string): Promise<boolean>;
  clear(): Promise<void>;
}

export class FileSessionRepository implements SessionRepository {
  private readonly cache = new Map<string, SimpleSession>();

  constructor(private readonly sessionsDir = path.join(process.cwd(), 'sessions')) {}

  private sessionFilePath(sessionId: string): string {
    return path.join(this.sessionsDir, `${encodeURIComponent(sessionId)}.json`);
  }

  private async ensureSessionsDir(): Promise<void> {
    await mkdir(this.sessionsDir, { recursive: true });
  }

  async get(sessionId: string): Promise<SimpleSession | undefined> {
    const cached = this.cache.get(sessionId);
    if (cached) return structuredClone(cached);

    await this.ensureSessionsDir();
    const filePath = this.sessionFilePath(sessionId);
    try {
      const raw = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as SimpleSession;
      this.cache.set(sessionId, parsed);
      return structuredClone(parsed);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }
  }

  async set(session: SimpleSession): Promise<void> {
    await this.ensureSessionsDir();
    const filePath = this.sessionFilePath(session.sessionId);
    const serialized = JSON.stringify(session, null, 2);
    await writeFile(filePath, serialized, 'utf-8');
    this.cache.set(session.sessionId, structuredClone(session));
  }

  async delete(sessionId: string): Promise<boolean> {
    const filePath = this.sessionFilePath(sessionId);
    this.cache.delete(sessionId);
    try {
      await rm(filePath);
      return true;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  async clear(): Promise<void> {
    await this.ensureSessionsDir();
    const files = await readdir(this.sessionsDir);
    await Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map((file) => rm(path.join(this.sessionsDir, file))),
    );
    this.cache.clear();
  }
}

// En Vercel (serverless) solo /tmp es escribible; en local usamos sessions/ del proyecto.
const SESSIONS_DIR = process.env.VERCEL
  ? path.join('/tmp', 'simplex-sessions')
  : path.join(process.cwd(), 'sessions');

const defaultRepository = new FileSessionRepository(SESSIONS_DIR);

export const getSession = (id: string): Promise<SimpleSession | undefined> => defaultRepository.get(id);

export const saveSession = (session: SimpleSession): Promise<void> => defaultRepository.set(session);
