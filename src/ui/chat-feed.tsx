'use client';

import { CSSProperties } from 'react';
import { ChatTurnResponse } from '../app/runtime/chat-handler';
import { ChatResponseCard } from './chat-shell';
import { ChatEntry } from './types';

const feedStyles = {
  feed: {
    display: 'grid',
    gap: '14px',
    alignContent: 'start',
  } as const,
  turn: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  turnUser: {
    alignItems: 'flex-end',
  },
  turnAssistant: {
    alignItems: 'stretch',
  },
  bubble: {
    maxWidth: 'min(100%, 720px)',
    borderRadius: '22px',
    padding: '14px 16px',
    lineHeight: 1.55,
    border: '1px solid rgba(16, 185, 129, 0.18)',
    boxShadow: '0 10px 32px rgba(16, 185, 129, 0.12)',
    background: '#ffffff',
    color: '#0f172a',
  } as CSSProperties,
  userBubble: {
    alignSelf: 'flex-end',
    background: 'linear-gradient(135deg, #10b981, #047857)',
    color: '#ffffff',
  } as CSSProperties,
  assistantBubble: {
    background: '#f7fff8',
    borderLeft: '3px solid #10b981',
    color: '#0f172a',
  } as CSSProperties,
  emptyState: {
    borderRadius: '24px',
    padding: '18px',
    background: '#f7fff8',
    border: '1px dashed rgba(16, 185, 129, 0.24)',
    color: '#0f172a',
  } as CSSProperties,
  muted: {
    color: '#475569',
  } as CSSProperties,
} as const;

const getTurnStyle = (role: ChatEntry['role']): CSSProperties =>
  role === 'assistant'
    ? { ...feedStyles.turn, ...feedStyles.turnAssistant }
    : { ...feedStyles.turn, ...feedStyles.turnUser };

const getBubbleStyle = (role: ChatEntry['role']): CSSProperties =>
  role === 'assistant'
    ? { ...feedStyles.bubble, ...feedStyles.assistantBubble }
    : { ...feedStyles.bubble, ...feedStyles.userBubble };

export const ChatFeed = ({ entries }: { entries: ChatEntry[] }) => {
  if (entries.length === 0) {
    return (
      <article style={feedStyles.turn} data-testid="chat-turn-assistant">
        <div style={feedStyles.bubble}>
          <strong>Tutor</strong>
          <p style={{ margin: '8px 0 0' }}>Hola, te ayudo a resolver tu problema de EOQ dinámico.</p>
        </div>
      </article>
    );
  }

  return (
    <section style={feedStyles.feed} aria-label="Conversación" data-testid="chat-feed">
      {entries.map((entry) => (
        <article key={entry.id} style={getTurnStyle(entry.role)} data-testid={`chat-turn-${entry.role}`}>
          <div style={getBubbleStyle(entry.role)}>
            <strong>{entry.role === 'assistant' ? 'Tutor' : 'Vos'}</strong>
            <p style={{ margin: '8px 0 0' }}>{entry.text}</p>
          </div>
          {entry.role === 'assistant' && entry.payload ? <ChatResponseCard response={entry.payload.response} /> : null}
        </article>
      ))}
    </section>
  );
};
