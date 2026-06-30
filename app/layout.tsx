import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Helping Hand | Your AI Productivity Companion',
  description: 'A proactive AI productivity companion that dynamically optimizes your schedule, plans complex tasks, and helps you achieve focus.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased text-slate-900 bg-slate-50/50 min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
