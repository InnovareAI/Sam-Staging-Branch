'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { WorkspaceAccountSwitcher } from '@/components/workspace-account-switcher'

export default function WorkspaceAccountsPage() {
  const { user } = useUser()
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)

  useEffect(() => {
    // Get current workspace from user metadata or API
    const currentWorkspace = user?.publicMetadata?.workspaceId as string
    if (currentWorkspace) {
      setWorkspaceId(currentWorkspace)
    }
  }, [user])

  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading Workspace Accounts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Workspace Accounts</h1>
          <p className="text-gray-400">
            Manage team member accounts and switch between different platform connections
          </p>
        </div>
        
        <WorkspaceAccountSwitcher workspaceId={workspaceId} />
      </div>
    </div>
  )
}