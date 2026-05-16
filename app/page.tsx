'use client';

import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

// ─── Typewriter hook ──────────────────────────────────────────────────────────
// Secuencia: tipea "EOQ Dinámico" → pausa → borra → tipea "de Inventario" → pausa → repite
function useTypewriter() {
  const PREFIX   = 'Asistente ';
  const PHRASES  = ['EOQ Dinámico', 'de Inventario'];
  const TYPE_MS  = 100;  // velocidad de tipeo
  const DEL_MS   = 75;   // velocidad de borrado
  const PAUSE_MS = 2800; // pausa al terminar de escribir

  const [display, setDisplay] = useState(PREFIX + PHRASES[0]);
  const [phase,   setPhase]   = useState<'pause' | 'deleting' | 'typing'>('pause');
  const [idx,     setIdx]     = useState(0);   // qué frase
  const [charIdx, setCharIdx] = useState(PHRASES[0].length);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (phase === 'pause') {
      timer = setTimeout(() => setPhase('deleting'), PAUSE_MS);

    } else if (phase === 'deleting') {
      if (charIdx > 0) {
        timer = setTimeout(() => {
          const next = charIdx - 1;
          setCharIdx(next);
          setDisplay(PREFIX + PHRASES[idx].slice(0, next));
        }, DEL_MS);
      } else {
        const nextIdx = (idx + 1) % PHRASES.length;
        setIdx(nextIdx);
        setPhase('typing');
      }

    } else if (phase === 'typing') {
      const target = PHRASES[idx];
      if (charIdx < target.length) {
        timer = setTimeout(() => {
          const next = charIdx + 1;
          setCharIdx(next);
          setDisplay(PREFIX + target.slice(0, next));
        }, TYPE_MS);
      } else {
        setPhase('pause');
      }
    }

    return () => clearTimeout(timer);
  }, [phase, charIdx, idx]);

  return display;
}

const TitleTypewriter = () => {
  const text = useTypewriter();
  return (
    <>
      {text}
      <span style={{
        display: 'inline-block', width: '3px', height: '0.85em',
        background: 'linear-gradient(135deg, #1a5fbc, #00bcd4)',
        marginLeft: '3px', verticalAlign: 'middle', borderRadius: '2px',
        animation: 'cursorBlink 1s step-end infinite',
      }} />
    </>
  );
};

const STYLES = `
  @keyframes gradMove   { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
  @keyframes fadeUp     { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes orbLand1   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,-40px)} }
  @keyframes orbLand2   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-30px,35px)} }
  @keyframes ctaShimmer  { 0%,100%{box-shadow:0 4px 20px rgba(26,95,188,0.12)} 50%{box-shadow:0 4px 28px rgba(0,188,212,0.2)} }
  @keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }

  .feature-card { transition: transform 0.22s ease, box-shadow 0.22s ease; }
  .feature-card:hover { transform: translateY(-5px); box-shadow: 0 14px 36px rgba(26,95,188,0.15) !important; }
  .cta-btn { transition: transform 0.18s ease; animation: ctaShimmer 3s ease-in-out infinite; }
  .cta-btn:hover { transform: translateY(-2px) scale(1.03); }
`;

const FEATURES = [
  {
    lottie: '/Brain animation.lottie',
    tag: 'Algoritmo exacto',
    label: 'Wagner-Whitin',
    desc: 'Programación dinámica que garantiza el plan de pedidos de costo mínimo, sin importar cuántos períodos o qué tan variable sea la demanda.',
    detail: 'O(n²) · Solución global óptima',
  },
  {
    lottie: '/Message Icon for web.lottie',
    tag: 'Sin formularios',
    label: 'Chat natural',
    desc: 'Describí tu problema como si hablaras con un compañero. El asistente interpreta el contexto, detecta los parámetros y guía la resolución.',
    detail: 'LLM · Sesiones con memoria · Español',
  },
  {
    lottie: '/job cv.lottie',
    tag: 'Resultados claros',
    label: 'Plan detallado',
    desc: 'Tabla completa con pedidos por período, inventario final, costos de almacenamiento y costo total relevante óptimo.',
    detail: 'Período · Pedido · Inv. final · Costo',
  },
];

const LIGHT_BG = 'radial-gradient(ellipse at center, #ffffff 0%, #f4faff 35%, #e8f6fd 60%, #cceaf8 80%, #a8d8f0 100%)';
const DARK_BG  = 'radial-gradient(ellipse at center, #07101e 0%, #09152a 40%, #0c1a32 70%, #091525 100%)';

