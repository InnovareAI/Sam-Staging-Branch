'use client'

import { useParams } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
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
            {/* Page Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
                    <BarChart3 className="text-primary" size={28} />
                    Analytics
                </h1>
                <p className="text-gray-400 mt-1">Track campaign performance, engagement metrics, and conversion rates</p>
            </div>

            <Analytics workspaceId={workspaceId} />
        </div>
    )
}
