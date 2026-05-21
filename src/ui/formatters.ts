import { PublicResponseEnvelope, SolverInput } from '../contracts/eoq';
import { DetectedDatum } from './types';

/**
 * Aliases for common parameter names across different data sources
 */
export const VALUE_ALIASES = {
  demandRate: ['demandRate', 'annualDemand', 'demand', 'demandPerPeriod', 'D'],
  periodDemands: ['periodDemands', 'demandSchedule', 'demand', 'weeklyDemand', 'demands'],
  holdingCost: ['holdingCost', 'holdingCostPerUnitPerYear', 'unitHoldingCost', 'h'],
  setupCost: ['setupCost', 'orderingCost', 'orderCost', 'S', 'K'],
  unitCost: ['unitCost', 'purchaseCost', 'productionCost', 'c'],
  unitCostByPeriod: ['unitCostByPeriod', 'purchaseCostByPeriod', 'productionCostByPeriod', 'purchaseCost', 'productionCost'],
} as const;

/**
 * Describe the identified EOQ branch (with_setup vs no_setup)
 */
export const describeBranch = (branch?: SolverInput['branch'] | PublicResponseEnvelope['interpretation']['branchCandidate']) => {
  if (branch === 'with_setup') {
    return 'EOQ determinístico con costo fijo de preparación/pedido';
  }

  if (branch === 'no_setup') {
    return 'EOQ determinístico sin costo fijo de preparación/pedido';
  }

  return 'Pendiente de confirmación';
};

/**
 * Describe the solver algorithm family (exact_with_setup, exact_no_setup, etc.)
 */
export const describeSolverFamily = (response: PublicResponseEnvelope) => {
  if (response.algorithmSelection.solverFamily === 'exact_with_setup') {
    return 'Programación dinámica exacta';
  }

  if (response.algorithmSelection.solverFamily === 'exact_no_setup') {
    return response.solverInput?.variant === 'unit_cost_by_period'
      ? 'Programación dinámica exacta sin setup con costo unitario por período'
      : 'Política exacta lote-por-lote';
  }

  return 'Todavía no aplica';
};

/**
 * Human-readable explanation for validation error codes
 */
export const humanizeValidationReason = (value: string): string => {
  switch (value) {
    case 'missing_demand_rate':
      return 'Falta la demanda o el cronograma de demandas.';
    case 'missing_holding_cost':
      return 'Falta el costo de mantener inventario.';
    case 'missing_setup_cost':
      return 'Falta el costo fijo de preparación/pedido.';
    case 'invalid_demand_rate':
    case 'invalid_demand_schedule':
      return 'La demanda informada no es válida para resolver.';
    case 'invalid_holding_cost':
      return 'El costo de mantener debe ser positivo.';
    case 'invalid_setup_cost':
      return 'El costo fijo debe ser positivo.';
    case 'invalid_setup_cost_by_period':
      return 'Los costos de preparación por período deben ser positivos.';
    case 'invalid_setup_cost_by_period_length':
      return 'La cantidad de costos de preparación por período no coincide con la demanda.';
    case 'invalid_unit_cost_by_period':
      return 'Los costos unitarios por período no pueden ser negativos.';
    case 'invalid_unit_cost_by_period_length':
      return 'La cantidad de costos unitarios por período no coincide con la demanda.';
    case 'incompatible_units_or_time_basis':
      return 'Hay unidades o bases de tiempo incompatibles.';
    case 'conflicting_setup_and_no_setup_cost_structure':
      return 'Hay una mezcla incompatible entre setup positivo y una formulación solo sin setup.';
    default:
      return value.replaceAll('_', ' ');
  }
};

/**
 * Build attention panel (missing data, validation errors, clarifications)
 */
