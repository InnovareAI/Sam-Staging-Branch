'use client'

import { useParams } from 'next/navigation'
import CampaignHub from '@/app/components/CampaignHub'

export default function WorkspaceCampaignHubPage() {
  const params = useParams()
  const workspaceId = params.workspaceId as string

  return (
    <div className="min-h-screen bg-black">
      <CampaignHub workspaceId={workspaceId} />
    </div>
  )
}
