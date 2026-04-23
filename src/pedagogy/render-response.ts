import {
  AlgorithmSelectionTrace,
  FinalResponseEnvelope,
  FinalResponseEnvelopeSchema,
  PedagogicalArtifacts,
  ProblemInterpretation,
  RoutingResult,
  SolverInput,
  SolverOutput,
} from '../contracts/eoq';

const describeBranch = (branch: SolverInput['branch']): string =>
  branch === 'with_setup'
    ? 'EOQ determinístico con costo fijo de preparación/pedido'
    : 'EOQ determinístico sin costo fijo de preparación/pedido';

const describeSolverFamily = (solverFamily: SolverOutput['solverFamily']): string =>
  solverFamily === 'exact_with_setup'
    ? 'programación dinámica exacta para lot-sizing determinístico'
    : 'política exacta lote-por-lote sin setup';

const describeSolvedAlgorithm = (solverInput: SolverInput, solverOutput: SolverOutput): string => {
  if (solverOutput.solverFamily === 'exact_with_setup') {
    return 'programación dinámica exacta para lot-sizing determinístico';
  }

  return solverInput.variant === 'unit_cost_by_period'
    ? 'programación dinámica exacta sin setup con costo unitario por período'
    : 'política exacta lote-por-lote sin setup';
};

const describeBlockedModel = (routingResult: RoutingResult): string => {
  if (routingResult.refusal?.kind === 'invalid_input') {
    return 'Todavía no hay un modelo matemático resoluble porque los datos validados son inconsistentes o inválidos.';
  }

  if (routingResult.refusal?.kind === 'out_of_domain') {
    return 'No corresponde consolidar un modelo EOQ resoluble del MVP porque el caso quedó fuera de alcance.';
  }

  if (routingResult.clarificationRequest?.reason === 'material_ambiguity') {
    return 'Todavía no hay un modelo matemático resoluble porque falta confirmar la variante material del problema.';
  }

  if (routingResult.clarificationRequest?.reason === 'low_confidence') {
    return 'Todavía no hay un modelo matemático resoluble porque la interpretación necesita confirmación antes de validar el caso.';
  }

  return 'Todavía no hay un modelo matemático resoluble porque falta validar datos críticos.';
};

const describeBlockedFlow = (routingResult: RoutingResult): string => {
  if (routingResult.refusal?.kind === 'invalid_input') {
    return 'El flujo se frenó antes del solver porque detectó inconsistencias o valores imposibles en los datos.';
  }

  if (routingResult.refusal?.kind === 'out_of_domain') {
    return 'El flujo se frenó antes del solver porque el caso queda fuera del alcance del MVP.';
  }

  return describeClarification(routingResult);
};

const humanizeDefault = (value: string): string => {
  if (value === 'lead_time=0') {
    return 'Se tomó lead time = 0 porque el enunciado no daba otro valor.';
  }

  return `Se aplicó el supuesto visible: ${value}.`;
};

const humanizeValidationError = (value: string): string => {
  switch (value) {
    case 'missing_demand_rate':
      return 'falta la demanda o el cronograma de demandas';
    case 'missing_holding_cost':
      return 'falta el costo de mantener inventario';
    case 'missing_setup_cost':
      return 'falta el costo fijo de preparación/pedido';
    case 'invalid_demand_rate':
    case 'invalid_demand_schedule':
      return 'la demanda informada no es válida para resolver';
    case 'invalid_holding_cost':
      return 'el costo de mantener debe ser positivo';
    case 'invalid_setup_cost':
      return 'el costo fijo debe ser positivo';
    case 'invalid_setup_cost_by_period':
      return 'los costos de preparación por período deben ser positivos';
    case 'invalid_setup_cost_by_period_length':
      return 'la cantidad de costos de preparación por período no coincide con la demanda';
    case 'invalid_unit_cost_by_period':
      return 'los costos unitarios por período no pueden ser negativos';
    case 'invalid_unit_cost_by_period_length':
      return 'la cantidad de costos unitarios por período no coincide con la demanda';
    case 'invalid_lead_time':
      return 'el lead time no puede ser negativo';
    case 'incompatible_units_or_time_basis':
      return 'hay unidades o bases de tiempo incompatibles';
    case 'conflicting_setup_and_no_setup_cost_structure':
      return 'hay una mezcla incompatible entre setup positivo y una formulación solo sin setup';
    case 'conflicting_setup_cost_scalar_and_series':
      return 'no se puede mezclar un setup escalar con setup por período en el mismo caso';
    case 'conflicting_unit_cost_scalar_and_series':
      return 'no se puede mezclar un costo unitario escalar con costos unitarios por período en el mismo caso';
    case 'setup_cost_by_period_requires_future_solver':
      return 'la variante con setup por período ya se reconoció pero su solver todavía no está implementado';
    case 'unit_cost_by_period_requires_future_solver':
      return 'la variante con costo unitario por período ya se reconoció pero su solver todavía no está implementado';
    case 'material_branch_ambiguity':
      return 'todavía no está claro si el caso va con setup o sin setup';
    default:
      return value.replaceAll('_', ' ');
  }
};

