'use client';

import { CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { ChatTurnResponse } from '../app/runtime/chat-handler';
import { PublicResponseEnvelope, SolverInput } from '../contracts/eoq';

export type ChatEntry =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; text: string; payload: ChatTurnResponse };

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
  feed: {
    display: 'grid',
    gap: '14px',
    alignContent: 'start',
  },
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
  },
  userBubbleCard: {
    alignSelf: 'flex-end',
    background: 'linear-gradient(135deg, rgba(126, 34, 206, 0.96), rgba(79, 70, 229, 0.94))',
  },
  assistantBubbleCard: {
    background: 'rgba(10, 16, 31, 0.94)',
    borderLeft: '3px solid #60a5fa',
  },
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
  card: {
    borderRadius: '22px',
    background: 'linear-gradient(180deg, rgba(10, 16, 31, 0.98), rgba(15, 23, 42, 0.98))',
    border: '1px solid rgba(129, 140, 248, 0.24)',
    padding: '18px',
    display: 'grid',
    gap: '14px',
    maxWidth: 'min(100%, 860px)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
  },
  panel: {
    borderRadius: '18px',
    background: 'rgba(15, 23, 42, 0.82)',
    border: '1px solid rgba(148, 163, 184, 0.12)',
    padding: '14px',
  },
  muted: { color: '#cbd5e1' },
  tag: {
    display: 'inline-flex',
    padding: '4px 10px',
    borderRadius: '999px',
    background: 'rgba(79, 70, 229, 0.18)',
    border: '1px solid rgba(129, 140, 248, 0.2)',
    color: '#c7d2fe',
    fontSize: '12px',
  },
  emptyState: {
    borderRadius: '24px',
    padding: '18px',
    background: 'rgba(10, 16, 31, 0.6)',
    border: '1px dashed rgba(129, 140, 248, 0.24)',
  },
} as const;

const getTurnStyle = (role: ChatEntry['role']): CSSProperties =>
  role === 'assistant'
    ? { ...shellStyles.turn, ...shellStyles.turnAssistant }
    : { ...shellStyles.turn, ...shellStyles.turnUser };

const getBubbleStyle = (role: ChatEntry['role']): CSSProperties =>
  role === 'assistant'
    ? { ...shellStyles.bubble, ...shellStyles.assistantBubbleCard }
    : { ...shellStyles.bubble, ...shellStyles.userBubbleCard };

type DetectedDatum = {
  label: string;
  value: string;
};

const VALUE_ALIASES = {
  demandRate: ['demandRate', 'annualDemand', 'demand', 'demandPerPeriod', 'D'],
  periodDemands: ['periodDemands', 'demandSchedule', 'demand', 'weeklyDemand', 'demands'],
  holdingCost: ['holdingCost', 'holdingCostPerUnitPerYear', 'unitHoldingCost', 'h'],
  setupCost: ['setupCost', 'orderingCost', 'orderCost', 'S', 'K'],
   unitCost: ['unitCost', 'purchaseCost', 'productionCost', 'c'],
   unitCostByPeriod: ['unitCostByPeriod', 'purchaseCostByPeriod', 'productionCostByPeriod', 'purchaseCost', 'productionCost'],
  leadTime: ['leadTime', 'lead_time'],
} as const;

const describeBranch = (branch?: SolverInput['branch'] | PublicResponseEnvelope['interpretation']['branchCandidate']) => {
  if (branch === 'with_setup') {
    return 'EOQ determinístico con costo fijo de preparación/pedido';
  }

  if (branch === 'no_setup') {
    return 'EOQ determinístico sin costo fijo de preparación/pedido';
  }

  return 'Pendiente de confirmación';
};

const describeSolverFamily = (response: PublicResponseEnvelope) => {
  if (response.algorithmSelection.solverFamily === 'exact_with_setup') {
    return 'Programación dinámica exacta';
  }

  if (response.algorithmSelection.solverFamily === 'exact_no_setup') {
    return response.solverInput?.variant === 'unit_cost_by_period'
      ? 'Programación dinámica exacta sin setup con costo unitario por período'
      : 'Política exacta lote-por-lote';
  }

  return 'Todavía no aplica';
};

const humanizeValidationReason = (value: string): string => {
  switch (value) {
    case 'missing_demand_rate':
      return 'Falta la demanda o el cronograma de demandas.';
    case 'missing_holding_cost':
      return 'Falta el costo de mantener inventario.';
    case 'missing_setup_cost':
      return 'Falta el costo fijo de preparación/pedido.';
    case 'invalid_demand_rate':
    case 'invalid_demand_schedule':
      return 'La demanda informada no es válida para resolver.';
    case 'invalid_holding_cost':
      return 'El costo de mantener debe ser positivo.';
    case 'invalid_setup_cost':
      return 'El costo fijo debe ser positivo.';
    case 'invalid_setup_cost_by_period':
      return 'Los costos de preparación por período deben ser positivos.';
    case 'invalid_setup_cost_by_period_length':
      return 'La cantidad de costos de preparación por período no coincide con la demanda.';
    case 'invalid_unit_cost_by_period':
      return 'Los costos unitarios por período no pueden ser negativos.';
    case 'invalid_unit_cost_by_period_length':
      return 'La cantidad de costos unitarios por período no coincide con la demanda.';
    case 'invalid_lead_time':
      return 'El lead time no puede ser negativo.';
    case 'incompatible_units_or_time_basis':
      return 'Hay unidades o bases de tiempo incompatibles.';
    case 'conflicting_setup_and_no_setup_cost_structure':
      return 'Hay una mezcla incompatible entre setup positivo y una formulación solo sin setup.';
    default:
      return value.replaceAll('_', ' ');
  }
};

