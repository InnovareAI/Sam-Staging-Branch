'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { 
  Shield, 
  Users, 
  Database, 
  Activity, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Server,
  Globe,
  Lock,
  Zap,
  BarChart3,
  PieChart,
  UserPlus,
  Mail,
  Settings,
  Crown,
  Sparkles,
  Search,
  Filter,
  Download,
  Upload,
  Eye,
  Edit,
  Trash2,
  Plus,
  RefreshCw,
  Calendar,
  Clock,
  DollarSign,
  MessageSquare,
  Briefcase,
  Shield as ShieldIcon,
  AlertCircle,
  Info,
  FileText,
  HardDrive,
  Cpu,
  Wifi,
  Smartphone,
  Monitor
} from 'lucide-react'

export default function DemoSuperAdminPage() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const [systemStats, setSystemStats] = useState({
    totalUsers: 1247,
    activeUsers: 892,
    systemHealth: 98.5,
    apiCalls: 45231,
    storage: 78.2,
    totalWorkspaces: 0,
    totalRevenue: 127500,
    monthlyGrowth: 23.5,
    avgResponseTime: 150,
    uptime: 99.97
  })
  
  const [workspaces, setWorkspaces] = useState([])
  const [workspacesLoading, setWorkspacesLoading] = useState(true)
  
  // Enhanced mock data for demonstrations
  const [mockUsers] = useState([
    { id: 1, name: 'John Smith', email: 'john@acme.com', workspace: 'Acme Corp', plan: 'Enterprise', status: 'active', lastActive: '2 hours ago', joinDate: '2024-01-15' },
    { id: 2, name: 'Sarah Johnson', email: 'sarah@techstart.io', workspace: 'TechStart', plan: 'SME', status: 'active', lastActive: '5 minutes ago', joinDate: '2024-02-20' },
    { id: 3, name: 'Mike Chen', email: 'mike@innovate.co', workspace: 'Innovate Co', plan: 'Startup', status: 'inactive', lastActive: '3 days ago', joinDate: '2024-03-10' },
    { id: 4, name: 'Emily Davis', email: 'emily@globaltech.com', workspace: 'GlobalTech', plan: 'Enterprise', status: 'active', lastActive: '1 hour ago', joinDate: '2024-01-05' },
    { id: 5, name: 'Alex Rodriguez', email: 'alex@startup.io', workspace: 'Startup Hub', plan: 'Startup', status: 'active', lastActive: '30 minutes ago', joinDate: '2024-03-25' }
  ])
  
  const [mockSystemEvents] = useState([
    { id: 1, type: 'security', level: 'high', message: 'Failed login attempts detected from IP 192.168.1.100', timestamp: '2024-09-17 14:30:00', status: 'resolved' },
    { id: 2, type: 'system', level: 'medium', message: 'Database backup completed successfully', timestamp: '2024-09-17 13:45:00', status: 'completed' },
    { id: 3, type: 'user', level: 'low', message: 'New workspace created: TechVenture Inc', timestamp: '2024-09-17 12:20:00', status: 'active' },
    { id: 4, type: 'performance', level: 'medium', message: 'API response time above threshold: 250ms', timestamp: '2024-09-17 11:15:00', status: 'monitoring' },
    { id: 5, type: 'billing', level: 'high', message: 'Payment failed for Enterprise customer', timestamp: '2024-09-17 10:30:00', status: 'pending' }
  ])
  
  const [mockAuditLogs] = useState([
    { id: 1, user: 'admin@innovareai.com', action: 'User deleted', target: 'user:12345', ip: '192.168.1.50', timestamp: '2024-09-17 15:20:00' },
    { id: 2, user: 'john@acme.com', action: 'Workspace settings updated', target: 'workspace:acme-corp', ip: '203.0.113.45', timestamp: '2024-09-17 14:45:00' },
    { id: 3, user: 'system', action: 'Automated backup', target: 'database:primary', ip: 'localhost', timestamp: '2024-09-17 13:00:00' },
    { id: 4, user: 'sarah@techstart.io', action: 'Plan upgraded', target: 'subscription:ts-001', ip: '198.51.100.25', timestamp: '2024-09-17 12:30:00' },
    { id: 5, user: 'admin@innovareai.com', action: 'Security scan initiated', target: 'system:security', ip: '192.168.1.50', timestamp: '2024-09-17 11:00:00' }
  ])

  // Real-time counter animation
  const [animatedStats, setAnimatedStats] = useState(systemStats)

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimatedStats(prev => ({
        ...prev,
        apiCalls: prev.apiCalls + Math.floor(Math.random() * 5),
        activeUsers: prev.activeUsers + Math.floor(Math.random() * 3) - 1
      }))
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  // Fetch real workspace data and system stats
  useEffect(() => {
    const fetchRealData = async () => {
      try {
        setWorkspacesLoading(true)
        
        // Fetch workspaces
        const workspacesResponse = await fetch('/api/admin/workspaces')
        if (workspacesResponse.ok) {
          const workspacesData = await workspacesResponse.json()
          setWorkspaces(workspacesData.workspaces || [])
          
          // Update system stats with real data
          setSystemStats(prev => ({
            ...prev,
            totalWorkspaces: workspacesData.workspaces?.length || 0
          }))
          
          console.log('📊 Loaded real workspaces:', workspacesData.workspaces?.length)
        }
        
        // Fetch additional real stats if available
        const statsResponse = await fetch('/api/admin/stats')
        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          setSystemStats(prev => ({
            ...prev,
            totalUsers: statsData.totalUsers || prev.totalUsers,
            activeUsers: statsData.activeUsers || prev.activeUsers,
            systemHealth: statsData.systemHealth || prev.systemHealth,
            apiCalls: statsData.apiCalls || prev.apiCalls,
            totalRevenue: statsData.totalRevenue || prev.totalRevenue,
            monthlyGrowth: statsData.monthlyGrowth || prev.monthlyGrowth,
            avgResponseTime: statsData.avgResponseTime || prev.avgResponseTime,
            uptime: statsData.uptime || prev.uptime
          }))
          
          // Update animated stats with real data
          setAnimatedStats(prev => ({
            ...prev,
            totalUsers: statsData.totalUsers || prev.totalUsers,
            activeUsers: statsData.activeUsers || prev.activeUsers,
            apiCalls: statsData.apiCalls || prev.apiCalls
          }))
          
          console.log('📈 Loaded real system stats')
        }
        
      } catch (error) {
        console.error('Error fetching real data:', error)
      } finally {
        setWorkspacesLoading(false)
      }
    }

    fetchRealData()
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchRealData, 30000)
    return () => clearInterval(interval)
  }, [])

  const StatCard = ({ title, value, change, icon: Icon, trend, color = 'blue', delay = 0 }) => (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ 
        y: -8, 
        scale: 1.02,
        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)"
      }}
    >
      <Card className={`bg-gradient-to-br from-${color}-50 to-${color}-100 border-${color}-200 shadow-lg overflow-hidden relative`}>
        <div className={`absolute inset-0 bg-gradient-to-br from-${color}-500/5 to-${color}-600/10`}></div>
        <CardContent className="p-6 relative">
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium text-${color}-600`}>{title}</p>
              <motion.p 
                key={value}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className="text-3xl font-bold text-gray-900 mt-1"
              >
                {typeof value === 'number' ? value.toLocaleString() : value}
              </motion.p>
              {change && (
                <div className="flex items-center mt-2">
                  {trend === 'up' ? (
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                  )}
                  <span className={`text-sm ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                    {change}
                  </span>
                </div>
              )}
            </div>
            <motion.div
              whileHover={{ rotate: 360, scale: 1.2 }}
              transition={{ duration: 0.6 }}
              className={`p-3 bg-${color}-100 rounded-full`}
            >
              <Icon className={`h-8 w-8 text-${color}-600`} />
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -inset-10 opacity-20">
          <motion.div
            animate={{
              background: [
                "radial-gradient(600px circle at 0% 0%, rgba(120, 119, 198, 0.3), transparent 50%)",
                "radial-gradient(600px circle at 100% 0%, rgba(120, 119, 198, 0.3), transparent 50%)",
                "radial-gradient(600px circle at 100% 100%, rgba(120, 119, 198, 0.3), transparent 50%)",
                "radial-gradient(600px circle at 0% 100%, rgba(120, 119, 198, 0.3), transparent 50%)",
              ]
            }}
            transition={{ duration: 20, repeat: Infinity }}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto mb-8 relative z-10"
      >
        <div className="flex items-center gap-3 mb-2">
          <motion.div
            animate={{ 
              rotate: [0, 360],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl shadow-lg"
          >
            <Crown className="h-8 w-8 text-white" />
          </motion.div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">
              Super Admin Dashboard
            </h1>
            <p className="text-slate-300 mt-1">
              Master control center • All 5 design systems showcase
            </p>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Enhanced Tab Navigation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <TabsList className="grid w-full grid-cols-5 bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl">
              {[
                { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
                { id: 'users', icon: Users, label: 'Workspaces' },
                { id: 'system', icon: Server, label: 'System' },
                { id: 'security', icon: Lock, label: 'Security' },
                { id: 'analytics', icon: PieChart, label: 'Analytics' }
              ].map((tab) => (
                <TabsTrigger 
                  key={tab.id}
                  value={tab.id} 
                  className="flex items-center gap-2 data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-300 transition-all duration-300"
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </motion.div>

          <div className="mt-8 space-y-6">
            {/* Dashboard Tab - Blocks.mvp-subha.me Style */}
            <TabsContent value="dashboard" className="space-y-6">
              {/* Stats Grid */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatCard 
                  title="Total Users" 
                  value={animatedStats.totalUsers} 
                  change="+12%" 
                  trend="up" 
                  icon={Users} 
                  color="blue"
                  delay={0}
                />
                <StatCard 
                  title="Active Now" 
                  value={animatedStats.activeUsers} 
                  change="+5%" 
                  trend="up" 
                  icon={Activity} 
                  color="green"
                  delay={0.1}
                />
                <StatCard 
                  title="System Health" 
                  value={`${systemStats.systemHealth}%`} 
                  change="+0.5%" 
                  trend="up" 
                  icon={CheckCircle} 
                  color="emerald"
                  delay={0.2}
                />
                <StatCard 
                  title="API Calls" 
                  value={animatedStats.apiCalls} 
                  change="+23%" 
                  trend="up" 
                  icon={Zap} 
                  color="purple"
                  delay={0.3}
                />
              </div>
              
              {/* Second row with workspaces */}
              <div className="grid gap-6 md:grid-cols-4">
                <StatCard 
                  title="Total Workspaces" 
                  value={systemStats.totalWorkspaces} 
                  change={systemStats.totalWorkspaces > 0 ? "+100%" : "0%"} 
                  trend="up" 
                  icon={Users} 
                  color="teal"
                  delay={0.4}
                />
              </div>

              {/* Three Separate Admin Boxes - Knowledge Base Style */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="grid gap-6 md:grid-cols-3"
              >
                {/* Global Status Box */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer">
                  <div className="flex items-center mb-4">
                    <Globe className="text-blue-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
                    <h3 className="text-xl font-semibold text-white">Global Status</h3>
                  </div>
                  <div className="space-y-3">
                    {[
                      { region: 'US East', status: 'online', latency: '12ms' },
                      { region: 'EU West', status: 'online', latency: '8ms' },
                      { region: 'Asia Pacific', status: 'warning', latency: '45ms' }
                    ].map((server, index) => (
                      <div key={server.region} className="bg-gray-700 border border-gray-600 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                              server.status === 'online' ? 'bg-green-500' : 'bg-orange-500'
                            }`}></div>
                            <span className="text-white text-sm">{server.region}</span>
                          </div>
                          <span className="text-gray-300 text-sm">{server.latency}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Activity Box */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer">
                  <div className="flex items-center mb-4">
                    <Clock className="text-green-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
                    <h3 className="text-xl font-semibold text-white">Recent Activity</h3>
                  </div>
                  <div className="space-y-3">
                    {mockSystemEvents.slice(0, 3).map((event, index) => (
                      <div key={event.id} className="bg-gray-700 border border-gray-600 rounded-lg p-3">
                        <div className="flex items-start gap-3">
                          <div className={`w-3 h-3 rounded-full mt-1 ${
                            event.level === 'high' ? 'bg-red-500' : 
                            event.level === 'medium' ? 'bg-orange-500' : 'bg-green-500'
                          }`}></div>
                          <div className="flex-1">
                            <p className="text-white text-sm font-medium">{event.type.charAt(0).toUpperCase() + event.type.slice(1)}</p>
                            <p className="text-gray-300 text-xs">{new Date(event.timestamp).toLocaleTimeString()}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* System Metrics Box */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer">
                  <div className="flex items-center mb-4">
                    <Monitor className="text-purple-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
                    <h3 className="text-xl font-semibold text-white">System Metrics</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-gray-700 border border-gray-600 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-300 text-sm">CPU Usage</span>
                        <span className="text-white text-sm">45%</span>
                      </div>
                      <div className="w-full bg-gray-600 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{width: '45%'}}></div>
                      </div>
                    </div>
                    <div className="bg-gray-700 border border-gray-600 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-300 text-sm">Memory</span>
                        <span className="text-white text-sm">67%</span>
                      </div>
                      <div className="w-full bg-gray-600 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{width: '67%'}}></div>
                      </div>
                    </div>
                    <div className="bg-gray-700 border border-gray-600 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-300 text-sm">Storage</span>
                        <span className="text-white text-sm">78%</span>
                      </div>
                      <div className="w-full bg-gray-600 rounded-full h-2">
                        <div className="bg-purple-500 h-2 rounded-full" style={{width: '78%'}}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </TabsContent>

            {/* Workspaces Tab - Knowledge Base Style */}
            <TabsContent value="users">
              <TooltipProvider>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-6"
                >
                  {/* Header Section */}
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-2xl font-semibold text-white flex items-center">
                        <Building2 className="mr-3 text-blue-400" size={24} />
                        Workspace Management
                      </h2>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Search workspaces..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-64 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                          />
                          <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                          <SelectTrigger className="w-32 bg-gray-700 border-gray-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-700 border-gray-600">
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setIsRefreshing(!isRefreshing)}
                              className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                            >
                              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Refresh workspace data</p>
                          </TooltipContent>
                        </Tooltip>
                        <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Workspace
                        </Button>
                      </div>
                    </div>
                    
                    {/* Stats Overview */}
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-gray-300 text-sm">Total Workspaces</p>
                            <p className="text-white text-2xl font-bold">{systemStats.totalWorkspaces}</p>
                          </div>
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        </div>
                      </div>
                      <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-gray-300 text-sm">Active Users</p>
                            <p className="text-white text-2xl font-bold">{animatedStats.activeUsers}</p>
                          </div>
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        </div>
                      </div>
                      <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-gray-300 text-sm">Monthly Revenue</p>
                            <p className="text-white text-2xl font-bold">${(systemStats.totalRevenue / 1000).toFixed(0)}K</p>
                          </div>
                          <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                        </div>
                      </div>
                      <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-gray-300 text-sm">Growth Rate</p>
                            <p className="text-white text-2xl font-bold">+{systemStats.monthlyGrowth}%</p>
                          </div>
                          <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Workspaces Grid */}
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {workspacesLoading ? (
                      Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="bg-gray-800 border border-gray-700 rounded-lg p-6 animate-pulse">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-gray-600 rounded-full"></div>
                            <div className="flex-1">
                              <div className="h-4 bg-gray-600 rounded mb-2"></div>
                              <div className="h-3 bg-gray-600 rounded w-2/3"></div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="h-3 bg-gray-600 rounded"></div>
                            <div className="h-3 bg-gray-600 rounded w-1/2"></div>
                          </div>
                        </div>
                      ))
                    ) : workspaces.length === 0 ? (
                      <div className="col-span-full">
                        <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center">
                          <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                          <h3 className="text-white text-lg font-medium mb-2">No workspaces found</h3>
                          <p className="text-gray-400 mb-6">Get started by creating your first workspace</p>
                          <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                            <Plus className="h-4 w-4 mr-2" />
                            Create Workspace
                          </Button>
                        </div>
                      </div>
                    ) : (
                      workspaces.map((workspace, index) => (
                        <motion.div
                          key={workspace.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="bg-gray-800 border border-gray-700 rounded-lg p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer"
                        >
                          <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                              <span className="text-white font-bold text-lg">
                                {workspace.name ? workspace.name.substring(0, 2).toUpperCase() : 'WS'}
                              </span>
                            </div>
                            <div className="flex-1">
                              <h3 className="text-white font-semibold text-lg group-hover:text-white">
                                {workspace.name || 'Unnamed Workspace'}
                              </h3>
                              <p className="text-gray-400 text-sm group-hover:text-purple-100">
                                {workspace.owner?.email || 'Unknown Owner'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-300 text-sm">Members:</span>
                              <Badge variant="outline" className="group-hover:bg-purple-100 group-hover:text-purple-800">
                                {workspace.member_count || 1}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-300 text-sm">Status:</span>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-green-400 text-sm">Active</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-300 text-sm">Created:</span>
                              <span className="text-white text-sm">
                                {new Date(workspace.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <Separator className="my-4 group-hover:bg-purple-300" />

                          <div className="flex items-center justify-between">
                            <div className="flex gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" className="group-hover:bg-purple-700 group-hover:text-white">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>View Details</p></TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" className="group-hover:bg-purple-700 group-hover:text-white">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Edit Workspace</p></TooltipContent>
                              </Tooltip>
                            </div>
                            <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/20 hover:text-red-300">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </motion.div>
              </TooltipProvider>
            </TabsContent>

            {/* System Tab - SHSF UI Motion Style */}
            <TabsContent value="system">
              <motion.div
                initial={{ opacity: 0, rotateX: -15 }}
                animate={{ opacity: 1, rotateX: 0 }}
                transition={{ duration: 0.6 }}
                className="space-y-6"
              >
                <div className="grid gap-6 md:grid-cols-3">
                  {[
                    { title: 'CPU Usage', value: '45%', color: 'green', icon: Activity },
                    { title: 'Memory', value: '67%', color: 'yellow', icon: Database },
                    { title: 'Storage', value: '78%', color: 'red', icon: Server }
                  ].map((metric, index) => (
                    <motion.div
                      key={metric.title}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.2 }}
                      whileHover={{ y: -10, scale: 1.05 }}
                    >
                      <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <metric.icon className="h-8 w-8 text-white" />
                            <span className={`text-2xl font-bold text-${metric.color}-400`}>
                              {metric.value}
                            </span>
                          </div>
                          <h3 className="text-white font-medium mb-2">{metric.title}</h3>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: metric.value }}
                              transition={{ duration: 1, delay: 0.5 + index * 0.2 }}
                              className={`bg-${metric.color}-400 h-2 rounded-full`}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </TabsContent>

            {/* Security Tab - Kibo UI Interactive Style */}
            <TabsContent value="security">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="space-y-6"
              >
                <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Lock className="h-5 w-5 text-green-400" />
                      Security Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      {[
                        { title: 'Firewall Status', status: 'active', icon: Shield },
                        { title: '2FA Enabled', status: 'active', icon: CheckCircle },
                        { title: 'SSL Certificate', status: 'active', icon: Lock },
                        { title: 'Intrusion Detection', status: 'warning', icon: AlertTriangle }
                      ].map((item, index) => (
                        <motion.div
                          key={item.title}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.1 }}
                          whileHover={{ scale: 1.02, rotateY: 5 }}
                          className={`p-4 rounded-lg border transition-all duration-300 ${
                            item.status === 'active' 
                              ? 'bg-green-900/20 border-green-500/30' 
                              : 'bg-yellow-900/20 border-yellow-500/30'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <item.icon className={`h-6 w-6 ${
                                item.status === 'active' ? 'text-green-400' : 'text-yellow-400'
                              }`} />
                              <span className="text-white font-medium">{item.title}</span>
                            </div>
                            <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                              {item.status}
                            </Badge>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Analytics Tab - Skiper UI Enhanced Effects */}
            <TabsContent value="analytics">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="space-y-6"
              >
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {[
                    { title: 'Page Views', value: '125.4K', change: '+12%', color: 'blue' },
                    { title: 'User Sessions', value: '89.2K', change: '+8%', color: 'green' },
                    { title: 'Bounce Rate', value: '24.5%', change: '-3%', color: 'purple' }
                  ].map((stat, index) => (
                    <motion.div
                      key={stat.title}
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.15 }}
                      whileHover={{ 
                        y: -5, 
                        rotateY: 10,
                        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
                      }}
                    >
                      <Card className={`bg-gradient-to-br from-${stat.color}-900/30 to-${stat.color}-800/20 backdrop-blur-xl border border-${stat.color}-500/20 shadow-2xl`}>
                        <CardContent className="p-6">
                          <h3 className="text-slate-300 text-sm font-medium mb-2">{stat.title}</h3>
                          <p className="text-3xl font-bold text-white mb-2">{stat.value}</p>
                          <div className="flex items-center gap-1">
                            <TrendingUp className={`h-4 w-4 text-${stat.color}-400`} />
                            <span className={`text-sm text-${stat.color}-400`}>{stat.change}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}