const describeClarification = (routingResult: RoutingResult): string => {
  switch (routingResult.clarificationRequest?.reason) {
    case 'missing_critical':
      return 'El flujo quedó en pausa porque falta al menos un dato crítico para armar el modelo.';
    case 'material_ambiguity':
      return 'El flujo quedó en pausa porque todavía hay una ambigüedad material en el tipo de problema.';
    case 'low_confidence':
      return 'El flujo quedó en pausa porque la interpretación todavía necesita confirmación.';
    case 'out_of_domain':
      return 'El caso se frenó porque queda fuera del alcance del MVP.';
    default:
      return 'El flujo quedó en pausa antes de invocar un solver.';
  }
};

const formatPlanLine = (period: number, quantity: number, coversThroughPeriod: number): string =>
  coversThroughPeriod === period
    ? `Período ${period}: reponer ${quantity} unidades para cubrir solo ese período.`
    : `Período ${period}: reponer ${quantity} unidades para cubrir desde ${period} hasta ${coversThroughPeriod}.`;

const buildPlanSummary = (solverOutput: SolverOutput): string[] => {
  const planLines = solverOutput.policy.replenishmentPlan.map((step) =>
    formatPlanLine(step.period, step.quantity, step.coversThroughPeriod),
  );

  return [
    `Plan completo de reposición: ${planLines.join(' ')}`,
    `Se programan ${solverOutput.policy.replenishmentPlan.length} pedido(s)/lote(s) en el horizonte.`,
  ];
};

const summarizeDetectedDemand = (solverInput?: SolverInput): string => {
  if (!solverInput) {
    return 'Todavía no hay un modelo matemático resoluble porque falta validar datos críticos.';
  }

  if (solverInput.periodDemands !== undefined) {
    return `Horizonte determinístico por períodos: [${solverInput.periodDemands.join(', ')}].`;
  }

  return `Demanda agregada usada por ahora: ${solverInput.demandRate}.`;
};

const buildSolvedPedagogy = (
  interpretation: ProblemInterpretation,
  algorithmSelection: AlgorithmSelectionTrace,
  routingResult: RoutingResult,
  solverInput: SolverInput,
  solverOutput: SolverOutput,
): PedagogicalArtifacts => ({
  interpretation: [
    `Interpreté el caso como ${describeBranch(solverInput.branch)}.`,
    summarizeDetectedDemand(solverInput),
    `Confianza declarada de interpretación: ${interpretation.confidence}.`,
  ],
  model: [
    'Modelo: inventario determinístico de un solo ítem, sin faltantes y con costos de mantener inventario.',
    solverInput.branch === 'with_setup'
      ? 'Se incluye costo fijo de preparación/pedido, así que conviene optimizar agrupando períodos solo cuando el trade-off lo justifica.'
      : 'No hay costo fijo de preparación/pedido, así que el modelo exacto evita stock innecesario y repone solo lo que se consume en cada período.',
    `Holding cost usado: ${solverInput.holdingCost}. Lead time visible: ${solverInput.leadTime}.`,
  ],
  algorithm: [
    `Se resolvió con ${describeSolvedAlgorithm(solverInput, solverOutput)}.`,
    solverInput.branch === 'with_setup'
      ? 'El algoritmo evalúa, para cada período, hasta dónde conviene extender un lote comparando costo fijo hoy versus costo de mantener inventario para períodos futuros.'
      : solverInput.variant === 'unit_cost_by_period'
        ? 'Como no hay setup pero sí costos unitarios que cambian por período, el algoritmo puede anticipar compras cuando el ahorro unitario compensa exactamente el costo de mantener inventario.'
        : 'Como no hay costo fijo de pedido/preparación, la política exacta repone únicamente lo que se consume en cada período para evitar stock innecesario.',
    solverOutput.comparison
      ? 'Silver-Meal se adjunta únicamente como comparación pedagógica, no como autoridad de decisión.'
      : 'No se adjuntó comparación Silver-Meal porque no agrega valor en este caso.',
  ],
  result: [
    ...buildPlanSummary(solverOutput),
    `Costo relevante total del plan exacto: ${solverOutput.mathematicalArtifacts.costBreakdown.totalRelevantCost}.`,
  ],
  procedure: [
    '1. Validé el caso y fijé la rama exacta sin depender del LLM.',
    '2. Normalicé la demanda determinística del horizonte.',
    solverInput.branch === 'with_setup'
      ? '3. Ejecuté programación dinámica estilo Wagner-Whitin para decidir hasta qué período conviene cubrir cada pedido.'
      : solverInput.variant === 'unit_cost_by_period'
        ? '3. Ejecuté la política exacta sin setup con costo unitario por período: para cada demanda elegí de forma determinística el período de compra con menor costo relevante.'
        : '3. Ejecuté la política exacta sin setup: reponer demanda período a período para no cargar inventario.',
    '4. Reconstruí el plan de reposición y el costo relevante.',
  ],
  justification: [
    `La formulación elegida fue ${describeBranch(solverInput.branch)} porque coincide con los datos validados del enunciado.`,
    solverInput.branch === 'with_setup'
      ? 'Con setup positivo, el problema exacto es de lot-sizing determinístico y la solución óptima surge de comparar costos de preparar ahora vs. mantener inventario.'
      : solverInput.variant === 'unit_cost_by_period'
        ? 'Sin setup y con costo unitario variable por período, la solución exacta puede agrupar compras antes si el ahorro unitario supera el costo de mantener inventario; por eso no siempre coincide con lote-por-lote.'
        : 'Sin setup, mantener inventario antes de tiempo solo agrega costo, por eso la solución exacta coincide con lote-por-lote.',
    routingResult.validation.defaultsApplied.length > 0
      ? routingResult.validation.defaultsApplied.map(humanizeDefault).join(' ')
      : 'No hicieron falta defaults visibles para resolver.',
  ],
});

