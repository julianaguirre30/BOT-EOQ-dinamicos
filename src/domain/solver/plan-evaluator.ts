import { SolverInput, SolverOutput } from '../../contracts/eoq';

export type CustomPlanEvaluation = {
  feasible: boolean;
  reason?: string;
  ordersPerPeriod: number[];
  numberOfOrders: number;
  setupCostTotal: number;
  holdingCostTotal: number;
  totalRelevantCost: number;
  endingInventoryByPeriod: number[];
  vsOptimal: {
    optimalCost: number;
    deltaCost: number;
    deltaPercent: number;
  };
};

const round = (value: number, digits = 2): number => Number(value.toFixed(digits));

/**
 * Evalúa el costo de un plan ALTERNATIVO propuesto por el estudiante.
 *
 * `ordersPerPeriod[i]` = cantidad pedida al inicio del periodo i+1.
 * El cálculo asume el mismo costo fijo (si lo hay) y el mismo costo de
 * retención del problema en curso. Si el plan deja stock negativo en algún
 * periodo, se marca como infactible.
 */
export const evaluateCustomPlan = (
  solverInput: SolverInput,
  solverOutput: SolverOutput,
  ordersPerPeriod: number[],
): CustomPlanEvaluation => {
  const demandSchedule = solverInput.periodDemands ?? [];
  const n = demandSchedule.length;

  if (ordersPerPeriod.length !== n) {
    return {
      feasible: false,
      reason: `El plan alternativo tiene ${ordersPerPeriod.length} periodos pero el problema tiene ${n}.`,
      ordersPerPeriod,
      numberOfOrders: 0,
      setupCostTotal: 0,
      holdingCostTotal: 0,
      totalRelevantCost: 0,
      endingInventoryByPeriod: [],
      vsOptimal: { optimalCost: 0, deltaCost: 0, deltaPercent: 0 },
    };
  }

  const holdingCost = solverInput.holdingCost ?? 0;
  const setupCost =
    solverInput.branch === 'with_setup'
      ? (solverInput as Extract<SolverInput, { branch: 'with_setup'; variant: 'scalar' }>).setupCost
      : 0;

  let onHand = solverInput.initialInventory ?? 0;
  const endingInventoryByPeriod: number[] = [];
  let holdingCostTotal = 0;
  let numberOfOrders = 0;
  let setupCostTotal = 0;

  for (let i = 0; i < n; i += 1) {
    const order = ordersPerPeriod[i];
    if (order > 0) {
      numberOfOrders += 1;
      setupCostTotal += setupCost;
    }
    onHand += order - demandSchedule[i];
    if (onHand < -1e-9) {
      return {
        feasible: false,
        reason: `Faltante en el periodo ${i + 1}: el inventario disponible no cubre la demanda.`,
        ordersPerPeriod,
        numberOfOrders,
        setupCostTotal: round(setupCostTotal),
        holdingCostTotal: round(holdingCostTotal),
        totalRelevantCost: round(setupCostTotal + holdingCostTotal),
        endingInventoryByPeriod,
        vsOptimal: { optimalCost: 0, deltaCost: 0, deltaPercent: 0 },
      };
    }
    endingInventoryByPeriod.push(round(onHand));
    if (i < n - 1) holdingCostTotal += onHand * holdingCost;
  }

  const totalRelevantCost = setupCostTotal + holdingCostTotal;
  const optimalCost = solverOutput.mathematicalArtifacts.costBreakdown.totalRelevantCost;
  const deltaCost = totalRelevantCost - optimalCost;
  const deltaPercent = optimalCost > 0 ? (deltaCost / optimalCost) * 100 : 0;

  return {
    feasible: true,
    ordersPerPeriod,
    numberOfOrders,
    setupCostTotal: round(setupCostTotal),
    holdingCostTotal: round(holdingCostTotal),
    totalRelevantCost: round(totalRelevantCost),
    endingInventoryByPeriod,
    vsOptimal: {
      optimalCost: round(optimalCost),
      deltaCost: round(deltaCost),
      deltaPercent: round(deltaPercent, 1),
    },
  };
};

export const formatPlanEvaluation = (evaluation: CustomPlanEvaluation): string => {
  if (!evaluation.feasible) {
    return `\n\n📊 **Plan alternativo NO factible**\n${evaluation.reason}`;
  }

  const ordersList = evaluation.ordersPerPeriod
    .map((q, i) => `período ${i + 1}: ${q}`)
    .join(', ');

  const { optimalCost, deltaCost, deltaPercent } = evaluation.vsOptimal;
  const diffLine =
    deltaCost === 0
      ? `Mismo costo que el plan óptimo.`
      : deltaCost > 0
        ? `**${deltaCost} más caro** que el óptimo (+${deltaPercent}%).`
        : `**${Math.abs(deltaCost)} más barato** que el óptimo (${deltaPercent}%).`;

  return [
    '',
    '📊 **Comparación con el plan óptimo**',
    `Plan propuesto: ${ordersList}`,
    `Costo fijo: ${evaluation.setupCostTotal} · Almacenamiento: ${evaluation.holdingCostTotal} · Total: **${evaluation.totalRelevantCost}**`,
    `Plan óptimo: ${optimalCost}`,
    diffLine,
  ].join('\n');
};
