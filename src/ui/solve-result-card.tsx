'use client';

import { SolvePayload } from './types';
import { DataTable, ResponseSection } from './chat-components';

const getPalette = (dark?: boolean) => dark
  ? { text: '#ddeeff', textMuted: '#7aaac8', textFaint: '#3d5f7a', chip: 'rgba(26,95,188,0.18)', chipBorder: 'rgba(26,95,188,0.35)', chipColor: '#7aaac8' }
  : { text: '#0b1829', textMuted: '#3a5a78', textFaint: '#8aaac4', chip: 'rgba(26,95,188,0.09)', chipBorder: 'rgba(26,95,188,0.2)',  chipColor: '#1a5fbc' };

// ─── Stagger delays para cada sección ────────────────────────────────────────
const STAGGER = [0, 0.13, 0.26, 0.39];

export const SolveResultCard = ({
  solvePayload,
  isDark,
}: {
  solvePayload: SolvePayload;
  isDark?: boolean;
}) => {
  const P = getPalette(isDark);
  const { solverInput, solverOutput } = solvePayload;
  const { replenishmentPlan } = solverOutput.policy;
  const { costBreakdown, endingInventoryByPeriod, demandSchedule } = solverOutput.mathematicalArtifacts;
  const hasSetup = solverInput.branch === 'with_setup';
  const model    = hasSetup
    ? 'EOQ dinámico con costo fijo de pedido'
    : 'EOQ dinámico sin costo fijo de pedido';

  // Filas del plan — marcamos cuáles tienen pedido real
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

  // Índices de filas que tienen pedido (quantity > 0)
  const highlightRows = replenishmentPlan
    .map((s, i) => (s.quantity > 0 ? i : -1))
    .filter(i => i >= 0);

  return (
    <div style={{ marginTop: '16px', fontSize: '0.92rem' }}>

      {/* Parámetros */}
      <ResponseSection title="📊 Parámetros detectados" isDark={isDark} delay={STAGGER[0]}>
        <DataTable
          isDark={isDark}
          columns={['Parámetro', 'Valor']}
          rows={[
            ['Períodos',                demandSchedule.length.toString()],
            ['Demandas',                `[${demandSchedule.join(', ')}]`],
            ['Costo de almacenamiento', solverInput.holdingCost.toString()],
            ...(hasSetup
              ? [['Costo fijo de pedido', (solverInput as Extract<typeof solverInput, { branch: 'with_setup'; variant: 'scalar' }>).setupCost?.toString() ?? '—']]
              : []),
          ]}
        />
      </ResponseSection>

      {/* Plan de reposición */}
      <ResponseSection title="📦 Plan de reposición" isDark={isDark} delay={STAGGER[1]}>
        <DataTable
          isDark={isDark}
          columns={['Período', 'Demanda', 'Pedido', 'Cubre hasta', 'Inv. final']}
          rows={planRows}
          highlightRows={highlightRows}
        />
      </ResponseSection>

      {/* Costos */}
      <ResponseSection title="💰 Análisis de costos" isDark={isDark} delay={STAGGER[2]}>
        <DataTable
          isDark={isDark}
          columns={['Concepto', 'Valor']}
          rows={[
            [hasSetup ? 'Costo fijo total' : 'Costo de compra total', costBreakdown.setupOrOrderingCost.toString()],
            ['Costo de almacenamiento total',                          costBreakdown.holdingCost.toString()],
            ['Costo relevante total ★',                                costBreakdown.totalRelevantCost.toString()],
          ]}
          highlightRows={[2]}
        />
      </ResponseSection>

      {/* Modelo */}
      <ResponseSection title="🎯 Modelo y algoritmo" isDark={isDark} delay={STAGGER[3]}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {[
            model,
            'Wagner-Whitin · O(n²)',
            ...(replenishmentPlan.length > 0
              ? [`${replenishmentPlan.filter(s => s.quantity > 0).length} pedido${replenishmentPlan.filter(s => s.quantity > 0).length !== 1 ? 's' : ''}`]
              : []),
          ].map((label) => (
            <span key={label} style={{
              padding: '3px 10px', borderRadius: '999px',
              background: P.chip, border: `1px solid ${P.chipBorder}`,
              color: P.chipColor, fontSize: '0.76rem', fontWeight: 600,
            }}>
              {label}
            </span>
          ))}
        </div>
      </ResponseSection>

    </div>
  );
};
