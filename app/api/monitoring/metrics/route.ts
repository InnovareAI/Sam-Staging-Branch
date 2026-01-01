import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

/**
 * PRODUCTION METRICS ENDPOINT
 * Real-time system metrics and performance data
 */

interface SystemMetrics {
  timestamp: string;
  environment: string;
  system: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    nodeVersion: string;
    platform: string;
  };
  database: {
    connectionStatus: 'connected' | 'disconnected' | 'error';
    responseTime: number;
    activeConnections?: number;
  };
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
  workspaces: {
    totalWorkspaces: number;
    activeWorkspaces: number;
    newWorkspacesLast24h: number;
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

// In-memory metrics storage (in production, use Redis or similar)
const metricsStore = {
  requestCount: 0,
  errorCount: 0,
  responseTimes: [] as number[],
  lastError: null as any,
  startTime: Date.now()
};

export async function GET(request: NextRequest) {
  const start = Date.now();
  
  try {
    // Collect system metrics
    const systemMetrics = collectSystemMetrics(start);
    
    // Collect database metrics
    const databaseMetrics = await collectDatabaseMetrics(supabase);
    
    // Collect invitation metrics
    const invitationMetrics = await collectInvitationMetrics(supabase);
    
    // Collect user metrics
    const userMetrics = await collectUserMetrics(supabase);
    
    // Collect workspace metrics
    const workspaceMetrics = await collectWorkspaceMetrics(supabase);
    
    // Collect performance metrics
    const performanceMetrics = collectPerformanceMetrics();
    
    // Collect error metrics
    const errorMetrics = collectErrorMetrics();

    const metrics: SystemMetrics = {
      timestamp: new Date().toISOString(),
      environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'production',
      system: systemMetrics,
      database: databaseMetrics,
      invitation: invitationMetrics,
      users: userMetrics,
      workspaces: workspaceMetrics,
      performance: performanceMetrics,
      errors: errorMetrics
    };

    // Track this request
    metricsStore.requestCount++;
    const responseTime = Date.now() - start;
    metricsStore.responseTimes.push(responseTime);
    
    // Keep only last 1000 response times
    if (metricsStore.responseTimes.length > 1000) {
      metricsStore.responseTimes = metricsStore.responseTimes.slice(-1000);
    }

    return NextResponse.json(metrics);

  } catch (error) {
    metricsStore.errorCount++;
    metricsStore.lastError = {
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : 'Unknown error',
      endpoint: '/api/monitoring/metrics'
    };

    return NextResponse.json({
      error: 'Failed to collect metrics',
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function collectSystemMetrics(startTime: number) {
  return {
    uptime: Date.now() - metricsStore.startTime,
    memory: process.memoryUsage(),
    nodeVersion: process.version,
    platform: process.platform
  };
}

async function collectDatabaseMetrics(supabase: any) {
  const start = Date.now();
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);

    if (error) {
      return {
        connectionStatus: 'error' as const,
        responseTime: Date.now() - start
      };
    }

    return {
      connectionStatus: 'connected' as const,
      responseTime: Date.now() - start
    };
  } catch (error) {
    return {
      connectionStatus: 'disconnected' as const,
      responseTime: Date.now() - start
    };
  }
}

async function collectInvitationMetrics(supabase: any) {
  try {
    // Get invitation counts by status
    const { data: invitations, error } = await supabase
      .from('invitations')
      .select('status, created_at');

    if (error) {
      return {
        totalInvitations: 0,
        pendingInvitations: 0,
        acceptedInvitations: 0,
        rejectedInvitations: 0,
        invitationsLast24h: 0,
        invitationsThisWeek: 0
      };
    }

    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

    const pending = invitations?.filter(inv => inv.status === 'pending').length || 0;
    const accepted = invitations?.filter(inv => inv.status === 'accepted').length || 0;
    const rejected = invitations?.filter(inv => inv.status === 'rejected').length || 0;
    
    const last24h = invitations?.filter(inv => {
      const createdAt = new Date(inv.created_at).getTime();
      return createdAt > oneDayAgo;
    }).length || 0;

    const thisWeek = invitations?.filter(inv => {
      const createdAt = new Date(inv.created_at).getTime();
      return createdAt > oneWeekAgo;
    }).length || 0;

    return {
      totalInvitations: invitations?.length || 0,
      pendingInvitations: pending,
      acceptedInvitations: accepted,
      rejectedInvitations: rejected,
      invitationsLast24h: last24h,
      invitationsThisWeek: thisWeek
    };
  } catch (error) {
    return {
      totalInvitations: 0,
      pendingInvitations: 0,
      acceptedInvitations: 0,
      rejectedInvitations: 0,
      invitationsLast24h: 0,
      invitationsThisWeek: 0
    };
  }
}

async function collectUserMetrics(supabase: any) {
  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('created_at, updated_at');

    if (error) {
      return {
        totalUsers: 0,
        activeUsers: 0,
        newUsersLast24h: 0,
        newUsersThisWeek: 0
      };
    }

    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

    const newLast24h = users?.filter(user => {
      const createdAt = new Date(user.created_at).getTime();
      return createdAt > oneDayAgo;
    }).length || 0;

    const newThisWeek = users?.filter(user => {
      const createdAt = new Date(user.created_at).getTime();
      return createdAt > oneWeekAgo;
    }).length || 0;

    // Consider users active if they were updated in the last 7 days
    const active = users?.filter(user => {
      const updatedAt = new Date(user.updated_at || user.created_at).getTime();
      return updatedAt > oneWeekAgo;
    }).length || 0;

    return {
      totalUsers: users?.length || 0,
      activeUsers: active,
      newUsersLast24h: newLast24h,
      newUsersThisWeek: newThisWeek
    };
  } catch (error) {
    return {
      totalUsers: 0,
      activeUsers: 0,
      newUsersLast24h: 0,
      newUsersThisWeek: 0
    };
  }
}

async function collectWorkspaceMetrics(supabase: any) {
  try {
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('created_at, status');

    if (error) {
      return {
        totalWorkspaces: 0,
        activeWorkspaces: 0,
        newWorkspacesLast24h: 0
      };
    }

    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    const active = workspaces?.filter(ws => ws.status === 'active').length || 0;
    
    const newLast24h = workspaces?.filter(ws => {
      const createdAt = new Date(ws.created_at).getTime();
      return createdAt > oneDayAgo;
    }).length || 0;

    return {
      totalWorkspaces: workspaces?.length || 0,
      activeWorkspaces: active,
      newWorkspacesLast24h: newLast24h
    };
  } catch (error) {
    return {
      totalWorkspaces: 0,
      activeWorkspaces: 0,
      newWorkspacesLast24h: 0
    };
  }
}

function collectPerformanceMetrics() {
  const responseTimes = metricsStore.responseTimes;
  const averageResponseTime = responseTimes.length > 0 
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
    : 0;

  const errorRate = metricsStore.requestCount > 0 
    ? (metricsStore.errorCount / metricsStore.requestCount) * 100 
    : 0;

  return {
    averageResponseTime: Math.round(averageResponseTime),
    errorRate: Math.round(errorRate * 100) / 100,
    requestCount: metricsStore.requestCount
  };
}

function collectErrorMetrics() {
  return {
    last24h: metricsStore.errorCount, // Simplified for demo
    lastError: metricsStore.lastError
  };
}

// Middleware to track errors (would be better implemented at the application level)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (body.type === 'error') {
      metricsStore.errorCount++;
      metricsStore.lastError = {
        timestamp: new Date().toISOString(),
        message: body.message,
        endpoint: body.endpoint
      };
    }

    return NextResponse.json({ status: 'logged' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to log error' }, { status: 500 });
  }
}