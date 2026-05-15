'use client';

import Link from 'next/link';
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
    background: 'linear-gradient(180deg, #f8fffb 0%, #ffffff 48%, #f7fff8 100%)',
    color: '#0f172a',
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
    padding: '32px 32px',
    background: '#ffffff',
    border: '1px solid rgba(16, 185, 129, 0.18)',
    boxShadow: '0 24px 80px rgba(16, 185, 129, 0.14)',
  },
  heroHeading: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '14px',
  },
  heroButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '999px',
    padding: '10px 14px',
    border: '1px solid #047857',
    background: 'transparent',
    color: '#047857',
    fontWeight: 700,
    textDecoration: 'none',
    width: 'fit-content',
  },
  startButtonArea: {
    display: 'flex',
    justifyContent: 'center',
    padding: '20px 18px',
    borderBottom: '1px solid rgba(16, 185, 129, 0.12)',
    background: '#f7fff8',
  },
  startButton: {
    borderRadius: '999px',
    border: '1px solid #047857',
    background: '#047857',
    color: '#ffffff',
    padding: '14px 22px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 10px 30px rgba(16, 185, 129, 0.25)',
  },
  conversationShell: {
    minHeight: 'calc(100vh - 220px)',
    display: 'flex',
    flexDirection: 'column' as const,
    borderRadius: '28px',
    overflow: 'hidden',
    background: '#ffffff',
    border: '1px solid rgba(16, 185, 129, 0.18)',
    boxShadow: '0 18px 50px rgba(16, 185, 129, 0.12)',
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
    background: 'rgba(16, 185, 129, 0.16)',
    border: '1px solid rgba(16, 185, 129, 0.24)',
    color: '#047857',
    fontSize: '12px',
    fontWeight: 700,
  },
  muted: { color: '#475569' },
} as const;

const initialEntries: ChatEntry[] = [
  {
    id: 'assistant-welcome',
    role: 'assistant',
    text: 'Hola, soy tu asistente EOQ. ¿Querés resolver un problema?',
  },
];

const initialProblemData = {
  periodCount: 0,
  demands: [] as number[],
  hasOrderCost: undefined as boolean | undefined,
  orderCost: undefined as number | undefined,
  holdingCost: undefined as number | undefined,
};

