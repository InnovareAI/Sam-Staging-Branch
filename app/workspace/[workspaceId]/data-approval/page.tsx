'use client'

import { useParams } from 'next/navigation'
import DataCollectionHub from '@/components/DataCollectionHub'

/**
 * Data Approval Page - New Workspace Architecture
 * Renders DataCollectionHub (Prospect Database) directly within the workspace layout
 */
export default function WorkspaceDataApprovalPage() {
    const params = useParams()
    const workspaceId = params.workspaceId as string

    return (
        <div className="h-full overflow-y-auto">
            <DataCollectionHub workspaceId={workspaceId} />
        </div>
    )
}
