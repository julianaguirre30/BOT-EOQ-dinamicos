import { TurnController } from '../../application/turn-controller';
import { createGroqEoqInterpreterFromEnv } from '../../interpreter/groq-eoq-interpreter';
import { EoqInterpreter } from '../../interpreter/eoq-interpreter';
import { InMemorySessionStore, SessionStore } from '../../session/session-store';

class LazyEnvInterpreter implements EoqInterpreter {
  private resolved?: EoqInterpreter;

  constructor(private readonly createInterpreterFromEnv: () => EoqInterpreter) {}

  async interpret(request: { sessionId: string; userText: string }) {
    this.resolved ??= this.createInterpreterFromEnv();
    return this.resolved.interpret(request);
  }
}

export type ChatRuntime = {
  controller: TurnController;
  sessionStore: SessionStore;
};

export const createChatRuntime = (dependencies?: {
  sessionStore?: SessionStore;
  createInterpreterFromEnv?: () => EoqInterpreter;
}): ChatRuntime => {
  const sessionStore = dependencies?.sessionStore ?? new InMemorySessionStore();
  const interpreter = new LazyEnvInterpreter(
    dependencies?.createInterpreterFromEnv ?? (() => createGroqEoqInterpreterFromEnv()),
  );

  return {
    sessionStore,
    controller: new TurnController({
      sessionStore,
      interpreter,
    }),
  };
};

declare global {
  var __eoqChatRuntime__: ChatRuntime | undefined;
}

export const getChatRuntime = (): ChatRuntime => {
  globalThis.__eoqChatRuntime__ ??= createChatRuntime();
  return globalThis.__eoqChatRuntime__;
};
