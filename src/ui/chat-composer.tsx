'use client';

import { FormEvent } from 'react';

const composerStyles = {
  inputWrap: {
    position: 'sticky' as const,
    bottom: 0,
    zIndex: 10,
    borderTop: '1px solid rgba(96, 165, 250, 0.18)',
    padding: '16px 18px 18px',
    background: 'linear-gradient(180deg, rgba(5, 8, 22, 0.82), rgba(5, 8, 22, 0.96) 24%, rgba(10, 16, 31, 0.98) 100%)',
    backdropFilter: 'blur(12px)',
  },
  textarea: {
    width: '100%',
    minHeight: '76px',
    maxHeight: '180px',
    resize: 'vertical' as const,
    borderRadius: '20px',
    border: '1px solid rgba(129, 140, 248, 0.28)',
    background: 'rgba(15, 23, 42, 0.95)',
    color: '#f8fafc',
    padding: '18px',
    fontSize: '16px',
    outline: 'none',
  },
  button: {
    borderRadius: '999px',
    border: 'none',
    background: 'linear-gradient(135deg, #4f46e5, #2563eb)',
    color: 'white',
    padding: '14px 22px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 10px 30px rgba(37, 99, 235, 0.35)',
  },
  muted: {
    color: '#cbd5e1',
  },
  label: {
    display: 'block' as const,
    marginBottom: '10px',
    fontWeight: 700,
  },
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    marginTop: '16px',
    flexWrap: 'wrap' as const,
  },
  statusRow: {
    display: 'grid',
    gap: '8px',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap' as const,
  },
  errorText: {
    color: '#fca5a5',
    marginTop: '12px',
  },
} as const;

export const ChatComposer = ({
  draft,
  sessionId,
  pendingResetProblem,
  error,
  isSubmitting,
  onChange,
  onSubmit,
  onResetProblem,
}: {
  draft: string;
  sessionId?: string;
  pendingResetProblem: boolean;
  error: string | null;
  isSubmitting: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onResetProblem: () => void;
}) => (
  <form style={composerStyles.inputWrap} onSubmit={onSubmit} data-testid="chat-composer">
    <label htmlFor="chat-input" style={composerStyles.label}>
      Escribí tu siguiente mensaje
    </label>
    <textarea
      id="chat-input"
      style={composerStyles.textarea}
      value={draft}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Ejemplo: Se presentan 3 periodos con una demanda mensual de 60,20,50 y costo de almacenamiento es de $40. El costo de pedido es $45."
    />
    <div style={composerStyles.controls}>
      <div style={composerStyles.statusRow}>
        <span style={composerStyles.muted}>{sessionId ? `Sesión activa: ${sessionId}` : 'Todavía no arrancaste una sesión.'}</span>
        {pendingResetProblem ? <span style={composerStyles.muted}>El próximo envío va a arrancar un problema nuevo.</span> : null}
      </div>
      <div style={composerStyles.buttonRow}>
        {sessionId ? (
          <button type="button" style={{ ...composerStyles.button, background: 'linear-gradient(135deg, #0f766e, #2563eb)' }} onClick={onResetProblem}>
            Nuevo problema
          </button>
        ) : null}
        <button type="submit" style={composerStyles.button} disabled={isSubmitting}>
          {isSubmitting ? 'Pensando...' : 'Enviar mensaje'}
        </button>
      </div>
    </div>
    {error ? <p style={composerStyles.errorText}>{error}</p> : null}
  </form>
);
