import { describe, expect, it } from 'vitest';

import { ProblemInterpretation, ProblemInterpretationSchema, toPublicResponseEnvelope } from '../src/contracts/eoq';
import { routeProblemInterpretation } from '../src/domain/routing/eoq-router';
import { selectAndRunDeterministicSolver } from '../src/domain/solver/algorithm-selector';
import { solveExactNoSetup, solveExactWithSetup } from '../src/domain/solver/exact-solvers';
import { assembleStudyResponse } from '../src/pedagogy/render-response';
import { eoqCaseFixtures } from './fixtures/eoq-cases';

const fixtureById = (id: string) => {
  const fixture = eoqCaseFixtures.find((candidate) => candidate.id === id);

  if (!fixture) {
    throw new Error(`Missing fixture ${id}`);
  }

  return fixture;
};

const buildInterpretation = (
  id: string,
  overrides: Partial<ProblemInterpretation>,
): ProblemInterpretation => {
  const fixture = fixtureById(id);

  return ProblemInterpretationSchema.parse({
    normalizedText: fixture.userText,
    extractedValues: {},
    units: {},
    taxonomyTags: fixture.taxonomyTags,
    confidence: 0.9,
    missingCriticalFields: [],
    issues: [],
    ...overrides,
  });
};

describe('deterministic EOQ solvers', () => {
  it('solves the with-setup branch with an exact dynamic-programming replenishment plan', () => {
    const input = {
      branch: 'with_setup' as const,
      variant: 'scalar' as const,
      periodDemands: [40, 20, 40],
      holdingCost: 1,
      setupCost: 50,
      leadTime: 0,
    };

    const first = solveExactWithSetup(input);
    const second = solveExactWithSetup(input);

    expect(first).toEqual(second);
    expect(first.solverFamily).toBe('exact_with_setup');
    expect(first.policy.replenishmentPlan).toEqual([
      { period: 1, quantity: 60, coversThroughPeriod: 2 },
      { period: 3, quantity: 40, coversThroughPeriod: 3 },
    ]);
    expect(first.mathematicalArtifacts.costBreakdown.totalRelevantCost).toBe(120);
    expect(first.comparison?.method).toBe('silver_meal');
  });

  it('solves the no-setup branch with the exact period-by-period policy', () => {
    const input = {
      branch: 'no_setup' as const,
      variant: 'scalar' as const,
      periodDemands: [35, 55, 25],
      holdingCost: 2,
      leadTime: 0,
    };

    const result = solveExactNoSetup(input);

    expect(result.solverFamily).toBe('exact_no_setup');
    expect(result.policy.replenishmentPlan).toEqual([
      { period: 1, quantity: 35, coversThroughPeriod: 1 },
      { period: 2, quantity: 55, coversThroughPeriod: 2 },
      { period: 3, quantity: 25, coversThroughPeriod: 3 },
    ]);
    expect(result.mathematicalArtifacts.costBreakdown.totalRelevantCost).toBe(0);
    expect(result.comparison).toBeUndefined();
  });

  it('solves setup-by-period cases with exact dynamic programming and no scalar fallback leakage', () => {
    const input = {
      branch: 'with_setup' as const,
      variant: 'setup_by_period' as const,
      periodDemands: [20, 45, 35, 60],
      holdingCost: 3,
      setupCostByPeriod: [90, 120, 80, 140],
      leadTime: 0,
    };

    const result = solveExactWithSetup(input);

    expect(result.solverFamily).toBe('exact_with_setup');
    expect(result.policy.replenishmentPlan).toEqual([
      { period: 1, quantity: 20, coversThroughPeriod: 1 },
      { period: 2, quantity: 45, coversThroughPeriod: 2 },
      { period: 3, quantity: 35, coversThroughPeriod: 3 },
      { period: 4, quantity: 60, coversThroughPeriod: 4 },
    ]);
    expect(result.mathematicalArtifacts.costBreakdown.setupOrOrderingCost).toBe(430);
    expect(result.mathematicalArtifacts.costBreakdown.totalRelevantCost).toBe(430);
    expect(result.comparison).toBeUndefined();
  });

  it('solves no-setup unit-cost-by-period cases by trading off purchase and holding cost deterministically', () => {
    const input = {
      branch: 'no_setup' as const,
      variant: 'unit_cost_by_period' as const,
      periodDemands: [40, 50, 30, 60],
      unitCostByPeriod: [5, 7, 4, 8],
      holdingCost: 1,
      leadTime: 0,
    };

    const result = solveExactNoSetup(input);

    expect(result.solverFamily).toBe('exact_no_setup');
    expect(result.policy.replenishmentPlan).toEqual([
      { period: 1, quantity: 90, coversThroughPeriod: 2 },
      { period: 3, quantity: 90, coversThroughPeriod: 4 },
    ]);
    expect(result.mathematicalArtifacts.endingInventoryByPeriod).toEqual([50, 0, 60, 0]);
    expect(result.mathematicalArtifacts.costBreakdown).toEqual({
      setupOrOrderingCost: 810,
      holdingCost: 110,
      totalRelevantCost: 920,
    });
    expect(result.comparison).toBeUndefined();
  });
});

