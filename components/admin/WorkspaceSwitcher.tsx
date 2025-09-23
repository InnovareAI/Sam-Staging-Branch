'use client'

import React, { useState, useEffect } from 'react'
import { Building2, Users, ChevronDown, Settings, Eye, ArrowRightLeft } from 'lucide-react'

interface Workspace {
  id: string
  name: string
  slug: string
  owner: {
    email: string
    id: string
  }
  access_type: string
  permission_level: string
  member_count: number
}

interface Campaign {
  id: string
  name: string
  status: string
  created_at: string
}

interface WorkspaceSwitcherProps {
  currentWorkspaceId?: string
  onWorkspaceChange?: (workspaceId: string, workspace: any) => void
  className?: string
}

export default function WorkspaceSwitcher({ 
  currentWorkspaceId, 
  onWorkspaceChange, 
  className = '' 
}: WorkspaceSwitcherProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [userRole, setUserRole] = useState<string>('')

  useEffect(() => {
    fetchWorkspaces()
  }, [])

  const fetchWorkspaces = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_accessible_workspaces' })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch workspaces')
      }

      const data = await response.json()
      setWorkspaces(data.workspaces || [])
      setUserRole(data.userRole || '')
      
      // Set first workspace as default if none selected
      if (!selectedWorkspace && data.workspaces?.length > 0) {
        setSelectedWorkspace(data.workspaces[0])
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error)
    } finally {
      setLoading(false)
    }
  }

  const switchWorkspace = async (targetWorkspace: Workspace) => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'switch_workspace',
          targetWorkspaceId: targetWorkspace.id,
          originalWorkspaceId: selectedWorkspace?.id
        })
      })

      if (!response.ok) {
        throw new Error('Failed to switch workspace')
      }

      const data = await response.json()
      setSelectedWorkspace(targetWorkspace)
      setCampaigns(data.campaigns || [])
      setIsOpen(false)
      
      // Notify parent component
      onWorkspaceChange?.(targetWorkspace.id, {
        workspace: data.workspace,
        campaigns: data.campaigns,
        adminNote: data.adminNote
      })

      console.log('✅ Switched to workspace:', data.message)
    } catch (error) {
      console.error('Error switching workspace:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!userRole || userRole === 'user') {
    return null // Hide for non-admin users
  }

  return (
    <div className={`relative ${className}`}>
      {/* Admin Badge */}
      <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
        <Settings size={16} className="text-amber-600" />
        <span className="text-sm font-medium text-amber-700">
          Admin Mode - Managing Other Workspaces
        </span>
      </div>

      {/* Workspace Selector */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          disabled={loading}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
              <Building2 size={16} className="text-blue-600" />
            </div>
            <div className="text-left">
              <div className="font-medium text-gray-900">
                {selectedWorkspace?.name || 'Select Workspace'}
              </div>
              {selectedWorkspace && (
                <div className="text-sm text-gray-500">
                  Owner: {selectedWorkspace.owner?.email}
                </div>
              )}
            </div>
          </div>
          <ChevronDown 
            size={16} 
            className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide px-2 py-1">
                Available Workspaces ({workspaces.length})
              </div>
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => switchWorkspace(workspace)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors ${
                    selectedWorkspace?.id === workspace.id ? 'bg-blue-50 border border-blue-200' : ''
                  }`}
                  disabled={loading}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                    <Building2 size={14} className="text-gray-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900">{workspace.name}</div>
                    <div className="text-sm text-gray-500">
                      Owner: {workspace.owner?.email || 'Unknown'}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        workspace.access_type === 'admin' 
                          ? 'bg-amber-100 text-amber-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {workspace.access_type}
                      </span>
                      {workspace.member_count > 0 && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Users size={10} />
                          {workspace.member_count}
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedWorkspace?.id === workspace.id && (
                    <Eye size={16} className="text-blue-600" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Current Workspace Info */}
      {selectedWorkspace && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Current Workspace</h3>
            <div className="flex items-center gap-1 text-xs text-blue-600">
              <ArrowRightLeft size={12} />
              Admin Access
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-500">Name:</span> {selectedWorkspace.name}
            </div>
            <div>
              <span className="text-gray-500">Owner:</span> {selectedWorkspace.owner?.email}
            </div>
            <div>
              <span className="text-gray-500">Access Level:</span> {selectedWorkspace.permission_level}
            </div>
            {campaigns.length > 0 && (
              <div>
                <span className="text-gray-500">Recent Campaigns:</span>
                <div className="mt-1 space-y-1">
                  {campaigns.slice(0, 3).map((campaign) => (
                    <div key={campaign.id} className="flex items-center justify-between pl-2">
                      <span className="text-gray-700">{campaign.name}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        campaign.status === 'active' 
                          ? 'bg-green-100 text-green-700'
                          : campaign.status === 'paused'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {campaign.status}
                      </span>
                    </div>
                  ))}
                  {campaigns.length > 3 && (
                    <div className="text-xs text-gray-500 pl-2">
                      +{campaigns.length - 3} more campaigns
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-lg">
          <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
        </div>
      )}
    </div>
  )
}