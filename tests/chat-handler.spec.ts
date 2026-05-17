import { describe, expect, it, vi } from 'vitest';

import { handleChatTurnRequest } from '../src/app/runtime/chat-handler';
import { FinalResponseEnvelopeSchema } from '../src/contracts/eoq';

const solvedResponse = FinalResponseEnvelopeSchema.parse({
  mode: 'solved',
  studentMessage: 'ok',
  interpretation: {
    normalizedText: 'Caso EOQ',
    branchCandidate: 'no_setup',
    extractedValues: { demandRate: 200, holdingCost: 3 },
    units: { timeBasis: 'year' },
    taxonomyTags: [
      { family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'no_setup', status: 'supported', notes: [] },
    ],
    confidence: 0.95,
    missingCriticalFields: [],
    issues: [],
  },
  normalization: {
    canonicalInput: {
      branch: 'no_setup',
      variant: 'scalar',
      demandRate: 200,
      holdingCost: 3,
    },
  },
  validation: {
    ok: true,
    disposition: 'valid',
    canonicalInput: {
      branch: 'no_setup',
      variant: 'scalar',
      demandRate: 200,
      holdingCost: 3,
    },
    normalizedInput: {
      branch: 'no_setup',
      variant: 'scalar',
      demandRate: 200,
      holdingCost: 3,
    },
    errors: [],
    unsupportedReasons: [],
    warnings: [],
    defaultsApplied: [],
  },
  solverInput: {
    branch: 'no_setup',
    variant: 'scalar',
    demandRate: 200,
    holdingCost: 3,
  },
  solverOutput: {
    branch: 'no_setup',
    solverFamily: 'exact_no_setup',
    policy: {
      orderQuantity: 200,
      cycleTime: 1,
      replenishmentPlan: [{ period: 1, quantity: 200, coversThroughPeriod: 1 }],
    },
    computed: { totalRelevantCost: 10 },
    equations: ['eq'],
    mathematicalArtifacts: {
      demandSchedule: [200],
      endingInventoryByPeriod: [0],
      orderPeriods: [1],
      costBreakdown: {
        setupOrOrderingCost: 0,
        holdingCost: 10,
        totalRelevantCost: 10,
      },
    },
  },
  algorithmSelection: {
    decision: 'solve',
    chosenBranch: 'no_setup',
    solverFamily: 'exact_no_setup',
    silverMealIncluded: false,
    why: ['validated_branch:no_setup'],
  },
  pedagogicalArtifacts: {
    interpretation: ['i'],
    model: ['m'],
    algorithm: ['a'],
    result: ['r'],
    procedure: ['p'],
    justification: ['j'],
  },
  internalTrace: {
    decision: 'solve',
    chosenBranch: 'no_setup',
    solverFamily: 'exact_no_setup',
    silverMealIncluded: false,
    why: ['validated_branch:no_setup'],
  },
});

describe('handleChatTurnRequest', () => {
  it('forwards resetProblem when the caller requests a fresh problem in the same session', async () => {
    const handleTurn = vi.fn().mockResolvedValue(solvedResponse);

    await handleChatTurnRequest(
      {
        sessionId: 'session-1',
        userText: 'Nuevo problema',
        resetProblem: true,
      },
      {
        controller: { handleTurn } as never,
      },
    );

    expect(handleTurn).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userText: 'Nuevo problema',
      resetProblem: true,
    });
  });

  it('creates a new session id when one is not provided and leaves resetProblem unset by default', async () => {
    const handleTurn = vi.fn().mockResolvedValue(solvedResponse);

    const payload = await handleChatTurnRequest(
      {
        userText: 'Caso inicial',
      },
      {
        controller: { handleTurn } as never,
        createSessionId: () => 'generated-session',
      },
    );

    expect(handleTurn).toHaveBeenCalledWith({
      sessionId: 'generated-session',
      userText: 'Caso inicial',
      resetProblem: undefined,
    });
    expect(payload.sessionId).toBe('generated-session');
  });
});
