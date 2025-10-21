'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Campaign Hub Redirect Page
 *
 * This route exists for direct linking to Campaign Hub from external flows (e.g., prospect approval).
 * However, Campaign Hub is part of the main SAM interface with full navigation/layout.
 *
 * We redirect to the main page with the campaign section active.
 * Using window.location.href instead of router.push() to preserve authentication cookies.
 */
export default function WorkspaceCampaignHubPage() {
  const params = useParams()
  const workspaceId = params.workspaceId as string

  useEffect(() => {
    // Use full page navigation to preserve auth cookies
    // router.push() can lose session during client-side navigation
    window.location.href = `/?section=campaign&workspace=${workspaceId}`
  }, [workspaceId])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-white">Loading Campaign Hub...</div>
    </div>
  )
}
