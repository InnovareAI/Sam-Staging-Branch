import { toastSuccess, toastError, toastWarning, toastInfo } from '@/lib/toast';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

/**
 * MCP Monitoring Dashboard API
 *
 * Provides real-time monitoring data for MCP tools and LinkedIn accounts
 * Used by admin dashboard for production reliability oversight
 */

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Fetching MCP monitoring dashboard data...');
    
    // Get monitoring summary
    const { data: summary, error: summaryError } = await supabase
      .rpc('get_mcp_monitoring_summary');
    
    if (summaryError) {
      console.error('Failed to get monitoring summary:', summaryError);
    }
    
    // Get dashboard metrics
    const { data: dashboardData, error: dashboardError } = await supabase
      .from('mcp_monitoring_dashboard')
      .select('*');
    
    if (dashboardError) {
      console.error('Failed to get dashboard data:', dashboardError);
    }
    
    // Get recent health checks
    const { data: recentChecks, error: checksError } = await supabase
      .from('mcp_health_checks')
      .select('*')
      .order('check_timestamp', { ascending: false })
      .limit(10);
    
    if (checksError) {
      console.error('Failed to get recent checks:', checksError);
    }
    
    // Get account statuses
    const { data: accountStatuses, error: statusError } = await supabase
      .from('mcp_account_status')
      .select('*')
      .order('last_checked', { ascending: false });
    
    if (statusError) {
      console.error('Failed to get account statuses:', statusError);
    }
    
    // Get active alerts
    const { data: activeAlerts, error: alertsError } = await supabase
      .from('mcp_monitoring_alerts')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    
    if (alertsError) {
      console.error('Failed to get active alerts:', alertsError);
    }
    
    // Process and format data
    const currentSummary = summary?.[0] || {
      overall_status: 'unknown',
      healthy_accounts: 0,
      total_accounts: 0,
      connectivity_percentage: 0,
      active_alerts: 0,
      last_check_time: null,
      needs_immediate_attention: false
    };
    
    const metrics = processDashboardMetrics(dashboardData || []);
    const healthTrend = calculateHealthTrend(recentChecks || []);
    
    console.log(`✅ Dashboard data fetched: ${currentSummary.total_accounts} accounts, ${currentSummary.active_alerts} alerts`);
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: currentSummary,
      metrics,
      healthTrend,
      accounts: (accountStatuses || []).map(account => ({
        id: account.unipile_account_id,
        name: account.account_name,
        type: account.account_type,
        status: account.current_status,
        lastChecked: account.last_checked,
        successRate: account.success_rate,
        averageResponseTime: account.average_response_time_ms,
        consecutiveFailures: account.consecutive_failures,
        needsAttention: account.needs_attention,
        statusIndicator: getStatusIndicator(account.current_status, account.consecutive_failures)
      })),
      recentActivity: (recentChecks || []).slice(0, 5).map(check => ({
        id: check.id,
        timestamp: check.check_timestamp,
        type: check.check_type,
        status: check.status,
        responseTime: check.response_time_ms,
        accountsFound: check.accounts_found,
        accountsOk: check.linkedin_accounts_ok,
        connectivityScore: check.connectivity_score
      })),
      alerts: (activeAlerts || []).map(alert => ({
        id: alert.id,
        type: alert.alert_type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        affectedAccounts: alert.affected_accounts,
        createdAt: alert.created_at,
        priorityLevel: getPriorityLevel(alert.severity)
      })),
      recommendations: generateDashboardRecommendations(
        currentSummary,
        accountStatuses || [],
        activeAlerts || []
      )
    });

  } catch (error: any) {
    console.error('Dashboard data fetch failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      fallbackData: {
        summary: {
          overall_status: 'error',
          healthy_accounts: 0,
          total_accounts: 0,
          connectivity_percentage: 0,
          active_alerts: 1,
          needs_immediate_attention: true
        },
        recommendations: [
          'Dashboard connectivity issue detected',
          'Check MCP monitoring system deployment',
          'Verify database connectivity'
        ]
      }
    }, { status: 500 });
  }
}

/**
 * Process dashboard metrics for visualization
 */
function processDashboardMetrics(dashboardData: any[]): any {
  const currentStatusData = dashboardData.find(d => d.metric_type === 'current_status');
  const alertsData = dashboardData.find(d => d.metric_type === 'recent_alerts');
  
  return {
    accounts: {
      total: currentStatusData?.total_accounts || 0,
      healthy: currentStatusData?.healthy_accounts || 0,
      credentialIssues: currentStatusData?.credential_issues || 0,
      errors: currentStatusData?.error_accounts || 0,
      needingAttention: currentStatusData?.accounts_needing_attention || 0
    },
    performance: {
      averageSuccessRate: currentStatusData?.average_success_rate || 0,
      averageResponseTime: currentStatusData?.average_response_time || 0,
      lastHealthCheck: currentStatusData?.last_health_check
    },
    alerts: {
      total: alertsData?.total_accounts || 0,
      active: alertsData?.healthy_accounts || 0,
      highPriority: alertsData?.credential_issues || 0,
      recentAlerts: alertsData?.error_accounts || 0
    }
  };
}

