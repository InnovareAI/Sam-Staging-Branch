'use client'

import { useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * Workspace Page - Redirects to Commenting Agent
 *
 * Default landing page for workspace routes.
 * Redirects to /workspace/[workspaceId]/commenting-agent as the primary feature.
 */
export default function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const router = useRouter()
  const resolvedParams = use(params)
  const workspaceId = resolvedParams.workspaceId

  useEffect(() => {
    // Redirect to commenting-agent as default workspace landing page
    router.push(`/workspace/${workspaceId}/commenting-agent`)
  }, [router, workspaceId])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={32} className="animate-spin text-primary" />
        <div className="text-foreground">Loading workspace...</div>
      </div>
    </div>
  )
}
