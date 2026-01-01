import { pool } from '@/lib/db';
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dataType = searchParams.get('type') || 'overview'

    // Verify superadmin access
    const { data: { user } } = await supabase.auth.getUser()
    const superAdminEmails = ['tl@innovareai.com', 'cl@innovareai.com']
    
    if (!user || !superAdminEmails.includes(user.email || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    switch (dataType) {
      case 'overview':
        return await getOverviewStats(supabase)
      
      case 'conversations':
        return await getConversationAnalytics(supabase)
      
      case 'health':
        return await getSystemHealth(supabase)
      
      case 'deployments':
        return await getDeploymentStats(supabase)
      
      case 'alerts':
        return await getSystemAlerts(supabase)
      
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Superadmin analytics error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}

async function getOverviewStats(supabase: any) {
  // User lifecycle stats
  const { data: users } = await supabase
    .from('users')
    .select('id, created_at, last_sign_in_at, subscription_status, trial_ends_at, cancelled_at')
  
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  
  const signups = users?.filter(u => new Date(u.created_at) > sevenDaysAgo) || []
  const trialUsers = users?.filter(u => u.subscription_status === 'trial') || []
  const activeUsers = users?.filter(u => 
    u.last_sign_in_at && 
    new Date(u.last_sign_in_at) > thirtyDaysAgo &&
    u.subscription_status !== 'cancelled'
  ) || []
  const cancelledUsers = users?.filter(u => u.subscription_status === 'cancelled') || []

  // Workspace stats
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, created_at')
  
  // Conversation stats
  const { data: conversations } = await supabase
    .from('sam_conversation_threads')
    .select('id, created_at')
    .gte('created_at', thirtyDaysAgo.toISOString())
  
  // System health
  const { data: healthLogs } = await supabase
    .from('system_health_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  
  const avgResponseTime = healthLogs?.length 
    ? healthLogs.reduce((sum, log) => sum + (log.response_time_ms || 0), 0) / healthLogs.length
    : 0

  return NextResponse.json({
    success: true,
    data: {
      users: {
        total: users?.length || 0,
        signups: signups.length,
        trial: trialUsers.length,
        active: activeUsers.length,
        cancelled: cancelledUsers.length
      },
      workspaces: {
        total: workspaces?.length || 0
      },
      conversations: {
        total: conversations?.length || 0,
        last30Days: conversations?.length || 0
      },
      system: {
        avgResponseTime: Math.round(avgResponseTime),
        health: healthLogs?.[0]?.status || 'healthy'
      }
    }
  })
}

async function getConversationAnalytics(supabase: any) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  
  const { data: analytics } = await supabase
    .from('conversation_analytics')
    .select('*')
    .gte('created_at', thirtyDaysAgo.toISOString())
  
  // Aggregate by persona
  const personaBreakdown = analytics?.reduce((acc: any, item: any) => {
    const persona = item.persona_used || 'unknown'
    acc[persona] = (acc[persona] || 0) + 1
    return acc
  }, {})
  
  // Aggregate by industry
  const industryBreakdown = analytics?.reduce((acc: any, item: any) => {
    const industry = item.industry || 'unknown'
    acc[industry] = (acc[industry] || 0) + 1
    return acc
  }, {})
  
  // Calculate metrics
  const totalConversations = analytics?.length || 0
  const uniqueUsers = new Set(analytics?.map((a: any) => a.user_id)).size
  const avgDuration = analytics?.length
    ? analytics.reduce((sum: number, a: any) => sum + (a.duration_seconds || 0), 0) / analytics.length
    : 0
  const completedCount = analytics?.filter((a: any) => a.completion_status === 'completed').length || 0
  const successRate = totalConversations > 0 ? (completedCount / totalConversations) * 100 : 0

  return NextResponse.json({
    success: true,
    data: {
      totalConversations,
      uniqueUsers,
      avgDurationSeconds: Math.round(avgDuration),
      successRate: Math.round(successRate),
      personaBreakdown,
      industryBreakdown
    }
  })
}

async function getSystemHealth(supabase: any) {
  // Recent health logs
  const { data: healthLogs } = await supabase
    .from('system_health_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  
  // QA auto-fixes
  const { data: qaLogs } = await supabase
    .from('qa_autofix_logs')
    .select('*')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
  
  // Component health summary
  const componentHealth: any = {}
  const components = ['database', 'api', 'storage', 'memory']
  
  for (const component of components) {
    const logs = healthLogs?.filter(l => l.component === component).slice(0, 10) || []
    const avgResponseTime = logs.length 
      ? logs.reduce((sum, log) => sum + (log.response_time_ms || 0), 0) / logs.length
      : 0
    
    componentHealth[component] = {
      status: logs[0]?.status || 'healthy',
      responseTime: Math.round(avgResponseTime),
      lastCheck: logs[0]?.created_at
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      componentHealth,
      qaAutoFixes: {
        total: qaLogs?.length || 0,
        successful: qaLogs?.filter(l => l.fix_status === 'success').length || 0,
        failed: qaLogs?.filter(l => l.fix_status === 'failed').length || 0
      },
      recentLogs: healthLogs?.slice(0, 10)
    }
  })
}

async function getDeploymentStats(supabase: any) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  
  const { data: deployments } = await supabase
    .from('deployment_logs')
    .select('*')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })
  
  const totalDeployments = deployments?.length || 0
  const successfulDeployments = deployments?.filter(d => d.status === 'success').length || 0
  const failedDeployments = deployments?.filter(d => d.status === 'failed').length || 0
  const avgDuration = deployments?.length
    ? deployments.reduce((sum, d) => sum + (d.duration_seconds || 0), 0) / deployments.length
    : 0

  return NextResponse.json({
    success: true,
    data: {
      totalDeployments,
      successfulDeployments,
      failedDeployments,
      successRate: totalDeployments > 0 ? (successfulDeployments / totalDeployments) * 100 : 0,
      avgDurationSeconds: Math.round(avgDuration),
      recentDeployments: deployments?.slice(0, 10)
    }
  })
}

async function getSystemAlerts(supabase: any) {
  const { data: alerts } = await supabase
    .from('system_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  
  const unresolvedAlerts = alerts?.filter(a => !a.resolved) || []
  const criticalAlerts = unresolvedAlerts.filter(a => a.alert_type === 'critical')
  const warningAlerts = unresolvedAlerts.filter(a => a.alert_type === 'warning')

  return NextResponse.json({
    success: true,
    data: {
      total: alerts?.length || 0,
      unresolved: unresolvedAlerts.length,
      critical: criticalAlerts.length,
      warnings: warningAlerts.length,
      recentAlerts: alerts?.slice(0, 10)
    }
  })
}
