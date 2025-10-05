'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Workspace Page - Redirects to main SAM interface
 *
 * This page exists for backward compatibility with signup flows that redirect to /workspace/[workspaceId].
 * Since SAM AI uses a single interface at the root level, we redirect to / instead of showing a workspace-specific page.
 */
export default function WorkspacePage({ params }: { params: { workspaceId: string } }) {
  const router = useRouter()

  useEffect(() => {
    // Redirect to main SAM interface
    router.push('/')
  }, [router])

  return null
}
