'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { SimpleChatResponse, GenericResponse, SolveResponse, FollowUpResponse } from '../app/runtime/simple-handler';
import { ChatFeed } from './chat-feed';
import { ChatComposer } from './chat-composer';
import { ChatEntry, SolvePayload } from './types';
import { ThemeToggle } from './theme-toggle';
import { PrintableResult, PRINT_STYLES } from './printable-result';
import { wantsNewProblem } from './new-problem-intent';

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
type StoredEntry = ChatEntry;
type ConvRecord  = { id: string; label: string; ts: number; sessionId?: string; entries?: StoredEntry[] };

const QUICK_EXAMPLES = [
  '¿Qué es un modelo EOQ dinámico?',
  '¿Qué diferencia hay entre un modelo EOQ dinamico y uno estático?',
  '¿Qué algoritmos hay para resolver este tipo de problemas?',
  '¿Qué datos necesito para resolver un problema?',
  '¿Por qué a veces conviene pedir de más en un período?',
  '¿Qué pasa si no tengo costo fijo de pedido?',
  '¿El modelo funciona si la demanda es 0 en algún período?',
  '¿Cómo sé si el plan calculado es realmente el óptimo?',
];

const Sidebar = ({
  conversations, activeId, onSelect, onNew, collapsed, onToggle, onExampleSelect, isDark,
  isMobile, mobileOpen, onCloseMobile,
}: {
  conversations: ConvRecord[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  collapsed: boolean;
  onToggle: () => void;
  onExampleSelect: (text: string) => void;
  isDark?: boolean;
  isMobile?: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) => {
  const palette = getPalette(isDark ?? false);
  const effectiveCollapsed = isMobile ? false : collapsed;
  const W = effectiveCollapsed ? '60px' : '260px';

  const mobileStyle: React.CSSProperties = isMobile ? {
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100dvh',
    width: '260px',
    minWidth: '260px',
    maxWidth: '260px',
    transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
    zIndex: 200,
  } : {
    width: W, minWidth: W, maxWidth: W,
    height: '100vh',
    transition: 'width 0.22s ease, min-width 0.22s ease',
  };

  const sidebarBg = isMobile
    ? (isDark ? 'rgba(10,18,38,0.98)' : 'rgba(240,248,255,0.98)')
    : palette.sidebar;

  return (
    <aside
      style={{
        background: sidebarBg,
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        borderRight: `1px solid ${palette.sidebarBorder}`,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', flexShrink: 0, zIndex: 30,
        ...mobileStyle,
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: '14px 12px',
          borderBottom: `1px solid ${palette.sidebarBorder}`,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          minHeight: isMobile ? '96px' : '100px',
          position: 'relative',
        }}
      >
        <img
          src="/isologo.png"
          alt="Simplex"
          onClick={isMobile ? undefined : onToggle}
          title={isMobile ? undefined : (effectiveCollapsed ? 'Expandir menú' : 'Colapsar menú')}
          style={{
            width: effectiveCollapsed ? '48px' : isMobile ? '88px' : '72px',
            height: effectiveCollapsed ? '48px' : isMobile ? '88px' : '72px',
            objectFit: 'contain',
            cursor: isMobile ? 'default' : 'pointer',
            transition: 'width 0.22s ease, height 0.22s ease',
            filter: 'drop-shadow(0 2px 10px rgba(26,95,188,0.2))',
            margin: '0 auto',
          }}
        />
        {isMobile && (
          <button
            onClick={onCloseMobile}
            aria-label="Cerrar menú"
            style={{
              position: 'absolute', top: '10px', right: '10px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: palette.textMuted, fontSize: '18px', lineHeight: 1,
              padding: '6px', borderRadius: '8px', display: 'grid', placeItems: 'center',
            }}
          >
            ✕
          </button>
        )}
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
            justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = palette.sidebarHover; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          <span style={{ fontSize: '20px', lineHeight: 1, flexShrink: 0, fontWeight: 300, color: palette.textMuted }}>+</span>
          {!effectiveCollapsed && <span>Nueva conversación</span>}
        </button>
      </div>

      {/* Conversation list + Examples */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px', scrollbarWidth: 'none' }}>

        {/* Historial */}
        {!effectiveCollapsed && conversations.length > 0 && (
          <>
            <div style={{ fontSize: '0.69rem', color: palette.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 4px 4px' }}>
              Recientes
            </div>
            <div style={{ maxHeight: '105px', overflowY: 'auto', paddingRight: '4px', scrollbarWidth: 'thin', scrollbarColor: `${palette.textFaint} transparent` }}>
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
            </div>
          </>
        )}

        {/* Collapsed: solo iconos de historial */}
        {effectiveCollapsed && conversations.map((c) => (
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
        {!effectiveCollapsed && (
          <div style={{ marginTop: conversations.length > 0 ? '16px' : '8px' }}>
            <div style={{ fontSize: '0.69rem', color: palette.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 4px 6px' }}>
              Preguntas rápidas
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
      {!effectiveCollapsed && (
        <div style={{ padding: '12px 14px', borderTop: `1px solid ${palette.sidebarBorder}`, fontSize: '0.72rem', color: palette.textFaint, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 600, color: palette.textMuted, marginBottom: '2px' }}>Equipo Simplex · UTN</div>
          <div>Acosta · Aguirre · Boland</div>
          <div>Brizuela · Livio · Moray</div>
        </div>
      )}
    </aside>
  );
};

// ─── Wizard Stepper ───────────────────────────────────────────────────────────
type WizardStep = 'periodCount' | 'demands' | 'hasOrderCost' | 'orderCost' | 'holdingCost' | 'hasInitialInventory' | 'initialInventory' | 'completed';

const WIZARD_STEPS_WITH_SETUP: { key: WizardStep; label: string }[] = [
  { key: 'periodCount',          label: 'Períodos'       },
  { key: 'demands',              label: 'Demandas'        },
  { key: 'hasOrderCost',         label: 'Tipo de costo'   },
  { key: 'orderCost',            label: 'Costo fijo'      },
  { key: 'holdingCost',          label: 'Almacenamiento'  },
  { key: 'hasInitialInventory',  label: 'Stock inicial'   },
  { key: 'completed',            label: 'Resultado'        },
];

const WIZARD_STEPS_NO_SETUP: { key: WizardStep; label: string }[] = [
  { key: 'periodCount',          label: 'Períodos'       },
  { key: 'demands',              label: 'Demandas'        },
  { key: 'hasOrderCost',         label: 'Tipo de costo'   },
  { key: 'holdingCost',          label: 'Almacenamiento'  },
  { key: 'hasInitialInventory',  label: 'Stock inicial'   },
  { key: 'completed',            label: 'Resultado'        },
];

const WizardStepper = ({
  step, hasOrderCost, isDark, isMobile,
}: {
  step: string;
  hasOrderCost?: boolean;
  isDark?: boolean;
  isMobile?: boolean;
}) => {
  const WIZARD_STEPS = hasOrderCost === false ? WIZARD_STEPS_NO_SETUP : WIZARD_STEPS_WITH_SETUP;
  const wizardKeys: WizardStep[] = ['periodCount', 'demands', 'hasOrderCost', 'orderCost', 'holdingCost', 'hasInitialInventory', 'initialInventory', 'completed'];
  if (!wizardKeys.includes(step as WizardStep)) return null;

  // 'initialInventory' (cantidad) se muestra bajo el mismo paso que 'hasInitialInventory'
  const displayStep = step === 'initialInventory' ? 'hasInitialInventory' : step;
  const currentIdx = WIZARD_STEPS.findIndex(s => s.key === displayStep);
  const palette = isDark ? DARK : LIGHT;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: isMobile ? '10px 12px 6px' : '12px 20px 6px',
      gap: 0,
      maxWidth: '760px', width: '100%', boxSizing: 'border-box', margin: '0 auto',
    }}>
      {WIZARD_STEPS.map((s, i) => {
        const done    = i < currentIdx;
        const active  = i === currentIdx;
        const future  = i > currentIdx;

        return (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: i < WIZARD_STEPS.length - 1 ? 1 : undefined }}>
            {/* Step circle + label */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: isMobile ? '40px' : '56px' }}>
              {/* Circle */}
              <div style={{
                width:  active ? (isMobile ? '26px' : '30px') : (isMobile ? '22px' : '26px'),
                height: active ? (isMobile ? '26px' : '30px') : (isMobile ? '22px' : '26px'),
                borderRadius: '50%',
                background: done
                  ? palette.grad
                  : active
                    ? palette.grad
                    : isDark ? 'rgba(26,95,188,0.12)' : 'rgba(26,95,188,0.07)',
                border: future
                  ? `1.5px solid ${isDark ? 'rgba(26,95,188,0.25)' : 'rgba(26,95,188,0.18)'}`
                  : 'none',
                display: 'grid', placeItems: 'center',
                boxShadow: active ? '0 2px 10px rgba(26,95,188,0.28)' : 'none',
                transition: 'all 0.25s ease',
                flexShrink: 0,
              }}>
                {done ? (
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <span style={{
                    fontSize: isMobile ? '10px' : '11px',
                    fontWeight: 700,
                    color: active ? '#fff' : (isDark ? palette.textFaint : palette.textFaint),
                    lineHeight: 1,
                  }}>
                    {i + 1}
                  </span>
                )}
              </div>
              {/* Label — oculto en mobile si no es el paso activo */}
              {(!isMobile || active) && (
                <span style={{
                  fontSize: isMobile ? '10px' : '10px',
                  fontWeight: active ? 600 : 400,
                  color: done || active ? (isDark ? palette.cyan : palette.blue) : palette.textFaint,
                  whiteSpace: 'nowrap',
                  transition: 'color 0.25s ease',
                }}>
                  {s.label}
                </span>
              )}
            </div>

            {/* Connector line */}
            {i < WIZARD_STEPS.length - 1 && (
              <div style={{
                flex: 1, height: '2px', marginBottom: (!isMobile || active) ? '18px' : '0',
                background: done
                  ? palette.grad
                  : isDark ? 'rgba(26,95,188,0.15)' : 'rgba(26,95,188,0.12)',
                transition: 'background 0.3s ease',
                minWidth: isMobile ? '8px' : '16px',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Shell ────────────────────────────────────────────────────────────────────
const initialEntries: ChatEntry[] = [];

const initialProblemData = {
  periodCount:       0,
  demands:           [] as number[],
  hasOrderCost:      undefined as boolean | undefined,
  orderCost:         undefined as number | undefined,
  holdingCost:       undefined as number | undefined,
  initialInventory:  0,
};

export const ChatShell = () => {
  const [draft,               setDraft]               = useState('');
  const [sessionId,           setSessionId]           = useState<string | undefined>();
  const [entries,             setEntries]             = useState<ChatEntry[]>(initialEntries);
  const [error,               setError]               = useState<string | null>(null);
  const [isSubmitting,        setIsSubmitting]        = useState(false);
  const [pendingResetProblem, setPendingResetProblem] = useState(false);
  const [step,                setStep]                = useState<'welcome' | 'chatting' | 'periodCount' | 'demands' | 'hasOrderCost' | 'orderCost' | 'holdingCost' | 'hasInitialInventory' | 'initialInventory' | 'completed'>('welcome');
  const [problemData,         setProblemData]         = useState(initialProblemData);
  const [sidebarCollapsed,    setSidebarCollapsed]    = useState(false);
  const [conversations,       setConversations]       = useState<ConvRecord[]>([]);
  const [activeConvId,        setActiveConvId]        = useState<string | undefined>();
  const [isDark,              setIsDark]              = useState(false);
  const [lastSolvePayload,    setLastSolvePayload]    = useState<SolvePayload | null>(null);
  const [isMobile,            setIsMobile]            = useState(false);
  const [mobileSidebarOpen,   setMobileSidebarOpen]   = useState(false);

  const feedViewportRef     = useRef<HTMLDivElement | null>(null);
  const shouldAutoFollowRef = useRef(true);

  // ── Detección de mobile — solo reacciona a cambios de ANCHO ─────────────────
  // El teclado virtual cambia el alto pero NO el ancho → ignoramos esos eventos
  // para no disparar re-renders innecesarios mientras el teclado está abierto.
  useEffect(() => {
    let lastWidth = window.innerWidth;
    const check = () => {
      const w = window.innerWidth;
      if (w === lastWidth) return;
      lastWidth = w;
      const mobile = w < 680;
      setIsMobile(mobile);
      if (!mobile) setMobileSidebarOpen(false);
    };
    setIsMobile(window.innerWidth < 680);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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

  // ── localStorage: guardar cuando cambia el historial (máx 12) ───────────────
  useEffect(() => {
    try {
      localStorage.setItem('simplex-conversations', JSON.stringify(conversations.slice(0, 12)));
    } catch { /* ignore */ }
  }, [conversations]);

  // ── Sincronizar mensajes en el registro activo ───────────────────────────────
  useEffect(() => {
    if (!activeConvId || entries.length === 0) return;
    const stored: StoredEntry[] = entries;
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
    setActiveConvId(undefined);
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
    setEntries(conv?.entries ?? initialEntries);
    setSessionId(conv?.sessionId);
    setError(null);
    setDraft('');
    setStep('completed');
    setProblemData(initialProblemData);
    setPendingResetProblem(false);
    setMobileSidebarOpen(false);
  };

  // ── Botón "Resolver problema" en WelcomeState ─────────────────────────────────
  const startProblem = () => {
    const convId = activeConvId ?? crypto.randomUUID();
    setActiveConvId(convId);
    setConversations(prev => {
      if (prev.find(x => x.id === convId)) return prev;
      return [{ id: convId, label: 'Nuevo problema', ts: Date.now() }, ...prev].slice(0, 12);
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
    setConversations(prev => [{ id: newId, label: 'Nuevo problema', ts: Date.now() }, ...prev].slice(0, 12));
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

    setEntries(prev => [...prev, { id: `user-${crypto.randomUUID()}`, role: 'user' as const, text: value }]);

    if (step === 'hasOrderCost') {
      const yes = /^(s|si|sí|yes|y)$/i.test(value.toLowerCase().trim());
      const no  = /^(n|no)$/i.test(value.toLowerCase().trim());
      if (!yes && !no) { appendAssistantMessage('Respondé con sí o no. ¿El problema tiene costo de pedido fijo?'); return; }
      setProblemData(prev => ({ ...prev, hasOrderCost: yes }));
      if (yes) { setStep('orderCost');    appendAssistantMessage('Ingresá el costo de pedido fijo.'); }
      else     { setStep('holdingCost'); appendAssistantMessage('Perfecto. Ahora ingresá el costo de almacenamiento por unidad y período.'); }
      return;
    }

    if (step === 'hasInitialInventory') {
      const yes = /^(s|si|sí|yes|y)$/i.test(value.toLowerCase().trim());
      const no  = /^(n|no)$/i.test(value.toLowerCase().trim());
      if (!yes && !no) { appendAssistantMessage('Respondé con sí o no. ¿Tenés mercadería disponible actualmente?'); return; }

      if (yes) {
        setStep('initialInventory');
        appendAssistantMessage('¿Cuántas unidades tenés disponibles?');
        return;
      }

      // No hay inventario inicial → resolvemos directamente con I₀ = 0
      const finalData = { ...problemData, initialInventory: 0 };
      setProblemData(finalData);
      setStep('completed');
      appendAssistantMessage('Perfecto, calculando el plan óptimo...');

      void (async () => {
        try {
          setIsSubmitting(true);
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type:          'solve',
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
          appendSolveResponse(payload as SolveResponse);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Falló el cálculo.');
          setStep('hasInitialInventory');
        } finally {
          setIsSubmitting(false);
        }
      })();
    }
  };

  const parseNumberList = (text: string) =>
    text.trim().split(/\s+/).filter(Boolean).map(Number);

  const POSITIVE_DECIMAL_REGEX = /^(?:\d+(?:\.\d+)?|\.\d+)$/;
  const parsePositiveDecimal = (text: string): number | null => {
    const trimmed = text.trim();
    if (!POSITIVE_DECIMAL_REGEX.test(trimmed)) return null;

    const value = Number(trimmed);
    return Number.isFinite(value) && value > 0 ? value : null;
  };

  const hasSolvedProblemInCurrentConversation = (): boolean =>
    entries.some((entry) => entry.role === 'assistant' && 'solvePayload' in entry && !!entry.solvePayload);

  // Re-hidratación de sesión: busca el solvePayload más reciente en los entries
  // (útil al restaurar una conversación desde localStorage donde lastSolvePayload es null)
  const getActiveSolvePayload = (): SolvePayload | null => {
    if (lastSolvePayload) return lastSolvePayload;
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if ('solvePayload' in e && e.solvePayload) return e.solvePayload;
    }
    return null;
  };

  // Construye el historial de conversación a partir de los entries actuales (máx. últimos 20)
  const buildHistory = () =>
    entries.slice(-20).map(e => ({ role: e.role as 'user' | 'assistant', content: e.text }));

  const NEGATIVE_NUMBER_REGEX = /-\s*\d/;
  const NEGATIVE_DEMAND_MESSAGE = 'Ingresá números válidos, no pueden existir demandas negativas.';
  const NEGATIVE_PERIOD_MESSAGE = 'Ingresá números válidos, no pueden existir períodos negativos.';
  const NEGATIVE_NUMBER_MESSAGE = 'Ingresá números válidos, no pueden existir valores negativos.';
  const containsNegativeNumber = (text: string) => NEGATIVE_NUMBER_REGEX.test(text);

  const updateConversationLabel = (label: string) => {
    if (!activeConvId) return;
    setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, label } : c));
  };

  const ensureConversationRecord = (id: string, label: string) => {
    setConversations(prev => {
      if (prev.find(x => x.id === id)) return prev;
      return [{ id, label: label.slice(0, 40), ts: Date.now() }, ...prev].slice(0, 12);
    });
  };

  const appendSolveResponse = (solvePayload: SolveResponse) => {
    setSessionId(solvePayload.sessionId);
    if (activeConvId) {
      setConversations(prev =>
        prev.map(c => c.id === activeConvId ? { ...c, sessionId: solvePayload.sessionId } : c),
      );
    }
    setStep('completed');
    const sp: SolvePayload = {
      sessionId:    solvePayload.sessionId,
      solverInput:  solvePayload.solverInput,
      solverOutput: solvePayload.solverOutput,
    };
    setLastSolvePayload(sp);
    setEntries(prev => [...prev, {
      id: `assistant-${crypto.randomUUID()}`,
      role: 'assistant' as const,
      text: solvePayload.message,
      solvePayload: sp,
    }]);
    appendAssistantMessage('¿Tenés alguna pregunta sobre el plan o los costos?');
  };

  // ── Envío directo (desde ejemplos del sidebar) ────────────────────────────────
  const sendDirect = async (text: string) => {
    if (isSubmitting) return;
    setError(null);

    setEntries(prev => [...prev, { id: `user-${crypto.randomUUID()}`, role: 'user' as const, text }]);

    // Sin sesión: pregunta genérica conceptual → modo chat libre
    if (!sessionId) {
      // Crear conversación si no hay activa y transicionar a 'chatting'
      // para habilitar la caja de texto y permitir seguir preguntando.
      const convId = activeConvId ?? crypto.randomUUID();
      setActiveConvId(convId);
      ensureConversationRecord(convId, text);
      if (step === 'welcome') setStep('chatting');

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
        if (payload.type === 'solve') {
          appendSolveResponse(payload);
          return;
        }
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

    // Con sesión activa: detectar intención de "nuevo problema" para evitar mezclar contexto
    if (
      step === 'completed' &&
      hasSolvedProblemInCurrentConversation() &&
      wantsNewProblem(text)
    ) {
      setEntries(prev => [...prev, {
        id: `assistant-${crypto.randomUUID()}`,
        role: 'assistant' as const,
        text: 'Parece que querés resolver un problema distinto. Si querés, iniciamos una conversación nueva para no mezclar escenarios.',
        options: [{ label: '↺ Resolver nuevo problema', value: NEW_PROBLEM_VALUE }],
      }]);
      return;
    }

    // Con sesión activa: follow-up sobre el problema resuelto
    try {
      setIsSubmitting(true);
      const sp = getActiveSolvePayload();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'followup',
          sessionId,
          userText: text,
          ...(sp ? { solverInput: sp.solverInput, solverOutput: sp.solverOutput } : {}),
          history: buildHistory(),
        }),
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
      if (isSubmitting) return; // ya hay un envío en curso — el campo sigue editable pero no se reenvía
      const userText = draft.trim();
      if (!userText) return;
      if (step === 'welcome') return;

      setDraft('');
      setError(null);
      setEntries(prev => [...prev, { id: `user-${crypto.randomUUID()}`, role: 'user' as const, text: userText }]);

      const normalized = userText.toLowerCase().trim();

      // ── Chat libre conceptual (sin sesión de problema resuelto) ──────────
      if (step === 'chatting') {
        const convId = activeConvId ?? crypto.randomUUID();
        setActiveConvId(convId);
        ensureConversationRecord(convId, userText);

        try {
          setIsSubmitting(true);
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'generic', userText }),
          });
          const payload = (await res.json()) as SimpleChatResponse | { error?: string };
          if (!res.ok || !('type' in payload))
            throw new Error('error' in payload && payload.error ? payload.error : 'No se pudo responder.');
          if (payload.type === 'solve') {
            appendSolveResponse(payload);
            return;
          }
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

      if (step === 'periodCount') {
        if (containsNegativeNumber(userText)) {
          appendAssistantMessage(NEGATIVE_PERIOD_MESSAGE);
          return;
        }
        const periodCount = Number(normalized);
        if (!Number.isInteger(periodCount) || periodCount <= 0) {
          appendAssistantMessage('No entendí ese número. Ingresá la cantidad de períodos como un entero mayor que cero.');
          return;
        }
        setProblemData(prev => ({ ...prev, periodCount }));
        updateConversationLabel(`Plan para ${periodCount} períodos`);
        setStep('demands');
        appendAssistantMessage(`Perfecto. Ingresá la demanda de cada uno de los ${periodCount} períodos, separadas sólo por espacios y usando punto para los decimales.`);
        return;
      }

      if (step === 'demands') {
        if (/,/.test(userText)) {
          appendAssistantMessage(`Usá sólo espacios para separar las demandas y punto para los decimales, por ejemplo: 10.5 20 30.25`);
          return;
        }
        if (containsNegativeNumber(userText)) {
          appendAssistantMessage(NEGATIVE_DEMAND_MESSAGE);
          return;
        }
        const values = parseNumberList(userText);
        if (!values.every(v => Number.isFinite(v) && v >= 0) || values.length !== problemData.periodCount) {
          appendAssistantMessage(`Necesito ${problemData.periodCount} números válidos. Ingresá las demandas separadas sólo por espacios y usa punto para los decimales.`);
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
        if (/,/.test(userText)) {
          appendAssistantMessage('Usá punto para los decimales, no coma. Ingresá un valor numérico mayor que cero para el costo de reposición.');
          return;
        }
        if (containsNegativeNumber(userText)) {
          appendAssistantMessage(NEGATIVE_NUMBER_MESSAGE);
          return;
        }
        const orderCost = parsePositiveDecimal(userText);
        if (orderCost === null) {
          appendAssistantMessage('Ingresá un valor numérico mayor que cero para el costo de reposición (usá punto como separador decimal, ej: 10.5).');
          return;
        }
        setProblemData(prev => ({ ...prev, orderCost }));
        setStep('holdingCost');
        appendAssistantMessage('Ahora ingresá el costo de almacenamiento por unidad y período.');
        return;
      }

      if (step === 'hasInitialInventory') {
        const yes = /^(s|si|sí|yes|y)$/i.test(normalized);
        const no  = /^(n|no)$/i.test(normalized);
        if (!yes && !no) { appendAssistantMessage('Respondé con sí o no. ¿Tenés mercadería disponible actualmente?'); return; }
        if (yes) {
          setStep('initialInventory');
          appendAssistantMessage('¿Cuántas unidades tenés disponibles?');
        } else {
          handleOptionSelect('no');
        }
        return;
      }

      if (step === 'holdingCost') {
        if (/,/.test(userText)) {
          appendAssistantMessage('Usá punto para los decimales, no coma. Ingresá un valor numérico mayor que cero para el costo de almacenamiento, por ejemplo: 1.5.');
          return;
        }
        if (containsNegativeNumber(userText)) {
          appendAssistantMessage(NEGATIVE_NUMBER_MESSAGE);
          return;
        }
        const holdingCost = parsePositiveDecimal(userText);
        if (holdingCost === null) {
          appendAssistantMessage('Ingresá un valor numérico mayor que cero para el costo de almacenamiento (usá punto como separador decimal, ej: 1.5).');
          return;
        }
        setProblemData(prev => ({ ...prev, holdingCost }));
        setStep('hasInitialInventory');
        appendAssistantOptions('¿Tenés mercadería disponible actualmente?', [
          { label: 'Sí', value: 'sí' },
          { label: 'No', value: 'no' },
        ]);
        return;
      }

      if (step === 'initialInventory') {
        if (/,/.test(userText)) {
          appendAssistantMessage('Usá punto para los decimales, no coma. Ingresá la cantidad de unidades en stock (número mayor que cero).');
          return;
        }
        if (containsNegativeNumber(userText)) {
          appendAssistantMessage(NEGATIVE_NUMBER_MESSAGE);
          return;
        }
        const initialInventory = parsePositiveDecimal(userText);
        if (initialInventory === null) {
          appendAssistantMessage('Ingresá un número mayor que cero para el inventario inicial (por ejemplo: 50, 100, 200.5).');
          return;
        }
        const finalData = { ...problemData, initialInventory };
        setProblemData(finalData);

        // Si I₀ cubre toda la demanda, no hay nada que resolver
        const totalDemand = finalData.demands.reduce((s, d) => s + d, 0);
        if (initialInventory >= totalDemand) {
          setStep('completed');
          appendAssistantMessage(
            `Tu inventario inicial de **${initialInventory}** unidades cubre toda la demanda del horizonte ` +
            `(${totalDemand} unidades en total). No es necesario realizar ningún pedido adicional.`
          );
          return;
        }

        setStep('completed');
        appendAssistantMessage('Perfecto, calculando el plan óptimo...');

        try {
          setIsSubmitting(true);
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type:             'solve',
              sessionId,
              periodDemands:    finalData.demands,
              hasSetupCost:     finalData.hasOrderCost ?? false,
              setupCost:        finalData.orderCost,
              holdingCost:      finalData.holdingCost,
              initialInventory: finalData.initialInventory > 0 ? finalData.initialInventory : undefined,
            }),
          });
          const payload = (await res.json()) as SimpleChatResponse | { error?: string };
          if (!res.ok || !('type' in payload))
            throw new Error('error' in payload && payload.error ? payload.error : 'No se pudo completar el cálculo.');
          appendSolveResponse(payload as SolveResponse);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Falló el cálculo.');
          setStep('initialInventory');
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
        if (hasSolvedProblemInCurrentConversation() && wantsNewProblem(userText)) {
          appendAssistantOptions(
            'Entiendo que querés cambiar de escenario. Para mantener claridad en los resultados, te recomiendo abrir una conversación nueva.',
            [{ label: '↺ Resolver nuevo problema', value: NEW_PROBLEM_VALUE }],
          );
          return;
        }
        try {
          setIsSubmitting(true);
          const sp = getActiveSolvePayload();
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'followup',
              sessionId,
              userText,
              ...(sp ? { solverInput: sp.solverInput, solverOutput: sp.solverOutput } : {}),
              history: buildHistory(),
            }),
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

  // ── Exportar PDF — impresión inline sin abrir ventanas nuevas ────────────────
  // El contenido imprimible (#simplex-print-content) está renderizado via portal
  // directamente en <body>, fuera del shell position:fixed.
  // Los @media print en PRINT_STYLES ocultan el shell y muestran solo el informe.
  // El diálogo de impresión del browser aparece sobre la misma página actual.
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
    <div
      className="simplex-shell"
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        // height se controla via CSS class (.simplex-shell) usando 100dvh.
        // dvh = dynamic viewport height: achica automáticamente cuando el
        // teclado virtual aparece en iOS 15.4+ y Chrome 108+.
        // Sin JavaScript, sin conflictos con re-renders de React.
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
        /* Shell height: 100dvh achica con teclado virtual (iOS/Android).
           Fallback 100vh para browsers muy viejos que no soporten dvh. */
        .simplex-shell { height: 100vh; height: 100dvh; }

        @keyframes orbFloat1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(40px,-50px) scale(1.06)} 66%{transform:translate(-25px,30px) scale(0.94)} }
        @keyframes orbFloat2 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-35px,40px) scale(1.08)} 66%{transform:translate(30px,-20px) scale(0.93)} }
        @keyframes orbFloat3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,35px) scale(1.04)} }
        .theme-toggle { transition: background 0.18s, transform 0.18s; }
        .theme-toggle:hover { transform: scale(1.1); }
        ${PRINT_STYLES}
      `}</style>

      {/* Mobile sidebar backdrop */}
      {isMobile && mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(2px)',
            zIndex: 199,
          }}
        />
      )}
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
        onNew={() => { resetConversation(); setMobileSidebarOpen(false); }}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
        onExampleSelect={(text) => { sendDirect(text); setMobileSidebarOpen(false); }}
        isDark={isDark}
        isMobile={isMobile}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, position: 'relative', zIndex: 1 }}>

        {/* Top bar */}
        <header
          style={{
            height: '52px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: isMobile ? '0 12px' : '0 20px',
            borderBottom: `1px solid ${palette.sidebarBorder}`,
            background: palette.headerBg,
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            flexShrink: 0, gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            {/* Hamburger (mobile only) */}
            {isMobile && (
              <button
                onClick={() => setMobileSidebarOpen(v => !v)}
                aria-label="Abrir menú"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: palette.textMuted, fontSize: '22px', lineHeight: 1,
                  padding: '4px 6px', borderRadius: '8px', flexShrink: 0,
                  display: 'grid', placeItems: 'center',
                }}
              >
                ☰
              </button>
            )}
            <span style={{ fontWeight: 600, fontSize: isMobile ? '0.88rem' : '0.95rem', color: palette.text, whiteSpace: 'nowrap' }}>EOQ Dinámico</span>
          </div>

          {/* Toggle día/noche */}
          <ThemeToggle isDark={isDark} onToggle={() => setIsDark(v => !v)} isMobile={isMobile} />
        </header>

        {/* Wizard stepper */}
        <WizardStepper
          step={step}
          hasOrderCost={problemData.hasOrderCost}
          isDark={isDark}
          isMobile={isMobile}
        />

        {/* Feed */}
        <div
          ref={feedViewportRef}
          onScroll={handleFeedScroll}
          style={{
            flex: 1, overflowY: 'auto',
            padding: isMobile ? '16px 12px 8px' : '32px 20px 16px',
            scrollbarWidth: 'thin',
            scrollbarColor: `rgba(26,95,188,0.15) transparent`,
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{
            maxWidth: '760px', margin: '0 auto', width: '100%', boxSizing: 'border-box',
            flex: step === 'welcome' ? 1 : undefined,
            display: step === 'welcome' ? 'flex' : undefined,
            flexDirection: step === 'welcome' ? 'column' : undefined,
            justifyContent: step === 'welcome' ? 'center' : undefined,
          }}>
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

        {/* Composer — oculto en welcome */}
        {step !== 'welcome' && (
          <div style={{
            flexShrink: 0, maxWidth: '800px', width: '100%', boxSizing: 'border-box',
            margin: '0 auto',
            // El safe-area-inset-bottom aplica cuando el teclado está cerrado
            // (barra home de iPhone). Cuando el teclado está abierto el contenedor
            // ya fue ajustado por visualViewport, así que este padding no se acumula.
            padding: isMobile
              ? '0 10px max(14px, env(safe-area-inset-bottom, 14px))'
              : '0 20px 20px',
          }}>
            {/* Botón flotante: Resolver problema (en modo chatting) o PDF (completado) */}
            {step === 'chatting' && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0 8px', animation: 'fadeSlideUp 0.3s ease' }}>
                <button
                  onClick={startFreshProblem}
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
            )}
            {step === 'completed' && lastSolvePayload && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                <button
                  onClick={handlePrint}
                  title="Exportar resultado a PDF"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: isMobile ? '9px 14px' : '9px 18px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #1a5fbc, #00bcd4)',
                    color: '#fff', fontWeight: 700,
                    fontSize: isMobile ? '0.8rem' : '0.84rem',
                    border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: '0 3px 12px rgba(26,95,188,0.28)',
                    whiteSpace: 'nowrap',
                    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(26,95,188,0.4)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 3px 12px rgba(26,95,188,0.28)'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {isMobile ? 'PDF' : 'Exportar PDF'}
                </button>
              </div>
            )}

            <ChatComposer
              draft={draft}
              sessionId={sessionId}
              step={step}
              pendingResetProblem={pendingResetProblem}
              error={error}
              isSubmitting={isSubmitting}
              disabled={false}
              isDark={isDark}
              entriesCount={entries.length}
              onChange={setDraft}
              onSubmit={handleSubmit}
              onResetProblem={resetConversation}
            />
          </div>
        )}

      </div>
    </div>

    {/* Contenido imprimible — portal directo a <body> para evitar herencia
        del position:fixed del shell. Invisible en pantalla, visible al imprimir. */}
    {lastSolvePayload && typeof document !== 'undefined' &&
      createPortal(
        <PrintableResult solvePayload={lastSolvePayload} />,
        document.body
      )
    }
    </>
  );
};
