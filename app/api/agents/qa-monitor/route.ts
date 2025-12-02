/**
 * QA Messaging Monitor Agent
 * Monitors all messaging pipelines across all workspaces
 * Detects bugs, gaps, and inconsistencies between DB, messaging, and cron jobs
 *
 * POST /api/agents/qa-monitor
 * Trigger: Netlify scheduled functions every 6 hours
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';
import { claudeClient } from '@/lib/llm/claude-client';
import { sendHealthCheckNotification } from '@/lib/notifications/google-chat';

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

interface AutoFixResult {
  issue: string;
  attempted: boolean;
  success: boolean;
  count?: number;
  error?: string;
  details: string;
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

  console.log('🔍 QA Monitor Agent starting comprehensive scan with auto-fix...');

  const supabase = supabaseAdmin();
  const allChecks: QACheck[] = [];
  const autoFixes: AutoFixResult[] = [];
  const workspaceReports: AnomalyReport[] = [];

  try {
    // Get ALL active workspaces (not just InnovareAI)
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('is_active', true);

    if (!workspaces || workspaces.length === 0) {
      console.log('No active workspaces found for QA monitoring');
      return NextResponse.json({
        success: true,
        message: 'No active workspaces to monitor'
      });
    }

    console.log(`🔍 QA Monitor scanning ${workspaces.length} active workspaces:`, workspaces.map(w => w.name));

    // ============================================
    // GLOBAL CHECKS (across all workspaces)
    // ============================================

    // 1. Queue vs Prospect Status Consistency
    const queueCheck = await checkQueueProspectConsistency(supabase);
    allChecks.push(queueCheck);

    // 2. Orphaned Queue Records
    const orphanCheck = await checkOrphanedQueueRecords(supabase);
    allChecks.push(orphanCheck);

    // AUTO-FIX: Delete orphaned queue records
    if (orphanCheck.affected_records && orphanCheck.affected_records > 0) {
      console.log(`🔧 Auto-fixing ${orphanCheck.affected_records} orphaned queue records...`);
      const fix = await autoFixOrphanedQueue(supabase);
      autoFixes.push(fix);
    }

    // 3. Cron Job Execution Gaps
    const cronCheck = await checkCronJobGaps(supabase);
    allChecks.push(cronCheck);

    // 4. Message Status vs Unipile Sync
    const syncCheck = await checkUnipileSyncStatus(supabase);
    allChecks.push(syncCheck);

    // 5. Stuck Prospects Detection
    const stuckCheck = await checkStuckProspects(supabase);
    allChecks.push(stuckCheck);

    // AUTO-FIX: Mark stuck prospects as failed
    if (stuckCheck.affected_records && stuckCheck.affected_records > 0) {
      console.log(`🔧 Auto-fixing ${stuckCheck.affected_records} stuck prospects...`);
      const fix = await autoFixStuckProspects(supabase);
      autoFixes.push(fix);
    }

    // 6. Campaign State Consistency
    const campaignCheck = await checkCampaignStateConsistency(supabase);
    allChecks.push(campaignCheck);

    // 7. Follow-up Scheduling Gaps
    const followupCheck = await checkFollowupScheduling(supabase);
    allChecks.push(followupCheck);

    // 7.5. CRITICAL: Same-Day Follow-up Check
    const sameDayCheck = await checkSameDayFollowups(supabase);
    allChecks.push(sameDayCheck);

    // AUTO-FIX: Reschedule same-day followups
    if (sameDayCheck.affected_records && sameDayCheck.affected_records > 0) {
      console.log(`🔧 Auto-fixing ${sameDayCheck.affected_records} same-day followups...`);
      const fix = await autoFixSameDayFollowups(supabase);
      autoFixes.push(fix);
    }

    // 8. Duplicate Detection
    const duplicateCheck = await checkDuplicateRecords(supabase);
    allChecks.push(duplicateCheck);

    // 9. Timestamp Anomalies
    const timestampCheck = await checkTimestampAnomalies(supabase);
    allChecks.push(timestampCheck);

    // 10. LinkedIn Account Health
    const accountCheck = await checkLinkedInAccountHealth(supabase);
    allChecks.push(accountCheck);

    // 11. Status Mismatch Detection (connection_accepted_at set but wrong status)
    const statusMismatchCheck = await checkStatusMismatch(supabase);
    allChecks.push(statusMismatchCheck);

    // AUTO-FIX: Fix status mismatches
    if (statusMismatchCheck.affected_records && statusMismatchCheck.affected_records > 0) {
      console.log(`🔧 Auto-fixing ${statusMismatchCheck.affected_records} status mismatches...`);
      const fix = await autoFixStatusMismatch(supabase);
      autoFixes.push(fix);
    }

    // 12. Stuck Upload Sessions (session counters don't match reality, prospects not transferred)
    const stuckSessionCheck = await checkStuckUploadSessions(supabase);
    allChecks.push(stuckSessionCheck);

    // AUTO-FIX: Fix session counters and transfer missing prospects
    if (stuckSessionCheck.affected_records && stuckSessionCheck.affected_records > 0) {
      console.log(`🔧 Auto-fixing ${stuckSessionCheck.affected_records} stuck upload sessions...`);
      const fix = await autoFixStuckUploadSessions(supabase);
      autoFixes.push(fix);
    }

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
    const overallStatus = failedChecks.length > 0 ? 'critical' : warningChecks.length > 0 ? 'warning' : 'healthy';

    await supabase
      .from('system_health_checks')
      .insert({
        check_date: new Date().toISOString(),
        checks: allChecks,
        ai_analysis: aiAnalysis?.summary || 'All checks passed',
        recommendations: aiAnalysis?.recommendations || [],
        overall_status: overallStatus,
        auto_fixes: autoFixes,
        fixes_proposed: aiAnalysis?.proposed_fixes || [],
        duration_ms: Date.now() - startTime
      });

    // Prepare fix summary for notification
    const fixesSummary = autoFixes.length > 0
      ? `\n\n🔧 Auto-fixes applied: ${autoFixes.filter(f => f.success).length}/${autoFixes.length} successful`
      : '';

    // Send Google Chat notification
    await sendHealthCheckNotification({
      type: 'qa-monitor',
      status: overallStatus as 'healthy' | 'warning' | 'critical',
      summary: (aiAnalysis?.summary || `QA Monitor: ${allChecks.filter(c => c.status === 'pass').length}/${allChecks.length} checks passed`) + fixesSummary,
      checks: allChecks.map(c => ({
        name: c.check_name,
        status: c.status,
        details: c.details,
      })),
      recommendations: aiAnalysis?.recommendations || [],
      auto_fixes: autoFixes,
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    console.log('✅ QA Monitor complete:', {
      total_checks: allChecks.length,
      passed: allChecks.filter(c => c.status === 'pass').length,
      warnings: warningChecks.length,
      failures: failedChecks.length,
      fixes_applied: autoFixes.filter(f => f.success).length,
      workspaces_with_issues: workspaceReports.length,
      duration_ms: Date.now() - startTime
    });

    return NextResponse.json({
      success: true,
      summary: {
        total_checks: allChecks.length,
        passed: allChecks.filter(c => c.status === 'pass').length,
        warnings: warningChecks.length,
        failures: failedChecks.length,
        fixes_applied: autoFixes.filter(f => f.success).length
      },
      checks: allChecks,
      auto_fixes: autoFixes,
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
    suggested_fix: overdueCount > 0 ? 'Check Netlify scheduled functions status and Netlify function logs' : undefined
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

async function checkSameDayFollowups(supabase: any): Promise<QACheck> {
  // CRITICAL: Find prospects with multiple messages scheduled on same day
  // Rule: Follow-ups must NEVER be on the same day as first message
  const { data: sameDayViolations } = await supabase.rpc('find_same_day_followups');

  // Fallback query if RPC doesn't exist
  if (!sameDayViolations) {
    // Check for same-day messages manually
    const { data: queueItems } = await supabase
      .from('send_queue')
      .select('id, campaign_id, prospect_id, scheduled_for, message_type')
      .eq('status', 'pending')
      .order('prospect_id')
      .order('scheduled_for');

    // Group by prospect and check for same-day
    const prospectDates = new Map<string, Set<string>>();
    let violations = 0;
    const violatingProspects: string[] = [];

    for (const item of queueItems || []) {
      const key = `${item.campaign_id}-${item.prospect_id}`;
      const date = new Date(item.scheduled_for).toISOString().split('T')[0];

      if (!prospectDates.has(key)) {
        prospectDates.set(key, new Set());
      }

      const dates = prospectDates.get(key)!;
      if (dates.has(date)) {
        violations++;
        if (!violatingProspects.includes(item.prospect_id)) {
          violatingProspects.push(item.prospect_id);
        }
      }
      dates.add(date);
    }

    return {
      check_name: 'Same-Day Follow-up Check',
      category: 'messaging',
      status: violations > 0 ? 'fail' : 'pass',
      details: violations > 0
        ? `CRITICAL: ${violations} messages scheduled same day as another message for same prospect`
        : 'All follow-ups scheduled on different days',
      affected_records: violations,
      sample_ids: violatingProspects.slice(0, 5),
      suggested_fix: violations > 0
        ? 'UPDATE send_queue SET scheduled_for = scheduled_for + interval \'1 day\' WHERE prospect_id IN (...) AND message_type != \'direct_message_1\''
        : undefined
    };
  }

  return {
    check_name: 'Same-Day Follow-up Check',
    category: 'messaging',
    status: (sameDayViolations?.length || 0) > 0 ? 'fail' : 'pass',
    details: `${sameDayViolations?.length || 0} same-day violations found`,
    affected_records: sameDayViolations?.length || 0
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
  try {
    // Call Unipile API to get LinkedIn accounts (source of truth)
    const unipileDsn = process.env.UNIPILE_DSN;
    const unipileApiKey = process.env.UNIPILE_API_KEY;

    if (!unipileDsn || !unipileApiKey) {
      return {
        check_name: 'LinkedIn Account Health',
        category: 'messaging',
        status: 'warning',
        details: 'Unipile API credentials not configured',
        affected_records: 0
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

    if (linkedInAccounts.length === 0) {
      return {
        check_name: 'LinkedIn Account Health',
        category: 'messaging',
        status: 'pass',
        details: 'No LinkedIn accounts connected yet',
        affected_records: 0
      };
    }

    let issues = 0;
    const details: string[] = [];

    for (const account of linkedInAccounts) {
      // Check for connection issues
      const hasIssue = account.sources?.some((s: any) => s.status !== 'OK');
      if (hasIssue) {
        issues++;
        details.push(`${account.name}: connection issue`);
      }
    }

    return {
      check_name: 'LinkedIn Account Health',
      category: 'messaging',
      status: issues > 2 ? 'fail' : issues > 0 ? 'warning' : 'pass',
      details: issues > 0
        ? `${issues} account issues: ${details.slice(0, 3).join('; ')}`
        : `All ${linkedInAccounts.length} accounts healthy`,
      affected_records: issues
    };
  } catch (error) {
    return {
      check_name: 'LinkedIn Account Health',
      category: 'messaging',
      status: 'warning',
      details: `Could not check account health: ${error instanceof Error ? error.message : 'Unknown'}`,
      affected_records: 0
    };
  }
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

/**
 * AUTO-FIX: Delete orphaned queue records (queue items without valid prospects)
 */
