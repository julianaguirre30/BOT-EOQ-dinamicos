'use client';

import { SolvePayload } from './types';

// ─── Estilos @media print ─────────────────────────────────────────────────────
// Se inyectan en la página principal. Al presionar "Exportar PDF" se llama
// directamente a window.print() — sin abrir ventanas nuevas.
//
// Estrategia CSS:
//   1. body > *:not(#simplex-print-content) → oculta el shell y todo lo demás.
//   2. #simplex-print-content → position: static para entrar al flujo normal
//      del documento y permitir paginación correcta en todos los browsers.
//   3. @page margin: 0 + padding en el contenido → control total del diseño.
export const PRINT_STYLES = `
  @media print {
    @page { size: A4 portrait; margin: 0; }

    /* Ocultar todo excepto el contenido del informe */
    body > *:not(#simplex-print-content) { display: none !important; }

    /* Sacar del off-screen y colocar en flujo normal (pagina correctamente) */
    #simplex-print-content {
      display: block !important;
      position: static !important;
      width: 100% !important;
      padding: 14mm 18mm !important;
      background: #fff !important;
      font-family: Arial, Helvetica, sans-serif !important;
      color: #0f172a !important;
      box-sizing: border-box !important;
    }

    .print-section { page-break-inside: avoid; }
    table { page-break-inside: avoid; }
    tr    { page-break-inside: avoid; }
  }
`;

// ─── Paleta ───────────────────────────────────────────────────────────────────
const A = '#1a5fbc';         // accent blue
const AL = '#e8f0fe';        // accent light
const AM = '#bfdbfe';        // accent mid
const TD_ = '#0f172a';       // text dark
const TM  = '#334155';       // text mid
const TL  = '#64748b';       // text light
const BR  = '#e2e8f0';       // border
const RA  = '#f8fafc';       // row alt

