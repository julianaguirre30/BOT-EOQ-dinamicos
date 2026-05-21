import { SolverInput, SolverOutput } from '../../contracts/eoq';
import { ConversationMessage } from '../../session/simple-session';
import { loadLlmInterpreterConfig } from '../../config/llm-config';
import { EOQ_THEORY_REFERENCE, EOQ_BIBLIOGRAPHY_CITATION } from '../../domain/knowledge/eoq-theory';

const FORMAT_RULES = [
  'Formato:',
  '- Español, claro y pedagógico, máximo 4–5 líneas.',
  '- Saltos de línea para separar ideas; "•" para listas.',
  '- Sin markdown (* ** #) ni fórmulas largas.',
].join('\n');

const THEORY_AND_CITATION = [
  'Para preguntas conceptuales basate en la TEORÍA DE REFERENCIA de más abajo.',
  'Si la respuesta apoya un concepto teórico, terminala en una línea aparte con:',
  `— ${EOQ_BIBLIOGRAPHY_CITATION}`,
  'No cites la fuente cuando solo expliques el plan ya calculado o redirijas fuera de dominio.',
  '',
  EOQ_THEORY_REFERENCE,
].join('\n');

const buildSystemPrompt = (solverInput: SolverInput, solverOutput: SolverOutput): string => {
  const demands = solverInput.periodDemands?.join(', ') ?? solverInput.demandRate;
  const hasSetup = solverInput.branch === 'with_setup';
  const setupCost = hasSetup
    ? (solverInput as Extract<SolverInput, { branch: 'with_setup'; variant: 'scalar' }>).setupCost
    : null;

  const plan = solverOutput.policy.replenishmentPlan
    .map((p) =>
      p.period === p.coversThroughPeriod
        ? `  - Período ${p.period}: pedir ${p.quantity} unidades`
        : `  - Período ${p.period}: pedir ${p.quantity} unidades (cubre ${p.period}–${p.coversThroughPeriod})`,
    )
    .join('\n');

  const { setupOrOrderingCost, holdingCost, totalRelevantCost } =
    solverOutput.mathematicalArtifacts.costBreakdown;

  return [
    'Sos un asistente de EOQ dinámico (Wagner-Whitin) para estudiantes de IO de la UTN FRRe.',
    '',
    '=== PROBLEMA EN CURSO ===',
    `Períodos: ${solverInput.periodDemands?.length ?? 1} · Demandas: [${demands}]`,
    `Costo de almacenamiento: ${solverInput.holdingCost}`,
    hasSetup ? `Costo fijo de pedido: ${setupCost}` : 'Sin costo fijo (lote a lote)',
    '',
    '=== PLAN ÓPTIMO ===',
    plan,
    '',
    '=== COSTOS ===',
    `Fijo: ${setupOrOrderingCost} · Almacenamiento: ${holdingCost} · Relevante total: ${totalRelevantCost}`,
    '',
    '=== REGLAS ===',
    '- No recalculés ni inventés números: los del plan son la única verdad.',
    '- Si piden cambiar parámetros o un escenario distinto, explicá cualitativamente qué ocurriría',
    '  y terminá el mensaje con el token: [NUEVO_PROBLEMA]',
    '- Fuera del dominio EOQ: respondé en una línea que no es tu área y volvé al problema.',
    '',
    FORMAT_RULES,
    '',
    THEORY_AND_CITATION,
  ].join('\n');
};

const GENERIC_SYSTEM_PROMPT = [
  'Sos un asistente educativo de EOQ dinámico (Wagner-Whitin) para estudiantes de IO de la UTN FRRe.',
  'Respondés preguntas conceptuales; no resolvés problemas con números concretos.',
  'Fuera del dominio inventario/EOQ: aclará que solo podés ayudar con eso.',
  '',
  FORMAT_RULES,
  '',
  THEORY_AND_CITATION,
].join('\n');

export class RateLimitedError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super(`Groq rate limit (retry after ${retryAfterSeconds}s)`);
    this.name = 'RateLimitedError';
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryAfter = (header: string | null): number => {
  if (!header) return 5;
  const seconds = Number.parseFloat(header);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds, 30);
  return 5;
};

const groqPostOnce = async (
  messages: Array<{ role: string; content: string }>,
): Promise<string> => {
  const config = loadLlmInterpreterConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, temperature: 0.5, max_tokens: 512, messages }),
      signal: controller.signal,
    });
    if (response.status === 429) {
      throw new RateLimitedError(parseRetryAfter(response.headers.get('retry-after')));
    }
    if (!response.ok) throw new Error(`Groq error ${response.status}`);
    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    return data.choices[0].message.content.trim();
  } finally {
    clearTimeout(timeout);
  }
};

const groqPost = async (messages: Array<{ role: string; content: string }>): Promise<string> => {
  try {
    return await groqPostOnce(messages);
  } catch (error) {
    if (error instanceof RateLimitedError) {
      await sleep(error.retryAfterSeconds * 1000);
      return groqPostOnce(messages);
    }
    throw error;
  }
};

export const callGroqGeneric = async (userText: string): Promise<string> =>
  groqPost([
    { role: 'system', content: GENERIC_SYSTEM_PROMPT },
    { role: 'user',   content: userText },
  ]);

export const callGroqFollowUp = async ({
  history,
  userText,
  solverInput,
  solverOutput,
}: {
  history: ConversationMessage[];
  userText: string;
  solverInput: SolverInput;
  solverOutput: SolverOutput;
}): Promise<{ message: string; suggestsNewProblem: boolean }> => {
  const raw = await groqPost([
    { role: 'system', content: buildSystemPrompt(solverInput, solverOutput) },
    ...history,
    { role: 'user', content: userText },
  ]);
  const suggestsNewProblem = raw.includes('[NUEVO_PROBLEMA]');
  const message = raw.replace('[NUEVO_PROBLEMA]', '').trimEnd();
  return { message, suggestsNewProblem };
};