async function autoFixOrphanedQueue(supabase: any): Promise<AutoFixResult> {
  try {
    // Find queue items where prospect_id doesn't exist in campaign_prospects
    const { data: queueItems, error: fetchError } = await supabase
      .from('send_queue')
      .select('id, prospect_id')
      .limit(100);

    if (fetchError) throw fetchError;

    if (!queueItems || queueItems.length === 0) {
      return {
        issue: 'Orphaned Queue Records',
        attempted: true,
        success: true,
        count: 0,
        details: 'No queue items found'
      };
    }

    // Check each one for orphan status
    const orphanIds: string[] = [];
    for (const item of queueItems) {
      const { data: prospect } = await supabase
        .from('campaign_prospects')
        .select('id')
        .eq('id', item.prospect_id)
        .single();

      if (!prospect) {
        orphanIds.push(item.id);
      }

      if (orphanIds.length >= 50) break; // Limit to 50 per run
    }

    if (orphanIds.length === 0) {
      return {
        issue: 'Orphaned Queue Records',
        attempted: true,
        success: true,
        count: 0,
        details: 'No orphaned queue records found'
      };
    }

    // Delete orphaned records
    const { error: deleteError } = await supabase
      .from('send_queue')
      .delete()
      .in('id', orphanIds);

    if (deleteError) throw deleteError;

    return {
      issue: 'Orphaned Queue Records',
      attempted: true,
      success: true,
      count: orphanIds.length,
      details: `Deleted ${orphanIds.length} orphaned queue records`
    };
  } catch (error) {
    return {
      issue: 'Orphaned Queue Records',
      attempted: true,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to delete orphaned queue records'
    };
  }
}

