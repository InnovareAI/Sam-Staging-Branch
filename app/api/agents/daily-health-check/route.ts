/**
 * Daily System Health Check Agent
 * Runs automated checks and uses Claude to analyze system health
 *
 * Trigger: Netlify scheduled functions daily at 6 AM UTC
 * POST /api/agents/daily-health-check
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
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

interface AutoFixResult {
  issue: string;
  attempted: boolean;
  success: boolean;
  count?: number;
  error?: string;
  details: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🔍 Starting daily system health check with auto-fix...');

  const supabase = pool;
  const checks: HealthCheckResult[] = [];
  const autoFixes: AutoFixResult[] = [];

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

    // AUTO-FIX: Stuck queue items
    if (queueCheck.metrics?.stuck_count > 0) {
      console.log(`🔧 Auto-fixing ${queueCheck.metrics.stuck_count} stuck queue items...`);
      const fix = await autoFixStuckQueue(supabase);
      autoFixes.push(fix);
    }

    // 4. Unipile Account Health
    const unipileCheck = await checkUnipileHealth(supabase);
    checks.push(unipileCheck);

    // 5. Error Rate Check
    const errorCheck = await checkErrorRate(supabase);
    checks.push(errorCheck);

    // 6. Stale Data Check
    const staleCheck = await checkStaleData(supabase);
    checks.push(staleCheck);

    // AUTO-FIX: Stale prospects and campaigns
    if (staleCheck.metrics?.stale_prospects > 0 || staleCheck.metrics?.stale_campaigns > 0) {
      console.log(`🔧 Auto-fixing stale data (${staleCheck.metrics.stale_prospects} prospects, ${staleCheck.metrics.stale_campaigns} campaigns)...`);
      const prospectFix = await autoFixStaleProspects(supabase);
      const campaignFix = await autoFixStaleCampaigns(supabase);
      autoFixes.push(prospectFix, campaignFix);
    }

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
        auto_fixes: autoFixes,
        duration_ms: Date.now() - startTime
      });

    if (insertError) {
      console.error('Failed to store health check:', insertError);
    }

    // Alert if critical issues found
    if (analysis.overall_status === 'critical') {
      await sendCriticalAlert(analysis);
    }

    // Prepare fix summary for notification
    const fixesSummary = autoFixes.length > 0
      ? `\n\n🔧 Auto-fixes applied: ${autoFixes.filter(f => f.success).length}/${autoFixes.length} successful`
      : '';

    const fixDetails = autoFixes.map(f =>
      `${f.success ? '✅' : '❌'} ${f.issue}: ${f.details}`
    ).join('\n');

    // Send Google Chat notification with fix results
    await sendHealthCheckNotification({
      type: 'daily-health-check',
      status: analysis.overall_status,
      summary: analysis.summary + fixesSummary,
      checks: checks.map(c => ({
        name: c.check_name,
        status: c.status,
        details: c.details,
      })),
      recommendations: analysis.recommendations,
      auto_fixes: autoFixes,
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    console.log('✅ Daily health check complete:', {
      status: analysis.overall_status,
      checks_run: checks.length,
      fixes_applied: autoFixes.filter(f => f.success).length,
      duration_ms: Date.now() - startTime
    });

    return NextResponse.json({
      success: true,
      overall_status: analysis.overall_status,
      checks: checks,
      auto_fixes: autoFixes,
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
    // Call Unipile API directly (source of truth for LinkedIn accounts)
    const unipileDsn = process.env.UNIPILE_DSN;
    const unipileApiKey = process.env.UNIPILE_API_KEY;

    if (!unipileDsn || !unipileApiKey) {
      return {
        check_name: 'Unipile/LinkedIn Accounts',
        status: 'warning',
        details: 'Unipile API credentials not configured',
        metrics: { total_accounts: 0, problem_accounts: 0 }
      };
    }

    const response = await fetch(`https://${unipileDsn}/api/v1/accounts`, {
      headers: {
        'X-API-KEY': unipileApiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Unipile API error: ${response.status}`);
    }

    const data = await response.json();
    const allAccounts = Array.isArray(data) ? data : (data.items || data.accounts || []);
    const linkedInAccounts = allAccounts.filter((acc: any) => acc.type === 'LINKEDIN');

    const totalAccounts = linkedInAccounts.length;

    if (totalAccounts === 0) {
      return {
        check_name: 'Unipile/LinkedIn Accounts',
        status: 'healthy',
        details: 'No LinkedIn accounts connected yet',
        metrics: { total_accounts: 0, problem_accounts: 0 }
      };
    }

    // Check for accounts with errors
    const problemAccounts = linkedInAccounts.filter((acc: any) =>
      acc.sources?.some((s: any) => s.status !== 'OK')
    );

    const problemCount = problemAccounts.length;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (problemCount > 2) status = 'critical';
    else if (problemCount > 0) status = 'warning';

    return {
      check_name: 'Unipile/LinkedIn Accounts',
      status,
      details: problemCount > 0
        ? `${problemCount}/${totalAccounts} LinkedIn accounts have connection issues`
        : `All ${totalAccounts} LinkedIn accounts connected`,
      metrics: {
        total_accounts: totalAccounts,
        problem_accounts: problemCount,
        problem_list: problemAccounts.map((a: any) => ({
          name: a.name,
          status: a.sources?.[0]?.status || 'Unknown'
        }))
      }
    };
  } catch (error) {
    return {
      check_name: 'Unipile/LinkedIn Accounts',
      status: 'warning',
      details: `Could not check Unipile accounts: ${error instanceof Error ? error.message : 'Unknown'}`
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

    // Check for prospects stuck in 'pending' or 'approved' for >3 days
    const { data: staleProspects } = await supabase
      .from('campaign_prospects')
      .select('id')
      .in('status', ['pending', 'approved'])
      .lt('updated_at', threeDaysAgo);

    // IMPORTANT: Check how many have pending queue entries (these are NOT truly stale)
    const staleIds = staleProspects?.map((p: any) => p.id) || [];
    let queuedCount = 0;

    if (staleIds.length > 0) {
      const { data: queuedProspects } = await supabase
        .from('send_queue')
        .select('prospect_id')
        .in('prospect_id', staleIds)
        .eq('status', 'pending');

      queuedCount = queuedProspects?.length || 0;
    }

    const staleCampaignCount = staleCampaigns?.length || 0;
    const totalStaleProspects = staleProspects?.length || 0;
    const trulyStaleProspects = totalStaleProspects - queuedCount;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    // Only alert on TRULY stale prospects (not in queue)
    if (staleCampaignCount > 5 || trulyStaleProspects > 100) status = 'critical';
    else if (staleCampaignCount > 0 || trulyStaleProspects > 50) status = 'warning';

    return {
      check_name: 'Stale Data',
      status,
      details: `${staleCampaignCount} stale campaigns, ${trulyStaleProspects} truly stale prospects (${queuedCount} have pending queue - OK)`,
      metrics: {
        stale_campaigns: staleCampaignCount,
        stale_prospects: trulyStaleProspects,
        prospects_in_queue: queuedCount,
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

/**
 * AUTO-FIX: Clear stuck queue items (>1 hour overdue)
 */
