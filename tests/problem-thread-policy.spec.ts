import { describe, expect, it } from 'vitest';

import { decideProblemThreadTransition, createFreshProblemThread } from '../src/application/problem-thread-policy';
import { ProblemInterpretationSchema, ProblemThreadStateSchema } from '../src/contracts/eoq';

const activeProblem = ProblemThreadStateSchema.parse({
  problemId: 'problem-1',
  interpretation: {
    normalizedText: 'Demanda anual 1200, holding 5, sin setup.',
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
    confidence: 0.95,
    missingCriticalFields: [],
    issues: [],
  },
  pendingCriticalFields: [],
  visibleDefaults: [],
});

const solvedActiveProblem = ProblemThreadStateSchema.parse({
  ...activeProblem,
  lastSolverInput: {
    branch: 'no_setup',
    variant: 'scalar',
    demandRate: 1200,
    holdingCost: 5,
    leadTime: 0,
  },
  lastSolverOutput: {
    branch: 'no_setup',
    solverFamily: 'exact_no_setup',
    policy: {
      orderQuantity: 1200,
      cycleTime: 1,
      replenishmentPlan: [{ period: 1, quantity: 1200, coversThroughPeriod: 1 }],
    },
    computed: { totalRelevantCost: 0 },
    equations: ['Q=D'],
    mathematicalArtifacts: {
      demandSchedule: [1200],
      endingInventoryByPeriod: [0],
      orderPeriods: [1],
      costBreakdown: {
        setupOrOrderingCost: 0,
        holdingCost: 0,
        totalRelevantCost: 0,
      },
    },
  },
});