/**
 * AUTO-FIX: Mark stuck prospects as failed (>3 days in transitional states)
 */
async function autoFixStuckProspects(supabase: any): Promise<AutoFixResult> {
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: stuckProspects, error: fetchError } = await supabase
      .from('campaign_prospects')
      .select('id')
      .in('status', ['pending', 'queued', 'processing'])
      .lt('updated_at', threeDaysAgo);

    if (fetchError) throw fetchError;

    if (!stuckProspects || stuckProspects.length === 0) {
      return {
        issue: 'Stuck Prospects',
        attempted: true,
        success: true,
        count: 0,
        details: 'No stuck prospects found'
      };
    }

    // Mark as failed
    const { error: updateError } = await supabase
      .from('campaign_prospects')
      .update({
        status: 'failed',
        error_message: 'Auto-failed by QA monitor: stuck in transitional state >3 days',
        updated_at: new Date().toISOString()
      })
      .in('id', stuckProspects.map((p: any) => p.id));

    if (updateError) throw updateError;

    return {
      issue: 'Stuck Prospects',
      attempted: true,
      success: true,
      count: stuckProspects.length,
      details: `Marked ${stuckProspects.length} stuck prospects as failed`
    };
  } catch (error) {
    return {
      issue: 'Stuck Prospects',
      attempted: true,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to fix stuck prospects'
    };
  }
}

