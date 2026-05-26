import { SolverInput, SolverOutput, SolverOutputSchema } from '../../contracts/eoq';

type ReplenishmentPlanEntry = SolverOutput['policy']['replenishmentPlan'][number];

const round = (value: number, digits = 4): number => Number(value.toFixed(digits));

export const toDemandSchedule = (input: SolverInput): number[] => {
  if (input.periodDemands !== undefined) {
    return [...input.periodDemands];
  }

  return [input.demandRate as number];
};

/**
 * Descuenta el inventario inicial de las demandas en cascada.
 * El stock cubre primero el período 1, luego el 2, etc.
 * Ejemplo: demands=[200,150,180,220], I₀=50 → [150,150,180,220]
 */
export const adjustDemandsForInitialInventory = (
  demands: number[],
  initialInventory: number,
): number[] => {
  let remaining = initialInventory;
  return demands.map((d) => {
    const net  = Math.max(0, d - remaining);
    remaining  = Math.max(0, remaining - d);
    return net;
  });
};

const buildEndingInventory = (
  demandSchedule: number[],
  replenishmentPlan: ReplenishmentPlanEntry[],
  initialInventory = 0,
): number[] => {
  const endingInventoryByPeriod: number[] = [];
  let onHand = initialInventory;

  for (let periodIndex = 0; periodIndex < demandSchedule.length; periodIndex += 1) {
    const period = periodIndex + 1;
    const lot = replenishmentPlan.find((entry) => entry.period === period);

    if (lot) {
      onHand += lot.quantity;
    }

    onHand -= demandSchedule[periodIndex];
    endingInventoryByPeriod.push(round(onHand));
  }

  return endingInventoryByPeriod;
};

const buildCostBreakdown = (
  demandSchedule: number[],
  replenishmentPlan: ReplenishmentPlanEntry[],
  setupOrOrderingCostForLot: (lot: ReplenishmentPlanEntry) => number,
  holdingCostPerUnitPeriod: number,
) => {
  let setupOrOrderingCost = 0;
  let holdingCost = 0;

  for (const lot of replenishmentPlan) {
    setupOrOrderingCost += setupOrOrderingCostForLot(lot);

    let inventoryLeft = lot.quantity;
    for (let period = lot.period; period <= lot.coversThroughPeriod; period += 1) {
      inventoryLeft -= demandSchedule[period - 1];
      if (period < lot.coversThroughPeriod) {
        holdingCost += inventoryLeft * holdingCostPerUnitPeriod;
      }
    }
  }

  return {
    setupOrOrderingCost: round(setupOrOrderingCost),
    holdingCost: round(holdingCost),
    totalRelevantCost: round(setupOrOrderingCost + holdingCost),
  };
};

const lotQuantity = (demandSchedule: number[], start: number, end: number): number =>
  demandSchedule.slice(start - 1, end).reduce((total, demand) => total + demand, 0);

const assignDemandPeriodsToOrderPeriods = (
  demandSchedule: number[],
  unitCostByPeriod: number[],
  holdingCost: number,
) =>
  demandSchedule.map((demand, demandIndex) => {
    const demandPeriod = demandIndex + 1;
    let selectedOrderPeriod = 1;
    let bestUnitRelevantCost = Number.POSITIVE_INFINITY;

    for (let orderPeriod = 1; orderPeriod <= demandPeriod; orderPeriod += 1) {
      const candidateUnitRelevantCost =
        unitCostByPeriod[orderPeriod - 1] + holdingCost * (demandPeriod - orderPeriod);

      if (candidateUnitRelevantCost < bestUnitRelevantCost - Number.EPSILON) {
        bestUnitRelevantCost = candidateUnitRelevantCost;
        selectedOrderPeriod = orderPeriod;
      }
    }

    return {
      demandPeriod,
      demand,
      selectedOrderPeriod,
    };
  });

const coveringCost = (
  demandSchedule: number[],
  start: number,
  end: number,
  setupCost: number,
  holdingCost: number,
): number => {
  let total = setupCost;

  for (let coveredPeriod = start; coveredPeriod <= end; coveredPeriod += 1) {
    total += holdingCost * demandSchedule[coveredPeriod - 1] * (coveredPeriod - start);
  }

  return total;
};

