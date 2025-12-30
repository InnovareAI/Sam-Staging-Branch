'use client'

import { useParams } from 'next/navigation'
import { BookOpen } from 'lucide-react'
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
            {/* Page Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
                    <BookOpen className="text-primary" size={28} />
                    Knowledge Base
                </h1>
                <p className="text-gray-400 mt-1">Upload documents and train SAM on your products, ICPs, and competitors</p>
            </div>

            <KnowledgeBase />
        </div>
    )
}
