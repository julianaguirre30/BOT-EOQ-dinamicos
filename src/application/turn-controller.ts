import {
  FinalResponseEnvelope,
  InterpretationRequest,
  ProblemInterpretation,
  ProblemInterpretationSchema,
  ProblemThreadState,
  RoutingResult,
  RoutingResultSchema,
  SessionState,
  SessionStateSchema,
  ThreadContext,
  createEmptySessionState,
} from '../contracts/eoq';
import {
  buildFailedInterpretation,
  EoqInterpreter,
  InterpreterFailure,
  parseInterpretationRequest,
} from '../interpreter/eoq-interpreter';
import { assembleStudyResponse } from '../pedagogy/render-response';
import { SessionStore } from '../session/session-store';
import { routeProblemInterpretationWithValidation } from '../domain/routing/eoq-router';
import { selectAndRunDeterministicSolver } from '../domain/solver/algorithm-selector';
import { validateProblemInterpretation } from '../domain/validation/eoq-validator';
import { createFreshProblemThread, decideProblemThreadTransition } from './problem-thread-policy';

export type TurnControllerRequest = InterpretationRequest & {
  resetProblem?: boolean;
};

type TurnControllerDependencies = {
  sessionStore: SessionStore;
  interpreter: EoqInterpreter;
  validator?: typeof validateProblemInterpretation;
  router?: typeof routeProblemInterpretationWithValidation;
  solverSelector?: typeof selectAndRunDeterministicSolver;
  renderer?: typeof assembleStudyResponse;
};

const FIELD_ALIASES: Record<string, string> = {
  branch: 'branch',
  demandRate: 'demandRate',
  demand_rate: 'demandRate',
  periodDemands: 'periodDemands',
  period_demands: 'periodDemands',
  holdingCost: 'holdingCost',
  holding_cost: 'holdingCost',
  setupCost: 'setupCost',
  setup_cost: 'setupCost',
};

const normalizeFieldName = (field: string): string => FIELD_ALIASES[field] ?? field;

const hasResolvedField = (interpretation: ProblemInterpretation, field: string): boolean => {
  const normalizedField = normalizeFieldName(field);

  if (normalizedField === 'branch') {
    return interpretation.branchCandidate !== undefined;
  }

  return interpretation.extractedValues[normalizedField] !== undefined;
};

const mergeRequiredFields = (
  previous: ProblemInterpretation | undefined,
  current: ProblemInterpretation,
  activeProblem: ProblemThreadState,
): string[] => {
  const pendingFields = activeProblem.pendingClarification?.requiredFields ?? [];
  const merged = new Set<string>([
    ...(previous?.missingCriticalFields ?? []),
    ...activeProblem.pendingCriticalFields,
    ...pendingFields,
    ...current.missingCriticalFields,
  ]);

  return Array.from(merged)
    .map((field) => normalizeFieldName(field))
    .filter((field, index, collection) => collection.indexOf(field) === index)
    .filter((field) => !hasResolvedField(current, field));
};

export const mergeInterpretationWithSession = (
  previous: ProblemInterpretation | undefined,
  current: ProblemInterpretation,
  activeProblem: ProblemThreadState,
): ProblemInterpretation => {
  if (!previous) {
    return ProblemInterpretationSchema.parse({
      ...current,
      missingCriticalFields: mergeRequiredFields(undefined, current, activeProblem),
    });
  }

  const merged: ProblemInterpretation = {
    normalizedText: `${previous.normalizedText}\n${current.normalizedText}`.trim(),
    branchCandidate: current.branchCandidate ?? previous.branchCandidate,
    extractedValues: {
      ...previous.extractedValues,
      ...current.extractedValues,
    },
    units: {
      ...previous.units,
      ...current.units,
    },
    taxonomyTags: current.taxonomyTags.length > 0 ? current.taxonomyTags : previous.taxonomyTags,
    confidence: Math.max(previous.confidence, current.confidence),
    missingCriticalFields: [],
    issues: [...new Set([...previous.issues, ...current.issues])],
  };

  return ProblemInterpretationSchema.parse({
    ...merged,
    missingCriticalFields: mergeRequiredFields(previous, merged, activeProblem),
  });
};

const buildThreadContext = (
  activeProblem: ProblemThreadState | undefined,
  transition: ReturnType<typeof decideProblemThreadTransition>,
): ThreadContext => ({
  phase: transition.reason === 'resolved_follow_up' ? 'resolved_follow_up' : 'active',
  hasPriorSolution: activeProblem?.lastSolverOutput !== undefined,
});

const buildResolvedFollowUpRoutingResult = (activeProblem: ProblemThreadState | undefined): RoutingResult | undefined => {
  if (
    !activeProblem?.normalization ||
    !activeProblem.validation ||
    !activeProblem.latestSelectionTrace ||
    !activeProblem.lastSolverInput ||
    !activeProblem.lastSolverOutput
  ) {
    return undefined;
  }

  return RoutingResultSchema.parse({
    decision: 'solve',
    solvable: true,
    domainStatus: 'in_domain',
    normalization: activeProblem.normalization,
    validation: activeProblem.validation,
    trace: activeProblem.latestSelectionTrace,
  });
};

