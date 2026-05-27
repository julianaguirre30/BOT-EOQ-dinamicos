import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { FileSessionRepository, SimpleSession } from '../src/session/simple-session';

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

describe('FileSessionRepository', () => {
  it('persists sessions across repository instances', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'simplex-sessions-'));
    try {
      const firstRepo = new FileSessionRepository(dir);
      const session = buildSession('session-1');
      await firstRepo.set(session);

      const secondRepo = new FileSessionRepository(dir);
      const restored = await secondRepo.get('session-1');

      expect(restored?.sessionId).toBe('session-1');
      expect(restored?.history).toHaveLength(2);
      expect(restored?.solverOutput.mathematicalArtifacts.costBreakdown.totalRelevantCost).toBe(40);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