// ─── Componente imprimible ────────────────────────────────────────────────────
// Renderizado via createPortal a <body> (fuera del shell position:fixed).
// En pantalla vive off-screen (position:fixed top:-9999px).
// Al imprimir, @media print lo reposiciona en flujo normal y oculta el shell.
export const PrintableResult = ({ solvePayload }: { solvePayload: SolvePayload }) => {
  const { solverInput, solverOutput } = solvePayload;
  const { replenishmentPlan }         = solverOutput.policy;
  const { costBreakdown, endingInventoryByPeriod, demandSchedule } =
    solverOutput.mathematicalArtifacts;

  const hasSetup  = solverInput.branch === 'with_setup';
  const setupCost: number | null =
    hasSetup && solverInput.variant === 'scalar' && 'setupCost' in solverInput
      ? (solverInput as { setupCost: number }).setupCost
      : null;

  const date = new Date().toLocaleDateString('es-AR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const orders = replenishmentPlan.filter(p => p.quantity > 0).length;

  // ── Estilos de celda reutilizables ──────────────────────────────────────────
  const th: React.CSSProperties = {
    padding: '6px 10px', background: A, color: '#fff',
    fontWeight: 700, fontSize: '9.5pt', textTransform: 'uppercase',
    letterSpacing: '0.03em', border: `1px solid ${A}`, textAlign: 'center',
  };
  const td = (alt: boolean, align: React.CSSProperties['textAlign'] = 'center', bold = false): React.CSSProperties => ({
    padding: '5px 10px', textAlign: align, fontSize: '10pt',
    border: `1px solid ${BR}`, background: alt ? RA : '#fff',
    fontWeight: bold ? 700 : 400, color: TD_,
  });
  const sh: React.CSSProperties = {
    fontSize: '7.5pt', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.12em', color: A, borderBottom: `2px solid ${A}`,
    paddingBottom: '4px', marginBottom: '10px', marginTop: '0',
  };

  return (
    <div
      id="simplex-print-content"
      style={{
        // Off-screen en pantalla; @media print lo reposiciona en flujo normal.
        // position: fixed (no absolute) para no afectar el scroll/layout del body.
        position: 'fixed', top: '-9999px', left: '-9999px',
        width: '170mm',   // ancho imprimible A4 con márgenes 20mm cada lado
        background: '#fff',
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: TD_,
        fontSize: '10pt',
        lineHeight: 1.4,
      }}
    >

      {/* ══ ENCABEZADO ════════════════════════════════════════════════════════ */}
      <table style={{ width: '100%', borderCollapse: 'collapse',
                      borderBottom: `3px solid ${A}`, paddingBottom: '12px',
                      marginBottom: '20px' }}>
        <tbody><tr>

          {/* Logo + título */}
          <td style={{ verticalAlign: 'middle', paddingBottom: '12px' }}>
            <table style={{ borderCollapse: 'collapse' }}>
              <tbody><tr>
                {/* Logo en esquina superior izquierda */}
                <td style={{ verticalAlign: 'middle', paddingRight: '12px' }}>
                  {/* src usa path relativo — handlePrint agrega <base href> */}
                  <img
                    src="/logo.png"
                    alt="Simplex"
                    style={{ width: '44px', height: '44px', objectFit: 'contain', display: 'block' }}
                  />
                </td>
                <td style={{ verticalAlign: 'middle' }}>
                  <div style={{ fontSize: '17pt', fontWeight: 800, color: A, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                    Informe de Resolución
                  </div>
                  <div style={{ fontSize: '10pt', fontWeight: 500, color: TM, marginTop: '3px' }}>
                    Modelo EOQ Dinámico · Algoritmo Wagner-Whitin
                  </div>
                  <div style={{ fontSize: '8.5pt', color: TL, marginTop: '2px' }}>
                    Investigación Operativa · UTN FRRe · 2026
                  </div>
                </td>
              </tr></tbody>
            </table>
          </td>

          {/* Fecha (esquina superior derecha) */}
          <td style={{ textAlign: 'right', verticalAlign: 'top', paddingBottom: '12px', paddingTop: '4px' }}>
            <div style={{
              display: 'inline-block', background: AL, border: `1px solid ${AM}`,
              borderRadius: '5px', padding: '4px 10px',
              fontSize: '8pt', fontWeight: 600, color: A, letterSpacing: '0.03em',
            }}>
              {date.toUpperCase()}
            </div>
            <div style={{ fontSize: '8pt', color: TL, marginTop: '5px' }}>
              Simplex · Asistente EOQ Dinámico
            </div>
          </td>

        </tr></tbody>
      </table>

      {/* ══ KPIs ══════════════════════════════════════════════════════════════ */}
      <div className="print-section" style={{ marginBottom: '18px', borderLeft: `4px solid ${A}`, paddingLeft: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '6px 0', tableLayout: 'fixed' }}>
          <tbody><tr>
            {[
              { label: 'Períodos',         value: `${demandSchedule.length}` },
              { label: 'Órdenes',          value: `${orders}` },
              { label: hasSetup ? 'Costo fijo' : 'Costo almac.', value: `${costBreakdown.holdingCost}` },
              { label: 'Costo total ★',    value: `${costBreakdown.totalRelevantCost}`, hi: true },
            ].map(({ label, value, hi }) => (
              <td key={label} style={{
                padding: '8px 10px', borderRadius: '6px', textAlign: 'center', width: '25%',
                background: hi ? AL : '#fff',
                border: `1.5px solid ${hi ? AM : BR}`,
              }}>
                <div style={{ fontSize: '15pt', fontWeight: 800, color: hi ? A : TD_, lineHeight: 1.1 }}>
                  {value}
                </div>
                <div style={{ fontSize: '7pt', fontWeight: 600, textTransform: 'uppercase',
                              letterSpacing: '0.06em', color: TL, marginTop: '3px' }}>
                  {label}
                </div>
              </td>
            ))}
          </tr></tbody>
        </table>
      </div>

      {/* ══ PARÁMETROS ════════════════════════════════════════════════════════ */}
      <div className="print-section" style={{ marginBottom: '18px' }}>
        <p style={sh}>Parámetros del problema</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '42%' }} />
            <col style={{ width: '58%' }} />
          </colgroup>
          <tbody>
            {[
              ['Número de períodos',         `${demandSchedule.length}`],
              ['Demandas por período',        `[${demandSchedule.join(', ')}]`],
              ['Costo de almacenamiento (h)', `${solverInput.holdingCost} por unidad / período`],
              ...(setupCost !== null ? [['Costo fijo de pedido (K)', `${setupCost}`]] : []),
              ['Modelo aplicado', hasSetup
                ? 'EOQ dinámico con costo fijo de pedido'
                : 'EOQ dinámico sin costo fijo (lote a lote)'],
            ].map(([lbl, val], i) => (
              <tr key={lbl}>
                <td style={{ ...td(i % 2 === 1, 'left'), fontWeight: 600, color: TM }}>{lbl}</td>
                <td style={td(i % 2 === 1, 'left')}>{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ══ PLAN DE REPOSICIÓN ════════════════════════════════════════════════ */}
      <div className="print-section" style={{ marginBottom: '18px' }}>
        <p style={sh}>Plan de reposición óptimo</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '13%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '24%' }} />
            <col style={{ width: '24%' }} />
            <col style={{ width: '14%' }} />
          </colgroup>
          <thead>
            <tr>
              {['Período','Demanda','Cant. a pedir','Cubre hasta','Inv. final'].map((h, i, a) => (
                <th key={h} style={{ ...th,
                  borderRadius: i === 0 ? '4px 0 0 0' : i === a.length-1 ? '0 4px 0 0' : undefined,
                  wordBreak: 'break-word' as const,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {replenishmentPlan.map((p, i) => {
              const inv    = endingInventoryByPeriod[p.period - 1] ?? 0;
              const alt    = i % 2 === 1;
              const isOrd  = p.quantity > 0;
              return (
                <tr key={p.period} style={{
                  background: isOrd ? (alt ? '#eef4ff' : '#f5f8ff') : (alt ? RA : '#fff'),
                  borderLeft: isOrd ? `3px solid ${A}` : `3px solid transparent`,
                }}>
                  <td style={{ ...td(false, 'center'), background: 'inherit' }}>{p.period}</td>
                  <td style={{ ...td(false, 'center'), background: 'inherit' }}>{demandSchedule[p.period-1]}</td>
                  <td style={{ ...td(false, 'center', isOrd), color: isOrd ? A : TL, background: 'inherit' }}>
                    {isOrd ? p.quantity : '—'}
                  </td>
                  <td style={{ ...td(false, 'center'), background: 'inherit' }}>{p.coversThroughPeriod ?? '—'}</td>
                  <td style={{ ...td(false, 'center'), background: 'inherit' }}>{inv}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ══ COSTOS ════════════════════════════════════════════════════════════ */}
      <div className="print-section" style={{ marginBottom: '18px' }}>
        <p style={sh}>Análisis de costos</p>
        <table style={{ width: '60%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '70%' }} />
            <col style={{ width: '30%' }} />
          </colgroup>
          <tbody>
            <tr>
              <td style={{ ...td(false,'left'), fontWeight: 600, color: TM }}>
                {hasSetup ? 'Costo fijo total (pedidos)' : 'Costo de compra total'}
              </td>
              <td style={td(false,'right')}>{costBreakdown.setupOrOrderingCost}</td>
            </tr>
            <tr>
              <td style={{ ...td(true,'left'), fontWeight: 600, color: TM }}>
                Costo de almacenamiento total
              </td>
              <td style={td(true,'right')}>{costBreakdown.holdingCost}</td>
            </tr>
            <tr>
              <td style={{ ...td(false,'left'), fontWeight: 700, color: A,
                            background: AL, border: `1.5px solid ${AM}` }}>
                Costo relevante total ★
              </td>
              <td style={{ ...td(false,'right'), fontWeight: 800, color: A,
                            background: AL, border: `1.5px solid ${AM}`, fontSize: '12pt' }}>
                {costBreakdown.totalRelevantCost}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ══ CONCLUSIÓN ════════════════════════════════════════════════════════ */}
      <div className="print-section" style={{
        marginBottom: '20px', padding: '10px 14px',
        borderLeft: `4px solid ${A}`, background: AL,
        borderRadius: '0 6px 6px 0', fontSize: '10pt', lineHeight: 1.6, color: TD_,
      }}>
        <strong style={{ color: A, display: 'block', marginBottom: '3px',
                         fontSize: '7.5pt', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Conclusión
        </strong>
        El plan óptimo obtenido mediante el algoritmo Wagner-Whitin establece{' '}
        <strong>{orders} orden{orders !== 1 ? 'es' : ''} de compra</strong>{' '}
        a lo largo de los {demandSchedule.length} períodos analizados, con un{' '}
        <strong>costo relevante total de {costBreakdown.totalRelevantCost}</strong>.
        Este resultado minimiza la suma de costos de {hasSetup ? 'pedido y ' : ''}almacenamiento
        mediante programación dinámica, garantizando la política de reposición de menor costo posible.
      </div>

      {/* ══ FOOTER ════════════════════════════════════════════════════════════ */}
      <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${BR}` }}>
        <tbody><tr>
          <td style={{ paddingTop: '8px', fontSize: '7.5pt', color: TL, textAlign: 'left' }}>
            Simplex · Asistente EOQ Dinámico · UTN FRRe
          </td>
          <td style={{ paddingTop: '8px', fontSize: '7.5pt', color: TL, textAlign: 'right' }}>
            Investigación Operativa 2026 — Generado automáticamente
          </td>
        </tr></tbody>
      </table>

    </div>
  );
};
