'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

import { SimpleChatResponse, GenericResponse, SolveResponse, FollowUpResponse } from '../app/runtime/simple-handler';
import { ChatFeed } from './chat-feed';
import { ChatComposer } from './chat-composer';
import { ChatEntry } from './types';

// ─── Paletas ──────────────────────────────────────────────────────────────────
const LIGHT = {
  pageBg:        'radial-gradient(ellipse at center, #ffffff 0%, #f4faff 35%, #e8f6fd 60%, #cceaf8 80%, #a8d8f0 100%)',
  sidebar:       'rgba(255,255,255,0.18)',
  sidebarBorder: 'rgba(26,95,188,0.1)',
  sidebarHover:  'rgba(26,95,188,0.07)',
  sidebarActive: 'rgba(26,95,188,0.13)',
  headerBg:      'rgba(255,255,255,0.18)',
  blue:          '#1a5fbc',
  cyan:          '#00bcd4',
  grad:          'linear-gradient(135deg, #1a5fbc, #00bcd4)',
  text:          '#0b1829',
  textMuted:     '#3a5a78',
  textFaint:     '#8aaac4',
  cardBg:        'rgba(255,255,255,0.75)',
  cardBorder:    'rgba(26,95,188,0.15)',
  toggleBg:      'rgba(26,95,188,0.08)',
  toggleBorder:  'rgba(26,95,188,0.2)',
} as const;

const DARK = {
  pageBg:        'radial-gradient(ellipse at center, #07101e 0%, #09152a 40%, #0c1a32 70%, #091525 100%)',
  sidebar:       'rgba(6,12,24,0.88)',
  sidebarBorder: 'rgba(26,95,188,0.18)',
  sidebarHover:  'rgba(26,95,188,0.1)',
  sidebarActive: 'rgba(26,95,188,0.22)',
  headerBg:      'rgba(6,12,24,0.82)',
  blue:          '#4d8fd4',
  cyan:          '#00bcd4',
  grad:          'linear-gradient(135deg, #1a5fbc, #00bcd4)',
  text:          '#ddeeff',
  textMuted:     '#7aaac8',
  textFaint:     '#3d5f7a',
  cardBg:        'rgba(14,24,48,0.92)',
  cardBorder:    'rgba(26,95,188,0.22)',
  toggleBg:      'rgba(26,95,188,0.12)',
  toggleBorder:  'rgba(26,95,188,0.3)',
} as const;

export const getPalette = (dark: boolean) => dark ? DARK : LIGHT;
export const P = getPalette(false); // compat


// ─── Sidebar ──────────────────────────────────────────────────────────────────
type StoredEntry = { id: string; role: 'user' | 'assistant'; text: string };
type ConvRecord  = { id: string; label: string; ts: number; entries?: StoredEntry[] };

const QUICK_EXAMPLES = [
  '¿Para qué sirve este modelo?',
  '¿Qué datos necesito para resolver un problema?',
  '¿Cuándo conviene usar Wagner-Whitin y no EOQ clásico?',
  '¿Qué significa el costo relevante total?',
  '¿Por qué a veces conviene pedir de más en un período?',
  '¿Qué pasa si no tengo costo fijo de pedido?',
  '¿El modelo funciona si la demanda es 0 en algún período?',
  '¿Cómo sé si el plan calculado es realmente el óptimo?',
];