const buildAttentionPanel = (response: PublicResponseEnvelope): {
  title: string;
  items: string[];
  emptyMessage: string;
} => {
  if (response.mode === 'refuse') {
    if (response.refusal?.kind === 'out_of_domain') {
      return {
        title: 'Alcance del caso',
        items: [response.refusal.message],
        emptyMessage: 'No corresponde pedir datos adicionales para este caso.',
      };
    }

    if (response.refusal?.kind === 'invalid_input') {
      return {
        title: 'Datos a corregir',
        items: response.refusal.reasons.map(humanizeValidationReason),
        emptyMessage: 'No hay datos faltantes: hay que corregir inconsistencias.',
      };
    }

    return {
      title: 'Estado de implementación',
      items: response.refusal ? [response.refusal.message] : [],
      emptyMessage: 'No hay datos faltantes para mostrar.',
    };
  }

  if (response.mode === 'clarify' && response.clarificationRequest?.reason !== 'missing_critical') {
    const clarificationRequest = response.clarificationRequest;

    return {
      title: 'Puntos a aclarar',
      items:
        clarificationRequest && clarificationRequest.requiredFields.length > 0
          ? clarificationRequest.requiredFields
          : clarificationRequest
            ? [clarificationRequest.question]
            : [],
      emptyMessage: 'No hay datos faltantes críticos cargados todavía.',
    };
  }

  return {
    title: 'Datos faltantes',
    items: response.clarificationRequest?.requiredFields ?? response.interpretation.missingCriticalFields,
    emptyMessage: 'No faltan datos críticos.',
  };
};

const buildRelevantCostLabel = (response: PublicResponseEnvelope): string => {
  if (response.solverInput?.branch === 'with_setup') {
    return 'Costo fijo total';
  }

  if (response.solverInput?.variant === 'unit_cost_by_period' || response.solverInput?.unitCost !== undefined) {
    return 'Costo de compra/producción total';
  }

  return 'Costo relevante sin setup';
};

const formatValue = (value: unknown): string => (Array.isArray(value) ? `[${value.join(', ')}]` : String(value));

const getFirstAliasValue = (payload: Record<string, unknown>, aliases: readonly string[]) => {
  for (const alias of aliases) {
    if (payload[alias] !== undefined) {
      return payload[alias];
    }
  }

  return undefined;
};

const buildDetectedData = (response: PublicResponseEnvelope): DetectedDatum[] => {
  const extracted = response.interpretation.extractedValues;
  const normalized = response.validation?.normalizedInput ?? response.solverInput;
  const items: DetectedDatum[] = [];

  const addDatum = (label: string, value: unknown) => {
    if (value === undefined) {
      return;
    }

    items.push({ label, value: formatValue(value) });
  };

  addDatum('Demanda por períodos', normalized?.periodDemands ?? getFirstAliasValue(extracted, VALUE_ALIASES.periodDemands));
  addDatum('Demanda agregada', normalized?.demandRate ?? getFirstAliasValue(extracted, VALUE_ALIASES.demandRate));
  addDatum('Costo de mantener', normalized?.holdingCost ?? getFirstAliasValue(extracted, VALUE_ALIASES.holdingCost));
  if (normalized?.branch === 'with_setup') {
    addDatum(
      'Costo fijo de preparación/pedido',
      normalized.variant === 'setup_by_period'
        ? normalized.setupCostByPeriod
        : normalized.setupCost ?? getFirstAliasValue(extracted, VALUE_ALIASES.setupCost),
    );
  } else if (normalized?.variant === 'unit_cost_by_period') {
    addDatum(
      'Costo unitario por período',
      normalized.unitCostByPeriod ?? getFirstAliasValue(extracted, VALUE_ALIASES.unitCostByPeriod),
    );
  } else {
    addDatum('Costo unitario', normalized?.unitCost ?? getFirstAliasValue(extracted, VALUE_ALIASES.unitCost));
  }
  addDatum('Lead time', normalized?.leadTime ?? getFirstAliasValue(extracted, VALUE_ALIASES.leadTime));

  return items;
};

const formatPlanStep = (period: number, quantity: number, coversThroughPeriod: number): string =>
  coversThroughPeriod === period
    ? `Período ${period}: reponer ${quantity} unidades para ese mismo período.`
    : `Período ${period}: reponer ${quantity} unidades para cubrir hasta el período ${coversThroughPeriod}.`;

