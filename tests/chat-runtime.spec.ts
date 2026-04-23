import { describe, expect, it, vi } from 'vitest';

import { handleChatTurnRequest } from '../src/app/runtime/chat-handler';
import { createChatRuntime } from '../src/app/runtime/chat-runtime';
import { ProblemInterpretationSchema } from '../src/contracts/eoq';
import { EoqInterpreter } from '../src/interpreter/eoq-interpreter';

describe('chat runtime composition', () => {
  it('creates the env interpreter lazily and reuses it across turns', async () => {
    const interpret = vi.fn<EoqInterpreter['interpret']>().mockResolvedValue(
      ProblemInterpretationSchema.parse({
        normalizedText: 'Demanda 1200, holding 5, sin setup.',
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
        confidence: 0.96,
        missingCriticalFields: [],
        issues: [],
      }),
    );
    const createInterpreterFromEnv = vi.fn(() => ({ interpret }));
    const runtime = createChatRuntime({ createInterpreterFromEnv });

    await handleChatTurnRequest(
      { userText: 'primer turno' },
      { controller: runtime.controller, createSessionId: () => 'runtime-session' },
    );
    await handleChatTurnRequest(
      { sessionId: 'runtime-session', userText: 'segundo turno' },
      { controller: runtime.controller },
    );

    expect(createInterpreterFromEnv).toHaveBeenCalledTimes(1);
    expect(interpret).toHaveBeenCalledTimes(2);
  });

  it('returns a structured clarify payload from the app boundary', async () => {
    const runtime = createChatRuntime({
      createInterpreterFromEnv: () => ({
        interpret: async () =>
          ProblemInterpretationSchema.parse({
            normalizedText: 'Demanda anual 1200 unidades.',
            branchCandidate: 'no_setup',
            extractedValues: { demandRate: 1200 },
            units: { timeBasis: 'year' },
            taxonomyTags: [
              {
                family: 'inventory',
                topic: 'eoq',
                variant: 'standard',
                branch: 'no_setup',
                status: 'supported',
                notes: ['holding cost missing'],
              },
            ],
            confidence: 0.94,
            missingCriticalFields: ['holdingCost'],
            issues: [],
          }),
      }),
    });

    const payload = await handleChatTurnRequest(
      { userText: 'Demanda anual 1200 unidades.' },
      { controller: runtime.controller, createSessionId: () => 'clarify-session' },
    );

    expect(payload.sessionId).toBe('clarify-session');
    expect(payload.response.mode).toBe('clarify');
    expect(payload.response.clarificationRequest?.requiredFields).toEqual(['holding_cost']);
    expect(payload.response.studentMessage).toContain('Falta al menos un dato crítico');
    expect(payload.response).not.toHaveProperty('internalTrace');
  });
});
