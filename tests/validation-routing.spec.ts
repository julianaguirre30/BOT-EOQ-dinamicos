import { describe, expect, it } from 'vitest';

import { ProblemInterpretation, ProblemInterpretationSchema } from '../src/contracts/eoq';
import {
  parseInterpretationRequest,
  parseProblemInterpretation,
} from '../src/interpreter/eoq-interpreter';
import { routeProblemInterpretation } from '../src/domain/routing/eoq-router';
import { validateProblemInterpretation } from '../src/domain/validation/eoq-validator';
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

describe('EOQ interpreter port', () => {
  it('validates the provider-agnostic interpretation request/response contracts', () => {
    const request = parseInterpretationRequest({
      sessionId: 'session-2',
      userText: 'Necesito interpretar este EOQ.',
    });

    const interpretation = parseProblemInterpretation(
      buildInterpretation('complete-with-setup', {
        branchCandidate: 'with_setup',
        extractedValues: {
          demandRate: 2400,
          holdingCost: 12,
          setupCost: 180,
          leadTime: 0.5,
        },
      }),
    );

    expect(request.sessionId).toBe('session-2');
    expect(interpretation.branchCandidate).toBe('with_setup');
  });
});

describe('EOQ validation and routing', () => {
  it('solves an in-domain with-setup interpretation through the exact deterministic family', () => {
    const interpretation = buildInterpretation('complete-with-setup', {
      branchCandidate: 'with_setup',
      extractedValues: {
        demandRate: 2400,
        holdingCost: 12,
        setupCost: 180,
        leadTime: 0.5,
      },
    });

    const validation = validateProblemInterpretation(interpretation);
    const result = routeProblemInterpretation(interpretation);

    expect(validation.ok).toBe(true);
    expect(result.decision).toBe('solve');
    expect(result.solvable).toBe(true);
    expect(result.domainStatus).toBe('in_domain');
    expect(result.trace.chosenBranch).toBe('with_setup');
    expect(result.trace.solverFamily).toBe('exact_with_setup');
    expect(result.trace.why).toContain('silver_meal_only_optional_pedagogical_comparison');
  });

  it('solves an in-domain no-setup interpretation and applies the visible zero-lead-time default', () => {
    const interpretation = buildInterpretation('explicit-without-setup', {
      branchCandidate: 'no_setup',
      extractedValues: {
        demandRate: 3600,
        holdingCost: 6,
      },
    });

    const result = routeProblemInterpretation(interpretation);

    expect(result.decision).toBe('solve');
    expect(result.solvable).toBe(true);
    expect(result.validation.defaultsApplied).toContain('lead_time=0');
    expect(result.trace.chosenBranch).toBe('no_setup');
    expect(result.trace.solverFamily).toBe('exact_no_setup');
  });

  it('accepts common LLM aliases for EOQ numeric fields', () => {
    const interpretation = buildInterpretation('explicit-without-setup', {
      branchCandidate: 'no_setup',
      extractedValues: {
        annualDemand: 3600,
        holdingCostPerUnitPerYear: 6,
        setupCost: 0,
      },
    });

    const result = routeProblemInterpretation(interpretation);

    expect(result.decision).toBe('solve');
    expect(result.solvable).toBe(true);
    expect(result.validation.errors).toEqual([]);
    expect(result.normalization.canonicalInput).toMatchObject({
      demandRate: 3600,
      holdingCost: 6,
      setupCost: 0,
      branch: 'no_setup',
      variant: 'scalar',
    });
    expect(result.validation.normalizedInput?.demandRate).toBe(3600);
    expect(result.validation.normalizedInput?.holdingCost).toBe(6);
  });

  it('accepts academic notation aliases S/h with weekly demand arrays', () => {
    const interpretation = buildInterpretation('complete-with-setup', {
      branchCandidate: 'with_setup',
      extractedValues: {
        S: 100,
        h: 2,
        demand: [40, 60, 30, 50],
        initialStock: 0,
      },
    });

    const result = routeProblemInterpretation(interpretation);

    expect(result.decision).toBe('solve');
    expect(result.solvable).toBe(true);
    expect(result.validation.errors).toEqual([]);
    expect(result.normalization.canonicalInput.periodDemands).toEqual([40, 60, 30, 50]);
    expect(result.validation.normalizedInput?.branch).toBe('with_setup');
    expect(result.validation.normalizedInput && result.validation.normalizedInput.branch === 'with_setup' && result.validation.normalizedInput.variant === 'scalar'
      ? result.validation.normalizedInput.setupCost
      : undefined).toBe(100);
    expect(result.validation.normalizedInput?.holdingCost).toBe(2);
    expect(result.validation.normalizedInput?.periodDemands).toEqual([40, 60, 30, 50]);
  });

  it('overrides wrong no-setup branch when setup signal is positive', () => {
    const interpretation = buildInterpretation('complete-with-setup', {
      branchCandidate: 'no_setup',
      extractedValues: {
        S: 100,
        h: 2,
        demand: [40, 60, 30, 50],
      },
    });

    const result = routeProblemInterpretation(interpretation);

    expect(result.decision).toBe('solve');
    expect(result.solvable).toBe(true);
    expect(result.validation.errors).toEqual([]);
    expect(result.validation.warnings).toContain('branch_inferred_from_setup_signal');
    expect(result.validation.normalizedInput?.branch).toBe('with_setup');
    expect(result.trace.solverFamily).toBe('exact_with_setup');
  });

  it('keeps materially ambiguous cases non-solvable and asks for clarification', () => {
    const interpretation = buildInterpretation('ambiguous-branch', {
      extractedValues: {
        demandRate: 1500,
        holdingCost: 7,
      },
      confidence: 0.81,
      missingCriticalFields: ['branch'],
    });

    const result = routeProblemInterpretation(interpretation);

    expect(result.decision).toBe('ask');
    expect(result.solvable).toBe(false);
    expect(result.clarificationRequest?.reason).toBe('material_ambiguity');
    expect(result.trace.why).toContain('branch_is_materially_ambiguous');
  });

  it('keeps inconsistent cases non-solvable and rejects them as invalid input', () => {
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

    const result = routeProblemInterpretation(interpretation);

    expect(result.decision).toBe('refuse');
    expect(result.solvable).toBe(false);
    expect(result.refusal?.kind).toBe('invalid_input');
    expect(result.validation.ok).toBe(false);
    expect(result.validation.disposition).toBe('invalid');
    expect(result.validation.errors).toContain('invalid_holding_cost');
    expect(result.validation.errors).toContain('incompatible_units_or_time_basis');
  });

  it('keeps invalid strong inconsistencies as refusal even when missing-data signals also exist', () => {
    const interpretation = buildInterpretation('inconsistent-data', {
      branchCandidate: 'with_setup',
      extractedValues: {
        demandRate: 200,
        holdingCost: -3,
        leadTime: 0,
      },
      missingCriticalFields: ['setupCost'],
      issues: ['negative holding cost', 'incompatible time basis'],
    });

    const result = routeProblemInterpretation(interpretation);

    expect(result.decision).toBe('refuse');
    expect(result.refusal?.kind).toBe('invalid_input');
    expect(result.clarificationRequest).toBeUndefined();
    expect(result.validation.errors).toEqual(
      expect.arrayContaining(['missing_setup_cost', 'invalid_holding_cost', 'incompatible_units_or_time_basis']),
    );
    expect(result.trace.why).toContain('input_inconsistency_detected');
  });

  it('keeps ambiguous EOQ-standard cases in-domain even if taxonomy variant leaks as non_mvp', () => {
    const interpretation = buildInterpretation('ambiguous-branch', {
      extractedValues: {
        demandRate: 1500,
        holdingCost: 7,
      },
      confidence: 0.81,
      missingCriticalFields: ['branch'],
      taxonomyTags: [
        {
          family: 'inventory',
          topic: 'eoq',
          variant: 'non_mvp',
          status: 'ambiguous',
          notes: ['branch between with_setup and no_setup is unresolved'],
        },
      ],
    });

    const result = routeProblemInterpretation(interpretation);

    expect(result.domainStatus).toBe('in_domain');
    expect(result.decision).toBe('ask');
    expect(result.refusal).toBeUndefined();
    expect(result.clarificationRequest?.reason).toBe('material_ambiguity');
  });

  it('blocks out-of-domain cases before they reach any solver branch', () => {
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

    const result = routeProblemInterpretation(interpretation);

    expect(result.decision).toBe('refuse');
    expect(result.solvable).toBe(false);
    expect(result.domainStatus).toBe('out_of_domain');
    expect(result.refusal?.kind).toBe('out_of_domain');
    expect(result.trace.why).toEqual(
      expect.arrayContaining(['mvp_domain_gate_blocked', 'shortages', 'stochastic', 'multi_item']),
    );
  });

  it('routes setup-by-period cases into the deterministic with-setup family', () => {
    const interpretation = buildInterpretation('complete-with-setup', {
      extractedValues: {
        P1: 20,
        P2: 45,
        P3: 35,
        S1: 90,
        S2: 120,
        S3: 80,
        holding_cost: 3,
      },
      confidence: 0.9,
    });

    const result = routeProblemInterpretation(interpretation);

    expect(result.normalization.canonicalInput.variant).toBe('setup_by_period');
    expect(result.normalization.canonicalInput.setupCostByPeriod).toEqual([90, 120, 80]);
    expect(result.decision).toBe('solve');
    expect(result.trace.chosenBranch).toBe('with_setup');
    expect(result.trace.solverFamily).toBe('exact_with_setup');
    expect(result.trace.why).toContain('validated_variant:setup_by_period');
  });

  it('routes no-setup unit-cost-by-period cases into the deterministic no-setup family', () => {
    const interpretation = buildInterpretation('explicit-without-setup', {
      extractedValues: {
        P1: 40,
        P2: 50,
        P3: 30,
        P4: 60,
        setupCost: 0,
        c1: 5,
        c2: 6,
        c3: 7,
        c4: 8,
        holdingCost: 1,
      },
    });

    const result = routeProblemInterpretation(interpretation);

    expect(result.decision).toBe('solve');
    expect(result.normalization.canonicalInput.variant).toBe('unit_cost_by_period');
    expect(result.validation.normalizedInput).toMatchObject({
      branch: 'no_setup',
      variant: 'unit_cost_by_period',
      unitCostByPeriod: [5, 6, 7, 8],
    });
    expect(result.trace.solverFamily).toBe('exact_no_setup');
  });

  it('can require confirmation when the interpretation confidence is materially low', () => {
    const interpretation = buildInterpretation('explicit-with-setup', {
      branchCandidate: 'with_setup',
      extractedValues: {
        demandRate: 5000,
        holdingCost: 8,
        setupCost: 250,
        leadTime: 0,
      },
      confidence: 0.4,
    });

    const result = routeProblemInterpretation(interpretation);

    expect(result.decision).toBe('ask');
    expect(result.solvable).toBe(false);
    expect(result.clarificationRequest?.reason).toBe('low_confidence');
    expect(result.trace.why).toContain('low_confidence_requires_confirmation');
  });
});