export const ChatResponseCard = ({ response }: { response: PublicResponseEnvelope }) => {
  const detectedData = useMemo(() => buildDetectedData(response), [response]);
  const attentionPanel = useMemo(() => buildAttentionPanel(response), [response]);
  const identifiedModel = describeBranch(
    response.solverInput?.branch ?? response.algorithmSelection.chosenBranch ?? response.interpretation.branchCandidate,
  );
  const resultLines = response.solverOutput
    ? [
        `Plan completo: ${response.solverOutput.policy.replenishmentPlan.length} pedido(s)/lote(s) en el horizonte.`,
        ...response.solverOutput.policy.replenishmentPlan.map((step) =>
          formatPlanStep(step.period, step.quantity, step.coversThroughPeriod),
        ),
        `${buildRelevantCostLabel(response)}: ${response.solverOutput.mathematicalArtifacts.costBreakdown.setupOrOrderingCost}`,
        `Costo de mantener total: ${response.solverOutput.mathematicalArtifacts.costBreakdown.holdingCost}`,
        `Costo relevante total: ${response.solverOutput.mathematicalArtifacts.costBreakdown.totalRelevantCost}`,
      ]
    : ['Todavía no hay resultado final porque el backend pidió aclaración o bloqueó el caso.'];

  return (
    <section style={shellStyles.card}>
      <div style={shellStyles.grid}>
        <div style={shellStyles.panel}>
          <div style={shellStyles.tag}>Datos detectados</div>
          <ul>
            {detectedData.length > 0 ? detectedData.map((item) => <li key={`${item.label}-${item.value}`}>{item.label}: {item.value}</li>) : <li>Sin datos detectados todavía.</li>}
          </ul>
        </div>
        <div style={shellStyles.panel}>
          <div style={shellStyles.tag}>{attentionPanel.title}</div>
          <ul>
            {attentionPanel.items.length > 0
              ? attentionPanel.items.map((item) => <li key={item}>{item}</li>)
              : <li>{attentionPanel.emptyMessage}</li>}
          </ul>
        </div>
        <div style={shellStyles.panel}>
          <div style={shellStyles.tag}>Modelo identificado</div>
          <p>{identifiedModel}</p>
          <p style={shellStyles.muted}>{response.pedagogicalArtifacts.model.join(' ')}</p>
        </div>
        <div style={shellStyles.panel}>
          <div style={shellStyles.tag}>Algoritmo</div>
          <p>{describeSolverFamily(response)}</p>
          <p style={shellStyles.muted}>{response.pedagogicalArtifacts.algorithm.join(' ')}</p>
        </div>
      </div>
      <div style={shellStyles.grid}>
        <div style={shellStyles.panel}>
          <div style={shellStyles.tag}>Resultado</div>
          <ul>{resultLines.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div style={shellStyles.panel}>
          <div style={shellStyles.tag}>Explicación</div>
          <ul>{response.pedagogicalArtifacts.justification.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </div>
    </section>
  );
};

export const ChatFeed = ({ entries }: { entries: ChatEntry[] }) => {
  if (entries.length === 0) {
    return (
      <article style={shellStyles.emptyState}>
        <p style={shellStyles.muted}>
          Todavía no hay turnos. Mandá un mensaje y vas a ver una conversación continua, con la card estructurada integrada en cada respuesta del tutor.
        </p>
      </article>
    );
  }

  return (
    <section style={shellStyles.feed} aria-label="Conversación" data-testid="chat-feed">
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

export const ChatComposer = ({
  draft,
  sessionId,
  error,
  isSubmitting,
  onChange,
  onSubmit,
}: {
  draft: string;
  sessionId?: string;
  error: string | null;
  isSubmitting: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => (
  <form style={shellStyles.inputWrap} onSubmit={onSubmit} data-testid="chat-composer">
    <label htmlFor="chat-input" style={{ display: 'block', marginBottom: '10px', fontWeight: 700 }}>
      Escribí tu siguiente mensaje
    </label>
    <textarea
      id="chat-input"
      style={shellStyles.textarea}
      value={draft}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Ejemplo: tengo demanda por períodos [40,20,40], setup 50 y holding 1..."
    />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '16px', flexWrap: 'wrap' as const }}>
      <span style={shellStyles.muted}>{sessionId ? `Sesión activa: ${sessionId}` : 'Todavía no arrancaste una sesión.'}</span>
      <button type="submit" style={shellStyles.button} disabled={isSubmitting}>
        {isSubmitting ? 'Pensando...' : 'Enviar mensaje'}
      </button>
    </div>
    {error ? <p style={{ color: '#fca5a5', marginTop: '12px' }}>{error}</p> : null}
  </form>
);

export const ChatShell = () => {
  const [draft, setDraft] = useState('Tengo una demanda anual de 1200 unidades, costo de mantener 5 por unidad por año y no hay costo de preparación. ¿Cómo conviene reponer?');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
        body: JSON.stringify({ sessionId, userText }),
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
            error={error}
            isSubmitting={isSubmitting}
            onChange={setDraft}
            onSubmit={handleSubmit}
          />
        </section>
      </div>
    </main>
  );
};
