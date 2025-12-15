'use client'

import { useEffect, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Workspace Page - Redirects to main SAM interface with workspace context
 *
 * This page exists for backward compatibility with signup flows that redirect to /workspace/[workspaceId].
 * Since SAM AI uses a single interface at the root level, we redirect to / with the workspace param.
 */
export default function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resolvedParams = use(params)
  const workspaceId = resolvedParams.workspaceId

  useEffect(() => {
    // Preserve any query params (like slack_success, slack_error)
    const queryString = searchParams.toString()
    const redirectUrl = queryString
      ? `/?workspace=${workspaceId}&${queryString}`
      : `/?workspace=${workspaceId}`

    // Redirect to main SAM interface with workspace context
    router.push(redirectUrl)
  }, [router, workspaceId, searchParams])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-white">Loading workspace...</div>
    </div>
  )
}
