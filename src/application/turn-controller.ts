import {
  FinalResponseEnvelope,
  InterpretationRequest,
  ProblemInterpretation,
  ProblemInterpretationSchema,
  SessionState,
  SessionStateSchema,
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

export type TurnControllerRequest = InterpretationRequest;

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
  leadTime: 'leadTime',
  lead_time: 'leadTime',
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
  state: SessionState,
): string[] => {
  const pendingFields = state.pendingClarification?.requiredFields ?? [];
  const merged = new Set<string>([
    ...(previous?.missingCriticalFields ?? []),
    ...state.pendingCriticalFields,
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
  state: SessionState,
): ProblemInterpretation => {
  if (!previous) {
    return ProblemInterpretationSchema.parse({
      ...current,
      missingCriticalFields: mergeRequiredFields(undefined, current, state),
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
    missingCriticalFields: mergeRequiredFields(previous, merged, state),
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
    const interpretation = mergeInterpretationWithSession(
      session.latestInterpretation,
      currentInterpretation,
      session,
    );
    const validation = this.validator(interpretation);
    const routingResult = this.router(interpretation, validation);

    const response = routingResult.decision === 'solve'
      ? (() => {
          const selection = this.solverSelector(routingResult);
          return this.renderer({
            interpretation,
            routingResult,
            algorithmSelection: selection.algorithmSelection,
            solverInput: selection.solverInput,
            solverOutput: selection.solverOutput,
          });
        })()
      : this.renderer({ interpretation, routingResult });

    await this.dependencies.sessionStore.set(
      this.buildNextSessionState(session, interpretation, response),
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
    interpretation: ProblemInterpretation,
    response: FinalResponseEnvelope,
  ): SessionState {
    return SessionStateSchema.parse({
      sessionId: previous.sessionId,
      latestInterpretation: interpretation,
      latestNormalization: response.normalization,
      latestValidation: response.validation,
      pendingClarification: response.mode === 'clarify' ? response.clarificationRequest : undefined,
      latestRefusal: response.refusal,
      latestSelectionTrace: response.internalTrace,
      lastSolverInput: response.solverInput ?? previous.lastSolverInput,
      lastSolverOutput: response.solverOutput ?? previous.lastSolverOutput,
      visibleDefaults: response.validation?.defaultsApplied ?? [],
      pendingCriticalFields:
        response.mode === 'clarify'
          ? (response.clarificationRequest?.requiredFields ?? []).map((field) => normalizeFieldName(field))
          : [],
      turnCount: previous.turnCount + 1,
    });
  }
}
