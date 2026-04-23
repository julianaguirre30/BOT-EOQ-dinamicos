import {
  CanonicalEoqInput,
  CanonicalEoqInputSchema,
  NormalizationResult,
  NormalizationResultSchema,
  PeriodMap,
  ProblemBranch,
  ProblemInterpretation,
} from '../../contracts/eoq';

const SCALAR_ALIASES = {
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
  leadTime: ['leadTime', 'lead_time'],
  unitCost: ['unitCost', 'unit_cost', 'purchaseCost', 'productionCost', 'c'],
} as const;

const SERIES_ALIASES = {
  periodDemands: ['periodDemands', 'period_demands', 'demandSchedule', 'weeklyDemand', 'demands', 'demand'],
  setupCostByPeriod: ['setupCostByPeriod', 'setup_cost_by_period', 'orderingCostByPeriod', 'orderCostByPeriod'],
  unitCostByPeriod: [
    'unitCostByPeriod',
    'unit_cost_by_period',
    'unitCostPerPeriod',
    'unit_cost_per_period',
    'unitCosts',
    'unit_costs',
    'unitCostsByPeriod',
    'unit_costs_by_period',
    'costByPeriod',
    'costPerPeriod',
    'productionCost',
    'productionCosts',
    'productionCostByPeriod',
    'productionCostsByPeriod',
    'purchaseCost',
    'purchaseCosts',
    'purchaseCostByPeriod',
    'purchaseCostsByPeriod',
  ],
} as const;

const INDEXED_KEY_PATTERNS = {
  periodDemands: /^p(\d+)$/i,
  setupCostByPeriod: /^s(\d+)$/i,
  unitCostByPeriod: /^c(\d+)$/i,
} as const;

const GENERIC_PERIOD_KEY_PATTERNS = [/^p(\d+)$/i, /^(\d+)$/] as const;

const getFiniteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const getNumberArray = (value: unknown): number[] | undefined =>
  Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item))
    ? [...value]
    : undefined;

const getPeriodMap = (value: unknown): PeriodMap | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    return undefined;
  }

  if (!entries.every(([, entryValue]) => typeof entryValue === 'number' && Number.isFinite(entryValue))) {
    return undefined;
  }

  return Object.fromEntries(entries) as PeriodMap;
};

const sortIndexedEntries = (entries: Array<[string, number]>): number[] =>
  [...entries]
    .sort((left, right) => Number.parseInt(left[0], 10) - Number.parseInt(right[0], 10))
    .map(([, value]) => value);

const getIndexedSeries = (
  extractedValues: ProblemInterpretation['extractedValues'],
  pattern: RegExp,
): number[] | undefined => {
  const indexedEntries = Object.entries(extractedValues)
    .map(([key, value]) => {
      const match = pattern.exec(key);
      const numericValue = getFiniteNumber(value);

      if (!match || numericValue === undefined) {
        return undefined;
      }

      return [match[1], numericValue] as const;
    })
    .filter((entry): entry is readonly [string, number] => entry !== undefined);

  return indexedEntries.length > 0 ? sortIndexedEntries(indexedEntries.map(([index, value]) => [index, value])) : undefined;
};

const getPeriodSeriesFromMap = (map: PeriodMap, pattern: RegExp): number[] | undefined => {
  const indexedEntries = Object.entries(map)
    .map(([key, value]) => {
      const match = [pattern, ...GENERIC_PERIOD_KEY_PATTERNS]
        .map((candidate) => candidate.exec(key))
        .find((candidate) => candidate !== null);

      return match ? ([match[1], value] as const) : undefined;
    })
    .filter((entry): entry is readonly [string, number] => entry !== undefined);

  return indexedEntries.length > 0 ? sortIndexedEntries(indexedEntries.map(([index, value]) => [index, value])) : undefined;
};

const pushNote = (notes: string[], note: string) => {
  if (!notes.includes(note)) {
    notes.push(note);
  }
};

const getFirstScalar = (
  extractedValues: ProblemInterpretation['extractedValues'],
  aliases: readonly string[],
  canonicalField: string,
  recognizedAliases: Record<string, string>,
): number | undefined => {
  for (const alias of aliases) {
    const numericValue = getFiniteNumber(extractedValues[alias]);
    if (numericValue !== undefined) {
      recognizedAliases[canonicalField] = alias;
      return numericValue;
    }
  }

  return undefined;
};

