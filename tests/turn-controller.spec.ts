import { describe, expect, it } from 'vitest';

import { TurnController } from '../src/application/turn-controller';
import { ProblemInterpretationSchema, toPublicResponseEnvelope } from '../src/contracts/eoq';
import { FakeEoqInterpreter } from '../src/interpreter/fake-eoq-interpreter';
import { GroqEoqInterpreter } from '../src/interpreter/groq-eoq-interpreter';
import { InterpreterFailure } from '../src/interpreter/eoq-interpreter';
import { InMemorySessionStore } from '../src/session/session-store';
import { eoqCaseFixtures } from './fixtures/eoq-cases';

const fixtureById = (id: string) => {
  const fixture = eoqCaseFixtures.find((candidate) => candidate.id === id);

  if (!fixture) {
    throw new Error(`Missing fixture ${id}`);
  }

  return fixture;
};

describe('TurnController', () => {
  it('solves an in-domain case end to end in one turn', async () => {
    const fixture = fixtureById('complete-with-setup');
    const sessionStore = new InMemorySessionStore();
    const controller = new TurnController({
      sessionStore,
      interpreter: new FakeEoqInterpreter({
        [fixture.userText]: ProblemInterpretationSchema.parse({
          normalizedText: fixture.userText,
          branchCandidate: 'with_setup',
          extractedValues: {
            periodDemands: [40, 20, 40],
            holdingCost: 1,
            setupCost: 50,
            leadTime: 0,
          },
          units: { timeBasis: 'period' },
          taxonomyTags: fixture.taxonomyTags,
          confidence: 0.95,
          missingCriticalFields: [],
          issues: [],
        }),
      }),
    });

    const response = await controller.handleTurn({
      sessionId: 'turn-controller-solvable',
      userText: fixture.userText,
    });
    const stored = await sessionStore.get('turn-controller-solvable');

    expect(response.mode).toBe('solved');
    expect(response.algorithmSelection.solverFamily).toBe('exact_with_setup');
    expect(response.solverOutput?.policy.replenishmentPlan).toEqual([
      { period: 1, quantity: 60, coversThroughPeriod: 2 },
      { period: 3, quantity: 40, coversThroughPeriod: 3 },
    ]);
    expect(stored?.activeProblem?.pendingClarification).toBeUndefined();
    expect(stored?.activeProblem?.lastSolverOutput?.solverFamily).toBe('exact_with_setup');
    expect(stored?.activeProblemId).toBe('problem-1');
    expect(stored?.problemCount).toBe(1);
    expect(stored?.turnCount).toBe(1);
  });

  it('persists pending clarification state and resumes to solve on the follow-up turn', async () => {
    const ambiguousFixture = fixtureById('ambiguous-branch');
    const sessionStore = new InMemorySessionStore();
    const controller = new TurnController({
      sessionStore,
      interpreter: new FakeEoqInterpreter({
        [ambiguousFixture.userText]: ProblemInterpretationSchema.parse({
          normalizedText: ambiguousFixture.userText,
          extractedValues: {
            periodDemands: [50, 50, 50],
            holdingCost: 3,
            setupCost: 40,
          },
          units: { timeBasis: 'period' },
          taxonomyTags: ambiguousFixture.taxonomyTags,
          confidence: 0.82,
          missingCriticalFields: ['branch'],
          issues: [],
        }),
        'Es preparación interna, o sea rama with setup.': ProblemInterpretationSchema.parse({
          normalizedText: 'Es preparación interna, o sea rama with setup.',
          branchCandidate: 'with_setup',
          extractedValues: {
            leadTime: 0,
          },
          units: { timeBasis: 'period' },
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
          confidence: 0.92,
          missingCriticalFields: [],
          issues: [],
        }),
      }),
    });

    const firstResponse = await controller.handleTurn({
      sessionId: 'turn-controller-clarify',
      userText: ambiguousFixture.userText,
    });
    const pausedState = await sessionStore.get('turn-controller-clarify');

    expect(firstResponse.mode).toBe('clarify');
    expect(firstResponse.clarificationRequest?.reason).toBe('material_ambiguity');
    expect(pausedState?.activeProblem?.pendingClarification?.reason).toBe('material_ambiguity');
    expect(pausedState?.activeProblem?.pendingCriticalFields).toEqual(['branch']);
    expect(pausedState?.activeProblem?.interpretation?.extractedValues.setupCost).toBe(40);

    const secondResponse = await controller.handleTurn({
      sessionId: 'turn-controller-clarify',
      userText: 'Es preparación interna, o sea rama with setup.',
    });
    const resumedState = await sessionStore.get('turn-controller-clarify');

    expect(secondResponse.mode).toBe('solved');
    expect(secondResponse.solverInput?.branch).toBe('with_setup');
    expect(secondResponse.solverOutput?.policy.replenishmentPlan).toEqual([
      { period: 1, quantity: 50, coversThroughPeriod: 1 },
      { period: 2, quantity: 50, coversThroughPeriod: 2 },
      { period: 3, quantity: 50, coversThroughPeriod: 3 },
    ]);
    expect(resumedState?.activeProblem?.pendingClarification).toBeUndefined();
    expect(resumedState?.activeProblem?.pendingCriticalFields).toEqual([]);
    expect(resumedState?.activeProblem?.interpretation?.branchCandidate).toBe('with_setup');
    expect(resumedState?.activeProblem?.interpretation?.extractedValues.setupCost).toBe(40);
    expect(resumedState?.activeProblem?.lastSolverOutput?.solverFamily).toBe('exact_with_setup');
    expect(resumedState?.turnCount).toBe(2);
  });

  it('solves the mandatory criollo no-setup case at runtime without inventing values', async () => {
    const fixture = fixtureById('criollo-no-setup');
    const sessionStore = new InMemorySessionStore();
    const controller = new TurnController({
      sessionStore,
      interpreter: new FakeEoqInterpreter({
        [fixture.userText]: ProblemInterpretationSchema.parse({
          normalizedText: fixture.userText,
          branchCandidate: 'no_setup',
          extractedValues: {
            demandRate: 900,
            holdingCost: 4,
          },
          units: { timeBasis: 'year', currency: 'ARS' },
          taxonomyTags: fixture.taxonomyTags,
          confidence: 0.93,
          missingCriticalFields: [],
          issues: [],
        }),
      }),
    });

    const response = await controller.handleTurn({
      sessionId: 'turn-controller-criollo',
      userText: fixture.userText,
    });
    const stored = await sessionStore.get('turn-controller-criollo');

    expect(response.mode).toBe('solved');
    expect(response.algorithmSelection.chosenBranch).toBe('no_setup');
    expect(response.algorithmSelection.solverFamily).toBe('exact_no_setup');
    expect(response.interpretation.extractedValues).toEqual({
      demandRate: 900,
      holdingCost: 4,
    });
    expect(response.solverInput).toMatchObject({
      branch: 'no_setup',
      demandRate: 900,
      holdingCost: 4,
    });
    expect(stored?.activeProblem?.lastSolverOutput?.solverFamily).toBe('exact_no_setup');
    expect(stored?.turnCount).toBe(1);
  });

  it('blocks on missing critical data and then resumes to solve after the user supplies it', async () => {
    const sessionStore = new InMemorySessionStore();
    const initialPrompt = 'Demanda anual de 1200 unidades; el proveedor repone al instante y no hay costo de preparación. ¿Qué lote económico conviene?';
    const followUpPrompt = 'El costo de mantener es 5 pesos por unidad por año.';
    const controller = new TurnController({
      sessionStore,
      interpreter: new FakeEoqInterpreter({
        [initialPrompt]: ProblemInterpretationSchema.parse({
          normalizedText: initialPrompt,
          branchCandidate: 'no_setup',
          extractedValues: {
            demandRate: 1200,
          },
          units: { timeBasis: 'year', currency: 'ARS' },
          taxonomyTags: [
            {
              family: 'inventory',
              topic: 'eoq',
              variant: 'standard',
              branch: 'no_setup',
              status: 'supported',
              notes: ['holding cost still missing'],
            },
          ],
          confidence: 0.94,
          missingCriticalFields: ['holdingCost'],
          issues: [],
        }),
        [followUpPrompt]: ProblemInterpretationSchema.parse({
          normalizedText: followUpPrompt,
          extractedValues: {
            holdingCost: 5,
          },
          units: { timeBasis: 'year', currency: 'ARS' },
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
          confidence: 0.96,
          missingCriticalFields: [],
          issues: [],
        }),
      }),
    });

    const firstResponse = await controller.handleTurn({
      sessionId: 'turn-controller-missing-critical',
      userText: initialPrompt,
    });
    const pausedState = await sessionStore.get('turn-controller-missing-critical');

    expect(firstResponse.mode).toBe('clarify');
    expect(firstResponse.clarificationRequest?.reason).toBe('missing_critical');
    expect(firstResponse.clarificationRequest?.requiredFields).toEqual(['holding_cost']);
    expect(pausedState?.activeProblem?.pendingCriticalFields).toEqual(['holdingCost']);
    expect(pausedState?.activeProblem?.interpretation?.extractedValues).toEqual({ demandRate: 1200 });

    const secondResponse = await controller.handleTurn({
      sessionId: 'turn-controller-missing-critical',
      userText: followUpPrompt,
    });
    const resumedState = await sessionStore.get('turn-controller-missing-critical');

    expect(secondResponse.mode).toBe('solved');
    expect(secondResponse.algorithmSelection.chosenBranch).toBe('no_setup');
    expect(secondResponse.solverInput).toMatchObject({
      branch: 'no_setup',
      demandRate: 1200,
      holdingCost: 5,
    });
    expect(resumedState?.activeProblem?.pendingClarification).toBeUndefined();
    expect(resumedState?.activeProblem?.pendingCriticalFields).toEqual([]);
    expect(resumedState?.activeProblem?.interpretation?.extractedValues).toEqual({
      demandRate: 1200,
      holdingCost: 5,
    });
    expect(resumedState?.activeProblem?.lastSolverOutput?.solverFamily).toBe('exact_no_setup');
    expect(resumedState?.turnCount).toBe(2);
  });

  it('keeps inconsistent cases blocked through orchestration', async () => {
    const fixture = fixtureById('inconsistent-data');
    const sessionStore = new InMemorySessionStore();
    const controller = new TurnController({
      sessionStore,
      interpreter: new FakeEoqInterpreter({
        [fixture.userText]: ProblemInterpretationSchema.parse({
          normalizedText: fixture.userText,
          branchCandidate: 'with_setup',
          extractedValues: {
            demandRate: 200,
            holdingCost: -3,
            setupCost: 90,
            leadTime: 0,
          },
          units: {},
          taxonomyTags: fixture.taxonomyTags,
          confidence: 0.88,
          missingCriticalFields: [],
          issues: ['negative holding cost', 'incompatible time basis'],
        }),
      }),
    });

    const response = await controller.handleTurn({
      sessionId: 'turn-controller-inconsistent',
      userText: fixture.userText,
    });
    const stored = await sessionStore.get('turn-controller-inconsistent');

    expect(response.mode).toBe('refuse');
    expect(response.refusal?.kind).toBe('invalid_input');
    expect(response.solverOutput).toBeUndefined();
    expect(stored?.activeProblem?.validation?.errors).toEqual(
      expect.arrayContaining(['invalid_holding_cost', 'incompatible_units_or_time_basis']),
    );
    expect(stored?.activeProblem?.latestSelectionTrace?.decision).toBe('refuse');
    expect(stored?.activeProblem?.latestRefusal?.kind).toBe('invalid_input');
  });

  it('refuses out-of-domain cases before any solve path runs', async () => {
    const fixture = fixtureById('out-of-domain-shortages');
    const sessionStore = new InMemorySessionStore();
    const controller = new TurnController({
      sessionStore,
      interpreter: new FakeEoqInterpreter({
        [fixture.userText]: ProblemInterpretationSchema.parse({
          normalizedText: fixture.userText,
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
          units: {},
          taxonomyTags: fixture.taxonomyTags,
          confidence: 0.93,
          missingCriticalFields: [],
          issues: [],
        }),
      }),
    });

    const response = await controller.handleTurn({
      sessionId: 'turn-controller-refuse',
      userText: fixture.userText,
    });
    const stored = await sessionStore.get('turn-controller-refuse');

    expect(response.mode).toBe('refuse');
    expect(response.refusal?.kind).toBe('out_of_domain');
    expect(response.solverOutput).toBeUndefined();
    expect(stored?.activeProblem?.latestSelectionTrace?.decision).toBe('refuse');
    expect(stored?.activeProblem?.latestRefusal?.kind).toBe('out_of_domain');
    expect(stored?.activeProblem?.lastSolverOutput).toBeUndefined();
  });

  it('works end to end with the real interpreter shape when the provider client is mocked', async () => {
    const sessionStore = new InMemorySessionStore();
    const controller = new TurnController({
      sessionStore,
      interpreter: new GroqEoqInterpreter({
        model: 'llama-3.3-70b-versatile',
        client: {
          async complete() {
            return {
              provider: 'groq',
              model: 'llama-3.3-70b-versatile',
              content: JSON.stringify({
                normalizedText: 'Demanda anual 1200, mantener 5, sin setup.',
                branchCandidate: 'no_setup',
                extractedValues: {
                  demandRate: 1200,
                  holdingCost: 5,
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
              }),
            };
          },
        },
      }),
    });

    const response = await controller.handleTurn({
      sessionId: 'turn-controller-real-interpreter-shape',
      userText: 'Demanda anual 1200, mantener 5, sin setup.',
    });

    expect(response.mode).toBe('solved');
    expect(response.algorithmSelection.solverFamily).toBe('exact_no_setup');
    expect(response.solverInput).toMatchObject({
      branch: 'no_setup',
      demandRate: 1200,
      holdingCost: 5,
      leadTime: 0,
    });
  });

  it('flows fresh-session colloquial demand schedules from the real interpreter shape into the existing pipeline', async () => {
    const fixture = fixtureById('criollo-fresh-session-series');
    const sessionStore = new InMemorySessionStore();
    const controller = new TurnController({
      sessionStore,
      interpreter: new GroqEoqInterpreter({
        model: 'llama-3.3-70b-versatile',
        client: {
          async complete() {
            return {
              provider: 'groq',
              model: 'llama-3.3-70b-versatile',
              content: JSON.stringify({
                normalizedText: fixture.userText,
                branchCandidate: 'with_setup',
                extractedValues: {
                  periodDemands: [80, 120, 60],
                  setupCost: 150,
                  holdingCost: 3,
                  leadTime: 0,
                  initialInventory: 15,
                },
                units: { timeBasis: 'month', currency: 'ARS' },
                taxonomyTags: fixture.taxonomyTags,
                confidence: 0.95,
                missingCriticalFields: [],
                issues: [],
              }),
            };
          },
        },
      }),
    });

    const response = await controller.handleTurn({
      sessionId: 'turn-controller-real-criollo-series',
      userText: fixture.userText,
    });
    const stored = await sessionStore.get('turn-controller-real-criollo-series');

    expect(response.mode).toBe('solved');
    expect(response.algorithmSelection.solverFamily).toBe('exact_with_setup');
    expect(response.interpretation.extractedValues).toMatchObject({
      periodDemands: [80, 120, 60],
      setupCost: 150,
      holdingCost: 3,
      leadTime: 0,
      initialInventory: 15,
    });
    expect(response.solverInput).toMatchObject({
      branch: 'with_setup',
      periodDemands: [80, 120, 60],
      setupCost: 150,
      holdingCost: 3,
      leadTime: 0,
    });
    expect(stored?.activeProblem?.lastSolverOutput?.solverFamily).toBe('exact_with_setup');
  });

  it('solves the exact colloquial Spanish recovery case instead of asking for clarification', async () => {
    const sessionStore = new InMemorySessionStore();
    const userText = 'tengo demanda de 10,20,30 y costo de almacenamiento de 40. el costo de pedido es 45';
    const controller = new TurnController({
      sessionStore,
      interpreter: new GroqEoqInterpreter({
        model: 'llama-3.3-70b-versatile',
        client: {
          async complete() {
            return {
              provider: 'groq',
              model: 'llama-3.3-70b-versatile',
              content: JSON.stringify({
                normalizedText: userText,
                extractedValues: {},
                units: {},
                taxonomyTags: [
                  {
                    family: 'inventory',
                    topic: 'eoq',
                    variant: 'standard',
                    status: 'supported',
                    notes: [],
                  },
                ],
                confidence: 0.25,
                missingCriticalFields: [],
                issues: [],
              }),
            };
          },
        },
      }),
    });

    const response = await controller.handleTurn({
      sessionId: 'turn-controller-colloquial-recovery',
      userText,
    });

    expect(response.mode).toBe('solved');
    expect(response.algorithmSelection.solverFamily).toBe('exact_with_setup');
    expect(response.interpretation.extractedValues).toMatchObject({
      periodDemands: [10, 20, 30],
      holdingCost: 40,
      setupCost: 45,
    });
    expect(response.clarificationRequest).toBeUndefined();
    expect(response.solverInput).toMatchObject({
      branch: 'with_setup',
      periodDemands: [10, 20, 30],
      holdingCost: 40,
      setupCost: 45,
    });
  });

  it('also solves the greeting-prefixed colloquial Spanish recovery case', async () => {
    const sessionStore = new InMemorySessionStore();
    const userText = 'hola tengo demanda de 10,20,30 y costo de almacenamiento de 40. el costo de pedido es 45';
    const controller = new TurnController({
      sessionStore,
      interpreter: new GroqEoqInterpreter({
        model: 'llama-3.3-70b-versatile',
        client: {
          async complete() {
            return {
              provider: 'groq',
              model: 'llama-3.3-70b-versatile',
              content: JSON.stringify({
                normalizedText: userText,
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
                confidence: 0.22,
                missingCriticalFields: [],
                issues: [],
              }),
            };
          },
        },
      }),
    });

    const response = await controller.handleTurn({
      sessionId: 'turn-controller-greeting-prefixed-recovery',
      userText,
    });

    expect(response.mode).toBe('solved');
    expect(response.algorithmSelection.solverFamily).toBe('exact_with_setup');
    expect(response.interpretation.extractedValues).toMatchObject({
      periodDemands: [10, 20, 30],
      holdingCost: 40,
      setupCost: 45,
    });
    expect(response.clarificationRequest).toBeUndefined();
  });

  it('fails closed when the real interpreter provider path errors', async () => {
    const sessionStore = new InMemorySessionStore();
    const controller = new TurnController({
      sessionStore,
      interpreter: new GroqEoqInterpreter({
        model: 'llama-3.3-70b-versatile',
        client: {
          async complete() {
            throw new InterpreterFailure('provider unavailable', 'provider_failure');
          },
        },
      }),
    });

    const response = await controller.handleTurn({
      sessionId: 'turn-controller-real-provider-failure',
      userText: 'Necesito resolver este EOQ.',
    });
    const stored = await sessionStore.get('turn-controller-real-provider-failure');

    expect(response.mode).toBe('clarify');
    expect(response.solverOutput).toBeUndefined();
    expect(response.algorithmSelection.decision).toBe('ask');
    expect(response.interpretation.issues).toContain('interpreter_provider_failure');
    expect(stored?.activeProblem?.lastSolverOutput).toBeUndefined();
  });

  it('starts a fresh thread on explicit reset and does not leak stale setup state into the new problem', async () => {
    const sessionStore = new InMemorySessionStore();
    const firstPrompt = 'Demanda anual 800, holding 4 y setup 30.';
    const secondPrompt = 'Nuevo problema: demanda anual 300, holding 2 y sin costo de preparación.';
    const controller = new TurnController({
      sessionStore,
      interpreter: new FakeEoqInterpreter({
        [firstPrompt]: ProblemInterpretationSchema.parse({
          normalizedText: firstPrompt,
          branchCandidate: 'with_setup',
          extractedValues: {
            demandRate: 800,
            holdingCost: 4,
            setupCost: 30,
            leadTime: 0,
          },
          units: { timeBasis: 'year' },
          taxonomyTags: [
            { family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'with_setup', status: 'supported', notes: [] },
          ],
          confidence: 0.95,
          missingCriticalFields: [],
          issues: [],
        }),
        [secondPrompt]: ProblemInterpretationSchema.parse({
          normalizedText: secondPrompt,
          branchCandidate: 'no_setup',
          extractedValues: {
            demandRate: 300,
            holdingCost: 2,
            leadTime: 0,
          },
          units: { timeBasis: 'year' },
          taxonomyTags: [
            { family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'no_setup', status: 'supported', notes: [] },
          ],
          confidence: 0.96,
          missingCriticalFields: [],
          issues: [],
        }),
      }),
    });

    await controller.handleTurn({ sessionId: 'turn-controller-reset', userText: firstPrompt });

    const response = await controller.handleTurn({
      sessionId: 'turn-controller-reset',
      userText: secondPrompt,
      resetProblem: true,
    });
    const stored = await sessionStore.get('turn-controller-reset');

    expect(response.mode).toBe('solved');
    expect(response.solverInput).toMatchObject({
      branch: 'no_setup',
      demandRate: 300,
      holdingCost: 2,
      leadTime: 0,
    });
    expect(response.solverInput).not.toHaveProperty('setupCost');
    expect(stored?.problemCount).toBe(2);
    expect(stored?.activeProblemId).toBe('problem-2');
    expect(stored?.activeProblem?.problemId).toBe('problem-2');
    expect(stored?.activeProblem?.interpretation?.extractedValues).toEqual({
      demandRate: 300,
      holdingCost: 2,
      leadTime: 0,
    });
  });

  it('auto-switches to a fresh thread for a conflicting complete EOQ prompt once the active thread is not waiting on clarification', async () => {
    const sessionStore = new InMemorySessionStore();
    const firstPrompt = 'Demanda anual 1200, holding 5 y no hay costo de preparación.';
    const secondPrompt = 'Otro problema: demanda anual 400, holding 3 y setup 20.';
    const controller = new TurnController({
      sessionStore,
      interpreter: new FakeEoqInterpreter({
        [firstPrompt]: ProblemInterpretationSchema.parse({
          normalizedText: firstPrompt,
          branchCandidate: 'no_setup',
          extractedValues: {
            demandRate: 1200,
            holdingCost: 5,
            leadTime: 0,
          },
          units: { timeBasis: 'year' },
          taxonomyTags: [
            { family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'no_setup', status: 'supported', notes: [] },
          ],
          confidence: 0.93,
          missingCriticalFields: [],
          issues: [],
        }),
        [secondPrompt]: ProblemInterpretationSchema.parse({
          normalizedText: secondPrompt,
          branchCandidate: 'with_setup',
          extractedValues: {
            demandRate: 400,
            holdingCost: 3,
            setupCost: 20,
            leadTime: 0,
          },
          units: { timeBasis: 'year' },
          taxonomyTags: [
            { family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'with_setup', status: 'supported', notes: [] },
          ],
          confidence: 0.97,
          missingCriticalFields: [],
          issues: [],
        }),
      }),
    });

    const firstResponse = await controller.handleTurn({ sessionId: 'turn-controller-auto-switch', userText: firstPrompt });
    expect(firstResponse.mode).toBe('solved');

    const response = await controller.handleTurn({ sessionId: 'turn-controller-auto-switch', userText: secondPrompt });
    const stored = await sessionStore.get('turn-controller-auto-switch');

    expect(response.mode).toBe('solved');
    expect(response.solverInput).toMatchObject({
      branch: 'with_setup',
      demandRate: 400,
      holdingCost: 3,
      setupCost: 20,
      leadTime: 0,
    });
    expect(response.clarificationRequest).toBeUndefined();
    expect(stored?.problemCount).toBe(2);
    expect(stored?.activeProblemId).toBe('problem-2');
    expect(stored?.activeProblem?.pendingCriticalFields).toEqual([]);
    expect(stored?.activeProblem?.interpretation?.missingCriticalFields).toEqual([]);
    expect(stored?.activeProblem?.interpretation?.extractedValues).toEqual({
      demandRate: 400,
      holdingCost: 3,
      setupCost: 20,
      leadTime: 0,
    });
  });

  it('keeps the same thread active when the user rewords the same problem after it was already solved', async () => {
    const sessionStore = new InMemorySessionStore();
    const firstPrompt = 'Demanda anual 1200, holding 5 y no hay costo de preparación.';
    const rewordedPrompt = 'En este mismo problema, con demanda anual 1200 y holding 5, explicame el siguiente paso.';
    const controller = new TurnController({
      sessionStore,
      interpreter: new FakeEoqInterpreter({
        [firstPrompt]: ProblemInterpretationSchema.parse({
          normalizedText: firstPrompt,
          branchCandidate: 'no_setup',
          extractedValues: {
            demandRate: 1200,
            holdingCost: 5,
            leadTime: 0,
          },
          units: { timeBasis: 'year' },
          taxonomyTags: [
            { family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'no_setup', status: 'supported', notes: [] },
          ],
          confidence: 0.93,
          missingCriticalFields: [],
          issues: [],
        }),
        [rewordedPrompt]: ProblemInterpretationSchema.parse({
          normalizedText: rewordedPrompt,
          branchCandidate: 'no_setup',
          extractedValues: {
            demandRate: 1200,
            holdingCost: 5,
            leadTime: 0,
          },
          units: { timeBasis: 'year' },
          taxonomyTags: [
            { family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'no_setup', status: 'supported', notes: [] },
          ],
          confidence: 0.95,
          missingCriticalFields: [],
          issues: [],
        }),
      }),
    });

    const firstResponse = await controller.handleTurn({ sessionId: 'turn-controller-reword', userText: firstPrompt });
    expect(firstResponse.mode).toBe('solved');

    const secondResponse = await controller.handleTurn({
      sessionId: 'turn-controller-reword',
      userText: rewordedPrompt,
    });
    const stored = await sessionStore.get('turn-controller-reword');

    expect(secondResponse.mode).toBe('solved');
    expect(secondResponse.solverInput).toMatchObject({
      branch: 'no_setup',
      demandRate: 1200,
      holdingCost: 5,
      leadTime: 0,
    });
    expect(stored?.problemCount).toBe(1);
    expect(stored?.activeProblemId).toBe('problem-1');
    expect(stored?.activeProblem?.problemId).toBe('problem-1');
    expect(stored?.activeProblem?.interpretation?.extractedValues).toEqual({
      demandRate: 1200,
      holdingCost: 5,
      leadTime: 0,
    });
    expect(stored?.activeProblem?.lastSolverOutput?.solverFamily).toBe('exact_no_setup');
    expect(stored?.turnCount).toBe(2);
  });

  it('reuses the solved thread artifacts for explanation follow-ups without calling the solver again', async () => {
    const sessionStore = new InMemorySessionStore();
    const firstPrompt = 'Demanda anual 1200, holding 5 y no hay costo de preparación.';
    const followUpPrompt = '¿Por qué en este problema usaste ese paso?';
    let solverCalls = 0;
    const controller = new TurnController({
      sessionStore,
      solverSelector: (routingResult) => {
        solverCalls += 1;
        return {
          algorithmSelection: routingResult.trace,
          solverInput: {
            branch: 'no_setup',
            variant: 'scalar',
            demandRate: 1200,
            holdingCost: 5,
            leadTime: 0,
          },
          solverOutput: {
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
        };
      },
      interpreter: new FakeEoqInterpreter({
        [firstPrompt]: ProblemInterpretationSchema.parse({
          normalizedText: firstPrompt,
          branchCandidate: 'no_setup',
          extractedValues: {
            demandRate: 1200,
            holdingCost: 5,
            leadTime: 0,
          },
          units: { timeBasis: 'year' },
          taxonomyTags: [
            { family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'no_setup', status: 'supported', notes: [] },
          ],
          confidence: 0.93,
          missingCriticalFields: [],
          issues: [],
        }),
        [followUpPrompt]: ProblemInterpretationSchema.parse({
          normalizedText: followUpPrompt,
          extractedValues: {},
          units: { timeBasis: 'year' },
          taxonomyTags: [
            { family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'no_setup', status: 'supported', notes: [] },
          ],
          confidence: 0.95,
          missingCriticalFields: [],
          issues: [],
        }),
      }),
    });

    const firstResponse = await controller.handleTurn({ sessionId: 'turn-controller-resolved-explain', userText: firstPrompt });
    expect(firstResponse.mode).toBe('solved');

    const secondResponse = await controller.handleTurn({
      sessionId: 'turn-controller-resolved-explain',
      userText: followUpPrompt,
    });
    const stored = await sessionStore.get('turn-controller-resolved-explain');

    expect(solverCalls).toBe(1);
    expect(secondResponse.mode).toBe('solved');
    expect(secondResponse.threadContext?.phase).toBe('resolved_follow_up');
    expect(secondResponse.studentMessage).toContain('seguimos sobre el mismo resultado');
    expect(secondResponse.pedagogicalArtifacts.result.join(' ')).not.toContain('Plan completo de reposición');
    expect(secondResponse.pedagogicalArtifacts.result[0]).toContain('demanda 1200');
    expect(secondResponse.solverOutput).toEqual(firstResponse.solverOutput);
    expect(stored?.problemCount).toBe(1);
    expect(stored?.activeProblemId).toBe('problem-1');
    expect(stored?.activeProblem?.problemId).toBe('problem-1');
    expect(stored?.activeProblem?.interpretation?.extractedValues).toEqual({
      demandRate: 1200,
      holdingCost: 5,
      leadTime: 0,
    });
  });

  it('does not reuse the solved response when a neutral greeting arrives after resolution', async () => {
    const sessionStore = new InMemorySessionStore();
    const firstPrompt = 'Demanda anual 1200, holding 5 y no hay costo de preparación.';
    const greetingPrompt = 'hola';
    let solverCalls = 0;
    const controller = new TurnController({
      sessionStore,
      solverSelector: (routingResult) => {
        solverCalls += 1;
        return {
          algorithmSelection: routingResult.trace,
          solverInput: {
            branch: 'no_setup',
            variant: 'scalar',
            demandRate: 1200,
            holdingCost: 5,
            leadTime: 0,
          },
          solverOutput: {
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
        };
      },
      interpreter: new FakeEoqInterpreter({
        [firstPrompt]: ProblemInterpretationSchema.parse({
          normalizedText: firstPrompt,
          branchCandidate: 'no_setup',
          extractedValues: {
            demandRate: 1200,
            holdingCost: 5,
            leadTime: 0,
          },
          units: { timeBasis: 'year' },
          taxonomyTags: [
            { family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'no_setup', status: 'supported', notes: [] },
          ],
          confidence: 0.93,
          missingCriticalFields: [],
          issues: [],
        }),
        [greetingPrompt]: ProblemInterpretationSchema.parse({
          normalizedText: greetingPrompt,
          extractedValues: {},
          units: {},
          taxonomyTags: [
            { family: 'inventory', topic: 'eoq', variant: 'standard', status: 'ambiguous', notes: [] },
          ],
          confidence: 0.4,
          missingCriticalFields: ['demandRate', 'holdingCost'],
          issues: [],
        }),
      }),
    });

    const firstResponse = await controller.handleTurn({ sessionId: 'turn-controller-neutral-after-solved', userText: firstPrompt });
    expect(firstResponse.mode).toBe('solved');

    const secondResponse = await controller.handleTurn({
      sessionId: 'turn-controller-neutral-after-solved',
      userText: greetingPrompt,
    });
    const stored = await sessionStore.get('turn-controller-neutral-after-solved');

    expect(solverCalls).toBe(1);
    expect(secondResponse.threadContext?.phase).toBe('active');
    expect(secondResponse.studentMessage).not.toContain('mismo resultado');
    expect(secondResponse.solverOutput).toBeUndefined();
    expect(stored?.problemCount).toBe(2);
    expect(stored?.activeProblemId).toBe('problem-2');
    expect(stored?.activeProblem?.lastSolverOutput).toBeUndefined();
    expect(stored?.activeProblem?.interpretation?.normalizedText).toBe('hola');
  });

  it('keeps solved what-if turns in the same thread without re-solving the modified scenario', async () => {
    const sessionStore = new InMemorySessionStore();
    const firstPrompt = 'Demanda anual 1200, holding 5 y no hay costo de preparación.';
    const whatIfPrompt = '¿Y si en este mismo problema la demanda sube a 1400?';
    let solverCalls = 0;
    const controller = new TurnController({
      sessionStore,
      solverSelector: (routingResult) => {
        solverCalls += 1;
        return {
          algorithmSelection: routingResult.trace,
          solverInput: {
            branch: 'no_setup',
            variant: 'scalar',
            demandRate: 1200,
            holdingCost: 5,
            leadTime: 0,
          },
          solverOutput: {
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
        };
      },
      interpreter: new FakeEoqInterpreter({
        [firstPrompt]: ProblemInterpretationSchema.parse({
          normalizedText: firstPrompt,
          branchCandidate: 'no_setup',
          extractedValues: {
            demandRate: 1200,
            holdingCost: 5,
            leadTime: 0,
          },
          units: { timeBasis: 'year' },
          taxonomyTags: [
            { family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'no_setup', status: 'supported', notes: [] },
          ],
          confidence: 0.93,
          missingCriticalFields: [],
          issues: [],
        }),
        [whatIfPrompt]: ProblemInterpretationSchema.parse({
          normalizedText: whatIfPrompt,
          extractedValues: {
            demandRate: 1400,
          },
          units: { timeBasis: 'year' },
          taxonomyTags: [
            { family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'no_setup', status: 'supported', notes: [] },
          ],
          confidence: 0.95,
          missingCriticalFields: [],
          issues: [],
        }),
      }),
    });

    const firstResponse = await controller.handleTurn({ sessionId: 'turn-controller-resolved-what-if', userText: firstPrompt });
    expect(firstResponse.mode).toBe('solved');

    const secondResponse = await controller.handleTurn({
      sessionId: 'turn-controller-resolved-what-if',
      userText: whatIfPrompt,
    });
    const stored = await sessionStore.get('turn-controller-resolved-what-if');

    expect(solverCalls).toBe(1);
    expect(secondResponse.mode).toBe('solved');
    expect(secondResponse.studentMessage).toContain('sin recalcular');
    expect(secondResponse.solverInput?.demandRate).toBe(1200);
    expect(secondResponse.solverOutput).toEqual(firstResponse.solverOutput);
    expect(stored?.problemCount).toBe(1);
    expect(stored?.activeProblemId).toBe('problem-1');
    expect(stored?.activeProblem?.interpretation?.extractedValues).toEqual({
      demandRate: 1200,
      holdingCost: 5,
      leadTime: 0,
    });
  });

  it('answers period-specific solved follow-ups with the stored replenishment evidence instead of generic demand text', async () => {
    const sessionStore = new InMemorySessionStore();
    const firstPrompt = 'Demandas por período 20, 10, 10, 20, 10, 30, 20, 10; holding 1 y setup 50.';
    const followUpPrompt = 'por que en el periodo 8 no se compra nada?';
    let solverCalls = 0;
    const controller = new TurnController({
      sessionStore,
      solverSelector: (routingResult) => {
        solverCalls += 1;
        return {
          algorithmSelection: routingResult.trace,
          solverInput: {
            branch: 'with_setup',
            variant: 'scalar',
            periodDemands: [20, 10, 10, 20, 10, 30, 20, 10],
            holdingCost: 1,
            setupCost: 50,
            leadTime: 0,
          },
          solverOutput: {
            branch: 'with_setup',
            solverFamily: 'exact_with_setup',
            policy: {
              orderQuantity: 30,
              replenishmentPlan: [
                { period: 1, quantity: 30, coversThroughPeriod: 2 },
                { period: 3, quantity: 40, coversThroughPeriod: 5 },
                { period: 6, quantity: 60, coversThroughPeriod: 8 },
              ],
            },
            computed: { totalRelevantCost: 170 },
            equations: ['F(t) = min_j {...}'],
            mathematicalArtifacts: {
              demandSchedule: [20, 10, 10, 20, 10, 30, 20, 10],
              endingInventoryByPeriod: [10, 0, 30, 10, 0, 30, 10, 0],
              orderPeriods: [1, 3, 6],
              costBreakdown: {
                setupOrOrderingCost: 150,
                holdingCost: 20,
                totalRelevantCost: 170,
              },
            },
          },
        };
      },
      interpreter: new FakeEoqInterpreter({
        [firstPrompt]: ProblemInterpretationSchema.parse({
          normalizedText: firstPrompt,
          branchCandidate: 'with_setup',
          extractedValues: {
            periodDemands: [20, 10, 10, 20, 10, 30, 20, 10],
            holdingCost: 1,
            setupCost: 50,
            leadTime: 0,
          },
          units: { timeBasis: 'period' },
          taxonomyTags: [
            { family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'with_setup', status: 'supported', notes: [] },
          ],
          confidence: 0.94,
          missingCriticalFields: [],
          issues: [],
        }),
        [followUpPrompt]: ProblemInterpretationSchema.parse({
          normalizedText: followUpPrompt,
          extractedValues: {},
          units: { timeBasis: 'period' },
          taxonomyTags: [
            { family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'with_setup', status: 'supported', notes: [] },
          ],
          confidence: 0.88,
          missingCriticalFields: [],
          issues: [],
        }),
      }),
    });

    const firstResponse = await controller.handleTurn({ sessionId: 'turn-controller-period-follow-up', userText: firstPrompt });
    expect(firstResponse.mode).toBe('solved');

    const secondResponse = await controller.handleTurn({
      sessionId: 'turn-controller-period-follow-up',
      userText: followUpPrompt,
    });
    const compactExplanation = [secondResponse.pedagogicalArtifacts.result[0], ...secondResponse.pedagogicalArtifacts.justification].join(' ');

    expect(solverCalls).toBe(1);
    expect(secondResponse.threadContext?.phase).toBe('resolved_follow_up');
    expect(compactExplanation).toContain('período 8');
    expect(compactExplanation).toContain('período 6');
    expect(compactExplanation).toContain('cubre hasta el 8');
    expect(compactExplanation).not.toContain('horizonte determinístico');
  });

  it.each([
    {
      followUpPrompt: 'cuanto repone el periodo 3?',
      expectedSnippets: ['período 3', 'repone 40 unidades', 'cubre hasta el 5'],
    },
    {
      followUpPrompt: 'qué compra en el período 3?',
      expectedSnippets: ['período 3', 'repone 40 unidades', 'cubre hasta el 5'],
    },
    {
      followUpPrompt: 'qué cubre el pedido del período 3?',
      expectedSnippets: ['período 3', 'repone 40 unidades', 'cubre hasta el 5'],
    },
  ])('answers solved plan follow-ups for $followUpPrompt using the stored replenishment plan', async ({ followUpPrompt, expectedSnippets }) => {
    const sessionStore = new InMemorySessionStore();
    const firstPrompt = 'Demandas por período 20, 10, 10, 20, 10, 30, 20, 10; holding 1 y setup 50.';
    let solverCalls = 0;
    const controller = new TurnController({
      sessionStore,
      solverSelector: (routingResult) => {
        solverCalls += 1;
        return {
          algorithmSelection: routingResult.trace,
          solverInput: {
            branch: 'with_setup',
            variant: 'scalar',
            periodDemands: [20, 10, 10, 20, 10, 30, 20, 10],
            holdingCost: 1,
            setupCost: 50,
            leadTime: 0,
          },
          solverOutput: {
            branch: 'with_setup',
            solverFamily: 'exact_with_setup',
            policy: {
              orderQuantity: 30,
              replenishmentPlan: [
                { period: 1, quantity: 30, coversThroughPeriod: 2 },
                { period: 3, quantity: 40, coversThroughPeriod: 5 },
                { period: 6, quantity: 60, coversThroughPeriod: 8 },
              ],
            },
            computed: { totalRelevantCost: 170 },
            equations: ['F(t) = min_j {...}'],
            mathematicalArtifacts: {
              demandSchedule: [20, 10, 10, 20, 10, 30, 20, 10],
              endingInventoryByPeriod: [10, 0, 30, 10, 0, 30, 10, 0],
              orderPeriods: [1, 3, 6],
              costBreakdown: {
                setupOrOrderingCost: 150,
                holdingCost: 20,
                totalRelevantCost: 170,
              },
            },
          },
        };
      },
      interpreter: new FakeEoqInterpreter({
        [firstPrompt]: ProblemInterpretationSchema.parse({
          normalizedText: firstPrompt,
          branchCandidate: 'with_setup',
          extractedValues: {
            periodDemands: [20, 10, 10, 20, 10, 30, 20, 10],
            holdingCost: 1,
            setupCost: 50,
            leadTime: 0,
          },
          units: { timeBasis: 'period' },
          taxonomyTags: [
            { family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'with_setup', status: 'supported', notes: [] },
          ],
          confidence: 0.94,
          missingCriticalFields: [],
          issues: [],
        }),
        [followUpPrompt]: ProblemInterpretationSchema.parse({
          normalizedText: followUpPrompt,
          extractedValues: {},
          units: { timeBasis: 'period' },
          taxonomyTags: [
            { family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'with_setup', status: 'supported', notes: [] },
          ],
          confidence: 0.88,
          missingCriticalFields: [],
          issues: [],
        }),
      }),
    });

    const firstResponse = await controller.handleTurn({ sessionId: `turn-controller-plan-follow-up-${followUpPrompt}`, userText: firstPrompt });
    expect(firstResponse.mode).toBe('solved');

    const secondResponse = await controller.handleTurn({
      sessionId: `turn-controller-plan-follow-up-${followUpPrompt}`,
      userText: followUpPrompt,
    });
    const compactExplanation = [secondResponse.pedagogicalArtifacts.result[0], ...secondResponse.pedagogicalArtifacts.justification].join(' ');

    expect(solverCalls).toBe(1);
    expect(secondResponse.threadContext?.phase).toBe('resolved_follow_up');
    for (const snippet of expectedSnippets) {
      expect(compactExplanation).toContain(snippet);
    }
    expect(compactExplanation).not.toContain('horizonte determinístico');
  });

  it('renders only current-thread facts after switching to a new problem in the same chat', async () => {
    const sessionStore = new InMemorySessionStore();
    const firstPrompt = 'Demanda anual 800, holding 4 y setup 30.';
    const secondPrompt = 'Otro problema: demandas 50, 50 y 50, holding 3 y costo fijo 40, pero no sé si es preparación o pedido.';
    const controller = new TurnController({
      sessionStore,
      interpreter: new FakeEoqInterpreter({
        [firstPrompt]: ProblemInterpretationSchema.parse({
          normalizedText: firstPrompt,
          branchCandidate: 'with_setup',
          extractedValues: {
            demandRate: 800,
            holdingCost: 4,
            setupCost: 30,
            leadTime: 0,
          },
          units: { timeBasis: 'year' },
          taxonomyTags: [
            { family: 'inventory', topic: 'eoq', variant: 'standard', branch: 'with_setup', status: 'supported', notes: [] },
          ],
          confidence: 0.95,
          missingCriticalFields: [],
          issues: [],
        }),
        [secondPrompt]: ProblemInterpretationSchema.parse({
          normalizedText: secondPrompt,
          extractedValues: {
            periodDemands: [50, 50, 50],
            holdingCost: 3,
            setupCost: 40,
          },
          units: { timeBasis: 'period' },
          taxonomyTags: [
            { family: 'inventory', topic: 'eoq', variant: 'standard', status: 'ambiguous', notes: [] },
          ],
          confidence: 0.84,
          missingCriticalFields: ['branch'],
          issues: [],
        }),
      }),
    });

    const firstResponse = await controller.handleTurn({ sessionId: 'turn-controller-public-isolation', userText: firstPrompt });
    expect(firstResponse.mode).toBe('solved');

    const secondResponse = await controller.handleTurn({
      sessionId: 'turn-controller-public-isolation',
      userText: secondPrompt,
    });
    const publicResponse = toPublicResponseEnvelope(secondResponse);
    const stored = await sessionStore.get('turn-controller-public-isolation');
    const renderedSummary = JSON.stringify({
      studentMessage: publicResponse.studentMessage,
      pedagogicalArtifacts: publicResponse.pedagogicalArtifacts,
      interpretation: publicResponse.interpretation,
    });

    expect(publicResponse.mode).toBe('clarify');
    expect(publicResponse.studentMessage).toContain('costo fijo');
    expect(publicResponse.studentMessage).toContain('preparación interna');
    expect(publicResponse.solverOutput).toBeUndefined();
    expect(publicResponse.interpretation.extractedValues).toEqual({
      periodDemands: [50, 50, 50],
      holdingCost: 3,
      setupCost: 40,
    });
    expect(publicResponse.pedagogicalArtifacts.result).toContain(
      'Resultado: el caso queda pausado hasta aclarar/corregir los datos críticos.',
    );
    expect(renderedSummary).not.toContain('800');
    expect(renderedSummary).not.toContain('30');
    expect(stored?.problemCount).toBe(2);
    expect(stored?.activeProblemId).toBe('problem-2');
    expect(stored?.activeProblem?.pendingClarification?.reason).toBe('material_ambiguity');
  });
});
