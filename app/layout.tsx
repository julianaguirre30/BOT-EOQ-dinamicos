import { ReactNode } from 'react';

export const metadata = {
  title: 'Simplex · Asistente EOQ Dinámico',
  description: 'Calculá el plan óptimo de pedidos con el modelo EOQ dinámico.',
  icons: { icon: '/isologo.png' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
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
