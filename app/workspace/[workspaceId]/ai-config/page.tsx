'use client'

import { useParams } from 'next/navigation'
import AIConfiguration from '@/app/components/AIConfiguration'

/**
 * AI Configuration Page - Workspace Architecture
 * Configure AI agents, models, and automation settings
 */
export default function WorkspaceAIConfigPage() {
    const params = useParams()
    const workspaceId = params.workspaceId as string

    return (
        <div className="h-full overflow-y-auto p-6">
            <AIConfiguration
                workspaceId={workspaceId}
                workspaceName={undefined}
            />
        </div>
    )
}
