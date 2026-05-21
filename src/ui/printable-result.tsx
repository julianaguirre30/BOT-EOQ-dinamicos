'use client';

import { SolvePayload } from './types';

// ─── Estilos de impresión ─────────────────────────────────────────────────────
export const PRINT_STYLES = `
  @media print {
    @page { size: A4 portrait; margin: 20mm 22mm; }

    /* Ocultar todo */
    body * { visibility: hidden !important; }

    /* Mostrar solo el contenido imprimible */
    #simplex-print-content,
    #simplex-print-content * { visibility: visible !important; }

    #simplex-print-content {
      display: block !important;
      position: fixed;
      top: 0; left: 0;
      width: 100%;
      padding: 0;
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
      color: #1a1a2e;
    }

    /* Evitar cortes dentro de secciones */
    .print-section { page-break-inside: avoid; }
    table { page-break-inside: avoid; }
    tr { page-break-inside: avoid; }
  }
`;

// ─── Helpers de estilo ────────────────────────────────────────────────────────
const ACCENT       = '#1a5fbc';
const ACCENT_LIGHT = '#e8f0fe';
const ACCENT_MID   = '#bfdbfe';
const TEXT_DARK    = '#0f172a';
const TEXT_MID     = '#334155';
const TEXT_LIGHT   = '#64748b';
const BORDER       = '#e2e8f0';
const ROW_ALT      = '#f8fafc';

