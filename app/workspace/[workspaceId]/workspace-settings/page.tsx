'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/app/lib/supabase'
import {
    Building2,
    Users,
    UserPlus,
    Mail,
    Loader2,
    Settings,
    Calendar,
    Clock,
    CheckCircle
} from 'lucide-react'

/**
 * Workspace Settings Page - Workspace Architecture
 * Manage workspace members, invitations, and team settings
 */
export default function WorkspaceSettingsPage() {
    const params = useParams()
    const workspaceId = params.workspaceId as string

    const [loading, setLoading] = useState(true)
    const [workspace, setWorkspace] = useState<any>(null)
    const [members, setMembers] = useState<any[]>([])
    const [invitations, setInvitations] = useState<any[]>([])

    useEffect(() => {
        loadWorkspaceData()
    }, [workspaceId])

    const loadWorkspaceData = async () => {
        setLoading(true)
        try {
            const supabase = createClient()

            // Load workspace details
            const { data: workspaceData } = await supabase
                .from('workspaces')
                .select('*')
                .eq('id', workspaceId)
                .single()

            if (workspaceData) {
                setWorkspace(workspaceData)
            }

            // Load workspace members
            const { data: membersData } = await supabase
                .from('workspace_members')
                .select(`
                    *,
                    users:user_id (
                        id,
                        email,
                        full_name
                    )
                `)
                .eq('workspace_id', workspaceId)

            if (membersData) {
                setMembers(membersData)
            }

            // Load pending invitations
            const { data: invitationsData } = await supabase
                .from('workspace_invitations')
                .select('*')
                .eq('workspace_id', workspaceId)
                .eq('status', 'pending')

            if (invitationsData) {
                setInvitations(invitationsData)
            }
        } catch (error) {
            console.error('Error loading workspace data:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
                {/* Page Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
                        <Building2 className="text-primary" size={28} />
                        Workspace Settings
                    </h1>
                    <p className="text-gray-400 mt-1">Manage your workspace, team members, and invitations</p>
                </div>

                {/* Workspace Info Card */}
                <div className="bg-surface-muted/50 border border-border rounded-xl p-6 mb-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Settings size={20} className="text-primary" />
                        Workspace Details
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm text-muted-foreground">Name</label>
                            <p className="text-white font-medium">{workspace?.name || 'Unnamed Workspace'}</p>
                        </div>
                        <div>
                            <label className="text-sm text-muted-foreground">Created</label>
                            <p className="text-white font-medium">
                                {workspace?.created_at ? new Date(workspace.created_at).toLocaleDateString() : '-'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Team Members Card */}
                <div className="bg-surface-muted/50 border border-border rounded-xl p-6 mb-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Users size={20} className="text-blue-400" />
                        Team Members ({members.length})
                    </h2>
                    {members.length === 0 ? (
                        <p className="text-gray-400 text-sm">No team members yet</p>
                    ) : (
                        <div className="space-y-3">
                            {members.map((member) => (
                                <div
                                    key={member.id}
                                    className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                            <span className="text-primary font-medium">
                                                {member.users?.full_name?.[0] || member.users?.email?.[0] || '?'}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-white font-medium">
                                                {member.users?.full_name || member.users?.email || 'Unknown'}
                                            </p>
                                            <p className="text-gray-400 text-sm">{member.role || 'Member'}</p>
                                        </div>
                                    </div>
                                    <CheckCircle size={18} className="text-green-500" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pending Invitations Card */}
                <div className="bg-surface-muted/50 border border-border rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Mail size={20} className="text-yellow-400" />
                        Pending Invitations ({invitations.length})
                    </h2>
                    {invitations.length === 0 ? (
                        <p className="text-gray-400 text-sm">No pending invitations</p>
                    ) : (
                        <div className="space-y-3">
                            {invitations.map((invite) => (
                                <div
                                    key={invite.id}
                                    className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                            <UserPlus size={18} className="text-yellow-400" />
                                        </div>
                                        <div>
                                            <p className="text-white font-medium">{invite.email}</p>
                                            <p className="text-gray-400 text-sm flex items-center gap-1">
                                                <Clock size={12} />
                                                Sent {new Date(invite.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                                        Pending
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
