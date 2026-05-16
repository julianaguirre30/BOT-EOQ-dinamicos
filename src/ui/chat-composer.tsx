'use client';

import { FormEvent, KeyboardEvent, useRef, useState } from 'react';

const LIGHT = {
  surface:   'rgba(255,255,255,0.65)',
  surfaceFocus: 'rgba(255,255,255,0.82)',
  border:    'rgba(26,95,188,0.18)',
  borderFocus: 'rgba(26,95,188,0.35)',
  grad:      'linear-gradient(135deg, #1a5fbc, #00bcd4)',
  text:      '#0b1829',
  textFaint: '#8aaac4',
  disabledBg:'rgba(26,95,188,0.08)',
  error:     '#dc2626',
  errorBg:   'rgba(220,38,38,0.07)',
  errorBorder:'rgba(220,38,38,0.2)',
  shadow:    '0 4px 20px rgba(26,95,188,0.08), 0 2px 6px rgba(0,0,0,0.04)',
  shadowFocus:'0 8px 32px rgba(26,95,188,0.15), 0 2px 8px rgba(0,0,0,0.06)',
} as const;

const DARK = {
  surface:   'rgba(12,22,42,0.85)',
  surfaceFocus: 'rgba(15,28,52,0.95)',
  border:    'rgba(26,95,188,0.25)',
  borderFocus: 'rgba(26,95,188,0.5)',
  grad:      'linear-gradient(135deg, #1a5fbc, #00bcd4)',
  text:      '#ddeeff',
  textFaint: '#3d5f7a',
  disabledBg:'rgba(26,95,188,0.08)',
  error:     '#f87171',
  errorBg:   'rgba(248,113,113,0.07)',
  errorBorder:'rgba(248,113,113,0.25)',
  shadow:    '0 4px 20px rgba(0,0,0,0.3)',
  shadowFocus:'0 8px 32px rgba(26,95,188,0.2)',
} as const;

const getP = (dark?: boolean) => dark ? DARK : LIGHT;

const GLOBAL_STYLES = `
  @keyframes spin       { to { transform: rotate(360deg); } }
  @keyframes gradBorder { 0%,100% { opacity:.6; } 50% { opacity:1; } }
  @keyframes sendPulse  { 0% { box-shadow: 0 0 0 0 rgba(26,95,188,0.5); }
                          70% { box-shadow: 0 0 0 8px rgba(26,95,188,0); }
                          100% { box-shadow: 0 0 0 0 rgba(26,95,188,0); } }
  .send-btn-active:hover { transform: scale(1.08); }
`;

export const ChatComposer = ({
  draft, sessionId, pendingResetProblem, error,
  isSubmitting, disabled, isDark, onChange, onSubmit, onResetProblem,
}: {
  draft: string;
  sessionId?: string;
  pendingResetProblem: boolean;
  error: string | null;
  isSubmitting: boolean;
  disabled?: boolean;
  isDark?: boolean;
  onChange: (v: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onResetProblem?: () => void;
}) => {
  const P       = getP(isDark);
  const taRef   = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const canSend = !disabled && !isSubmitting && draft.trim().length > 0;

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  const handleInput = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  };

  return (
    <div>
      <style>{GLOBAL_STYLES}</style>

      {error && (
        <div style={{
          marginBottom: '10px', padding: '10px 14px', borderRadius: '10px',
          background: P.errorBg, border: `1px solid ${P.errorBorder}`,
          color: P.error, fontSize: '0.87rem',
        }}>
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} data-testid="chat-composer">
        <div style={{ position: 'relative', borderRadius: '16px' }}>

          {/* Glow ring */}
          <div style={{
            position: 'absolute', inset: '-2px', borderRadius: '18px',
            background: 'linear-gradient(135deg, #1a5fbc, #00bcd4, #1a5fbc)',
            backgroundSize: '200% 200%',
            opacity: focused ? 0.6 : 0,
            transition: 'opacity 0.3s ease',
            animation: focused ? 'gradBorder 2s ease infinite' : 'none',
            zIndex: 0, pointerEvents: 'none',
          }} />

          {/* Input box */}
          <div style={{
            position: 'relative', zIndex: 1,
            display: 'flex', alignItems: 'flex-end', gap: '10px',
            background: focused ? P.surfaceFocus : P.surface,
            border: `1px solid ${focused ? P.borderFocus : P.border}`,
            borderRadius: '16px',
            padding: '12px 12px 12px 18px',
            backdropFilter: 'blur(16px)',
            boxShadow: focused ? P.shadowFocus : P.shadow,
            transition: 'all 0.25s ease',
          }}>
            <textarea
              ref={taRef}
              id="chat-input"
              value={draft}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={disabled ? 'Iniciá una nueva conversación para comenzar.' : 'Escribí tu problema de inventario…'}
              disabled={disabled || isSubmitting}
              rows={1}
              style={{
                flex: 1, resize: 'none', background: 'transparent',
                border: 'none', outline: 'none',
                color: P.text, fontSize: '0.94rem', lineHeight: 1.6,
                fontFamily: 'inherit', padding: '4px 0',
                minHeight: '28px', maxHeight: '160px',
                overflowY: 'auto', scrollbarWidth: 'none',
              }}
            />

            <button
              type="submit"
              disabled={!canSend}
              aria-label="Enviar"
              className={canSend ? 'send-btn-active' : ''}
              style={{
                width: '38px', height: '38px', minWidth: '38px',
                borderRadius: '11px', border: 'none',
                background: canSend ? P.grad : P.disabledBg,
                color: canSend ? '#fff' : P.textFaint,
                display: 'grid', placeItems: 'center',
                cursor: canSend ? 'pointer' : 'default',
                flexShrink: 0,
                transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                boxShadow: canSend ? '0 4px 16px rgba(26,95,188,0.35)' : 'none',
                animation: canSend ? 'sendPulse 2s ease infinite' : 'none',
                fontSize: '17px',
              }}
            >
              {isSubmitting ? (
                <span style={{
                  width: '14px', height: '14px', display: 'block',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff', borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }} />
              ) : '↑'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', padding: '0 4px' }}>
          <span style={{ fontSize: '0.71rem', color: P.textFaint }}>
            {pendingResetProblem
              ? '↩ El próximo mensaje inicia un problema nuevo'
              : 'Enter para enviar · Shift+Enter para salto de línea'}
          </span>
        </div>
      </form>
    </div>
  );
};
