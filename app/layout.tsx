import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SAM AI - Sales Assistant',
  description: 'AI-powered Sales Assistant Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Enable Clerk for production deployment at app.meet-sam.com
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        elements: {
          formButtonPrimary: 'bg-purple-600 hover:bg-purple-700',
          card: 'bg-gray-800',
          headerTitle: 'hidden',
          headerSubtitle: 'hidden',
          logoBox: 'hidden',
          logoImage: 'hidden'
        },
        layout: {
          logoPlacement: 'none',
          showOptionalFields: true
        }
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  )
}