describe('algorithm selection and response assembly', () => {
  it('assembles a study-oriented solved response with explicit structure', () => {
    const interpretation = buildInterpretation('complete-with-setup', {
      branchCandidate: 'with_setup',
      extractedValues: {
        periodDemands: [40, 20, 40],
        demandSchedule: [40, 20, 40],
        holdingCost: 1,
        h: 1,
        setupCost: 50,
        orderingCost: 50,
        S: 50,
        leadTime: 0,
      },
    });

    const routingResult = routeProblemInterpretation(interpretation);
    const selection = selectAndRunDeterministicSolver(routingResult);
    const response = assembleStudyResponse({
      interpretation,
      routingResult,
      algorithmSelection: selection.algorithmSelection,
      solverInput: selection.solverInput,
      solverOutput: selection.solverOutput,
    });
    const publicResponse = toPublicResponseEnvelope(response);
    const publicText = JSON.stringify({
      studentMessage: publicResponse.studentMessage,
      pedagogy: publicResponse.pedagogicalArtifacts,
    });

    expect(response.mode).toBe('solved');
    expect(response.algorithmSelection.solverFamily).toBe('exact_with_setup');
    expect(response.algorithmSelection.silverMealIncluded).toBe(true);
    expect(response.solverOutput?.mathematicalArtifacts.orderPeriods).toEqual([1, 3]);
    expect(response.pedagogicalArtifacts.interpretation.length).toBeGreaterThan(0);
    expect(response.pedagogicalArtifacts.model.length).toBeGreaterThan(0);
    expect(response.pedagogicalArtifacts.algorithm.length).toBeGreaterThan(0);
    expect(response.pedagogicalArtifacts.result.length).toBeGreaterThan(0);
    expect(response.pedagogicalArtifacts.procedure.length).toBeGreaterThan(0);
    expect(response.pedagogicalArtifacts.justification.length).toBeGreaterThan(0);
    expect(publicText).not.toContain('validated_branch:with_setup');
    expect(publicText).not.toContain('single_item_deterministic_eoq');
    expect(publicText).not.toContain('exact_with_setup');
    expect(response.pedagogicalArtifacts.result.join(' ')).toContain('Plan completo de reposición');
    expect(response.pedagogicalArtifacts.result.join(' ')).toContain('Período 1: reponer 60 unidades para cubrir desde 1 hasta 2.');
    expect(response.pedagogicalArtifacts.result.join(' ')).toContain('Período 3: reponer 40 unidades para cubrir solo ese período.');
    expect(publicResponse.studentMessage).toContain('plan completo');
  });

  it('describes no-setup unit-cost-by-period solutions without pretending they are universal lot-for-lot', () => {
    const interpretation = buildInterpretation('explicit-without-setup', {
      branchCandidate: 'no_setup',
      extractedValues: {
        P1: 40,
        P2: 50,
        P3: 30,
        P4: 60,
        setupCost: 0,
        c1: 5,
        c2: 7,
        c3: 4,
        c4: 8,
        holdingCost: 1,
        leadTime: 0,
      },
    });

    const routingResult = routeProblemInterpretation(interpretation);
    const selection = selectAndRunDeterministicSolver(routingResult);
    const response = assembleStudyResponse({
      interpretation,
      routingResult,
      algorithmSelection: selection.algorithmSelection,
      solverInput: selection.solverInput,
      solverOutput: selection.solverOutput,
    });
    const publicText = JSON.stringify(response.pedagogicalArtifacts);

    expect(response.solverInput?.variant).toBe('unit_cost_by_period');
    expect(response.solverOutput?.policy.replenishmentPlan).toEqual([
      { period: 1, quantity: 90, coversThroughPeriod: 2 },
      { period: 3, quantity: 90, coversThroughPeriod: 4 },
    ]);
    expect(response.pedagogicalArtifacts.algorithm[0]).toContain('costo unitario por período');
    expect(publicText).toContain('puede anticipar compras');
    expect(publicText).toContain('no siempre coincide con lote-por-lote');
  });

  it('keeps blocked cases away from solving through the existing routing flow', () => {
    const interpretation = buildInterpretation('ambiguous-branch', {
      extractedValues: {
        periodDemands: [60, 40],
        holdingCost: 2,
      },
      confidence: 0.8,
      missingCriticalFields: ['branch'],
    });

    const routingResult = routeProblemInterpretation(interpretation);
    const response = assembleStudyResponse({ interpretation, routingResult });
    const publicText = JSON.stringify({
      studentMessage: response.studentMessage,
      pedagogy: response.pedagogicalArtifacts,
    });

    expect(routingResult.decision).toBe('ask');
    expect(() => selectAndRunDeterministicSolver(routingResult)).toThrow(
      'Routing result is not solvable; deterministic solver selection is blocked.',
    );
    expect(response.mode).toBe('clarify');
    expect(response.solverOutput).toBeUndefined();
    expect(response.pedagogicalArtifacts.result[0]).toContain('pausado');
    expect(publicText).not.toContain('branch_is_materially_ambiguous');
    expect(publicText).not.toContain('material_branch_ambiguity');
  });

  it('uses invalid-data wording for semantically inconsistent blocked cases', () => {
    const interpretation = buildInterpretation('inconsistent-data', {
      branchCandidate: 'with_setup',
      extractedValues: {
        demandRate: 200,
        holdingCost: -3,
        setupCost: 90,
        leadTime: 0,
      },
      issues: ['negative holding cost', 'incompatible time basis'],
    });

    const routingResult = routeProblemInterpretation(interpretation);
    const response = assembleStudyResponse({ interpretation, routingResult });
    const publicText = JSON.stringify(response.pedagogicalArtifacts);

    expect(response.mode).toBe('refuse');
    expect(response.refusal?.kind).toBe('invalid_input');
    expect(publicText).toContain('datos validados son inconsistentes o inválidos');
    expect(publicText).not.toContain('falta validar datos críticos');
  });

  it('keeps out-of-domain blocked output focused on scope instead of missing fields', () => {
    const interpretation = buildInterpretation('out-of-domain-shortages', {
      branchCandidate: 'with_setup',
      extractedValues: {
        demandRate: 4000,
        holdingCost: 5,
        setupCost: 75,
        leadTime: 0,
        itemCount: 3,
        shortagesAllowed: true,
        demandPattern: 'stochastic',
      },
    });

    const routingResult = routeProblemInterpretation(interpretation);
    const response = assembleStudyResponse({ interpretation, routingResult });
    const publicText = JSON.stringify(response.pedagogicalArtifacts);

    expect(response.mode).toBe('refuse');
    expect(response.refusal?.kind).toBe('out_of_domain');
    expect(publicText).toContain('fuera de alcance');
    expect(publicText).not.toContain('falta validar datos críticos');
  });
});
