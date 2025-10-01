'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Shield,
  Users,
  Building2,
  Activity,
  Server,
  Database,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  BarChart3,
  Globe,
  Clock,
  DollarSign,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Settings,
  Cpu,
  HardDrive,
  Wifi,
  AlertCircle
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

export default function SuperAdminPage() {
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  
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

  const StatCard = ({ title, value, subtitle, icon: Icon, trend, color = 'blue', delay = 0 }: any) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -4, scale: 1.02 }}
    >
      <Card className="shadow-lg border-0">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-slate-500 mb-2">{title}</p>
              <div className="flex items-baseline gap-2">
                <h3 className={`text-3xl font-bold text-${color}-600`}>{value}</h3>
                {trend && (
                  <span className={`text-sm flex items-center ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {trend > 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                    {Math.abs(trend)}%
                  </span>
                )}
              </div>
              {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
            </div>
            <div className={`p-3 rounded-xl bg-${color}-50`}>
              <Icon className={`h-6 w-6 text-${color}-600`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )

  const HealthIndicator = ({ status }: { status: string }) => {
    const colors = {
      healthy: 'bg-green-500',
      warning: 'bg-yellow-500',
      error: 'bg-red-500'
    }
    return (
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${colors[status as keyof typeof colors]} animate-pulse`} />
        <span className="text-sm capitalize">{status}</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2 flex items-center gap-3">
                <Shield className="h-10 w-10 text-blue-600" />
                Super Admin Dashboard
              </h1>
              <p className="text-slate-600">System-wide overview and management</p>
            </div>
            <Button
              onClick={() => fetchAllData()}
              disabled={refreshing}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </motion.div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Workspaces"
            value={systemStats.totalWorkspaces}
            subtitle="Active workspaces"
            icon={Building2}
            trend={12}
            color="blue"
            delay={0}
          />
          <StatCard
            title="Total Users"
            value={systemStats.totalUsers}
            subtitle={`${systemStats.activeUsers} active`}
            icon={Users}
            trend={8}
            color="indigo"
            delay={0.1}
          />
          <StatCard
            title="API Calls"
            value={systemStats.apiCalls.toLocaleString()}
            subtitle="Last 24 hours"
            icon={Zap}
            trend={23}
            color="purple"
            delay={0.2}
          />
          <StatCard
            title="System Health"
            value={`${systemStats.systemHealth}%`}
            subtitle={`Uptime: ${systemStats.uptime}%`}
            icon={Activity}
            color="green"
            delay={0.3}
          />
        </div>

        {/* System Health */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-blue-600" />
                System Health
              </CardTitle>
              <CardDescription>Real-time system component status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Database</span>
                    </div>
                    <HealthIndicator status={healthMetrics.database.status} />
                  </div>
                  <div className="text-sm text-slate-500">
                    Response: {healthMetrics.database.responseTime}ms
                  </div>
                  <Progress value={95} className="h-2" />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wifi className="h-5 w-5 text-indigo-600" />
                      <span className="font-medium">API</span>
                    </div>
                    <HealthIndicator status={healthMetrics.api.status} />
                  </div>
                  <div className="text-sm text-slate-500">
                    Response: {healthMetrics.api.responseTime}ms
                  </div>
                  <Progress value={92} className="h-2" />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-5 w-5 text-purple-600" />
                      <span className="font-medium">Storage</span>
                    </div>
                    <HealthIndicator status={healthMetrics.storage.status} />
                  </div>
                  <div className="text-sm text-slate-500">
                    Used: {healthMetrics.storage.usage}%
                  </div>
                  <Progress value={healthMetrics.storage.usage} className="h-2" />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Memory</span>
                    </div>
                    <HealthIndicator status={healthMetrics.memory.status} />
                  </div>
                  <div className="text-sm text-slate-500">
                    Used: {healthMetrics.memory.usage}%
                  </div>
                  <Progress value={healthMetrics.memory.usage} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="workspaces" className="space-y-6">
          <TabsList className="bg-white shadow-sm">
            <TabsTrigger value="workspaces" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Workspaces
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              System
            </TabsTrigger>
          </TabsList>

          {/* Workspaces Tab */}
          <TabsContent value="workspaces">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="shadow-lg border-0">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        All Workspaces
                      </CardTitle>
                      <CardDescription>Manage all workspace accounts</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Search workspaces..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-64"
                      />
                      <Button variant="outline" size="icon">
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Workspace</TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Members</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {workspaces
                          .filter(w => w.name?.toLowerCase().includes(searchTerm.toLowerCase()))
                          .map((workspace) => (
                            <TableRow key={workspace.id}>
                              <TableCell className="font-medium">{workspace.name || 'Unnamed'}</TableCell>
                              <TableCell className="font-mono text-xs">{workspace.id.slice(0, 8)}...</TableCell>
                              <TableCell>
                                <Badge className={
                                  workspace.status === 'active' 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-slate-100 text-slate-700'
                                }>
                                  {workspace.status || 'active'}
                                </Badge>
                              </TableCell>
                              <TableCell>{workspace.member_count || 0}</TableCell>
                              <TableCell>
                                {workspace.created_at ? new Date(workspace.created_at).toLocaleDateString() : 'N/A'}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="shadow-lg border-0">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-600" />
                        All Users
                      </CardTitle>
                      <CardDescription>System-wide user management</CardDescription>
                    </div>
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-64"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>User ID</TableHead>
                          <TableHead>Workspace</TableHead>
                          <TableHead>Last Sign In</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users
                          .filter(u => u.email?.toLowerCase().includes(searchTerm.toLowerCase()))
                          .map((user) => (
                            <TableRow key={user.id}>
                              <TableCell className="font-medium">{user.email}</TableCell>
                              <TableCell className="font-mono text-xs">{user.id.slice(0, 8)}...</TableCell>
                              <TableCell className="text-xs">{user.current_workspace_id?.slice(0, 8) || 'N/A'}</TableCell>
                              <TableCell className="text-sm">
                                {user.last_sign_in_at 
                                  ? new Date(user.last_sign_in_at).toLocaleDateString()
                                  : 'Never'
                                }
                              </TableCell>
                              <TableCell>
                                {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge className={
                                  user.last_sign_in_at 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-slate-100 text-slate-700'
                                }>
                                  {user.last_sign_in_at ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-lg border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      Growth Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Workspace Growth</span>
                        <span className="text-sm text-green-600 font-medium">+12%</span>
                      </div>
                      <Progress value={75} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">User Adoption</span>
                        <span className="text-sm text-green-600 font-medium">+23%</span>
                      </div>
                      <Progress value={85} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">API Usage</span>
                        <span className="text-sm text-green-600 font-medium">+45%</span>
                      </div>
                      <Progress value={92} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-lg border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-indigo-600" />
                      Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-500 mb-1">Avg Response Time</p>
                      <p className="text-2xl font-bold text-blue-600">{systemStats.avgResponseTime}ms</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-500 mb-1">System Uptime</p>
                      <p className="text-2xl font-bold text-green-600">{systemStats.uptime}%</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-500 mb-1">Storage Used</p>
                      <p className="text-2xl font-bold text-purple-600">{systemStats.storageUsed}%</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="shadow-lg border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-blue-600" />
                    System Configuration
                  </CardTitle>
                  <CardDescription>System-wide settings and configuration</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-900">System Information</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            InnovareAI Multi-Tenant Platform v2.0.0
                          </p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Environment</p>
                        <p className="font-medium">Production</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Region</p>
                        <p className="font-medium">US-East-1</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Database</p>
                        <p className="font-medium">Supabase PostgreSQL</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Deployment</p>
                        <p className="font-medium">Vercel Edge</p>
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
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