describe('problem-thread-policy', () => {
  it('creates a clean thread with a new identifier and no stale problem-scoped state', () => {
    const thread = createFreshProblemThread({
      nextProblemNumber: 2,
    });

    expect(thread.problemId).toBe('problem-2');
    expect(thread.interpretation).toBeUndefined();
    expect(thread.lastSolverOutput).toBeUndefined();
    expect(thread.pendingCriticalFields).toEqual([]);
    expect(thread.visibleDefaults).toEqual([]);
  });

  it('starts a fresh thread when the request explicitly asks for a new problem', () => {
    const currentInterpretation = ProblemInterpretationSchema.parse({
      normalizedText: 'Ahora resolvé otro caso con demanda 400, holding 2 y setup 30.',
      branchCandidate: 'with_setup',
      extractedValues: {
        demandRate: 400,
        holdingCost: 2,
        setupCost: 30,
      },
      units: { timeBasis: 'year' },
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
      confidence: 0.96,
      missingCriticalFields: [],
      issues: [],
    });

    const decision = decideProblemThreadTransition({
      activeProblem,
      currentInterpretation,
      resetProblem: true,
    });

    expect(decision.kind).toBe('fresh');
    expect(decision.reason).toBe('explicit_reset');
  });

  it('keeps the active thread for a short clarification follow-up', () => {
    const currentInterpretation = ProblemInterpretationSchema.parse({
      normalizedText: 'El costo de mantener es 6.',
      extractedValues: {
        holdingCost: 6,
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
      confidence: 0.92,
      missingCriticalFields: [],
      issues: [],
    });

    const decision = decideProblemThreadTransition({
      activeProblem: ProblemThreadStateSchema.parse({
        ...activeProblem,
        pendingClarification: {
          reason: 'missing_critical',
          question: '¿Cuál es el costo de mantener?',
          requiredFields: ['holding_cost'],
        },
        pendingCriticalFields: ['holdingCost'],
      }),
      currentInterpretation,
      resetProblem: false,
    });

    expect(decision.kind).toBe('continue');
    expect(decision.reason).toBe('follow_up');
  });

  it('auto-switches only when a fresh conflicting EOQ anchor set appears without a pending clarification', () => {
    const currentInterpretation = ProblemInterpretationSchema.parse({
      normalizedText: 'Nuevo caso: demanda anual 300, holding 1 y setup 45.',
      branchCandidate: 'with_setup',
      extractedValues: {
        demandRate: 300,
        holdingCost: 1,
        setupCost: 45,
      },
      units: { timeBasis: 'year' },
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
      confidence: 0.97,
      missingCriticalFields: [],
      issues: [],
    });

    const decision = decideProblemThreadTransition({
      activeProblem,
      currentInterpretation,
      resetProblem: false,
    });

    expect(decision.kind).toBe('fresh');
    expect(decision.reason).toBe('detected_new_problem');
  });

  it('keeps a solved what-if follow-up in the same thread instead of treating it as a fresh problem', () => {
    const currentInterpretation = ProblemInterpretationSchema.parse({
      normalizedText: '¿Y si la demanda sube a 1400 en este mismo problema?',
      branchCandidate: 'no_setup',
      extractedValues: {
        demandRate: 1400,
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
      confidence: 0.95,
      missingCriticalFields: [],
      issues: [],
    });

    const decision = decideProblemThreadTransition({
      activeProblem: solvedActiveProblem,
      currentInterpretation,
      resetProblem: false,
    });

    expect(decision.kind).toBe('continue');
    expect(decision.reason).toBe('resolved_follow_up');
  });

  it('prefers explicit new-problem cues over solved follow-up cues', () => {
    const currentInterpretation = ProblemInterpretationSchema.parse({
      normalizedText: 'Explicame el caso anterior y ahora resolvé otro problema con demanda 400, holding 2 y setup 30.',
      branchCandidate: 'with_setup',
      extractedValues: {
        demandRate: 400,
        holdingCost: 2,
        setupCost: 30,
      },
      units: { timeBasis: 'year' },
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
    });

    const decision = decideProblemThreadTransition({
      activeProblem: solvedActiveProblem,
      currentInterpretation,
      resetProblem: false,
    });

    expect(decision.kind).toBe('fresh');
    expect(decision.reason).toBe('detected_new_problem');
  });

  it.each([
    'por que usaste esa demanda?',
    'pq tomó esa demanda?',
    'de dónde salió esa demanda?',
    'cuanto repone el periodo 3?',
    'qué compra en el período 3?',
    'qué cubre el pedido del período 3?',
    'por que en el periodo 8 no se compra nada?',
  ])('keeps solved follow-up question variants in the same thread: %s', (normalizedText) => {
    const currentInterpretation = ProblemInterpretationSchema.parse({
      normalizedText,
      extractedValues: {},
      units: {},
      taxonomyTags: [
        {
          family: 'inventory',
          topic: 'eoq',
          variant: 'standard',
          status: 'ambiguous',
          notes: [],
        },
      ],
      confidence: 0.7,
      missingCriticalFields: [],
      issues: [],
    });

    const decision = decideProblemThreadTransition({
      activeProblem: solvedActiveProblem,
      currentInterpretation,
      resetProblem: false,
    });

    expect(decision.kind).toBe('continue');
    expect(decision.reason).toBe('resolved_follow_up');
  });

  it('does not keep neutral chatter attached to a solved thread', () => {
    const currentInterpretation = ProblemInterpretationSchema.parse({
      normalizedText: 'hola',
      extractedValues: {},
      units: {},
      taxonomyTags: [
        {
          family: 'inventory',
          topic: 'eoq',
          variant: 'standard',
          status: 'ambiguous',
          notes: [],
        },
      ],
      confidence: 0.4,
      missingCriticalFields: ['demandRate', 'holdingCost'],
      issues: [],
    });

    const decision = decideProblemThreadTransition({
      activeProblem: solvedActiveProblem,
      currentInterpretation,
      resetProblem: false,
    });

    expect(decision.kind).toBe('fresh');
    expect(decision.reason).toBe('detected_new_problem');
  });
});
