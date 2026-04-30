import { describe, expect, it } from 'vitest';

import { createEmptySessionState } from '../src/contracts/eoq';
import { InMemorySessionStore } from '../src/session/session-store';

describe('InMemorySessionStore', () => {
  it('stores and retrieves validated session snapshots', async () => {
    const store = new InMemorySessionStore();

    await store.set({
      sessionId: 'session-1',
      turnCount: 1,
      problemCount: 0,
    });

    const state = await store.get('session-1');

    expect(state?.sessionId).toBe('session-1');
    expect(state?.turnCount).toBe(1);
    expect(state?.activeProblem).toBeUndefined();
  });

  it('patches an existing session while preserving its identity', async () => {
    const store = new InMemorySessionStore();

    await store.patch('session-2', {
      turnCount: 1,
      problemCount: 1,
      activeProblemId: 'problem-1',
      activeProblem: {
        problemId: 'problem-1',
        pendingCriticalFields: ['setupCost'],
        visibleDefaults: [],
      },
    });

    const patched = await store.patch('session-2', {
      activeProblem: {
        problemId: 'problem-1',
        pendingCriticalFields: ['setupCost'],
        visibleDefaults: ['lead_time=0'],
      },
      turnCount: 2,
    });

    expect(patched.sessionId).toBe('session-2');
    expect(patched.activeProblemId).toBe('problem-1');
    expect(patched.activeProblem?.pendingCriticalFields).toEqual(['setupCost']);
    expect(patched.activeProblem?.visibleDefaults).toEqual(['lead_time=0']);
    expect(patched.turnCount).toBe(2);
  });

  it('stores and restores the nested active problem snapshot', async () => {
    const store = new InMemorySessionStore();

    await store.set({
      sessionId: 'session-nested',
      turnCount: 2,
      problemCount: 1,
      activeProblemId: 'problem-1',
      activeProblem: {
        problemId: 'problem-1',
        interpretation: {
          normalizedText: 'Demanda anual 1200, holding 5 y sin setup.',
          branchCandidate: 'no_setup',
          extractedValues: {
            demandRate: 1200,
            holdingCost: 5,
            leadTime: 0,
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
        },
        pendingCriticalFields: [],
        visibleDefaults: ['lead_time=0'],
      },
    });

    const state = await store.get('session-nested');

    expect(state?.problemCount).toBe(1);
    expect(state?.activeProblemId).toBe('problem-1');
    expect(state?.activeProblem?.problemId).toBe('problem-1');
    expect(state?.activeProblem?.visibleDefaults).toEqual(['lead_time=0']);
    expect(state?.activeProblem?.interpretation?.extractedValues).toEqual({
      demandRate: 1200,
      holdingCost: 5,
      leadTime: 0,
    });
  });

  it('creates an empty session with no active problem thread yet', () => {
    const empty = createEmptySessionState('session-empty');

    expect(empty.sessionId).toBe('session-empty');
    expect(empty.problemCount).toBe(0);
    expect(empty.activeProblemId).toBeUndefined();
    expect(empty.activeProblem).toBeUndefined();
    expect(empty.turnCount).toBe(0);
  });

  it('supports deleting session state', async () => {
    const store = new InMemorySessionStore();

    await store.patch('session-3', { turnCount: 1 });
    const deleted = await store.delete('session-3');
    const state = await store.get('session-3');

    expect(deleted).toBe(true);
    expect(state).toBeUndefined();
  });
});
