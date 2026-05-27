import { z } from 'zod';
import { SolverInput, SolverOutput } from '../../contracts/eoq';
import { solveExactWithSetup, solveExactNoSetup } from '../../domain/solver/exact-solvers';
import { evaluateCustomPlan, formatPlanEvaluation } from '../../domain/solver/plan-evaluator';
import { getSession, saveSession, ConversationMessage } from '../../session/simple-session';
import { callGroqFollowUp, callGroqGeneric, RateLimitedError } from '../../infrastructure/llm/groq-followup';

// ─── "What-if" marker handling ────────────────────────────────────────────────
// El LLM emite [WHATIF: q1, q2, q3, ...] al final del mensaje cuando el
// estudiante propone un plan alternativo. El backend lo evalúa
// determinísticamente y appendea la comparación real.
// Tolera variantes: WHAT_IF, WHAT-IF, asteriscos, espacios, etc.
const WHATIF_MARKER_REGEX = /\**\[\s*WHAT[_\- ]?IF\s*:\s*([0-9.,\s-]+?)\s*\]\**/i;

const processWhatIfMarker = (
  rawMessage: string,
  solverInput: SolverInput,
  solverOutput: SolverOutput,
): string => {
  const match = rawMessage.match(WHATIF_MARKER_REGEX);
  if (!match) return rawMessage;

  const orders = match[1]
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));

  const cleaned = rawMessage.replace(WHATIF_MARKER_REGEX, '').trimEnd();
  const evaluation = evaluateCustomPlan(solverInput, solverOutput, orders);
  return cleaned + formatPlanEvaluation(evaluation);
};

const RATE_LIMIT_FRIENDLY_MESSAGE =
  'Estoy un poco saturado por el límite de la API gratuita de Groq. Esperá unos segundos y volvé a preguntar.';

// ─── Request schemas ──────────────────────────────────────────────────────────

export const GenericRequestSchema = z.object({
  type: z.literal('generic'),
  userText: z.string().min(1),
});

export const SolveRequestSchema = z.object({
  type: z.literal('solve'),
  sessionId: z.string().optional(),
  periodDemands: z.array(z.number().finite().nonnegative()).min(1),
  hasSetupCost: z.boolean(),
  setupCost: z.number().positive().optional(),
  holdingCost: z.number().positive(),
});

export const FollowUpRequestSchema = z.object({
  type: z.literal('followup'),
  sessionId: z.string().min(1),
  userText: z.string().min(1),
});

export const SimpleChatRequestSchema = z.discriminatedUnion('type', [
  GenericRequestSchema,
  SolveRequestSchema,
  FollowUpRequestSchema,
]);

export type GenericRequest    = z.infer<typeof GenericRequestSchema>;
export type SolveRequest      = z.infer<typeof SolveRequestSchema>;
export type FollowUpRequest   = z.infer<typeof FollowUpRequestSchema>;
export type SimpleChatRequest = z.infer<typeof SimpleChatRequestSchema>;

// ─── Response types ───────────────────────────────────────────────────────────

export type GenericResponse = {
  type: 'generic';
  message: string;
};

export type SolveResponse = {
  type: 'solve';
  sessionId: string;
  message: string;
  solverInput: SolverInput;
  solverOutput: SolverOutput;
};

export type FollowUpResponse = {
  type: 'followup';
  sessionId: string;
  message: string;
  suggestsNewProblem: boolean;
};

export type SimpleChatResponse = GenericResponse | SolveResponse | FollowUpResponse;

// ─── Solver builder ───────────────────────────────────────────────────────────

const buildSolverInput = (req: SolveRequest): SolverInput => {
  if (req.hasSetupCost && req.setupCost !== undefined) {
    return {
      branch: 'with_setup',
      variant: 'scalar',
      periodDemands: req.periodDemands,
      setupCost: req.setupCost,
      holdingCost: req.holdingCost,
    };
  }
  return {
    branch: 'no_setup',
    variant: 'scalar',
    periodDemands: req.periodDemands,
    holdingCost: req.holdingCost,
  };
};

