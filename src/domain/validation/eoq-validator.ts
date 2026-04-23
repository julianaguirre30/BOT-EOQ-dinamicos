import {
  CanonicalEoqInput,
  NormalizationResult,
  ProblemInterpretation,
  SolverInput,
  ValidationResult,
  ValidationResultSchema,
} from '../../contracts/eoq';
import { MATERIAL_CONFIDENCE_THRESHOLD, hasAmbiguousTaxonomy } from '../knowledge/eoq-taxonomy';
import { normalizeProblemInterpretation } from '../normalization/eoq-normalizer';

const pushUnique = (collection: string[], value: string) => {
  if (!collection.includes(value)) {
    collection.push(value);
  }
};

const buildSolverInput = (input: CanonicalEoqInput): SolverInput => {
  const {
    branch,
    variant,
    holdingCost,
    leadTime = 0,
    demandRate,
    periodDemands,
    setupCost,
    setupCostByPeriod,
    unitCost,
    unitCostByPeriod,
  } = input;

  if (branch === 'with_setup' && variant === 'setup_by_period') {
    return {
      branch,
      variant,
      holdingCost: holdingCost as number,
      leadTime,
      demandRate,
      periodDemands,
      setupCostByPeriod: setupCostByPeriod as number[],
    };
  }

  if (branch === 'no_setup' && variant === 'unit_cost_by_period') {
    return {
      branch: 'no_setup',
      variant: 'unit_cost_by_period',
      holdingCost: holdingCost as number,
      leadTime,
      demandRate,
      periodDemands,
      unitCostByPeriod: unitCostByPeriod as number[],
    };
  }

  if (branch === 'with_setup') {
    return {
      branch,
      variant: 'scalar',
      holdingCost: holdingCost as number,
      leadTime,
      demandRate,
      periodDemands,
      setupCost: setupCost as number,
    };
  }

  return {
    branch: 'no_setup',
    variant: 'scalar',
    holdingCost: holdingCost as number,
    leadTime,
    demandRate,
    periodDemands,
    unitCost,
  };
};

export const validateProblemInterpretation = (
  interpretation: ProblemInterpretation,
): ValidationResult => {
  const normalization = normalizeProblemInterpretation(interpretation);
  return validateCanonicalEoqInput(interpretation, normalization);
};

