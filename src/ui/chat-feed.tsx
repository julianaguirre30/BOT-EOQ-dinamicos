'use client';

import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { SolveResultCard } from './solve-result-card';
import { ChatEntry } from './types';

const LIGHT = {
  border:    'rgba(26,95,188,0.14)',
  blue:      '#1a5fbc',
  cyan:      '#00bcd4',
  grad:      'linear-gradient(135deg, #1a5fbc, #00bcd4)',
  text:      '#0b1829',
  textMuted: '#3a5a78',
  textFaint: '#8aaac4',
  botBubble: 'rgba(255,255,255,0.72)',
  userAvatar:'rgba(255,255,255,0.5)',
  thinking:  'rgba(255,255,255,0.72)',
} as const;

const DARK = {
  border:    'rgba(26,95,188,0.22)',
  blue:      '#4d8fd4',
  cyan:      '#00bcd4',
  grad:      'linear-gradient(135deg, #1a5fbc, #00bcd4)',
  text:      '#ddeeff',
  textMuted: '#7aaac8',
  textFaint: '#3d5f7a',
  botBubble: 'rgba(14,24,48,0.92)',
  userAvatar:'rgba(26,95,188,0.15)',
  thinking:  'rgba(14,24,48,0.85)',
} as const;

const getP = (dark?: boolean) => dark ? DARK : LIGHT;

// ─── Global keyframes ─────────────────────────────────────────────────────────
const STYLES = `
  @keyframes fadeSlideIn   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeSlideUp   { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:translateY(0)} }
  @keyframes bounce        { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-6px);opacity:1} }
  @keyframes gradMove      { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
  @keyframes avatarPulse   { 0%,100%{filter:drop-shadow(0 0 4px rgba(26,95,188,0.25))} 50%{filter:drop-shadow(0 0 12px rgba(0,188,212,0.55))} }
  @keyframes chipIn        { from{opacity:0;transform:translateY(6px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }

  .msg-bubble-bot  { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .msg-bubble-bot:hover  { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(26,95,188,0.12) !important; }
  .msg-bubble-user { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .msg-bubble-user:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,188,212,0.25) !important; }
  .chip-suggestion { transition: background 0.18s, transform 0.18s, box-shadow 0.18s; cursor: pointer; }
  .chip-suggestion:hover { background: rgba(26,95,188,0.1) !important; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(26,95,188,0.1); }
`;

// ─── Avatar ───────────────────────────────────────────────────────────────────
const BotAvatar = () => (
  <div style={{ width: '56px', height: '56px', minWidth: '56px', flexShrink: 0, animation: 'avatarPulse 3s ease-in-out infinite' }}>
    <DotLottieReact src="/Ai Robot Vector Art.lottie" loop autoplay style={{ width: '100%', height: '100%' }} />
  </div>
);

const UserAvatar = ({ isDark }: { isDark?: boolean }) => {
  const P = getP(isDark);
  return (
    <div style={{
      width: '32px', height: '32px', minWidth: '32px', borderRadius: '8px',
      background: P.userAvatar, border: `1px solid ${P.border}`,
      display: 'grid', placeItems: 'center', fontSize: '14px', flexShrink: 0,
    }}>
      👤
    </div>
  );
};

