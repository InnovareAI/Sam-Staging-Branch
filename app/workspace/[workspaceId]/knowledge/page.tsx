'use client'

import { useParams } from 'next/navigation'
import KnowledgeBase from '@/app/components/KnowledgeBase'

/**
 * Knowledge Base Page - New Workspace Architecture
 * Renders KnowledgeBase directly within the workspace layout
 */
export default function WorkspaceKnowledgePage() {
    const params = useParams()
    const workspaceId = params.workspaceId as string

    return (
        <div className="h-full overflow-y-auto p-6">
            <KnowledgeBase />
        </div>
    )
}