export class TurnController {
  private readonly validator: typeof validateProblemInterpretation;
  private readonly router: typeof routeProblemInterpretationWithValidation;
  private readonly solverSelector: typeof selectAndRunDeterministicSolver;
  private readonly renderer: typeof assembleStudyResponse;

  constructor(private readonly dependencies: TurnControllerDependencies) {
    this.validator = dependencies.validator ?? validateProblemInterpretation;
    this.router = dependencies.router ?? routeProblemInterpretationWithValidation;
    this.solverSelector = dependencies.solverSelector ?? selectAndRunDeterministicSolver;
    this.renderer = dependencies.renderer ?? assembleStudyResponse;
  }

  async handleTurn(request: TurnControllerRequest): Promise<FinalResponseEnvelope> {
    const parsedRequest = parseInterpretationRequest(request);
    const session = (await this.dependencies.sessionStore.get(parsedRequest.sessionId)) ??
      createEmptySessionState(parsedRequest.sessionId);
    const currentInterpretation = await this.interpretSafely(parsedRequest);
    const transition = decideProblemThreadTransition({
      activeProblem: session.activeProblem,
      currentInterpretation,
      resetProblem: request.resetProblem ?? false,
    });
    const activeProblem = transition.kind === 'fresh'
      ? createFreshProblemThread({ nextProblemNumber: session.problemCount + 1 })
      : session.activeProblem ?? createFreshProblemThread({ nextProblemNumber: 1 });
    const threadContext = buildThreadContext(session.activeProblem, transition);
    const interpretation = threadContext.phase === 'resolved_follow_up'
      ? activeProblem.interpretation ?? currentInterpretation
      : mergeInterpretationWithSession(
          transition.kind === 'continue' ? activeProblem.interpretation : undefined,
          currentInterpretation,
          activeProblem,
        );
    const validation = threadContext.phase === 'resolved_follow_up'
      ? activeProblem.validation ?? this.validator(interpretation, threadContext)
      : this.validator(interpretation, threadContext);
    const routingResult = threadContext.phase === 'resolved_follow_up'
      ? buildResolvedFollowUpRoutingResult(activeProblem) ?? this.router(interpretation, validation, undefined, undefined, threadContext)
      : this.router(interpretation, validation, undefined, undefined, threadContext);

    const response = threadContext.phase === 'resolved_follow_up' && activeProblem.lastSolverInput && activeProblem.lastSolverOutput
        ? this.renderer({
            interpretation,
            routingResult,
            algorithmSelection: activeProblem.latestSelectionTrace ?? routingResult.trace,
            solverInput: activeProblem.lastSolverInput,
            solverOutput: activeProblem.lastSolverOutput,
            threadContext,
            followUpQuestion: currentInterpretation.normalizedText,
          })
      : routingResult.decision === 'solve'
      ? (() => {
          const selection = this.solverSelector(routingResult);
          return this.renderer({
            interpretation,
            routingResult,
            algorithmSelection: selection.algorithmSelection,
            solverInput: selection.solverInput,
            solverOutput: selection.solverOutput,
            threadContext,
          });
        })()
      : this.renderer({ interpretation, routingResult, threadContext });

    await this.dependencies.sessionStore.set(
      this.buildNextSessionState(session, activeProblem, interpretation, response, transition.kind === 'fresh'),
    );

    return response;
  }

  private async interpretSafely(request: InterpretationRequest): Promise<ProblemInterpretation> {
    try {
      return await this.dependencies.interpreter.interpret(request);
    } catch (error) {
      if (error instanceof InterpreterFailure) {
        return buildFailedInterpretation(request, error);
      }

      throw error;
    }
  }

  private buildNextSessionState(
    previous: SessionState,
    activeProblem: ProblemThreadState,
    interpretation: ProblemInterpretation,
    response: FinalResponseEnvelope,
    isFreshThread: boolean,
  ): SessionState {
    const nextActiveProblem: ProblemThreadState = {
      problemId: activeProblem.problemId,
      interpretation,
      normalization: response.normalization,
      validation: response.validation,
      pendingClarification: response.mode === 'clarify' ? response.clarificationRequest : undefined,
      latestRefusal: response.refusal,
      latestSelectionTrace: response.internalTrace,
      lastSolverInput: response.solverInput ?? (isFreshThread ? undefined : activeProblem.lastSolverInput),
      lastSolverOutput: response.solverOutput ?? (isFreshThread ? undefined : activeProblem.lastSolverOutput),
      visibleDefaults: response.validation?.defaultsApplied ?? [],
      pendingCriticalFields:
        response.mode === 'clarify'
          ? (response.clarificationRequest?.requiredFields ?? []).map((field) => normalizeFieldName(field))
          : [],
    };

    return SessionStateSchema.parse({
      sessionId: previous.sessionId,
      activeProblemId: nextActiveProblem.problemId,
      problemCount: isFreshThread ? previous.problemCount + 1 : Math.max(previous.problemCount, 1),
      activeProblem: nextActiveProblem,
      turnCount: previous.turnCount + 1,
    });
  }
}
