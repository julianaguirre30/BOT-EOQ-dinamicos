'use client';

import { SolvePayload } from './types';
import { DataTable, ResponseSection } from './chat-components';

const getPalette = (dark?: boolean) => dark
  ? { text: '#ddeeff', textMuted: '#7aaac8', textFaint: '#3d5f7a', chip: 'rgba(26,95,188,0.18)', chipBorder: 'rgba(26,95,188,0.35)', chipColor: '#7aaac8' }
  : { text: '#0b1829', textMuted: '#3a5a78', textFaint: '#8aaac4', chip: 'rgba(26,95,188,0.09)', chipBorder: 'rgba(26,95,188,0.2)',  chipColor: '#1a5fbc' };

export const SolveResultCard = ({
  solvePayload,
  isDark,
}: {
  solvePayload: SolvePayload;
  isDark?: boolean;
}) => {
  const P = getPalette(isDark);
  const { solverInput, solverOutput } = solvePayload;
  const { replenishmentPlan, orderQuantity } = solverOutput.policy;
  const { costBreakdown, endingInventoryByPeriod, demandSchedule } = solverOutput.mathematicalArtifacts;
  const hasSetup = solverInput.branch === 'with_setup';
  const model    = hasSetup
    ? 'EOQ dinámico con costo fijo de pedido'
    : 'EOQ dinámico sin costo fijo de pedido';

  // Armar filas con inventario final incluido
  const planRows = replenishmentPlan.map((s) => {
    const inv = endingInventoryByPeriod[s.period - 1] ?? 0;
    return [
      s.period.toString(),
      demandSchedule[s.period - 1]?.toString() ?? '—',
      s.quantity.toString(),
      s.coversThroughPeriod.toString(),
      inv.toString(),
    ];
  });

  return (
    <div style={{ marginTop: '16px', fontSize: '0.92rem' }}>

      {/* Parámetros del problema */}
      <ResponseSection title="📊 Parámetros detectados" isDark={isDark}>
        <DataTable
          isDark={isDark}
          columns={['Parámetro', 'Valor']}
          rows={[
            ['Períodos',                        demandSchedule.length.toString()],
            ['Demandas',                        `[${demandSchedule.join(', ')}]`],
            ['Costo de almacenamiento',         solverInput.holdingCost.toString()],
            ...(hasSetup
              ? [['Costo fijo de pedido', (solverInput as Extract<typeof solverInput, { branch: 'with_setup'; variant: 'scalar' }>).setupCost?.toString() ?? '—']]
              : []),
          ]}
        />
      </ResponseSection>

      {/* Plan de reposición */}
      <ResponseSection title="📦 Plan de reposición" isDark={isDark}>
        <DataTable
          isDark={isDark}
          columns={['Período', 'Demanda', 'Pedido', 'Cubre hasta', 'Inv. final']}
          rows={planRows}
        />
      </ResponseSection>

      {/* Análisis de costos */}
      <ResponseSection title="💰 Análisis de costos" isDark={isDark}>
        <DataTable
          isDark={isDark}
          columns={['Concepto', 'Valor']}
          rows={[
            [hasSetup ? 'Costo fijo total' : 'Costo de compra total', costBreakdown.setupOrOrderingCost.toString()],
            ['Costo de almacenamiento total',                          costBreakdown.holdingCost.toString()],
            ['Costo relevante total ★',                                costBreakdown.totalRelevantCost.toString()],
          ]}
        />
      </ResponseSection>

      {/* Modelo y algoritmo */}
      <ResponseSection title="🎯 Modelo y algoritmo" isDark={isDark}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <span style={{
            padding: '3px 10px', borderRadius: '999px',
            background: P.chip, border: `1px solid ${P.chipBorder}`,
            color: P.chipColor, fontSize: '0.76rem', fontWeight: 600,
          }}>
            {model}
          </span>
          <span style={{
            padding: '3px 10px', borderRadius: '999px',
            background: P.chip, border: `1px solid ${P.chipBorder}`,
            color: P.chipColor, fontSize: '0.76rem', fontWeight: 600,
          }}>
            Wagner-Whitin · O(n²)
          </span>
          {replenishmentPlan.length > 0 && (
            <span style={{
              padding: '3px 10px', borderRadius: '999px',
              background: P.chip, border: `1px solid ${P.chipBorder}`,
              color: P.chipColor, fontSize: '0.76rem', fontWeight: 600,
            }}>
              {replenishmentPlan.length} pedido{replenishmentPlan.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </ResponseSection>

    </div>
  );
};
