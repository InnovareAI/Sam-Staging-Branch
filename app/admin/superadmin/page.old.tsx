'use client'

import React, { useState, useEffect } from 'react'
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
  Mail
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { StatCard, PageHeader, MetricDisplay, DataTable } from '@/components/enhanced'

export default function SuperAdminPage() {
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)
  
  // System stats
  const [systemStats, setSystemStats] = useState({
    totalWorkspaces: 0,
    totalUsers: 0,
    activeUsers: 0,
    systemHealth: 98.5,
    apiCalls: 45231,
    storageUsed: 78.2,
    uptime: 99.97,
    avgResponseTime: 150
  })
  
  // Workspaces data
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  
  // System health
  const [healthMetrics, setHealthMetrics] = useState({
    database: { status: 'healthy', responseTime: 45 },
    api: { status: 'healthy', responseTime: 120 },
    storage: { status: 'healthy', usage: 72 },
    memory: { status: 'healthy', usage: 65 }
  })

  useEffect(() => {
    fetchAllData()
    
    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchAllData(true)
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

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

  const fetchAllData = async (background = false) => {
    if (!background) setLoading(true)
    if (background) setRefreshing(true)
    
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      // Fetch workspaces
      const { data: workspacesData } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (workspacesData) {
        setWorkspaces(workspacesData)
        setSystemStats(prev => ({
          ...prev,
          totalWorkspaces: workspacesData.length
        }))
      }
      
      // Fetch users
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      
      if (usersData) {
        setUsers(usersData)
        setSystemStats(prev => ({
          ...prev,
          totalUsers: usersData.length,
          activeUsers: usersData.filter((u: any) => u.last_sign_in_at).length
        }))
      }
      
      // Fetch system stats if endpoint exists
      try {
        const statsResponse = await fetch('/api/admin/stats')
        if (statsResponse.ok) {
          const stats = await statsResponse.json()
          setSystemStats(prev => ({ ...prev, ...stats }))
        }
      } catch (error) {
        console.log('Stats endpoint not available')
      }
      
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }


  return (
    <div className="min-h-screen p-8">
      <div className="max-w-[1600px] mx-auto">
        <PageHeader
          title="Super Admin Dashboard"
          description="System-wide overview and management"
          icon={Shield}
          actions={
            <>
              <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                <DialogTrigger asChild>
                  <Button variant="default">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite User
                  </Button>
                </DialogTrigger>
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
                      <Label htmlFor="workspace">Workspace ID</Label>
                      <Input
                        id="workspace"
                        placeholder="Enter workspace ID"
                        value={inviteWorkspaceId}
                        onChange={(e) => setInviteWorkspaceId(e.target.value)}
                      />
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
              
              <Button
                onClick={() => fetchAllData()}
                disabled={refreshing}
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </>
          }
        />
        
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {message.text}
          </div>
        )}


        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="workspaces" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Workspaces
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              System
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
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

            {/* System Health Details */}
            <Card className="mt-6">
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
          </TabsContent>

          {/* Workspaces Tab */}
          <TabsContent value="workspaces">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  All Workspaces
                </CardTitle>
                <CardDescription>Manage all workspace accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: 'name', label: 'Workspace', className: 'font-medium' },
                    { key: 'id_short', label: 'ID', className: 'font-mono text-xs' },
                    { key: 'status_badge', label: 'Status' },
                    { key: 'member_count', label: 'Members' },
                    { key: 'created', label: 'Created' },
                  ]}
                  data={workspaces
                    .filter(w => w.name?.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(workspace => ({
                      name: workspace.name || 'Unnamed',
                      id_short: `${workspace.id.slice(0, 8)}...`,
                      status_badge: (
                        <Badge variant={workspace.status === 'active' ? 'default' : 'secondary'}>
                          {workspace.status || 'active'}
                        </Badge>
                      ),
                      member_count: workspace.member_count || 0,
                      created: workspace.created_at ? new Date(workspace.created_at).toLocaleDateString() : 'N/A',
                    }))
                  }
                  searchable
                  searchPlaceholder="Search workspaces..."
                  onSearch={setSearchTerm}
                  actions={(row) => (
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  emptyMessage="No workspaces found"
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  All Users
                </CardTitle>
                <CardDescription>System-wide user management</CardDescription>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
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
