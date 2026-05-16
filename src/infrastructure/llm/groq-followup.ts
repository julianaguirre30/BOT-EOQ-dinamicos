import { SolverInput, SolverOutput } from '../../contracts/eoq';
import { ConversationMessage } from '../../session/simple-session';
import { loadLlmInterpreterConfig } from '../../config/llm-config';

const buildSystemPrompt = (solverInput: SolverInput, solverOutput: SolverOutput): string => {
  const demands = solverInput.periodDemands?.join(', ') ?? solverInput.demandRate;
  const hasSetup = solverInput.branch === 'with_setup';
  const setupCost = hasSetup ? (solverInput as Extract<SolverInput, { branch: 'with_setup'; variant: 'scalar' }>).setupCost : null;

  const plan = solverOutput.policy.replenishmentPlan
    .map((p) =>
      p.period === p.coversThroughPeriod
        ? `  - Período ${p.period}: pedir ${p.quantity} unidades (cubre solo ese período)`
        : `  - Período ${p.period}: pedir ${p.quantity} unidades (cubre períodos ${p.period} al ${p.coversThroughPeriod})`,
    )
    .join('\n');

  const { setupOrOrderingCost, holdingCost, totalRelevantCost } =
    solverOutput.mathematicalArtifacts.costBreakdown;

  return [
    'Sos un asistente especializado en modelos determinísticos avanzados de inventario EOQ dinámico,',
    'desarrollado para estudiantes de Investigación Operativa de la UTN FRRe.',
    'Tu único dominio es el EOQ dinámico con y sin costo de reposición, usando el algoritmo Wagner-Whitin.',
    '',
    '=== PROBLEMA EN CURSO ===',
    `Períodos: ${solverInput.periodDemands?.length ?? 1}`,
    `Demandas por período: [${demands}]`,
    `Costo de almacenamiento por unidad/período: ${solverInput.holdingCost}`,
    hasSetup
      ? `Costo fijo de pedido/preparación: ${setupCost}`
      : 'Sin costo fijo de pedido (reposición lote a lote)',
    '',
    '=== PLAN ÓPTIMO (Wagner-Whitin) ===',
    plan,
    '',
    '=== COSTOS ===',
    `Costo fijo total: ${setupOrOrderingCost}`,
    `Costo de almacenamiento total: ${holdingCost}`,
    `Costo relevante total: ${totalRelevantCost}`,
    '',
    '=== REGLAS DE CONTENIDO ===',
    '- Solo respondés preguntas relacionadas al EOQ dinámico y a este problema específico.',
    '- Los números del plan ya fueron calculados por el algoritmo. No los modificás, solo los explicás.',
    '- Si el estudiante pregunta algo fuera del dominio (geografía, historia, código, etc.),',
    '  respondés en una línea que no es tu área y redirigís al problema en curso.',
    '',
    '=== PROHIBICIÓN ABSOLUTA DE CALCULAR ===',
    '- NUNCA calculés un plan de reposición nuevo, aunque el estudiante te lo pida explícitamente.',
    '- NUNCA inventés períodos, cantidades, costos ni resultados que no estén en el plan calculado arriba.',
    '- Si el estudiante quiere resolver un problema con datos diferentes (distinto costo, distintas demandas, etc.),',
    '  respondés de forma amigable explicando cualitativamente qué cambiaría, por ejemplo:',
    '  "¡Buena pregunta! Con un costo de almacenamiento menor, conviene hacer lotes más grandes porque',
    '   almacenar es más barato. Para ver el plan exacto con esos datos, podés iniciar un nuevo cálculo."',
    '  Y al final del mensaje agregás exactamente el texto: [NUEVO_PROBLEMA]',
    '- Agregás [NUEVO_PROBLEMA] SOLO cuando el estudiante quiera cambiar algún parámetro (costo, demandas, períodos)',
    '  o pida calcular un escenario diferente. NO lo agregués en preguntas de explicación del resultado actual.',
    '- Podés explicar qué pasaría cualitativamente pero nunca con números concretos inventados.',
    '- Si alguien pregunta algo fuera del dominio EOQ, respondés amigable:',
    '  "Eso está fuera de mi área, pero con gusto te ayudo con cualquier duda sobre el plan de pedidos que calculamos."',
    '',
    '=== REGLAS DE FORMATO (MUY IMPORTANTE) ===',
    '- Respondés en español, de forma clara y directa para un estudiante universitario.',
    '- Máximo 4 oraciones o puntos por respuesta. Sé conciso.',
    '- Usá saltos de línea para separar ideas distintas.',
    '- Si listás más de un punto, usá "•" al inicio de cada uno.',
    '- No repetís información que ya está en la tabla de resultados.',
    '- No usás markdown (* ** # etc), solo texto plano con saltos de línea y "•".',
    '- Nunca escribas fórmulas matemáticas largas. Si necesitás una, usala en una línea corta.',
  ].join('\n');
};

const GENERIC_SYSTEM_PROMPT = [
  'Sos un asistente educativo especializado en modelos de inventario EOQ dinámico,',
  'para estudiantes de Investigación Operativa de la UTN FRRe.',
  'Respondés preguntas conceptuales sobre EOQ, Wagner-Whitin y gestión de inventarios.',
  'No resolvés problemas con números concretos ni inventás datos; solo explicás conceptos.',
  'Si te preguntan algo fuera del dominio inventario/EOQ, decís que solo podés ayudar con eso.',
  '',
  'Formato:',
  '- Máximo 5 líneas o puntos.',
  '- Usá saltos de línea y "•" para listas.',
  '- Sin markdown (* ** #), solo texto plano.',
  '- Tono claro y pedagógico, como un docente que explica en clase.',
].join('\n');

const groqPost = async (messages: Array<{ role: string; content: string }>): Promise<string> => {
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
    if (!response.ok) throw new Error(`Groq error ${response.status}`);
    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    return data.choices[0].message.content.trim();
  } finally {
    clearTimeout(timeout);
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