export const ChatResponseCard = ({ response }: { response: PublicResponseEnvelope }) => {
  // For resolved follow-ups, show simple summary
  if (response.threadContext?.phase === 'resolved_follow_up') {
    return (
      <div style={{ marginTop: '12px', color: '#0c1425', fontSize: '0.9rem' }}>
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
        <div style={{ color: '#0c1425', marginBottom: '10px' }}>
          <strong>Modelo:</strong> {identifiedModel}
        </div>
        <div style={{ color: '#0c1425', marginBottom: '10px' }}>
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
  const [draft, setDraft] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [entries, setEntries] = useState<ChatEntry[]>(initialEntries);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingResetProblem, setPendingResetProblem] = useState(false);
  const [step, setStep] = useState<'welcome' | 'periodCount' | 'demands' | 'hasOrderCost' | 'orderCost' | 'holdingCost' | 'completed'>('welcome');
  const [problemData, setProblemData] = useState(initialProblemData);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedStep = localStorage.getItem('chatStep');
    const savedProblemData = localStorage.getItem('problemData');
    const savedEntries = localStorage.getItem('chatEntries');
    const savedSessionId = localStorage.getItem('sessionId');

    if (savedStep) {
      setStep(savedStep as any);
    }
    if (savedProblemData) {
      try {
        const parsed = JSON.parse(savedProblemData);
        if (parsed.periodCount > 0) {
          setProblemData(parsed);
        }
      } catch (e) {
        console.error('Error parsing problemData from localStorage:', e);
      }
    }
    if (savedEntries) {
      try {
        const parsed = JSON.parse(savedEntries);
        if (parsed.length > 1) { // Only load if there are more than just the welcome message
          setEntries(parsed);
        }
      } catch (e) {
        console.error('Error parsing entries from localStorage:', e);
      }
    }
    if (savedSessionId) {
      setSessionId(savedSessionId);
    }
  }, []);

  // Clear localStorage when resetting problem
  useEffect(() => {
    if (pendingResetProblem) {
      localStorage.removeItem('chatStep');
      localStorage.removeItem('problemData');
      localStorage.removeItem('chatEntries');
      localStorage.removeItem('sessionId');
    }
  }, [pendingResetProblem]);

  const resetConversation = () => {
    setDraft('');
    setError(null);
    setIsSubmitting(false);
    setSessionId(undefined);
    setStep('welcome');
    setProblemData(initialProblemData);
    setEntries(initialEntries);
    setPendingResetProblem(false);
    localStorage.removeItem('chatStep');
    localStorage.removeItem('problemData');
    localStorage.removeItem('chatEntries');
    localStorage.removeItem('sessionId');
  };

  const startProblem = () => {
    const userStartEntry = { id: `user-${crypto.randomUUID()}`, role: 'user' as const, text: 'Resolver problema' };
    setEntries((current) => {
      const newEntries = [...current, userStartEntry];
      localStorage.setItem('chatEntries', JSON.stringify(newEntries));
      return newEntries;
    });
    setStep('periodCount');
    localStorage.setItem('chatStep', 'periodCount');
    appendAssistantMessage('¿Cuántos períodos querés analizar?');
  };

  const feedViewportRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoFollowRef = useRef(true);

  useEffect(() => {
    const viewport = feedViewportRef.current;

    if (!viewport || !shouldAutoFollowRef.current) {
      return;
    }

    viewport.scrollTop = viewport.scrollHeight;
  }, [entries]);

  const appendAssistantMessage = (text: string) => {
    setEntries((current) => {
      const newEntries = [
        ...current,
        { id: `assistant-${crypto.randomUUID()}`, role: 'assistant' as const, text },
      ];
      localStorage.setItem('chatEntries', JSON.stringify(newEntries));
      return newEntries;
    });
  };

  const appendAssistantOptions = (text: string, options: Array<{ label: string; value: string }>) => {
    setEntries((current) => {
      const newEntries = [
        ...current,
        { id: `assistant-${crypto.randomUUID()}`, role: 'assistant' as const, text, options },
      ];
      localStorage.setItem('chatEntries', JSON.stringify(newEntries));
      return newEntries;
    });
  };

  const handleOptionSelect = (value: string) => {
    if (step !== 'hasOrderCost') {
      return;
    }

    const userEntry = { id: `user-${crypto.randomUUID()}`, role: 'user' as const, text: value };
    setEntries((current) => {
      const newEntries = [...current, userEntry];
      localStorage.setItem('chatEntries', JSON.stringify(newEntries));
      return newEntries;
    });

    const normalized = value.toLowerCase().trim();
    const yes = /^(s|si|sí|yes|y)$/i.test(normalized);
    const no = /^(n|no)$/i.test(normalized);

    if (!yes && !no) {
      appendAssistantMessage('Respondé con sí o no. ¿El problema tiene costo de pedido fijo?');
      return;
    }

    const hasOrderCost = yes;
    setProblemData((current) => {
      const newData = { ...current, hasOrderCost };
      localStorage.setItem('problemData', JSON.stringify(newData));
      return newData;
    });

    if (hasOrderCost) {
      setStep('orderCost');
      localStorage.setItem('chatStep', 'orderCost');
      appendAssistantMessage('Ingresá el costo de pedido fijo.');
    } else {
      setStep('holdingCost');
      localStorage.setItem('chatStep', 'holdingCost');
      appendAssistantMessage('Perfecto. Ahora ingresá el costo de almacenamiento por unidad y período.');
    }
  };

  const parseNumberList = (text: string) =>
    text
      .split(/[,\s]+/)
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => Number(value));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const userText = draft.trim();

      if (!userText) {
        return;
      }

      if (step === 'welcome') {
        return;
      }

      setDraft('');
      setError(null);
      const newUserEntry = { id: `user-${crypto.randomUUID()}`, role: 'user' as const, text: userText };
      setEntries((current) => {
        const newEntries = [...current, newUserEntry];
        localStorage.setItem('chatEntries', JSON.stringify(newEntries));
        return newEntries;
      });

      const normalized = userText.toLowerCase().trim();

    if (step === 'periodCount') {
      const periodCount = Number(normalized);
      if (!Number.isInteger(periodCount) || periodCount <= 0) {
        appendAssistantMessage('No entendí ese número. Ingresá la cantidad de períodos como un número entero mayor que cero.');
        return;
      }
      setProblemData((current) => {
        const newData = { ...current, periodCount };
        localStorage.setItem('problemData', JSON.stringify(newData));
        return newData;
      });
      setStep('demands');
      localStorage.setItem('chatStep', 'demands');
      appendAssistantMessage(`Perfecto. Ingresá la demanda de cada uno de los ${periodCount} períodos, separadas por comas o espacios.`);
      return;
    }

    if (step === 'demands') {
      const values = parseNumberList(userText);
      const valid = values.every((value) => Number.isFinite(value) && value >= 0);
      if (!valid || values.length !== problemData.periodCount) {
        appendAssistantMessage(`Necesito ${problemData.periodCount} números válidos. Ingresá las demandas separadas por comas o espacios.`);
        return;
      }
      setProblemData((current) => {
        const newData = { ...current, demands: values };
        localStorage.setItem('problemData', JSON.stringify(newData));
        return newData;
      });
      setStep('hasOrderCost');
      localStorage.setItem('chatStep', 'hasOrderCost');
      appendAssistantOptions('¿El problema tiene costo de pedido fijo?', [
        { label: 'Sí', value: 'sí' },
        { label: 'No', value: 'no' },
      ]);
      return;
    }

    if (step === 'hasOrderCost') {
      const yes = /^(s|si|sí|yes|y)$/i.test(normalized);
      const no = /^(n|no)$/i.test(normalized);
      if (!yes && !no) {
        appendAssistantMessage('Respondé con sí o no. ¿El problema tiene costo de pedido fijo?');
        return;
      }
      const hasOrderCost = yes;
      setProblemData((current) => {
        const newData = { ...current, hasOrderCost };
        localStorage.setItem('problemData', JSON.stringify(newData));
        return newData;
      });
      if (hasOrderCost) {
        setStep('orderCost');
        localStorage.setItem('chatStep', 'orderCost');
        appendAssistantMessage('Ingresá el costo de pedido fijo.');
      } else {
        setStep('holdingCost');
        localStorage.setItem('chatStep', 'holdingCost');
        appendAssistantMessage('Perfecto. Ahora ingresá el costo de almacenamiento por unidad y período.');
      }
      return;
    }

    if (step === 'orderCost') {
      const orderCost = Number(userText.replace(/[^0-9.,-]/g, '').replace(',', '.'));
      if (!Number.isFinite(orderCost) || orderCost < 0) {
        appendAssistantMessage('Ingresá un valor numérico válido para el costo de pedido.');
        return;
      }
      setProblemData((current) => {
        const newData = { ...current, orderCost };
        localStorage.setItem('problemData', JSON.stringify(newData));
        return newData;
      });
      setStep('holdingCost');
      localStorage.setItem('chatStep', 'holdingCost');
      appendAssistantMessage('Ahora ingresá el costo de almacenamiento por unidad y período.');
      return;
    }

    if (step === 'holdingCost') {
      const holdingCost = Number(userText.replace(/[^0-9.,-]/g, '').replace(',', '.'));
      if (!Number.isFinite(holdingCost) || holdingCost < 0) {
        appendAssistantMessage('Ingresá un valor numérico válido para el costo de almacenamiento.');
        return;
      }
      const finalData = { ...problemData, holdingCost };
      setProblemData(finalData);
      localStorage.setItem('problemData', JSON.stringify(finalData));
      setStep('completed');
      localStorage.setItem('chatStep', 'completed');
      appendAssistantMessage('Perfecto, estoy calculando tu plan óptimo...');

      const prompt = `Tengo ${finalData.periodCount} períodos con demandas ${finalData.demands.join(', ')}. ` +
        `${finalData.hasOrderCost ? `El costo de pedido fijo es ${finalData.orderCost}. ` : 'No tiene costo de pedido fijo. '} ` +
        `El costo de almacenamiento es ${finalData.holdingCost} por unidad por período.`;

      const shouldReset = !!sessionId;

      try {
        setIsSubmitting(true);
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildChatTurnRequest({ sessionId, userText: prompt, pendingResetProblem: shouldReset })),
        });
        const payload = (await response.json()) as ChatTurnResponse | { error?: string };

        if (!response.ok || !('response' in payload)) {
          throw new Error('error' in payload && payload.error ? payload.error : 'No se pudo completar el cálculo.');
        }

        setSessionId(payload.sessionId);
        localStorage.setItem('sessionId', payload.sessionId);
        const assistantEntry = {
          id: `assistant-${crypto.randomUUID()}`,
          role: 'assistant' as const,
          text: payload.response.studentMessage,
          payload,
        };
        setEntries((current) => {
          const newEntries = [...current, assistantEntry];
          localStorage.setItem('chatEntries', JSON.stringify(newEntries));
          return newEntries;
        });
        setPendingResetProblem(false);
      } catch (submissionError) {
        setError(submissionError instanceof Error ? submissionError.message : 'Falló el envío del mensaje.');
      } finally {
        setIsSubmitting(false);
      }
      appendAssistantMessage('Si querés, podés preguntar algo sobre esta solución.');
      return;
    }

    if (step === 'completed') {
      if (!sessionId) {
        appendAssistantMessage('El problema ya terminó, pero no tengo una sesión activa. Presioná Nuevo problema para empezar de nuevo.');
        return;
      }

      try {
        setIsSubmitting(true);
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildChatTurnRequest({ sessionId, userText, pendingResetProblem: false })),
        });
        const payload = (await response.json()) as ChatTurnResponse | { error?: string };

        if (!response.ok || !('response' in payload)) {
          throw new Error('error' in payload && payload.error ? payload.error : 'No se pudo completar la pregunta.');
        }

        setSessionId(payload.sessionId);
        localStorage.setItem('sessionId', payload.sessionId);
        const assistantEntry = {
          id: `assistant-${crypto.randomUUID()}`,
          role: 'assistant' as const,
          text: payload.response.studentMessage,
          payload,
        };
        setEntries((current) => {
          const newEntries = [...current, assistantEntry];
          localStorage.setItem('chatEntries', JSON.stringify(newEntries));
          return newEntries;
        });
      } catch (submissionError) {
        setError(submissionError instanceof Error ? submissionError.message : 'Falló el envío del mensaje.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    appendAssistantMessage('La conversación ya terminó. Si querés iniciar un nuevo problema, hacelo con el botón Nuevo problema.');
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setError(error instanceof Error ? error.message : 'Ocurrió un error inesperado');
    }
  };

  const handleFeedScroll = () => {
    const viewport = feedViewportRef.current;
    if (!viewport) return;
    const isAtBottom = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 10;
    shouldAutoFollowRef.current = isAtBottom;
  };

  return (
    <main style={shellStyles.page}>
      <div style={shellStyles.container}>
        <section style={shellStyles.hero}>
          <span style={shellStyles.tag}>EOQ tutor MVP</span>
          <div style={shellStyles.heroHeading}>
            <Link href="/" style={shellStyles.heroButton} aria-label="Volver a bienvenida">
              ←
            </Link>
            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', margin: 0 }}>Tutor EOQ.</h1>
          </div>
          <p style={{ ...shellStyles.muted, fontSize: '1.05rem', maxWidth: '760px' }}>
            Escribí tu problema EOQ y seguí la conversación en un único flujo.
          </p>
        </section>

        <section style={shellStyles.conversationShell}>
          <div ref={feedViewportRef} style={shellStyles.feedViewport} onScroll={handleFeedScroll}>
            <ChatFeed
              entries={entries}
              showStartButton={step === 'welcome'}
              onStartProblem={startProblem}
              onOptionSelect={handleOptionSelect}
            />
          </div>
          <ChatComposer
            draft={draft}
            sessionId={sessionId}
            pendingResetProblem={pendingResetProblem}
            error={error}
            isSubmitting={isSubmitting}
            disabled={step === 'welcome'}
            onChange={setDraft}
            onSubmit={handleSubmit}
            onResetProblem={resetConversation}
          />
        </section>
      </div>
    </main>
  );
};
