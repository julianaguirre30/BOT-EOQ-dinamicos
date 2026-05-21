'use client';

// ─── Shared ThemeToggle — idéntico en landing y chat ─────────────────────────
// Desktop: pill 86×36 con texto + knob animado
// Mobile:  círculo 36×36 solo icono

const MoonIcon = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
  </svg>
);

const SunIcon = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1"    x2="12" y2="3"/>
    <line x1="12" y1="21"   x2="12" y2="23"/>
    <line x1="4.22" y1="4.22"   x2="5.64"  y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1"  y1="12" x2="3"  y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36"/>
    <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"/>
  </svg>
);

// Constantes únicas — editar aquí afecta ambas páginas
const W        = 86;   // ancho pill desktop (px)
const H        = 36;   // alto pill / círculo mobile (px)
const KNOB     = 28;   // diámetro del knob (px)
const KNOB_GAP = 4;    // margen del knob al borde (px)
// knob light: 100% - KNOB - KNOB_GAP
// knob dark:  KNOB_GAP

export const ThemeToggle = ({
  isDark,
  onToggle,
  isMobile = false,
}: {
  isDark: boolean;
  onToggle: () => void;
  isMobile?: boolean;
}) => {
  const iconColor   = isDark ? '#7aaac8' : '#1a5fbc';
  const trackBg     = isDark ? '#1a2540' : '#e8f0fe';
  const trackBorder = isDark ? 'rgba(26,95,188,0.35)' : 'rgba(26,95,188,0.2)';
  const trackShadow = isDark ? '0 2px 10px rgba(0,0,0,0.3)' : '0 2px 8px rgba(26,95,188,0.1)';
  const knobBg      = isDark ? '#1e3460' : '#fff';
  const knobShadow  = isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(26,95,188,0.2)';
  const labelColor  = isDark ? '#7aaac8' : '#1a5fbc';

  // Posición del knob
  const knobLeft = isDark ? `${KNOB_GAP}px` : `${W - KNOB - KNOB_GAP}px`;
  // Posición del texto: opuesto al knob
  const textLeft = isDark ? `${KNOB_GAP + KNOB + 6}px` : `${KNOB_GAP + 2}px`;

  const BASE_TRANSITION = 'background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease';

  return (
    <div
      onClick={onToggle}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      style={{
        position: 'relative',
        width: `${W}px`, height: `${H}px`, borderRadius: '999px',
        background: trackBg,
        border: `1.5px solid ${trackBorder}`,
        boxShadow: trackShadow,
        cursor: 'pointer', userSelect: 'none', flexShrink: 0,
        transition: BASE_TRANSITION,
        overflow: 'hidden',
      }}
    >
      {/* Label */}
      <span style={{
        position: 'absolute',
        top: '50%', transform: 'translateY(-50%)',
        left: textLeft,
        fontSize: '0.63rem', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', whiteSpace: 'nowrap',
        color: labelColor,
        transition: 'left 0.3s cubic-bezier(0.4,0,0.2,1), color 0.3s ease',
      }}>
        {isDark ? 'Noche' : 'Día'}
      </span>

      {/* Knob */}
      <div style={{
        position: 'absolute',
        top: `${KNOB_GAP}px`, left: knobLeft,
        width: `${KNOB}px`, height: `${KNOB}px`, borderRadius: '50%',
        background: knobBg, boxShadow: knobShadow,
        display: 'grid', placeItems: 'center',
        transition: 'left 0.3s cubic-bezier(0.4,0,0.2,1), background 0.3s ease',
      }}>
        {isDark ? <MoonIcon color={iconColor} /> : <SunIcon color={iconColor} />}
      </div>
    </div>
  );
};
