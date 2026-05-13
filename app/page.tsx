'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useRef, useState } from 'react';

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface ReplenishmentStep { period: number; quantity: number; coversThroughPeriod: number; }
interface SolverOutput {
  policy: { replenishmentPlan: ReplenishmentStep[] };
  mathematicalArtifacts: { costBreakdown: { setupOrOrderingCost: number; holdingCost: number; totalRelevantCost: number; }; };
}
interface ApiResponse {
  sessionId: string;
  response: {
    studentMessage: string; solverOutput?: SolverOutput;
    pedagogicalArtifacts: { justification: string[] };
    algorithmSelection: { chosenBranch?: string };
    interpretation: { branchCandidate?: string };
    threadContext?: { phase?: string };
  };
}
interface ChatEntry { id: string; role: 'user' | 'assistant'; text: string; data?: ApiResponse; }

// ─── PALETTE ──────────────────────────────────────────────────────────────────

const P = {
  primary:   '#1a5fbc',
  blue:      '#2980d4',
  cyan:      '#0ea5e9',
  teal:      '#06b6d4',
  green:     '#10b981',
  bg:        '#f0f7ff',
  bgAlt:     '#ffffff',
  border:    '#dbeafe',
  text:      '#0f172a',
  muted:     '#475569',
  soft:      '#64748b',
};

// ─── SCROLL REVEAL HOOK ───────────────────────────────────────────────────────

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold });
    obs.observe(el); return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function useCounter(target: number, inView: boolean, duration = 1800) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0; const step = target / (duration / 16);
    const timer = setInterval(() => { start += step; if (start >= target) { setCount(target); clearInterval(timer); } else setCount(Math.floor(start)); }, 16);
    return () => clearInterval(timer);
  }, [inView, target, duration]);
  return count;
}

// ─── RESULT CARD (dark — inside chat) ────────────────────────────────────────

