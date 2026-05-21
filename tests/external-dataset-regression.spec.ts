import dataset from './fixtures/eoq-dinamico-minimos.json';
import { describe, expect, it } from 'vitest';

import { ProblemInterpretationSchema } from '../src/contracts/eoq';
import { routeProblemInterpretation } from '../src/domain/routing/eoq-router';

type DatasetLabel = (typeof dataset)[number]['label'];

const interpretationsByLabel: Record<DatasetLabel, ReturnType<typeof ProblemInterpretationSchema.parse>> = {
  completo: ProblemInterpretationSchema.parse({
    normalizedText: dataset[0].text,
    branchCandidate: 'with_setup',
    extractedValues: {
      P1: 40,
      P2: 60,
      P3: 30,
      P4: 50,
      P5: 20,
      setup_cost: 100,
      holding_cost: 2,
    },
    units: { timeBasis: 'period' },
    taxonomyTags: [{ family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'with_setup', status: 'supported', notes: [] }],
    confidence: 0.95,
    missingCriticalFields: [],
    issues: [],
  }),
  criollo: ProblemInterpretationSchema.parse({
    normalizedText: dataset[1].text,
    branchCandidate: 'with_setup',
    extractedValues: {
      demand: [25, 40, 35, 20, 50],
      orderingCost: 80,
      unitHoldingCost: 3,
    },
    units: { timeBasis: 'month' },
    taxonomyTags: [{ family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'with_setup', status: 'supported', notes: [] }],
    confidence: 0.9,
    missingCriticalFields: [],
    issues: [],
  }),
  ambiguo: ProblemInterpretationSchema.parse({
    normalizedText: dataset[2].text,
    extractedValues: {
      P1: 30,
      P2: 45,
      P3: 20,
      P4: 60,
      holding_cost: 2,
    },
    units: { timeBasis: 'period' },
    taxonomyTags: [{ family: 'inventory', topic: 'eoq', variant: 'standard', status: 'ambiguous', notes: ['branch unresolved'] }],
    confidence: 0.84,
    missingCriticalFields: ['branch', 'setupCost'],
    issues: [],
  }),
  inconsistente: ProblemInterpretationSchema.parse({
    normalizedText: dataset[3].text,
    branchCandidate: 'with_setup',
    extractedValues: {
      P1: 50,
      P2: -20,
      P3: 40,
      P4: 30,
      setupCost: 100,
      holdingCost: 2,
    },
    units: { timeBasis: 'period' },
    taxonomyTags: [{ family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'with_setup', status: 'supported', notes: [] }],
    confidence: 0.92,
    missingCriticalFields: [],
    issues: ['negative demand'],
  }),
  fuera_de_dominio: ProblemInterpretationSchema.parse({
    normalizedText: dataset[4].text,
    branchCandidate: 'with_setup',
    extractedValues: {
      demandPattern: 'stochastic',
      shortagesAllowed: true,
    },
    units: {},
    taxonomyTags: [{ family: 'inventory', topic: 'eoq', variant: 'non_mvp', status: 'unsupported', notes: ['stochastic shortages'] }],
    confidence: 0.94,
    missingCriticalFields: [],
    issues: [],
  }),
  con_setup: ProblemInterpretationSchema.parse({
    normalizedText: dataset[5].text,
    extractedValues: {
      P1: 20,
      P2: 45,
      P3: 35,
      P4: 60,
      P5: 30,
      P6: 25,
      S1: 90,
      S2: 120,
      S3: 80,
      S4: 140,
      S5: 100,
      S6: 110,
      holding_cost: 3,
      leadTime: 0,
    },
    units: { timeBasis: 'period' },
    taxonomyTags: [{ family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'with_setup', status: 'supported', notes: [] }],
    confidence: 0.93,
    missingCriticalFields: [],
    issues: [],
  }),
  sin_setup: ProblemInterpretationSchema.parse({
    normalizedText: dataset[6].text,
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
      leadTime: 0,
    },
    units: { timeBasis: 'period' },
    taxonomyTags: [{ family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'no_setup', status: 'supported', notes: [] }],
    confidence: 0.93,
    missingCriticalFields: [],
    issues: [],
  }),
};

