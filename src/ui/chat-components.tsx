'use client';

const LIGHT = {
  border:           'rgba(26,95,188,0.13)',
  borderStrong:     'rgba(26,95,188,0.25)',
  cyan:             '#00bcd4',
  sky:              '#1a5fbc',
  headerBg:         'rgba(26,95,188,0.07)',
  altRow:           'rgba(26,95,188,0.03)',
  highlightRow:     'rgba(26,95,188,0.08)',
  highlightBorder:  '#1a5fbc',
  text:             '#0b1829',
  textMuted:        '#3a5a78',
  textFaint:        '#8aaac4',
  totalRow:         'rgba(26,95,188,0.06)',
  totalRowBg:       'linear-gradient(90deg, rgba(26,95,188,0.11) 0%, rgba(0,188,212,0.07) 100%)',
  totalRowBorder:   'rgba(26,95,188,0.35)',
  totalValue:       '#1a5fbc',
  periodBg:         'rgba(26,95,188,0.06)',
  periodColor:      '#1a5fbc',
  orderBadgeBg:     'rgba(26,95,188,0.12)',
  orderBadgeBorder: 'rgba(26,95,188,0.3)',
  orderBadgeColor:  '#1a5fbc',
} as const;

const DARK = {
  border:           'rgba(26,95,188,0.2)',
  borderStrong:     'rgba(26,95,188,0.38)',
  cyan:             '#00bcd4',
  sky:              '#5ba3e0',
  headerBg:         'rgba(26,95,188,0.12)',
  altRow:           'rgba(26,95,188,0.06)',
  highlightRow:     'rgba(26,95,188,0.18)',
  highlightBorder:  '#4d8fd4',
  text:             '#ddeeff',
  textMuted:        '#7aaac8',
  textFaint:        '#3d5f7a',
  totalRow:         'rgba(26,95,188,0.12)',
  totalRowBg:       'linear-gradient(90deg, rgba(26,95,188,0.22) 0%, rgba(0,188,212,0.12) 100%)',
  totalRowBorder:   'rgba(26,95,188,0.5)',
  totalValue:       '#5ba3e0',
  periodBg:         'rgba(26,95,188,0.1)',
  periodColor:      '#5ba3e0',
  orderBadgeBg:     'rgba(26,95,188,0.22)',
  orderBadgeBorder: 'rgba(26,95,188,0.45)',
  orderBadgeColor:  '#5ba3e0',
} as const;

const getP = (dark?: boolean) => dark ? DARK : LIGHT;

