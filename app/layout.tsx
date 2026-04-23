import { ReactNode } from 'react';

export const metadata = {
  title: 'EOQ tutor MVP',
  description: 'Conversational EOQ tutor with structured solver responses.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
