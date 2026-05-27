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
});