export const buildAttentionPanel = (response: PublicResponseEnvelope): {
  title: string;
  items: string[];
  emptyMessage: string;
} => {
  if (response.mode === 'refuse') {
    if (response.refusal?.kind === 'out_of_domain') {
      return {
        title: 'Alcance del caso',
        items: [response.refusal.message],
        emptyMessage: 'No corresponde pedir datos adicionales para este caso.',
      };
    }

    if (response.refusal?.kind === 'invalid_input') {
      return {
        title: 'Datos a corregir',
        items: response.refusal.reasons.map(humanizeValidationReason),
        emptyMessage: 'No hay datos faltantes: hay que corregir inconsistencias.',
      };
    }

    return {
      title: 'Estado de implementación',
      items: response.refusal ? [response.refusal.message] : [],
      emptyMessage: 'No hay datos faltantes para mostrar.',
    };
  }

  if (response.mode === 'clarify' && response.clarificationRequest?.reason !== 'missing_critical') {
    const clarificationRequest = response.clarificationRequest;

    return {
      title: 'Puntos a aclarar',
      items:
        clarificationRequest && clarificationRequest.requiredFields.length > 0
          ? clarificationRequest.requiredFields
          : clarificationRequest
            ? [clarificationRequest.question]
            : [],
      emptyMessage: 'No hay datos faltantes críticos cargados todavía.',
    };
  }

  return {
    title: 'Datos faltantes',
    items: response.clarificationRequest?.requiredFields ?? response.interpretation.missingCriticalFields,
    emptyMessage: 'No faltan datos críticos.',
  };
};

/**
 * Determine the most relevant cost label based on solver variant
 */
export const buildRelevantCostLabel = (response: PublicResponseEnvelope): string => {
  if (response.solverInput?.branch === 'with_setup') {
    return 'Costo fijo total';
  }

  if (response.solverInput?.variant === 'unit_cost_by_period' || response.solverInput?.unitCost !== undefined) {
    return 'Costo de compra/producción total';
  }

  return 'Costo relevante sin setup';
};

/**
 * Format any value to string (handles arrays specially)
 */
export const formatValue = (value: unknown): string => (Array.isArray(value) ? `[${value.join(', ')}]` : String(value));

/**
 * Get first matching value from payload using alias list
 */
export const getFirstAliasValue = (payload: Record<string, unknown>, aliases: readonly string[]) => {
  for (const alias of aliases) {
    if (payload[alias] !== undefined) {
      return payload[alias];
    }
  }

  return undefined;
};

/**
 * Build detected data table rows from solver response
 */
export const buildDetectedData = (response: PublicResponseEnvelope): DetectedDatum[] => {
  const extracted = response.interpretation.extractedValues;
  const normalized = response.validation?.normalizedInput ?? response.solverInput;
  const items: DetectedDatum[] = [];

  const addDatum = (label: string, value: unknown) => {
    if (value === undefined) {
      return;
    }

    items.push({ label, value: formatValue(value) });
  };

  addDatum('Demanda por períodos', normalized?.periodDemands ?? getFirstAliasValue(extracted, VALUE_ALIASES.periodDemands));
  addDatum('Demanda agregada', normalized?.demandRate ?? getFirstAliasValue(extracted, VALUE_ALIASES.demandRate));
  addDatum('Costo de mantener', normalized?.holdingCost ?? getFirstAliasValue(extracted, VALUE_ALIASES.holdingCost));
  if (normalized?.branch === 'with_setup') {
    addDatum(
      'Costo fijo de preparación/pedido',
      normalized.variant === 'setup_by_period'
        ? normalized.setupCostByPeriod
        : normalized.setupCost ?? getFirstAliasValue(extracted, VALUE_ALIASES.setupCost),
    );
  } else if (normalized?.variant === 'unit_cost_by_period') {
    addDatum(
      'Costo unitario por período',
      normalized.unitCostByPeriod ?? getFirstAliasValue(extracted, VALUE_ALIASES.unitCostByPeriod),
    );
  } else {
    addDatum('Costo unitario', normalized?.unitCost ?? getFirstAliasValue(extracted, VALUE_ALIASES.unitCost));
  }

  return items;
};
