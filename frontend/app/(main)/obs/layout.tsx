import '@/app/globals.css';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html>
      <body className="flex items-center justify-center min-h-screen bg-transparent pointer-events-none">
        {children}
      </body>
    </html>
  );
}