// ─── Keyframes para stagger (inyectados una sola vez) ────────────────────────
const STAGGER_STYLES = `
  @keyframes sectionFadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

let stylesInjected = false;
const injectStyles = () => {
  if (stylesInjected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.textContent = STAGGER_STYLES;
  document.head.appendChild(el);
  stylesInjected = true;
};

// ─── Utilidad de formateo numérico ───────────────────────────────────────────
export const fmt = (n: number): string =>
  Number.isInteger(n) ? n.toString() : parseFloat(n.toFixed(2)).toString();

// ─── DataTable ────────────────────────────────────────────────────────────────
export const DataTable = ({
  columns, rows, isDark, highlightRows = [],
  rightAlignCols = [],
  periodCol,
  orderCol,
  totalRowIndex,
  separatorBeforeRow,
}: {
  columns: string[];
  rows: (string | number)[][];
  isDark?: boolean;
  highlightRows?: number[];
  rightAlignCols?: number[];
  periodCol?: number;
  orderCol?: number;
  totalRowIndex?: number;
  separatorBeforeRow?: number;
}) => {
  const P = getP(isDark);
  const highlightSet  = new Set(highlightRows);
  const rightAlignSet = new Set(rightAlignCols);

  return (
    <div style={{ overflowX: 'auto', marginTop: '8px' }}>
      <div style={{ borderRadius: '10px', border: `1px solid ${P.border}`, overflow: 'hidden', minWidth: '300px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem' }}>
          <thead>
            <tr style={{ background: P.headerBg, borderBottom: `1px solid ${P.borderStrong}` }}>
              {columns.map((col, ci) => (
                <th key={col} style={{
                  padding: '8px 12px', textAlign: rightAlignSet.has(ci) ? 'right' : 'left',
                  fontWeight: 600, color: P.cyan, fontSize: '0.73rem',
                  textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap',
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isHighlighted = highlightSet.has(i);
              const isTotal       = i === totalRowIndex;
              const hasSeparator  = i === separatorBeforeRow;
              return (
                <tr key={i} style={{
                  borderTop: hasSeparator
                    ? `2px solid ${P.totalRowBorder}`
                    : i > 0 ? `1px solid ${P.border}` : 'none',
                  background: isTotal
                    ? P.totalRowBg
                    : isHighlighted ? P.highlightRow
                    : i % 2 === 1 ? P.altRow : 'transparent',
                  borderLeft: isHighlighted && !isTotal ? `3px solid ${P.highlightBorder}` : '3px solid transparent',
                  transition: 'background 0.15s ease',
                }}>
                  {row.map((cell, j) => {
                    const isPeriodCell = j === periodCol;
                    const isOrderCell  = j === orderCol;
                    const cellStr      = String(cell);
                    const orderValue   = isOrderCell ? parseFloat(cellStr) : NaN;
                    const hasOrder     = isOrderCell && !isNaN(orderValue) && orderValue > 0;
                    return (
                      <td key={j} style={{
                        padding: isTotal ? '10px 12px' : '8px 12px',
                        textAlign: rightAlignSet.has(j) ? 'right' : 'left',
                        color: isTotal && j > 0 ? P.totalValue
                          : isPeriodCell ? P.periodColor
                          : j === 0 ? P.textMuted : P.text,
                        fontWeight: isTotal ? 700 : isPeriodCell ? 600 : isHighlighted && j > 0 ? 600 : 400,
                        fontSize: isTotal ? '0.9rem' : '0.85rem',
                        whiteSpace: 'nowrap',
                        background: isPeriodCell && !isTotal ? P.periodBg : undefined,
                      }}>
                        {hasOrder ? (
                          <span style={{
                            display: 'inline-block', padding: '1px 8px', borderRadius: '999px',
                            background: P.orderBadgeBg, border: `1px solid ${P.orderBadgeBorder}`,
                            color: P.orderBadgeColor, fontWeight: 700, fontSize: '0.82rem',
                          }}>
                            {cellStr}
                          </span>
                        ) : isOrderCell && (cellStr === '0' || cellStr === '') ? (
                          <span style={{ color: P.textFaint, fontSize: '0.82rem' }}>—</span>
                        ) : isTotal && j === 0 ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
                              background: `linear-gradient(135deg, ${P.sky}, ${P.cyan})`, flexShrink: 0,
                            }} />
                            {cellStr}
                          </span>
                        ) : cellStr}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── ResponseSection ──────────────────────────────────────────────────────────
export const ResponseSection = ({
  title, children, isDark, delay = 0, small = false,
}: {
  title: string;
  children: React.ReactNode;
  isDark?: boolean;
  delay?: number;
  small?: boolean;
}) => {
  const P = getP(isDark);
  injectStyles();
  return (
    <section style={{ marginTop: '18px', animation: `sectionFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) ${delay}s both` }}>
      <div style={{
        fontSize: small ? '0.68rem' : '0.84rem',
        fontWeight: 700, color: P.sky, marginBottom: '8px',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        opacity: small ? 0.6 : 1,
      }}>
        {title}
      </div>
      {children}
    </section>
  );
};

// ─── KeyValueTable ────────────────────────────────────────────────────────────
export const KeyValueTable = ({ data, isDark }: { data: Array<{ label: string; value: string | number }>; isDark?: boolean }) => (
  <DataTable columns={['Parámetro', 'Valor']} rows={data.map((d) => [d.label, d.value])} isDark={isDark} />
);

// ─── BulletList ───────────────────────────────────────────────────────────────
export const BulletList = ({ items, isDark }: { items: string[]; isDark?: boolean }) => {
  const P = getP(isDark);
  return (
    <ul style={{ margin: 0, paddingLeft: '18px' }}>
      {items.map((item, i) => (
        <li key={i} style={{ marginTop: '6px', color: P.textMuted, fontSize: '0.92rem', lineHeight: 1.6 }}>
          {item}
        </li>
      ))}
    </ul>
  );
};

// ─── PlanCards ────────────────────────────────────────────────────────────────

export type PlanPeriodData = {
  period: number;
  demand: number;
  orderQty: number;
  coversThroughPeriod: number;
  endingInventory: number;
  coveredByOrderPeriod: number;
  horizon: number;
};

/** Métrica con label y valor, usada dentro de las cards */
const Metric = ({ label, children, isDark }: { label: string; children: React.ReactNode; isDark?: boolean }) => {
  const P = getP(isDark);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '72px' }}>
      <span style={{ fontSize: '0.67rem', color: P.textFaint, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </span>
      {children}
    </div>
  );
};

/** Genera texto de cobertura legible: "P2 y P3", "P1, P2 y P3", "solo P1" */
const coverageText = (from: number, through: number): string => {
  if (from === through) return `solo P${from}`;
  const periods = Array.from({ length: through - from + 1 }, (_, i) => `P${from + i}`);
  if (periods.length === 2) return periods.join(' y ');
  return periods.slice(0, -1).join(', ') + ' y ' + periods[periods.length - 1];
};

export const PlanCards = ({
  periods, isDark,
}: {
  periods: PlanPeriodData[];
  isDark?: boolean;
}) => {
  const P = getP(isDark);
  const horizon = periods.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
      {periods.map((p) => {
        const hasOrder       = p.orderQty > 0;
        const anticipation   = hasOrder ? p.orderQty - p.demand : 0;
        const hasAnticip     = anticipation > 0;
        const spansMultiple  = hasOrder && p.coversThroughPeriod > p.period;
        const coveredPeriods = hasOrder ? p.coversThroughPeriod - p.period + 1 : 0;
        const invIsZero      = p.endingInventory === 0;
        const passiveLabel   = p.coveredByOrderPeriod === 0
          ? 'Cubierto por stock previo'
          : `Cubierto por P${p.coveredByOrderPeriod}`;

        return (
          <div
            key={p.period}
            style={{
              borderRadius: '10px',
              border: `1px solid ${hasOrder ? P.borderStrong : P.border}`,
              borderLeft: `4px solid ${hasOrder ? P.highlightBorder : 'transparent'}`,
              background: hasOrder
                ? (isDark ? 'rgba(26,95,188,0.1)' : 'rgba(26,95,188,0.05)')
                : 'transparent',
              padding: hasOrder ? '14px 18px' : '10px 16px',
            }}
          >
            {/* ── Header ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: hasOrder ? '14px' : 0,
              flexWrap: 'wrap', gap: '6px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                  background: hasOrder ? `linear-gradient(135deg, ${P.sky}, ${P.cyan})` : 'transparent',
                  border: hasOrder ? 'none' : `2px solid ${P.textFaint}`,
                }} />
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: hasOrder ? P.sky : P.textMuted }}>
                  Período {p.period}
                </span>
                {/* Tarjeta pasiva: demanda + quién la cubre */}
                {!hasOrder && (
                  <span style={{ fontSize: '0.82rem', color: P.textFaint }}>
                    (Demanda: {fmt(p.demand)} uds) — {passiveLabel}
                  </span>
                )}
              </div>
              {hasOrder && (
                <span style={{
                  padding: '3px 10px', borderRadius: '999px',
                  background: isDark ? 'rgba(26,95,188,0.22)' : 'rgba(26,95,188,0.1)',
                  border: `1px solid ${P.borderStrong}`,
                  color: isDark ? P.cyan : P.sky,
                  fontSize: '0.72rem', fontWeight: 700,
                }}>
                  ↑ Reposición
                </span>
              )}
            </div>

            {/* ── Métricas — solo tarjetas activas ── */}
            {hasOrder && (
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px 0' }}>

                <Metric label="Demanda" isDark={isDark}>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem', color: P.text }}>{fmt(p.demand)} uds</span>
                </Metric>

                <Metric label="Pedido" isDark={isDark}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: isDark ? P.cyan : P.sky }}>
                      {fmt(p.orderQty)} uds
                    </span>
                    {hasAnticip && (
                      <span style={{
                        fontSize: '0.72rem', color: P.textFaint,
                        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        padding: '1px 6px', borderRadius: '999px',
                        border: `1px solid ${P.border}`,
                      }}>
                        +{fmt(anticipation)} anticip.
                      </span>
                    )}
                  </div>
                </Metric>

                <Metric label="Cobertura" isDark={isDark}>
                  <div>
                    <div style={{ display: 'flex', gap: '2px', marginBottom: '4px' }}>
                      {Array.from({ length: horizon }, (_, i) => {
                        const pNum    = i + 1;
                        const covered = pNum >= p.period && pNum <= p.coversThroughPeriod;
                        return (
                          <div key={pNum} title={`P${pNum}`} style={{
                            width: Math.max(10, Math.min(16, Math.floor(120 / horizon))) + 'px',
                            height: '6px', borderRadius: '2px',
                            background: covered
                              ? `linear-gradient(90deg, ${P.sky}, ${P.cyan})`
                              : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
                          }} />
                        );
                      })}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: P.textMuted }}>
                      {spansMultiple
                        ? `P${p.period} → P${p.coversThroughPeriod} · ${coveredPeriods} períodos`
                        : `Solo P${p.period} — pedido JIT`}
                    </span>
                  </div>
                </Metric>

                <Metric label="Inv. final" isDark={isDark}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      marginTop: '3px', flexShrink: 0,
                      background: invIsZero ? '#22c55e' : '#f59e0b',
                    }} />
                    <div>
                      <span style={{
                        fontWeight: 600, fontSize: '0.88rem',
                        color: invIsZero ? (isDark ? '#4ade80' : '#16a34a') : P.text,
                      }}>
                        {fmt(p.endingInventory)} uds
                      </span>
                      <span style={{ display: 'block', fontSize: '0.71rem', color: P.textFaint, marginTop: '1px' }}>
                        {invIsZero
                          ? '✓ Sin costo de almacenamiento'
                          : p.period < horizon
                            ? `→ pasa a P${p.period + 1}`
                            : 'Último período'}
                      </span>
                    </div>
                  </div>
                </Metric>

              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── DemandTimeline ───────────────────────────────────────────────────────────
// Tabla horizontal: Período / Demanda como dos filas de timeline
export const DemandTimeline = ({
  demands, isDark,
}: {
  demands: number[];
  isDark?: boolean;
}) => {
  const P = getP(isDark);
  return (
    <div style={{ overflowX: 'auto', marginTop: '10px' }}>
      <div style={{ borderRadius: '10px', border: `1px solid ${P.border}`, overflow: 'hidden', display: 'inline-block', minWidth: '100%' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '0.84rem', width: '100%' }}>
          <tbody>
            <tr style={{ background: P.headerBg }}>
              <td style={{
                padding: '7px 12px', fontWeight: 600, color: P.textFaint,
                fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em',
                whiteSpace: 'nowrap', borderRight: `1px solid ${P.borderStrong}`,
              }}>
                Período
              </td>
              {demands.map((_, i) => (
                <td key={i} style={{
                  padding: '7px 16px', textAlign: 'center',
                  fontWeight: 700, color: isDark ? P.sky : P.sky,
                  fontSize: '0.82rem', whiteSpace: 'nowrap',
                  borderLeft: `1px solid ${P.border}`,
                }}>
                  P{i + 1}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{
                padding: '7px 12px', fontWeight: 600, color: P.textFaint,
                fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em',
                whiteSpace: 'nowrap', borderRight: `1px solid ${P.borderStrong}`,
                borderTop: `1px solid ${P.border}`,
                background: isDark ? 'rgba(26,95,188,0.04)' : 'rgba(26,95,188,0.03)',
              }}>
                Demanda
              </td>
              {demands.map((d, i) => (
                <td key={i} style={{
                  padding: '7px 16px', textAlign: 'center',
                  fontWeight: 600, color: P.text,
                  fontSize: '0.88rem', whiteSpace: 'nowrap',
                  borderLeft: `1px solid ${P.border}`,
                  borderTop: `1px solid ${P.border}`,
                  background: isDark ? 'rgba(26,95,188,0.04)' : 'rgba(26,95,188,0.03)',
                }}>
                  {fmt(d)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── CostAnalysis ─────────────────────────────────────────────────────────────

export type CostBreakdownData = {
  hasSetup: boolean;
  setupCostPerOrder: number;
  holdingCostPerUnit: number;
  setupOrOrderingCostTotal: number;
  holdingCostTotal: number;
  totalRelevantCost: number;
  orderPeriods: number[];
  inventoryByPeriod: Array<{ period: number; inv: number }>;
};

/** Bloque con header coloreado y contenido interno.
 *  Si `inline` es true, `children` se renderiza dentro del header (todo en un renglón). */
const CostBlock = ({ title, total, children, inline, isDark }: {
  title: string;
  total: number;
  children?: React.ReactNode;
  inline?: boolean;
  isDark?: boolean;
}) => {
  const P = getP(isDark);
  return (
    <div style={{ borderRadius: '10px', border: `1px solid ${P.border}`, overflow: 'hidden' }}>
      <div style={{
        padding: '8px 14px', background: P.headerBg,
        borderBottom: inline || !children ? 'none' : `1px solid ${P.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '6px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: P.sky, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
            {title}
          </span>
          {inline && children && (
            <span style={{ fontSize: '0.84rem', color: P.textMuted }}>{children}</span>
          )}
        </div>
        <span style={{ fontSize: '0.92rem', fontWeight: 700, color: P.text }}>
          ${fmt(total)}
        </span>
      </div>
      {!inline && children && (
        <div style={{ padding: '10px 14px' }}>
          {children}
        </div>
      )}
    </div>
  );
};