export const validateCanonicalEoqInput = (
  interpretation: ProblemInterpretation,
  normalization: NormalizationResult,
): ValidationResult => {
  const errors: string[] = [];
  const unsupportedReasons: string[] = [];
  const warnings: string[] = [];
  const defaultsApplied: string[] = [];

  const canonicalInput = {
    ...normalization.canonicalInput,
  } satisfies CanonicalEoqInput;

  let effectiveBranch = canonicalInput.branch;
  const setupCost = canonicalInput.setupCost;
  const demandRate = canonicalInput.demandRate;
  const periodDemands = canonicalInput.periodDemands;
  const holdingCost = canonicalInput.holdingCost;

  if (setupCost !== undefined) {
    const branchFromSetup = setupCost > 0 ? 'with_setup' : 'no_setup';

    if (effectiveBranch !== branchFromSetup || interpretation.branchCandidate !== undefined && interpretation.branchCandidate !== branchFromSetup) {
      warnings.push('branch_inferred_from_setup_signal');
    }

    effectiveBranch = branchFromSetup;
  }

  if (canonicalInput.setupCostByPeriod !== undefined && effectiveBranch !== 'with_setup') {
    warnings.push('branch_inferred_from_setup_cost_by_period');
    effectiveBranch = 'with_setup';
  }

  if (
    canonicalInput.unitCostByPeriod !== undefined &&
    canonicalInput.setupCostByPeriod === undefined &&
    !(setupCost !== undefined && setupCost > 0) &&
    effectiveBranch !== 'no_setup'
  ) {
    warnings.push('branch_inferred_from_unit_cost_by_period');
    effectiveBranch = 'no_setup';
  }

  if (
    canonicalInput.unitCostByPeriod !== undefined &&
    canonicalInput.setupCostByPeriod === undefined &&
    !(setupCost !== undefined && setupCost > 0) &&
    interpretation.branchCandidate === 'with_setup' &&
    !warnings.includes('branch_inferred_from_unit_cost_by_period')
  ) {
    warnings.push('branch_inferred_from_unit_cost_by_period');
  }

  if (effectiveBranch === undefined || hasAmbiguousTaxonomy(interpretation)) {
    pushUnique(errors, 'material_branch_ambiguity');
  }

  if (interpretation.confidence < MATERIAL_CONFIDENCE_THRESHOLD) {
    pushUnique(warnings, 'low_interpretation_confidence');
  }

  if (
    (interpretation.missingCriticalFields.includes('demandRate') &&
      demandRate === undefined &&
      periodDemands === undefined) ||
    (demandRate === undefined && periodDemands === undefined)
  ) {
    pushUnique(errors, 'missing_demand_rate');
  }

  if (periodDemands !== undefined) {
    if (periodDemands.some((demand) => demand < 0)) {
      pushUnique(errors, 'invalid_demand_schedule');
    }

    if (periodDemands.every((demand) => demand === 0)) {
      pushUnique(errors, 'invalid_demand_schedule');
    }
  }

  if (
    (interpretation.missingCriticalFields.includes('holdingCost') && holdingCost === undefined) ||
    holdingCost === undefined
  ) {
    pushUnique(errors, 'missing_holding_cost');
  }

  if (demandRate !== undefined && demandRate <= 0) {
    pushUnique(errors, 'invalid_demand_rate');
  }

  if (holdingCost !== undefined && holdingCost <= 0) {
    pushUnique(errors, 'invalid_holding_cost');
  }

  if (effectiveBranch === 'with_setup') {
    if (
      (interpretation.missingCriticalFields.includes('setupCost') && setupCost === undefined) ||
      (setupCost === undefined && canonicalInput.setupCostByPeriod === undefined)
    ) {
      pushUnique(errors, 'missing_setup_cost');
    }

    if (setupCost !== undefined && setupCost <= 0) {
      pushUnique(errors, 'invalid_setup_cost');
    }
  }

  if (setupCost !== undefined && canonicalInput.setupCostByPeriod !== undefined) {
    pushUnique(errors, 'conflicting_setup_cost_scalar_and_series');
  }

  if (canonicalInput.unitCost !== undefined && canonicalInput.unitCostByPeriod !== undefined) {
    pushUnique(errors, 'conflicting_unit_cost_scalar_and_series');
  }

  if (canonicalInput.setupCostByPeriod !== undefined && periodDemands !== undefined) {
    if (canonicalInput.setupCostByPeriod.length !== periodDemands.length) {
      pushUnique(errors, 'invalid_setup_cost_by_period_length');
    }

    if (canonicalInput.setupCostByPeriod.some((value) => value <= 0)) {
      pushUnique(errors, 'invalid_setup_cost_by_period');
    }
  }

  if (canonicalInput.unitCostByPeriod !== undefined && periodDemands !== undefined) {
    if (canonicalInput.unitCostByPeriod.length !== periodDemands.length) {
      pushUnique(errors, 'invalid_unit_cost_by_period_length');
    }

    if (canonicalInput.unitCostByPeriod.some((value) => value < 0)) {
      pushUnique(errors, 'invalid_unit_cost_by_period');
    }
  }

  if (canonicalInput.variant === 'setup_by_period' && effectiveBranch === 'no_setup') {
    pushUnique(errors, 'conflicting_setup_and_no_setup_cost_structure');
  }

  if (canonicalInput.variant === 'unit_cost_by_period' && effectiveBranch === 'with_setup') {
    pushUnique(errors, 'conflicting_setup_and_no_setup_cost_structure');
  }

  if (
    effectiveBranch === 'no_setup' &&
    setupCost !== undefined &&
    setupCost > 0 &&
    (canonicalInput.unitCostByPeriod !== undefined || canonicalInput.unitCost !== undefined)
  ) {
    pushUnique(errors, 'conflicting_setup_and_no_setup_cost_structure');
  }

  let leadTime = canonicalInput.leadTime;

  if (leadTime === undefined) {
    leadTime = 0;
    defaultsApplied.push('lead_time=0');
    warnings.push('lead_time_defaulted_to_zero');
  }

  if (leadTime < 0) {
    pushUnique(errors, 'invalid_lead_time');
  }

  for (const issue of interpretation.issues) {
    const normalized = issue.toLowerCase();

    if (normalized.includes('negative demand')) pushUnique(errors, 'invalid_demand_rate');
    if (normalized.includes('negative holding')) pushUnique(errors, 'invalid_holding_cost');
    if (normalized.includes('negative setup')) pushUnique(errors, 'invalid_setup_cost');
    if (normalized.includes('incompatible') || normalized.includes('conflict')) {
      pushUnique(errors, 'incompatible_units_or_time_basis');
    }
  }

  const hasInvalidErrors = errors.some(
    (error) =>
      error.startsWith('invalid_') ||
      error.includes('incompatible') ||
      error.includes('conflicting_'),
  );
  const hasClarifyErrors = errors.some(
    (error) => error.startsWith('missing_') || error === 'material_branch_ambiguity',
  );
  const branch = effectiveBranch;

  const normalizedInput =
    !hasInvalidErrors &&
    !hasClarifyErrors &&
    unsupportedReasons.length === 0 &&
    branch !== undefined &&
    (demandRate !== undefined || periodDemands !== undefined) &&
    holdingCost !== undefined &&
    leadTime !== undefined
      ? buildSolverInput({ ...canonicalInput, branch, holdingCost, leadTime })
      : undefined;

  const disposition = hasInvalidErrors ? 'invalid' : hasClarifyErrors ? 'clarify' : 'valid';

  return ValidationResultSchema.parse({
    ok: disposition === 'valid' && unsupportedReasons.length === 0,
    disposition,
    canonicalInput: {
      ...canonicalInput,
      branch,
      leadTime,
    },
    normalizedInput,
    errors,
    unsupportedReasons,
    warnings,
    defaultsApplied,
  });
};
