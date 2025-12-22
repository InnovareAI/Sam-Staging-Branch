'use client'

import { useParams } from 'next/navigation'
import CampaignHub from '@/app/components/CampaignHub'

/**
 * Campaign Hub Page - New Workspace Architecture
 * Renders CampaignHub directly within the workspace layout
 */
export default function WorkspaceCampaignHubPage() {
  const params = useParams()
  const workspaceId = params.workspaceId as string

  return (
    <div className="h-full overflow-y-auto">
      <CampaignHub workspaceId={workspaceId} />
    </div>
  )
}