async function autoFixStuckQueue(supabase: any): Promise<AutoFixResult> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: stuckItems, error: fetchError } = await supabase
      .from('send_queue')
      .select('id, scheduled_for')
      .eq('status', 'pending')
      .lt('scheduled_for', oneHourAgo);

    if (fetchError) throw fetchError;

    if (!stuckItems || stuckItems.length === 0) {
      return {
        issue: 'Stuck Queue Items',
        attempted: true,
        success: true,
        count: 0,
        details: 'No stuck items found'
      };
    }

    // Mark as failed with explanation
    const { error: updateError } = await supabase
      .from('send_queue')
      .update({
        status: 'failed',
        error_message: 'Auto-failed by health check: stuck >1 hour',
        updated_at: new Date().toISOString()
      })
      .in('id', stuckItems.map((i: any) => i.id));

    if (updateError) throw updateError;

    return {
      issue: 'Stuck Queue Items',
      attempted: true,
      success: true,
      count: stuckItems.length,
      details: `Cleared ${stuckItems.length} stuck queue items`
    };
  } catch (error) {
    return {
      issue: 'Stuck Queue Items',
      attempted: true,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to clear stuck queue items'
    };
  }
}

/**
 * AUTO-FIX: Mark stale prospects as failed (>3 days pending)
 *
 * IMPORTANT: Only marks prospects as failed if they DON'T have pending queue entries.
 * Prospects waiting in queue are legitimately pending and should not be auto-failed.
 *
 * Fix applied: Dec 16, 2025 - Previously this was incorrectly failing prospects
 * that were waiting in the send queue (e.g., Asphericon campaign had 311 prospects
 * auto-failed even though they had pending queue entries).
 */
