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
    border: '1px solid rgba(148, 163, 184, 0.14)',
    boxShadow: '0 10px 32px rgba(15, 23, 42, 0.18)',
  } as CSSProperties,
  userBubble: {
    alignSelf: 'flex-end',
    background: 'linear-gradient(135deg, rgba(126, 34, 206, 0.96), rgba(79, 70, 229, 0.94))',
  } as CSSProperties,
  assistantBubble: {
    background: 'rgba(10, 16, 31, 0.94)',
    borderLeft: '3px solid #60a5fa',
  } as CSSProperties,
  emptyState: {
    borderRadius: '24px',
    padding: '18px',
    background: 'rgba(10, 16, 31, 0.6)',
    border: '1px dashed rgba(129, 140, 248, 0.24)',
    color: '#cbd5e1',
  } as CSSProperties,
  muted: {
    color: '#cbd5e1',
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
      <article style={feedStyles.emptyState}>
        <p style={feedStyles.muted}>
          Todavía no hay turnos. Mandá un mensaje y vas a ver una conversación continua, con los datos integrados en cada respuesta del tutor.
        </p>
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
          {entry.role === 'assistant' ? <ChatResponseCard response={entry.payload.response} /> : null}
        </article>
      ))}
    </section>
  );
};
