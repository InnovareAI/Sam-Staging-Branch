/**
 * Daily System Health Check Agent
 * Runs automated checks and uses Claude to analyze system health
 *
 * Trigger: Netlify scheduled functions daily at 6 AM UTC
 * POST /api/agents/daily-health-check
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';
import { claudeClient } from '@/lib/llm/claude-client';
import { sendHealthCheckNotification } from '@/lib/notifications/google-chat';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

interface HealthCheckResult {
  check_name: string;
  status: 'healthy' | 'warning' | 'critical';
  details: string;
  metrics?: Record<string, any>;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🔍 Starting daily system health check...');

  const supabase = supabaseAdmin();
  const checks: HealthCheckResult[] = [];

  try {
    // 1. Database Connection Check
    const dbCheck = await checkDatabaseHealth(supabase);
    checks.push(dbCheck);

    // 2. Campaign Execution Check (last 24h)
    const campaignCheck = await checkCampaignHealth(supabase);
    checks.push(campaignCheck);

    // 3. Queue Processing Check
    const queueCheck = await checkQueueHealth(supabase);
    checks.push(queueCheck);

    // 4. Unipile Account Health
    const unipileCheck = await checkUnipileHealth(supabase);
    checks.push(unipileCheck);

    // 5. Error Rate Check
    const errorCheck = await checkErrorRate(supabase);
    checks.push(errorCheck);

    // 6. Stale Data Check
    const staleCheck = await checkStaleData(supabase);
    checks.push(staleCheck);

    // Use Claude to analyze findings and generate report
    const analysis = await analyzeWithClaude(checks);

    // Store health check results
    const { error: insertError } = await supabase
      .from('system_health_checks')
      .insert({
        check_date: new Date().toISOString(),
        checks: checks,
        ai_analysis: analysis.summary,
        recommendations: analysis.recommendations,
        overall_status: analysis.overall_status,
        duration_ms: Date.now() - startTime
      });

    if (insertError) {
      console.error('Failed to store health check:', insertError);
    }

    // Alert if critical issues found
    if (analysis.overall_status === 'critical') {
      await sendCriticalAlert(analysis);
    }

    // Send Google Chat notification
    await sendHealthCheckNotification({
      type: 'daily-health-check',
      status: analysis.overall_status,
      summary: analysis.summary,
      checks: checks.map(c => ({
        name: c.check_name,
        status: c.status,
        details: c.details,
      })),
      recommendations: analysis.recommendations,
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    console.log('✅ Daily health check complete:', {
      status: analysis.overall_status,
      checks_run: checks.length,
      duration_ms: Date.now() - startTime
    });

    return NextResponse.json({
      success: true,
      overall_status: analysis.overall_status,
      checks: checks,
      ai_analysis: analysis.summary,
      recommendations: analysis.recommendations,
      duration_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error('❌ Health check failed:', error);
    return NextResponse.json({
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function checkDatabaseHealth(supabase: any): Promise<HealthCheckResult> {
  try {
    const start = Date.now();
    const { count, error } = await supabase
      .from('workspaces')
      .select('*', { count: 'exact', head: true });

    const latency = Date.now() - start;

    if (error) {
      return {
        check_name: 'Database Connection',
        status: 'critical',
        details: `Database error: ${error.message}`,
        metrics: { latency_ms: latency }
      };
    }

    return {
      check_name: 'Database Connection',
      status: latency < 500 ? 'healthy' : 'warning',
      details: `Connected. Query latency: ${latency}ms`,
      metrics: { latency_ms: latency, workspace_count: count }
    };
  } catch (error) {
    return {
      check_name: 'Database Connection',
      status: 'critical',
      details: `Connection failed: ${error instanceof Error ? error.message : 'Unknown'}`
    };
  }
}

async function checkCampaignHealth(supabase: any): Promise<HealthCheckResult> {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get campaign execution stats for last 24h
    const { data: prospects, error } = await supabase
      .from('campaign_prospects')
      .select('status, contacted_at')
      .gte('contacted_at', yesterday);

    if (error) throw error;

    const total = prospects?.length || 0;
    const sent = prospects?.filter((p: any) =>
      ['connection_request_sent', 'message_sent', 'accepted'].includes(p.status)
    ).length || 0;
    const failed = prospects?.filter((p: any) =>
      p.status === 'failed'
    ).length || 0;

    const successRate = total > 0 ? ((sent / total) * 100).toFixed(1) : 'N/A';
    const failureRate = total > 0 ? ((failed / total) * 100).toFixed(1) : '0';

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (parseFloat(failureRate as string) > 20) status = 'critical';
    else if (parseFloat(failureRate as string) > 10) status = 'warning';

    return {
      check_name: 'Campaign Execution (24h)',
      status,
      details: `${total} prospects processed. Success: ${successRate}%, Failures: ${failureRate}%`,
      metrics: { total, sent, failed, success_rate: successRate, failure_rate: failureRate }
    };
  } catch (error) {
    return {
      check_name: 'Campaign Execution (24h)',
      status: 'warning',
      details: `Could not fetch stats: ${error instanceof Error ? error.message : 'Unknown'}`
    };
  }
}

async function checkQueueHealth(supabase: any): Promise<HealthCheckResult> {
  try {
    // Check send_queue for stuck items
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: stuckItems, error } = await supabase
      .from('send_queue')
      .select('id, scheduled_for, status')
      .eq('status', 'pending')
      .lt('scheduled_for', oneHourAgo);

    if (error) throw error;

    const stuckCount = stuckItems?.length || 0;

    // Get queue stats
    const { data: queueStats } = await supabase
      .from('send_queue')
      .select('status')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const pending = queueStats?.filter((q: any) => q.status === 'pending').length || 0;
    const sent = queueStats?.filter((q: any) => q.status === 'sent').length || 0;
    const failed = queueStats?.filter((q: any) => q.status === 'failed').length || 0;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (stuckCount > 10) status = 'critical';
    else if (stuckCount > 5) status = 'warning';

    return {
      check_name: 'Message Queue',
      status,
      details: stuckCount > 0
        ? `${stuckCount} stuck items (>1h overdue). 24h: ${sent} sent, ${pending} pending, ${failed} failed`
        : `Queue healthy. 24h: ${sent} sent, ${pending} pending, ${failed} failed`,
      metrics: { stuck_count: stuckCount, pending, sent, failed }
    };
  } catch (error) {
    return {
      check_name: 'Message Queue',
      status: 'warning',
      details: `Could not check queue: ${error instanceof Error ? error.message : 'Unknown'}`
    };
  }
}

async function checkUnipileHealth(supabase: any): Promise<HealthCheckResult> {
  try {
    // Check for accounts with recent errors
    const { data: accounts, error } = await supabase
      .from('linkedin_accounts')
      .select('id, name, connection_status, last_error, updated_at')
      .in('connection_status', ['error', 'disconnected', 'rate_limited']);

    if (error) throw error;

    const problemAccounts = accounts?.length || 0;

    // Get total accounts
    const { count: totalAccounts } = await supabase
      .from('linkedin_accounts')
      .select('*', { count: 'exact', head: true });

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (problemAccounts > 2) status = 'critical';
    else if (problemAccounts > 0) status = 'warning';

    return {
      check_name: 'Unipile/LinkedIn Accounts',
      status,
      details: problemAccounts > 0
        ? `${problemAccounts}/${totalAccounts} accounts have issues`
        : `All ${totalAccounts} accounts healthy`,
      metrics: {
        total_accounts: totalAccounts,
        problem_accounts: problemAccounts,
        problem_list: accounts?.map((a: any) => ({ name: a.name, status: a.connection_status }))
      }
    };
  } catch (error) {
    return {
      check_name: 'Unipile/LinkedIn Accounts',
      status: 'warning',
      details: `Could not check accounts: ${error instanceof Error ? error.message : 'Unknown'}`
    };
  }
}

async function checkErrorRate(supabase: any): Promise<HealthCheckResult> {
  try {
    // Check campaign_replies for error patterns
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: errors } = await supabase
      .from('campaign_prospects')
      .select('error_message')
      .not('error_message', 'is', null)
      .gte('updated_at', yesterday);

    const errorCount = errors?.length || 0;
    const errorTypes: Record<string, number> = {};

    errors?.forEach((e: any) => {
      const msg = e.error_message?.substring(0, 50) || 'Unknown';
      errorTypes[msg] = (errorTypes[msg] || 0) + 1;
    });

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (errorCount > 50) status = 'critical';
    else if (errorCount > 20) status = 'warning';

    return {
      check_name: 'Error Rate (24h)',
      status,
      details: `${errorCount} errors in last 24h`,
      metrics: { error_count: errorCount, error_types: errorTypes }
    };
  } catch (error) {
    return {
      check_name: 'Error Rate (24h)',
      status: 'warning',
      details: `Could not check errors: ${error instanceof Error ? error.message : 'Unknown'}`
    };
  }
}

async function checkStaleData(supabase: any): Promise<HealthCheckResult> {
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    // Check for campaigns stuck in 'running' for >3 days
    const { data: staleCampaigns } = await supabase
      .from('campaigns')
      .select('id, campaign_name, status, updated_at')
      .eq('status', 'running')
      .lt('updated_at', threeDaysAgo);

    // Check for prospects stuck in 'pending' for >3 days
    const { data: staleProspects } = await supabase
      .from('campaign_prospects')
      .select('id')
      .eq('status', 'pending')
      .lt('updated_at', threeDaysAgo);

    const staleCampaignCount = staleCampaigns?.length || 0;
    const staleProspectCount = staleProspects?.length || 0;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (staleCampaignCount > 5 || staleProspectCount > 100) status = 'critical';
    else if (staleCampaignCount > 0 || staleProspectCount > 50) status = 'warning';

    return {
      check_name: 'Stale Data',
      status,
      details: `${staleCampaignCount} stale campaigns, ${staleProspectCount} stale prospects (>3 days)`,
      metrics: {
        stale_campaigns: staleCampaignCount,
        stale_prospects: staleProspectCount,
        stale_campaign_names: staleCampaigns?.map((c: any) => c.campaign_name)
      }
    };
  } catch (error) {
    return {
      check_name: 'Stale Data',
      status: 'warning',
      details: `Could not check stale data: ${error instanceof Error ? error.message : 'Unknown'}`
    };
  }
}

async function analyzeWithClaude(checks: HealthCheckResult[]): Promise<{
  summary: string;
  recommendations: string[];
  overall_status: 'healthy' | 'warning' | 'critical';
}> {
  try {
    const prompt = `Analyze these system health check results and provide a brief summary with recommendations.

HEALTH CHECK RESULTS:
${JSON.stringify(checks, null, 2)}

Provide a JSON response with:
1. summary: A 2-3 sentence executive summary of system health
2. recommendations: Array of 1-5 specific actionable recommendations (empty if all healthy)
3. overall_status: "healthy", "warning", or "critical"

Focus on:
- Any critical issues that need immediate attention
- Patterns that might indicate future problems
- Quick wins to improve reliability

Return ONLY valid JSON.`;

    const response = await claudeClient.chat({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.3
    });

    const content = response.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback: determine status from checks
    const hasCtritical = checks.some(c => c.status === 'critical');
    const hasWarning = checks.some(c => c.status === 'warning');

    return {
      summary: 'Health check completed. See individual results for details.',
      recommendations: [],
      overall_status: hasCtritical ? 'critical' : hasWarning ? 'warning' : 'healthy'
    };
  } catch (error) {
    console.error('Claude analysis failed:', error);

    const hasCtritical = checks.some(c => c.status === 'critical');
    const hasWarning = checks.some(c => c.status === 'warning');

    return {
      summary: 'AI analysis unavailable. Manual review recommended.',
      recommendations: ['Review health check results manually'],
      overall_status: hasCtritical ? 'critical' : hasWarning ? 'warning' : 'healthy'
    };
  }
}

async function sendCriticalAlert(analysis: {
  summary: string;
  recommendations: string[];
  overall_status: string;
}) {
  // TODO: Implement Slack/email notification
  console.error('🚨 CRITICAL SYSTEM ALERT:', {
    summary: analysis.summary,
    recommendations: analysis.recommendations
  });
}
