import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #f8fffb 0%, #ffffff 48%, #f7fff8 100%)',
      color: '#0f172a',
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      display: 'grid',
      placeItems: 'center',
      padding: '32px',
    }}>
      <section style={{
        width: '100%',
        maxWidth: '820px',
        borderRadius: '32px',
        padding: '48px 40px',
        background: '#ffffff',
        border: '1px solid rgba(16, 185, 129, 0.18)',
        boxShadow: '0 28px 90px rgba(16, 185, 129, 0.12)',
        textAlign: 'center',
      }}>
        <span style={{
          display: 'inline-flex',
          padding: '6px 14px',
          borderRadius: '999px',
          background: 'rgba(16, 185, 129, 0.14)',
          border: '1px solid rgba(16, 185, 129, 0.24)',
          color: '#047857',
          fontSize: '0.82rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          Bienvenido
        </span>
        <h1 style={{ fontSize: 'clamp(2.6rem, 5vw, 4rem)', margin: '24px 0 18px', lineHeight: 1.05 }}>
          Asistente EOQ dinámico
        </h1>
        <p style={{ color: '#334155', fontSize: '1.05rem', lineHeight: 1.8, maxWidth: '720px', margin: '0 auto 32px' }}>
          Describí tu problema en lenguaje natural y el asistente te guía para elegir el modelo correcto, calcular el plan óptimo y entender cada decisión.
        </p>
        <Link href="/chat" style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '999px',
          padding: '16px 30px',
          background: 'linear-gradient(135deg, #10b981, #047857)',
          color: '#ffffff',
          fontSize: '1rem',
          fontWeight: 700,
          textDecoration: 'none',
          boxShadow: '0 14px 28px rgba(16, 185, 129, 0.28)',
        }}>
          Comenzar ahora
        </Link>
      </section>
    </main>
  );
}
