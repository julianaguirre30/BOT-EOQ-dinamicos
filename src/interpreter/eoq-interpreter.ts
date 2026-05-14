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

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const parseNumericToken = (value: string): number | undefined => {
  const parsed = Number.parseFloat(value.replace(/\s+/gu, '').replace(',', '.'));

  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseNumericSeries = (value: string): number[] | undefined => {
  const tokens = value.replace(/\by\b/giu, ',').split(',').map((token) => token.trim()).filter(Boolean);

  if (tokens.length < 3) {
    return undefined;
  }

  const parsed = tokens.map((token) => parseNumericToken(token));

  if (parsed.some((token) => token === undefined)) {
    return undefined;
  }

  return parsed as number[];
};

const recoverPeriodDemands = (text: string): number[] | undefined => {
  const match = normalizeText(text).match(
    /(?:demanda(?:s)?|ventas|consumo|requerimiento)[^.\n]{0,40}?(?:de|:)?\s*((?:\d+(?:[.,]\d+)?(?:\s*(?:,|y)\s*\d+(?:[.,]\d+)?)+))/iu,
  );

  if (!match?.[1]) {
    return undefined;
  }

  return parseNumericSeries(match[1]);
};

const recoverScalarFromCue = (text: string, pattern: RegExp): number | undefined => {
  const match = normalizeText(text).match(pattern);

  if (!match?.[1]) {
    return undefined;
  }

  return parseNumericToken(match[1]);
};

const recoverObviousExtraction = (
  userText: string,
  interpretation: ProblemInterpretation,
): { interpretation: ProblemInterpretation; recovered: boolean } => {
  const extractedValues = { ...interpretation.extractedValues };
  let recovered = false;

  if (extractedValues.periodDemands === undefined) {
    const recoveredPeriodDemands = recoverPeriodDemands(userText);
    if (recoveredPeriodDemands !== undefined) {
      extractedValues.periodDemands = recoveredPeriodDemands;
      recovered = true;
    }
  }

  if (extractedValues.demandRate === undefined && extractedValues.periodDemands === undefined) {
    const recoveredDemandRate = recoverScalarFromCue(
      userText,
      /(?:demanda|ventas|consumo|requerimiento)[^.\n]{0,40}?(\d+(?:[.,]\d+)?)[^.\n]{0,30}(?:al ano|anual|por ano|mensual|por mes|semanal|por semana|por periodo|por per[ií]odo)/iu,
    );

    if (recoveredDemandRate !== undefined) {
      extractedValues.demandRate = recoveredDemandRate;
      recovered = true;
    }
  }

  if (extractedValues.holdingCost === undefined) {
    const recoveredHoldingCost = recoverScalarFromCue(
      userText,
      /(?:costo\s+de\s+)?(?:almacenamiento|almacenaje|tenencia|mantenimiento|mantener|guardar|conservar|holding)[^.\n]{0,40}?(\d+(?:[.,]\d+)?)/iu,
    );

    if (recoveredHoldingCost !== undefined) {
      extractedValues.holdingCost = recoveredHoldingCost;
      recovered = true;
    }
  }

  if (extractedValues.setupCost === undefined) {
    const recoveredSetupCost = recoverScalarFromCue(
      userText,
      /(?:costo\s+de\s+)?(?:pedido|preparaci[oó]n|setup|orden|reponer|reposici[oó]n)[^.\n]{0,40}?(\d+(?:[.,]\d+)?)/iu,
    );

    if (recoveredSetupCost !== undefined) {
      extractedValues.setupCost = recoveredSetupCost;
      recovered = true;
    }
  }

  if (extractedValues.initialInventory === undefined) {
    const recoveredInitialInventory = recoverScalarFromCue(
      userText,
      /(?:inventario\s+inicial|stock\s+inicial|arranco\s+con|empiezo\s+con|parto\s+con)[^.\n]{0,25}?(\d+(?:[.,]\d+)?)/iu,
    );

    if (recoveredInitialInventory !== undefined) {
      extractedValues.initialInventory = recoveredInitialInventory;
      recovered = true;
    }
  }

  return {
    interpretation: ProblemInterpretationSchema.parse({
      ...interpretation,
      extractedValues,
    }),
    recovered,
  };
};

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

  if (/(demanda|ventas|consumo|requerimiento)[^.\n]{0,40}(\d+(?:[.,]\d+)?\s*,\s*\d+(?:[.,]\d+)?\s*,\s*\d+(?:[.,]\d+)?)/iu.test(text)) {
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
  /(mantener|mantenimiento|almacenaje|almacenamiento|tenencia|guardar|guardadas|conservar|holding)[^.\n]{0,50}\d+(?:[.,]\d+)?/iu.test(
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
  const recoveredResult = recoverObviousExtraction(userText, interpretation);
  const underExtractedFields = detectUnderExtractedFields(userText, recoveredResult.interpretation);

  if (underExtractedFields.length === 0 && !recoveredResult.recovered) {
    return interpretation;
  }

  const issues = [...recoveredResult.interpretation.issues];

  if (recoveredResult.recovered || underExtractedFields.length > 0) {
    pushUnique(issues, 'interpreter_under_extracted');
  }

  for (const field of underExtractedFields) {
    pushUnique(issues, `interpreter_under_extracted_${field}`);
  }

  return ProblemInterpretationSchema.parse({
    ...recoveredResult.interpretation,
    confidence: underExtractedFields.length > 0 ? Math.min(recoveredResult.interpretation.confidence, LOW_CONFIDENCE_CAP) : Math.max(recoveredResult.interpretation.confidence, 0.6),
    missingCriticalFields: [...new Set([...recoveredResult.interpretation.missingCriticalFields, ...underExtractedFields])],
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
