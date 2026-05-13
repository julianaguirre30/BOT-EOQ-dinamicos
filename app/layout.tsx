import { ReactNode } from 'react';

export const metadata = {
  title: 'EOQ tutor',
  description: 'Resuelve tus problemas de EOQ dinámico con la ayuda del tutor.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
