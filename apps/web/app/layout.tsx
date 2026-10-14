import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SmartCommerce',
  description: 'Tienda demo para preventa inteligente y cierre por WhatsApp.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
