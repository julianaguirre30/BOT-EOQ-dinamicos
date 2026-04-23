import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadLlmInterpreterConfig } from '../src/config/llm-config';
import { InterpreterFailure } from '../src/interpreter/eoq-interpreter';

describe('loadLlmInterpreterConfig', () => {
  it('loads Groq interpreter settings from a .env-style file', () => {
    const directory = mkdtempSync(join(tmpdir(), 'eoq-llm-config-'));
    const envFilePath = join(directory, '.env');

    try {
      writeFileSync(
        envFilePath,
        [
          'EOQ_INTERPRETER_PROVIDER=groq',
          'EOQ_INTERPRETER_API_KEY=test-key',
          'EOQ_INTERPRETER_MODEL=llama-3.3-70b-versatile',
          'EOQ_INTERPRETER_TIMEOUT_MS=12000',
        ].join('\n'),
      );

      const config = loadLlmInterpreterConfig({ env: {}, envFilePath });

      expect(config).toEqual({
        provider: 'groq',
        apiKey: 'test-key',
        baseUrl: 'https://api.groq.com/openai/v1',
        model: 'llama-3.3-70b-versatile',
        timeoutMs: 12000,
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('fails closed when the API key is missing', () => {
    expect(() => loadLlmInterpreterConfig({ env: {}, envFilePath: 'missing.env' })).toThrowError(
      InterpreterFailure,
    );
    expect(() => loadLlmInterpreterConfig({ env: {}, envFilePath: 'missing.env' })).toThrow(
      /EOQ_INTERPRETER_API_KEY/,
    );
  });
});
