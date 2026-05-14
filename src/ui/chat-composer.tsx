'use client';

import { FormEvent } from 'react';

const composerStyles = {
  inputWrap: {
    position: 'sticky' as const,
    bottom: 0,
    zIndex: 10,
    borderTop: '1px solid rgba(16, 185, 129, 0.18)',
    padding: '16px 18px 18px',
    background: '#ffffff',
    backdropFilter: 'blur(12px)',
  },
  textarea: {
    width: '100%',
    minHeight: '76px',
    maxHeight: '180px',
    resize: 'vertical' as const,
    borderRadius: '20px',
    border: '1px solid rgba(16, 185, 129, 0.28)',
    background: '#f7fff8',
    color: '#0f172a',
    padding: '18px',
    fontSize: '16px',
    outline: 'none',
  },
  button: {
    borderRadius: '999px',
    border: 'none',
    background: 'linear-gradient(135deg, #10b981, #047857)',
    color: 'white',
    padding: '14px 22px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 10px 30px rgba(16, 185, 129, 0.35)',
  },
  muted: {
    color: '#475569',
  },
  label: {
    display: 'block' as const,
    marginBottom: '10px',
    fontWeight: 700,
    color: '#0f172a',
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
    color: '#dc2626',
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
      Respondé a la pregunta del asistente
    </label>
    <textarea
      id="chat-input"
      style={composerStyles.textarea}
      value={draft}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Escribí aquí tu respuesta..."
    />
    <div style={composerStyles.controls}>
      <div style={composerStyles.statusRow}>
        <span style={composerStyles.muted}>{sessionId ? `Sesión activa: ${sessionId}` : 'Todavía no arrancaste una sesión.'}</span>
        {pendingResetProblem ? <span style={composerStyles.muted}>El próximo envío va a arrancar un problema nuevo.</span> : null}
      </div>
      <div style={composerStyles.buttonRow}>
        <button type="button" style={{ ...composerStyles.button, background: 'linear-gradient(135deg, #047857, #0f766e)' }} onClick={onResetProblem}>
          Nuevo problema
        </button>
        <button type="submit" style={composerStyles.button} disabled={isSubmitting}>
          {isSubmitting ? 'Pensando...' : 'Enviar mensaje'}
        </button>
      </div>
    </div>
    {error ? <p style={composerStyles.errorText}>{error}</p> : null}
  </form>
);