/**
 * CHECK: Status Mismatch Detection
 * Finds prospects where connection_accepted_at is set but status is wrong
 * This bug was discovered Dec 2, 2025 - caused follow-ups to never send
 */
async function checkStatusMismatch(supabase: any): Promise<QACheck> {
  // Find prospects with connection_accepted_at but wrong status
  const { data: mismatched, error } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status, connection_accepted_at')
    .not('connection_accepted_at', 'is', null)
    .eq('status', 'connection_request_sent')
    .limit(50);

  if (error) {
    return {
      check_name: 'Status Mismatch Detection',
      category: 'consistency',
      status: 'warning',
      details: `Error checking: ${error.message}`,
      affected_records: 0
    };
  }

  const count = mismatched?.length || 0;

  // Also check for responded_at set but status not 'replied'
  const { data: replyMismatch } = await supabase
    .from('campaign_prospects')
    .select('id')
    .not('responded_at', 'is', null)
    .neq('status', 'replied')
    .limit(50);

  const replyCount = replyMismatch?.length || 0;
  const totalCount = count + replyCount;

  return {
    check_name: 'Status Mismatch Detection',
    category: 'consistency',
    status: totalCount > 5 ? 'fail' : totalCount > 0 ? 'warning' : 'pass',
    details: totalCount > 0
      ? `${count} prospects with connection_accepted_at but wrong status, ${replyCount} with responded_at but not replied`
      : 'All prospect statuses consistent with timestamps',
    affected_records: totalCount,
    sample_ids: mismatched?.slice(0, 5).map((p: any) => p.id),
    suggested_fix: totalCount > 0 ? 'Run status reconciliation to fix mismatched records' : undefined
  };
}

/**
 * AUTO-FIX: Fix status mismatches
 * Updates prospects where timestamps indicate a state but status is wrong
 */
async function autoFixStatusMismatch(supabase: any): Promise<AutoFixResult> {
  try {
    let fixedCount = 0;

    // Fix 1: connection_accepted_at set but status is still connection_request_sent
    const { data: connectionMismatch, error: err1 } = await supabase
      .from('campaign_prospects')
      .update({
        status: 'connected',
        updated_at: new Date().toISOString()
      })
      .not('connection_accepted_at', 'is', null)
      .eq('status', 'connection_request_sent')
      .select('id');

    if (!err1 && connectionMismatch) {
      fixedCount += connectionMismatch.length;
    }

    // Fix 2: responded_at set but status is not replied
    const { data: replyMismatch, error: err2 } = await supabase
      .from('campaign_prospects')
      .update({
        status: 'replied',
        follow_up_due_at: null, // Stop follow-ups for replied prospects
        updated_at: new Date().toISOString()
      })
      .not('responded_at', 'is', null)
      .neq('status', 'replied')
      .select('id');

    if (!err2 && replyMismatch) {
      fixedCount += replyMismatch.length;
    }

    return {
      issue: 'Status Mismatch',
      attempted: true,
      success: true,
      count: fixedCount,
      details: `Fixed ${fixedCount} prospects with mismatched status/timestamps`
    };
  } catch (error) {
    return {
      issue: 'Status Mismatch',
      attempted: true,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to fix status mismatches'
    };
  }
}

