'use client';

import { SolvePayload } from './types';
import {
  DataTable, PlanCards, CostAnalysis, DemandTimeline, ResponseSection,
  PlanPeriodData, CostBreakdownData, fmt,
} from './chat-components';

const getPalette = (dark?: boolean) => dark
  ? { sky: '#5ba3e0', cyan: '#00bcd4', text: '#ddeeff', textMuted: '#7aaac8', textFaint: '#3d5f7a', chip: 'rgba(26,95,188,0.18)', chipBorder: 'rgba(26,95,188,0.35)', chipColor: '#7aaac8', kpiBg: 'rgba(26,95,188,0.14)', kpiBorder: 'rgba(26,95,188,0.32)' }
  : { sky: '#1a5fbc', cyan: '#00bcd4', text: '#0b1829', textMuted: '#3a5a78', textFaint: '#8aaac4', chip: 'rgba(26,95,188,0.09)', chipBorder: 'rgba(26,95,188,0.2)', chipColor: '#1a5fbc', kpiBg: 'rgba(26,95,188,0.07)', kpiBorder: 'rgba(26,95,188,0.18)' };

const STAGGER = [0, 0.13, 0.26, 0.39, 0.52];

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
  const hasSetup  = solverInput.branch === 'with_setup';
  const horizon   = demandSchedule.length;
  const model     = hasSetup ? 'EOQ dinámico con costo fijo de pedido' : 'EOQ dinámico sin costo fijo de pedido';
  const setupCost = hasSetup
    ? ((solverInput as Extract<typeof solverInput, { branch: 'with_setup'; variant: 'scalar' }>).setupCost ?? 0)
    : 0;

  // ── Mapa de períodos con pedido ──────────────────────────────────────────
  const orderMap = new Map(replenishmentPlan.map((s) => [s.period, s]));

  // ── Para cada período, qué pedido lo cubre (0 = inventario inicial) ──────
  const coveredBy = new Map<number, number>();
  replenishmentPlan.forEach((slot) => {
    for (let p = slot.period; p <= slot.coversThroughPeriod; p++) {
      coveredBy.set(p, slot.period);
    }
  });

  // ── Datos para PlanCards ─────────────────────────────────────────────────
  const planPeriods: PlanPeriodData[] = Array.from({ length: horizon }, (_, idx) => {
    const period = idx + 1;
    const slot   = orderMap.get(period);
    return {
      period,
      demand:               demandSchedule[idx] ?? 0,
      orderQty:             slot?.quantity ?? 0,
      coversThroughPeriod:  slot?.coversThroughPeriod ?? period,
      endingInventory:      endingInventoryByPeriod[idx] ?? 0,
      coveredByOrderPeriod: coveredBy.get(period) ?? 0, // 0 = cubierto por I₀
      horizon,
    };
  });

  // ── Datos para CostAnalysis ──────────────────────────────────────────────
  const orderPeriods = replenishmentPlan.filter((s) => s.quantity > 0).map((s) => s.period);

  const costData: CostBreakdownData = {
    hasSetup,
    setupCostPerOrder:        setupCost,
    holdingCostPerUnit:       solverInput.holdingCost,
    setupOrOrderingCostTotal: costBreakdown.setupOrOrderingCost,
    holdingCostTotal:         costBreakdown.holdingCost,
    totalRelevantCost:        costBreakdown.totalRelevantCost,
    orderPeriods,
    inventoryByPeriod: Array.from({ length: horizon }, (_, i) => ({
      period: i + 1,
      inv:    endingInventoryByPeriod[i] ?? 0,
    })),
  };

  return (
    <div style={{ marginTop: '16px', fontSize: '0.92rem' }}>

      {/* ── SECCIÓN 1: Datos de entrada ─────────────────────────────────── */}
      <ResponseSection title="Datos de entrada" isDark={isDark} delay={STAGGER[0]}>

        {/* KPI badges — parámetros globales en una línea */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
          {hasSetup && (
            <span style={{
              padding: '5px 12px', borderRadius: '999px',
              background: P.kpiBg, border: `1px solid ${P.kpiBorder}`,
              fontSize: '0.8rem', fontWeight: 600, color: P.sky, whiteSpace: 'nowrap',
            }}>
              Costo fijo de pedido: ${fmt(setupCost)}
            </span>
          )}
          <span style={{
            padding: '5px 12px', borderRadius: '999px',
            background: P.kpiBg, border: `1px solid ${P.kpiBorder}`,
            fontSize: '0.8rem', fontWeight: 600, color: P.sky, whiteSpace: 'nowrap',
          }}>
            Costo de almacenamiento: ${fmt(solverInput.holdingCost)}
          </span>
          {!!solverInput.initialInventory && (
            <span style={{
              padding: '5px 12px', borderRadius: '999px',
              background: P.kpiBg, border: `1px solid ${P.kpiBorder}`,
              fontSize: '0.8rem', fontWeight: 600, color: P.sky, whiteSpace: 'nowrap',
            }}>
              Inventario inicial (I₀): {fmt(solverInput.initialInventory)} uds
            </span>
          )}
        </div>

        {/* Timeline de demandas */}
        <DemandTimeline demands={demandSchedule} isDark={isDark} />
      </ResponseSection>

      {/* ── SECCIÓN 2: Plan detallado de reposición ─────────────────────── */}
      <ResponseSection title="Plan detallado de reposición" isDark={isDark} delay={STAGGER[1]}>
        {planPeriods.length > 4 ? (
          <>
            <style>{`
              .plan-scroll::-webkit-scrollbar { width: 8px; }
              .plan-scroll::-webkit-scrollbar-track {
                background: ${isDark ? 'rgba(26,95,188,0.1)' : 'rgba(26,95,188,0.07)'};
                border-radius: 999px;
              }
              .plan-scroll::-webkit-scrollbar-thumb {
                background: ${isDark ? 'rgba(26,95,188,0.6)' : 'rgba(26,95,188,0.4)'};
                border-radius: 999px;
                border: 2px solid ${isDark ? 'rgba(26,95,188,0.1)' : 'rgba(26,95,188,0.07)'};
              }
              .plan-scroll::-webkit-scrollbar-thumb:hover {
                background: ${isDark ? 'rgba(26,95,188,0.85)' : 'rgba(26,95,188,0.65)'};
              }
              @keyframes scrollBounce {
                0%, 100% { transform: translateY(0); opacity: 0.7; }
                50%       { transform: translateY(5px); opacity: 1; }
              }
            `}</style>
            <div style={{ position: 'relative' }}>
              <div
                className="plan-scroll"
                style={{
                  maxHeight: '260px',
                  overflowY: 'scroll',
                  overflowX: 'hidden',
                  scrollbarWidth: 'auto',
                  paddingRight: '4px',
                }}
              >
                <PlanCards periods={planPeriods} isDark={isDark} />
              </div>

              {/* Degradado inferior */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: '10px',
                height: '52px', pointerEvents: 'none',
                background: isDark
                  ? 'linear-gradient(to bottom, transparent, rgba(9,21,42,0.9))'
                  : 'linear-gradient(to bottom, transparent, rgba(244,250,255,0.95))',
                borderRadius: '0 0 10px 10px',
              }} />

              {/* Chevron animado */}
              <div style={{
                position: 'absolute', bottom: '6px', left: '50%',
                transform: 'translateX(-50%)',
                pointerEvents: 'none',
                animation: 'scrollBounce 1.4s ease-in-out infinite',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
              }}>
                <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
                  <path d="M2 2l8 8 8-8" stroke={isDark ? '#4d8fd4' : '#1a5fbc'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </>
        ) : (
          <PlanCards periods={planPeriods} isDark={isDark} />
        )}
      </ResponseSection>

      {/* ── SECCIÓN 3: Análisis de costos ───────────────────────────────── */}
      <ResponseSection title="Análisis de costos" isDark={isDark} delay={STAGGER[2]}>
        <CostAnalysis data={costData} isDark={isDark} />
      </ResponseSection>

      {/* ── SECCIÓN 4: Resumen — burbuja prominente ──────────────────────── */}
      <div style={{
        marginTop: '22px',
        animation: `sectionFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) ${STAGGER[3]}s both`,
      }}>
        <div style={{
          borderRadius: '4px 16px 16px 16px',
          background: isDark
            ? 'linear-gradient(135deg, rgba(26,95,188,0.18) 0%, rgba(0,188,212,0.1) 100%)'
            : 'linear-gradient(135deg, rgba(26,95,188,0.08) 0%, rgba(0,188,212,0.05) 100%)',
          border: `1px solid ${isDark ? 'rgba(26,95,188,0.35)' : 'rgba(26,95,188,0.2)'}`,
          borderLeft: `4px solid ${isDark ? '#4d8fd4' : '#1a5fbc'}`,
          padding: '16px 20px',
          backdropFilter: 'blur(8px)',
          boxShadow: isDark
            ? '0 4px 20px rgba(26,95,188,0.15)'
            : '0 4px 20px rgba(26,95,188,0.08)',
        }}>
          <div style={{
            fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', marginBottom: '10px',
            color: isDark ? '#4d8fd4' : '#1a5fbc',
          }}>
            Plan óptimo
          </div>
          {(() => {
            const orders = replenishmentPlan.filter(s => s.quantity > 0);
            const ORDINALS = ['primera','segunda','tercera','cuarta','quinta','sexta','séptima','octava','novena','décima'];
            const textColor = isDark ? '#ddeeff' : '#0b1829';
            const B = (text: React.ReactNode) => <strong>{text}</strong>;

            const coverage = (s: typeof orders[0]) =>
              s.coversThroughPeriod > s.period
                ? `abasteciendo hasta el período ${s.coversThroughPeriod}`
                : 'para cubrir la demanda exacta de ese ciclo';

            return (
              <div style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.7, color: textColor, fontWeight: 400 }}>
                <p style={{ margin: '0 0 10px' }}>
                  Para minimizar la suma de los costos de {hasSetup ? 'pedido y ' : ''}almacenamiento,
                  se aplicó el algoritmo de {B('Wagner-Whitin')} mediante programación dinámica,
                  obteniendo un {B(`costo relevante total de $${fmt(costBreakdown.totalRelevantCost)}`)}.
                </p>

                {orders.length === 1 ? (
                  <p style={{ margin: 0 }}>
                    El plan óptimo establece una {B('única orden de compra')} en el
                    período {B(orders[0].period)} por {B(`${fmt(orders[0].quantity)} unidades`)} ({coverage(orders[0])}).
                  </p>
                ) : (
                  <>
                    <p style={{ margin: '0 0 8px' }}>
                      El plan óptimo establece {B(`${orders.length} órdenes de compra`)}:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {orders.map((s, i) => {
                        const isLast  = i === orders.length - 1;
                        const ordinal = ORDINALS[i] ?? `${i + 1}°`;
                        const cov     = coverage(s);
                        return (
                          <li key={s.period} style={{ fontSize: '0.93rem', lineHeight: 1.6, color: textColor }}>
                            {isLast
                              ? `Compra final en el período ${s.period} de ${fmt(s.quantity)} unidades (${cov}).`
                              : `La ${ordinal} en el período ${s.period} por ${fmt(s.quantity)} unidades (${cov}).`
                            }
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── SECCIÓN 5: Modelo y algoritmo ───────────────────────────────── */}
      <ResponseSection title="Modelo y algoritmo" isDark={isDark} delay={STAGGER[4]} small>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
          {[
            model,
            'Wagner-Whitin · O(n²)',
            ...(orderPeriods.length > 0
              ? [`${orderPeriods.length} pedido${orderPeriods.length !== 1 ? 's' : ''}`]
              : []),
          ].map((label, i, arr) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', color: P.textFaint, fontWeight: 400 }}>{label}</span>
              {i < arr.length - 1 && <span style={{ color: P.textFaint, opacity: 0.4, fontSize: '0.7rem' }}>·</span>}
            </span>
          ))}
        </div>
      </ResponseSection>

    </div>
  );
};