const getFirstSeries = (
  extractedValues: ProblemInterpretation['extractedValues'],
  aliases: readonly string[],
  indexedPattern: RegExp,
  canonicalField: string,
  recognizedAliases: Record<string, string>,
): number[] | undefined => {
  for (const alias of aliases) {
    const arrayValue = getNumberArray(extractedValues[alias]);
    if (arrayValue !== undefined) {
      recognizedAliases[canonicalField] = alias;
      return arrayValue;
    }

    const mapValue = getPeriodMap(extractedValues[alias]);
    if (mapValue) {
      const series = getPeriodSeriesFromMap(mapValue, indexedPattern);
      if (series !== undefined) {
        recognizedAliases[canonicalField] = alias;
        return series;
      }
    }
  }

  const indexedSeries = getIndexedSeries(extractedValues, indexedPattern);
  if (indexedSeries !== undefined) {
    recognizedAliases[canonicalField] = indexedPattern.source;
    return indexedSeries;
  }

  return undefined;
};

const inferBranch = (input: CanonicalEoqInput, interpretation: ProblemInterpretation): ProblemBranch | undefined => {
  if (input.setupCostByPeriod !== undefined) {
    return 'with_setup';
  }

  if (input.setupCost !== undefined) {
    return input.setupCost > 0 ? 'with_setup' : 'no_setup';
  }

  if (input.unitCostByPeriod !== undefined) {
    return 'no_setup';
  }

  if (interpretation.branchCandidate) {
    return interpretation.branchCandidate;
  }

  if (input.unitCost !== undefined) {
    return 'no_setup';
  }

  return undefined;
};

export const normalizeProblemInterpretation = (
  interpretation: ProblemInterpretation,
): NormalizationResult => {
  const recognizedAliases: Record<string, string> = {};
  const notes: string[] = [];

  const periodDemands = getFirstSeries(
    interpretation.extractedValues,
    SERIES_ALIASES.periodDemands,
    INDEXED_KEY_PATTERNS.periodDemands,
    'periodDemands',
    recognizedAliases,
  );
  const setupCostByPeriod = getFirstSeries(
    interpretation.extractedValues,
    SERIES_ALIASES.setupCostByPeriod,
    INDEXED_KEY_PATTERNS.setupCostByPeriod,
    'setupCostByPeriod',
    recognizedAliases,
  );
  const unitCostByPeriod = getFirstSeries(
    interpretation.extractedValues,
    SERIES_ALIASES.unitCostByPeriod,
    INDEXED_KEY_PATTERNS.unitCostByPeriod,
    'unitCostByPeriod',
    recognizedAliases,
  );

  const canonicalInput = CanonicalEoqInputSchema.parse({
    demandRate: getFirstScalar(
      interpretation.extractedValues,
      SCALAR_ALIASES.demandRate,
      'demandRate',
      recognizedAliases,
    ),
    periodDemands,
    holdingCost: getFirstScalar(
      interpretation.extractedValues,
      SCALAR_ALIASES.holdingCost,
      'holdingCost',
      recognizedAliases,
    ),
    leadTime: getFirstScalar(
      interpretation.extractedValues,
      SCALAR_ALIASES.leadTime,
      'leadTime',
      recognizedAliases,
    ),
    setupCost: getFirstScalar(
      interpretation.extractedValues,
      SCALAR_ALIASES.setupCost,
      'setupCost',
      recognizedAliases,
    ),
    setupCostByPeriod,
    unitCost: getFirstScalar(
      interpretation.extractedValues,
      SCALAR_ALIASES.unitCost,
      'unitCost',
      recognizedAliases,
    ),
    unitCostByPeriod,
  });

  const branch = inferBranch(canonicalInput, interpretation);
  const variant = setupCostByPeriod !== undefined
    ? 'setup_by_period'
    : unitCostByPeriod !== undefined
      ? 'unit_cost_by_period'
      : 'scalar';

  if (recognizedAliases.holdingCost === 'holding_cost') {
    pushNote(notes, 'normalized_holding_cost_alias');
  }

  if (recognizedAliases.setupCost === 'setup_cost') {
    pushNote(notes, 'normalized_setup_cost_alias');
  }

  if (recognizedAliases.periodDemands === INDEXED_KEY_PATTERNS.periodDemands.source) {
    pushNote(notes, 'normalized_period_demands_from_indexed_keys');
  }

  if (recognizedAliases.unitCostByPeriod === INDEXED_KEY_PATTERNS.unitCostByPeriod.source) {
    pushNote(notes, 'normalized_unit_cost_by_period_from_indexed_keys');
  }

  if (recognizedAliases.setupCostByPeriod === INDEXED_KEY_PATTERNS.setupCostByPeriod.source) {
    pushNote(notes, 'normalized_setup_cost_by_period_from_indexed_keys');
  }

  return NormalizationResultSchema.parse({
    canonicalInput: {
      ...canonicalInput,
      branch,
      variant,
    },
    recognizedAliases,
    notes,
  });
};
