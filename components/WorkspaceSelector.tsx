'use client'

import { useState, useEffect } from 'react'
import { Building2, ChevronDown, Check } from 'lucide-react'

interface Workspace {
  id: string
  name: string
}

interface WorkspaceSelectorProps {
  userEmail?: string | null
}

export function WorkspaceSelector({ userEmail }: WorkspaceSelectorProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Only show for InnovareAI accounts
  const isInnovareAI = userEmail?.includes('@innovareai.com')
  
  if (!isInnovareAI) {
    return null
  }

  useEffect(() => {
    fetchWorkspaces()
  }, [])

  const fetchWorkspaces = async () => {
    try {
      console.log('[WorkspaceSelector] Fetching workspaces for:', userEmail)
      const res = await fetch('/api/workspace/list')
      const data = await res.json()
      console.log('[WorkspaceSelector] API response:', data)
      
      if (res.ok) {
        setWorkspaces(data.workspaces || [])
        setCurrentWorkspace(data.current || null)
        console.log('[WorkspaceSelector] Set workspaces:', data.workspaces?.length)
      }
    } catch (error) {
      console.error('[WorkspaceSelector] Error fetching workspaces:', error)
    }
  }

  const switchWorkspace = async (workspace: Workspace) => {
    if (workspace.id === currentWorkspace?.id) {
      setIsOpen(false)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/workspace/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspace.id })
      })

      if (res.ok) {
        setCurrentWorkspace(workspace)
        setIsOpen(false)
        // Reload to refresh all workspace-dependent data
        window.location.reload()
      }
    } catch (error) {
      console.error('Error switching workspace:', error)
    } finally {
      setLoading(false)
    }
  }

  console.log('[WorkspaceSelector] Render check:', { 
    isInnovareAI, 
    userEmail, 
    workspaceCount: workspaces.length,
    workspaces 
  })

  if (workspaces.length <= 1) {
    console.log('[WorkspaceSelector] Hidden - only', workspaces.length, 'workspace(s)')
    return null // Don't show if only one workspace
  }

  return (
    <div className="relative px-5 py-3 border-t border-border/60">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border/60 bg-surface-highlight/40 hover:bg-surface-highlight/60 transition"
        disabled={loading}
      >
        <div className="flex items-center gap-3">
          <Building2 size={16} className="text-muted-foreground" />
          <div className="text-left">
            <p className="text-xs text-muted-foreground">Workspace</p>
            <p className="text-sm font-medium text-white truncate">
              {currentWorkspace?.name || 'Select workspace'}
            </p>
          </div>
        </div>
        <ChevronDown 
          size={16} 
          className={`text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute bottom-full left-5 right-5 mb-2 z-50 bg-surface-muted border border-border rounded-xl shadow-xl max-h-64 overflow-y-auto">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => switchWorkspace(workspace)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-highlight transition ${
                  workspace.id === currentWorkspace?.id ? 'bg-primary/10' : ''
                }`}
                disabled={loading}
              >
                <div className="flex items-center gap-3">
                  <Building2 size={14} className="text-muted-foreground" />
                  <span className="text-sm text-foreground">{workspace.name}</span>
                </div>
                {workspace.id === currentWorkspace?.id && (
                  <Check size={14} className="text-primary" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
