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
    background: 'rgba(79, 70, 229, 0.1)',
    borderBottom: '1px solid rgba(129, 140, 248, 0.2)',
  },
  tableHeaderCell: {
    padding: '10px 12px',
    textAlign: 'left' as const,
    fontWeight: 600,
    color: '#c7d2fe',
    fontSize: '0.85rem',
  },
  tableRow: {
    borderBottom: '1px solid rgba(96, 165, 250, 0.08)',
  },
  tableCell: {
    padding: '10px 12px',
    color: '#f8fafc',
  },
  section: {
    marginTop: '14px',
  },
  sectionTitle: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#c7d2fe',
    marginBottom: '8px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    opacity: 0.8,
  },
  narrative: {
    color: '#f8fafc',
    lineHeight: 1.6,
    marginBottom: '4px',
  },
  justification: {
    color: '#cbd5e1',
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
  <ul style={{ margin: '0', paddingLeft: '20px', color: '#f8fafc' }}>
    {items.map((item, idx) => (
      <li key={idx} style={{ marginTop: '4px' }}>
        {item}
      </li>
    ))}
  </ul>
);
