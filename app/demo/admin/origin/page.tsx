'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  Shield, Users, Activity, Database, Server, AlertTriangle, CheckCircle,
  TrendingUp, BarChart3, Settings, Globe, Zap, HardDrive, Wifi, Cpu
} from 'lucide-react'

export default function OriginAdminPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Clean header */}
      <div className="border-b border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-900 rounded-lg flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-500 text-sm">Origin UI - Clean Administrative Interface</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Key metrics */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
        >
          {[
            { title: 'Total Users', value: '2,847', icon: Users, change: '+12.5%' },
            { title: 'System Load', value: '67%', icon: Cpu, change: '+2.1%' },
            { title: 'Uptime', value: '99.7%', icon: CheckCircle, change: '+0.2%' },
            { title: 'Active Alerts', value: '3', icon: AlertTriangle, change: '-8' }
          ].map((metric) => (
            <Card key={metric.title} className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {metric.title}
                </CardTitle>
                <metric.icon className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{metric.value}</div>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <span className={metric.change.startsWith('+') && !metric.title.includes('Load') ? 'text-green-600' : 'text-red-600'}>
                    {metric.change}
                  </span>
                  from last period
                </p>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Main grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* System overview */}
          <div className="lg:col-span-2">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  System Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Resource usage */}
                <div className="grid gap-6 md:grid-cols-2">
                  {[
                    { label: 'CPU Usage', value: 67, icon: Cpu },
                    { label: 'Memory', value: 54, icon: Database },
                    { label: 'Storage', value: 32, icon: HardDrive },
                    { label: 'Network', value: 78, icon: Wifi }
                  ].map((resource) => (
                    <div key={resource.label} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <resource.icon className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium">{resource.label}</span>
                        </div>
                        <span className="text-sm text-gray-600">{resource.value}%</span>
                      </div>
                      <Progress value={resource.value} className="h-2" />
                    </div>
                  ))}
                </div>

                {/* Performance chart */}
                <div>
                  <h4 className="text-lg font-medium mb-4">24-Hour Overview</h4>
                  <div className="h-32 flex items-end justify-between bg-gray-50 rounded-lg p-4">
                    {[...Array(24)].map((_, hour) => (
                      <div
                        key={hour}
                        className="bg-gray-900 w-2 rounded-t"
                        style={{ height: `${20 + Math.random() * 60}%` }}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* System status */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { service: 'API Gateway', status: 'Operational' },
                    { service: 'Database', status: 'Healthy' },
                    { service: 'Cache Layer', status: 'Active' },
                    { service: 'CDN', status: 'Optimal' }
                  ].map((service) => (
                    <div key={service.service} className="flex items-center justify-between">
                      <span className="text-sm">{service.service}</span>
                      <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                        {service.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick actions */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'System Backup', icon: Database },
                  { label: 'Security Scan', icon: Shield },
                  { label: 'Performance Test', icon: Zap },
                  { label: 'View Logs', icon: BarChart3 }
                ].map((action) => (
                  <Button 
                    key={action.label}
                    variant="outline" 
                    className="w-full justify-start"
                  >
                    <action.icon className="h-4 w-4 mr-2" />
                    {action.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Security overview */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { threat: 'Failed Logins', count: 23, severity: 'medium' },
                  { threat: 'Blocked IPs', count: 7, severity: 'high' },
                  { threat: 'Security Scans', count: 156, severity: 'info' }
                ].map((item) => (
                  <div key={item.threat} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                    <span className="text-sm font-medium">{item.threat}</span>
                    <Badge 
                      variant="outline"
                      className={
                        item.severity === 'high' ? 'border-red-200 text-red-700 bg-red-50' :
                        item.severity === 'medium' ? 'border-yellow-200 text-yellow-700 bg-yellow-50' :
                        'border-blue-200 text-blue-700 bg-blue-50'
                      }
                    >
                      {item.count}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Infrastructure */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Global Infrastructure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { region: 'US East', status: 'Healthy', latency: '12ms' },
                  { region: 'EU West', status: 'Healthy', latency: '8ms' },
                  { region: 'Asia Pacific', status: 'Warning', latency: '45ms' }
                ].map((region) => (
                  <div key={region.region} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        region.status === 'Healthy' ? 'bg-green-500' : 'bg-yellow-500'
                      }`}></div>
                      <div>
                        <span className="text-sm font-medium">{region.region}</span>
                        <p className="text-xs text-gray-500">{region.status}</p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-600">{region.latency}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}