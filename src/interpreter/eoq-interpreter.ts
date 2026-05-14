import {
  InterpretationRequest,
  InterpretationRequestSchema,
  ProblemInterpretation,
  ProblemInterpretationSchema,
  TaxonomyTag,
} from '../contracts/eoq';

export interface EoqInterpreter {
  interpret(request: InterpretationRequest): Promise<ProblemInterpretation>;
}

export type InterpreterFailureCode =
  | 'missing_config'
  | 'provider_failure'
  | 'invalid_json'
  | 'schema_mismatch';

export class InterpreterFailure extends Error {
  constructor(
    message: string,
    readonly code: InterpreterFailureCode,
    readonly details?: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'InterpreterFailure';
  }
}

export const parseInterpretationRequest = (request: InterpretationRequest): InterpretationRequest =>
  InterpretationRequestSchema.parse(request);

export const parseProblemInterpretation = (
  interpretation: ProblemInterpretation,
): ProblemInterpretation => ProblemInterpretationSchema.parse(interpretation);

const LOW_CONFIDENCE_CAP = 0.35;

const SCALAR_FIELD_ALIASES = {
  demandRate: ['demandRate', 'annualDemand', 'demand', 'demandPerPeriod', 'D'],
  holdingCost: [
    'holdingCost',
    'holding_cost',
    'holdingCostPerUnitPerYear',
    'holdingCostPerUnitPerPeriod',
    'unitHoldingCost',
    'h',
  ],
  setupCost: ['setupCost', 'setup_cost', 'orderingCost', 'orderCost', 'S', 'K'],
  initialInventory: ['initialInventory', 'initial_inventory', 'startingInventory', 'stockInicial'],
} as const;

const SERIES_FIELD_ALIASES = {
  periodDemands: ['periodDemands', 'period_demands', 'demandSchedule', 'weeklyDemand', 'demands'],
} as const;

const pushUnique = (collection: string[], value: string) => {
  if (!collection.includes(value)) {
    collection.push(value);
  }
};

const hasNumericValue = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value);

const hasNumericArray = (value: unknown): boolean =>
  Array.isArray(value) && value.length > 0 && value.every((item) => hasNumericValue(item));

const hasNumericRecord = (value: unknown): boolean =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.values(value).length > 0 &&
  Object.values(value).every((item) => hasNumericValue(item));

const extractFieldValue = (
  extractedValues: ProblemInterpretation['extractedValues'],
  aliases: readonly string[],
): unknown => aliases.map((alias) => extractedValues[alias]).find((value) => value !== undefined);

const hasScalarExtraction = (
  extractedValues: ProblemInterpretation['extractedValues'],
  aliases: readonly string[],
): boolean => hasNumericValue(extractFieldValue(extractedValues, aliases));

const hasSeriesExtraction = (
  extractedValues: ProblemInterpretation['extractedValues'],
  aliases: readonly string[],
): boolean => {
  const directValue = extractFieldValue(extractedValues, aliases);
  if (hasNumericArray(directValue) || hasNumericRecord(directValue)) {
    return true;
  }

  return Object.entries(extractedValues).some(
    ([key, value]) => /^p\d+$/iu.test(key) && hasNumericValue(value),
  );
};

const hasPeriodDemandEvidence = (text: string): boolean => {
  const normalized = text.toLowerCase();
  const monthMatches = normalized.match(
    /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)[^\d]{0,20}\d+(?:[.,]\d+)?/giu,
  );
  if (monthMatches && monthMatches.length >= 2) {
    return true;
  }

  return /(demanda|ventas|consumo|consume|requerimiento|necesito)[^.\n]{0,60}(mensual(?:es)?|por mes|por período|por periodo|semanal(?:es)?|por semana|por trimestre)[^.\n]{0,80}\d+(?:[.,]\d+)?(?:[^\n]{0,30}\d+(?:[.,]\d+)?){1,}/iu.test(
    text,
  );
};

const hasDemandRateEvidence = (text: string): boolean =>
  /(demanda|vendo|ventas|consume|consumo|requerimiento|requiere|necesita)[^.\n]{0,40}\d+(?:[.,]\d+)?[^.\n]{0,30}(al año|anual|por año|mensual|por mes|semanal|por semana|por período|por periodo)/iu.test(
    text,
  );

