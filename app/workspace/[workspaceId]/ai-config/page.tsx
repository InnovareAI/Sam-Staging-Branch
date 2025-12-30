'use client'

import { useParams } from 'next/navigation'
import { Bot } from 'lucide-react'
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
            {/* Page Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
                    <Bot className="text-primary" size={28} />
                    AI Configuration
                </h1>
                <p className="text-gray-400 mt-1">Configure AI agents, models, and automation settings</p>
            </div>

            <AIConfiguration
                workspaceId={workspaceId}
                workspaceName={undefined}
            />
        </div>
    )
}
