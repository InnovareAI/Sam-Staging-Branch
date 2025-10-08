import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { DemoProvider } from '@/lib/contexts/DemoContext'
import ToastContainer from '@/components/ToastContainer'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

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
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body className="bg-background text-foreground antialiased">
        <DemoProvider>
          {children}
          <ToastContainer />
        </DemoProvider>
      </body>
    </html>
  )
}
