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
      <body className="bg-background text-foreground antialiased">
        <DemoProvider>
          {children}
          <ToastContainer />
        </DemoProvider>
      </body>
    </html>
  )
}