/**
 * AUTO-FIX: Reschedule same-day followups to next day
 */
async function autoFixSameDayFollowups(supabase: any): Promise<AutoFixResult> {
  try {
    // Find prospects with followups scheduled on same day as contact
    const { data: violations, error: fetchError } = await supabase
      .from('send_queue')
      .select(`
        id,
        prospect_id,
        scheduled_for,
        campaign_prospects!inner(contacted_at)
      `)
      .eq('message_type', 'followup')
      .limit(100);

    if (fetchError) throw fetchError;

    if (!violations || violations.length === 0) {
      return {
        issue: 'Same-Day Followups',
        attempted: true,
        success: true,
        count: 0,
        details: 'No same-day followups found'
      };
    }

    // Find violations (same calendar day)
    const violationIds: string[] = [];
    for (const item of violations) {
      const contactDate = new Date(item.campaign_prospects.contacted_at).toDateString();
      const followupDate = new Date(item.scheduled_for).toDateString();

      if (contactDate === followupDate) {
        violationIds.push(item.id);
      }
    }

    if (violationIds.length === 0) {
      return {
        issue: 'Same-Day Followups',
        attempted: true,
        success: true,
        count: 0,
        details: 'No same-day followup violations found'
      };
    }

    // Reschedule to next day (24 hours later)
    for (const id of violationIds) {
      const item = violations.find((v: any) => v.id === id);
      if (!item) continue;

      const newScheduledTime = new Date(item.scheduled_for);
      newScheduledTime.setDate(newScheduledTime.getDate() + 1);

      await supabase
        .from('send_queue')
        .update({
          scheduled_for: newScheduledTime.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
    }

    return {
      issue: 'Same-Day Followups',
      attempted: true,
      success: true,
      count: violationIds.length,
      details: `Rescheduled ${violationIds.length} same-day followups to next day`
    };
  } catch (error) {
    return {
      issue: 'Same-Day Followups',
      attempted: true,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to reschedule same-day followups'
    };
  }
}

/**
 * CHECK: Stuck Upload Sessions
 * Detects sessions where:
 * 1. Session counters don't match actual decision counts (RLS bug)
 * 2. Approved prospects exist but weren't transferred to campaign_prospects
 */
async function checkStuckUploadSessions(supabase: any): Promise<QACheck> {
  try {
    // Find sessions with counter mismatches or missing transfers
    const { data: sessions, error } = await supabase
      .from('prospect_approval_sessions')
      .select(`
        id,
        campaign_id,
        workspace_id,
        status,
        approved_count,
        pending_count,
        total_prospects
      `)
      .in('status', ['active', 'pending'])
      .gt('total_prospects', 0);

    if (error) throw error;

    const stuckSessions: any[] = [];

    for (const session of sessions || []) {
      // Get actual decision counts
      const { count: actualApproved } = await supabase
        .from('prospect_approval_decisions')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id)
        .eq('decision', 'approved');

      const { count: actualRejected } = await supabase
        .from('prospect_approval_decisions')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id)
        .eq('decision', 'rejected');

      const actualPending = session.total_prospects - (actualApproved || 0) - (actualRejected || 0);

      // Check for counter mismatch
      const hasMismatch = session.approved_count !== (actualApproved || 0) ||
                          session.pending_count !== actualPending;

      // Check if approved prospects were transferred
      let missingTransfers = 0;
      if ((actualApproved || 0) > 0 && session.campaign_id) {
        const { count: inCampaign } = await supabase
          .from('campaign_prospects')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', session.campaign_id);

        // If we have approved but none in campaign, they're missing
        if ((inCampaign || 0) < (actualApproved || 0)) {
          missingTransfers = (actualApproved || 0) - (inCampaign || 0);
        }
      }

      if (hasMismatch || missingTransfers > 0) {
        stuckSessions.push({
          session_id: session.id,
          campaign_id: session.campaign_id,
          counter_mismatch: hasMismatch,
          missing_transfers: missingTransfers,
          stored_approved: session.approved_count,
          actual_approved: actualApproved || 0,
          stored_pending: session.pending_count,
          actual_pending: actualPending
        });
      }
    }

    if (stuckSessions.length === 0) {
      return {
        check_name: 'Stuck Upload Sessions',
        category: 'consistency',
        status: 'pass',
        details: 'All upload sessions have correct counters and transfers',
        affected_records: 0
      };
    }

    return {
      check_name: 'Stuck Upload Sessions',
      category: 'consistency',
      status: 'fail',
      details: `Found ${stuckSessions.length} stuck sessions: ${stuckSessions.map(s =>
        `Session ${s.session_id.slice(0,8)}... (mismatch: ${s.counter_mismatch}, missing: ${s.missing_transfers})`
      ).join(', ')}`,
      affected_records: stuckSessions.length,
      sample_ids: stuckSessions.slice(0, 5).map(s => s.session_id),
      suggested_fix: 'Run autoFixStuckUploadSessions to correct counters and transfer prospects'
    };
  } catch (error) {
    return {
      check_name: 'Stuck Upload Sessions',
      category: 'consistency',
      status: 'warning',
      details: `Error checking: ${error instanceof Error ? error.message : 'Unknown error'}`,
      affected_records: 0
    };
  }
}