const hasHoldingCostEvidence = (text: string): boolean =>
  /(mantener|mantenimiento|almacenaje|tenencia|guardar|guardadas|conservar|holding)[^.\n]{0,50}\d+(?:[.,]\d+)?/iu.test(
    text,
  );

const hasSetupCostEvidence = (text: string): boolean =>
  /(preparaci[oó]n|puesta a punto|setup|pedido|ordenar|orden|lanzar un pedido|hacer un pedido|reponer)[^.\n]{0,60}\d+(?:[.,]\d+)?/iu.test(
    text,
  );

const hasInitialInventoryEvidence = (text: string): boolean =>
  /(inventario inicial|stock inicial|arranco con|empiezo con|parto con)[^.\n]{0,25}\d+(?:[.,]\d+)?/iu.test(
    text,
  );

const detectUnderExtractedFields = (
  userText: string,
  interpretation: ProblemInterpretation,
): string[] => {
  const underExtracted: string[] = [];
  const { extractedValues } = interpretation;

  if (
    hasPeriodDemandEvidence(userText) &&
    !hasSeriesExtraction(extractedValues, SERIES_FIELD_ALIASES.periodDemands)
  ) {
    pushUnique(underExtracted, 'periodDemands');
  }

  if (
    hasDemandRateEvidence(userText) &&
    !hasScalarExtraction(extractedValues, SCALAR_FIELD_ALIASES.demandRate) &&
    !hasSeriesExtraction(extractedValues, SERIES_FIELD_ALIASES.periodDemands)
  ) {
    pushUnique(underExtracted, 'demandRate');
  }

  if (
    hasHoldingCostEvidence(userText) &&
    !hasScalarExtraction(extractedValues, SCALAR_FIELD_ALIASES.holdingCost)
  ) {
    pushUnique(underExtracted, 'holdingCost');
  }

  if (hasSetupCostEvidence(userText) && !hasScalarExtraction(extractedValues, SCALAR_FIELD_ALIASES.setupCost)) {
    pushUnique(underExtracted, 'setupCost');
  }

  if (
    hasInitialInventoryEvidence(userText) &&
    !hasScalarExtraction(extractedValues, SCALAR_FIELD_ALIASES.initialInventory)
  ) {
    pushUnique(underExtracted, 'initialInventory');
  }

  return underExtracted;
};

export const applyInterpretationAdequacyGate = (
  userText: string,
  interpretation: ProblemInterpretation,
): ProblemInterpretation => {
  const underExtractedFields = detectUnderExtractedFields(userText, interpretation);

  if (underExtractedFields.length === 0) {
    return interpretation;
  }

  const issues = [...interpretation.issues];
  pushUnique(issues, 'interpreter_under_extracted');
  for (const field of underExtractedFields) {
    pushUnique(issues, `interpreter_under_extracted_${field}`);
  }

  return ProblemInterpretationSchema.parse({
    ...interpretation,
    confidence: Math.min(interpretation.confidence, LOW_CONFIDENCE_CAP),
    missingCriticalFields: [...new Set([...interpretation.missingCriticalFields, ...underExtractedFields])],
    issues,
  });
};

const buildFailureNotes = (failure: InterpreterFailure): string[] =>
  [failure.code, failure.details]
    .filter((value): value is string => Boolean(value))
    .map((value) => `interpreter_${value}`);

const buildFailureTag = (failure: InterpreterFailure): TaxonomyTag => ({
  family: 'inventory',
  topic: 'eoq',
  variant: 'standard',
  status: 'ambiguous',
  notes: buildFailureNotes(failure),
});

export const buildFailedInterpretation = (
  request: InterpretationRequest,
  failure: InterpreterFailure,
): ProblemInterpretation =>
  ProblemInterpretationSchema.parse({
    normalizedText: request.userText.trim(),
    extractedValues: {},
    units: {},
    taxonomyTags: [buildFailureTag(failure)],
    confidence: 0,
    missingCriticalFields: ['branch', 'demandRate', 'holdingCost'],
    issues: buildFailureNotes(failure),
  });
