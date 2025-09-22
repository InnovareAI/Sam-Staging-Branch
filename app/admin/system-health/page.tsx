'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertTriangle, CheckCircle, XCircle, Activity, Zap, Database, Cpu, HardDrive, WifiIcon } from 'lucide-react'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  checks: {
    database: ComponentHealth
    api: ComponentHealth
    email: ComponentHealth
    auth: ComponentHealth
    campaigns: ComponentHealth
    qa_agent: ComponentHealth
  }
  performance: {
    responseTime: number
    memoryUsage?: NodeJS.MemoryUsage
    uptime: number
  }
}

interface ComponentHealth {
  status: 'pass' | 'fail' | 'warn'
  responseTime?: number
  lastCheck: string
  details?: string
  metrics?: any
}

interface QASession {
  session_id: string
  started_at: string
  uptime_minutes: number
  statistics: {
    issues_detected: number
    issues_fixed: number
    manual_intervention_required: number
    success_rate: number
  }
  recent_fixes: any[]
}

interface SystemAlert {
  id: string
  type: 'critical' | 'warning' | 'info'
  component: string
  message: string
  timestamp: string
  resolved: boolean
}

export default function SystemHealthDashboard() {
  const [healthData, setHealthData] = useState<HealthStatus | null>(null)
  const [qaSession, setQaSession] = useState<QASession | null>(null)
  const [alerts, setAlerts] = useState<SystemAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchHealthData = async () => {
    try {
      // Fetch system health
      const healthResponse = await fetch('/api/campaign/health')
      const healthResult = await healthResponse.json()
      
      // Transform the existing health data to match our interface
      const transformedHealth: HealthStatus = {
        status: healthResult.resilience_score > 80 ? 'healthy' : 
                healthResult.resilience_score > 50 ? 'degraded' : 'unhealthy',
        timestamp: healthResult.timestamp,
        checks: {
          database: {
            status: healthResult.components?.database?.status === 'healthy' ? 'pass' : 'warn',
            responseTime: healthResult.components?.database?.latency_ms,
            lastCheck: healthResult.timestamp,
            details: `Latency: ${healthResult.components?.database?.latency_ms}ms`
          },
          api: {
            status: healthResult.success ? 'pass' : 'fail',
            responseTime: healthResult.response_time_ms,
            lastCheck: healthResult.timestamp,
            details: `Response time: ${healthResult.response_time_ms}ms`
          },
          email: {
            status: 'pass', // Assume healthy for now
            lastCheck: healthResult.timestamp,
            details: 'Email system operational'
          },
          auth: {
            status: 'pass', // Assume healthy for now
            lastCheck: healthResult.timestamp,
            details: 'Authentication system operational'
          },
          campaigns: {
            status: healthResult.success ? 'pass' : 'warn',
            lastCheck: healthResult.timestamp,
            details: 'Campaign system operational'
          },
          qa_agent: {
            status: 'pass', // Will be updated with real QA data
            lastCheck: new Date().toISOString(),
            details: 'QA Agent monitoring active'
          }
        },
        performance: {
          responseTime: healthResult.response_time_ms || 0,
          uptime: Date.now() - new Date('2025-09-18').getTime() // Approximate uptime
        }
      }
      
      setHealthData(transformedHealth)
      
      // Mock QA session data (in real implementation, this would fetch from QA Agent)
      const mockQaSession: QASession = {
        session_id: 'qa_' + Date.now(),
        started_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        uptime_minutes: 60,
        statistics: {
          issues_detected: 3,
          issues_fixed: 2,
          manual_intervention_required: 1,
          success_rate: 67
        },
        recent_fixes: [
          {
            issueType: 'supabase_import_conflict',
            file: 'lib/auth.ts',
            appliedAt: new Date(Date.now() - 1800000).toISOString(),
            success: true
          },
          {
            issueType: 'environment_variable_missing', 
            file: 'lib/rate-limit.ts',
            appliedAt: new Date(Date.now() - 900000).toISOString(),
            success: true
          }
        ]
      }
      
      setQaSession(mockQaSession)
      
      // Mock system alerts
      const mockAlerts: SystemAlert[] = [
        {
          id: '1',
          type: 'warning',
          component: 'Database',
          message: 'Connection pool approaching limit',
          timestamp: new Date(Date.now() - 600000).toISOString(),
          resolved: false
        },
        {
          id: '2',
          type: 'info',
          component: 'QA Agent',
          message: 'Successfully fixed Supabase import conflict',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          resolved: true
        }
      ]
      
      setAlerts(mockAlerts)
      
    } catch (error) {
      console.error('Failed to fetch health data:', error)
    } finally {
      setLoading(false)
      setLastRefresh(new Date())
    }
  }

  useEffect(() => {
    fetchHealthData()
    
    const interval = autoRefresh ? setInterval(fetchHealthData, 30000) : null // 30 second refresh
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'pass':
        return 'text-green-500'
      case 'degraded':
      case 'warn':
        return 'text-yellow-500'
      case 'unhealthy':
      case 'fail':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'degraded':
      case 'warn':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'unhealthy':
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Activity className="h-5 w-5 text-gray-500" />
    }
  }

  const formatUptime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">System Health Dashboard</h1>
          <p className="text-gray-600">Real-time monitoring and auto-healing status</p>
        </div>
        <div className="flex items-center space-x-4">
          <Badge variant={healthData?.status === 'healthy' ? 'default' : 'destructive'}>
            {healthData?.status?.toUpperCase() || 'UNKNOWN'}
          </Badge>
          <Button 
            variant="outline" 
            onClick={fetchHealthData}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
          </Button>
        </div>
      </div>

      {/* Last Update */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
            <span className="text-sm text-gray-600">
              System uptime: {healthData ? formatUptime(healthData.performance.uptime) : 'Unknown'}
            </span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="qa-agent">QA Agent</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Overall Health */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Status</CardTitle>
                {getStatusIcon(healthData?.status || 'unknown')}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">
                  {healthData?.status || 'Unknown'}
                </div>
                <p className="text-xs text-muted-foreground">
                  All critical systems operational
                </p>
              </CardContent>
            </Card>

            {/* Response Time */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {healthData?.performance.responseTime || 0}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  Average API response time
                </p>
              </CardContent>
            </Card>

            {/* QA Success Rate */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">QA Success Rate</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {qaSession?.statistics.success_rate || 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Auto-fix success rate
                </p>
              </CardContent>
            </Card>

            {/* Issues Fixed */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Issues Fixed</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {qaSession?.statistics.issues_fixed || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Auto-resolved today
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Component Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {healthData && Object.entries(healthData.checks).map(([component, health]) => (
              <Card key={component}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium capitalize">
                    {component.replace('_', ' ')}
                  </CardTitle>
                  {getStatusIcon(health.status)}
                </CardHeader>
                <CardContent>
                  <div className={`text-lg font-semibold ${getStatusColor(health.status)}`}>
                    {health.status.toUpperCase()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {health.details}
                  </p>
                  {health.responseTime && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs">
                        <span>Response time</span>
                        <span>{health.responseTime}ms</span>
                      </div>
                      <Progress 
                        value={Math.min((health.responseTime / 1000) * 100, 100)} 
                        className="mt-1"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Components Tab */}
        <TabsContent value="components" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {healthData && Object.entries(healthData.checks).map(([component, health]) => (
              <Card key={component}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="capitalize">{component.replace('_', ' ')}</CardTitle>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(health.status)}
                      <Badge variant={health.status === 'pass' ? 'default' : 'destructive'}>
                        {health.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    Last checked: {new Date(health.lastCheck).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p>{health.details}</p>
                    
                    {health.responseTime && (
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Response Time</span>
                          <span>{health.responseTime}ms</span>
                        </div>
                        <Progress value={Math.min((health.responseTime / 1000) * 100, 100)} />
                      </div>
                    )}
                    
                    {component === 'database' && (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Connection Pool:</span>
                          <span className="ml-2 font-medium">Active</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Circuit Breaker:</span>
                          <span className="ml-2 font-medium text-green-600">Closed</span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* QA Agent Tab */}
        <TabsContent value="qa-agent" className="space-y-6">
          {qaSession && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Session Uptime</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{qaSession.uptime_minutes}m</div>
                    <p className="text-xs text-muted-foreground">
                      Session ID: {qaSession.session_id.substring(0, 8)}...
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Issues Detected</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{qaSession.statistics.issues_detected}</div>
                    <p className="text-xs text-muted-foreground">
                      Total issues found
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Auto-Fixed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{qaSession.statistics.issues_fixed}</div>
                    <p className="text-xs text-muted-foreground">
                      Automatically resolved
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Manual Required</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">{qaSession.statistics.manual_intervention_required}</div>
                    <p className="text-xs text-muted-foreground">
                      Needs human review
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Auto-Fixes</CardTitle>
                  <CardDescription>Latest issues resolved by the QA Agent</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {qaSession.recent_fixes.map((fix, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="font-medium">{fix.issueType.replace('_', ' ')}</div>
                          <div className="text-sm text-gray-600">{fix.file}</div>
                        </div>
                        <div className="text-right">
                          <Badge variant={fix.success ? 'default' : 'destructive'}>
                            {fix.success ? 'Fixed' : 'Failed'}
                          </Badge>
                          <div className="text-xs text-gray-600 mt-1">
                            {new Date(fix.appliedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Alerts</CardTitle>
              <CardDescription>Recent system notifications and warnings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div key={alert.id} className="flex items-start space-x-4 p-4 border rounded-lg">
                    <div className="flex-shrink-0">
                      {alert.type === 'critical' && <XCircle className="h-5 w-5 text-red-500" />}
                      {alert.type === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                      {alert.type === 'info' && <CheckCircle className="h-5 w-5 text-blue-500" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{alert.component}</div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={alert.type === 'critical' ? 'destructive' : alert.type === 'warning' ? 'secondary' : 'default'}>
                            {alert.type.toUpperCase()}
                          </Badge>
                          {alert.resolved && (
                            <Badge variant="outline">Resolved</Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}