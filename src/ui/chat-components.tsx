'use client';

const LIGHT = {
  border:       'rgba(26,95,188,0.13)',
  borderStrong: 'rgba(26,95,188,0.25)',
  cyan:         '#00bcd4',
  sky:          '#1a5fbc',
  headerBg:     'rgba(26,95,188,0.07)',
  altRow:       'rgba(26,95,188,0.03)',
  text:         '#0b1829',
  textMuted:    '#3a5a78',
  textFaint:    '#8aaac4',
} as const;

const DARK = {
  border:       'rgba(26,95,188,0.2)',
  borderStrong: 'rgba(26,95,188,0.38)',
  cyan:         '#00bcd4',
  sky:          '#5ba3e0',
  headerBg:     'rgba(26,95,188,0.12)',
  altRow:       'rgba(26,95,188,0.06)',
  text:         '#ddeeff',
  textMuted:    '#7aaac8',
  textFaint:    '#3d5f7a',
} as const;

const getP = (dark?: boolean) => dark ? DARK : LIGHT;

// ─── DataTable ────────────────────────────────────────────────────────────────
export const DataTable = ({
  columns, rows, isDark,
}: {
  columns: string[];
  rows: (string | number)[][];
  isDark?: boolean;
}) => {
  const P = getP(isDark);
  return (
    <div style={{ borderRadius: '10px', border: `1px solid ${P.border}`, overflow: 'hidden', marginTop: '8px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem' }}>
        <thead>
          <tr style={{ background: P.headerBg, borderBottom: `1px solid ${P.borderStrong}` }}>
            {columns.map((col) => (
              <th key={col} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: P.cyan, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${P.border}` : 'none', background: i % 2 === 1 ? P.altRow : 'transparent' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '9px 14px', color: j === 0 ? P.textMuted : P.text, fontWeight: j === row.length - 1 ? 500 : 400, fontSize: '0.87rem' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── ResponseSection ──────────────────────────────────────────────────────────
export const ResponseSection = ({ title, children, isDark }: { title: string; children: React.ReactNode; isDark?: boolean }) => {
  const P = getP(isDark);
  return (
    <section style={{ marginTop: '18px' }}>
      <div style={{ fontSize: '0.74rem', fontWeight: 600, color: P.sky, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
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
