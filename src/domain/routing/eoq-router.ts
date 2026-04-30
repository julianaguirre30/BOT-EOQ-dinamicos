import {
  AlgorithmSelectionTrace,
  ClarificationReason,
  ClarificationRequest,
  NormalizationResult,
  ProblemInterpretation,
  Refusal,
  RefusalKind,
  RoutingResult,
  RoutingResultSchema,
  ThreadContext,
  ValidationResult,
} from '../../contracts/eoq';
import { MATERIAL_CONFIDENCE_THRESHOLD, classifyMvpDomain } from '../knowledge/eoq-taxonomy';
import { normalizeProblemInterpretation } from '../normalization/eoq-normalizer';
import { validateCanonicalEoqInput } from '../validation/eoq-validator';

const buildClarification = (
  reason: ClarificationReason,
  question: string,
  requiredFields: string[] = [],
): ClarificationRequest => ({
  reason,
  question,
  requiredFields,
});

const createRefusalResult = (
  normalization: NormalizationResult,
  validation: ValidationResult,
  refusal: Refusal,
  why: string[],
  domainStatus: 'in_domain' | 'out_of_domain' = 'in_domain',
): RoutingResult =>
  RoutingResultSchema.parse({
    decision: 'refuse',
    solvable: false,
    domainStatus,
    normalization,
    validation,
    refusal,
    trace: {
      decision: 'refuse',
      silverMealIncluded: false,
      why,
    },
  });

const createAskResult = (
  normalization: NormalizationResult,
  validation: ValidationResult,
  reason: ClarificationReason,
  question: string,
  requiredFields: string[],
  why: string[],
): RoutingResult =>
  RoutingResultSchema.parse({
    decision: 'ask',
    solvable: false,
    domainStatus: 'in_domain',
    normalization,
    validation,
    clarificationRequest: buildClarification(reason, question, requiredFields),
    trace: {
      decision: 'ask',
      silverMealIncluded: false,
      why,
    },
  });

const isInvalidValidationError = (error: string): boolean =>
  error.startsWith('invalid_') || error.includes('incompatible') || error.includes('conflicting_');

const createSolveTrace = (validation: ValidationResult): AlgorithmSelectionTrace => {
  const branch = validation.normalizedInput?.branch;
  const variant = validation.normalizedInput?.variant ?? validation.canonicalInput.variant;

  return {
    decision: 'solve',
    chosenBranch: branch,
    solverFamily: branch === 'with_setup' ? 'exact_with_setup' : 'exact_no_setup',
    silverMealIncluded: false,
    why: [
      `validated_branch:${branch}`,
      `validated_variant:${variant}`,
      'single_item_deterministic_eoq',
      'exact_solver_is_optimization_authority',
      'silver_meal_only_optional_pedagogical_comparison',
    ],
  };
};

export const routeProblemInterpretation = (interpretation: ProblemInterpretation): RoutingResult => {
  const domain = classifyMvpDomain(interpretation);
  const normalization = normalizeProblemInterpretation(interpretation);
  const validation = validateCanonicalEoqInput(interpretation, normalization);

  return routeProblemInterpretationWithValidation(interpretation, validation, domain, normalization);
};

export const routeProblemInterpretationWithValidation = (
  interpretation: ProblemInterpretation,
  validation: ValidationResult,
  domain = classifyMvpDomain(interpretation),
  normalization = normalizeProblemInterpretation(interpretation),
  _threadContext?: ThreadContext,
): RoutingResult => {
  const invalidReasons = validation.errors.filter(isInvalidValidationError);

  if (!domain.inDomain) {
    return createRefusalResult(
      normalization,
      validation,
      buildRefusal(
        'out_of_domain',
        domain.reasons,
        'Ese caso queda fuera del MVP: solo cubrimos EOQ determinístico estándar, de un solo ítem y sin faltantes.',
      ),
      ['mvp_domain_gate_blocked', ...domain.reasons],
      'out_of_domain',
    );
  }

  if (invalidReasons.length > 0) {
    return createRefusalResult(
      normalization,
      validation,
      buildRefusal(
        'invalid_input',
        invalidReasons,
        'Hay datos inconsistentes o imposibles en el planteo; corregilos antes de intentar resolverlo.',
      ),
      ['input_inconsistency_detected', ...invalidReasons],
    );
  }

  if (validation.errors.includes('material_branch_ambiguity')) {
    return createAskResult(
      normalization,
      validation,
      'material_ambiguity',
      'Necesito saber si el costo fijo corresponde a preparación interna o a pedido/reposición sin setup.',
      ['branch'],
      ['branch_is_materially_ambiguous'],
    );
  }

  const missingCritical = validation.errors.filter((error) => error.startsWith('missing_'));
  if (missingCritical.length > 0) {
    return createAskResult(
      normalization,
      validation,
      'missing_critical',
      'Falta al menos un dato crítico antes de resolver el EOQ.',
      missingCritical.map((error) => error.replace('missing_', '')),
      ['missing_critical_data', ...missingCritical],
    );
  }

  if (validation.unsupportedReasons.length > 0) {
    return createRefusalResult(
      normalization,
      validation,
      buildRefusal(
        'unsupported_variant',
        validation.unsupportedReasons,
        'Reconocí la formulación, pero esta variante todavía no tiene solver determinístico implementado en esta etapa.',
      ),
      ['recognized_but_not_implemented_yet', ...validation.unsupportedReasons],
    );
  }

  if (interpretation.confidence < MATERIAL_CONFIDENCE_THRESHOLD) {
    return createAskResult(
      normalization,
      validation,
      'low_confidence',
      'La interpretación quedó con baja confianza; confirmame el enunciado o los datos clave antes de seguir.',
      interpretation.missingCriticalFields,
      ['low_confidence_requires_confirmation'],
    );
  }

  return RoutingResultSchema.parse({
    decision: 'solve',
    solvable: true,
    domainStatus: 'in_domain',
    normalization,
    validation,
    trace: createSolveTrace(validation),
  });
};

function buildRefusal(kind: RefusalKind, reasons: string[], message: string): Refusal {
  return {
  kind,
  reasons: reasons.length > 0 ? reasons : [kind],
  message,
  };
}
