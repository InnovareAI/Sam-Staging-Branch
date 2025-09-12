'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, Clock, Activity, Database, Mail, Shield, Zap } from 'lucide-react';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  checks: {
    database: HealthStatus;
    api: HealthStatus;
    email: HealthStatus;
    auth: HealthStatus;
    invitations: HealthStatus;
  };
  performance: {
    responseTime: number;
    memoryUsage?: NodeJS.MemoryUsage;
  };
  uptime: number;
}

interface HealthStatus {
  status: 'pass' | 'fail' | 'warn';
  responseTime?: number;
  error?: string;
  details?: any;
}

interface Alert {
  id: string;
  level: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  timestamp: string;
  resolved: boolean;
  count: number;
}

interface Metrics {
  timestamp: string;
  environment: string;
  invitation: {
    totalInvitations: number;
    pendingInvitations: number;
    acceptedInvitations: number;
    rejectedInvitations: number;
    invitationsLast24h: number;
    invitationsThisWeek: number;
  };
  users: {
    totalUsers: number;
    activeUsers: number;
    newUsersLast24h: number;
    newUsersThisWeek: number;
  };
  performance: {
    averageResponseTime: number;
    errorRate: number;
    requestCount: number;
  };
  errors: {
    last24h: number;
    lastError?: {
      timestamp: string;
      message: string;
      endpoint?: string;
    };
  };
}

export default function MonitoringDashboard() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [healthResponse, metricsResponse, alertsResponse] = await Promise.all([
        fetch('/api/monitoring/health'),
        fetch('/api/monitoring/metrics'),
        fetch('/api/monitoring/alerts?resolved=false')
      ]);

      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        setHealth(healthData);
      }

      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setMetrics(metricsData);
      }

      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        setAlerts(alertsData.alerts || []);
      }

      setLastUpdate(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'pass':
        return 'bg-green-500';
      case 'degraded':
      case 'warn':
        return 'bg-yellow-500';
      case 'unhealthy':
      case 'fail':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'unhealthy':
      case 'fail':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">System Monitoring Dashboard</h1>
        <div className="flex items-center space-x-4">
          <Badge variant="outline">
            Last Updated: {lastUpdate.toLocaleTimeString()}
          </Badge>
          <Button onClick={fetchData} size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>System Health</span>
            {health && (
              <Badge className={getStatusColor(health.status)}>
                {health.status.toUpperCase()}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Real-time system health monitoring and status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {health ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="flex items-center space-x-2">
                <Database className="h-4 w-4" />
                <span className="text-sm">Database</span>
                {getStatusIcon(health.checks.database.status)}
                <span className="text-xs text-gray-500">
                  {health.checks.database.responseTime}ms
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4" />
                <span className="text-sm">API</span>
                {getStatusIcon(health.checks.api.status)}
                <span className="text-xs text-gray-500">
                  {health.checks.api.responseTime}ms
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4" />
                <span className="text-sm">Email</span>
                {getStatusIcon(health.checks.email.status)}
              </div>
              
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4" />
                <span className="text-sm">Auth</span>
                {getStatusIcon(health.checks.auth.status)}
              </div>
              
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Invitations</span>
                {getStatusIcon(health.checks.invitations.status)}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Failed to load health data
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health?.performance.responseTime}ms
            </div>
            <Progress value={Math.min((health?.performance.responseTime || 0) / 30, 100)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health ? formatUptime(health.uptime) : 'N/A'}
            </div>
            <div className="text-sm text-green-600">System online</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health?.performance.memoryUsage ? 
                formatBytes(health.performance.memoryUsage.heapUsed) : 'N/A'}
            </div>
            {health?.performance.memoryUsage && (
              <Progress 
                value={(health.performance.memoryUsage.heapUsed / health.performance.memoryUsage.heapTotal) * 100} 
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.performance.errorRate.toFixed(2)}%
            </div>
            <div className="text-sm text-gray-500">
              {metrics?.performance.requestCount} requests
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invitation System Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Invitation System</CardTitle>
          <CardDescription>Invitation system performance and statistics</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {metrics.invitation.totalInvitations}
                </div>
                <div className="text-sm text-gray-500">Total</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {metrics.invitation.pendingInvitations}
                </div>
                <div className="text-sm text-gray-500">Pending</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {metrics.invitation.acceptedInvitations}
                </div>
                <div className="text-sm text-gray-500">Accepted</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {metrics.invitation.rejectedInvitations}
                </div>
                <div className="text-sm text-gray-500">Rejected</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {metrics.invitation.invitationsLast24h}
                </div>
                <div className="text-sm text-gray-500">Last 24h</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">
                  {metrics.invitation.invitationsThisWeek}
                </div>
                <div className="text-sm text-gray-500">This Week</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No metrics data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5" />
            <span>Active Alerts</span>
            <Badge variant="destructive">{alerts.length}</Badge>
          </CardTitle>
          <CardDescription>Current system alerts and warnings</CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length > 0 ? (
            <div className="space-y-2">
              {alerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Badge 
                      variant={alert.level === 'critical' ? 'destructive' : 
                               alert.level === 'warning' ? 'default' : 'secondary'}
                    >
                      {alert.level}
                    </Badge>
                    <span className="text-sm font-medium">{alert.category}</span>
                    <span className="text-sm">{alert.message}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {alert.count > 1 && (
                      <Badge variant="outline">{alert.count}</Badge>
                    )}
                    <span className="text-xs text-gray-500">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-green-600">
              <CheckCircle className="h-8 w-8 mx-auto mb-2" />
              <div>No active alerts</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>User Statistics</CardTitle>
          <CardDescription>User registration and activity metrics</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {metrics.users.totalUsers}
                </div>
                <div className="text-sm text-gray-500">Total Users</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {metrics.users.activeUsers}
                </div>
                <div className="text-sm text-gray-500">Active Users</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {metrics.users.newUsersLast24h}
                </div>
                <div className="text-sm text-gray-500">New (24h)</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">
                  {metrics.users.newUsersThisWeek}
                </div>
                <div className="text-sm text-gray-500">New (Week)</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No user data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Errors */}
      {metrics?.errors.lastError && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Recent Errors</CardTitle>
            <CardDescription>Last system error information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="font-medium text-red-800">{metrics.errors.lastError.message}</div>
              <div className="text-sm text-red-600 mt-1">
                {metrics.errors.lastError.endpoint && `Endpoint: ${metrics.errors.lastError.endpoint} • `}
                {new Date(metrics.errors.lastError.timestamp).toLocaleString()}
              </div>
              <div className="text-sm text-red-600 mt-1">
                Total errors in last 24h: {metrics.errors.last24h}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}