// ─── Componente imprimible ────────────────────────────────────────────────────
export const PrintableResult = ({ solvePayload }: { solvePayload: SolvePayload }) => {
  const { solverInput, solverOutput } = solvePayload;
  const { replenishmentPlan }         = solverOutput.policy;
  const { costBreakdown, endingInventoryByPeriod, demandSchedule } = solverOutput.mathematicalArtifacts;

  const hasSetup  = solverInput.branch === 'with_setup';
  const setupCost: number | null = (hasSetup && solverInput.variant === 'scalar' && 'setupCost' in solverInput)
    ? (solverInput as { setupCost: number }).setupCost
    : null;

  const date = new Date().toLocaleDateString('es-AR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // ── Tabla header cell
  const TH = (first = false, last = false): React.CSSProperties => ({
    padding: '9px 12px',
    textAlign: 'center',
    background: ACCENT,
    color: '#fff',
    fontWeight: 700,
    fontSize: '10.5px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    border: `1px solid ${ACCENT}`,
    borderRadius: first ? '6px 0 0 0' : last ? '0 6px 0 0' : undefined,
  });

  // ── Tabla data cell
  const TD = (alt: boolean, align: React.CSSProperties['textAlign'] = 'center', bold = false): React.CSSProperties => ({
    padding: '7px 12px',
    textAlign: align,
    fontSize: '11.5px',
    border: `1px solid ${BORDER}`,
    background: alt ? ROW_ALT : '#fff',
    fontWeight: bold ? 700 : 400,
    color: TEXT_DARK,
  });

  // ── Sección título
  const SH: React.CSSProperties = {
    fontSize: '9px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: ACCENT,
    borderBottom: `2px solid ${ACCENT}`,
    paddingBottom: '5px',
    marginBottom: '12px',
    marginTop: '0',
  };

  const ordersCount = replenishmentPlan.filter(p => p.quantity > 0).length;

  return (
    <div id="simplex-print-content" style={{ display: 'none' }}>

      {/* ── Encabezado ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'stretch',
        borderBottom: `3px solid ${ACCENT}`,
        paddingBottom: '14px', marginBottom: '28px',
      }}>
        {/* Bloque izquierdo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ fontSize: '20px', fontWeight: 800, color: ACCENT, letterSpacing: '-0.02em' }}>
            Informe de Resolución
          </div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: TEXT_MID }}>
            Modelo EOQ Dinámico · Algoritmo Wagner-Whitin
          </div>
          <div style={{ fontSize: '10.5px', color: TEXT_LIGHT, marginTop: '2px' }}>
            Investigación Operativa · UTN FRRe · 2026
          </div>
        </div>

        {/* Bloque derecho */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}>
          <div style={{
            background: ACCENT_LIGHT,
            border: `1px solid ${ACCENT_MID}`,
            borderRadius: '6px',
            padding: '5px 12px',
            fontSize: '10px', fontWeight: 600, color: ACCENT,
            letterSpacing: '0.03em',
          }}>
            GENERADO EL {date.toUpperCase()}
          </div>
          <div style={{ fontSize: '10px', color: TEXT_LIGHT }}>
            Simplex · Asistente EOQ Dinámico
          </div>
        </div>
      </div>

      {/* ── Resumen ejecutivo (KPIs) ─────────────────────────────────────────── */}
      <div className="print-section" style={{ marginBottom: '26px' }}>
        <div style={{
          display: 'flex', gap: '12px',
          borderLeft: `4px solid ${ACCENT}`,
          paddingLeft: '14px',
          alignItems: 'center',
        }}>
          {[
            { label: 'Períodos analizados', value: `${demandSchedule.length}` },
            { label: 'Órdenes de compra',   value: `${ordersCount}` },
            { label: hasSetup ? 'Costo fijo total' : 'Costo de almacenamiento', value: `${costBreakdown.holdingCost}` },
            { label: 'Costo relevante total', value: `${costBreakdown.totalRelevantCost}`, highlight: true },
          ].map(({ label, value, highlight }) => (
            <div key={label} style={{
              flex: 1, padding: '10px 14px', borderRadius: '8px',
              background: highlight ? ACCENT_LIGHT : '#fff',
              border: `1.5px solid ${highlight ? ACCENT_MID : BORDER}`,
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '16px', fontWeight: 800,
                color: highlight ? ACCENT : TEXT_DARK,
                lineHeight: 1.2,
              }}>{value}</div>
              <div style={{
                fontSize: '9px', fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.07em', color: TEXT_LIGHT, marginTop: '4px',
              }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Parámetros ──────────────────────────────────────────────────────── */}
      <div className="print-section" style={{ marginBottom: '24px' }}>
        <p style={SH}>Parámetros del problema</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', borderRadius: '6px', overflow: 'hidden' }}>
          <tbody>
            {[
              ['Número de períodos',          `${demandSchedule.length}`],
              ['Demandas por período',         `[${demandSchedule.join(', ')}]`],
              ['Costo de almacenamiento (h)',  `${solverInput.holdingCost} por unidad / período`],
              ...(setupCost !== null ? [['Costo fijo de pedido (K)', `${setupCost}`]] : []),
              ['Modelo aplicado', hasSetup
                ? 'EOQ dinámico con costo fijo de pedido'
                : 'EOQ dinámico sin costo fijo (reposición lote a lote)'],
            ].map(([label, value], i) => (
              <tr key={label}>
                <td style={{ ...TD(i % 2 === 1, 'left'), fontWeight: 600, width: '40%', color: TEXT_MID }}>
                  {label}
                </td>
                <td style={TD(i % 2 === 1, 'left')}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Plan de reposición ───────────────────────────────────────────────── */}
      <div className="print-section" style={{ marginBottom: '24px' }}>
        <p style={SH}>Plan de reposición óptimo</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: '6px', overflow: 'hidden' }}>
          <thead>
            <tr>
              {['Período', 'Demanda', 'Cantidad a pedir', 'Cubre hasta', 'Inv. final'].map((h, i, arr) => (
                <th key={h} style={TH(i === 0, i === arr.length - 1)}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {replenishmentPlan.map((p, i) => {
              const inv = endingInventoryByPeriod[p.period - 1] ?? 0;
              const alt = i % 2 === 1;
              const isOrder = p.quantity > 0;
              return (
                <tr key={p.period}>
                  <td style={TD(alt)}>{p.period}</td>
                  <td style={TD(alt)}>{demandSchedule[p.period - 1]}</td>
                  <td style={{
                    ...TD(alt, 'center', isOrder),
                    color: isOrder ? ACCENT : TEXT_LIGHT,
                    background: isOrder ? (alt ? '#eef4ff' : '#f5f8ff') : (alt ? ROW_ALT : '#fff'),
                  }}>
                    {isOrder ? p.quantity : '—'}
                  </td>
                  <td style={TD(alt)}>{p.coversThroughPeriod ?? '—'}</td>
                  <td style={TD(alt)}>{inv}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Análisis de costos ───────────────────────────────────────────────── */}
      <div className="print-section" style={{ marginBottom: '24px' }}>
        <p style={SH}>Análisis de costos</p>
        <table style={{ width: '50%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
          <tbody>
            <tr>
              <td style={{ ...TD(false, 'left'), fontWeight: 600, color: TEXT_MID }}>
                {hasSetup ? 'Costo fijo total (pedidos)' : 'Costo de compra total'}
              </td>
              <td style={{ ...TD(false, 'right') }}>{costBreakdown.setupOrOrderingCost}</td>
            </tr>
            <tr>
              <td style={{ ...TD(true, 'left'), fontWeight: 600, color: TEXT_MID }}>
                Costo de almacenamiento total
              </td>
              <td style={{ ...TD(true, 'right') }}>{costBreakdown.holdingCost}</td>
            </tr>
            <tr>
              <td style={{
                ...TD(false, 'left'),
                fontWeight: 700, color: ACCENT,
                background: ACCENT_LIGHT,
                border: `1.5px solid ${ACCENT_MID}`,
              }}>
                Costo relevante total ★
              </td>
              <td style={{
                ...TD(false, 'right'),
                fontWeight: 800, color: ACCENT,
                background: ACCENT_LIGHT,
                border: `1.5px solid ${ACCENT_MID}`,
                fontSize: '13px',
              }}>
                {costBreakdown.totalRelevantCost}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Conclusión ──────────────────────────────────────────────────────── */}
      <div className="print-section" style={{
        marginBottom: '28px',
        padding: '14px 18px',
        borderLeft: `4px solid ${ACCENT}`,
        background: ACCENT_LIGHT,
        borderRadius: '0 8px 8px 0',
        fontSize: '11.5px',
        lineHeight: 1.7,
        color: TEXT_DARK,
      }}>
        <strong style={{ color: ACCENT, display: 'block', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Conclusión
        </strong>
        El plan óptimo obtenido mediante el algoritmo Wagner-Whitin establece{' '}
        <strong>{ordersCount} orden{ordersCount !== 1 ? 'es' : ''} de compra</strong>{' '}
        a lo largo de los {demandSchedule.length} períodos analizados, con un{' '}
        <strong>costo relevante total de {costBreakdown.totalRelevantCost}</strong>.
        Este resultado minimiza la suma de costos de {hasSetup ? 'pedido y ' : ''}almacenamiento
        mediante programación dinámica, garantizando la política de reposición de menor costo posible.
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div style={{
        borderTop: `1px solid ${BORDER}`,
        paddingTop: '10px',
        marginTop: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '9px',
        color: TEXT_LIGHT,
      }}>
        <span>Simplex · Asistente EOQ Dinámico · UTN FRRe</span>
        <span>Investigación Operativa 2026 — Documento generado automáticamente</span>
      </div>

    </div>
  );
};
