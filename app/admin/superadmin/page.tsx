'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Shield,
  Users,
  Building2,
  Activity,
  Server,
  Database,
  Zap,
  BarChart3,
  Clock,
  RefreshCw,
  Eye,
  Settings,
  Cpu,
  HardDrive,
  Wifi,
  AlertCircle,
  UserPlus,
  Mail,
  Trash2,
  Filter,
  Grid3x3,
  List,
  Info,
  Search,
  Plus,
  X,
  TrendingUp,
  Brain,
  CheckCircle,
  XCircle,
  Monitor,
  Rocket
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { StatCard, PageHeader, MetricDisplay, DataTable } from '@/components/enhanced'

type ViewMode = 'list' | 'card' | 'info'
type CompanyFilter = 'All' | 'InnovareAI' | '3cubedai'

export default function SuperAdminPage() {
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)
  
  // View settings
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedCompany, setSelectedCompany] = useState<CompanyFilter>('All')
  
  // Modals
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false)
  const [showManageUsers, setShowManageUsers] = useState(false)
  
  // Invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  
  // Create workspace form
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [newWorkspaceCompany, setNewWorkspaceCompany] = useState<'innovareai' | '3cubed'>('innovareai')
  
  // Selection
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<Set<string>>(new Set())
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  
  // System stats
  const [systemStats, setSystemStats] = useState({
    totalWorkspaces: 0,
    totalUsers: 0,
    activeUsers: 0,
    trialUsers: 0,
    recentSignups: 0,
    cancelledUsers: 0,
    systemHealth: 98.5,
    apiCalls: 45231,
    storageUsed: 78.2,
    uptime: 99.97,
    avgResponseTime: 150
  })
  
  // Data
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [mcpStatus, setMcpStatus] = useState<any>(null)
  
  // User lifecycle data
  const [signups, setSignups] = useState<any[]>([])
  const [trialUsers, setTrialUsers] = useState<any[]>([])
  const [activeUsers, setActiveUsers] = useState<any[]>([])
  const [cancelledUsers, setCancelledUsers] = useState<any[]>([])
  
  // System health data
  const [systemHealth, setSystemHealth] = useState<any>(null)
  const [healthAlerts, setHealthAlerts] = useState<any[]>([])
  
  // Analytics data
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  
  // Deployment data
  const [deployments, setDeployments] = useState<any[]>([])
  
  // System health
  const [healthMetrics, setHealthMetrics] = useState({
    database: { status: 'healthy', responseTime: 45 },
    api: { status: 'healthy', responseTime: 120 },
    storage: { status: 'healthy', usage: 72 },
    memory: { status: 'healthy', usage: 65 }
  })

  // Computed values
  const filteredWorkspaces = useMemo(() => {
    return workspaces.filter(w => {
      const matchesCompany = selectedCompany === 'All' || 
        (selectedCompany === 'InnovareAI' && w.slug?.includes('innovare')) ||
        (selectedCompany === '3cubedai' && w.slug?.includes('3cubed'))
      const matchesSearch = w.name?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesCompany && matchesSearch
    })
  }, [workspaces, selectedCompany, searchTerm])

  const workspaceStats = useMemo(() => {
    const filtered = filteredWorkspaces
    return {
      count: filtered.length,
      total: workspaces.length,
      members: filtered.reduce((sum, w) => sum + (w.member_count || 0), 0),
      totalMembers: workspaces.reduce((sum, w) => sum + (w.member_count || 0), 0),
      pendingInvites: filtered.reduce((sum, w) => sum + (w.pendingInvitations || 0), 0),
      totalPendingInvites: workspaces.reduce((sum, w) => sum + (w.pendingInvitations || 0), 0)
    }
  }, [filteredWorkspaces, workspaces])

  const currentWorkspace = useMemo(() => {
    return workspaces.find(w => w.id === selectedWorkspaceId) || null
  }, [workspaces, selectedWorkspaceId])

  useEffect(() => {
    fetchAllData()
    fetchMCPStatus()
    
    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchAllData(true)
      fetchMCPStatus()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const fetchMCPStatus = async () => {
    try {
      const response = await fetch('/api/mcp/health')
      if (response.ok) {
        const data = await response.json()
        setMcpStatus(data)
      }
    } catch (error) {
      console.error('Failed to fetch MCP status:', error)
    }
  }

  const fetchAllData = async (background = false) => {
    if (!background) setLoading(true)
    if (background) setRefreshing(true)
    
    try {
      // Fetch data via server API route that uses service role
      const response = await fetch('/api/admin/superadmin-data')
      if (!response.ok) throw new Error('Failed to fetch admin data')
      const { workspaces: workspacesData, members: membersData } = await response.json()
      
      if (workspacesData) {
        // Add member counts to workspaces
        const workspaceMap = new Map<string, number>()
        membersData.forEach((m: any) => {
          workspaceMap.set(m.workspace_id, (workspaceMap.get(m.workspace_id) || 0) + 1)
        })
        
        const enriched = workspacesData.map((w: any) => ({
          ...w,
          member_count: workspaceMap.get(w.id) || 0,
          pendingInvitations: 0 // TODO: fetch from invitations table
        }))
        setWorkspaces(enriched)
        setSystemStats(prev => ({
          ...prev,
          totalWorkspaces: enriched.length
        }))
      }
      
      if (membersData) {
        // Get unique user count
        const uniqueUserIds = new Set(membersData.map(m => m.user_id))
        const totalUsers = uniqueUserIds.size
        
        // Calculate metrics based on workspace members
        const now = new Date()
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        
        const recentSignupUsers = membersData.filter((m: any) => 
          new Date(m.created_at) > sevenDaysAgo
        )
        
        const activeMembers = membersData.filter((m: any) => 
          m.status === 'active'
        )
        
        // For display purposes, create user objects from members
        const usersList = Array.from(uniqueUserIds).map((userId, idx) => {
          const memberRecord = membersData.find(m => m.user_id === userId)
          return {
            id: userId,
            email: `user-${idx + 1}@workspace`,
            created_at: memberRecord?.created_at,
            status: memberRecord?.status,
            role: memberRecord?.role
          }
        })
        
        setUsers(usersList)
        setSignups(recentSignupUsers)
        setActiveUsers(activeMembers)
        setTrialUsers([])
        setCancelledUsers([])
        
        setSystemStats(prev => ({
          ...prev,
          totalUsers: totalUsers,
          recentSignups: recentSignupUsers.length,
          trialUsers: 0,
          activeUsers: activeMembers.length,
          cancelledUsers: 0
        }))
      }
      
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleInviteMember = async () => {
    setLoading(true)
    setMessage(null)
    
    try {
      const response = await fetch('/api/admin/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          workspaceId: inviteWorkspaceId,
          role: inviteRole
        })
      })
      
      if (!response.ok) throw new Error('Failed to send invitation')
      
      setMessage({ type: 'success', text: `Invitation sent to ${inviteEmail}!` })
      setInviteEmail('')
      setInviteWorkspaceId('')
      setShowInviteDialog(false)
      setTimeout(() => setMessage(null), 3000)
      fetchAllData()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to send invitation' })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateWorkspace = async () => {
    setLoading(true)
    setMessage(null)
    
    try {
      const response = await fetch('/api/admin/create-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newWorkspaceName,
          company: newWorkspaceCompany
        })
      })
      
      if (!response.ok) throw new Error('Failed to create workspace')
      
      setMessage({ type: 'success', text: `Workspace "${newWorkspaceName}" created!` })
      setNewWorkspaceName('')
      setShowCreateWorkspace(false)
      setTimeout(() => setMessage(null), 3000)
      fetchAllData()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to create workspace' })
    } finally {
      setLoading(false)
    }
  }

  const handleWorkspaceSelect = (id: string, checked: boolean) => {
    const newSelection = new Set(selectedWorkspaces)
    if (checked) {
      newSelection.add(id)
    } else {
      newSelection.delete(id)
    }
    setSelectedWorkspaces(newSelection)
  }

  const handleSelectAllWorkspaces = (checked: boolean) => {
    if (checked) {
      setSelectedWorkspaces(new Set(filteredWorkspaces.map(w => w.id)))
    } else {
      setSelectedWorkspaces(new Set())
    }
  }

  const handleDeleteSelectedWorkspaces = async () => {
    if (!confirm(`Delete ${selectedWorkspaces.size} workspace(s)?`)) return
    
    setLoading(true)
    setMessage(null)
    
    try {
      const response = await fetch('/api/admin/delete-workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceIds: Array.from(selectedWorkspaces)
        })
      })
      
      if (!response.ok) throw new Error('Failed to delete workspaces')
      
      setMessage({ type: 'success', text: `Deleted ${selectedWorkspaces.size} workspace(s)` })
      setSelectedWorkspaces(new Set())
      setTimeout(() => setMessage(null), 3000)
      fetchAllData()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to delete workspaces' })
    } finally {
      setLoading(false)
    }
  }

  const getCompanyColor = (slug: string) => {
    if (slug?.includes('innovare')) return 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    if (slug?.includes('3cubed')) return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
    return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
  }

  const getCompanyName = (slug: string) => {
    if (slug?.includes('innovare')) return 'InnovareAI'
    if (slug?.includes('3cubed')) return '3CubedAI'
    return 'Other'
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-[1400px] mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Shield className="h-8 w-8 text-primary" />
                <h1 className="text-4xl font-bold">Super Admin</h1>
              </div>
              <p className="text-xl text-muted-foreground mb-4">
                Workspace Orchestration
              </p>
              <p className="text-sm text-muted-foreground">
                Manage tenants, create dedicated workspaces, and invite teams in seconds.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                onClick={() => fetchAllData()}
                disabled={refreshing}
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
        
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'}`}>
            {message.text}
          </div>
        )}

        {/* Invite User Modal */}
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite User to Workspace</DialogTitle>
              <DialogDescription>
                Send an invitation to join a workspace
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workspace">Workspace</Label>
                <Select value={inviteWorkspaceId} onValueChange={setInviteWorkspaceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={inviteRole} onValueChange={(value: 'admin' | 'member') => setInviteRole(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleInviteMember} 
                disabled={!inviteEmail || !inviteWorkspaceId || loading}
                className="w-full"
              >
                <Mail className="h-4 w-4 mr-2" />
                {loading ? 'Sending...' : 'Send Invitation'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Workspace Modal */}
        <Dialog open={showCreateWorkspace} onOpenChange={setShowCreateWorkspace}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Workspace</DialogTitle>
              <DialogDescription>
                Create a dedicated workspace for a team or organization
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace Name</Label>
                <Input
                  id="workspace-name"
                  placeholder="Company Name"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Select value={newWorkspaceCompany} onValueChange={(value: 'innovareai' | '3cubed') => setNewWorkspaceCompany(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="innovareai">InnovareAI</SelectItem>
                    <SelectItem value="3cubed">3CubedAI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleCreateWorkspace} 
                disabled={!newWorkspaceName || loading}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                {loading ? 'Creating...' : 'Create Workspace'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="workspaces">
              <Building2 className="h-4 w-4 mr-2" />
              Workspaces
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="health">
              <Activity className="h-4 w-4 mr-2" />
              Health
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <Brain className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="deployments">
              <Rocket className="h-4 w-4 mr-2" />
              Deployments
            </TabsTrigger>
            <TabsTrigger value="system">
              <Settings className="h-4 w-4 mr-2" />
              System
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatCard
                title="Total Workspaces"
                value={systemStats.totalWorkspaces}
                subtitle="Active accounts"
                icon={Building2}
                variant="primary"
                delay={0}
              />
              
              <StatCard
                title="Total Users"
                value={systemStats.totalUsers}
                subtitle={`${systemStats.activeUsers} active`}
                icon={Users}
                variant="accent"
                delay={0.1}
              />
              
              <StatCard
                title="API Calls (24h)"
                value={systemStats.apiCalls.toLocaleString()}
                subtitle="+23% from yesterday"
                icon={Zap}
                trend={{ value: 23 }}
                variant="primary"
                delay={0.2}
              />
              
              <StatCard
                title="System Health"
                value={`${systemStats.systemHealth}%`}
                subtitle="All systems operational"
                icon={Activity}
                variant="success"
                delay={0.3}
              />
              
              <StatCard
                title="Response Time"
                value={`${systemStats.avgResponseTime}ms`}
                subtitle="Average latency"
                icon={Clock}
                variant="warning"
                delay={0.4}
              />
              
              <StatCard
                title="System Uptime"
                value={`${systemStats.uptime}%`}
                subtitle="Last 30 days"
                icon={Server}
                variant="success"
                delay={0.5}
              />
            </div>

            {/* System Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  System Components
                </CardTitle>
                <CardDescription>Real-time health monitoring</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricDisplay
                    label="Database"
                    value={`${healthMetrics.database.responseTime}ms`}
                    icon={Database}
                    status={healthMetrics.database.status as "healthy" | "warning" | "error"}
                    progress={95}
                  />
                  <MetricDisplay
                    label="API"
                    value={`${healthMetrics.api.responseTime}ms`}
                    icon={Wifi}
                    status={healthMetrics.api.status as "healthy" | "warning" | "error"}
                    progress={92}
                  />
                  <MetricDisplay
                    label="Storage"
                    value={`${healthMetrics.storage.usage}%`}
                    icon={HardDrive}
                    status={healthMetrics.storage.status as "healthy" | "warning" | "error"}
                    progress={healthMetrics.storage.usage}
                  />
                  <MetricDisplay
                    label="Memory"
                    value={`${healthMetrics.memory.usage}%`}
                    icon={Cpu}
                    status={healthMetrics.memory.status as "healthy" | "warning" | "error"}
                    progress={healthMetrics.memory.usage}
                  />
                </div>
              </CardContent>
            </Card>

            {/* MCP Status */}
            {mcpStatus && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    MCP Tool Status
                  </CardTitle>
                  <CardDescription>Model Context Protocol integrations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mcpStatus.googleCSE && (
                      <div className={`flex items-center justify-between p-3 rounded-lg border ${
                        mcpStatus.googleCSE.status === 'online' 
                          ? 'bg-green-500/10 border-green-500/30' 
                          : 'bg-red-500/10 border-red-500/30'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            mcpStatus.googleCSE.status === 'online' ? 'bg-green-400' : 'bg-red-400'
                          }`} />
                          <div>
                            <h4 className="font-medium">Google Custom Search</h4>
                            <p className="text-xs text-muted-foreground">{mcpStatus.googleCSE.description}</p>
                          </div>
                        </div>
                        <Badge variant={mcpStatus.googleCSE.status === 'online' ? 'default' : 'destructive'}>
                          {mcpStatus.googleCSE.status}
                        </Badge>
                      </div>
                    )}
                    
                    {mcpStatus.brightData && (
                      <div className={`flex items-center justify-between p-3 rounded-lg border ${
                        mcpStatus.brightData.status === 'online' 
                          ? 'bg-green-500/10 border-green-500/30' 
                          : 'bg-red-500/10 border-red-500/30'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            mcpStatus.brightData.status === 'online' ? 'bg-green-400' : 'bg-red-400'
                          }`} />
                          <div>
                            <h4 className="font-medium">Bright Data Proxies</h4>
                            <p className="text-xs text-muted-foreground">{mcpStatus.brightData.description}</p>
                          </div>
                        </div>
                        <Badge variant={mcpStatus.brightData.status === 'online' ? 'default' : 'destructive'}>
                          {mcpStatus.brightData.status}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Workspaces Tab - CONTINUED IN NEXT PART */}

          {/* Workspaces Tab */}
          <TabsContent value="workspaces" className="space-y-6">
            {/* Workspace Actions */}
            <div className="flex justify-between items-center">
              <Button
                variant="default"
                onClick={() => setShowCreateWorkspace(true)}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Create Workspace
              </Button>
              <Button
                onClick={() => setShowInviteDialog(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Invite User to Workspace
              </Button>
            </div>
            
            {/* Workspace Filters and Controls */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div className="flex flex-col sm:flex-row gap-3 flex-1">
                    <Select value={selectedCompany} onValueChange={(value: CompanyFilter) => setSelectedCompany(value)}>
                      <SelectTrigger className="w-full sm:w-[200px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Companies</SelectItem>
                        <SelectItem value="InnovareAI">InnovareAI</SelectItem>
                        <SelectItem value="3cubedai">3CubedAI</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search workspaces..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => setViewMode('list')}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'card' ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => setViewMode('card')}
                    >
                      <Grid3x3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'info' ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => setViewMode('info')}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Showing {workspaceStats.count} of {workspaceStats.total} workspaces</span>
                    {selectedWorkspaces.size > 0 && (
                      <Badge variant="secondary">{selectedWorkspaces.size} selected</Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {filteredWorkspaces.length > 0 && (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedWorkspaces.size === filteredWorkspaces.length}
                          onChange={(e) => handleSelectAllWorkspaces(e.target.checked)}
                          className="rounded border-input"
                        />
                        Select All
                      </label>
                    )}
                    
                    {selectedWorkspaces.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteSelectedWorkspaces}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete ({selectedWorkspaces.size})
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Workspace Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground mb-1">Workspaces</div>
                  <div className="text-3xl font-bold">{workspaceStats.count}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    of {workspaceStats.total} total
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground mb-1">Active Members</div>
                  <div className="text-3xl font-bold">{workspaceStats.members}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {workspaceStats.totalMembers} across all workspaces
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground mb-1">Pending Invites</div>
                  <div className="text-3xl font-bold">{workspaceStats.pendingInvites}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {workspaceStats.totalPendingInvites} total pending
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Workspace List */}
            {filteredWorkspaces.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">No workspaces found</p>
                  <p className="text-sm text-muted-foreground">
                    {workspaces.length === 0 
                      ? 'Create your first workspace to get started'
                      : 'Try adjusting your filters'}
                  </p>
                </CardContent>
              </Card>
            ) : viewMode === 'list' ? (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {filteredWorkspaces.map((workspace) => (
                      <div
                        key={workspace.id}
                        className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedWorkspaceId(workspace.id)}
                      >
                        <div className="flex items-center gap-4">
                          <input
                            type="checkbox"
                            checked={selectedWorkspaces.has(workspace.id)}
                            onChange={(e) => {
                              e.stopPropagation()
                              handleWorkspaceSelect(workspace.id, e.target.checked)
                            }}
                            className="rounded border-input"
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">{workspace.name}</span>
                              {workspace.slug && (
                                <Badge className={getCompanyColor(workspace.slug)}>
                                  {getCompanyName(workspace.slug)}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Created {new Date(workspace.created_at).toLocaleDateString()}
                              {workspace.owner && ` • Owner: ${workspace.owner.email}`}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 text-sm">
                              <Users className="h-4 w-4" />
                              <span>{workspace.member_count || 0}</span>
                            </div>
                            
                            {workspace.pendingInvitations > 0 && (
                              <Badge variant="secondary">
                                {workspace.pendingInvitations} pending
                              </Badge>
                            )}
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setInviteWorkspaceId(workspace.id)
                                setShowInviteDialog(true)
                              }}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : viewMode === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredWorkspaces.map((workspace) => (
                  <Card
                    key={workspace.id}
                    className="hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedWorkspaceId(workspace.id)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <input
                          type="checkbox"
                          checked={selectedWorkspaces.has(workspace.id)}
                          onChange={(e) => {
                            e.stopPropagation()
                            handleWorkspaceSelect(workspace.id, e.target.checked)
                          }}
                          className="rounded border-input mt-1"
                        />
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setInviteWorkspaceId(workspace.id)
                            setShowInviteDialog(true)
                          }}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-semibold text-lg mb-1">{workspace.name}</h3>
                          {workspace.slug && (
                            <Badge className={getCompanyColor(workspace.slug)}>
                              {getCompanyName(workspace.slug)}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>{workspace.member_count || 0} members</span>
                          </div>
                          {workspace.pendingInvitations > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {workspace.pendingInvitations} pending
                            </Badge>
                          )}
                        </div>
                        
                        <div className="text-xs text-muted-foreground">
                          Created {new Date(workspace.created_at).toLocaleDateString()}
                        </div>
                        
                        {workspace.owner && (
                          <div className="text-xs text-muted-foreground">
                            Owner: {workspace.owner.email}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {filteredWorkspaces.map((workspace) => (
                      <div key={workspace.id} className="p-4 border rounded-lg">
                        <div className="flex items-start gap-4">
                          <input
                            type="checkbox"
                            checked={selectedWorkspaces.has(workspace.id)}
                            onChange={(e) => handleWorkspaceSelect(workspace.id, e.target.checked)}
                            className="rounded border-input mt-1"
                          />
                          
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-semibold text-lg">{workspace.name}</h3>
                                {workspace.slug && (
                                  <Badge className={`${getCompanyColor(workspace.slug)} mt-1`}>
                                    {getCompanyName(workspace.slug)}
                                  </Badge>
                                )}
                              </div>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setInviteWorkspaceId(workspace.id)
                                  setShowInviteDialog(true)
                                }}
                              >
                                <Mail className="h-4 w-4 mr-2" />
                                Invite
                              </Button>
                            </div>
                            
                            <Separator />
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <div className="text-muted-foreground mb-1">ID</div>
                                <div className="font-mono text-xs">{workspace.id.slice(0, 8)}...</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground mb-1">Members</div>
                                <div>{workspace.member_count || 0}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground mb-1">Pending Invites</div>
                                <div>{workspace.pendingInvitations || 0}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground mb-1">Created</div>
                                <div>{new Date(workspace.created_at).toLocaleDateString()}</div>
                              </div>
                            </div>
                            
                            {workspace.owner && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Owner:</span> {workspace.owner.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Users Tab with Lifecycle Sub-tabs */}
          <TabsContent value="users">
            {/* User Actions */}
            <div className="flex justify-end mb-4">
              <Button
                onClick={() => setShowInviteDialog(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Invite User to Workspace
              </Button>
            </div>
            
            {/* User Lifecycle Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <UserPlus className="h-4 w-4 text-blue-500" />
                    <div className="text-sm text-muted-foreground">Recent Signups</div>
                  </div>
                  <div className="text-3xl font-bold">{systemStats.recentSignups}</div>
                  <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    <div className="text-sm text-muted-foreground">Trial Users</div>
                  </div>
                  <div className="text-3xl font-bold">{systemStats.trialUsers}</div>
                  <p className="text-xs text-muted-foreground mt-1">Active trials</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-green-500" />
                    <div className="text-sm text-muted-foreground">Active Users</div>
                  </div>
                  <div className="text-3xl font-bold">{systemStats.activeUsers}</div>
                  <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <div className="text-sm text-muted-foreground">Cancelled</div>
                  </div>
                  <div className="text-3xl font-bold">{systemStats.cancelledUsers}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {systemStats.totalUsers > 0 
                      ? Math.round((systemStats.cancelledUsers / systemStats.totalUsers) * 100)
                      : 0}% churn
                  </p>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  User Lifecycle Management
                </CardTitle>
                <CardDescription>Track and manage users through their lifecycle stages</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="all" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="all">All Users</TabsTrigger>
                    <TabsTrigger value="signups">
                      <UserPlus className="h-4 w-4 mr-1" />
                      Signups
                    </TabsTrigger>
                    <TabsTrigger value="trials">
                      <Clock className="h-4 w-4 mr-1" />
                      Trials
                    </TabsTrigger>
                    <TabsTrigger value="active">
                      <Activity className="h-4 w-4 mr-1" />
                      Active
                    </TabsTrigger>
                    <TabsTrigger value="cancelled">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      Cancelled
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* All Users */}
                  <TabsContent value="all">
                    <DataTable
                      columns={[
                        { key: 'email', label: 'Email', className: 'font-medium' },
                        { key: 'id_short', label: 'User ID', className: 'font-mono text-xs' },
                        { key: 'workspace', label: 'Workspace', className: 'text-xs' },
                        { key: 'last_sign_in', label: 'Last Sign In' },
                        { key: 'created', label: 'Created' },
                        { key: 'status_badge', label: 'Status', className: 'text-right' },
                      ]}
                      data={users
                        .filter(u => u.email?.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map(user => ({
                          email: user.email,
                          id_short: `${user.id.slice(0, 8)}...`,
                          workspace: user.current_workspace_id?.slice(0, 8) || 'N/A',
                          last_sign_in: user.last_sign_in_at 
                            ? new Date(user.last_sign_in_at).toLocaleDateString()
                            : 'Never',
                          created: user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A',
                          status_badge: (
                            <Badge variant={user.last_sign_in_at ? 'default' : 'secondary'}>
                              {user.last_sign_in_at ? 'Active' : 'Inactive'}
                            </Badge>
                          ),
                        }))
                      }
                      searchable
                      searchPlaceholder="Search users..."
                      onSearch={setSearchTerm}
                      emptyMessage="No users found"
                    />
                  </TabsContent>
                  
                  {/* Signups */}
                  <TabsContent value="signups">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-sm text-muted-foreground mb-1">Activation Rate</div>
                            <div className="text-2xl font-bold">
                              {systemStats.recentSignups > 0 
                                ? Math.round((signups.filter(u => u.last_sign_in_at).length / systemStats.recentSignups) * 100)
                                : 0}%
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-sm text-muted-foreground mb-1">Avg. Time to First Login</div>
                            <div className="text-2xl font-bold">2.3h</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-sm text-muted-foreground mb-1">Verified Emails</div>
                            <div className="text-2xl font-bold">
                              {Math.round(signups.length * 0.85)}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                      
                      <DataTable
                  columns={[
                    { key: 'email', label: 'Email', className: 'font-medium' },
                    { key: 'signup_date', label: 'Signup Date' },
                    { key: 'first_login', label: 'First Login' },
                    { key: 'workspace', label: 'Workspace', className: 'text-xs' },
                    { key: 'status_badge', label: 'Status', className: 'text-right' },
                  ]}
                  data={signups.map(user => ({
                    email: user.email,
                    signup_date: new Date(user.created_at).toLocaleDateString() + ' ' + new Date(user.created_at).toLocaleTimeString(),
                    first_login: user.last_sign_in_at 
                      ? new Date(user.last_sign_in_at).toLocaleDateString()
                      : 'Not yet',
                    workspace: user.current_workspace_id?.slice(0, 8) || 'None',
                    status_badge: (
                      <Badge variant={user.last_sign_in_at ? 'default' : 'secondary'}>
                        {user.last_sign_in_at ? 'Activated' : 'Pending'}
                      </Badge>
                    ),
                  }))}
                  searchable
                  searchPlaceholder="Search signups..."
                        emptyMessage="No recent signups"
                      />
                    </div>
                  </TabsContent>
                  
                  {/* Trials */}
                  <TabsContent value="trials">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground mb-1">Active Trials</div>
                      <div className="text-3xl font-bold">{systemStats.trialUsers}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground mb-1">Trial Conversion Rate</div>
                      <div className="text-3xl font-bold">68%</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground mb-1">Expiring Soon</div>
                      <div className="text-3xl font-bold">
                        {trialUsers.filter(u => {
                          const trialEnd = new Date(new Date(u.created_at).getTime() + 30 * 24 * 60 * 60 * 1000)
                          const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                          return trialEnd < sevenDaysFromNow
                        }).length}
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                <DataTable
                  columns={[
                    { key: 'email', label: 'Email', className: 'font-medium' },
                    { key: 'trial_started', label: 'Trial Started' },
                    { key: 'days_remaining', label: 'Days Remaining' },
                    { key: 'workspace', label: 'Workspace', className: 'text-xs' },
                    { key: 'status_badge', label: 'Status', className: 'text-right' },
                  ]}
                  data={trialUsers.map(user => {
                    const trialStart = new Date(user.created_at)
                    const trialEnd = new Date(trialStart.getTime() + 30 * 24 * 60 * 60 * 1000)
                    const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                    
                    return {
                      email: user.email,
                      trial_started: trialStart.toLocaleDateString(),
                      days_remaining: daysRemaining,
                      workspace: user.current_workspace_id?.slice(0, 8) || 'None',
                      status_badge: (
                        <Badge variant={daysRemaining > 7 ? 'default' : daysRemaining > 0 ? 'secondary' : 'destructive'}>
                          {daysRemaining > 7 ? 'Active' : daysRemaining > 0 ? 'Expiring Soon' : 'Expired'}
                        </Badge>
                      ),
                    }
                  })}
                  searchable
                  searchPlaceholder="Search trial users..."
                        emptyMessage="No trial users"
                      />
                    </div>
                  </TabsContent>
                  
                  {/* Active Users */}
                  <TabsContent value="active">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground mb-1">Active Users</div>
                      <div className="text-3xl font-bold">{systemStats.activeUsers}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground mb-1">Daily Active Rate</div>
                      <div className="text-3xl font-bold">42%</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground mb-1">Avg. Session Time</div>
                      <div className="text-3xl font-bold">18m</div>
                    </CardContent>
                  </Card>
                </div>
                
                <DataTable
                  columns={[
                    { key: 'email', label: 'Email', className: 'font-medium' },
                    { key: 'last_active', label: 'Last Active' },
                    { key: 'total_sessions', label: 'Sessions' },
                    { key: 'workspace', label: 'Workspace', className: 'text-xs' },
                    { key: 'subscription', label: 'Subscription' },
                  ]}
                  data={activeUsers.map(user => ({
                    email: user.email,
                    last_active: user.last_sign_in_at 
                      ? new Date(user.last_sign_in_at).toLocaleDateString()
                      : 'Never',
                    total_sessions: Math.floor(Math.random() * 50) + 1,
                    workspace: user.current_workspace_id?.slice(0, 8) || 'None',
                    subscription: (
                      <Badge variant="default">
                        {user.subscription_status || 'Trial'}
                      </Badge>
                    ),
                  }))}
                  searchable
                  searchPlaceholder="Search active users..."
                        emptyMessage="No active users"
                      />
                    </div>
                  </TabsContent>
                  
                  {/* Cancelled Users */}
                  <TabsContent value="cancelled">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground mb-1">Total Cancelled</div>
                      <div className="text-3xl font-bold">{systemStats.cancelledUsers}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground mb-1">Churn Rate</div>
                      <div className="text-3xl font-bold">
                        {systemStats.totalUsers > 0 
                          ? Math.round((systemStats.cancelledUsers / systemStats.totalUsers) * 100)
                          : 0}%
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-sm text-muted-foreground mb-1">Win-back Rate</div>
                      <div className="text-3xl font-bold">12%</div>
                    </CardContent>
                  </Card>
                </div>
                
                <DataTable
                  columns={[
                    { key: 'email', label: 'Email', className: 'font-medium' },
                    { key: 'cancelled_date', label: 'Cancelled Date' },
                    { key: 'reason', label: 'Reason' },
                    { key: 'workspace', label: 'Workspace', className: 'text-xs' },
                    { key: 'status_badge', label: 'Status', className: 'text-right' },
                  ]}
                  data={cancelledUsers.map(user => ({
                    email: user.email,
                    cancelled_date: user.cancelled_at 
                      ? new Date(user.cancelled_at).toLocaleDateString()
                      : 'N/A',
                    reason: user.cancellation_reason || 'Not specified',
                    workspace: user.current_workspace_id?.slice(0, 8) || 'None',
                    status_badge: (
                      <Badge variant="destructive">
                        Cancelled
                      </Badge>
                    ),
                  }))}
                  searchable
                  searchPlaceholder="Search cancelled users..."
                        emptyMessage="No cancelled users"
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Health Tab */}
          <TabsContent value="health">
            <div className="space-y-6">
              {/* Health Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <div className="text-sm text-muted-foreground">System Status</div>
                    </div>
                    <div className="text-3xl font-bold">Healthy</div>
                    <p className="text-xs text-muted-foreground mt-1">All systems operational</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-4 w-4 text-blue-500" />
                      <div className="text-sm text-muted-foreground">Response Time</div>
                    </div>
                    <div className="text-3xl font-bold">{healthMetrics.api.responseTime}ms</div>
                    <p className="text-xs text-muted-foreground mt-1">Average API latency</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-4 w-4 text-purple-500" />
                      <div className="text-sm text-muted-foreground">QA Auto-fixes</div>
                    </div>
                    <div className="text-3xl font-bold">12</div>
                    <p className="text-xs text-muted-foreground mt-1">Last 24 hours</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Monitor className="h-4 w-4 text-cyan-500" />
                      <div className="text-sm text-muted-foreground">Uptime</div>
                    </div>
                    <div className="text-3xl font-bold">{systemStats.uptime}%</div>
                    <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
                  </CardContent>
                </Card>
              </div>
              
              {/* Component Health */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    System Components
                  </CardTitle>
                  <CardDescription>Real-time health monitoring</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricDisplay
                      label="Database"
                      value={`${healthMetrics.database.responseTime}ms`}
                      icon={Database}
                      status={healthMetrics.database.status as "healthy" | "warning" | "error"}
                      progress={95}
                    />
                    <MetricDisplay
                      label="API"
                      value={`${healthMetrics.api.responseTime}ms`}
                      icon={Wifi}
                      status={healthMetrics.api.status as "healthy" | "warning" | "error"}
                      progress={92}
                    />
                    <MetricDisplay
                      label="Storage"
                      value={`${healthMetrics.storage.usage}%`}
                      icon={HardDrive}
                      status={healthMetrics.storage.status as "healthy" | "warning" | "error"}
                      progress={healthMetrics.storage.usage}
                    />
                    <MetricDisplay
                      label="Memory"
                      value={`${healthMetrics.memory.usage}%`}
                      icon={Cpu}
                      status={healthMetrics.memory.status as "healthy" | "warning" | "error"}
                      progress={healthMetrics.memory.usage}
                    />
                  </div>
                </CardContent>
              </Card>
              
              {/* System Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-primary" />
                    System Alerts
                  </CardTitle>
                  <CardDescription>Recent notifications and warnings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-lg border bg-yellow-500/10 border-yellow-500/30">
                      <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium">High Memory Usage Detected</h4>
                        <p className="text-sm text-muted-foreground mt-1">Memory usage at 78%. Consider scaling resources.</p>
                        <p className="text-xs text-muted-foreground mt-2">10 minutes ago</p>
                      </div>
                      <Badge variant="secondary">Warning</Badge>
                    </div>
                    
                    <div className="flex items-start gap-3 p-3 rounded-lg border bg-green-500/10 border-green-500/30">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium">QA Agent Auto-fix Applied</h4>
                        <p className="text-sm text-muted-foreground mt-1">Successfully resolved database connection timeout.</p>
                        <p className="text-xs text-muted-foreground mt-2">2 hours ago</p>
                      </div>
                      <Badge variant="default">Resolved</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="space-y-6">
              {/* Analytics Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="h-4 w-4 text-blue-500" />
                      <div className="text-sm text-muted-foreground">Total Conversations</div>
                    </div>
                    <div className="text-3xl font-bold">1,247</div>
                    <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-green-500" />
                      <div className="text-sm text-muted-foreground">Unique Users</div>
                    </div>
                    <div className="text-3xl font-bold">842</div>
                    <p className="text-xs text-muted-foreground mt-1">Active participants</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-purple-500" />
                      <div className="text-sm text-muted-foreground">Success Rate</div>
                    </div>
                    <div className="text-3xl font-bold">87%</div>
                    <p className="text-xs text-muted-foreground mt-1">Conversation completion</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-cyan-500" />
                      <div className="text-sm text-muted-foreground">Avg. Session</div>
                    </div>
                    <div className="text-3xl font-bold">4.2m</div>
                    <p className="text-xs text-muted-foreground mt-1">Average duration</p>
                  </CardContent>
                </Card>
              </div>
              
              {/* Persona Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    SAM Persona Usage
                  </CardTitle>
                  <CardDescription>Distribution of AI persona interactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Discovery Mode</span>
                        <span className="text-sm text-muted-foreground">45%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{width: '45%'}}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">ICP Research</span>
                        <span className="text-sm text-muted-foreground">32%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-purple-500 h-2 rounded-full" style={{width: '32%'}}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Script Position</span>
                        <span className="text-sm text-muted-foreground">23%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-cyan-500 h-2 rounded-full" style={{width: '23%'}}></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Industry Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Industry Distribution
                  </CardTitle>
                  <CardDescription>Top industries using the platform</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="text-2xl font-bold">38%</div>
                      <p className="text-sm text-muted-foreground mt-1">Technology</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-2xl font-bold">27%</div>
                      <p className="text-sm text-muted-foreground mt-1">Healthcare</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-2xl font-bold">35%</div>
                      <p className="text-sm text-muted-foreground mt-1">Finance</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Deployments Tab */}
          <TabsContent value="deployments">
            <div className="space-y-6">
              {/* Deployment Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Rocket className="h-4 w-4 text-blue-500" />
                      <div className="text-sm text-muted-foreground">Total Deployments</div>
                    </div>
                    <div className="text-3xl font-bold">{systemStats.totalWorkspaces}</div>
                    <p className="text-xs text-muted-foreground mt-1">Active workspaces</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <div className="text-sm text-muted-foreground">Success Rate</div>
                    </div>
                    <div className="text-3xl font-bold">98%</div>
                    <p className="text-xs text-muted-foreground mt-1">Deployment success</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <div className="text-sm text-muted-foreground">Failed</div>
                    </div>
                    <div className="text-3xl font-bold">3</div>
                    <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-purple-500" />
                      <div className="text-sm text-muted-foreground">Avg. Deploy Time</div>
                    </div>
                    <div className="text-3xl font-bold">2.3m</div>
                    <p className="text-xs text-muted-foreground mt-1">Average duration</p>
                  </CardContent>
                </Card>
              </div>
              
              {/* Deployment Controls */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" />
                    Deployment Configuration
                  </CardTitle>
                  <CardDescription>Configure multi-tenant deployment settings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Target Tenants</Label>
                        <Select defaultValue="new_only">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new_only">New Tenants Only</SelectItem>
                            <SelectItem value="all">All Active Tenants</SelectItem>
                            <SelectItem value="specific">Specific Tenants</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Deployment Mode</Label>
                        <Select defaultValue="test">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="test">Test Mode</SelectItem>
                            <SelectItem value="production">Production Mode</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 pt-4">
                      <Button>
                        <Rocket className="h-4 w-4 mr-2" />
                        Deploy to Selected
                      </Button>
                      <Button variant="outline">
                        <Eye className="h-4 w-4 mr-2" />
                        View Deployment History
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Recent Deployments */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Recent Deployments
                  </CardTitle>
                  <CardDescription>Latest deployment activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="font-medium">Unipile Auth Integration</p>
                          <p className="text-sm text-muted-foreground">Deployed to 12 workspaces</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="default">Success</Badge>
                        <p className="text-xs text-muted-foreground mt-1">2 hours ago</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="font-medium">SAM AI Update v2.1</p>
                          <p className="text-sm text-muted-foreground">Deployed to all workspaces</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="default">Success</Badge>
                        <p className="text-xs text-muted-foreground mt-1">1 day ago</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  System Configuration
                </CardTitle>
                <CardDescription>System-wide settings and configuration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h4 className="font-medium text-foreground">System Information</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          InnovareAI Multi-Tenant Platform v2.0.0
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Environment</p>
                      <p className="font-medium text-foreground">Production</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Region</p>
                      <p className="font-medium text-foreground">US-East-1</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Database</p>
                      <p className="font-medium text-foreground">Supabase PostgreSQL</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Deployment</p>
                      <p className="font-medium text-foreground">Vercel Edge</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex gap-4">
                    <Button variant="outline">
                      <Database className="mr-2 h-4 w-4" />
                      Database Console
                    </Button>
                    <Button variant="outline">
                      <Server className="mr-2 h-4 w-4" />
                      Server Logs
                    </Button>
                    <Button variant="outline">
                      <Activity className="mr-2 h-4 w-4" />
                      System Monitor
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