describe('external dataset regression harness', () => {
  it('keeps the supported subset stable and upgrades the new deterministic extension cases', () => {
    const results = dataset.map((item) => ({
      label: item.label,
      expected: item.expected_bot_behavior,
      routing: routeProblemInterpretation(interpretationsByLabel[item.label]),
    }));

    const byLabel = Object.fromEntries(results.map((result) => [result.label, result.routing]));

    expect(byLabel.completo.decision).toBe('solve');
    expect(byLabel.completo.normalization.canonicalInput.periodDemands).toEqual([40, 60, 30, 50, 20]);
    expect(byLabel.criollo.decision).toBe('solve');
    expect(byLabel.ambiguo.decision).toBe('ask');
    expect(byLabel.inconsistente.decision).toBe('refuse');
    expect(byLabel.inconsistente.refusal?.kind).toBe('invalid_input');
    expect(byLabel.fuera_de_dominio.decision).toBe('refuse');
    expect(byLabel.fuera_de_dominio.refusal?.kind).toBe('out_of_domain');
    expect(byLabel.con_setup.decision).toBe('solve');
    expect(byLabel.con_setup.trace.why).toContain('validated_variant:setup_by_period');
    expect(byLabel.sin_setup.decision).toBe('solve');
    expect(byLabel.sin_setup.trace.why).toContain('validated_variant:unit_cost_by_period');
  });

  it('routes audited no-setup period-cost aliases through the unit_cost_by_period path without breaking stable fixtures', () => {
    const aliasCases = {
      production_cost_array: ProblemInterpretationSchema.parse({
        normalizedText:
          'Sin setup, con demanda por períodos y costos unitarios de producción por período informados como serie.',
        branchCandidate: 'with_setup',
        extractedValues: {
          P1: 40,
          P2: 50,
          P3: 30,
          P4: 60,
          productionCost: [5, 6, 7, 8],
          holdingCost: 1,
          leadTime: 0,
        },
        units: { timeBasis: 'period' },
        taxonomyTags: [{ family: 'inventory', topic: 'eoq', variant: 'standard', status: 'supported', notes: [] }],
        confidence: 0.91,
        missingCriticalFields: [],
        issues: [],
      }),
      purchase_cost_map: ProblemInterpretationSchema.parse({
        normalizedText:
          'Sin setup, con demanda por períodos y costos unitarios de compra por período informados como mapa.',
        extractedValues: {
          periodDemands: [40, 50, 30, 60],
          setupCost: 0,
          purchaseCostByPeriod: {
            P1: 5,
            P2: 6,
            P3: 7,
            P4: 8,
          },
          holdingCost: 1,
          leadTime: 0,
        },
        units: { timeBasis: 'period' },
        taxonomyTags: [{ family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'no_setup', status: 'supported', notes: [] }],
        confidence: 0.92,
        missingCriticalFields: [],
        issues: [],
      }),
    } as const;

    const routedAliases = Object.fromEntries(
      Object.entries(aliasCases).map(([label, interpretation]) => [label, routeProblemInterpretation(interpretation)]),
    );

    expect(routedAliases.production_cost_array.decision).toBe('solve');
    expect(routedAliases.production_cost_array.normalization.canonicalInput).toMatchObject({
      branch: 'no_setup',
      variant: 'unit_cost_by_period',
      unitCostByPeriod: [5, 6, 7, 8],
    });
    expect(routedAliases.production_cost_array.trace.why).toContain('validated_variant:unit_cost_by_period');

    expect(routedAliases.purchase_cost_map.decision).toBe('solve');
    expect(routedAliases.purchase_cost_map.validation.normalizedInput).toMatchObject({
      branch: 'no_setup',
      variant: 'unit_cost_by_period',
      unitCostByPeriod: [5, 6, 7, 8],
    });

    const stableWithSetup = routeProblemInterpretation(interpretationsByLabel.con_setup);
    const stableScalarNoSetup = routeProblemInterpretation(
      ProblemInterpretationSchema.parse({
        normalizedText: 'Caso estable sin setup y sin costo unitario por período.',
        extractedValues: {
          demandRate: 3600,
          holdingCost: 6,
          setupCost: 0,
          leadTime: 0,
        },
        units: { timeBasis: 'year' },
        taxonomyTags: [{ family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'no_setup', status: 'supported', notes: [] }],
        confidence: 0.93,
        missingCriticalFields: [],
        issues: [],
      }),
    );

    expect(stableWithSetup.trace.why).toContain('validated_variant:setup_by_period');
    expect(stableScalarNoSetup.validation.normalizedInput).toMatchObject({
      branch: 'no_setup',
      variant: 'scalar',
    });
  });
});
