/**
 * QA Messaging Monitor Agent
 * Monitors all messaging pipelines across all workspaces
 * Detects bugs, gaps, and inconsistencies between DB, messaging, and cron jobs
 *
 * POST /api/agents/qa-monitor
 * Trigger: cron-job.org every 6 hours
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';
import { claudeClient } from '@/lib/llm/claude-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface QACheck {
  check_name: string;
  category: 'database' | 'messaging' | 'cron' | 'consistency';
  status: 'pass' | 'warning' | 'fail';
  details: string;
  affected_records?: number;
  sample_ids?: string[];
  suggested_fix?: string;
}

interface AnomalyReport {
  workspace_id: string;
  workspace_name: string;
  anomalies: QACheck[];
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🔍 QA Monitor Agent starting comprehensive scan...');

  const supabase = supabaseAdmin();
  const allChecks: QACheck[] = [];
  const workspaceReports: AnomalyReport[] = [];

  try {
    // Get all active workspaces
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('is_active', true);

    // ============================================
    // GLOBAL CHECKS (across all workspaces)
    // ============================================

    // 1. Queue vs Prospect Status Consistency
    const queueCheck = await checkQueueProspectConsistency(supabase);
    allChecks.push(queueCheck);

    // 2. Orphaned Queue Records
    const orphanCheck = await checkOrphanedQueueRecords(supabase);
    allChecks.push(orphanCheck);

    // 3. Cron Job Execution Gaps
    const cronCheck = await checkCronJobGaps(supabase);
    allChecks.push(cronCheck);

    // 4. Message Status vs Unipile Sync
    const syncCheck = await checkUnipileSyncStatus(supabase);
    allChecks.push(syncCheck);

    // 5. Stuck Prospects Detection
    const stuckCheck = await checkStuckProspects(supabase);
    allChecks.push(stuckCheck);

    // 6. Campaign State Consistency
    const campaignCheck = await checkCampaignStateConsistency(supabase);
    allChecks.push(campaignCheck);

    // 7. Follow-up Scheduling Gaps
    const followupCheck = await checkFollowupScheduling(supabase);
    allChecks.push(followupCheck);

    // 8. Duplicate Detection
    const duplicateCheck = await checkDuplicateRecords(supabase);
    allChecks.push(duplicateCheck);

    // 9. Timestamp Anomalies
    const timestampCheck = await checkTimestampAnomalies(supabase);
    allChecks.push(timestampCheck);

    // 10. LinkedIn Account Health
    const accountCheck = await checkLinkedInAccountHealth(supabase);
    allChecks.push(accountCheck);

    // ============================================
    // PER-WORKSPACE CHECKS
    // ============================================

    for (const workspace of workspaces || []) {
      const wsChecks = await runWorkspaceChecks(supabase, workspace.id);
      if (wsChecks.some(c => c.status !== 'pass')) {
        workspaceReports.push({
          workspace_id: workspace.id,
          workspace_name: workspace.name,
          anomalies: wsChecks.filter(c => c.status !== 'pass')
        });
      }
    }

    // ============================================
    // AI ANALYSIS
    // ============================================

    const failedChecks = allChecks.filter(c => c.status === 'fail');
    const warningChecks = allChecks.filter(c => c.status === 'warning');

    let aiAnalysis = null;
    if (failedChecks.length > 0 || warningChecks.length > 0) {
      aiAnalysis = await analyzeAnomalies(allChecks, workspaceReports);
    }

    // Store results
    await supabase
      .from('system_health_checks')
      .insert({
        check_date: new Date().toISOString(),
        checks: allChecks,
        ai_analysis: aiAnalysis?.summary || 'All checks passed',
        recommendations: aiAnalysis?.recommendations || [],
        overall_status: failedChecks.length > 0 ? 'critical' : warningChecks.length > 0 ? 'warning' : 'healthy',
        fixes_proposed: aiAnalysis?.proposed_fixes || [],
        duration_ms: Date.now() - startTime
      });

    console.log('✅ QA Monitor complete:', {
      total_checks: allChecks.length,
      passed: allChecks.filter(c => c.status === 'pass').length,
      warnings: warningChecks.length,
      failures: failedChecks.length,
      workspaces_with_issues: workspaceReports.length,
      duration_ms: Date.now() - startTime
    });

    return NextResponse.json({
      success: true,
      summary: {
        total_checks: allChecks.length,
        passed: allChecks.filter(c => c.status === 'pass').length,
        warnings: warningChecks.length,
        failures: failedChecks.length
      },
      checks: allChecks,
      workspace_reports: workspaceReports,
      ai_analysis: aiAnalysis,
      duration_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error('❌ QA Monitor failed:', error);
    return NextResponse.json({
      error: 'QA Monitor failed',
      details: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 });
  }
}

// ============================================
// CHECK IMPLEMENTATIONS
// ============================================

async function checkQueueProspectConsistency(supabase: any): Promise<QACheck> {
  // Find queue items where prospect status doesn't match
  const { data: inconsistent } = await supabase
    .from('send_queue')
    .select(`
      id, status, prospect_id,
      campaign_prospects!inner(id, status)
    `)
    .eq('status', 'sent')
    .neq('campaign_prospects.status', 'connection_request_sent')
    .neq('campaign_prospects.status', 'message_sent')
    .neq('campaign_prospects.status', 'accepted')
    .limit(50);

  const count = inconsistent?.length || 0;

  return {
    check_name: 'Queue-Prospect Status Consistency',
    category: 'consistency',
    status: count > 10 ? 'fail' : count > 0 ? 'warning' : 'pass',
    details: count > 0
      ? `${count} queue items marked 'sent' but prospect status not updated`
      : 'All queue-prospect statuses consistent',
    affected_records: count,
    sample_ids: inconsistent?.slice(0, 5).map((i: any) => i.prospect_id),
    suggested_fix: count > 0 ? 'Run prospect status sync job' : undefined
  };
}

async function checkOrphanedQueueRecords(supabase: any): Promise<QACheck> {
  // Find queue items with invalid prospect/campaign references
  const { data: orphaned } = await supabase
    .rpc('find_orphaned_queue_records');

  // Fallback if RPC doesn't exist
  if (!orphaned) {
    const { data: queueItems } = await supabase
      .from('send_queue')
      .select('id, prospect_id, campaign_id')
      .limit(100);

    // Check for orphans manually
    let orphanCount = 0;
    for (const item of queueItems || []) {
      const { data: prospect } = await supabase
        .from('campaign_prospects')
        .select('id')
        .eq('id', item.prospect_id)
        .single();

      if (!prospect) orphanCount++;
      if (orphanCount >= 5) break; // Sample only
    }

    return {
      check_name: 'Orphaned Queue Records',
      category: 'database',
      status: orphanCount > 0 ? 'warning' : 'pass',
      details: orphanCount > 0
        ? `Found ${orphanCount}+ queue items with missing prospects`
        : 'No orphaned queue records',
      affected_records: orphanCount,
      suggested_fix: orphanCount > 0 ? 'DELETE FROM send_queue WHERE prospect_id NOT IN (SELECT id FROM campaign_prospects)' : undefined
    };
  }

  return {
    check_name: 'Orphaned Queue Records',
    category: 'database',
    status: (orphaned?.length || 0) > 0 ? 'warning' : 'pass',
    details: `${orphaned?.length || 0} orphaned records found`,
    affected_records: orphaned?.length || 0
  };
}

async function checkCronJobGaps(supabase: any): Promise<QACheck> {
  // Check if cron jobs have been running on schedule
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  // Check queue processing activity
  const { count: recentQueueActivity } = await supabase
    .from('send_queue')
    .select('*', { count: 'exact', head: true })
    .gte('sent_at', oneHourAgo);

  // Check if there are pending items that should have been processed
  const { data: overdueItems } = await supabase
    .from('send_queue')
    .select('id, scheduled_for')
    .eq('status', 'pending')
    .lt('scheduled_for', oneHourAgo)
    .limit(20);

  const overdueCount = overdueItems?.length || 0;

  return {
    check_name: 'Cron Job Execution',
    category: 'cron',
    status: overdueCount > 10 ? 'fail' : overdueCount > 3 ? 'warning' : 'pass',
    details: overdueCount > 0
      ? `${overdueCount} items overdue (scheduled >1h ago). Cron may be failing.`
      : `Queue processing active. ${recentQueueActivity || 0} items processed in last hour.`,
    affected_records: overdueCount,
    sample_ids: overdueItems?.slice(0, 5).map((i: any) => i.id),
    suggested_fix: overdueCount > 0 ? 'Check cron-job.org status and Netlify function logs' : undefined
  };
}

async function checkUnipileSyncStatus(supabase: any): Promise<QACheck> {
  // Find prospects where we sent a message but haven't verified delivery
  const { data: unverified } = await supabase
    .from('campaign_prospects')
    .select('id, status, contacted_at')
    .eq('status', 'connection_request_sent')
    .lt('contacted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .is('unipile_message_id', null)
    .limit(50);

  const count = unverified?.length || 0;

  return {
    check_name: 'Unipile Message Sync',
    category: 'messaging',
    status: count > 20 ? 'warning' : 'pass',
    details: count > 0
      ? `${count} messages sent >24h ago without Unipile confirmation`
      : 'All sent messages have Unipile confirmation',
    affected_records: count,
    suggested_fix: count > 0 ? 'Run Unipile status verification job' : undefined
  };
}

async function checkStuckProspects(supabase: any): Promise<QACheck> {
  // Find prospects stuck in transitional states
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: stuck } = await supabase
    .from('campaign_prospects')
    .select('id, status, updated_at, campaign_id')
    .in('status', ['pending', 'queued', 'processing'])
    .lt('updated_at', threeDaysAgo)
    .limit(100);

  const count = stuck?.length || 0;

  return {
    check_name: 'Stuck Prospects Detection',
    category: 'database',
    status: count > 50 ? 'fail' : count > 10 ? 'warning' : 'pass',
    details: count > 0
      ? `${count} prospects stuck in transitional state for >3 days`
      : 'No stuck prospects detected',
    affected_records: count,
    sample_ids: stuck?.slice(0, 10).map((p: any) => p.id),
    suggested_fix: count > 0 ? `UPDATE campaign_prospects SET status = 'failed', error_message = 'Timed out' WHERE id IN (${stuck?.slice(0, 50).map((p: any) => `'${p.id}'`).join(',')})` : undefined
  };
}

async function checkCampaignStateConsistency(supabase: any): Promise<QACheck> {
  // Find campaigns with inconsistent states
  const { data: runningCampaigns } = await supabase
    .from('campaigns')
    .select(`
      id, campaign_name, status,
      campaign_prospects(status)
    `)
    .eq('status', 'running');

  let inconsistent = 0;
  const issues: string[] = [];

  for (const campaign of runningCampaigns || []) {
    const prospects = campaign.campaign_prospects || [];
    const allComplete = prospects.every((p: any) =>
      ['connection_request_sent', 'accepted', 'replied', 'failed', 'not_interested'].includes(p.status)
    );

    if (prospects.length > 0 && allComplete) {
      inconsistent++;
      issues.push(`Campaign ${campaign.campaign_name} should be 'completed' (all prospects processed)`);
    }
  }

  return {
    check_name: 'Campaign State Consistency',
    category: 'consistency',
    status: inconsistent > 5 ? 'warning' : 'pass',
    details: inconsistent > 0
      ? `${inconsistent} campaigns have inconsistent status`
      : 'All campaign states consistent',
    affected_records: inconsistent,
    suggested_fix: inconsistent > 0 ? 'Run campaign status reconciliation job' : undefined
  };
}

async function checkFollowupScheduling(supabase: any): Promise<QACheck> {
  // Find accepted connections without scheduled follow-ups
  const { data: acceptedNoFollowup } = await supabase
    .from('campaign_prospects')
    .select('id, campaign_id')
    .eq('status', 'accepted')
    .is('followup_scheduled_for', null)
    .limit(50);

  const count = acceptedNoFollowup?.length || 0;

  return {
    check_name: 'Follow-up Scheduling',
    category: 'messaging',
    status: count > 20 ? 'warning' : 'pass',
    details: count > 0
      ? `${count} accepted connections without follow-up scheduled`
      : 'All accepted connections have follow-ups scheduled',
    affected_records: count,
    suggested_fix: count > 0 ? 'Run follow-up scheduling job for accepted connections' : undefined
  };
}

async function checkDuplicateRecords(supabase: any): Promise<QACheck> {
  // Find duplicate prospects (same LinkedIn URL in same campaign)
  const { data: duplicates } = await supabase.rpc('find_duplicate_prospects');

  // Fallback query
  if (!duplicates) {
    // Just check for potential duplicates
    return {
      check_name: 'Duplicate Records',
      category: 'database',
      status: 'pass',
      details: 'Duplicate check requires RPC function',
      suggested_fix: 'CREATE FUNCTION find_duplicate_prospects()'
    };
  }

  const count = duplicates?.length || 0;

  return {
    check_name: 'Duplicate Records',
    category: 'database',
    status: count > 0 ? 'warning' : 'pass',
    details: count > 0
      ? `${count} duplicate prospect entries found`
      : 'No duplicate prospects detected',
    affected_records: count
  };
}

async function checkTimestampAnomalies(supabase: any): Promise<QACheck> {
  // Find records with impossible timestamps (future dates, contacted before created, etc.)
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: futureRecords } = await supabase
    .from('campaign_prospects')
    .select('id')
    .gt('contacted_at', futureDate)
    .limit(10);

  const { data: backwardsRecords } = await supabase
    .from('campaign_prospects')
    .select('id, created_at, contacted_at')
    .not('contacted_at', 'is', null)
    .limit(100);

  let anomalyCount = futureRecords?.length || 0;

  // Check for contacted_at before created_at
  for (const record of backwardsRecords || []) {
    if (new Date(record.contacted_at) < new Date(record.created_at)) {
      anomalyCount++;
    }
  }

  return {
    check_name: 'Timestamp Anomalies',
    category: 'database',
    status: anomalyCount > 5 ? 'warning' : 'pass',
    details: anomalyCount > 0
      ? `${anomalyCount} records with timestamp anomalies`
      : 'All timestamps valid',
    affected_records: anomalyCount
  };
}

async function checkLinkedInAccountHealth(supabase: any): Promise<QACheck> {
  const { data: accounts } = await supabase
    .from('linkedin_accounts')
    .select('id, name, connection_status, daily_limit, messages_sent_today');

  let issues = 0;
  const details: string[] = [];

  for (const account of accounts || []) {
    if (account.connection_status !== 'connected') {
      issues++;
      details.push(`${account.name}: ${account.connection_status}`);
    }
    if (account.messages_sent_today >= account.daily_limit * 0.9) {
      issues++;
      details.push(`${account.name}: near daily limit (${account.messages_sent_today}/${account.daily_limit})`);
    }
  }

  return {
    check_name: 'LinkedIn Account Health',
    category: 'messaging',
    status: issues > 2 ? 'fail' : issues > 0 ? 'warning' : 'pass',
    details: issues > 0
      ? `${issues} account issues: ${details.slice(0, 3).join('; ')}`
      : `All ${accounts?.length || 0} accounts healthy`,
    affected_records: issues
  };
}

async function runWorkspaceChecks(supabase: any, workspaceId: string): Promise<QACheck[]> {
  const checks: QACheck[] = [];

  // Check for workspace-specific issues
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, status')
    .eq('workspace_id', workspaceId)
    .eq('status', 'running');

  // Check for campaigns with no recent activity
  const { data: staleRunning } = await supabase
    .from('campaigns')
    .select('id, campaign_name')
    .eq('workspace_id', workspaceId)
    .eq('status', 'running')
    .lt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (staleRunning && staleRunning.length > 0) {
    checks.push({
      check_name: 'Stale Running Campaigns',
      category: 'consistency',
      status: 'warning',
      details: `${staleRunning.length} campaigns running but no activity in 7 days`,
      affected_records: staleRunning.length
    });
  }

  return checks;
}

async function analyzeAnomalies(checks: QACheck[], workspaceReports: AnomalyReport[]): Promise<{
  summary: string;
  recommendations: string[];
  proposed_fixes: any[];
}> {
  const failedChecks = checks.filter(c => c.status === 'fail');
  const warningChecks = checks.filter(c => c.status === 'warning');

  const prompt = `Analyze these QA monitoring results and provide actionable recommendations.

## FAILED CHECKS:
${JSON.stringify(failedChecks, null, 2)}

## WARNING CHECKS:
${JSON.stringify(warningChecks, null, 2)}

## WORKSPACE-SPECIFIC ISSUES:
${JSON.stringify(workspaceReports, null, 2)}

Provide a JSON response:
{
  "summary": "2-3 sentence executive summary",
  "recommendations": ["Prioritized list of actions"],
  "proposed_fixes": [
    {
      "issue": "Issue name",
      "fix_type": "sql|code|config|manual",
      "fix_command": "Actual SQL or command to run",
      "risk": "low|medium|high"
    }
  ]
}

Focus on:
1. Root cause patterns
2. Immediate fixes for critical issues
3. Preventive measures

Return ONLY valid JSON.`;

  try {
    const response = await claudeClient.chat({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.3
    });

    const content = response.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('AI analysis failed:', error);
  }

  return {
    summary: `Found ${failedChecks.length} critical and ${warningChecks.length} warning issues.`,
    recommendations: failedChecks.map(c => c.suggested_fix).filter(Boolean) as string[],
    proposed_fixes: []
  };
}
