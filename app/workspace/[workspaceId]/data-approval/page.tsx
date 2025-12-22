'use client'

import { useParams } from 'next/navigation'
import ProspectHub from './components/ProspectHub'

/**
 * Data Approval Page - New Workspace Architecture
 * Renders ProspectHub (Redesigned Prospect Database) directly within the workspace layout
 */
export default function WorkspaceDataApprovalPage() {
    const params = useParams()
    const workspaceId = params.workspaceId as string

    return (
        <div className="h-full overflow-y-auto">
            <ProspectHub workspaceId={workspaceId} />
        </div>
    )
}