const buildBlockedPedagogy = (
  interpretation: ProblemInterpretation,
  routingResult: RoutingResult,
): PedagogicalArtifacts => ({
  interpretation: [
    `Interpretación preliminar con confianza ${interpretation.confidence}.`,
    `Estado de dominio: ${routingResult.domainStatus}.`,
  ],
  model: [
    'Todavía no se consolidó un modelo matemático resoluble del MVP.',
    describeBlockedModel(routingResult),
    ...(routingResult.validation.normalizedInput
      ? [summarizeDetectedDemand(routingResult.validation.normalizedInput)]
      : []),
  ],
  algorithm: [
    describeBlockedFlow(routingResult),
    routingResult.validation.warnings.length > 0
      ? `Advertencias visibles: ${routingResult.validation.warnings.join(', ')}.`
      : 'No hubo advertencias adicionales para mostrar.',
  ],
  result: [
    routingResult.decision === 'refuse'
      ? 'Resultado: el caso fue rechazado antes del solver.'
      : 'Resultado: el caso queda pausado hasta aclarar/corregir los datos críticos.',
  ],
  procedure: [
    '1. Se interpretó el enunciado libre.',
    '2. Se aplicó validación conservadora y gating de dominio.',
    '3. El flujo frenó antes de invocar cualquier solver.',
  ],
  justification: [
    routingResult.refusal?.message ??
      routingResult.clarificationRequest?.question ??
      'Hace falta revisar el planteo antes de continuar.',
    routingResult.refusal
      ? `Motivos del rechazo: ${routingResult.refusal.reasons.map(humanizeValidationError).join(', ')}.`
      : routingResult.validation.errors.length > 0
        ? `Puntos a corregir o aclarar: ${routingResult.validation.errors.map(humanizeValidationError).join(', ')}.`
        : 'No hubo errores numéricos, pero sí una condición de gating que exige aclaración.',
  ],
});

export const assembleStudyResponse = ({
  interpretation,
  routingResult,
  algorithmSelection,
  solverInput,
  solverOutput,
}: {
  interpretation: ProblemInterpretation;
  routingResult: RoutingResult;
  algorithmSelection?: AlgorithmSelectionTrace;
  solverInput?: SolverInput;
  solverOutput?: SolverOutput;
}): FinalResponseEnvelope => {
  const solved = routingResult.decision === 'solve' && solverInput && solverOutput;
  const resolvedAlgorithmSelection = algorithmSelection ?? routingResult.trace;
  const pedagogicalArtifacts = solved
    ? buildSolvedPedagogy(interpretation, resolvedAlgorithmSelection, routingResult, solverInput, solverOutput)
    : buildBlockedPedagogy(interpretation, routingResult);

  return FinalResponseEnvelopeSchema.parse({
    mode: solved ? 'solved' : routingResult.decision === 'refuse' ? 'refuse' : 'clarify',
    studentMessage: solved
      ? `Resolví el caso como ${describeBranch(solverOutput.branch)} y te dejo el plan completo con la explicación para estudiar.`
      : routingResult.refusal?.message ??
        routingResult.clarificationRequest?.question ??
        'Este caso no puede resolverse todavía dentro del MVP.',
    interpretation,
    normalization: routingResult.normalization,
    validation: routingResult.validation,
    clarificationRequest: routingResult.clarificationRequest,
    refusal: routingResult.refusal,
    solverInput,
    solverOutput,
    algorithmSelection: resolvedAlgorithmSelection,
    pedagogicalArtifacts,
    internalTrace: resolvedAlgorithmSelection,
  });
};
