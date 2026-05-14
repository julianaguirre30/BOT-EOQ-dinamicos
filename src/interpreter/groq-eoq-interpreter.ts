import { LlmInterpreterConfig, loadLlmInterpreterConfig } from '../config/llm-config';
import { InterpretationRequest, ProblemInterpretation } from '../contracts/eoq';
import {
  ChatCompletionClient,
  ChatCompletionResult,
} from '../infrastructure/llm/chat-completion-client';
import { GroqChatCompletionClient } from '../infrastructure/llm/groq-chat-completion-client';
import {
  applyInterpretationAdequacyGate,
  EoqInterpreter,
  InterpreterFailure,
  parseInterpretationRequest,
  parseProblemInterpretation,
} from './eoq-interpreter';

const DEFAULT_SYSTEM_PROMPT = [
  'Sos un extractor estructurado para problemas EOQ del MVP.',
  'Devolvé SOLO JSON válido, sin markdown.',
  'No inventes valores faltantes.',
  'Priorizá COBERTURA de extracción: si el texto trae números visibles, extraelos explícitamente.',
  'Si detectás demanda por períodos, devolvela en extractedValues.periodDemands como array numérico ordenado.',
  'Si aparece demanda escalar, devolvela en extractedValues.demandRate.',
  'Si aparece costo de pedido/preparación/setup, devolvelo en extractedValues.setupCost aunque sea 0.',
  'Si aparece costo de mantener/tenencia/almacenaje/almacenamiento, devolvelo en extractedValues.holdingCost.',
  'Si aparece inventario o stock inicial, devolvé extractedValues.initialInventory.',
  'Si el usuario da una serie corta como 10,20,30 después de hablar de demanda, tratala como periodDemands ordenado.',
  'Si una pista está presente pero no podés resolver el valor, agregá ese campo a missingCriticalFields, bajá confidence y explicalo en issues.',
  'No omitas números visibles del usuario aunque el caso siga incompleto.',
  'Si la rama no es segura, omití branchCandidate y marcá missingCriticalFields.',
  'taxonomyTags debe tener al menos un tag del dominio EOQ.',
  'confidence debe estar entre 0 y 1.',
].join(' ');

const stripJsonFences = (content: string): string => {
  const trimmed = content.trim();

  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  return trimmed.replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, '').trim();
};

const parseStructuredContent = (
  result: ChatCompletionResult,
  userText: string,
): ProblemInterpretation => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(stripJsonFences(result.content));
  } catch (error) {
    throw new InterpreterFailure(
      'The provider response was not valid JSON.',
      'invalid_json',
      result.content,
      error,
    );
  }

  try {
    return applyInterpretationAdequacyGate(
      userText,
      parseProblemInterpretation(parsed as ProblemInterpretation),
    );
  } catch (error) {
    throw new InterpreterFailure(
      'The provider response did not match ProblemInterpretation.',
      'schema_mismatch',
      error instanceof Error ? error.message : 'schema_mismatch',
      error,
    );
  }
};

const buildUserPrompt = (request: InterpretationRequest): string =>
  JSON.stringify({
    task: 'Interpret this EOQ problem into ProblemInterpretation JSON with explicit extraction coverage.',
    sessionId: request.sessionId,
    userText: request.userText,
    extractionTargets: {
      branchCandidate: 'with_setup | no_setup | omit if uncertain',
      periodDemands: 'array of numbers when the user gives monthly/weekly/per-period demand series',
      demandRate: 'single numeric demand when the user gives an aggregate rate',
      holdingCost: 'numeric holding/carrying/storage cost when explicitly stated',
      setupCost: 'numeric ordering/setup/preparation cost when explicitly stated, including 0',
      unitCost: 'numeric purchase/production cost only if explicit',
      initialInventory: 'numeric starting inventory/stock if explicit',
    },
    rules: [
      'Extract explicit numbers from userText instead of summarizing them.',
      'If evidence is a demand schedule, prefer periodDemands over a single invented aggregate.',
      'Do not invent missing values.',
      'If a field is clearly referenced but unresolved, include it in missingCriticalFields, lower confidence, and explain why in issues.',
      'Do not omit visible EOQ numbers such as monthly demands, setup/order cost, holding cost, lead time, or initial inventory.',
      'Return valid ProblemInterpretation JSON only.',
    ],
    examplesOfEvidence: {
      periodDemands: ['enero 120, febrero 90, marzo 110', 'demandas mensuales: 80, 120, 60', 'demanda de 10,20,30'],
      setupCost: ['cada pedido cuesta 150', 'cada preparación sale 200', 'sin costo de preparación => setupCost 0'],
      holdingCost: ['mantener cada unidad cuesta 3 por mes', 'tenencia 5 por unidad por año', 'costo de almacenamiento 40'],
      initialInventory: ['stock inicial 20', 'arranco con 15 unidades'],
    },
    requiredShape: {
      normalizedText: 'string',
      branchCandidate: 'with_setup | no_setup | omitted when uncertain',
      extractedValues: 'record<string, number | string | boolean | number[]>',
      units: {
        demandUnit: 'optional string',
        timeBasis: 'optional string',
        currency: 'optional string',
      },
      taxonomyTags: [
        {
          family: 'inventory',
          topic: 'eoq',
          variant: 'standard | comparison_only | non_mvp',
          branch: 'optional with_setup | no_setup',
          status: 'supported | unsupported | ambiguous',
          notes: ['string'],
        },
      ],
      confidence: 'number between 0 and 1',
      missingCriticalFields: ['branch | demandRate | periodDemands | holdingCost | setupCost | initialInventory | other field names'],
      issues: ['brief reasons for ambiguity, missing evidence resolution, or unsupported cues'],
    },
  });

export class GroqEoqInterpreter implements EoqInterpreter {
  constructor(
    private readonly dependencies: {
      client: ChatCompletionClient;
      model: string;
      timeoutMs?: number;
      systemPrompt?: string;
    },
  ) {}

  async interpret(request: InterpretationRequest): Promise<ProblemInterpretation> {
    const parsedRequest = parseInterpretationRequest(request);
    const completion = await this.dependencies.client.complete({
      model: this.dependencies.model,
      timeoutMs: this.dependencies.timeoutMs,
      temperature: 0,
      responseFormat: { type: 'json_object' },
      messages: [
        { role: 'system', content: this.dependencies.systemPrompt ?? DEFAULT_SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(parsedRequest) },
      ],
    });

    return parseStructuredContent(completion, parsedRequest.userText);
  }
}

export const createGroqEoqInterpreterFromEnv = ({
  env,
  envFilePath,
  fetchImpl,
}: {
  env?: Record<string, string>;
  envFilePath?: string;
  fetchImpl?: typeof fetch;
} = {}): GroqEoqInterpreter => {
  const config: LlmInterpreterConfig = loadLlmInterpreterConfig({ env, envFilePath });

  return new GroqEoqInterpreter({
    client: new GroqChatCompletionClient(config, fetchImpl),
    model: config.model,
    timeoutMs: config.timeoutMs,
  });
};
