import { describe, expect, it } from 'vitest';

import { ProblemInterpretationSchema } from '../src/contracts/eoq';
import { normalizeProblemInterpretation } from '../src/domain/normalization/eoq-normalizer';

describe('EOQ normalization', () => {
  it('maps common scalar aliases into canonical fields', () => {
    const interpretation = ProblemInterpretationSchema.parse({
      normalizedText: 'Caso con aliases comunes.',
      extractedValues: {
        annualDemand: 3600,
        holding_cost: 6,
        setup_cost: 80,
        lead_time: 0,
      },
      units: {},
      taxonomyTags: [{ family: 'inventory', topic: 'eoq', variant: 'standard', status: 'supported', notes: [] }],
      confidence: 0.93,
      missingCriticalFields: [],
      issues: [],
    });

    const normalized = normalizeProblemInterpretation(interpretation);

    expect(normalized.canonicalInput).toMatchObject({
      demandRate: 3600,
      holdingCost: 6,
      setupCost: 80,
      leadTime: 0,
      branch: 'with_setup',
      variant: 'scalar',
    });
    expect(normalized.recognizedAliases).toMatchObject({
      demandRate: 'annualDemand',
      holdingCost: 'holding_cost',
      setupCost: 'setup_cost',
      leadTime: 'lead_time',
    });
  });

  it('normalizes dataset-style indexed keys like P1..Pn and c1..cn', () => {
    const interpretation = ProblemInterpretationSchema.parse({
      normalizedText: 'Caso con índices por período.',
      extractedValues: {
        P1: 40,
        P2: 50,
        P3: 30,
        P4: 60,
        c1: 5,
        c2: 6,
        c3: 7,
        c4: 8,
        holdingCost: 1,
        setupCost: 0,
      },
      units: {},
      taxonomyTags: [{ family: 'inventory', topic: 'eoq', variant: 'standard', status: 'supported', notes: [] }],
      confidence: 0.94,
      missingCriticalFields: [],
      issues: [],
    });

    const normalized = normalizeProblemInterpretation(interpretation);

    expect(normalized.canonicalInput.periodDemands).toEqual([40, 50, 30, 60]);
    expect(normalized.canonicalInput.unitCostByPeriod).toEqual([5, 6, 7, 8]);
    expect(normalized.canonicalInput.branch).toBe('no_setup');
    expect(normalized.canonicalInput.variant).toBe('unit_cost_by_period');
    expect(normalized.notes).toEqual(
      expect.arrayContaining([
        'normalized_period_demands_from_indexed_keys',
        'normalized_unit_cost_by_period_from_indexed_keys',
      ]),
    );
  });

  it('canonicalizes production-cost series aliases before choosing the no-setup period-cost variant', () => {
    const interpretation = ProblemInterpretationSchema.parse({
      normalizedText: 'Caso sin setup con costos unitarios de producción por período.',
      branchCandidate: 'with_setup',
      extractedValues: {
        periodDemands: [40, 50, 30, 60],
        productionCost: [5, 6, 7, 8],
        holdingCost: 1,
      },
      units: {},
      taxonomyTags: [{ family: 'inventory', topic: 'eoq', variant: 'standard', status: 'supported', notes: [] }],
      confidence: 0.9,
      missingCriticalFields: [],
      issues: [],
    });

    const normalized = normalizeProblemInterpretation(interpretation);

    expect(normalized.canonicalInput).toMatchObject({
      periodDemands: [40, 50, 30, 60],
      unitCostByPeriod: [5, 6, 7, 8],
      branch: 'no_setup',
      variant: 'unit_cost_by_period',
    });
    expect(normalized.recognizedAliases.unitCostByPeriod).toBe('productionCost');
  });
});
