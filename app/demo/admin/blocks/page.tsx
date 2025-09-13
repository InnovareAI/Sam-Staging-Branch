'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Shield, 
  Users, 
  Activity, 
  Database, 
  Server,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  BarChart3,
  PieChart,
  Zap,
  Globe,
  Lock,
  Eye,
  UserCheck,
  Settings,
  Cpu,
  HardDrive,
  Wifi,
  Clock
} from 'lucide-react'

export default function BlocksAdminPage() {
  const [systemStats, setSystemStats] = useState({
    uptime: 99.7,
    activeUsers: 2847,
    totalRequests: 1247830,
    responseTime: 142,
    cpuUsage: 67,
    memoryUsage: 54,
    diskUsage: 32,
    networkLoad: 78
  })

  const [realtimeData, setRealtimeData] = useState({
    usersOnline: 247,
    requestsPerSecond: 34,
    activeConnections: 892,
    errorRate: 0.02
  })

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setRealtimeData(prev => ({
        usersOnline: prev.usersOnline + Math.floor(Math.random() * 10) - 5,
        requestsPerSecond: Math.max(20, prev.requestsPerSecond + Math.floor(Math.random() * 10) - 5),
        activeConnections: prev.activeConnections + Math.floor(Math.random() * 20) - 10,
        errorRate: Math.max(0, Math.min(1, prev.errorRate + (Math.random() - 0.5) * 0.01))
      }))
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto mb-8"
      >
        <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ rotate: 180, scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg"
              >
                <Shield className="h-8 w-8 text-white" />
              </motion.div>
              <div>
                <h1 className="text-3xl font-bold text-white">Enterprise Admin Dashboard</h1>
                <p className="text-blue-200">Blocks.mvp-subha.me - Data-Rich Analytics Platform</p>
              </div>
            </div>
            
            {/* System status indicators */}
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{systemStats.uptime}%</div>
                <div className="text-xs text-gray-400">Uptime</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{realtimeData.usersOnline}</div>
                <div className="text-xs text-gray-400">Online Now</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">{realtimeData.requestsPerSecond}/s</div>
                <div className="text-xs text-gray-400">Requests</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Key Metrics Row */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
        >
          {[
            { 
              title: 'Total Users', 
              value: systemStats.activeUsers.toLocaleString(), 
              change: '+12.5%', 
              icon: Users, 
              color: 'blue',
              description: 'Active users this month'
            },
            { 
              title: 'System Load', 
              value: `${systemStats.cpuUsage}%`, 
              change: '+2.1%', 
              icon: Cpu, 
              color: 'green',
              description: 'Current CPU utilization'
            },
            { 
              title: 'Response Time', 
              value: `${systemStats.responseTime}ms`, 
              change: '-8.3%', 
              icon: Clock, 
              color: 'purple',
              description: 'Average API response'
            },
            { 
              title: 'Error Rate', 
              value: `${(realtimeData.errorRate * 100).toFixed(2)}%`, 
              change: '-15.2%', 
              icon: AlertTriangle, 
              color: 'orange',
              description: 'System error percentage'
            }
          ].map((metric, index) => (
            <motion.div
              key={metric.title}
              whileHover={{ y: -5, scale: 1.02 }}
              className="relative"
            >
              <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                  <CardTitle className="text-sm font-medium text-gray-300">
                    {metric.title}
                  </CardTitle>
                  <metric.icon className={`h-4 w-4 text-${metric.color}-400`} />
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="text-2xl font-bold text-white">{metric.value}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge 
                      className={`text-xs ${
                        metric.change.startsWith('+') && !metric.title.includes('Error') && !metric.title.includes('Load')
                          ? 'bg-green-500/20 text-green-300 border-green-500/30' 
                          : metric.change.startsWith('-') && (metric.title.includes('Error') || metric.title.includes('Response'))
                          ? 'bg-green-500/20 text-green-300 border-green-500/30'
                          : 'bg-red-500/20 text-red-300 border-red-500/30'
                      }`}
                    >
                      {metric.change}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{metric.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Main Dashboard Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* System Performance */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2"
          >
            <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Activity className="h-6 w-6 text-blue-400" />
                  System Performance Analytics
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Real-time monitoring of critical system metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Resource Usage Meters */}
                <div className="grid gap-6 md:grid-cols-2">
                  {[
                    { label: 'CPU Usage', value: systemStats.cpuUsage, icon: Cpu, color: 'blue' },
                    { label: 'Memory Usage', value: systemStats.memoryUsage, icon: Database, color: 'green' },
                    { label: 'Disk Usage', value: systemStats.diskUsage, icon: HardDrive, color: 'purple' },
                    { label: 'Network Load', value: systemStats.networkLoad, icon: Wifi, color: 'orange' }
                  ].map((resource) => (
                    <div key={resource.label} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <resource.icon className={`h-4 w-4 text-${resource.color}-400`} />
                          <span className="text-sm text-gray-300">{resource.label}</span>
                        </div>
                        <span className="text-sm font-medium text-white">{resource.value}%</span>
                      </div>
                      <div className="relative">
                        <Progress 
                          value={resource.value} 
                          className="h-3 bg-gray-700"
                        />
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${resource.value}%` }}
                          transition={{ duration: 1, delay: 0.5 }}
                          className={`absolute top-0 left-0 h-3 bg-gradient-to-r from-${resource.color}-400 to-${resource.color}-600 rounded-full`}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Performance Chart Area */}
                <div className="mt-8">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-400" />
                    24-Hour Performance Trends
                  </h4>
                  <div className="h-48 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl flex items-end justify-between p-4">
                    {[...Array(24)].map((_, hour) => (
                      <motion.div
                        key={hour}
                        initial={{ height: 0 }}
                        animate={{ height: `${20 + Math.random() * 60}%` }}
                        transition={{ delay: hour * 0.05, duration: 0.6 }}
                        className="bg-gradient-to-t from-blue-400 to-purple-500 w-6 rounded-t-lg"
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Real-time Activity Feed */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="space-y-6"
          >
            {/* Live Status */}
            <Card className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-xl border border-green-500/30 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-3 h-3 bg-green-400 rounded-full"
                  />
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { service: 'API Gateway', status: 'Operational', uptime: '99.99%' },
                    { service: 'Database Cluster', status: 'Healthy', uptime: '99.97%' },
                    { service: 'Cache Layer', status: 'Active', uptime: '99.95%' },
                    { service: 'CDN Network', status: 'Optimal', uptime: '100%' }
                  ].map((service) => (
                    <div key={service.service} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{service.service}</p>
                        <p className="text-xs text-gray-300">{service.status}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-green-400 font-medium">{service.uptime}</p>
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* User Activity */}
            <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <UserCheck className="h-5 w-5 text-blue-400" />
                  Live User Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Online Users</span>
                    <motion.span 
                      key={realtimeData.usersOnline}
                      initial={{ scale: 1.2, color: '#60a5fa' }}
                      animate={{ scale: 1, color: '#ffffff' }}
                      className="text-sm font-bold text-white"
                    >
                      {realtimeData.usersOnline}
                    </motion.span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Active Sessions</span>
                    <motion.span 
                      key={realtimeData.activeConnections}
                      initial={{ scale: 1.2, color: '#34d399' }}
                      animate={{ scale: 1, color: '#ffffff' }}
                      className="text-sm font-bold text-white"
                    >
                      {realtimeData.activeConnections}
                    </motion.span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Requests/sec</span>
                    <motion.span 
                      key={realtimeData.requestsPerSecond}
                      initial={{ scale: 1.2, color: '#a78bfa' }}
                      animate={{ scale: 1, color: '#ffffff' }}
                      className="text-sm font-bold text-white"
                    >
                      {realtimeData.requestsPerSecond}
                    </motion.span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Settings className="h-5 w-5 text-purple-400" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'System Backup', icon: Database, color: 'blue' },
                  { label: 'Security Scan', icon: Lock, color: 'red' },
                  { label: 'Performance Test', icon: Zap, color: 'yellow' },
                  { label: 'View Logs', icon: Eye, color: 'green' }
                ].map((action) => (
                  <motion.div
                    key={action.label}
                    whileHover={{ scale: 1.02, x: 5 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button 
                      variant="outline" 
                      className="w-full justify-start bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20"
                    >
                      <action.icon className={`h-4 w-4 mr-2 text-${action.color}-400`} />
                      {action.label}
                    </Button>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Bottom Row - Security & Admin Tools */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="grid gap-6 lg:grid-cols-2"
        >
          {/* Security Center */}
          <Card className="bg-gradient-to-br from-red-500/20 to-orange-500/20 backdrop-blur-xl border border-red-500/30 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Shield className="h-6 w-6 text-red-400" />
                Security Center
              </CardTitle>
              <CardDescription className="text-gray-300">
                Real-time security monitoring and alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { threat: 'Failed Logins', count: 23, severity: 'medium' },
                  { threat: 'Blocked IPs', count: 7, severity: 'high' },
                  { threat: 'API Anomalies', count: 2, severity: 'low' },
                  { threat: 'Security Scans', count: 156, severity: 'info' }
                ].map((item) => (
                  <div key={item.threat} className="p-3 bg-black/20 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{item.threat}</span>
                      <Badge 
                        className={`text-xs ${
                          item.severity === 'high' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                          item.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                          item.severity === 'low' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                          'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        }`}
                      >
                        {item.count}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Global Infrastructure */}
          <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Globe className="h-6 w-6 text-blue-400" />
                Global Infrastructure
              </CardTitle>
              <CardDescription className="text-gray-300">
                Worldwide server status and performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { region: 'US East (N. Virginia)', status: 'Healthy', latency: '12ms' },
                  { region: 'EU West (Ireland)', status: 'Healthy', latency: '8ms' },
                  { region: 'Asia Pacific (Sydney)', status: 'Warning', latency: '45ms' },
                  { region: 'US West (Oregon)', status: 'Healthy', latency: '15ms' }
                ].map((region) => (
                  <div key={region.region} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        region.status === 'Healthy' ? 'bg-green-400' : 
                        region.status === 'Warning' ? 'bg-yellow-400' : 'bg-red-400'
                      } animate-pulse`}></div>
                      <div>
                        <p className="text-sm font-medium text-white">{region.region}</p>
                        <p className="text-xs text-gray-400">{region.status}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-300">{region.latency}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}