async function autoFixStaleProspects(supabase: any): Promise<AutoFixResult> {
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    // Get stale prospects (pending or approved for >3 days)
    const { data: staleProspects, error: fetchError } = await supabase
      .from('campaign_prospects')
      .select('id, campaign_id')
      .in('status', ['pending', 'approved']) // Include 'approved' status too
      .lt('updated_at', threeDaysAgo);

    if (fetchError) throw fetchError;

    if (!staleProspects || staleProspects.length === 0) {
      return {
        issue: 'Stale Prospects',
        attempted: true,
        success: true,
        count: 0,
        details: 'No stale prospects found'
      };
    }

    // CRITICAL: Check which prospects have pending queue entries
    // These should NOT be auto-failed - they're legitimately waiting to be sent
    const staleIds = staleProspects.map((p: any) => p.id);

    const { data: queuedProspects } = await supabase
      .from('send_queue')
      .select('prospect_id')
      .in('prospect_id', staleIds)
      .eq('status', 'pending');

    const queuedProspectIds = new Set(queuedProspects?.map((q: any) => q.prospect_id) || []);

    // Filter out prospects that have pending queue entries
    const trulyStaleProspects = staleProspects.filter(
      (p: any) => !queuedProspectIds.has(p.id)
    );

    const skippedCount = staleProspects.length - trulyStaleProspects.length;

    if (trulyStaleProspects.length === 0) {
      return {
        issue: 'Stale Prospects',
        attempted: true,
        success: true,
        count: 0,
        details: `No truly stale prospects found (${skippedCount} have pending queue entries - left alone)`
      };
    }

    // Mark only truly stale prospects as failed
    const { error: updateError } = await supabase
      .from('campaign_prospects')
      .update({
        status: 'failed',
        notes: 'Auto-failed by health check: stale >3 days with no queue entry',
        updated_at: new Date().toISOString()
      })
      .in('id', trulyStaleProspects.map((p: any) => p.id));

    if (updateError) throw updateError;

    return {
      issue: 'Stale Prospects',
      attempted: true,
      success: true,
      count: trulyStaleProspects.length,
      details: `Marked ${trulyStaleProspects.length} stale prospects as failed (${skippedCount} skipped - have pending queue entries)`
    };
  } catch (error) {
    return {
      issue: 'Stale Prospects',
      attempted: true,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to fix stale prospects'
    };
  }
}

/**
 * AUTO-FIX: Pause stale campaigns (>3 days in 'running' status)
 */
async function autoFixStaleCampaigns(supabase: any): Promise<AutoFixResult> {
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: staleCampaigns, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, campaign_name')
      .eq('status', 'running')
      .lt('updated_at', threeDaysAgo);

    if (fetchError) throw fetchError;

    if (!staleCampaigns || staleCampaigns.length === 0) {
      return {
        issue: 'Stale Campaigns',
        attempted: true,
        success: true,
        count: 0,
        details: 'No stale campaigns found'
      };
    }

    // Pause campaigns (safer than marking completed)
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        status: 'paused',
        notes: 'Auto-paused by health check: stale >3 days. Review and resume if needed.',
        updated_at: new Date().toISOString()
      })
      .in('id', staleCampaigns.map((c: any) => c.id));

    if (updateError) throw updateError;

    return {
      issue: 'Stale Campaigns',
      attempted: true,
      success: true,
      count: staleCampaigns.length,
      details: `Paused ${staleCampaigns.length} stale campaigns: ${staleCampaigns.map((c: any) => c.campaign_name).join(', ')}`
    };
  } catch (error) {
    return {
      issue: 'Stale Campaigns',
      attempted: true,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to pause stale campaigns'
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
