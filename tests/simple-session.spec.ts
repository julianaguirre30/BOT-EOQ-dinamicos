import { describe, expect, it } from 'vitest';

import { getSession, saveSession, SimpleSession } from '../src/session/simple-session';

const buildSession = (sessionId: string): SimpleSession => ({
  sessionId,
  solverInput: {
    branch: 'no_setup',
    variant: 'scalar',
    periodDemands: [10, 20],
    holdingCost: 2,
  },
  solverOutput: {
    branch: 'no_setup',
    solverFamily: 'exact_no_setup',
    policy: {
      orderQuantity: 30,
      replenishmentPlan: [{ period: 1, quantity: 30, coversThroughPeriod: 2 }],
    },
    computed: {},
    equations: ['eq'],
    mathematicalArtifacts: {
      demandSchedule: [10, 20],
      endingInventoryByPeriod: [20, 0],
      orderPeriods: [1],
      costBreakdown: {
        setupOrOrderingCost: 0,
        holdingCost: 40,
        totalRelevantCost: 40,
      },
    },
  },
  history: [
    { role: 'user', content: 'resolver' },
    { role: 'assistant', content: 'plan listo' },
  ],
});

describe('InMemorySession', () => {
  it('persists and retrieves a session', async () => {
    const session = buildSession('session-test-1');
    await saveSession(session);

    const restored = await getSession('session-test-1');

    expect(restored?.sessionId).toBe('session-test-1');
    expect(restored?.history).toHaveLength(2);
    expect(restored?.solverOutput.mathematicalArtifacts.costBreakdown.totalRelevantCost).toBe(40);
  });

  it('returns undefined for unknown session', async () => {
    const result = await getSession('session-does-not-exist');
    expect(result).toBeUndefined();
  });
});