/**
 * AUTO-FIX: Fix stuck upload sessions
 * 1. Correct session counters to match actual decisions
 * 2. Transfer approved prospects to campaign_prospects if missing
 * 3. Mark session as completed if all decisions made
 */
async function autoFixStuckUploadSessions(supabase: any): Promise<AutoFixResult> {
  try {
    let fixedCount = 0;
    let transferredCount = 0;

    // Find active/pending sessions
    const { data: sessions } = await supabase
      .from('prospect_approval_sessions')
      .select('id, campaign_id, workspace_id, total_prospects')
      .in('status', ['active', 'pending'])
      .gt('total_prospects', 0);

    for (const session of sessions || []) {
      // Get actual counts
      const { count: actualApproved } = await supabase
        .from('prospect_approval_decisions')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id)
        .eq('decision', 'approved');

      const { count: actualRejected } = await supabase
        .from('prospect_approval_decisions')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id)
        .eq('decision', 'rejected');

      const actualPending = session.total_prospects - (actualApproved || 0) - (actualRejected || 0);

      // Fix counters
      await supabase
        .from('prospect_approval_sessions')
        .update({
          approved_count: actualApproved || 0,
          rejected_count: actualRejected || 0,
          pending_count: actualPending,
          status: actualPending === 0 ? 'completed' : 'active',
          completed_at: actualPending === 0 ? new Date().toISOString() : null
        })
        .eq('id', session.id);

      fixedCount++;

      // Transfer approved prospects if campaign exists and they're missing
      if (session.campaign_id && (actualApproved || 0) > 0) {
        // Get approved prospects not yet in campaign
        const { data: approvedProspects } = await supabase
          .from('prospect_approval_data')
          .select('*')
          .eq('session_id', session.id)
          .eq('approval_status', 'approved');

        // Check which are already in campaign
        const { data: existingInCampaign } = await supabase
          .from('campaign_prospects')
          .select('linkedin_url')
          .eq('campaign_id', session.campaign_id);

        const existingUrls = new Set((existingInCampaign || []).map((p: any) => p.linkedin_url));

        // Filter to only those not already transferred
        const toTransfer = (approvedProspects || []).filter((p: any) =>
          !existingUrls.has(p.contact?.linkedin_url)
        );

        if (toTransfer.length > 0) {
          const campaignProspects = toTransfer.map((p: any) => {
            const nameParts = p.name?.split(' ') || ['Unknown'];
            return {
              campaign_id: session.campaign_id,
              workspace_id: session.workspace_id,
              first_name: nameParts[0] || 'Unknown',
              last_name: nameParts.slice(1).join(' ') || '',
              email: p.contact?.email || null,
              company_name: p.company?.name || '',
              title: p.title || '',
              location: p.location || null,
              linkedin_url: p.contact?.linkedin_url || null,
              status: 'pending',
              personalization_data: {
                source: 'qa_monitor_recovery',
                session_id: session.id,
                recovered_at: new Date().toISOString()
              }
            };
          });

          const { data: inserted } = await supabase
            .from('campaign_prospects')
            .insert(campaignProspects)
            .select('id');

          transferredCount += inserted?.length || 0;
        }
      }
    }

    return {
      issue: 'Stuck Upload Sessions',
      attempted: true,
      success: true,
      count: fixedCount,
      details: `Fixed ${fixedCount} session counters, transferred ${transferredCount} prospects to campaigns`
    };
  } catch (error) {
    return {
      issue: 'Stuck Upload Sessions',
      attempted: true,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to fix stuck upload sessions'
    };
  }
}
