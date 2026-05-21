import { ReactNode } from 'react';

export const metadata = {
  title: 'Simplex · Asistente EOQ Dinámico',
  description: 'Calculá el plan óptimo de pedidos con el modelo EOQ dinámico.',
  icons: { icon: '/isologo.png' },
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/*
          interactive-widget=resizes-visual  →  Chrome Android NO redimensiona el
          layout viewport cuando aparece el teclado; solo cambia el visual viewport.
          Esto elimina el layout shift en Android. iOS Safari lo ignora (ya se comporta así).
        */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, interactive-widget=resizes-visual" />
        <meta name="theme-color" content="#1a5fbc" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Simplex" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
        <style>{`*, *::before, *::after { box-sizing: border-box; } html, body { overflow-x: hidden; }`}</style>
        {children}
      </body>
    </html>
  );
}