export const CostAnalysis = ({ data, isDark }: { data: CostBreakdownData; isDark?: boolean }) => {
  const P = getP(isDark);
  const {
    hasSetup, setupCostPerOrder, holdingCostPerUnit,
    setupOrOrderingCostTotal, holdingCostTotal, totalRelevantCost,
    orderPeriods, inventoryByPeriod,
  } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>

      {/* Costo fijo / de compra — todo en un renglón */}
      <CostBlock
        title={hasSetup ? 'Costo fijo de pedido' : 'Costo de compra'}
        total={setupOrOrderingCostTotal}
        inline
        isDark={isDark}
      >
        {hasSetup && orderPeriods.length > 0
          ? `${orderPeriods.length} pedido${orderPeriods.length !== 1 ? 's' : ''} (${orderPeriods.map((op) => `P${op}`).join(', ')}) × $${fmt(setupCostPerOrder)} c/u`
          : 'Sin costo fijo — modelo lot-for-lot'}
      </CostBlock>

      {/* Costo de almacenamiento — solo título y total */}
      <CostBlock title="Costo de almacenamiento" total={holdingCostTotal} isDark={isDark} />

      {/* Total */}
      <div style={{
        borderRadius: '10px',
        background: isDark
          ? 'linear-gradient(90deg, rgba(26,95,188,0.2) 0%, rgba(0,188,212,0.1) 100%)'
          : 'linear-gradient(90deg, rgba(26,95,188,0.1) 0%, rgba(0,188,212,0.06) 100%)',
        border: `1.5px solid ${P.borderStrong}`,
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '8px',
      }}>
        {/* Fórmula aditiva */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', color: P.textMuted }}>${fmt(setupOrOrderingCostTotal)}</span>
          <span style={{ color: P.textFaint, fontSize: '0.82rem' }}>+</span>
          <span style={{ fontSize: '0.82rem', color: P.textMuted }}>${fmt(holdingCostTotal)}</span>
          <span style={{ color: P.textFaint, fontSize: '0.82rem' }}>=</span>
        </div>
        {/* Resultado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.73rem', fontWeight: 600, color: P.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Costo relevante total
          </span>
          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: isDark ? P.cyan : P.sky }}>
            ${fmt(totalRelevantCost)}
          </span>
        </div>
      </div>

    </div>
  );
};

// ─── Compat export ────────────────────────────────────────────────────────────
export const chatComponentStyles = {} as const;
