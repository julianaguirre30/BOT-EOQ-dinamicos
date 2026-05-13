'use client';

import { CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { ChatTurnResponse } from '../app/runtime/chat-handler';
import { PublicResponseEnvelope, SolverInput } from '../contracts/eoq';
import { DataTable, KeyValueTable, ResponseSection, BulletList, chatComponentStyles } from './chat-components';
import { ChatFeed } from './chat-feed';
import { ChatComposer } from './chat-composer';
import { ChatEntry, DetectedDatum } from './types';
import {
  describeBranch,
  describeSolverFamily,
  buildAttentionPanel,
  buildRelevantCostLabel,
  buildDetectedData,
} from './formatters';
  
export const buildChatTurnRequest = ({
  sessionId,
  userText,
  pendingResetProblem,
}: {
  sessionId?: string;
  userText: string;
  pendingResetProblem: boolean;
}): { sessionId?: string; userText: string; resetProblem?: true } => ({
  ...(sessionId ? { sessionId } : {}),
  userText,
  ...(pendingResetProblem ? { resetProblem: true as const } : {}),
});

const shellStyles = {
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at top, rgba(91, 33, 182, 0.32), transparent 32%), linear-gradient(180deg, #050816 0%, #090d1f 45%, #05070f 100%)',
    color: '#f5f7ff',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    padding: '24px 20px 20px',
  },
  container: {
    maxWidth: '980px',
    margin: '0 auto',
    display: 'grid',
    gap: '18px',
  },
  hero: {
    borderRadius: '28px',
    padding: '24px 28px',
    background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.92), rgba(10, 16, 31, 0.92))',
    border: '1px solid rgba(129, 140, 248, 0.32)',
    boxShadow: '0 0 0 1px rgba(99, 102, 241, 0.14), 0 24px 80px rgba(22, 78, 255, 0.16)',
  },
  conversationShell: {
    minHeight: 'calc(100vh - 170px)',
    display: 'flex',
    flexDirection: 'column' as const,
    borderRadius: '28px',
    overflow: 'hidden',
    background: 'rgba(7, 12, 24, 0.78)',
    border: '1px solid rgba(96, 165, 250, 0.16)',
    boxShadow: '0 18px 50px rgba(15, 23, 42, 0.28)',
  },
  feedViewport: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '24px 18px 20px',
  },
  tag: {
    display: 'inline-flex',
    padding: '4px 10px',
    borderRadius: '999px',
    background: 'rgba(79, 70, 229, 0.18)',
    border: '1px solid rgba(129, 140, 248, 0.2)',
    color: '#c7d2fe',
    fontSize: '12px',
  },
  muted: { color: '#cbd5e1' },
} as const;