function ResultCard({ data }: { data: ApiResponse }) {
  const { solverOutput, pedagogicalArtifacts, threadContext } = data.response;
  if (threadContext?.phase === 'resolved_follow_up' || !solverOutput) return null;
  const { replenishmentPlan } = solverOutput.policy;
  const { setupOrOrderingCost, holdingCost, totalRelevantCost } = solverOutput.mathematicalArtifacts.costBreakdown;
  const th: React.CSSProperties = { background: '#dbeafe', color: P.primary, padding: '5px 8px', textAlign: 'center', border: `1px solid ${P.border}`, fontWeight: 700, fontSize: 11 };
  const td = (alt: boolean): React.CSSProperties => ({ padding: '4px 8px', textAlign: 'center', border: `1px solid ${P.border}`, background: alt ? '#f0f7ff' : '#fff', fontSize: 12, color: P.text });
  return (
    <div style={{ marginTop: 12, fontSize: 13 }}>
      {replenishmentPlan.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700, color: P.primary, marginBottom: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>📦 Plan de reposición</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Período', 'Cantidad', 'Cubre hasta'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{replenishmentPlan.map((s, i) => <tr key={i}>{[s.period, s.quantity, s.coversThroughPeriod].map((v, j) => <td key={j} style={td(i % 2 === 1)}>{v}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 700, color: P.primary, marginBottom: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>💰 Costos</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>{[['Costo de pedido', setupOrOrderingCost], ['Costo de almacenamiento', holdingCost], ['Costo total relevante', totalRelevantCost]].map(([l, v], i) => (
            <tr key={i}><td style={{ ...td(i % 2 === 1), textAlign: 'left' }}>{l as string}</td><td style={{ ...td(i % 2 === 1), fontWeight: i === 2 ? 700 : 400, color: i === 2 ? '#059669' : P.text }}>{v as number}</td></tr>
          ))}</tbody>
        </table>
      </div>
      {pedagogicalArtifacts.justification.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, color: P.primary, marginBottom: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>💡 Explicación</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: P.muted, lineHeight: 1.7, fontSize: 12 }}>{pedagogicalArtifacts.justification.map((item, i) => <li key={i}>{item}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

// ─── CHATBOT WIDGET ───────────────────────────────────────────────────────────

function ChatbotWidget({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<ChatEntry[]>([{ id: 'welcome', role: 'assistant', text: '¡Hola! Soy el asistente de Simplex.\n\nDescribí tu problema en lenguaje natural. Por ejemplo:\n\n"Tengo 4 períodos con demandas 10, 60, 5 y 40. Costo de almacenamiento 1 por unidad por período y costo fijo de pedido 100."\n\nYo me encargo del resto.' }]);
  const [draft, setDraft] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [pendingReset, setPendingReset] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [entries, loading]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const userText = draft.trim(); if (!userText || loading) return;
    setDraft(''); setLoading(true);
    setEntries(prev => [...prev, { id: crypto.randomUUID(), role: 'user', text: userText }]);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userText, ...(sessionId ? { sessionId } : {}), ...(pendingReset ? { resetProblem: true } : {}) }) });
      const payload = await res.json() as ApiResponse | { error?: string };
      if (!res.ok || !('response' in payload)) throw new Error('error' in payload && payload.error ? payload.error : 'Error en el servidor.');
      setSessionId(payload.sessionId); setPendingReset(false);
      setEntries(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: payload.response.studentMessage, data: payload }]);
    } catch (err) {
      setEntries(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: err instanceof Error ? err.message : 'Error inesperado.' }]);
    } finally { setLoading(false); }
  }

  function handleKey(e: React.KeyboardEvent) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as unknown as FormEvent); } }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", background: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: `1px solid ${P.border}`, background: `linear-gradient(135deg, ${P.primary} 0%, ${P.cyan} 100%)` }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, border: '1px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>IO</div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', margin: 0 }}>Asistente de Inventario</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', margin: 0 }}><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#4ade80', marginRight: 4, verticalAlign: 'middle' }} />Equipo Simplex · En línea</p>
        </div>
        {sessionId && <button style={{ padding: '4px 12px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, background: 'rgba(255,255,255,0.15)', fontSize: 11, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => { setPendingReset(true); setSessionId(undefined); setEntries(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: 'Problema reiniciado. Contame el nuevo caso.' }]); }}>Nuevo problema</button>}
        <button onClick={onClose} title="Cerrar" style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.3)')} onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}>✕</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 12, background: P.bg }}>
        {entries.map(entry => entry.role === 'assistant' ? (
          <div key={entry.id} style={{ display: 'flex', gap: 8, alignSelf: 'flex-start', maxWidth: '92%' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${P.primary}, ${P.cyan})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>IO</div>
            <div style={{ padding: '10px 13px', borderRadius: '3px 16px 16px 16px', background: '#fff', border: `1px solid ${P.border}`, fontSize: 13, lineHeight: 1.65, color: P.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word', boxShadow: '0 1px 4px rgba(26,95,188,0.08)' }}>
              {entry.text}{entry.data && <ResultCard data={entry.data} />}
            </div>
          </div>
        ) : (
          <div key={entry.id} style={{ display: 'flex', gap: 8, alignSelf: 'flex-end', maxWidth: '92%', flexDirection: 'row-reverse' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: P.border, color: P.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>TU</div>
            <div style={{ padding: '10px 13px', borderRadius: '16px 3px 16px 16px', background: `linear-gradient(135deg, ${P.primary}, ${P.blue})`, fontSize: 13, lineHeight: 1.65, color: '#fff', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{entry.text}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${P.primary}, ${P.cyan})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>IO</div>
            <div style={{ padding: '10px 14px', borderRadius: '3px 16px 16px 16px', background: '#fff', border: `1px solid ${P.border}`, display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8', display: 'inline-block', animation: `blink 1.2s ${i * 0.2}s infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '10px 12px', borderTop: `1px solid ${P.border}`, background: '#fff' }}>
        <textarea style={{ flex: 1, padding: '8px 14px', border: `1px solid ${P.border}`, borderRadius: 22, fontSize: 13, fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.5, maxHeight: 90, overflowY: 'auto', color: P.text, background: P.bg }} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={handleKey} placeholder="Describí tu problema..." rows={1} />
        <button type="submit" disabled={loading} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: loading ? '#cbd5e1' : `linear-gradient(135deg, ${P.primary}, ${P.cyan})`, color: '#fff', fontSize: 15, cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: loading ? 'none' : '0 2px 8px rgba(26,95,188,0.3)' }}>➤</button>
      </form>
    </div>
  );
}

// ─── FLOATING CHAT ────────────────────────────────────────────────────────────

function FloatingChat({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  return (
    <>
      {isOpen && (
        <div style={{ position: 'fixed', bottom: 96, right: 28, zIndex: 200, width: 460, height: 650, borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 80px rgba(26,95,188,0.2), 0 0 0 1px rgba(26,95,188,0.15)', animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <ChatbotWidget onClose={onToggle} />
        </div>
      )}
      <button onClick={onToggle} title="Abrir asistente" style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 201, width: 58, height: 58, borderRadius: '50%', border: 'none', background: `linear-gradient(135deg, ${P.primary}, ${P.cyan})`, color: '#fff', fontSize: 24, cursor: 'pointer', boxShadow: '0 4px 24px rgba(26,95,188,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s', animation: isOpen ? 'none' : 'inviteFloat 2.4s ease-in-out infinite' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.animation = 'none'; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.15)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLButtonElement).style.animation = isOpen ? 'none' : 'inviteFloat 2.4s ease-in-out infinite'; }}>
        <span style={{ transition: 'transform 0.3s', display: 'inline-block' }}>💬</span>
      </button>
    </>
  );
}

// ─── NAVBAR ───────────────────────────────────────────────────────────────────

function Navbar({ onOpenChat }: { onOpenChat: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h); return () => window.removeEventListener('scroll', h);
  }, []);
  return (
    <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', height: 72, background: scrolled ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)', backdropFilter: 'blur(16px)', borderBottom: scrolled ? `1px solid ${P.border}` : '1px solid transparent', boxShadow: scrolled ? '0 2px 20px rgba(26,95,188,0.08)' : 'none', transition: 'all 0.3s ease' }}>
      <Image src="/logo.png" alt="Simplex" width={160} height={52} style={{ objectFit: 'contain', width: 'auto', height: 48 }} />
      <ul style={{ display: 'flex', gap: 36, listStyle: 'none', margin: 0, padding: 0 }}>
        {[['#funcionalidades', 'Funcionalidades'], ['#como-funciona', 'Cómo funciona'], ['#equipo', 'Equipo']].map(([href, label]) => (
          <li key={href}><a href={href} style={{ fontSize: 14, color: P.muted, textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = P.primary)} onMouseLeave={e => (e.currentTarget.style.color = P.muted)}>{label}</a></li>
        ))}
      </ul>
      <button onClick={onOpenChat} style={{ padding: '10px 24px', borderRadius: 10, border: `1.5px solid ${P.primary}`, background: 'transparent', color: P.primary, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
        onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = P.primary; b.style.color = '#fff'; }}
        onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'transparent'; b.style.color = P.primary; }}>
        Abrir asistente →
      </button>
    </nav>
  );
}

// ─── HERO ─────────────────────────────────────────────────────────────────────

function Hero({ onOpenChat }: { onOpenChat: () => void }) {
  const [typed, setTyped] = useState('');
  const phrases = ['el plan óptimo', 'mínimo costo', 'máxima eficiencia'];
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const phrase = phrases[phraseIdx]; let t: ReturnType<typeof setTimeout>;
    if (!deleting && typed.length < phrase.length) t = setTimeout(() => setTyped(phrase.slice(0, typed.length + 1)), 80);
    else if (!deleting && typed.length === phrase.length) t = setTimeout(() => setDeleting(true), 2200);
    else if (deleting && typed.length > 0) t = setTimeout(() => setTyped(typed.slice(0, -1)), 45);
    else { setDeleting(false); setPhraseIdx((phraseIdx + 1) % phrases.length); }
    return () => clearTimeout(t);
  }, [typed, deleting, phraseIdx]);

  return (
    <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', padding: '120px 24px 80px', position: 'relative', overflow: 'hidden', background: 'linear-gradient(160deg, #e8f4ff 0%, #f0f9ff 45%, #e6fff8 100%)' }}>
      {/* Orbs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(26,95,188,0.1) 0%, transparent 70%)', top: '-15%', left: '-12%', animation: 'orbFloat1 14s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.09) 0%, transparent 70%)', top: '15%', right: '-8%', animation: 'orbFloat2 18s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)', bottom: '5%', left: '32%', animation: 'orbFloat3 11s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(26,95,188,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(26,95,188,0.04) 1px, transparent 1px)`, backgroundSize: '60px 60px' }} />
      </div>

      <div style={{ position: 'relative', maxWidth: 880 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 18px', borderRadius: 24, background: 'rgba(26,95,188,0.08)', border: `1px solid rgba(26,95,188,0.2)`, fontSize: 12.5, fontWeight: 600, color: P.primary, marginBottom: 32, animation: 'fadeDown 0.7s ease both' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: P.green, display: 'inline-block', animation: 'pulseGlow 2s ease-in-out infinite' }} />
          Investigación Operativa · Equipo Simplex
        </div>

        <h1 style={{ fontSize: 'clamp(2.4rem, 6vw, 4.4rem)', fontWeight: 900, color: P.text, lineHeight: 1.1, marginBottom: 24, animation: 'fadeDown 0.7s 0.1s ease both', opacity: 0, animationFillMode: 'forwards' }}>
          Gestioná tu inventario<br />con{' '}
          <span style={{ background: `linear-gradient(135deg, ${P.primary}, ${P.teal})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            {typed}<span style={{ borderRight: `3px solid ${P.cyan}`, marginLeft: 1, animation: 'cursorBlink 0.8s step-end infinite' }}>&nbsp;</span>
          </span>
        </h1>

        <p style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: P.muted, maxWidth: 580, margin: '0 auto 40px', lineHeight: 1.8, animation: 'fadeDown 0.7s 0.2s ease both', opacity: 0, animationFillMode: 'forwards' }}>
          Describís tu problema en lenguaje natural. El asistente detecta el modelo correcto y genera el plan óptimo de pedidos, período a período.
        </p>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeDown 0.7s 0.3s ease both', opacity: 0, animationFillMode: 'forwards' }}>
          <button onClick={onOpenChat} style={{ padding: '14px 32px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${P.primary}, ${P.cyan})`, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 24px rgba(26,95,188,0.35)`, transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative', overflow: 'hidden' }}
            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.transform = 'translateY(-2px)'; b.style.boxShadow = `0 8px 36px rgba(26,95,188,0.45)`; }}
            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.transform = 'none'; b.style.boxShadow = `0 4px 24px rgba(26,95,188,0.35)`; }}>
            <span style={{ position: 'relative', zIndex: 1 }}>Calcular mi plan →</span>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.18), transparent)', animation: 'shimmer 2.5s ease-in-out infinite' }} />
          </button>
          <button onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })} style={{ padding: '14px 32px', borderRadius: 12, border: `1.5px solid ${P.border}`, background: 'rgba(255,255,255,0.7)', color: P.text, fontSize: 15, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(8px)', transition: 'all 0.2s' }}
            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = P.primary; b.style.color = P.primary; }}
            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = P.border; b.style.color = P.text; }}>
            Ver cómo funciona
          </button>
        </div>

        <StatsRow />
      </div>

      <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: P.soft, fontSize: 12 }}>
        <span>Scroll</span>
        <div style={{ width: 1, height: 40, background: `linear-gradient(to bottom, ${P.primary}, transparent)`, opacity: 0.4, animation: 'scrollPulse 2s ease-in-out infinite' }} />
      </div>
    </section>
  );
}

function StatsRow() {
  const { ref, inView } = useInView(0.5);
  const c1 = useCounter(2, inView, 1200);
  const c2 = useCounter(100, inView, 1500);
  return (
    <div ref={ref} style={{ display: 'flex', gap: 56, justifyContent: 'center', flexWrap: 'wrap', marginTop: 64, paddingTop: 48, borderTop: `1px solid rgba(26,95,188,0.12)` }}>
      {[[`${c1}`, 'Modelos soportados'], [`${c2}%`, 'Solución óptima'], ['Natural', 'Sin formularios']].map(([n, l]) => (
        <div key={l} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 34, fontWeight: 900, background: `linear-gradient(135deg, ${P.primary}, ${P.teal})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{n}</div>
          <div style={{ fontSize: 13, color: P.soft, marginTop: 4 }}>{l}</div>
        </div>
      ))}
    </div>
  );
}

// ─── FEATURES ─────────────────────────────────────────────────────────────────

function FeatureCard({ icon, bg, title, text, delay }: { icon: string; bg: string; title: string; text: string; delay: number }) {
  const { ref, inView } = useInView();
  return (
    <div ref={ref} style={{ padding: 28, borderRadius: 20, background: '#fff', border: `1px solid ${P.border}`, boxShadow: '0 2px 16px rgba(26,95,188,0.06)', transition: `opacity 0.6s ${delay}ms, transform 0.6s ${delay}ms, box-shadow 0.2s`, opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(28px)', cursor: 'default', position: 'relative', overflow: 'hidden' }}
      onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.boxShadow = `0 12px 40px rgba(26,95,188,0.14)`; d.style.transform = 'translateY(-5px)'; d.style.borderColor = 'rgba(26,95,188,0.25)'; }}
      onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.boxShadow = '0 2px 16px rgba(26,95,188,0.06)'; d.style.transform = inView ? 'translateY(0)' : 'translateY(28px)'; d.style.borderColor = P.border; }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${P.primary}, ${P.cyan})`, opacity: 0.6, borderRadius: '20px 20px 0 0' }} />
      <div style={{ width: 50, height: 50, borderRadius: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 15.5, fontWeight: 700, color: P.text, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: P.muted, lineHeight: 1.7 }}>{text}</div>
    </div>
  );
}

function Features() {
  const cards = [
    { icon: '📦', bg: 'rgba(26,95,188,0.08)',  title: 'Sin costo de pedido',   text: 'Cuando pedir no tiene un costo fijo, el sistema recomienda pedir exactamente lo que necesitás en cada período. Cero stock innecesario.' },
    { icon: '⚡', bg: 'rgba(16,185,129,0.08)',  title: 'Con costo de pedido',   text: 'Si cada pedido tiene un costo fijo, el algoritmo agrupa períodos para hacer menos pedidos y bajar el costo total.' },
    { icon: '🎯', bg: 'rgba(245,158,11,0.08)',  title: 'Selección automática',  text: 'No necesitás saber qué modelo usar. El asistente analiza el problema y elige el esquema correcto según la estructura de costos.' },
    { icon: '💬', bg: 'rgba(6,182,212,0.08)',   title: 'Lenguaje natural',      text: 'Escribís el problema como lo explicarías a una persona. El asistente extrae los datos e interpreta el contexto.' },
    { icon: '📊', bg: 'rgba(41,128,212,0.08)',  title: 'Plan período a período', text: 'Tabla con qué pedir en cada período, cuánto cuesta cada decisión y cómo se distribuyen los costos totales.' },
    { icon: '✅', bg: 'rgba(239,68,68,0.08)',   title: 'Justificación incluida', text: 'Cada plan incluye explicación del impacto de los costos en la política óptima y por qué conviene cada decisión.' },
  ];
  const { ref, inView } = useInView();
  return (
    <section id="funcionalidades" style={{ padding: '110px 0', background: P.bg }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 48px' }}>
        <div ref={ref} style={{ marginBottom: 64, transition: 'opacity 0.6s, transform 0.6s', opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(24px)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: P.cyan, textTransform: 'uppercase', marginBottom: 12 }}>Funcionalidades</div>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', fontWeight: 900, color: P.text, marginBottom: 16 }}>Todo en un solo asistente</h2>
          <p style={{ fontSize: 16, color: P.muted, maxWidth: 520, lineHeight: 1.8 }}>Dos modelos, selección automática y conversación en lenguaje natural. Sin formularios, sin pasos guiados.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 22 }}>
          {cards.map((c, i) => <FeatureCard key={i} {...c} delay={i * 80} />)}
        </div>
      </div>
    </section>
  );
}

// ─── HOW IT WORKS ─────────────────────────────────────────────────────────────

function HowItWorks({ onOpenChat }: { onOpenChat: () => void }) {
  const steps = [
    { n: '01', title: 'Describís el problema', text: 'Escribís la demanda, costos y períodos en lenguaje natural, como preferás.', icon: '✍️' },
    { n: '02', title: 'El asistente interpreta', text: 'Extrae los parámetros y detecta si corresponde el modelo con o sin costo de pedido.', icon: '🧠' },
    { n: '03', title: 'Calcula el plan óptimo', text: 'Aplica el algoritmo correspondiente y encuentra la política de mínimo costo.', icon: '⚙️' },
    { n: '04', title: 'Recibís los resultados', text: 'Tabla con pedidos, costos y justificación de cada decisión del plan óptimo.', icon: '📋' },
  ];
  const { ref, inView } = useInView();
  return (
    <section id="como-funciona" style={{ padding: '110px 0', background: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 48px' }}>
        <div ref={ref} style={{ textAlign: 'center', marginBottom: 72, transition: 'opacity 0.6s, transform 0.6s', opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(24px)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: P.cyan, textTransform: 'uppercase', marginBottom: 12 }}>Cómo funciona</div>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', fontWeight: 900, color: P.text, marginBottom: 16 }}>De los datos al plan en 4 pasos</h2>
          <p style={{ fontSize: 16, color: P.muted, maxWidth: 500, margin: '0 auto', lineHeight: 1.8 }}>Sin flujos guiados ni formularios. Escribís el problema y el asistente hace el resto.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
          {steps.map((s, i) => {
            const { ref: sRef, inView: sInView } = useInView();
            return (
              <div key={i} ref={sRef} style={{ padding: '32px 24px', borderRadius: 20, background: P.bg, border: `1px solid ${P.border}`, textAlign: 'center', transition: `opacity 0.6s ${i * 120}ms, transform 0.6s ${i * 120}ms`, opacity: sInView ? 1 : 0, transform: sInView ? 'translateY(0)' : 'translateY(28px)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: `rgba(26,95,188,0.35)`, marginBottom: 10 }}>{s.n}</div>
                <div style={{ fontSize: 28, marginBottom: 14 }}>{s.icon}</div>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg, ${P.primary}, ${P.cyan})`, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', boxShadow: `0 4px 16px rgba(26,95,188,0.3)` }}>{i + 1}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: P.text, marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 13.5, color: P.muted, lineHeight: 1.7 }}>{s.text}</div>
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: 'center', marginTop: 56 }}>
          <button onClick={onOpenChat} style={{ padding: '14px 36px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${P.primary}, ${P.cyan})`, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 24px rgba(26,95,188,0.3)`, transition: 'transform 0.2s, box-shadow 0.2s' }}
            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.transform = 'translateY(-2px)'; b.style.boxShadow = `0 8px 36px rgba(26,95,188,0.4)`; }}
            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.transform = 'none'; b.style.boxShadow = `0 4px 24px rgba(26,95,188,0.3)`; }}>
            Probarlo ahora →
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── CTA BAND ─────────────────────────────────────────────────────────────────

function CtaBand({ onOpenChat }: { onOpenChat: () => void }) {
  const { ref, inView } = useInView();
  return (
    <section style={{ padding: '100px 48px', textAlign: 'center', position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${P.primary} 0%, #1565c0 40%, ${P.teal} 100%)` }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08) 0%, transparent 60%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)`, backgroundSize: '60px 60px', pointerEvents: 'none' }} />
      <div ref={ref} style={{ position: 'relative', transition: 'opacity 0.7s, transform 0.7s', opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(24px)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', marginBottom: 16 }}>Empezá ahora</div>
        <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', fontWeight: 900, color: '#fff', marginBottom: 18 }}>¿Querés calcular tu plan de pedidos?</h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.75)', marginBottom: 40, maxWidth: 480, margin: '0 auto 40px', lineHeight: 1.8 }}>El asistente procesa tu problema al instante y te devuelve el plan óptimo con justificación incluida.</p>
        <button onClick={onOpenChat} style={{ padding: '14px 36px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', backdropFilter: 'blur(12px)', transition: 'all 0.2s' }}
          onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(255,255,255,0.25)'; b.style.borderColor = 'rgba(255,255,255,0.6)'; }}
          onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(255,255,255,0.15)'; b.style.borderColor = 'rgba(255,255,255,0.4)'; }}>
          Abrir asistente →
        </button>
      </div>
    </section>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────

function Footer() {
  const { ref, inView } = useInView();
  const members = ['Acosta, Santiago Iván', 'Aguirre, Julián', 'Boland Morley, Jeremías', 'Brizuela Silvestri, Yoel Elián', 'Livio, Solana', 'Moray, María Paz'];
  return (
    <footer id="equipo" style={{ background: P.text, borderTop: `4px solid transparent`, borderImage: `linear-gradient(90deg, ${P.primary}, ${P.cyan}) 1` }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 48px 48px' }}>
        <div ref={ref} style={{ transition: 'opacity 0.7s, transform 0.7s', opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(24px)' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 8 }}>Universidad Tecnológica Nacional</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 6 }}>INGENIERÍA EN SISTEMAS DE INFORMACIÓN</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 28 }}>Investigación Operativa</div>
            <div style={{ width: 60, height: 3, background: `linear-gradient(90deg, ${P.primary}, ${P.cyan})`, margin: '0 auto', borderRadius: 2 }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 52 }}>
            {/* Logo + equipo */}
            <div>
              <Image src="/logo.png" alt="Simplex" width={130} height={44} style={{ objectFit: 'contain', width: 'auto', height: 40, marginBottom: 20, filter: 'brightness(1.1)' }} />
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 16 }}>Equipo Simplex</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {members.map(m => (
                  <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: `linear-gradient(135deg, ${P.primary}, ${P.cyan})`, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>{m}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Profesores */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 16 }}>Cátedra</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[['Claudia SCREPNIK', 'Profesora'], ['Jorge VERA', 'Profesor']].map(([name, role]) => (
                  <div key={name} style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{role}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Proyecto */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 16 }}>Sobre el proyecto</div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.8, marginBottom: 20 }}>
                Asistente inteligente para la resolución de modelos de Cantidad Económica de Pedido dinámico, implementando el algoritmo Wagner-Whitin con selección automática de esquema.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['EOQ Dinámico', 'Wagner-Whitin', 'Groq AI'].map(tag => (
                  <span key={tag} style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(14,165,233,0.12)', border: `1px solid rgba(14,165,233,0.25)`, fontSize: 11.5, color: '#7dd3fc' }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '20px 48px', display: 'flex', justifyContent: 'center' }}>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', margin: 0 }}>© 2026 Equipo Simplex · UTN · Investigación Operativa</p>
      </div>
    </footer>
  );
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [chatOpen, setChatOpen] = useState(false);
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'IBM Plex Sans', system-ui, sans-serif; background: #f0f7ff; }
        a { text-decoration: none; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #f0f7ff; }
        ::-webkit-scrollbar-thumb { background: #2980d4; border-radius: 3px; }

        @keyframes fadeDown {
          from { opacity: 0; transform: translateY(-20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes blink { 0%,80%,100%{opacity:.15} 40%{opacity:1} }
        @keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pulseGlow {
          0%,100% { box-shadow: 0 0 20px rgba(26,95,188,0.35); }
          50%      { box-shadow: 0 0 40px rgba(26,95,188,0.6); }
        }
        @keyframes inviteFloat {
          0%   { transform: scale(1)    translateY(0);   box-shadow: 0 4px 24px rgba(26,95,188,0.4); }
          30%  { transform: scale(1.13) translateY(-6px); box-shadow: 0 12px 36px rgba(26,95,188,0.55); }
          60%  { transform: scale(1)    translateY(0);   box-shadow: 0 4px 24px rgba(26,95,188,0.4); }
          80%  { transform: scale(1.06) translateY(-3px); box-shadow: 0 8px 28px rgba(26,95,188,0.48); }
          100% { transform: scale(1)    translateY(0);   box-shadow: 0 4px 24px rgba(26,95,188,0.4); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%) skewX(-15deg); opacity:0; }
          40%  { opacity:0.5; }
          60%  { opacity:0; }
          100% { transform: translateX(200%) skewX(-15deg); opacity:0; }
        }
        @keyframes orbFloat1 {
          0%,100% { transform: translate(0,0) scale(1); }
          33%     { transform: translate(40px,-30px) scale(1.05); }
          66%     { transform: translate(-20px,20px) scale(0.96); }
        }
        @keyframes orbFloat2 {
          0%,100% { transform: translate(0,0) scale(1); }
          40%     { transform: translate(-50px,30px) scale(1.08); }
          70%     { transform: translate(30px,-20px) scale(0.94); }
        }
        @keyframes orbFloat3 {
          0%,100% { transform: translate(0,0); }
          50%     { transform: translate(20px,-40px); }
        }
        @keyframes scrollPulse {
          0%,100% { opacity:0.4; transform: scaleY(1); }
          50%     { opacity:0.8; transform: scaleY(1.1); }
        }
      `}</style>
      <Navbar onOpenChat={() => setChatOpen(true)} />
      <Hero onOpenChat={() => setChatOpen(true)} />
      <Features />
      <HowItWorks onOpenChat={() => setChatOpen(true)} />
      <CtaBand onOpenChat={() => setChatOpen(true)} />
      <Footer />
      <FloatingChat isOpen={chatOpen} onToggle={() => setChatOpen(o => !o)} />
    </>
  );
}