const runSolver = (input: SolverInput): SolverOutput =>
  input.branch === 'with_setup'
    ? solveExactWithSetup(input as Extract<SolverInput, { branch: 'with_setup'; variant: 'scalar' }>)
    : solveExactNoSetup(input as Extract<SolverInput, { branch: 'no_setup'; variant: 'scalar' }>);

const buildSolverSummary = (input: SolverInput, output: SolverOutput): string => {
  const plan = output.policy.replenishmentPlan
    .map((p) =>
      p.period === p.coversThroughPeriod
        ? `período ${p.period}: ${p.quantity} unidades`
        : `período ${p.period}: ${p.quantity} unidades (cubre hasta período ${p.coversThroughPeriod})`,
    )
    .join(', ');
  const { totalRelevantCost } = output.mathematicalArtifacts.costBreakdown;
  const model = input.branch === 'with_setup'
    ? 'EOQ dinámico con costo fijo de pedido'
    : 'EOQ dinámico sin costo fijo de pedido';

  return `Calculé el plan óptimo usando ${model} (Wagner-Whitin). Plan: ${plan}. Costo relevante total: ${totalRelevantCost}.`;
};

// ─── Handler ──────────────────────────────────────────────────────────────────

export const handleSimpleChatRequest = async (body: unknown): Promise<SimpleChatResponse> => {
  const req = SimpleChatRequestSchema.parse(body);

  // ── Generic (preguntas sin sesión activa) ─────────────────────────────────
  if (req.type === 'generic') {
    try {
      const message = await callGroqGeneric(req.userText);
      return { type: 'generic', message };
    } catch (error) {
      if (error instanceof RateLimitedError) {
        return { type: 'generic', message: RATE_LIMIT_FRIENDLY_MESSAGE };
      }
      throw error;
    }
  }

  // ── Solve ─────────────────────────────────────────────────────────────────
  if (req.type === 'solve') {
    const solverInput  = buildSolverInput(req);
    const solverOutput = runSolver(solverInput);
    const sessionId    = req.sessionId ?? crypto.randomUUID();
    const message      = buildSolverSummary(solverInput, solverOutput);

    const userMessage: ConversationMessage = {
      role: 'user',
      content: `Resolvé este problema EOQ: ${req.periodDemands.length} período(s), demandas [${req.periodDemands.join(', ')}], costo de almacenamiento ${req.holdingCost}${req.hasSetupCost ? `, costo fijo de pedido ${req.setupCost}` : ', sin costo fijo'}.`,
    };
    const assistantMessage: ConversationMessage = { role: 'assistant', content: message };

    await saveSession({
      sessionId,
      solverInput,
      solverOutput,
      history: [userMessage, assistantMessage],
    });

    return { type: 'solve', sessionId, message, solverInput, solverOutput };
  }

  // ── Follow-up ─────────────────────────────────────────────────────────────
  const session = await getSession(req.sessionId);
  if (!session) {
    return {
      type: 'followup',
      sessionId: req.sessionId,
      message: 'No encontré la sesión. Por favor iniciá un nuevo problema.',
      suggestsNewProblem: true,
    };
  }

  let message: string;
  let suggestsNewProblem = false;
  try {
    const result = await callGroqFollowUp({
      history:      session.history,
      userText:     req.userText,
      solverInput:  session.solverInput,
      solverOutput: session.solverOutput,
    });
    message = result.message;
    suggestsNewProblem = result.suggestsNewProblem;
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return {
        type: 'followup',
        sessionId: req.sessionId,
        message: RATE_LIMIT_FRIENDLY_MESSAGE,
        suggestsNewProblem: false,
      };
    }
    throw error;
  }

  message = processWhatIfMarker(message, session.solverInput, session.solverOutput);

  session.history.push(
    { role: 'user',      content: req.userText },
    { role: 'assistant', content: message },
  );
  await saveSession(session);

  return { type: 'followup', sessionId: req.sessionId, message, suggestsNewProblem };
};