const Sidebar = ({
  conversations, activeId, onSelect, onNew, collapsed, onToggle, onExampleSelect, isDark,
}: {
  conversations: ConvRecord[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  collapsed: boolean;
  onToggle: () => void;
  onExampleSelect: (text: string) => void;
  isDark?: boolean;
}) => {
  const palette = getPalette(isDark ?? false);
  const W = collapsed ? '60px' : '260px';

  return (
    <aside
      style={{
        width: W, minWidth: W, maxWidth: W,
        height: '100vh',
        background: palette.sidebar,
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        borderRight: `1px solid ${P.sidebarBorder}`,
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.22s ease, min-width 0.22s ease',
        overflow: 'hidden', flexShrink: 0, zIndex: 30,
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: '16px 12px',
          borderBottom: `1px solid ${palette.sidebarBorder}`,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          minHeight: '100px',
        }}
      >
        <img
          src="/isologo.png"
          alt="Simplex"
          onClick={onToggle}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          style={{
            width: collapsed ? '48px' : '88px',
            height: collapsed ? '48px' : '88px',
            objectFit: 'contain',
            flexShrink: 0,
            cursor: 'pointer',
            transition: 'width 0.22s ease, height 0.22s ease',
            filter: 'drop-shadow(0 2px 10px rgba(26,95,188,0.2))',
            margin: '0 auto',
          }}
        />
      </div>

      {/* New conversation */}
      <div style={{ padding: '12px 10px 8px' }}>
        <button
          onClick={onNew}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
            padding: collapsed ? '10px' : '10px 12px',
            borderRadius: '10px',
            border: `1px solid ${palette.sidebarBorder}`,
            background: 'transparent',
            cursor: 'pointer', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
            fontSize: '0.88rem', fontWeight: 400, color: palette.textMuted,
            justifyContent: collapsed ? 'center' : 'flex-start',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = palette.sidebarHover; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          <span style={{ fontSize: '20px', lineHeight: 1, flexShrink: 0, fontWeight: 300, color: palette.textMuted }}>+</span>
          {!collapsed && <span>Nueva conversación</span>}
        </button>
      </div>

      {/* Conversation list + Examples */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px', scrollbarWidth: 'none' }}>

        {/* Historial */}
        {!collapsed && conversations.length > 0 && (
          <>
            <div style={{ fontSize: '0.69rem', color: palette.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 4px 4px' }}>
              Recientes
            </div>
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '9px 10px', borderRadius: '8px', border: 'none',
                  background: c.id === activeId ? palette.sidebarActive : 'transparent',
                  color: c.id === activeId ? palette.blue : palette.textMuted,
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem',
                  textAlign: 'left', marginBottom: '2px', transition: 'background 0.15s', overflow: 'hidden',
                }}
                onMouseEnter={(e) => { if (c.id !== activeId) (e.currentTarget as HTMLButtonElement).style.background = palette.sidebarHover; }}
                onMouseLeave={(e) => { if (c.id !== activeId) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <span style={{ fontSize: '13px', flexShrink: 0 }}>💬</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
              </button>
            ))}
          </>
        )}

        {/* Collapsed: solo iconos de historial */}
        {collapsed && conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            title={c.label}
            style={{
              width: '100%', display: 'flex', justifyContent: 'center',
              padding: '10px', borderRadius: '8px', border: 'none',
              background: c.id === activeId ? palette.sidebarActive : 'transparent',
              color: palette.textMuted, cursor: 'pointer', marginBottom: '2px', fontSize: '13px',
            }}
          >
            💬
          </button>
        ))}

        {/* Ejemplos rápidos */}
        {!collapsed && (
          <div style={{ marginTop: conversations.length > 0 ? '16px' : '8px' }}>
            <div style={{ fontSize: '0.69rem', color: palette.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 4px 6px' }}>
              Ejemplos rápidos
            </div>
            {QUICK_EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => onExampleSelect(ex)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'flex-start', gap: '8px',
                  padding: '9px 10px', borderRadius: '8px', border: 'none',
                  background: 'transparent', color: palette.textMuted,
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem',
                  textAlign: 'left', marginBottom: '2px', transition: 'background 0.15s',
                  lineHeight: 1.45,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = palette.sidebarHover; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <span style={{ fontSize: '12px', flexShrink: 0, marginTop: '2px', opacity: 0.6 }}>↗</span>
                <span style={{
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>{ex}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {!collapsed && (
        <div style={{ padding: '12px 14px', borderTop: `1px solid ${palette.sidebarBorder}`, fontSize: '0.72rem', color: palette.textFaint, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 600, color: palette.textMuted, marginBottom: '2px' }}>Equipo Simplex · UTN</div>
          <div>Acosta · Aguirre · Boland</div>
          <div>Brizuela · Livio · Moray</div>
        </div>
      )}
    </aside>
  );
};

// ─── Shell ────────────────────────────────────────────────────────────────────
const initialEntries: ChatEntry[] = [];

const initialProblemData = {
  periodCount:  0,
  demands:      [] as number[],
  hasOrderCost: undefined as boolean | undefined,
  orderCost:    undefined as number | undefined,
  holdingCost:  undefined as number | undefined,
};

export const ChatShell = () => {
  const [draft,               setDraft]               = useState('');
  const [sessionId,           setSessionId]           = useState<string | undefined>();
  const [entries,             setEntries]             = useState<ChatEntry[]>(initialEntries);
  const [error,               setError]               = useState<string | null>(null);
  const [isSubmitting,        setIsSubmitting]        = useState(false);
  const [pendingResetProblem, setPendingResetProblem] = useState(false);
  const [step,                setStep]                = useState<'welcome' | 'periodCount' | 'demands' | 'hasOrderCost' | 'orderCost' | 'holdingCost' | 'completed'>('welcome');
  const [problemData,         setProblemData]         = useState(initialProblemData);
  const [sidebarCollapsed,    setSidebarCollapsed]    = useState(false);
  const [conversations,       setConversations]       = useState<ConvRecord[]>([]);
  const [activeConvId,        setActiveConvId]        = useState<string | undefined>();
  const [isDark,              setIsDark]              = useState(false);

  const feedViewportRef     = useRef<HTMLDivElement | null>(null);
  const shouldAutoFollowRef = useRef(true);

  // ── localStorage: cargar al montar ──────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem('simplex-conversations');
      if (stored) setConversations(JSON.parse(stored));
      const dark = localStorage.getItem('simplex-dark');
      if (dark === 'true') setIsDark(true);
    } catch { /* ignore */ }
  }, []);

  // ── localStorage: guardar preferencia de tema ────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem('simplex-dark', String(isDark)); } catch { /* ignore */ }
  }, [isDark]);

  // ── localStorage: guardar cuando cambia el historial (máx 3) ───────────────
  useEffect(() => {
    try {
      localStorage.setItem('simplex-conversations', JSON.stringify(conversations.slice(0, 3)));
    } catch { /* ignore */ }
  }, [conversations]);

  // ── Sincronizar mensajes en el registro activo ───────────────────────────────
  useEffect(() => {
    if (!activeConvId || entries.length === 0) return;
    const stored: StoredEntry[] = entries.map(e => ({ id: e.id, role: e.role as 'user' | 'assistant', text: e.text }));
    setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, entries: stored } : c));
  }, [entries, activeConvId]);

  useEffect(() => {
    const vp = feedViewportRef.current;
    if (!vp || !shouldAutoFollowRef.current) return;
    vp.scrollTop = vp.scrollHeight;
  }, [entries]);

  const handleFeedScroll = () => {
    const vp = feedViewportRef.current;
    if (!vp) return;
    shouldAutoFollowRef.current = vp.scrollHeight - vp.scrollTop - vp.clientHeight < 96;
  };

  // ── Helpers de mensajes ──────────────────────────────────────────────────────
  const appendAssistantMessage = (text: string) => {
    setEntries(prev => [...prev, { id: `assistant-${crypto.randomUUID()}`, role: 'assistant' as const, text }]);
  };

  const appendAssistantOptions = (text: string, options: Array<{ label: string; value: string }>) => {
    setEntries(prev => [...prev, { id: `assistant-${crypto.randomUUID()}`, role: 'assistant' as const, text, options }]);
  };

  // ── Resetear / nueva conversación ────────────────────────────────────────────
  const resetConversation = () => {
    const newId = crypto.randomUUID();
    setActiveConvId(newId);
    setDraft('');
    setError(null);
    setIsSubmitting(false);
    setSessionId(undefined);
    setStep('welcome');
    setProblemData(initialProblemData);
    setEntries(initialEntries);
    setPendingResetProblem(false);
  };

  // ── Seleccionar conversación del historial ────────────────────────────────────
  const handleSelectConversation = (id: string) => {
    const conv = conversations.find(c => c.id === id);
    setActiveConvId(id);
    setEntries(conv?.entries ? (conv.entries as ChatEntry[]) : initialEntries);
    setSessionId(undefined);
    setError(null);
    setDraft('');
    setStep('completed');
    setProblemData(initialProblemData);
    setPendingResetProblem(false);
  };

  // ── Botón "Resolver problema" en WelcomeState ─────────────────────────────────
  const startProblem = () => {
    const convId = activeConvId ?? crypto.randomUUID();
    setActiveConvId(convId);
    setConversations(prev => {
      if (prev.find(x => x.id === convId)) return prev;
      return [{ id: convId, label: 'Nuevo problema', ts: Date.now() }, ...prev].slice(0, 3);
    });
    setEntries(prev => [...prev, { id: `user-${crypto.randomUUID()}`, role: 'user' as const, text: 'Resolver problema' }]);
    setStep('periodCount');
    appendAssistantMessage('¿Cuántos períodos querés analizar?');
  };

  // ── Chip especial: nuevo problema ────────────────────────────────────────────
  const NEW_PROBLEM_VALUE = '__new_problem__';

  const startFreshProblem = () => {
    const newId = crypto.randomUUID();
    setActiveConvId(newId);
    setConversations(prev => [{ id: newId, label: 'Nuevo problema', ts: Date.now() }, ...prev].slice(0, 3));
    setDraft('');
    setError(null);
    setIsSubmitting(false);
    setSessionId(undefined);
    setProblemData(initialProblemData);
    setPendingResetProblem(false);
    setStep('periodCount');
    setEntries([{
      id: `assistant-${crypto.randomUUID()}`,
      role: 'assistant' as const,
      text: '¿Cuántos períodos querés analizar?',
    }]);
  };

  // ── Opciones sí/no ────────────────────────────────────────────────────────────
  const handleOptionSelect = (value: string) => {
    if (value === NEW_PROBLEM_VALUE) { startFreshProblem(); return; }
    if (step !== 'hasOrderCost') return;
    setEntries(prev => [...prev, { id: `user-${crypto.randomUUID()}`, role: 'user' as const, text: value }]);
    const yes = /^(s|si|sí|yes|y)$/i.test(value.toLowerCase().trim());
    const no  = /^(n|no)$/i.test(value.toLowerCase().trim());
    if (!yes && !no) { appendAssistantMessage('Respondé con sí o no. ¿El problema tiene costo de pedido fijo?'); return; }
    setProblemData(prev => ({ ...prev, hasOrderCost: yes }));
    if (yes) { setStep('orderCost');    appendAssistantMessage('Ingresá el costo de pedido fijo.'); }
    else     { setStep('holdingCost'); appendAssistantMessage('Perfecto. Ahora ingresá el costo de almacenamiento por unidad y período.'); }
  };

  const parseNumberList = (text: string) =>
    text.split(/[,\s]+/).map(v => v.trim()).filter(Boolean).map(Number);

  // ── Envío directo (desde ejemplos del sidebar) ────────────────────────────────
  const sendDirect = async (text: string) => {
    if (isSubmitting) return;
    setError(null);

    setEntries(prev => [...prev, { id: `user-${crypto.randomUUID()}`, role: 'user' as const, text }]);

    // Sin sesión: pregunta genérica conceptual, step se mantiene en 'welcome'
    if (!sessionId) {
      try {
        setIsSubmitting(true);
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'generic', userText: text }),
        });
        const payload = (await res.json()) as SimpleChatResponse | { error?: string };
        if (!res.ok || !('type' in payload))
          throw new Error('error' in payload && payload.error ? payload.error : 'No se pudo responder.');
        setEntries(prev => [...prev, {
          id: `assistant-${crypto.randomUUID()}`,
          role: 'assistant' as const,
          text: (payload as GenericResponse).message,
        }]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falló la consulta.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Con sesión activa: follow-up sobre el problema resuelto
    try {
      setIsSubmitting(true);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'followup', sessionId, userText: text }),
      });
      const payload = (await res.json()) as SimpleChatResponse | { error?: string };
      if (!res.ok || !('type' in payload))
        throw new Error('error' in payload && payload.error ? payload.error : 'No se pudo completar la pregunta.');
      const followUp = payload as FollowUpResponse;
      setEntries(prev => [...prev, {
        id: `assistant-${crypto.randomUUID()}`,
        role: 'assistant' as const,
        text: followUp.message,
        options: followUp.suggestsNewProblem
          ? [{ label: '↺ Resolver nuevo problema', value: NEW_PROBLEM_VALUE }]
          : undefined,
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falló el envío del mensaje.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Submit principal ──────────────────────────────────────────────────────────
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const userText = draft.trim();
      if (!userText) return;
      if (step === 'welcome') return;

      setDraft('');
      setError(null);
      setEntries(prev => [...prev, { id: `user-${crypto.randomUUID()}`, role: 'user' as const, text: userText }]);

      const normalized = userText.toLowerCase().trim();

      if (step === 'periodCount') {
        const periodCount = Number(normalized);
        if (!Number.isInteger(periodCount) || periodCount <= 0) {
          appendAssistantMessage('No entendí ese número. Ingresá la cantidad de períodos como un entero mayor que cero.');
          return;
        }
        setProblemData(prev => ({ ...prev, periodCount }));
        setStep('demands');
        appendAssistantMessage(`Perfecto. Ingresá la demanda de cada uno de los ${periodCount} períodos, separadas por comas o espacios.`);
        return;
      }

      if (step === 'demands') {
        const values = parseNumberList(userText);
        if (!values.every(v => Number.isFinite(v) && v >= 0) || values.length !== problemData.periodCount) {
          appendAssistantMessage(`Necesito ${problemData.periodCount} números válidos. Ingresá las demandas separadas por comas o espacios.`);
          return;
        }
        setProblemData(prev => ({ ...prev, demands: values }));
        setStep('hasOrderCost');
        appendAssistantOptions('¿El problema tiene costo de pedido fijo?', [
          { label: 'Sí', value: 'sí' },
          { label: 'No', value: 'no' },
        ]);
        return;
      }

      if (step === 'hasOrderCost') {
        const yes = /^(s|si|sí|yes|y)$/i.test(normalized);
        const no  = /^(n|no)$/i.test(normalized);
        if (!yes && !no) { appendAssistantMessage('Respondé con sí o no. ¿El problema tiene costo de pedido fijo?'); return; }
        setProblemData(prev => ({ ...prev, hasOrderCost: yes }));
        if (yes) { setStep('orderCost');    appendAssistantMessage('Ingresá el costo de pedido fijo.'); }
        else     { setStep('holdingCost'); appendAssistantMessage('Perfecto. Ahora ingresá el costo de almacenamiento por unidad y período.'); }
        return;
      }

      if (step === 'orderCost') {
        const orderCost = Number(userText.replace(/[^0-9.,-]/g, '').replace(',', '.'));
        if (!Number.isFinite(orderCost) || orderCost < 0) {
          appendAssistantMessage('Ingresá un valor numérico válido para el costo de pedido.');
          return;
        }
        setProblemData(prev => ({ ...prev, orderCost }));
        setStep('holdingCost');
        appendAssistantMessage('Ahora ingresá el costo de almacenamiento por unidad y período.');
        return;
      }

      if (step === 'holdingCost') {
        const holdingCost = Number(userText.replace(/[^0-9.]/g, ''));
        if (!Number.isFinite(holdingCost) || holdingCost <= 0) {
          appendAssistantMessage('Ingresá un valor numérico positivo para el costo de almacenamiento (usá punto como separador decimal, ej: 1.5).');
          return;
        }
        const finalData = { ...problemData, holdingCost };
        setProblemData(finalData);
        setStep('completed');
        appendAssistantMessage('Perfecto, calculando el plan óptimo...');

        try {
          setIsSubmitting(true);
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'solve',
              sessionId,
              periodDemands: finalData.demands,
              hasSetupCost:  finalData.hasOrderCost ?? false,
              setupCost:     finalData.orderCost,
              holdingCost:   finalData.holdingCost,
            }),
          });
          const payload = (await res.json()) as SimpleChatResponse | { error?: string };
          if (!res.ok || !('type' in payload))
            throw new Error('error' in payload && payload.error ? payload.error : 'No se pudo completar el cálculo.');
          const solvePayload = payload as SolveResponse;
          setSessionId(solvePayload.sessionId);
          setEntries(prev => [...prev, {
            id: `assistant-${crypto.randomUUID()}`,
            role: 'assistant' as const,
            text: solvePayload.message,
            solvePayload: {
              sessionId:   solvePayload.sessionId,
              solverInput: solvePayload.solverInput,
              solverOutput: solvePayload.solverOutput,
            },
          }]);
          appendAssistantMessage('¿Tenés alguna pregunta sobre el plan o los costos?');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Falló el cálculo.');
          setStep('holdingCost');
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      if (step === 'completed') {
        if (!sessionId) {
          appendAssistantMessage('No tengo una sesión activa. Iniciá un nuevo problema para continuar.');
          return;
        }
        try {
          setIsSubmitting(true);
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'followup', sessionId, userText }),
          });
          const payload = (await res.json()) as SimpleChatResponse | { error?: string };
          if (!res.ok || !('type' in payload))
            throw new Error('error' in payload && payload.error ? payload.error : 'No se pudo completar la pregunta.');
          const followUp = payload as FollowUpResponse;
          setEntries(prev => [...prev, {
            id: `assistant-${crypto.randomUUID()}`,
            role: 'assistant' as const,
            text: followUp.message,
            options: followUp.suggestsNewProblem
              ? [{ label: '↺ Resolver nuevo problema', value: NEW_PROBLEM_VALUE }]
              : undefined,
          }]);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Falló el envío del mensaje.');
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      appendAssistantMessage('La conversación ya terminó. Iniciá un nuevo problema para continuar.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
    }
  };

  const palette = getPalette(isDark);

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        background: palette.pageBg,
        color: palette.text,
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        overflow: 'hidden',
        transition: 'background 0.3s ease, color 0.3s ease',
      }}
    >
      {/* Ambient orbs */}
      <style>{`
        @keyframes orbFloat1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(40px,-50px) scale(1.06)} 66%{transform:translate(-25px,30px) scale(0.94)} }
        @keyframes orbFloat2 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-35px,40px) scale(1.08)} 66%{transform:translate(30px,-20px) scale(0.93)} }
        @keyframes orbFloat3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,35px) scale(1.04)} }
        .theme-toggle { transition: background 0.18s, transform 0.18s; }
        .theme-toggle:hover { transform: scale(1.1); }
      `}</style>
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:0 }}>
        <div style={{ position:'absolute', top:'10%', left:'15%', width:'320px', height:'320px', borderRadius:'50%', background:`radial-gradient(circle, ${isDark ? 'rgba(26,95,188,0.12)' : 'rgba(26,95,188,0.09)'} 0%, transparent 70%)`, animation:'orbFloat1 18s ease-in-out infinite' }} />
        <div style={{ position:'absolute', bottom:'15%', right:'10%', width:'400px', height:'400px', borderRadius:'50%', background:`radial-gradient(circle, ${isDark ? 'rgba(0,188,212,0.1)' : 'rgba(0,188,212,0.08)'} 0%, transparent 70%)`, animation:'orbFloat2 22s ease-in-out infinite' }} />
        <div style={{ position:'absolute', top:'50%', right:'25%', width:'250px', height:'250px', borderRadius:'50%', background:`radial-gradient(circle, ${isDark ? 'rgba(26,95,188,0.08)' : 'rgba(26,95,188,0.06)'} 0%, transparent 70%)`, animation:'orbFloat3 15s ease-in-out infinite' }} />
      </div>

      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeConvId}
        onSelect={handleSelectConversation}
        onNew={resetConversation}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
        onExampleSelect={(text) => sendDirect(text)}
        isDark={isDark}
      />

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, position: 'relative', zIndex: 1 }}>

        {/* Top bar */}
        <header
          style={{
            height: '52px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 20px',
            borderBottom: `1px solid ${palette.sidebarBorder}`,
            background: palette.headerBg,
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: palette.text }}>EOQ Dinámico</span>
            <span style={{
              fontSize: '0.7rem', color: palette.blue,
              background: palette.toggleBg,
              border: `1px solid ${palette.toggleBorder}`,
              borderRadius: '999px', padding: '2px 9px', fontWeight: 500,
            }}>
              Wagner-Whitin
            </span>
          </div>

          {/* Toggle día/noche estilo pill */}
          <div
            onClick={() => setIsDark(v => !v)}
            title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            style={{
              display: 'flex', alignItems: 'center',
              width: '100px', height: '36px', borderRadius: '999px',
              background: isDark ? '#1a2540' : '#e8f0fe',
              border: `1.5px solid ${isDark ? 'rgba(26,95,188,0.35)' : 'rgba(26,95,188,0.2)'}`,
              cursor: 'pointer', userSelect: 'none',
              position: 'relative', overflow: 'hidden',
              transition: 'background 0.35s ease, border 0.35s ease',
              flexShrink: 0,
            }}
          >
            {/* Texto */}
            <span style={{
              position: 'absolute',
              left: isDark ? '44px' : '14px',
              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
              color: isDark ? '#7aaac8' : '#1a5fbc',
              textTransform: 'uppercase',
              transition: 'left 0.35s cubic-bezier(0.4,0,0.2,1), color 0.35s',
              whiteSpace: 'nowrap',
            }}>
              {isDark ? 'Noche' : 'Día'}
            </span>

            {/* Círculo con icono */}
            <div style={{
              position: 'absolute',
              left: isDark ? '4px' : 'calc(100% - 40px)',
              width: '28px', height: '28px', borderRadius: '50%',
              background: isDark ? '#0d1829' : '#fff',
              boxShadow: isDark
                ? '0 2px 8px rgba(0,0,0,0.5)'
                : '0 2px 8px rgba(26,95,188,0.2)',
              display: 'grid', placeItems: 'center',
              fontSize: '14px',
              transition: 'left 0.35s cubic-bezier(0.4,0,0.2,1), background 0.35s',
            }}>
              {isDark ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#7aaac8' : '#1a5fbc'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a5fbc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              )}
            </div>
          </div>
        </header>

        {/* Feed */}
        <div
          ref={feedViewportRef}
          onScroll={handleFeedScroll}
          style={{
            flex: 1, overflowY: 'auto',
            padding: '32px 20px 16px',
            scrollbarWidth: 'thin',
            scrollbarColor: `rgba(26,95,188,0.15) transparent`,
          }}
        >
          <div style={{ maxWidth: '760px', margin: '0 auto' }}>
            <ChatFeed
              entries={entries}
              isThinking={isSubmitting}
              showStartButton={step === 'welcome'}
              isDark={isDark}
              onStartProblem={startProblem}
              onOptionSelect={handleOptionSelect}
            />
          </div>
        </div>

        {/* Composer */}
        <div style={{ flexShrink: 0, maxWidth: '800px', width: '100%', margin: '0 auto', padding: '0 20px 20px' }}>
          <ChatComposer
            draft={draft}
            sessionId={sessionId}
            pendingResetProblem={pendingResetProblem}
            error={error}
            isSubmitting={isSubmitting}
            disabled={step === 'welcome'}
            isDark={isDark}
            onChange={setDraft}
            onSubmit={handleSubmit}
            onResetProblem={resetConversation}
          />
        </div>
      </div>
    </div>
  );
};