export const ChatResponseCard = ({ response }: { response: PublicResponseEnvelope }) => {
  // For resolved follow-ups, show simple summary
  if (response.threadContext?.phase === 'resolved_follow_up') {
    return (
      <div style={{ marginTop: '12px', color: '#cbd5e1', fontSize: '0.9rem' }}>
        <strong>Seguimiento:</strong>
        <ul style={{ margin: '6px 0 0', paddingLeft: '20px' }}>
          {[response.pedagogicalArtifacts.result[0], ...response.pedagogicalArtifacts.justification].map((item) => (
            <li key={item} style={{ marginTop: '4px' }}>
              {item}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Build data for tables
  const detectedData = useMemo(() => buildDetectedData(response), [response]);
  const attentionPanel = useMemo(() => buildAttentionPanel(response), [response]);
  const identifiedModel = describeBranch(
    response.solverInput?.branch ?? response.algorithmSelection.chosenBranch ?? response.interpretation.branchCandidate,
  );

  return (
    <div style={{ marginTop: '12px', fontSize: '0.95rem' }}>
      {/* Detected Data Table */}
      {detectedData.length > 0 && (
        <ResponseSection title="📊 Datos detectados">
          <KeyValueTable data={detectedData} />
        </ResponseSection>
      )}

      {/* Attention Items (if any) */}
      {attentionPanel.items.length > 0 && (
        <ResponseSection title={`⚠️ ${attentionPanel.title}`}>
          <BulletList items={attentionPanel.items} />
        </ResponseSection>
      )}

      {/* Replenishment Plan Table */}
      {response.solverOutput && (
        <>
          <ResponseSection title="📦 Plan de reposición">
            <DataTable
              columns={['Período', 'Cantidad a reponer', 'Cubre hasta']}
              rows={response.solverOutput.policy.replenishmentPlan.map((step) => [
                step.period.toString(),
                step.quantity.toString(),
                step.coversThroughPeriod.toString(),
              ])}
            />
          </ResponseSection>

          {/* Costs Table */}
          <ResponseSection title="💰 Análisis de costos">
            <DataTable
              columns={['Concepto', 'Valor']}
              rows={[
                [
                  buildRelevantCostLabel(response),
                  response.solverOutput.mathematicalArtifacts.costBreakdown.setupOrOrderingCost.toString(),
                ],
                [
                  'Costo de mantener total',
                  response.solverOutput.mathematicalArtifacts.costBreakdown.holdingCost.toString(),
                ],
                [
                  'Costo relevante total',
                  response.solverOutput.mathematicalArtifacts.costBreakdown.totalRelevantCost.toString(),
                ],
              ]}
            />
          </ResponseSection>
        </>
      )}

      {/* Model & Algorithm Info */}
      <ResponseSection title="🎯 Modelo y algoritmo">
        <div style={{ color: '#f8fafc', marginBottom: '10px' }}>
          <strong>Modelo:</strong> {identifiedModel}
        </div>
        <div style={{ color: '#f8fafc', marginBottom: '10px' }}>
          <strong>Algoritmo:</strong> {describeSolverFamily(response)}
        </div>
      </ResponseSection>

      {/* Justification (pedagogical explanation) */}
      {response.pedagogicalArtifacts.justification.length > 0 && (
        <ResponseSection title="💡 Explicación">
          <BulletList items={response.pedagogicalArtifacts.justification} />
        </ResponseSection>
      )}
    </div>
  );
};

export const ChatShell = () => {
  const [draft, setDraft] = useState('Tengo una demanda anual de 1200 unidades, costo de mantener 5 por unidad por año y no hay costo de preparación. ¿Cómo conviene reponer?');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingResetProblem, setPendingResetProblem] = useState(false);
  const feedViewportRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoFollowRef = useRef(true);

  useEffect(() => {
    const viewport = feedViewportRef.current;

    if (!viewport || !shouldAutoFollowRef.current) {
      return;
    }

    viewport.scrollTop = viewport.scrollHeight;
  }, [entries]);

  const handleFeedScroll = () => {
    const viewport = feedViewportRef.current;

    if (!viewport) {
      return;
    }

    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    shouldAutoFollowRef.current = distanceFromBottom < 96;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const userText = draft.trim();

    if (!userText) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setEntries((current) => [...current, { id: `user-${crypto.randomUUID()}`, role: 'user', text: userText }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildChatTurnRequest({ sessionId, userText, pendingResetProblem })),
      });
      const payload = (await response.json()) as ChatTurnResponse | { error?: string };

      if (!response.ok || !('response' in payload)) {
        throw new Error('error' in payload && payload.error ? payload.error : 'No se pudo completar el turno.');
      }

      setSessionId(payload.sessionId);
      setEntries((current) => [
        ...current,
        {
          id: `assistant-${crypto.randomUUID()}`,
          role: 'assistant',
          text: payload.response.studentMessage,
          payload,
        },
      ]);
      setDraft('');
      setPendingResetProblem(false);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Falló el envío del mensaje.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={shellStyles.page}>
      <div style={shellStyles.container}>
        <section style={shellStyles.hero}>
          <span style={shellStyles.tag}>EOQ tutor MVP</span>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', margin: '14px 0 10px' }}>Un chat continuo, claro y sin perder el hilo.</h1>
          <p style={{ ...shellStyles.muted, fontSize: '1.05rem', maxWidth: '760px' }}>
            Escribí tu problema EOQ y seguí la conversación en un único flujo. Cada respuesta del tutor mantiene la ficha estructurada, pero ahora vive dentro del chat y no como un bloque aislado.
          </p>
        </section>

        <section style={shellStyles.conversationShell}>
          <div ref={feedViewportRef} style={shellStyles.feedViewport} onScroll={handleFeedScroll}>
            <ChatFeed entries={entries} />
          </div>
          <ChatComposer
            draft={draft}
            sessionId={sessionId}
            pendingResetProblem={pendingResetProblem}
            error={error}
            isSubmitting={isSubmitting}
            onChange={setDraft}
            onSubmit={handleSubmit}
            onResetProblem={() => setPendingResetProblem(true)}
          />
        </section>
      </div>
    </main>
  );
};
