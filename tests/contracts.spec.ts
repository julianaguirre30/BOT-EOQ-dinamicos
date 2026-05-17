import { describe, expect, it } from 'vitest';

import {
  FinalResponseEnvelopeSchema,
  PublicResponseEnvelopeSchema,
  SessionStateSchema,
  SolverInputSchema,
  ValidationResultSchema,
} from '../src/contracts/eoq';

describe('EOQ contract schemas', () => {
  it('accepts a minimal empty session state', () => {
    const result = SessionStateSchema.parse({
      sessionId: 'session-1',
    });

    expect(result.problemCount).toBe(0);
    expect(result.activeProblemId).toBeUndefined();
    expect(result.activeProblem).toBeUndefined();
    expect(result.turnCount).toBe(0);
  });

  it('requires setup cost only for the with_setup branch', () => {
    expect(() =>
      SolverInputSchema.parse({
        branch: 'with_setup',
        demandRate: 1200,
        holdingCost: 8,
      }),
    ).toThrow();

    const noSetup = SolverInputSchema.parse({
      branch: 'no_setup',
      variant: 'scalar',
      demandRate: 1200,
      holdingCost: 8,
    });

    expect(noSetup.branch).toBe('no_setup');
  });

  it('supports a clarify response envelope without solver output', () => {
    const envelope = FinalResponseEnvelopeSchema.parse({
      mode: 'clarify',
      studentMessage: 'Necesito aclarar un dato importante antes de resolver.',
      interpretation: {
        normalizedText: 'demanda 1500 y costo fijo ambiguo',
        extractedValues: { demandRate: 1500 },
        units: {},
        taxonomyTags: [
          {
            family: 'inventory',
            topic: 'eoq',
            variant: 'standard',
            status: 'ambiguous',
          },
        ],
        confidence: 0.55,
        missingCriticalFields: ['branch'],
        issues: ['setup-vs-order ambiguity'],
      },
      normalization: {
        canonicalInput: {
          demandRate: 1500,
          variant: 'scalar',
        },
      },
      clarificationRequest: {
        reason: 'material_ambiguity',
        question: '¿Ese costo fijo es de preparación interna o de pedido externo?',
        requiredFields: ['branch'],
      },
      algorithmSelection: {
        decision: 'ask',
        silverMealIncluded: false,
        why: ['branch unresolved'],
      },
      pedagogicalArtifacts: {
        interpretation: ['Hay una ambigüedad material en la rama.'],
        model: ['Todavía no hay modelo resoluble.'],
        algorithm: ['El backend frenó antes del solver.'],
        result: ['No hay resultado numérico final.'],
        procedure: ['Primero hay que aclarar la rama.'],
        justification: ['Sin rama clara no corresponde resolver.'],
      },
      internalTrace: {
        decision: 'ask',
        silverMealIncluded: false,
        why: ['branch unresolved'],
      },
    });

    expect(envelope.mode).toBe('clarify');
    expect(envelope.solverOutput).toBeUndefined();
  });

  it('allows validation results to carry normalized deterministic solver input', () => {
    const validation = ValidationResultSchema.parse({
      ok: true,
      disposition: 'valid',
      canonicalInput: {
        branch: 'with_setup',
        periodDemands: [300, 400, 200],
        holdingCost: 12,
        setupCost: 180,
        variant: 'scalar',
      },
      normalizedInput: {
        branch: 'with_setup',
        variant: 'scalar',
        periodDemands: [300, 400, 200],
        holdingCost: 12,
        setupCost: 180,
      },
    });

    expect(validation.ok).toBe(true);
    expect(validation.normalizedInput?.branch).toBe('with_setup');
    expect(validation.normalizedInput?.periodDemands).toEqual([300, 400, 200]);
  });

  it('strips internal trace from the public response envelope', () => {
    const publicEnvelope = PublicResponseEnvelopeSchema.parse(
      FinalResponseEnvelopeSchema.parse({
        mode: 'clarify',
        studentMessage: 'Necesito aclarar un dato importante antes de resolver.',
        interpretation: {
          normalizedText: 'demanda 1500 y costo fijo ambiguo',
          extractedValues: { demandRate: 1500 },
          units: {},
          taxonomyTags: [
            {
              family: 'inventory',
              topic: 'eoq',
              variant: 'standard',
              status: 'ambiguous',
            },
          ],
          confidence: 0.55,
          missingCriticalFields: ['branch'],
          issues: ['setup-vs-order ambiguity'],
        },
        normalization: {
          canonicalInput: {
            demandRate: 1500,
            variant: 'scalar',
          },
        },
        clarificationRequest: {
          reason: 'material_ambiguity',
          question: '¿Ese costo fijo es de preparación interna o de pedido externo?',
          requiredFields: ['branch'],
        },
        algorithmSelection: {
          decision: 'ask',
          silverMealIncluded: false,
          why: ['branch unresolved'],
        },
        pedagogicalArtifacts: {
          interpretation: ['Hay una ambigüedad material en la rama.'],
          model: ['Todavía no hay modelo resoluble.'],
          algorithm: ['El backend frenó antes del solver.'],
          result: ['No hay resultado numérico final.'],
          procedure: ['Primero hay que aclarar la rama.'],
          justification: ['Sin rama clara no corresponde resolver.'],
        },
        internalTrace: {
          decision: 'ask',
          silverMealIncluded: false,
          why: ['branch unresolved'],
        },
        threadContext: {
          phase: 'resolved_follow_up',
          hasPriorSolution: true,
        },
      }),
    );

    expect('internalTrace' in publicEnvelope).toBe(false);
    expect(publicEnvelope.threadContext?.phase).toBe('resolved_follow_up');
  });

  it('accepts a refusal envelope with explicit invalid classification', () => {
    const envelope = FinalResponseEnvelopeSchema.parse({
      mode: 'refuse',
      studentMessage: 'Hay datos inconsistentes o imposibles en el planteo; corregilos antes de intentar resolverlo.',
      interpretation: {
        normalizedText: 'demanda 50, -20, 40, 30',
        extractedValues: { P1: 50, P2: -20, P3: 40, P4: 30, setupCost: 100, holdingCost: 2 },
        units: {},
        taxonomyTags: [{ family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'with_setup', status: 'supported' }],
        confidence: 0.91,
        missingCriticalFields: [],
        issues: ['negative demand'],
      },
      normalization: {
        canonicalInput: {
          branch: 'with_setup',
          variant: 'scalar',
          periodDemands: [50, -20, 40, 30],
          holdingCost: 2,
          setupCost: 100,
          leadTime: 0,
        },
      },
      validation: {
        ok: false,
        disposition: 'invalid',
        canonicalInput: {
          branch: 'with_setup',
          variant: 'scalar',
          periodDemands: [50, -20, 40, 30],
          holdingCost: 2,
          setupCost: 100,
          leadTime: 0,
        },
        errors: ['invalid_demand_schedule'],
      },
      refusal: {
        kind: 'invalid_input',
        reasons: ['invalid_demand_schedule'],
        message: 'Hay datos inconsistentes o imposibles en el planteo; corregilos antes de intentar resolverlo.',
      },
      algorithmSelection: {
        decision: 'refuse',
        silverMealIncluded: false,
        why: ['input_inconsistency_detected', 'invalid_demand_schedule'],
      },
      pedagogicalArtifacts: {
        interpretation: ['Hay una inconsistencia invalidante.'],
        model: ['No corresponde resolver.'],
        algorithm: ['El backend frenó antes del solver.'],
        result: ['No hay resultado numérico.'],
        procedure: ['Corregí el planteo y volvé a intentar.'],
        justification: ['La demanda no puede ser negativa.'],
      },
      internalTrace: {
        decision: 'refuse',
        silverMealIncluded: false,
        why: ['input_inconsistency_detected', 'invalid_demand_schedule'],
      },
    });

    expect(envelope.refusal?.kind).toBe('invalid_input');
    expect(envelope.clarificationRequest).toBeUndefined();
  });
});
