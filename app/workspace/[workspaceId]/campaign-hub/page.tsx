'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Campaign Hub Redirect Page
 *
 * This route exists for direct linking to Campaign Hub from external flows (e.g., prospect approval).
 * However, Campaign Hub is part of the main SAM interface with full navigation/layout.
 *
 * We redirect to the main page with the campaign section active.
 */
export default function WorkspaceCampaignHubPage() {
  const params = useParams()
  const router = useRouter()
  const workspaceId = params.workspaceId as string

  useEffect(() => {
    // Redirect to main page with campaign section active
    // The main page will handle the full layout, navigation, and Campaign Hub component
    router.push(`/?section=campaign&workspace=${workspaceId}`)
  }, [router, workspaceId])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-white">Loading Campaign Hub...</div>
    </div>
  )
}
