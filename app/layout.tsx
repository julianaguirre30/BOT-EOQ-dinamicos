import { ReactNode } from 'react';

export const metadata = {
  title: 'Simplex · Asistente de Inventario EOQ',
  description: 'Calculá el plan óptimo de pedidos con el modelo EOQ dinámico.',
  icons: { icon: '/logo.png' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
