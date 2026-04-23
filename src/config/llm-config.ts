import { z } from 'zod';

import { InterpreterFailure } from '../interpreter/eoq-interpreter';
import { EnvMap, loadDotEnvFile } from './dotenv';

const LlmInterpreterConfigSchema = z.object({
  provider: z.literal('groq'),
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  timeoutMs: z.number().int().positive(),
});

export type LlmInterpreterConfig = z.infer<typeof LlmInterpreterConfigSchema>;

const DEFAULT_ENV_FILE_PATH = '.env';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_TIMEOUT_MS = 15_000;

const readOptional = (env: EnvMap, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = env[key];

    if (value !== undefined && value.trim() !== '') {
      return value.trim();
    }
  }

  return undefined;
};

const readRequired = (env: EnvMap, keys: string[], missingLabel: string): string => {
  const value = readOptional(env, keys);

  if (!value) {
    throw new InterpreterFailure(
      `Missing required LLM interpreter configuration: ${missingLabel}`,
      'missing_config',
      missingLabel,
    );
  }

  return value;
};

export const mergeEnvSources = (fileEnv: EnvMap, processEnv: EnvMap): EnvMap => ({
  ...fileEnv,
  ...Object.fromEntries(
    Object.entries(processEnv).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  ),
});

export const loadLlmInterpreterConfig = ({
  env = process.env as EnvMap,
  envFilePath = DEFAULT_ENV_FILE_PATH,
}: {
  env?: EnvMap;
  envFilePath?: string;
} = {}): LlmInterpreterConfig => {
  const mergedEnv = mergeEnvSources(loadDotEnvFile(envFilePath), env);
  const provider = readOptional(mergedEnv, ['EOQ_INTERPRETER_PROVIDER', 'LLM_PROVIDER']) ?? 'groq';

  if (provider !== 'groq') {
    throw new InterpreterFailure(
      `Unsupported LLM interpreter provider: ${provider}`,
      'missing_config',
      'EOQ_INTERPRETER_PROVIDER',
    );
  }

  const timeoutRaw =
    readOptional(mergedEnv, ['EOQ_INTERPRETER_TIMEOUT_MS', 'LLM_TIMEOUT_MS']) ??
    String(DEFAULT_TIMEOUT_MS);
  const timeoutMs = Number.parseInt(timeoutRaw, 10);

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new InterpreterFailure(
      'Invalid LLM interpreter timeout configuration.',
      'missing_config',
      'EOQ_INTERPRETER_TIMEOUT_MS',
    );
  }

  return LlmInterpreterConfigSchema.parse({
    provider,
    apiKey: readRequired(mergedEnv, ['EOQ_INTERPRETER_API_KEY', 'GROQ_API_KEY'], 'EOQ_INTERPRETER_API_KEY'),
    baseUrl:
      readOptional(mergedEnv, ['EOQ_INTERPRETER_BASE_URL', 'GROQ_BASE_URL']) ?? DEFAULT_BASE_URL,
    model: readOptional(mergedEnv, ['EOQ_INTERPRETER_MODEL', 'GROQ_MODEL']) ?? DEFAULT_MODEL,
    timeoutMs,
  });
};
