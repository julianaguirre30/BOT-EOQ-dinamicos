import { describe, expect, it, vi } from 'vitest';

import { GroqEoqInterpreter } from '../src/interpreter/groq-eoq-interpreter';
import { InterpreterFailure } from '../src/interpreter/eoq-interpreter';
import {
  ChatCompletionClient,
  ChatCompletionRequest,
} from '../src/infrastructure/llm/chat-completion-client';

const createClient = (content: string): ChatCompletionClient & { complete: ReturnType<typeof vi.fn> } => ({
  complete: vi.fn<(_: ChatCompletionRequest) => Promise<{ provider: string; model: string; content: string }>>().mockResolvedValue({
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    content,
  }),
});

describe('GroqEoqInterpreter', () => {
  it('returns a validated ProblemInterpretation on the happy path', async () => {
    const client = createClient(
      JSON.stringify({
        normalizedText: 'Demanda anual 1200, mantener 5, sin setup.',
        branchCandidate: 'no_setup',
        extractedValues: {
          demandRate: 1200,
          holdingCost: 5,
        },
        units: { timeBasis: 'year' },
        taxonomyTags: [
          {
            family: 'inventory',
            topic: 'eoq',
            variant: 'standard',
            branch: 'no_setup',
            status: 'supported',
            notes: [],
          },
        ],
        confidence: 0.94,
        missingCriticalFields: [],
        issues: [],
      }),
    );
    const interpreter = new GroqEoqInterpreter({
      client,
      model: 'llama-3.3-70b-versatile',
    });

    const result = await interpreter.interpret({
      sessionId: 'groq-success',
      userText: 'Demanda anual 1200, mantener 5, sin setup.',
    });

    expect(result.branchCandidate).toBe('no_setup');
    expect(result.extractedValues).toEqual({
      demandRate: 1200,
      holdingCost: 5,
    });
  });

  it('sends a coverage-oriented payload for colloquial EOQ prompts', async () => {
    const client = createClient(
      JSON.stringify({
        normalizedText:
          'Arranco con 20 unidades. Demandas mensuales: 80, 120 y 60. Cada pedido cuesta 150 y mantener cuesta 3 por unidad por mes.',
        branchCandidate: 'with_setup',
        extractedValues: {
          periodDemands: [80, 120, 60],
          setupCost: 150,
          holdingCost: 3,
          leadTime: 0,
          initialInventory: 20,
        },
        units: { timeBasis: 'month' },
        taxonomyTags: [
          {
            family: 'inventory',
            topic: 'eoq',
            variant: 'standard',
            branch: 'with_setup',
            status: 'supported',
            notes: [],
          },
        ],
        confidence: 0.95,
        missingCriticalFields: [],
        issues: [],
      }),
    );
    const interpreter = new GroqEoqInterpreter({
      client,
      model: 'llama-3.3-70b-versatile',
    });

    await interpreter.interpret({
      sessionId: 'groq-payload-coverage',
      userText:
        'Che, arranco con 20 unidades. Tengo demandas mensuales de 80, 120 y 60. Cada pedido me sale 150 pesos, mantener cada unidad me cuesta 3 por mes y reponen al toque.',
    });

    const request = client.complete.mock.calls[0]?.[0];
    expect(request?.messages[0]?.content).toContain('COBERTURA');
    expect(request?.messages[1]?.content).toContain('extractionTargets');
    expect(request?.messages[1]?.content).toContain('periodDemands');
    expect(request?.messages[1]?.content).toContain('initialInventory');
    expect(request?.messages[1]?.content).toContain('reposición inmediata');
  });

  it('downgrades materially empty extraction when obvious EOQ evidence is present', async () => {
    const interpreter = new GroqEoqInterpreter({
      client: createClient(
        JSON.stringify({
          normalizedText: 'texto normalizado',
          extractedValues: {},
          units: {},
          taxonomyTags: [
            {
              family: 'inventory',
              topic: 'eoq',
              variant: 'standard',
              status: 'supported',
              notes: [],
            },
          ],
          confidence: 0.91,
          missingCriticalFields: [],
          issues: [],
        }),
      ),
      model: 'llama-3.3-70b-versatile',
    });

    const result = await interpreter.interpret({
      sessionId: 'groq-under-extracted',
      userText:
        'Che, arranco con 15 unidades y tengo demandas mensuales de 80, 120 y 60. Cada pedido sale 150 pesos, mantener cada unidad cuesta 3 por mes y la reposición es inmediata.',
    });

    expect(result.confidence).toBeLessThan(0.6);
    expect(result.missingCriticalFields).toEqual(
      expect.arrayContaining(['periodDemands', 'holdingCost', 'setupCost', 'leadTime', 'initialInventory']),
    );
    expect(result.issues).toEqual(
      expect.arrayContaining([
        'interpreter_under_extracted',
        'interpreter_under_extracted_periodDemands',
        'interpreter_under_extracted_holdingCost',
        'interpreter_under_extracted_setupCost',
      ]),
    );
  });

  it('rejects malformed JSON from the provider before it reaches routing/solve', async () => {
    const interpreter = new GroqEoqInterpreter({
      client: createClient('{"normalizedText":'),
      model: 'llama-3.3-70b-versatile',
    });

    await expect(
      interpreter.interpret({
        sessionId: 'groq-invalid-json',
        userText: 'Texto ambiguo.',
      }),
    ).rejects.toMatchObject({
      code: 'invalid_json',
    });
  });

  it('rejects schema-invalid JSON from the provider', async () => {
    const interpreter = new GroqEoqInterpreter({
      client: createClient(
        JSON.stringify({
          normalizedText: 'texto',
          extractedValues: {},
          units: {},
          taxonomyTags: [],
          confidence: 2,
          missingCriticalFields: [],
          issues: [],
        }),
      ),
      model: 'llama-3.3-70b-versatile',
    });

    await expect(
      interpreter.interpret({
        sessionId: 'groq-schema-mismatch',
        userText: 'Texto ambiguo.',
      }),
    ).rejects.toMatchObject({
      code: 'schema_mismatch',
    });
  });

  it('surfaces provider failures as typed interpreter failures', async () => {
    const client: ChatCompletionClient = {
      complete: vi.fn().mockRejectedValue(new InterpreterFailure('network down', 'provider_failure')),
    };
    const interpreter = new GroqEoqInterpreter({
      client,
      model: 'llama-3.3-70b-versatile',
    });

    await expect(
      interpreter.interpret({
        sessionId: 'groq-provider-failure',
        userText: 'Texto ambiguo.',
      }),
    ).rejects.toMatchObject({
      code: 'provider_failure',
    });
  });
});
