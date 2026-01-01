import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

/**
 * PRODUCTION HEALTH CHECK ENDPOINT
 * Comprehensive system health monitoring
 */

interface HealthCheck {
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

const startTime = Date.now();

export async function GET(request: NextRequest) {
  const checkStart = Date.now();
  
  try {
    // Initialize health check response
    const healthCheck: HealthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'production',
      checks: {
        database: await checkDatabase(),
        api: await checkAPI(),
        email: await checkEmail(),
        auth: await checkAuth(),
        invitations: await checkInvitations()
      },
      performance: {
        responseTime: Date.now() - checkStart,
        memoryUsage: process.memoryUsage?.()
      },
      uptime: Date.now() - startTime
    };

    // Determine overall status
    const checks = Object.values(healthCheck.checks);
    const failedChecks = checks.filter(check => check.status === 'fail').length;
    const warnChecks = checks.filter(check => check.status === 'warn').length;

    if (failedChecks > 0) {
      healthCheck.status = 'unhealthy';
    } else if (warnChecks > 0) {
      healthCheck.status = 'degraded';
    }

    // Set appropriate HTTP status code
    const httpStatus = healthCheck.status === 'healthy' ? 200 : 
                      healthCheck.status === 'degraded' ? 200 : 503;

    return NextResponse.json(healthCheck, { status: httpStatus });

  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      performance: {
        responseTime: Date.now() - checkStart
      }
    }, { status: 503 });
  }
}

async function checkDatabase(): Promise<HealthStatus> {
  const start = Date.now();
  
  try {
    // Test basic connectivity
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - start,
        error: error.message
      };
    }

    // Test critical tables
    const tables = ['users', 'workspaces', 'workspace_invitations', 'workspace_members'];
    const tableChecks = await Promise.allSettled(
      tables.map(table =>
        supabase.from(table).select('count').limit(1)
      )
    );

    const failedTables = tableChecks.filter(check => check.status === 'rejected').length;
    
    if (failedTables > 0) {
      return {
        status: 'warn',
        responseTime: Date.now() - start,
        error: `${failedTables} tables not accessible`,
        details: { totalTables: tables.length, failedTables }
      };
    }

    return {
      status: 'pass',
      responseTime: Date.now() - start,
      details: { tablesChecked: tables.length }
    };

  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Database check failed'
    };
  }
}

async function checkAPI(): Promise<HealthStatus> {
  const start = Date.now();
  
  try {
    // Test internal API endpoints
    const endpoints = [
      '/api/admin/stats',
      '/api/check-tables'
    ];

    const endpointChecks = await Promise.allSettled(
      endpoints.map(async (endpoint) => {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}${endpoint}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        return { endpoint, status: response.status };
      })
    );

    const failedEndpoints = endpointChecks.filter(
      check => check.status === 'rejected' || 
      (check.status === 'fulfilled' && check.value.status >= 500)
    ).length;

    if (failedEndpoints > 0) {
      return {
        status: failedEndpoints === endpoints.length ? 'fail' : 'warn',
        responseTime: Date.now() - start,
        error: `${failedEndpoints}/${endpoints.length} endpoints failed`,
        details: { endpointsChecked: endpoints.length, failedEndpoints }
      };
    }

    return {
      status: 'pass',
      responseTime: Date.now() - start,
      details: { endpointsChecked: endpoints.length }
    };

  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'API check failed'
    };
  }
}

async function checkEmail(): Promise<HealthStatus> {
  const start = Date.now();
  
  try {
    // Verify Postmark configuration
    const postmarkKey = process.env.POSTMARK_INNOVAREAI_API_KEY;
    
    if (!postmarkKey) {
      return {
        status: 'fail',
        responseTime: Date.now() - start,
        error: 'Postmark API key not configured'
      };
    }

    // Test Postmark server status (could be expanded to actual API call)
    return {
      status: 'pass',
      responseTime: Date.now() - start,
      details: { provider: 'Postmark', configured: true }
    };

  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Email service check failed'
    };
  }
}

async function checkAuth(): Promise<HealthStatus> {
  const start = Date.now();
  
  try {
    // Verify Supabase configuration
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return {
        status: 'fail',
        responseTime: Date.now() - start,
        error: 'Supabase authentication keys not configured'
      };
    }

    return {
      status: 'pass',
      responseTime: Date.now() - start,
      details: { provider: 'Supabase', configured: true }
    };

  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Auth service check failed'
    };
  }
}

async function checkInvitations(): Promise<HealthStatus> {
  const start = Date.now();
  
  try {
    // Check invitation system functionality
    const { data, error } = await supabase
      .from('workspace_invitations')
      .select('id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - start,
        error: `Invitation system error: ${error.message}`
      };
    }

    // Check for recent invitation activity
    const recentInvitations = data?.filter(inv => {
      const createdAt = new Date(inv.created_at);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return createdAt > oneDayAgo;
    }).length || 0;

    return {
      status: 'pass',
      responseTime: Date.now() - start,
      details: {
        totalInvitations: data?.length || 0,
        recentInvitations
      }
    };

  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Invitation system check failed'
    };
  }
}