// ─── Thinking ─────────────────────────────────────────────────────────────────
const ThinkingBubble = ({ isDark }: { isDark?: boolean }) => {
  const P = getP(isDark);
  return (
    <div
      style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '24px', animation: 'fadeSlideIn 0.35s cubic-bezier(0.4,0,0.2,1)' }}
      data-testid="chat-turn-thinking"
    >
      <div style={{ width: '56px', height: '56px', minWidth: '56px', flexShrink: 0 }}>
        <DotLottieReact src="/Robot Automation Gif.lottie" loop autoplay style={{ width: '100%', height: '100%' }} />
      </div>
      <div style={{
        background: P.thinking, border: `1px solid ${P.border}`,
        borderRadius: '4px 18px 18px 18px', padding: '16px 20px',
        backdropFilter: 'blur(8px)', boxShadow: '0 2px 12px rgba(26,95,188,0.07)',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: '7px', height: '7px', borderRadius: '50%', background: P.blue,
            display: 'block', animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
};

// ─── Welcome ──────────────────────────────────────────────────────────────────
const WelcomeState = ({
  onStartProblem, isDark, compact,
}: {
  onStartProblem?: () => void;
  isDark?: boolean;
  compact?: boolean;
}) => {
  const P = getP(isDark);

  // Modo compacto: solo el botón, sin robot ni texto
  if (compact) {
    return onStartProblem ? (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0 8px', animation: 'fadeSlideUp 0.3s ease' }}>
        <button
          onClick={onStartProblem}
          style={{
            padding: '11px 28px', borderRadius: '999px',
            background: 'linear-gradient(135deg, #1a5fbc, #00bcd4)',
            color: '#fff', fontWeight: 700, fontSize: '0.9rem',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 20px rgba(26,95,188,0.3)',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
        >
          Resolver problema →
        </button>
      </div>
    ) : null;
  }

  // Modo completo: robot + título + descripción + botón
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px 40px', textAlign: 'center', gap: '20px' }}>
      <div style={{ width: '105px', height: '105px', animation: 'fadeSlideIn 0.5s ease' }}>
        <DotLottieReact src="/RobotSaludando.lottie" loop autoplay style={{ width: '100%', height: '100%' }} />
      </div>
      <div style={{ animation: 'fadeSlideUp 0.5s ease 0.1s both' }}>
        <h2 style={{
          fontSize: '1.6rem', fontWeight: 700, margin: '0 0 10px',
          background: 'linear-gradient(90deg, #0a3fa0, #00bcd4, #1a9be8, #0a3fa0)',
          backgroundSize: '300% auto',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          animation: 'gradMove 2.5s linear infinite',
        }}>
          ¿En qué te ayudo hoy?
        </h2>
        <p style={{ color: P.textMuted, fontSize: '0.95rem', margin: 0, lineHeight: 1.65, maxWidth: '400px' }}>
          Describí tu problema de inventario y encontramos el plan de pedidos óptimo.
        </p>
      </div>
      {onStartProblem && (
        <button
          onClick={onStartProblem}
          style={{
            padding: '12px 32px', borderRadius: '999px',
            background: 'linear-gradient(135deg, #1a5fbc, #00bcd4)',
            color: '#fff', fontWeight: 700, fontSize: '0.95rem',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 20px rgba(26,95,188,0.3)',
            animation: 'chipIn 0.4s ease 0.2s both',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
        >
          Resolver problema →
        </button>
      )}
    </div>
  );
};

// ─── Messages ─────────────────────────────────────────────────────────────────
const UserMessage = ({ entry, isDark }: { entry: ChatEntry; isDark?: boolean }) => {
  const P = getP(isDark);
  return (
    <div
      style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'flex-start', marginBottom: '20px', animation: 'fadeSlideIn 0.3s cubic-bezier(0.4,0,0.2,1)' }}
      data-testid="chat-turn-user"
    >
      <div className="msg-bubble-user" style={{
        maxWidth: 'min(78%, 580px)', background: P.grad, color: '#fff',
        borderRadius: '18px 18px 4px 18px', padding: '12px 16px',
        fontSize: '0.94rem', lineHeight: 1.6,
        boxShadow: '0 4px 16px rgba(26,95,188,0.22)',
      }}>
        {entry.text}
      </div>
      <UserAvatar isDark={isDark} />
    </div>
  );
};

const AssistantMessage = ({
  entry, isLast, isDark, onOptionSelect,
}: {
  entry: ChatEntry & { role: 'assistant' };
  isLast?: boolean;
  isDark?: boolean;
  onOptionSelect?: (value: string) => void;
}) => {
  const P = getP(isDark);
  return (
    <div
      style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '28px', animation: 'fadeSlideIn 0.35s cubic-bezier(0.4,0,0.2,1)' }}
      data-testid="chat-turn-assistant"
    >
      {isLast ? <BotAvatar /> : <div style={{ width: '56px', minWidth: '56px', flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="msg-bubble-bot" style={{
          background: P.botBubble, border: `1px solid ${P.border}`,
          borderRadius: '4px 18px 18px 18px', padding: '13px 16px',
          color: P.text, backdropFilter: 'blur(12px)',
          boxShadow: '0 2px 12px rgba(26,95,188,0.07)',
          fontSize: '0.94rem', lineHeight: 1.65,
          whiteSpace: 'pre-wrap',
        }}>
          {entry.text}
          {entry.options && entry.options.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
              {entry.options.map((opt: { label: string; value: string }) => (
                <button
                  key={opt.value}
                  type="button"
                  className="chip-suggestion"
                  onClick={() => onOptionSelect?.(opt.value)}
                  style={{
                    padding: '7px 14px', borderRadius: '999px',
                    border: `1px solid rgba(0,188,212,0.3)`,
                    background: 'rgba(0,188,212,0.08)', color: P.cyan,
                    fontSize: '0.85rem', fontWeight: 500, fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {entry.solvePayload && <SolveResultCard solvePayload={entry.solvePayload} isDark={isDark} />}
      </div>
    </div>
  );
};

// ─── Feed ─────────────────────────────────────────────────────────────────────
export const ChatFeed = ({
  entries,
  isThinking = false,
  showStartButton = false,
  isDark,
  onStartProblem,
  onOptionSelect,
}: {
  entries: ChatEntry[];
  isThinking?: boolean;
  showStartButton?: boolean;
  isDark?: boolean;
  onStartProblem?: () => void;
  onOptionSelect?: (value: string) => void;
}) => {
  if (showStartButton) return (
    <>
      <style>{STYLES}</style>
      {entries.map((entry) =>
        entry.role === 'user'
          ? <UserMessage key={entry.id} entry={entry} isDark={isDark} />
          : <AssistantMessage key={entry.id} entry={entry as ChatEntry & { role: 'assistant' }} isLast={false} isDark={isDark} onOptionSelect={onOptionSelect} />,
      )}
      <WelcomeState onStartProblem={onStartProblem} isDark={isDark} compact={entries.length > 0} />
    </>
  );

  return (
    <section aria-label="Conversación" data-testid="chat-feed">
      <style>{STYLES}</style>
      {entries.map((entry, i) => {
        const isLastAssistant = entry.role === 'assistant' &&
          !isThinking &&
          entries.slice(i + 1).every(e => e.role === 'user');
        return entry.role === 'user'
          ? <UserMessage key={entry.id} entry={entry} isDark={isDark} />
          : <AssistantMessage key={entry.id} entry={entry as ChatEntry & { role: 'assistant' }} isLast={isLastAssistant} isDark={isDark} onOptionSelect={onOptionSelect} />;
      })}
      {isThinking && <ThinkingBubble isDark={isDark} />}
    </section>
  );
};