/**
 * Calculate health trend from recent checks
 */
function calculateHealthTrend(recentChecks: any[]): any {
  if (recentChecks.length < 2) {
    return {
      trend: 'insufficient_data',
      direction: 'stable',
      confidence: 0
    };
  }
  
  const successfulChecks = recentChecks.filter(check => check.status === 'success');
  const currentSuccessRate = successfulChecks.length / recentChecks.length;
  
  // Compare recent vs older checks
  const recentHalf = recentChecks.slice(0, Math.floor(recentChecks.length / 2));
  const olderHalf = recentChecks.slice(Math.floor(recentChecks.length / 2));
  
  const recentSuccess = recentHalf.filter(c => c.status === 'success').length / recentHalf.length;
  const olderSuccess = olderHalf.filter(c => c.status === 'success').length / olderHalf.length;
  
  let direction = 'stable';
  let confidence = 0.5;
  
  if (recentSuccess > olderSuccess * 1.1) {
    direction = 'improving';
    confidence = Math.min((recentSuccess - olderSuccess) * 2, 1);
  } else if (recentSuccess < olderSuccess * 0.9) {
    direction = 'declining';
    confidence = Math.min((olderSuccess - recentSuccess) * 2, 1);
  }
  
  return {
    trend: direction,
    direction,
    confidence: Math.round(confidence * 100) / 100,
    currentSuccessRate: Math.round(currentSuccessRate * 100) / 100,
    checksAnalyzed: recentChecks.length
  };
}

/**
 * Get status indicator for account
 */
function getStatusIndicator(status: string, consecutiveFailures: number): {
  color: string;
  label: string;
  severity: string;
} {
  switch (status) {
    case 'OK':
      return {
        color: 'green',
        label: 'Healthy',
        severity: 'none'
      };
    case 'CREDENTIALS':
      return {
        color: 'yellow',
        label: 'Auth Required',
        severity: 'medium'
      };
    case 'ERROR':
      return {
        color: consecutiveFailures >= 5 ? 'red' : 'orange',
        label: consecutiveFailures >= 5 ? 'Critical Error' : 'Error',
        severity: consecutiveFailures >= 5 ? 'high' : 'medium'
      };
    case 'TIMEOUT':
      return {
        color: 'orange',
        label: 'Timeout',
        severity: 'medium'
      };
    default:
      return {
        color: 'gray',
        label: 'Unknown',
        severity: 'low'
      };
  }
}

/**
 * Get priority level for alert
 */
function getPriorityLevel(severity: string): number {
  switch (severity) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 1;
  }
}

/**
 * Generate dashboard recommendations
 */
function generateDashboardRecommendations(
  summary: any,
  accounts: any[],
  alerts: any[]
): string[] {
  const recommendations = [];
  
  // Overall system health
  if (summary.connectivity_percentage < 80) {
    recommendations.push('⚠️ System connectivity below 80% - immediate attention required');
  } else if (summary.connectivity_percentage < 90) {
    recommendations.push('📊 System connectivity could be improved - review account statuses');
  }
  
  // Active alerts
  if (alerts.length > 0) {
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    const highAlerts = alerts.filter(a => a.severity === 'high');
    
    if (criticalAlerts.length > 0) {
      recommendations.push(`🚨 ${criticalAlerts.length} critical toastError(s) require immediate action`);
    }
    
    if (highAlerts.length > 0) {
      recommendations.push(`⚡ ${highAlerts.length} high-priority toastError(s) need attention`);
    }
  }
  
  // Account-specific issues
  const credentialIssues = accounts.filter(a => a.current_status === 'CREDENTIALS');
  if (credentialIssues.length > 0) {
    recommendations.push(`🔑 ${credentialIssues.length} account(s) need re-authentication`);
  }
  
  const errorAccounts = accounts.filter(a => a.current_status === 'ERROR');
  if (errorAccounts.length > 0) {
    recommendations.push(`❌ ${errorAccounts.length} account(s) experiencing errors`);
  }
  
  // Performance issues
  const highResponseTimeAccounts = accounts.filter(a => 
    a.average_response_time_ms && a.average_response_time_ms > 3000
  );
  if (highResponseTimeAccounts.length > 0) {
    recommendations.push(`⏱️ ${highResponseTimeAccounts.length} account(s) showing slow response times`);
  }
  
  // Success rate issues
  const lowSuccessRateAccounts = accounts.filter(a => 
    a.success_rate && a.success_rate < 90
  );
  if (lowSuccessRateAccounts.length > 0) {
    recommendations.push(`📉 ${lowSuccessRateAccounts.length} account(s) have success rates below 90%`);
  }
  
  // Positive status
  if (recommendations.length === 0) {
    recommendations.push('✅ All systems operational - no action required');
    recommendations.push('💡 Consider running a comprehensive health check for detailed insights');
  }
  
  return recommendations;
}
