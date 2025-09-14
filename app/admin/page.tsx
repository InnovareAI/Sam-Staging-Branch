"use client"

import { useState, useEffect } from "react"
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Users, Building2, Settings, UserPlus, Activity, TrendingUp, Grid3x3, List, ArrowLeft, Info } from "lucide-react"

export default function SuperAdminPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'card' | 'info'>('info');
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const router = useRouter();

  const fetchWorkspaces = async () => {
    try {
      // Fetch workspaces from Supabase
      const { data: workspacesData, error: workspacesError } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false });

      if (workspacesError) {
        console.error('Error fetching workspaces:', workspacesError);
        return;
      }

      // For each workspace, fetch the members and pending invitations
      const workspacesWithMembers = await Promise.all(
        workspacesData.map(async (workspace) => {
          // Fetch workspace members
          const { data: membersData, error: membersError } = await supabase
            .from('workspace_members')
            .select(`
              role,
              users:user_id (
                email
              )
            `)
            .eq('workspace_id', workspace.id);

          // Fetch pending invitations
          const { data: invitationsData, error: invitationsError } = await supabase
            .from('invitations')
            .select('email, status')
            .eq('workspace_id', workspace.id)
            .eq('status', 'pending');

          if (membersError) {
            console.error('Error fetching members for workspace:', workspace.name, membersError);
          }
          if (invitationsError) {
            console.error('Error fetching invitations for workspace:', workspace.name, invitationsError);
          }

          const members = membersData || [];
          const pendingInvitations = invitationsData || [];
          const owner = members.find((m: any) => m.role === 'owner');
          const membersList = members.map((m: any) => 
            `${m.users?.email || 'Unknown'} (${m.role})`
          );
          const pendingList = pendingInvitations.map((inv: any) => 
            `${inv.email} (pending)`
          );

          // Determine company based on workspace name or owner
          let company = 'InnovareAI'; // default
          let companyColor = 'bg-blue-600';
          
          if (workspace.name.toLowerCase().includes('3cubed') || workspace.name === '3cubed') {
            company = '3cubed';
            companyColor = 'bg-orange-600';
          } else if (workspace.name.toLowerCase().includes('sendingcell')) {
            company = 'Sendingcell';
            companyColor = 'bg-green-600';
          } else if (workspace.name.toLowerCase().includes('wt') || workspace.name.toLowerCase().includes('matchmaker')) {
            company = 'WT Matchmaker';
            companyColor = 'bg-purple-600';
          }

          return {
            id: workspace.slug || workspace.name.toLowerCase(),
            name: workspace.name,
            displayName: workspace.slug || workspace.name.toLowerCase(),
            created: new Date(workspace.created_at).toLocaleDateString(),
            owner: (owner as any)?.users?.email || 'Unknown',
            members: members.length,
            membersList: membersList,
            pendingInvitations: pendingInvitations.length,
            pendingList: pendingList,
            company: company,
            companyColor: companyColor
          };
        })
      );

      setWorkspaces(workspacesWithMembers);
    } catch (error) {
      console.error('Error fetching workspace data:', error);
    }
  };

  const toggleWorkspaceSelection = (workspaceId: string) => {
    setSelectedWorkspaces(prev => 
      prev.includes(workspaceId) 
        ? prev.filter(id => id !== workspaceId)
        : [...prev, workspaceId]
    );
  };

  const toggleSelectAll = () => {
    setSelectedWorkspaces(prev => 
      prev.length === workspaces.length ? [] : workspaces.map(w => w.id)
    );
  };

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/signin');
        return;
      }

      // Check if user is super admin
      if (session.user.email !== 'tl@innovareai.com') {
        setLoading(false);
        return; // Will show access denied
      }

      setUser(session.user);
      
      // Fetch workspaces after user authentication
      await fetchWorkspaces();
      
      setLoading(false);
    } catch (error) {
      console.error('Error checking user:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user || user.email !== 'tl@innovareai.com') {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-8 flex items-center justify-center">
        <Card className="bg-slate-800 border border-red-500/50 shadow-2xl w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-red-400">🔒 Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-2">
            <p className="text-white">Super admin access required.</p>
            <p className="text-sm text-slate-400">Only tl@innovareai.com can access this panel.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Colored Top Bar with reduced opacity */}
      <div className="bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 border-b border-slate-700/50">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Chat
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Super Admin Panel
                </h1>
                <p className="text-slate-300">Advanced tenant and user management</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-300">Company:</p>
              <p className="text-lg font-semibold text-blue-300">InnovareAI</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-8">

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Button className="bg-green-600 hover:bg-green-700 py-6">
          <Building2 className="h-5 w-5 mr-3" />
          <div className="text-left">
            <div className="font-semibold">Create Workspace</div>
            <div className="text-xs opacity-80">New workspace</div>
          </div>
        </Button>
        <Button className="bg-blue-600 hover:bg-blue-700 py-6">
          <UserPlus className="h-5 w-5 mr-3" />
          <div className="text-left">
            <div className="font-semibold">Invite User</div>
            <div className="text-xs opacity-80">Send invitation</div>
          </div>
        </Button>
        <Button className="bg-purple-600 hover:bg-purple-700 py-6">
          <Users className="h-5 w-5 mr-3" />
          <div className="text-left">
            <div className="font-semibold">Manage Users</div>
            <div className="text-xs opacity-80">User administration</div>
          </div>
        </Button>
      </div>

      <div className="mb-4">
        <p className="text-sm text-slate-400">
          Company emails will be sent from: <span className="text-blue-400">sp@innovareai.com</span>
        </p>
      </div>

      {/* Workspace Management */}
      <Card className="bg-slate-800 border border-slate-700 shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">All Workspaces</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="select-all"
                  checked={selectedWorkspaces.length === workspaces.length}
                  onChange={toggleSelectAll}
                />
                <label htmlFor="select-all" className="text-sm text-slate-400">
                  Select All
                </label>
              </div>
              <p className="text-sm text-slate-400">{workspaces.length} workspaces</p>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  onClick={() => setViewMode('list')}
                  className="p-2"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'card' ? 'default' : 'outline'}
                  onClick={() => setViewMode('card')}
                  className="p-2"
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'info' ? 'default' : 'outline'}
                  onClick={() => setViewMode('info')}
                  className="p-2"
                >
                  <Info className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* List View */}
          {viewMode === 'list' && (
            <div className="space-y-2">
              {workspaces.map((workspace) => (
                <div 
                  key={workspace.id} 
                  className="flex items-center gap-4 p-3 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer"
                  onClick={() => console.log('Navigate to workspace:', workspace.id)}
                >
                  <Checkbox 
                    checked={selectedWorkspaces.includes(workspace.id)}
                    onChange={() => toggleWorkspaceSelection(workspace.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-white">{workspace.name}</h3>
                      <p className="text-sm text-slate-400">{workspace.displayName} • Created {workspace.created}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${workspace.companyColor} text-white`}>
                        {workspace.company}
                      </Badge>
                      <Badge variant="outline" className="text-slate-400">
                        {workspace.members} member{workspace.members !== 1 ? 's' : ''}
                      </Badge>
                      {workspace.pendingInvitations > 0 && (
                        <Badge variant="outline" className="text-amber-400 border-amber-400">
                          {workspace.pendingInvitations} pending
                        </Badge>
                      )}
                      <Button size="sm" className="bg-green-600 hover:bg-green-700">
                        Invite
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Card View */}
          {viewMode === 'card' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspaces.map((workspace) => (
                <Card 
                  key={workspace.id} 
                  className="bg-slate-700/50 border border-slate-600 hover:border-slate-500 transition-colors cursor-pointer h-48"
                  onClick={() => console.log('Navigate to workspace:', workspace.id)}
                >
                  <CardContent className="p-6 h-full flex flex-col">
                    <div className="flex items-start gap-3 mb-4">
                      <Checkbox 
                        checked={selectedWorkspaces.includes(workspace.id)}
                        onChange={() => toggleWorkspaceSelection(workspace.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-white text-lg mb-1">{workspace.name}</h3>
                        <p className="text-sm text-blue-400">{workspace.displayName}</p>
                        <p className="text-xs text-slate-500">Created {workspace.created}</p>
                      </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <p className="text-xs text-slate-400">Owner: <span className="text-blue-400">{workspace.owner}</span></p>
                      </div>
                      
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex flex-col gap-1">
                          <Badge className={`${workspace.companyColor} text-white text-xs`}>
                            {workspace.company}
                          </Badge>
                          <Badge variant="outline" className="text-slate-400 text-xs">
                            {workspace.members} member{workspace.members !== 1 ? 's' : ''}
                          </Badge>
                          {workspace.pendingInvitations > 0 && (
                            <Badge variant="outline" className="text-amber-400 border-amber-400 text-xs">
                              {workspace.pendingInvitations} pending
                            </Badge>
                          )}
                        </div>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs">
                          Invite
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Info View (Current detailed view) */}
          {viewMode === 'info' && (
            <div className="space-y-6">
              {workspaces.map((workspace) => (
                <Card key={workspace.id} className="bg-slate-700/50 border border-slate-600">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Checkbox 
                        checked={selectedWorkspaces.includes(workspace.id)}
                        onChange={() => toggleWorkspaceSelection(workspace.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-3">
                        <div>
                          <h3 className="text-xl font-semibold text-white">{workspace.name}</h3>
                          <p className="text-blue-400 text-sm">{workspace.displayName}</p>
                          <p className="text-slate-400 text-sm">Created {workspace.created}</p>
                        </div>
                        
                        <div>
                          <p className="text-slate-400 text-sm">Owner: <span className="text-blue-400">{workspace.owner}</span></p>
                          
                          {workspace.members > 0 && (
                            <div className="mt-2">
                              <p className="text-slate-400 text-sm">Members ({workspace.members}):</p>
                              <div className="mt-1 space-y-1">
                                {workspace.membersList.map((member, index) => (
                                  <p key={index} className="text-xs text-slate-500">{member}</p>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {workspace.pendingInvitations > 0 && (
                            <div className="mt-2">
                              <p className="text-slate-400 text-sm">Pending Invitations ({workspace.pendingInvitations}):</p>
                              <div className="mt-1 space-y-1">
                                {workspace.pendingList.map((pending, index) => (
                                  <p key={index} className="text-xs text-amber-500">{pending}</p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button size="sm" className="bg-green-600 hover:bg-green-700">
                            Invite
                          </Button>
                          <Badge variant="outline" className="text-slate-400">
                            {workspace.members} member{workspace.members !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  )
}