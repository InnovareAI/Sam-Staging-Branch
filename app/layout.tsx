import type { Metadata } from 'next'
import './globals.css'
import { DemoProvider } from '@/lib/contexts/DemoContext'
import ToastContainer from '@/components/ToastContainer'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'SAM AI - Sales Assistant',
  description: 'AI-powered Sales Assistant Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body className="bg-background text-foreground antialiased">
        <Providers>
          <DemoProvider>
            {children}
            <ToastContainer />
          </DemoProvider>
        </Providers>
      </body>
    </html>
  )
}
