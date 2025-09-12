import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * PRODUCTION ALERTING SYSTEM
 * Automated monitoring and alerting for critical system events
 */

interface Alert {
  id: string;
  level: 'critical' | 'warning' | 'info';
  category: 'system' | 'database' | 'api' | 'invitation' | 'auth' | 'performance';
  message: string;
  details?: any;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
  source: string;
  count: number;
}

interface AlertRule {
  id: string;
  name: string;
  category: 'system' | 'database' | 'api' | 'invitation' | 'auth' | 'performance';
  condition: (metrics: any) => boolean;
  level: 'critical' | 'warning' | 'info';
  message: (metrics: any) => string;
  cooldown: number; // minutes
}

// Alert storage (in production, use Redis or database)
const alertStore = new Map<string, Alert>();
const alertCooldowns = new Map<string, number>();

// Define alert rules
const alertRules: AlertRule[] = [
  {
    id: 'database-down',
    name: 'Database Connection Down',
    category: 'database',
    condition: (metrics) => metrics.database?.connectionStatus === 'disconnected',
    level: 'critical',
    message: () => 'Database connection lost - immediate attention required',
    cooldown: 5
  },
  {
    id: 'high-error-rate',
    name: 'High Error Rate',
    category: 'api',
    condition: (metrics) => metrics.performance?.errorRate > 5,
    level: 'critical',
    message: (metrics) => `Error rate is ${metrics.performance.errorRate}% (threshold: 5%)`,
    cooldown: 10
  },
  {
    id: 'slow-response-time',
    name: 'Slow Response Time',
    category: 'performance',
    condition: (metrics) => metrics.performance?.averageResponseTime > 3000,
    level: 'warning',
    message: (metrics) => `Average response time is ${metrics.performance.averageResponseTime}ms (threshold: 3000ms)`,
    cooldown: 15
  },
  {
    id: 'high-memory-usage',
    name: 'High Memory Usage',
    category: 'system',
    condition: (metrics) => {
      const memory = metrics.system?.memory;
      return memory && (memory.heapUsed / memory.heapTotal) > 0.9;
    },
    level: 'warning',
    message: (metrics) => {
      const memory = metrics.system.memory;
      const usage = Math.round((memory.heapUsed / memory.heapTotal) * 100);
      return `Memory usage is ${usage}% (threshold: 90%)`;
    },
    cooldown: 10
  },
  {
    id: 'invitation-system-down',
    name: 'Invitation System Error',
    category: 'invitation',
    condition: (metrics) => metrics.invitation?.totalInvitations === 0 && metrics.system?.uptime > 300000,
    level: 'warning',
    message: () => 'No invitations found - system may be down',
    cooldown: 30
  },
  {
    id: 'no-recent-activity',
    name: 'No Recent User Activity',
    category: 'system',
    condition: (metrics) => {
      const uptime = metrics.system?.uptime;
      const recentUsers = metrics.users?.newUsersLast24h;
      return uptime > 86400000 && recentUsers === 0; // No new users in 24h and system running > 1 day
    },
    level: 'info',
    message: () => 'No new user activity in the last 24 hours',
    cooldown: 1440 // 24 hours
  }
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level');
    const category = searchParams.get('category');
    const resolved = searchParams.get('resolved');

    let alerts = Array.from(alertStore.values());

    // Filter alerts
    if (level) {
      alerts = alerts.filter(alert => alert.level === level);
    }
    if (category) {
      alerts = alerts.filter(alert => alert.category === category);
    }
    if (resolved !== null) {
      const isResolved = resolved === 'true';
      alerts = alerts.filter(alert => alert.resolved === isResolved);
    }

    // Sort by timestamp (newest first)
    alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      alerts,
      totalCount: alerts.length,
      criticalCount: alerts.filter(a => a.level === 'critical' && !a.resolved).length,
      warningCount: alerts.filter(a => a.level === 'warning' && !a.resolved).length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to retrieve alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (body.action === 'check') {
      return await checkAlerts(body.metrics);
    } else if (body.action === 'resolve') {
      return await resolveAlert(body.alertId);
    } else if (body.action === 'create') {
      return await createCustomAlert(body.alert);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to process alert request',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function checkAlerts(metrics: any) {
  const triggeredAlerts = [];
  const now = Date.now();

  for (const rule of alertRules) {
    try {
      // Check cooldown
      const lastAlert = alertCooldowns.get(rule.id);
      if (lastAlert && (now - lastAlert) < (rule.cooldown * 60 * 1000)) {
        continue;
      }

      // Check condition
      if (rule.condition(metrics)) {
        const existingAlert = alertStore.get(rule.id);
        
        if (existingAlert && !existingAlert.resolved) {
          // Update existing alert count
          existingAlert.count++;
          existingAlert.timestamp = new Date().toISOString();
        } else {
          // Create new alert
          const alert: Alert = {
            id: rule.id,
            level: rule.level,
            category: rule.category,
            message: rule.message(metrics),
            details: extractRelevantMetrics(metrics, rule.category),
            timestamp: new Date().toISOString(),
            resolved: false,
            source: 'automated',
            count: 1
          };

          alertStore.set(rule.id, alert);
          triggeredAlerts.push(alert);
          
          // Set cooldown
          alertCooldowns.set(rule.id, now);
          
          // Send notification (implement based on your notification system)
          await sendNotification(alert);
        }
      }
    } catch (error) {
      console.error(`Error checking alert rule ${rule.id}:`, error);
    }
  }

  return NextResponse.json({
    triggeredAlerts: triggeredAlerts.length,
    alerts: triggeredAlerts,
    timestamp: new Date().toISOString()
  });
}

async function resolveAlert(alertId: string) {
  const alert = alertStore.get(alertId);
  
  if (!alert) {
    return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
  }

  alert.resolved = true;
  alert.resolvedAt = new Date().toISOString();

  return NextResponse.json({
    message: 'Alert resolved successfully',
    alert
  });
}

async function createCustomAlert(alertData: any) {
  const alert: Alert = {
    id: `custom-${Date.now()}`,
    level: alertData.level || 'info',
    category: alertData.category || 'system',
    message: alertData.message,
    details: alertData.details,
    timestamp: new Date().toISOString(),
    resolved: false,
    source: 'manual',
    count: 1
  };

  alertStore.set(alert.id, alert);
  await sendNotification(alert);

  return NextResponse.json({
    message: 'Custom alert created successfully',
    alert
  });
}

function extractRelevantMetrics(metrics: any, category: string) {
  switch (category) {
    case 'database':
      return {
        connectionStatus: metrics.database?.connectionStatus,
        responseTime: metrics.database?.responseTime
      };
    case 'api':
      return {
        errorRate: metrics.performance?.errorRate,
        requestCount: metrics.performance?.requestCount,
        averageResponseTime: metrics.performance?.averageResponseTime
      };
    case 'performance':
      return {
        averageResponseTime: metrics.performance?.averageResponseTime,
        memoryUsage: metrics.system?.memory
      };
    case 'system':
      return {
        uptime: metrics.system?.uptime,
        memory: metrics.system?.memory,
        platform: metrics.system?.platform
      };
    case 'invitation':
      return {
        totalInvitations: metrics.invitation?.totalInvitations,
        pendingInvitations: metrics.invitation?.pendingInvitations,
        invitationsLast24h: metrics.invitation?.invitationsLast24h
      };
    default:
      return metrics;
  }
}

async function sendNotification(alert: Alert) {
  // Implementation depends on your notification system
  // This could send emails, Slack messages, webhook calls, etc.
  
  console.log(`🚨 ALERT [${alert.level.toUpperCase()}] ${alert.category}: ${alert.message}`);
  
  // Example: Send email notification for critical alerts
  if (alert.level === 'critical') {
    try {
      // Here you would integrate with your email service
      // For now, we'll log it
      console.log(`📧 Critical alert notification sent: ${alert.message}`);
    } catch (error) {
      console.error('Failed to send alert notification:', error);
    }
  }
  
  // Example: Send webhook notification
  if (process.env.ALERT_WEBHOOK_URL) {
    try {
      await fetch(process.env.ALERT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'alert',
          alert,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Failed to send webhook alert:', error);
    }
  }
}

// Cleanup old resolved alerts (run periodically)
setInterval(() => {
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  
  for (const [id, alert] of alertStore.entries()) {
    if (alert.resolved && new Date(alert.resolvedAt!).getTime() < oneDayAgo) {
      alertStore.delete(id);
    }
  }
}, 60 * 60 * 1000); // Run every hour