import { describe, expect, it } from 'vitest';

import { handleSimpleChatRequest } from '../src/app/runtime/simple-handler';

describe('handleSimpleChatRequest', () => {
  it('solves an EOQ example request through the same deterministic solve response shape', async () => {
    const response = await handleSimpleChatRequest({
      type: 'generic',
      userText: 'Mostrame un ejemplo de un modelo EOQ dinámico',
    });

    expect(response.type).toBe('solve');
    if (response.type !== 'solve') return;

    expect(response.message).toContain('Supongamos un caso sencillo de 4 períodos');
    expect(response.message).toContain('x1=10, x2=20, x3=15, x4=30');
    expect(response.message).toContain('Wagner-Whitin indica que el plan óptimo');
    expect(response.solverInput).toMatchObject({
      branch: 'with_setup',
      variant: 'scalar',
      periodDemands: [10, 20, 15, 30],
      setupCost: 100,
      holdingCost: 5,
    });
    expect(response.solverOutput.solverFamily).toBe('exact_with_setup');
    expect(response.solverOutput.policy.replenishmentPlan).toEqual([
      { period: 1, quantity: 10, coversThroughPeriod: 1 },
      { period: 2, quantity: 35, coversThroughPeriod: 3 },
      { period: 4, quantity: 30, coversThroughPeriod: 4 },
    ]);
  });

  it('suggests starting a new problem instead of inventing a second example in the solved thread', async () => {
    const solved = await handleSimpleChatRequest({
      type: 'generic',
      userText: 'Mostrame un ejemplo de un modelo EOQ dinámico',
    });

    expect(solved.type).toBe('solve');
    if (solved.type !== 'solve') return;

    const response = await handleSimpleChatRequest({
      type: 'followup',
      sessionId: solved.sessionId,
      userText: 'Dame otro ejemplo con más períodos',
    });

    expect(response.type).toBe('followup');
    if (response.type !== 'followup') return;

    expect(response.suggestsNewProblem).toBe(true);
    expect(response.message).toContain('problema nuevo');
    expect(response.message).toContain('paso a paso');
  });
});
