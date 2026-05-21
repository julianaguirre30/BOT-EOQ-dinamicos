'use client';

const LIGHT = {
  border:       'rgba(26,95,188,0.13)',
  borderStrong: 'rgba(26,95,188,0.25)',
  cyan:         '#00bcd4',
  sky:          '#1a5fbc',
  headerBg:     'rgba(26,95,188,0.07)',
  altRow:       'rgba(26,95,188,0.03)',
  highlightRow: 'rgba(26,95,188,0.08)',
  highlightBorder: '#1a5fbc',
  text:         '#0b1829',
  textMuted:    '#3a5a78',
  textFaint:    '#8aaac4',
  totalRow:     'rgba(26,95,188,0.06)',
} as const;

const DARK = {
  border:       'rgba(26,95,188,0.2)',
  borderStrong: 'rgba(26,95,188,0.38)',
  cyan:         '#00bcd4',
  sky:          '#5ba3e0',
  headerBg:     'rgba(26,95,188,0.12)',
  altRow:       'rgba(26,95,188,0.06)',
  highlightRow: 'rgba(26,95,188,0.18)',
  highlightBorder: '#4d8fd4',
  text:         '#ddeeff',
  textMuted:    '#7aaac8',
  textFaint:    '#3d5f7a',
  totalRow:     'rgba(26,95,188,0.12)',
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

// ─── DataTable ────────────────────────────────────────────────────────────────
export const DataTable = ({
  columns, rows, isDark, highlightRows = [],
}: {
  columns: string[];
  rows: (string | number)[][];
  isDark?: boolean;
  /** Índices de filas que deben destacarse (borde izquierdo azul + fondo) */
  highlightRows?: number[];
}) => {
  const P = getP(isDark);
  const highlightSet = new Set(highlightRows);

  return (
    <div style={{ overflowX: 'auto', marginTop: '8px' }}>
      <div style={{ borderRadius: '10px', border: `1px solid ${P.border}`, overflow: 'hidden', minWidth: '300px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem' }}>
          <thead>
            <tr style={{ background: P.headerBg, borderBottom: `1px solid ${P.borderStrong}` }}>
              {columns.map((col) => (
                <th key={col} style={{
                  padding: '8px 12px', textAlign: 'left',
                  fontWeight: 600, color: P.cyan,
                  fontSize: '0.73rem', textTransform: 'uppercase',
                  letterSpacing: '0.07em', whiteSpace: 'nowrap',
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isHighlighted = highlightSet.has(i);
              return (
                <tr
                  key={i}
                  style={{
                    borderBottom: i < rows.length - 1 ? `1px solid ${P.border}` : 'none',
                    background: isHighlighted
                      ? P.highlightRow
                      : i % 2 === 1 ? P.altRow : 'transparent',
                    borderLeft: isHighlighted ? `3px solid ${P.highlightBorder}` : '3px solid transparent',
                    transition: 'background 0.15s ease',
                  }}
                >
                  {row.map((cell, j) => (
                    <td key={j} style={{
                      padding: '8px 12px',
                      color: j === 0 ? P.textMuted : P.text,
                      fontWeight: isHighlighted && j > 0 ? 600 : j === row.length - 1 ? 500 : 400,
                      fontSize: '0.85rem',
                      whiteSpace: 'nowrap',
                    }}>
                      {cell}
                    </td>
                  ))}
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
  title, children, isDark, delay = 0,
}: {
  title: string;
  children: React.ReactNode;
  isDark?: boolean;
  /** Delay en segundos para la animación de entrada escalonada */
  delay?: number;
}) => {
  const P = getP(isDark);
  injectStyles();

  return (
    <section style={{
      marginTop: '18px',
      animation: `sectionFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) ${delay}s both`,
    }}>
      <div style={{
        fontSize: '0.74rem', fontWeight: 600, color: P.sky,
        marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.09em',
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

// ─── Compat export ────────────────────────────────────────────────────────────
export const chatComponentStyles = {} as const;
