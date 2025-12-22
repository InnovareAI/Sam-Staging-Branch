'use client'

import { useParams } from 'next/navigation'
import Analytics from '@/app/components/Analytics'

/**
 * Analytics Page - New Workspace Architecture
 * Renders Analytics directly within the workspace layout
 */
export default function WorkspaceAnalyticsPage() {
    const params = useParams()
    const workspaceId = params.workspaceId as string

    return (
        <div className="h-full overflow-y-auto p-6">
            <Analytics workspaceId={workspaceId} />
        </div>
    )
}