const buildSilverMealComparison = (
  demandSchedule: number[],
  setupCost: number,
  holdingCost: number,
) => {
  const orderPeriods: number[] = [];
  let totalRelevantCost = 0;
  let currentStart = 1;

  while (currentStart <= demandSchedule.length) {
    let bestAverageCost = Number.POSITIVE_INFINITY;
    let selectedEnd = currentStart;

    for (let candidateEnd = currentStart; candidateEnd <= demandSchedule.length; candidateEnd += 1) {
      const horizonLength = candidateEnd - currentStart + 1;
      const candidateAverageCost =
        coveringCost(demandSchedule, currentStart, candidateEnd, setupCost, holdingCost) / horizonLength;

      if (candidateAverageCost <= bestAverageCost + Number.EPSILON) {
        bestAverageCost = candidateAverageCost;
        selectedEnd = candidateEnd;
        continue;
      }

      break;
    }

    orderPeriods.push(currentStart);
    totalRelevantCost += coveringCost(demandSchedule, currentStart, selectedEnd, setupCost, holdingCost);
    currentStart = selectedEnd + 1;
  }

  return {
    method: 'silver_meal' as const,
    note:
      'Se adjunta solo como comparación pedagógica: Silver-Meal es heurístico y no reemplaza la solución exacta por programación dinámica.',
    orderPeriods,
    totalRelevantCost: round(totalRelevantCost),
  };
};

export const solveExactWithSetup = (input: Extract<SolverInput, { branch: 'with_setup' }>): SolverOutput => {
  const actualDemandSchedule = toDemandSchedule(input);
  const initialInventory      = input.initialInventory ?? 0;

  // Las demandas efectivas descuentan el inventario inicial en cascada.
  // El algoritmo W-W corre sobre ellas para que las cantidades a pedir
  // reflejen solo la necesidad real de compra.
  const demandSchedule = initialInventory > 0
    ? adjustDemandsForInitialInventory(actualDemandSchedule, initialInventory)
    : actualDemandSchedule;

  const horizon = demandSchedule.length;
  const optimalCost: number[] = Array(horizon + 2).fill(0);
  const nextOrderPeriod: number[] = Array(horizon + 1).fill(0);
  const setupCostForPeriod = (period: number): number =>
    input.variant === 'setup_by_period'
      ? input.setupCostByPeriod[period - 1]
      : (input.setupCost as number);

  for (let period = horizon; period >= 1; period -= 1) {
    // Períodos con demanda efectiva = 0 (cubiertos por I₀): no se generan pedidos.
    // Su costo óptimo es igual al del siguiente período.
    if (demandSchedule[period - 1] === 0) {
      optimalCost[period] = optimalCost[period + 1];
      nextOrderPeriod[period] = -1; // marcador: no se pide en este período
      continue;
    }

    let bestCost = Number.POSITIVE_INFINITY;
    let bestCoverageEnd = period;

    for (let coverageEnd = period; coverageEnd <= horizon; coverageEnd += 1) {
      const candidateCost =
        coveringCost(demandSchedule, period, coverageEnd, setupCostForPeriod(period), input.holdingCost) +
        optimalCost[coverageEnd + 1];

      if (candidateCost < bestCost - Number.EPSILON) {
        bestCost = candidateCost;
        bestCoverageEnd = coverageEnd;
      }
    }

    optimalCost[period] = bestCost;
    nextOrderPeriod[period] = bestCoverageEnd;
  }

  const replenishmentPlan: ReplenishmentPlanEntry[] = [];
  let currentPeriod = 1;

  while (currentPeriod <= horizon) {
    // Saltar períodos sin demanda efectiva (cubiertos por I₀)
    if (demandSchedule[currentPeriod - 1] === 0) {
      currentPeriod += 1;
      continue;
    }
    const coversThroughPeriod = nextOrderPeriod[currentPeriod];
    replenishmentPlan.push({
      period: currentPeriod,
      quantity: round(lotQuantity(demandSchedule, currentPeriod, coversThroughPeriod)),
      coversThroughPeriod,
    });
    currentPeriod = coversThroughPeriod + 1;
  }

  // El inventario final usa las demandas REALES partiendo de I₀.
  // El costo se calcula sobre las demandas EFECTIVAS (las que determinaron los lotes).
  const endingInventoryByPeriod = buildEndingInventory(actualDemandSchedule, replenishmentPlan, initialInventory);
  const costBreakdown = buildCostBreakdown(
    demandSchedule,
    replenishmentPlan,
    (lot) => setupCostForPeriod(lot.period),
    input.holdingCost,
  );
  const firstLot = replenishmentPlan[0];
  const comparison = demandSchedule.length > 1 && input.variant === 'scalar'
    ? buildSilverMealComparison(demandSchedule, input.setupCost as number, input.holdingCost)
    : undefined;

  return SolverOutputSchema.parse({
    branch: 'with_setup',
    solverFamily: 'exact_with_setup',
    policy: {
      orderQuantity: firstLot.quantity,
      cycleTime: round(firstLot.coversThroughPeriod - firstLot.period + 1),
      replenishmentPlan,
    },
    computed: {
      planningHorizonPeriods: horizon,
      numberOfOrders: replenishmentPlan.length,
      firstOrderCoveragePeriods: firstLot.coversThroughPeriod - firstLot.period + 1,
      totalRelevantCost: costBreakdown.totalRelevantCost,
    },
    equations: [
      input.variant === 'setup_by_period'
        ? 'F(t) = min_j { setupCost_t + holdingCost * Σ[(k - t) * d_k] + F(j + 1) }'
        : 'F(t) = min_j { setupCost + holdingCost * Σ[(k - t) * d_k] + F(j + 1) }',
      'La política exacta se obtiene reconstruyendo el período final cubierto por cada pedido óptimo.',
    ],
    mathematicalArtifacts: {
      demandSchedule: actualDemandSchedule,   // demandas reales para mostrar en la UI
      endingInventoryByPeriod,
      orderPeriods: replenishmentPlan.map((entry) => entry.period),
      costBreakdown,
    },
    comparison,
  });
};

