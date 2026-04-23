import { describe, expect, it } from 'vitest';

import { InMemorySessionStore } from '../src/session/session-store';

describe('InMemorySessionStore', () => {
  it('stores and retrieves validated session snapshots', async () => {
    const store = new InMemorySessionStore();

    await store.set({
      sessionId: 'session-1',
      turnCount: 1,
      visibleDefaults: [],
      pendingCriticalFields: [],
    });

    const state = await store.get('session-1');

    expect(state?.sessionId).toBe('session-1');
    expect(state?.turnCount).toBe(1);
  });

  it('patches an existing session while preserving its identity', async () => {
    const store = new InMemorySessionStore();

    await store.patch('session-2', {
      turnCount: 1,
      pendingCriticalFields: ['setupCost'],
    });

    const patched = await store.patch('session-2', {
      visibleDefaults: ['lead_time=0'],
      turnCount: 2,
    });

    expect(patched.sessionId).toBe('session-2');
    expect(patched.pendingCriticalFields).toEqual(['setupCost']);
    expect(patched.visibleDefaults).toEqual(['lead_time=0']);
    expect(patched.turnCount).toBe(2);
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
