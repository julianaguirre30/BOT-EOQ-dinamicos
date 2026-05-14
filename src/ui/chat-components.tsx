'use client';

import { CSSProperties } from 'react';

/**
 * Base component styles for chat UI
 */
export const chatComponentStyles = {
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '0.95rem',
    marginTop: '8px',
  },
  tableHeader: {
    background: 'rgba(16, 185, 129, 0.12)',
    borderBottom: '1px solid rgba(16, 185, 129, 0.2)',
  },
  tableHeaderCell: {
    padding: '10px 12px',
    textAlign: 'left' as const,
    fontWeight: 700,
    color: '#065f46',
    fontSize: '0.85rem',
  },
  tableRow: {
    borderBottom: '1px solid rgba(16, 185, 129, 0.14)',
  },
  tableCell: {
    padding: '10px 12px',
    color: '#0f172a',
  },
  section: {
    marginTop: '14px',
  },
  sectionTitle: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#047857',
    marginBottom: '8px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    opacity: 0.9,
  },
  narrative: {
    color: '#0f172a',
    lineHeight: 1.6,
    marginBottom: '4px',
  },
  justification: {
    color: '#334155',
    fontSize: '0.9rem',
    lineHeight: 1.6,
    marginTop: '4px',
  },
} as const;

/**
 * DataTable component for displaying structured data
 */
export const DataTable = ({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | number)[][];
}) => (
  <table style={chatComponentStyles.table}>
    <thead style={chatComponentStyles.tableHeader}>
      <tr>
        {columns.map((col) => (
          <th key={col} style={chatComponentStyles.tableHeaderCell}>
            {col}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, idx) => (
        <tr key={idx} style={chatComponentStyles.tableRow}>
          {row.map((cell, cidx) => (
            <td key={cidx} style={chatComponentStyles.tableCell}>
              {cell}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

/**
 * Section component for organizing response data
 */
export const ResponseSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section style={chatComponentStyles.section}>
    <div style={chatComponentStyles.sectionTitle}>{title}</div>
    {children}
  </section>
);

/**
 * Simple key-value table (for detected data, metadata)
 */
export const KeyValueTable = ({
  data,
}: {
  data: Array<{ label: string; value: string | number }>;
}) => (
  <DataTable
    columns={['Parámetro', 'Valor']}
    rows={data.map((item) => [item.label, item.value])}
  />
);

/**
 * Bullet list component
 */
export const BulletList = ({ items }: { items: string[] }) => (
  <ul style={{ margin: '0', paddingLeft: '20px', color: '#0f172a' }}>
    {items.map((item, idx) => (
      <li key={idx} style={{ marginTop: '4px' }}>
        {item}
      </li>
    ))}
  </ul>
);