export const solveExactNoSetup = (input: Extract<SolverInput, { branch: 'no_setup' }>): SolverOutput => {
  const actualDemandSchedule = toDemandSchedule(input);
  const initialInventory      = input.initialInventory ?? 0;

  // Para lote-a-lote: los períodos cubiertos por I₀ tienen cantidad 0.
  const demandSchedule = initialInventory > 0
    ? adjustDemandsForInitialInventory(actualDemandSchedule, initialInventory)
    : actualDemandSchedule;

  const assignments = input.variant === 'unit_cost_by_period'
    ? assignDemandPeriodsToOrderPeriods(demandSchedule, input.unitCostByPeriod as number[], input.holdingCost)
    : [];
  const replenishmentPlan: ReplenishmentPlanEntry[] = input.variant === 'unit_cost_by_period'
    ? (() => {
        const grouped = new Map<number, { quantity: number; coversThroughPeriod: number }>();

        for (const assignment of assignments) {
          const current = grouped.get(assignment.selectedOrderPeriod) ?? {
            quantity: 0,
            coversThroughPeriod: assignment.demandPeriod,
          };

          grouped.set(assignment.selectedOrderPeriod, {
            quantity: current.quantity + assignment.demand,
            coversThroughPeriod: assignment.demandPeriod,
          });
        }

        return Array.from(grouped.entries())
          .sort((left, right) => left[0] - right[0])
          .map(([period, plan]) => ({
            period,
            quantity: round(plan.quantity),
            coversThroughPeriod: plan.coversThroughPeriod,
          }));
      })()
    : demandSchedule
        .map((demand, index) => ({
          period: index + 1,
          quantity: round(demand),
          coversThroughPeriod: index + 1,
        }))
        // Filtrar períodos con demanda efectiva = 0 (cubiertos por I₀)
        .filter((entry) => entry.quantity > 0);
  const endingInventoryByPeriod = buildEndingInventory(actualDemandSchedule, replenishmentPlan, initialInventory);
  const costBreakdown = (() => {
    if (input.variant === 'unit_cost_by_period') {
      let purchaseCost = 0;
      let holdingCost = 0;

      for (const assignment of assignments) {
        purchaseCost += input.unitCostByPeriod[assignment.selectedOrderPeriod - 1] * assignment.demand;
        holdingCost += input.holdingCost * (assignment.demandPeriod - assignment.selectedOrderPeriod) * assignment.demand;
      }

      return {
        setupOrOrderingCost: round(purchaseCost),
        holdingCost: round(holdingCost),
        totalRelevantCost: round(purchaseCost + holdingCost),
      };
    }

    if (input.unitCost !== undefined) {
      return {
        setupOrOrderingCost: round(actualDemandSchedule.reduce((total, demand) => total + demand * input.unitCost!, 0)),
        holdingCost: 0,
        totalRelevantCost: round(actualDemandSchedule.reduce((total, demand) => total + demand * input.unitCost!, 0)),
      };
    }

    return buildCostBreakdown(demandSchedule, replenishmentPlan, () => 0, input.holdingCost);
  })();

  return SolverOutputSchema.parse({
    branch: 'no_setup',
    solverFamily: 'exact_no_setup',
    policy: {
      orderQuantity: replenishmentPlan[0].quantity,
      cycleTime: 1,
      replenishmentPlan,
    },
    computed: {
      planningHorizonPeriods: actualDemandSchedule.length,
      numberOfOrders: replenishmentPlan.length,
      totalRelevantCost: costBreakdown.totalRelevantCost,
    },
    equations: [
      input.variant === 'unit_cost_by_period'
        ? 'Para cada demanda d_t se elige el período i <= t que minimiza c_i + h * (t - i), sin depender del LLM.'
        : 'Sin costo fijo de preparación/pedido, la política exacta minimiza inventario ordenando solo la demanda de cada período.',
      input.variant === 'unit_cost_by_period'
        ? 'Luego se agregan en cada período i las demandas futuras cuyo costo unitario anticipado más holding sigue siendo mínimo.'
        : 'Q_t* = d_t para todo período t del horizonte determinístico.',
    ],
    mathematicalArtifacts: {
      demandSchedule: actualDemandSchedule,   // demandas reales para la UI
      endingInventoryByPeriod,
      orderPeriods: replenishmentPlan.map((entry) => entry.period),
      costBreakdown,
    },
  });
};
