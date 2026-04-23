import { describe, expect, it } from 'vitest';

import { TurnController } from '../src/application/turn-controller';
import { ProblemInterpretationSchema } from '../src/contracts/eoq';
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
    expect(stored?.pendingClarification).toBeUndefined();
    expect(stored?.lastSolverOutput?.solverFamily).toBe('exact_with_setup');
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
    expect(pausedState?.pendingClarification?.reason).toBe('material_ambiguity');
    expect(pausedState?.pendingCriticalFields).toEqual(['branch']);
    expect(pausedState?.latestInterpretation?.extractedValues.setupCost).toBe(40);

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
    expect(resumedState?.pendingClarification).toBeUndefined();
    expect(resumedState?.pendingCriticalFields).toEqual([]);
    expect(resumedState?.latestInterpretation?.branchCandidate).toBe('with_setup');
    expect(resumedState?.latestInterpretation?.extractedValues.setupCost).toBe(40);
    expect(resumedState?.lastSolverOutput?.solverFamily).toBe('exact_with_setup');
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
    expect(response.validation?.defaultsApplied).toContain('lead_time=0');
    expect(response.interpretation.extractedValues).toEqual({
      demandRate: 900,
      holdingCost: 4,
    });
    expect(response.solverInput).toMatchObject({
      branch: 'no_setup',
      demandRate: 900,
      holdingCost: 4,
      leadTime: 0,
    });
    expect(stored?.lastSolverOutput?.solverFamily).toBe('exact_no_setup');
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
    expect(pausedState?.pendingCriticalFields).toEqual(['holdingCost']);
    expect(pausedState?.latestInterpretation?.extractedValues).toEqual({ demandRate: 1200 });

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
      leadTime: 0,
    });
    expect(secondResponse.validation?.defaultsApplied).toContain('lead_time=0');
    expect(resumedState?.pendingClarification).toBeUndefined();
    expect(resumedState?.pendingCriticalFields).toEqual([]);
    expect(resumedState?.latestInterpretation?.extractedValues).toEqual({
      demandRate: 1200,
      holdingCost: 5,
    });
    expect(resumedState?.lastSolverOutput?.solverFamily).toBe('exact_no_setup');
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
    expect(stored?.latestValidation?.errors).toEqual(
      expect.arrayContaining(['invalid_holding_cost', 'incompatible_units_or_time_basis']),
    );
    expect(stored?.latestSelectionTrace?.decision).toBe('refuse');
    expect(stored?.latestRefusal?.kind).toBe('invalid_input');
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
    expect(stored?.latestSelectionTrace?.decision).toBe('refuse');
    expect(stored?.latestRefusal?.kind).toBe('out_of_domain');
    expect(stored?.lastSolverOutput).toBeUndefined();
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
    expect(stored?.lastSolverOutput?.solverFamily).toBe('exact_with_setup');
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
    expect(stored?.lastSolverOutput).toBeUndefined();
  });
});