export default function HomePage() {
  const router   = useRouter();
  const btnRef   = useRef<HTMLButtonElement>(null);
  const [rect,   setRect]   = useState<DOMRect | null>(null);
  const [morphing, setMorphing] = useState(false);
  const [isDark,  setIsDark]  = useState(false);

  // Leer preferencia guardada
  useEffect(() => {
    try {
      if (localStorage.getItem('simplex-dark') === 'true') setIsDark(true);
    } catch { /* ignore */ }
  }, []);

  // Guardar preferencia
  const toggleDark = () => {
    setIsDark(v => {
      const next = !v;
      try { localStorage.setItem('simplex-dark', String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const handleOpen = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) { router.push('/chat'); return; }
    setRect(r);
    setMorphing(true);
    // Navegar cuando el overlay ya cubre toda la pantalla
    setTimeout(() => router.push('/chat'), 420);
  };

  const textMain  = isDark ? '#ddeeff' : '#0b1829';
  const textMuted = isDark ? '#7aaac8' : '#2a5070';
  const cardBg    = isDark ? 'rgba(14,24,48,0.85)'  : 'rgba(255,255,255,0.62)';
  const cardBorder= isDark ? 'rgba(26,95,188,0.22)' : 'rgba(26,95,188,0.13)';
  const badgeBg   = isDark ? 'rgba(26,95,188,0.18)' : 'rgba(26,95,188,0.1)';
  const badgeBorder= isDark? 'rgba(26,95,188,0.35)' : 'rgba(26,95,188,0.25)';
  const badgeColor= isDark ? '#7aaac8'              : '#1a5fbc';
  const ctaBg     = isDark ? 'rgba(14,24,48,0.75)'  : 'rgba(255,255,255,0.72)';
  const ctaBorder = isDark ? 'rgba(26,95,188,0.4)'  : 'rgba(26,95,188,0.28)';
  const ctaColor  = isDark ? '#7aaac8'              : '#1a5fbc';

  return (
    <main
      style={{
        height: '100vh',
        background: isDark ? DARK_BG : LIGHT_BG,
        color: textMain,
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '24px 20px',
        position: 'relative', overflow: 'hidden',
        transition: 'background 0.4s ease, color 0.3s ease',
      }}
    >
      <style>{STYLES}</style>

      {/* Dark/Light toggle — top right */}
      <div style={{ position: 'absolute', top: '18px', right: '20px', zIndex: 10 }}>
        <div
          onClick={toggleDark}
          style={{
            position: 'relative', width: '86px', height: '36px', borderRadius: '999px',
            background: isDark ? '#1a2540' : '#e8f0fe',
            border: `1.5px solid ${isDark ? 'rgba(26,95,188,0.35)' : 'rgba(26,95,188,0.2)'}`,
            cursor: 'pointer', userSelect: 'none',
            transition: 'background 0.3s ease, border-color 0.3s ease',
            boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.3)' : '0 2px 8px rgba(26,95,188,0.1)',
          }}
        >
          <span style={{
            position: 'absolute', top: '50%', transform: 'translateY(-50%)',
            left: isDark ? '12px' : '34px',
            fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.04em',
            color: isDark ? '#7aaac8' : '#1a5fbc',
            transition: 'left 0.3s ease',
            whiteSpace: 'nowrap',
          }}>
            {isDark ? 'Noche' : 'Día'}
          </span>
          <div style={{
            position: 'absolute', top: '4px',
            left: isDark ? '4px' : 'calc(100% - 40px)',
            width: '28px', height: '28px', borderRadius: '50%',
            background: isDark ? '#1e3460' : '#fff',
            boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(26,95,188,0.2)',
            display: 'grid', placeItems: 'center',
            transition: 'left 0.3s cubic-bezier(0.4,0,0.2,1), background 0.3s ease',
          }}>
            {isDark ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#7aaac8' : '#1a5fbc'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a5fbc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Ambient orbs */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'8%', left:'12%', width:'300px', height:'300px', borderRadius:'50%', background:'radial-gradient(circle, rgba(26,95,188,0.09) 0%, transparent 70%)', animation:'orbLand1 18s ease-in-out infinite' }} />
        <div style={{ position:'absolute', bottom:'10%', right:'8%', width:'380px', height:'380px', borderRadius:'50%', background:'radial-gradient(circle, rgba(0,188,212,0.08) 0%, transparent 70%)', animation:'orbLand2 22s ease-in-out infinite' }} />
      </div>

      {/* Logo */}
      <div style={{ marginBottom: '16px', textAlign: 'center', animation: 'fadeUp 0.5s ease' }}>
        <img src="/logo.png" alt="Simplex" style={{ height: '140px', width: 'auto', filter: isDark ? 'drop-shadow(0 4px 24px rgba(0,120,180,0.35)) brightness(0.9)' : 'drop-shadow(0 4px 24px rgba(0,120,180,0.2))' }} />
      </div>

      {/* Badge */}
      <div style={{ animation: 'fadeUp 0.5s ease 0.1s both', marginBottom: '12px' }}>
        <div style={{
          display: 'inline-flex', padding: '4px 14px', borderRadius: '999px',
          background: badgeBg, border: `1px solid ${badgeBorder}`,
          color: badgeColor, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          transition: 'background 0.3s ease, color 0.3s ease',
        }}>
          Investigación Operativa · UTN FRRe · 2026
        </div>
      </div>

      {/* Título con typewriter */}
      <div style={{ maxWidth: '640px', marginBottom: '24px', animation: 'fadeUp 0.5s ease 0.15s both', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <h1 style={{
            fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 700, lineHeight: 1.1, margin: 0,
            color: textMain, whiteSpace: 'nowrap',
            position: 'relative',
            transition: 'color 0.3s ease',
          }}>
            {/* Texto fantasma — fija el ancho al máximo siempre */}
            <span style={{ visibility: 'hidden', pointerEvents: 'none', userSelect: 'none' }}>
              Asistente EOQ Dinámico
            </span>
            {/* Texto real encima */}
            <span style={{ position: 'absolute', left: 0, top: 0 }}>
              <TitleTypewriter />
            </span>
          </h1>
        </div>
        <p style={{ fontSize: '0.97rem', color: textMuted, lineHeight: 1.65, margin: 0, transition: 'color 0.3s ease' }}>
          Describí tu problema de inventario en lenguaje natural. El asistente elige el modelo,
          calcula el plan óptimo y te explica cada decisión.
        </p>
      </div>

      {/* CTA */}
      <div style={{ animation: 'fadeUp 0.5s ease 0.2s both', marginBottom: '28px' }}>
        <button
          ref={btnRef}
          onClick={handleOpen}
          disabled={morphing}
          className="cta-btn"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '10px',
            padding: '13px 32px', borderRadius: '12px',
            background: ctaBg,
            backdropFilter: 'blur(16px)',
            border: `1.5px solid ${ctaBorder}`,
            color: ctaColor, fontWeight: 700, fontSize: '0.97rem',
            cursor: morphing ? 'default' : 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.3s ease, border-color 0.3s ease, color 0.3s ease',
          }}
        >
          Abrir asistente →
        </button>
      </div>

      {/* Overlay morph — se expande desde el botón hasta fullscreen */}
      <AnimatePresence>
        {morphing && rect && (
          <motion.div
            initial={{
              position: 'fixed' as const,
              left:   rect.left,
              top:    rect.top,
              width:  rect.width,
              height: rect.height,
              borderRadius: '12px',
              zIndex: 9999,
              background: isDark ? DARK_BG : LIGHT_BG,
            }}
            animate={{
              left:   0,
              top:    0,
              width:  '100vw',
              height: '100vh',
              borderRadius: '0px',
            }}
            transition={{ duration: 0.42, ease: [0.4, 0, 0.2, 1] }}
          />
        )}
      </AnimatePresence>

      {/* Feature cards — fila única, sin scroll */}
      <div style={{ display: 'flex', gap: '16px', width: '100%', maxWidth: '960px', flexWrap: 'nowrap' }}>
        {FEATURES.map((f, i) => (
          <div
            key={f.label}
            className="feature-card"
            style={{
              flex: 1, borderRadius: '18px', padding: '20px 20px 18px',
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              backdropFilter: 'blur(16px)',
              boxShadow: isDark ? '0 2px 16px rgba(0,0,0,0.3)' : '0 2px 16px rgba(0,100,160,0.07)',
              animation: `fadeUp 0.5s ease ${0.3 + i * 0.1}s both`,
              display: 'flex', flexDirection: 'column',
              transition: 'background 0.3s ease, border-color 0.3s ease',
            }}
          >
            {/* Lottie icon */}
            <div style={{ width: '64px', height: '64px', marginBottom: '8px' }}>
              <DotLottieReact src={f.lottie} loop autoplay style={{ width: '100%', height: '100%' }} />
            </div>

            {/* Tag + Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: textMain, fontSize: '0.97rem', transition: 'color 0.3s ease' }}>{f.label}</span>
              <span style={{
                padding: '2px 8px', borderRadius: '999px',
                background: badgeBg, border: `1px solid ${badgeBorder}`,
                color: badgeColor, fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.04em',
                transition: 'background 0.3s ease, color 0.3s ease',
              }}>{f.tag}</span>
            </div>

            {/* Description */}
            <div style={{ color: textMuted, fontSize: '0.84rem', lineHeight: 1.6, marginBottom: '14px', flex: 1, transition: 'color 0.3s ease' }}>
              {f.desc}
            </div>

          </div>
        ))}
      </div>
    </main>
  );
}
