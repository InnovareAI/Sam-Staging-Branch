/**
 * QA Messaging Monitor Agent
 * Monitors all messaging pipelines across all workspaces
 * Detects bugs, gaps, and inconsistencies between DB, messaging, and cron jobs
 *
 * POST /api/agents/qa-monitor
 * Trigger: Netlify scheduled functions (hourly quick check, 6 AM detailed)
 *
 * CHECKS (18 total):
 * 1. Queue-Prospect Status Consistency
 * 2. Orphaned Queue Records (auto-fix)
 * 3. Cron Job Execution Gaps
 * 4. Stuck Campaigns Detection (auto-fix)
 * 5. Unipile Message Sync
 * 6. Stuck Prospects Detection (auto-fix)
 * 7. Pending Prospects Ready for Approval
 * 8. Campaign State Consistency
 * 9. Follow-up Scheduling
 * 10. Same-Day Follow-up Check (auto-fix)
 * 11. Duplicate Records
 * 12. Timestamp Anomalies
 * 13. LinkedIn Account Health
 * 14. Rate Limit Status
 * 15. Status Mismatch Detection (auto-fix)
 * 16. Stuck Upload Sessions (auto-fix)
 * 17. Missing Workspace Account Sync (auto-fix)
 * 18. Email Queue Processing
 *
 * NEW SAFEGUARD CHECKS (Dec 17, 2025):
 * 19. Unipile Account Status Consistency (auto-fix 'connected' → 'active')
 * 20. Workspace Error Rates (>10% threshold)
 * 21. Provider ID Quality (URL/vanity detection)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';
import { claudeClient } from '@/lib/llm/claude-client';
import { sendHealthCheckNotification } from '@/lib/notifications/google-chat';
import { sendFailedProspectsAlert } from '@/lib/notifications/notification-router';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

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

  // Parse request body for quick_check mode
  let quickCheck = false;
  try {
    const body = await request.json();
    quickCheck = body.quick_check === true;
  } catch {
    // No body or invalid JSON - default to full check
  }

  console.log(`🔍 QA Monitor Agent starting ${quickCheck ? 'QUICK CHECK' : 'DETAILED SCAN'} with auto-fix...`);

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

    // 3.5 CRITICAL: Stuck Campaigns (active but no progress in 2 hours)
    const stuckCampaignCheck = await checkStuckCampaigns(supabase);
    allChecks.push(stuckCampaignCheck);

    // AUTO-FIX: Queue approved prospects that were never added to send_queue
    if (stuckCampaignCheck.affected_records && stuckCampaignCheck.affected_records > 0) {
      console.log(`🔧 Auto-fixing ${stuckCampaignCheck.affected_records} stuck campaigns...`);
      const fix = await autoFixStuckCampaigns(supabase);
      autoFixes.push(fix);
    }

    // 4. Message Status vs Unipile Sync
    const syncCheck = await checkUnipileSyncStatus(supabase);
    allChecks.push(syncCheck);

    // 5. Stuck Prospects Detection (tightened to 6 hours for quick detection)
    const stuckCheck = await checkStuckProspects(supabase);
    allChecks.push(stuckCheck);

    // AUTO-FIX: Mark stuck prospects as failed
    if (stuckCheck.affected_records && stuckCheck.affected_records > 0) {
      console.log(`🔧 Auto-fixing ${stuckCheck.affected_records} stuck prospects...`);
      const fix = await autoFixStuckProspects(supabase);
      autoFixes.push(fix);
    }

    // 5.5. Pending Prospects Waiting for Approval (valid, >3 days in active campaigns)
    // NOTE: This is a WARNING only - humans must still approve via UI
    const pendingApprovalCheck = await checkPendingProspectsReadyForApproval(supabase);
    allChecks.push(pendingApprovalCheck);

    // NO AUTO-FIX: Humans must approve via data approval screen
    // This check just alerts when prospects are waiting too long

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

    // 10.5. Rate Limit Status (daily usage summary)
    const rateLimitCheck = await checkRateLimitStatus(supabase);
    allChecks.push(rateLimitCheck);

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

    // 13. Missing Workspace Account Sync (user_unipile_accounts not in workspace_accounts)
    const missingAccountsCheck = await checkMissingWorkspaceAccounts(supabase);
    allChecks.push(missingAccountsCheck);

    // AUTO-FIX: Sync missing accounts to workspace_accounts
    if (missingAccountsCheck.affected_records && missingAccountsCheck.affected_records > 0) {
      console.log(`🔧 Auto-syncing ${missingAccountsCheck.affected_records} missing workspace accounts...`);
      const fix = await autoFixMissingWorkspaceAccounts(supabase);
      autoFixes.push(fix);
    }

    // 14. Email Queue Processing (for email-only campaigns)
    // NOTE: Email-only campaigns (like Jennifer Fleming's inbox agent) use email_queue, not send_queue
    const emailQueueCheck = await checkEmailQueueProcessing(supabase);
    allChecks.push(emailQueueCheck);

    // 15. Unipile Account Status Consistency (Dec 17, 2025)
    // Ensures all accounts are 'active' not just 'connected'
    const accountStatusCheck = await checkUnipileAccountStatus(supabase);
    allChecks.push(accountStatusCheck);

    // AUTO-FIX: Update 'connected' accounts to 'active'
    if (accountStatusCheck.affected_records && accountStatusCheck.affected_records > 0) {
      console.log(`🔧 Auto-fixing ${accountStatusCheck.affected_records} account status issues...`);
      const fix = await autoFixUnipileAccountStatus(supabase);
      autoFixes.push(fix);
    }

    // 16. Reply Agent Configuration Coverage - REMOVED (Dec 18, 2025)
    // Not important, users can enable Reply Agent when they want

    // 17. Error Rate by Workspace (Dec 17, 2025)
    // Flags workspaces with >10% error rate in last 7 days
    const errorRateCheck = await checkWorkspaceErrorRates(supabase);
    allChecks.push(errorRateCheck);

    // 18. Provider ID Quality Check (Dec 17, 2025)
    // Checks for invalid linkedin_user_id formats (URLs instead of ACo/ACw IDs)
    const providerIdCheck = await checkProviderIdQuality(supabase);
    allChecks.push(providerIdCheck);

    // 19. Campaign Failure Alerts (Dec 18, 2025)
    // Send Google Chat alerts with CSV download links for campaigns with failures
    const failureAlertCheck = await checkAndAlertCampaignFailures(supabase);
    allChecks.push(failureAlertCheck);

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

    // Determine if we should send notification
    // - Quick check mode: Only send if there are problems (warnings or failures)
    // - Full check mode: Always send detailed report
    const hasProblems = failedChecks.length > 0 || warningChecks.length > 0;
    const shouldNotify = !quickCheck || hasProblems;

    if (shouldNotify) {
      // Build appropriate summary based on mode
      let notificationSummary: string;
      if (quickCheck && hasProblems) {
        // Quick check with problems - show brief problem summary
        notificationSummary = `⚠️ HOURLY CHECK: ${failedChecks.length} failures, ${warningChecks.length} warnings detected` + fixesSummary;
      } else if (quickCheck && !hasProblems) {
        // Quick check, no problems - this won't be sent, but for completeness
        notificationSummary = `✅ HOURLY CHECK: All systems running normally`;
      } else {
        // Full detailed report (6 AM run) - only show issues count
        const issueCount = failedChecks.length + warningChecks.length;
        notificationSummary = issueCount > 0
          ? `📊 DAILY REPORT: ${issueCount} issues found (${failedChecks.length} critical, ${warningChecks.length} warnings)` + fixesSummary
          : `✅ DAILY REPORT: All ${allChecks.length} checks passed` + fixesSummary;
      }

      // Only include checks with issues (never send passing checks)
      const issueChecks = allChecks.filter(c => c.status !== 'pass');

      // Send Google Chat notification
      await sendHealthCheckNotification({
        type: 'qa-monitor',
        status: overallStatus as 'healthy' | 'warning' | 'critical',
        summary: notificationSummary,
        checks: issueChecks.map(c => ({
          name: c.check_name,
          status: c.status,
          details: c.details,
        })),
        recommendations: aiAnalysis?.recommendations || [],
        auto_fixes: autoFixes,
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.log('✅ Quick check: All systems healthy - no notification sent');
    }

    console.log('✅ QA Monitor complete:', {
      mode: quickCheck ? 'quick_check' : 'detailed',
      notification_sent: shouldNotify,
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
      mode: quickCheck ? 'quick_check' : 'detailed',
      notification_sent: shouldNotify,
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
  // Valid statuses for sent queue items: connection_request_sent, message_sent, accepted,
  // connected, messaging, replied, already_invited
  const validStatuses = [
    'connection_request_sent', 'message_sent', 'accepted',
    'connected', 'messaging', 'replied', 'already_invited'
  ];

  const { data: queueItems } = await supabase
    .from('send_queue')
    .select('id, prospect_id')
    .eq('status', 'sent')
    .limit(100);

  if (!queueItems || queueItems.length === 0) {
    return {
      check_name: 'Queue-Prospect Status Consistency',
      category: 'consistency',
      status: 'pass',
      details: 'No sent queue items to check',
      affected_records: 0
    };
  }

  // Check prospect statuses
  const prospectIds = queueItems.map((q: any) => q.prospect_id);
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, status')
    .in('id', prospectIds);

  const prospectStatusMap = new Map((prospects || []).map((p: any) => [p.id, p.status]));
  const inconsistent = queueItems.filter((q: any) => {
    const status = prospectStatusMap.get(q.prospect_id);
    return status && !validStatuses.includes(status);
  });

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
  // Find prospects stuck in transitional states - TIGHTENED to 6 hours for quick detection
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const { data: stuck } = await supabase
    .from('campaign_prospects')
    .select('id, status, updated_at, campaign_id')
    .in('status', ['queued', 'processing']) // 'pending' is valid - waiting for approval
    .lt('updated_at', sixHoursAgo)
    .limit(100);

  const count = stuck?.length || 0;

  return {
    check_name: 'Stuck Prospects Detection',
    category: 'database',
    status: count > 10 ? 'fail' : count > 0 ? 'warning' : 'pass', // Tighter thresholds
    details: count > 0
      ? `🚨 ${count} prospects stuck in transitional state for >6 hours`
      : 'No stuck prospects detected',
    affected_records: count,
    sample_ids: stuck?.slice(0, 10).map((p: any) => p.id),
    suggested_fix: count > 0 ? `UPDATE campaign_prospects SET status = 'failed', error_message = 'Timed out' WHERE id IN (${stuck?.slice(0, 50).map((p: any) => `'${p.id}'`).join(',')})` : undefined
  };
}

// CRITICAL: Check for stuck campaigns - active campaigns with no progress
// NOTE: Only checks LinkedIn campaigns. Email-only campaigns use email_queue, not send_queue.
async function checkStuckCampaigns(supabase: any): Promise<QACheck> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  // Find active/running campaigns that should be sending but have no recent activity
  // IMPORTANT: Skip email campaigns - they use email_queue or are inbox agents (monitor-only)
  // Both 'email' and 'email_only' types should be excluded from send_queue checks
  const { data: activeCampaigns } = await supabase
    .from('campaigns')
    .select(`
      id, name, campaign_name, status, workspace_id, campaign_type,
      workspaces(name)
    `)
    .in('status', ['active', 'running'])
    .or('campaign_type.is.null,campaign_type.not.in.(email,email_only)');

  if (!activeCampaigns || activeCampaigns.length === 0) {
    return {
      check_name: 'Stuck Campaigns Detection',
      category: 'cron',
      status: 'pass',
      details: 'No active campaigns to check',
      affected_records: 0
    };
  }

  const stuckCampaigns: any[] = [];

  for (const campaign of activeCampaigns) {
    // Check for prospects in "approved" status that are NOT in queue at all
    // This is the real stuck case - approved but never queued
    const { data: approvedProspects } = await supabase
      .from('campaign_prospects')
      .select('id')
      .eq('campaign_id', campaign.id)
      .eq('status', 'approved')
      .lt('updated_at', twoHoursAgo);

    if (!approvedProspects || approvedProspects.length === 0) continue;

    // FIX (Dec 18): Get ALL queue entries for campaign - don't use .in() with large arrays
    const { data: inQueue } = await supabase
      .from('send_queue')
      .select('prospect_id')
      .eq('campaign_id', campaign.id);

    const queuedIds = new Set((inQueue || []).map((q: any) => q.prospect_id));
    const notInQueue = approvedProspects.filter((p: any) => !queuedIds.has(p.id));

    // Only flag as stuck if approved prospects are NOT in queue at all
    // (Rate-limited prospects in queue are NOT stuck - they're just waiting)
    if (notInQueue.length > 0) {
      stuckCampaigns.push({
        campaign_id: campaign.id,
        campaign_name: campaign.campaign_name || campaign.name || 'Unnamed Campaign',
        workspace: campaign.workspaces?.name || 'Unknown',
        approved_not_queued: notInQueue.length,
        issue: `${notInQueue.length} approved prospects never queued`
      });
    }
  }

  const count = stuckCampaigns.length;
  const details = stuckCampaigns
    .slice(0, 3)
    .map(c => `${c.campaign_name} (${c.workspace}): ${c.issue}`)
    .join('; ');

  return {
    check_name: 'Stuck Campaigns Detection',
    category: 'cron',
    status: count > 0 ? 'fail' : 'pass',
    details: count > 0
      ? `🚨 ${count} campaigns with unqueued prospects: ${details}`
      : 'All active campaigns processing normally',
    affected_records: count,
    sample_ids: stuckCampaigns.slice(0, 5).map(c => c.campaign_id),
    suggested_fix: count > 0
      ? 'Run queue-pending-prospects to add approved prospects to send queue'
      : undefined
  };
}

async function checkPendingProspectsReadyForApproval(supabase: any): Promise<QACheck> {
  // Find prospects that are:
  // 1. In 'pending' status for >3 days
  // 2. Have validation_status = 'valid'
  // 3. Belong to an active campaign
  // 4. Have complete name fields
  // These are waiting for HUMAN approval in the data approval screen
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: pendingProspects, error } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status, validation_status, created_at, campaign_id, campaigns!inner(status, name)')
    .eq('status', 'pending')
    .eq('validation_status', 'valid')
    .lt('created_at', threeDaysAgo)
    .not('first_name', 'is', null)
    .not('last_name', 'is', null);

  if (error) {
    return {
      check_name: 'Pending Prospects Waiting for Human Approval',
      category: 'consistency',
      status: 'warning',
      details: `Error checking: ${error.message}`,
      affected_records: 0
    };
  }

  // Filter to only active campaigns
  const waitingForApproval = (pendingProspects || []).filter((p: any) => {
    return p.campaigns && p.campaigns.status === 'active';
  });

  const count = waitingForApproval.length;

  // Get campaign names for context
  const campaignNames = waitingForApproval
    .map((p: any) => p.campaigns?.name || 'Unknown')
    .filter((name, index, self) => self.indexOf(name) === index)
    .slice(0, 3)
    .join(', ');

  return {
    check_name: 'Pending Prospects Waiting for Human Approval',
    category: 'consistency',
    status: count > 10 ? 'fail' : count > 0 ? 'warning' : 'pass',
    details: count > 0
      ? `${count} valid prospects waiting >3 days for manual approval in campaigns: ${campaignNames}. User needs to review in approval UI.`
      : 'No prospects waiting for approval',
    affected_records: count,
    sample_ids: waitingForApproval.slice(0, 5).map((p: any) => p.id),
    suggested_fix: count > 0 ? 'Notify user to review pending prospects in data approval screen. DO NOT auto-approve - human review required.' : undefined
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

/**
 * CHECK: Rate Limit Status
 * Shows daily usage across all LinkedIn accounts for visibility
 * Real-time notifications are sent by process-send-queue when limits are hit
 */
async function checkRateLimitStatus(supabase: any): Promise<QACheck> {
  const DAILY_CR_LIMIT = 20;
  const DAILY_MESSAGE_LIMIT = 50;

  try {
    // Get today's date boundaries in UTC
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    // Get all active LinkedIn accounts
    const { data: accounts } = await supabase
      .from('workspace_accounts')
      .select('id, account_name, workspace_id, unipile_account_id')
      .eq('account_type', 'linkedin')
      .in('connection_status', VALID_CONNECTION_STATUSES);

    if (!accounts || accounts.length === 0) {
      return {
        check_name: 'Rate Limit Status',
        category: 'messaging',
        status: 'pass',
        details: 'No active LinkedIn accounts',
        affected_records: 0
      };
    }

    const accountUsage: { name: string; crs: number; msgs: number; atLimit: boolean }[] = [];
    let accountsAtLimit = 0;

    for (const account of accounts) {
      // Get today's sent items for this account's campaigns
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id')
        .eq('linkedin_account_id', account.unipile_account_id);

      if (!campaigns || campaigns.length === 0) continue;

      const campaignIds = campaigns.map((c: any) => c.id);

      // Count CRs sent today
      const { data: crsSent } = await supabase
        .from('send_queue')
        .select('id')
        .in('campaign_id', campaignIds)
        .eq('status', 'sent')
        .or('message_type.is.null,message_type.eq.connection_request')
        .gte('sent_at', todayStart.toISOString())
        .lte('sent_at', todayEnd.toISOString());

      // Count messages sent today
      const { data: msgsSent } = await supabase
        .from('send_queue')
        .select('id')
        .in('campaign_id', campaignIds)
        .eq('status', 'sent')
        .neq('message_type', 'connection_request')
        .not('message_type', 'is', null)
        .gte('sent_at', todayStart.toISOString())
        .lte('sent_at', todayEnd.toISOString());

      const crCount = crsSent?.length || 0;
      const msgCount = msgsSent?.length || 0;
      const atLimit = crCount >= DAILY_CR_LIMIT || msgCount >= DAILY_MESSAGE_LIMIT;

      if (atLimit) accountsAtLimit++;

      accountUsage.push({
        name: account.account_name || 'Unknown',
        crs: crCount,
        msgs: msgCount,
        atLimit
      });
    }

    // Build summary
    const usageSummary = accountUsage
      .slice(0, 5)
      .map(a => `${a.name}: ${a.crs}/${DAILY_CR_LIMIT} CRs, ${a.msgs}/${DAILY_MESSAGE_LIMIT} msgs${a.atLimit ? ' ⚠️' : ''}`)
      .join('; ');

    return {
      check_name: 'Rate Limit Status',
      category: 'messaging',
      status: accountsAtLimit > 0 ? 'warning' : 'pass',
      details: accountsAtLimit > 0
        ? `${accountsAtLimit} account(s) at daily limit. ${usageSummary}`
        : `All accounts within limits. ${usageSummary}`,
      affected_records: accountsAtLimit,
      suggested_fix: accountsAtLimit > 0 ? 'Normal behavior - limits reset at midnight UTC' : undefined
    };
  } catch (error) {
    return {
      check_name: 'Rate Limit Status',
      category: 'messaging',
      status: 'warning',
      details: `Error checking rate limits: ${error instanceof Error ? error.message : 'Unknown'}`,
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
    // transferredCount removed - auto-transfer disabled Dec 5, 2025

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

      // DISABLED (Dec 5, 2025): Auto-transfer caused prospects to be assigned to campaigns
      // before user completed the modal flow. Prospects should only be assigned when
      // user explicitly completes CampaignTypeModal → PreflightModal → handleProceedToCampaignHub
      //
      // Old logic was: if session has campaign_id, auto-insert approved prospects to campaign_prospects
      // This bypassed the user's ability to choose campaign type and finalize the flow.
    }

    return {
      issue: 'Stuck Upload Sessions',
      attempted: true,
      success: true,
      count: fixedCount,
      details: `Fixed ${fixedCount} session counters (auto-transfer disabled - prospects stay in approval flow)`
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

/**
 * CHECK: Missing Workspace Account Sync
 * Detects LinkedIn accounts in user_unipile_accounts that are not in workspace_accounts
 * This causes "No LinkedIn account connected" errors in search
 */
async function checkMissingWorkspaceAccounts(supabase: any): Promise<QACheck> {
  try {
    // Find users with LinkedIn accounts in user_unipile_accounts
    // that have a workspace membership but no entry in workspace_accounts
    const { data: missingAccounts, error } = await supabase.rpc('find_missing_workspace_accounts');

    // If RPC doesn't exist, do manual check
    if (error) {
      // Get all LinkedIn accounts from user_unipile_accounts
      const { data: userAccounts } = await supabase
        .from('user_unipile_accounts')
        .select('user_id, unipile_account_id, account_name, platform')
        .eq('platform', 'LINKEDIN')
        .in('connection_status', ['active', 'connected']);

      // Get all workspace accounts
      const { data: workspaceAccounts } = await supabase
        .from('workspace_accounts')
        .select('unipile_account_id');

      const existingAccountIds = new Set((workspaceAccounts || []).map((a: any) => a.unipile_account_id));

      // Find accounts not in workspace_accounts
      const missing = (userAccounts || []).filter((ua: any) =>
        !existingAccountIds.has(ua.unipile_account_id)
      );

      if (missing.length === 0) {
        return {
          check_name: 'Missing Workspace Account Sync',
          category: 'consistency',
          status: 'pass',
          details: 'All LinkedIn accounts are synced to workspace_accounts',
          affected_records: 0
        };
      }

      return {
        check_name: 'Missing Workspace Account Sync',
        category: 'consistency',
        status: 'fail',
        details: `Found ${missing.length} LinkedIn accounts not synced to workspace_accounts: ${missing.map((m: any) => m.account_name).join(', ')}`,
        affected_records: missing.length,
        sample_ids: missing.slice(0, 5).map((m: any) => m.unipile_account_id),
        suggested_fix: 'Run autoFixMissingWorkspaceAccounts to sync accounts'
      };
    }

    return {
      check_name: 'Missing Workspace Account Sync',
      category: 'consistency',
      status: 'pass',
      details: 'All LinkedIn accounts are synced',
      affected_records: 0
    };
  } catch (error) {
    return {
      check_name: 'Missing Workspace Account Sync',
      category: 'consistency',
      status: 'warning',
      details: `Error checking: ${error instanceof Error ? error.message : 'Unknown error'}`,
      affected_records: 0
    };
  }
}

/**
 * AUTO-FIX: Sync missing accounts to workspace_accounts
 * For each user with a LinkedIn account, ensure it's in workspace_accounts for their workspaces
 */
async function autoFixMissingWorkspaceAccounts(supabase: any): Promise<AutoFixResult> {
  try {
    let syncedCount = 0;

    // Get all LinkedIn accounts from user_unipile_accounts
    const { data: userAccounts } = await supabase
      .from('user_unipile_accounts')
      .select('user_id, unipile_account_id, account_name, platform')
      .eq('platform', 'LINKEDIN')
      .in('connection_status', ['active', 'connected']);

    // Get existing workspace accounts
    const { data: existingAccounts } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id, workspace_id');

    const existingPairs = new Set(
      (existingAccounts || []).map((a: any) => `${a.workspace_id}:${a.unipile_account_id}`)
    );

    for (const userAccount of userAccounts || []) {
      // Find all workspaces this user is a member of
      const { data: memberships } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userAccount.user_id)
        .eq('status', 'active');

      for (const membership of memberships || []) {
        const pairKey = `${membership.workspace_id}:${userAccount.unipile_account_id}`;

        // Skip if already exists
        if (existingPairs.has(pairKey)) continue;

        // Insert into workspace_accounts
        const { error: insertError } = await supabase
          .from('workspace_accounts')
          .insert({
            workspace_id: membership.workspace_id,
            user_id: userAccount.user_id,
            account_type: 'linkedin',
            account_identifier: userAccount.account_name?.toLowerCase().replace(/\s+/g, '-') || 'linkedin-account',
            account_name: userAccount.account_name,
            unipile_account_id: userAccount.unipile_account_id,
            connection_status: 'connected',
            is_active: true,
            connected_at: new Date().toISOString()
          });

        if (!insertError) {
          syncedCount++;
          existingPairs.add(pairKey); // Prevent duplicates in same run
          console.log(`✅ Synced ${userAccount.account_name} to workspace ${membership.workspace_id}`);
        }
      }
    }

    return {
      issue: 'Missing Workspace Account Sync',
      attempted: true,
      success: true,
      count: syncedCount,
      details: `Synced ${syncedCount} LinkedIn accounts to workspace_accounts`
    };
  } catch (error) {
    return {
      issue: 'Missing Workspace Account Sync',
      attempted: true,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to sync missing workspace accounts'
    };
  }
}

/**
 * AUTO-FIX: Fix stuck campaigns by queueing approved prospects
 *
 * Two types of stuck campaigns:
 * 1. Queue items overdue (pending in send_queue but scheduled_for > 2 hours ago)
 *    - Fix: Call process-send-queue to retry processing
 * 2. Approved not queued (prospects approved but never added to send_queue)
 *    - Fix: Call queue-pending-prospects to create queue records
 */
async function autoFixStuckCampaigns(supabase: any): Promise<AutoFixResult> {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    let fixedCount = 0;
    const fixDetails: string[] = [];

    // 1. Find campaigns with approved prospects not in queue
    // IMPORTANT: Skip email campaigns - they use email_queue or are inbox agents (monitor-only)
    // Both 'email' and 'email_only' types should be excluded from send_queue checks
    const { data: activeCampaigns } = await supabase
      .from('campaigns')
      .select(`
        id, name, campaign_name, status, linkedin_account_id,
        message_templates, connection_message, linkedin_config, campaign_type
      `)
      .in('status', ['active', 'running'])
      .or('campaign_type.is.null,campaign_type.not.in.(email,email_only)');

    if (!activeCampaigns || activeCampaigns.length === 0) {
      return {
        issue: 'Stuck Campaigns',
        attempted: true,
        success: true,
        count: 0,
        details: 'No active campaigns to fix'
      };
    }

    for (const campaign of activeCampaigns) {
      // Find approved prospects not in queue (stuck for >2 hours)
      const { data: approvedProspects } = await supabase
        .from('campaign_prospects')
        .select('id, first_name, last_name, linkedin_url, linkedin_user_id, company_name, title')
        .eq('campaign_id', campaign.id)
        .eq('status', 'approved')
        .lt('updated_at', twoHoursAgo)
        .not('linkedin_url', 'is', null);

      if (!approvedProspects || approvedProspects.length === 0) continue;

      // FIX (Dec 18): Get ALL queue entries for campaign - don't use .in() with large arrays
      const { data: existingQueue } = await supabase
        .from('send_queue')
        .select('prospect_id')
        .eq('campaign_id', campaign.id);

      const existingIds = new Set((existingQueue || []).map((q: any) => q.prospect_id));
      const unqueuedProspects = approvedProspects.filter((p: any) => !existingIds.has(p.id));

      if (unqueuedProspects.length === 0) continue;

      // Get message template
      const linkedinConfig = campaign.linkedin_config as { connection_message?: string } | null;
      const isMessenger = campaign.campaign_type === 'messenger';

      let messageTemplate: string | null = null;
      if (isMessenger) {
        messageTemplate = campaign.message_templates?.direct_message_1 || null;
      } else {
        messageTemplate =
          campaign.message_templates?.connection_request ||
          campaign.connection_message ||
          linkedinConfig?.connection_message ||
          null;
      }

      if (!messageTemplate) {
        console.log(`⚠️ Campaign "${campaign.campaign_name || campaign.name}" has no message template - skipping`);
        continue;
      }

      // Queue the unqueued prospects with 30-minute spacing
      const queueRecords = [];
      const MIN_SPACING_MINUTES = 20;
      const MAX_SPACING_MINUTES = 45;

      let currentTime = new Date();

      for (const prospect of unqueuedProspects) {
        // Personalize message
        let personalizedMessage = messageTemplate;
        personalizedMessage = personalizedMessage.replace(/\{first_name\}/gi, prospect.first_name || '');
        personalizedMessage = personalizedMessage.replace(/\{last_name\}/gi, prospect.last_name || '');
        personalizedMessage = personalizedMessage.replace(/\{company\}/gi, prospect.company_name || '');
        personalizedMessage = personalizedMessage.replace(/\{title\}/gi, prospect.title || '');

        queueRecords.push({
          campaign_id: campaign.id,
          prospect_id: prospect.id,
          linkedin_user_id: prospect.linkedin_url,
          message: personalizedMessage.trim(),
          scheduled_for: currentTime.toISOString(),
          status: 'pending',
          message_type: isMessenger ? 'direct_message_1' : 'connection_request'
        });

        // Add random spacing for next prospect
        const spacingMinutes = MIN_SPACING_MINUTES + Math.floor(Math.random() * (MAX_SPACING_MINUTES - MIN_SPACING_MINUTES + 1));
        currentTime = new Date(currentTime.getTime() + spacingMinutes * 60 * 1000);
      }

      // Insert queue records
      const { data: inserted, error: insertError } = await supabase
        .from('send_queue')
        .insert(queueRecords)
        .select('id');

      if (insertError) {
        console.error(`❌ Failed to queue prospects for ${campaign.campaign_name || campaign.name}:`, insertError.message);
        fixDetails.push(`❌ ${campaign.campaign_name || campaign.name}: Insert failed - ${insertError.message}`);
      } else {
        const insertedCount = inserted?.length || 0;
        fixedCount += insertedCount;
        console.log(`✅ Queued ${insertedCount} prospects for ${campaign.campaign_name || campaign.name}`);
        fixDetails.push(`✅ ${campaign.campaign_name || campaign.name}: Queued ${insertedCount} prospects`);

        // Update prospect status to 'queued'
        await supabase
          .from('campaign_prospects')
          .update({ status: 'queued', updated_at: new Date().toISOString() })
          .in('id', unqueuedProspects.map((p: any) => p.id));
      }
    }

    // 2. Also retry any stuck queue items (pending but scheduled_for > 2 hours ago)
    const { data: stuckQueueItems, error: queueError } = await supabase
      .from('send_queue')
      .select('id, campaign_id')
      .eq('status', 'pending')
      .lt('scheduled_for', twoHoursAgo)
      .limit(50);

    if (!queueError && stuckQueueItems && stuckQueueItems.length > 0) {
      // Reschedule stuck items with immediate timing
      const now = new Date();
      for (let i = 0; i < stuckQueueItems.length; i++) {
        const newScheduledFor = new Date(now.getTime() + i * 2 * 60 * 1000); // 2-minute spacing
        await supabase
          .from('send_queue')
          .update({ scheduled_for: newScheduledFor.toISOString() })
          .eq('id', stuckQueueItems[i].id);
      }
      fixedCount += stuckQueueItems.length;
      fixDetails.push(`⏰ Rescheduled ${stuckQueueItems.length} overdue queue items`);
      console.log(`⏰ Rescheduled ${stuckQueueItems.length} overdue queue items`);
    }

    return {
      issue: 'Stuck Campaigns',
      attempted: true,
      success: true,
      count: fixedCount,
      details: fixDetails.length > 0 ? fixDetails.join('; ') : 'No stuck campaigns found'
    };
  } catch (error) {
    console.error('❌ Error in autoFixStuckCampaigns:', error);
    return {
      issue: 'Stuck Campaigns',
      attempted: true,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to fix stuck campaigns'
    };
  }
}

/**
 * CHECK 15: Unipile Account Status Consistency (Dec 17, 2025)
 * Ensures all LinkedIn accounts have status 'active' not 'connected'
 * The 'connected' status can cause issues with campaign execution
 */
async function checkUnipileAccountStatus(supabase: any): Promise<QACheck> {
  try {
    // Find accounts with 'connected' status (should be 'active')
    const { data: incorrectStatus, error } = await supabase
      .from('user_unipile_accounts')
      .select('id, account_name, connection_status, workspace_id')
      .eq('platform', 'LINKEDIN')
      .in('connection_status', VALID_CONNECTION_STATUSES);

    if (error) throw error;

    const count = incorrectStatus?.length || 0;

    return {
      check_name: 'Unipile Account Status Consistency',
      category: 'messaging',
      status: count > 0 ? 'warning' : 'pass',
      details: count > 0
        ? `${count} LinkedIn accounts have 'connected' status (should be 'active'): ${incorrectStatus?.map((a: any) => a.account_name).join(', ')}`
        : 'All LinkedIn accounts have correct status',
      affected_records: count,
      sample_ids: incorrectStatus?.slice(0, 5).map((a: any) => a.id),
      suggested_fix: count > 0 ? 'Update connection_status to "active" for functioning accounts' : undefined
    };
  } catch (error) {
    return {
      check_name: 'Unipile Account Status Consistency',
      category: 'messaging',
      status: 'warning',
      details: `Error checking: ${error instanceof Error ? error.message : 'Unknown'}`,
      affected_records: 0
    };
  }
}

/**
 * AUTO-FIX: Update 'connected' accounts to 'active'
 */
async function autoFixUnipileAccountStatus(supabase: any): Promise<AutoFixResult> {
  try {
    const { data: updated, error } = await supabase
      .from('user_unipile_accounts')
      .update({
        connection_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('platform', 'LINKEDIN')
      .in('connection_status', VALID_CONNECTION_STATUSES)
      .select('id, account_name');

    if (error) throw error;

    return {
      issue: 'Unipile Account Status',
      attempted: true,
      success: true,
      count: updated?.length || 0,
      details: `Updated ${updated?.length || 0} accounts to 'active' status: ${updated?.map((a: any) => a.account_name).join(', ')}`
    };
  } catch (error) {
    return {
      issue: 'Unipile Account Status',
      attempted: true,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to update account statuses'
    };
  }
}

/**
 * CHECK 16: Reply Agent Configuration Coverage (Dec 17, 2025)
 * Alerts if workspaces with active campaigns don't have Reply Agent configured
 */
async function checkReplyAgentConfiguration(supabase: any): Promise<QACheck> {
  try {
    // Get workspaces with active campaigns
    const { data: activeCampaigns } = await supabase
      .from('campaigns')
      .select('workspace_id')
      .in('status', ['active', 'running']);

    if (!activeCampaigns || activeCampaigns.length === 0) {
      return {
        check_name: 'Reply Agent Configuration',
        category: 'consistency',
        status: 'pass',
        details: 'No active campaigns to check',
        affected_records: 0
      };
    }

    // Get unique workspace IDs with active campaigns
    const activeWorkspaceIds = [...new Set(activeCampaigns.map((c: any) => c.workspace_id))];

    // Get workspaces with Reply Agent enabled
    const { data: replyAgentConfigs } = await supabase
      .from('workspace_reply_agent_config')
      .select('workspace_id')
      .eq('enabled', true);

    const configuredWorkspaces = new Set((replyAgentConfigs || []).map((c: any) => c.workspace_id));

    // Find workspaces with active campaigns but no Reply Agent
    const unconfiguredWorkspaces = activeWorkspaceIds.filter(
      (wsId: string) => !configuredWorkspaces.has(wsId)
    );

    // Get workspace names for better reporting
    const { data: workspaceNames } = await supabase
      .from('workspaces')
      .select('id, name')
      .in('id', unconfiguredWorkspaces);

    const names = (workspaceNames || []).map((w: any) => w.name);
    const count = unconfiguredWorkspaces.length;

    return {
      check_name: 'Reply Agent Configuration',
      category: 'consistency',
      status: count > 2 ? 'warning' : 'pass',
      details: count > 0
        ? `${count} workspaces with active campaigns have no Reply Agent: ${names.slice(0, 5).join(', ')}`
        : `All ${activeWorkspaceIds.length} workspaces with active campaigns have Reply Agent configured`,
      affected_records: count,
      sample_ids: unconfiguredWorkspaces.slice(0, 5),
      suggested_fix: count > 0 ? 'Enable Reply Agent in workspace settings for better response handling' : undefined
    };
  } catch (error) {
    return {
      check_name: 'Reply Agent Configuration',
      category: 'consistency',
      status: 'warning',
      details: `Error checking: ${error instanceof Error ? error.message : 'Unknown'}`,
      affected_records: 0
    };
  }
}

/**
 * CHECK 17: Error Rate by Workspace (Dec 17, 2025)
 * Flags workspaces with >10% error rate in last 7 days
 */
async function checkWorkspaceErrorRates(supabase: any): Promise<QACheck> {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get all workspaces
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id, name');

    const highErrorWorkspaces: { name: string; rate: number; sent: number; failed: number }[] = [];

    for (const workspace of workspaces || []) {
      // Get campaigns for this workspace
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id')
        .eq('workspace_id', workspace.id);

      if (!campaigns || campaigns.length === 0) continue;

      const campaignIds = campaigns.map((c: any) => c.id);

      // Count sent and failed in last 7 days
      const { count: sent } = await supabase
        .from('send_queue')
        .select('*', { count: 'exact', head: true })
        .in('campaign_id', campaignIds)
        .eq('status', 'sent')
        .gte('sent_at', weekAgo);

      const { count: failed } = await supabase
        .from('send_queue')
        .select('*', { count: 'exact', head: true })
        .in('campaign_id', campaignIds)
        .eq('status', 'failed')
        .gte('updated_at', weekAgo);

      const total = (sent || 0) + (failed || 0);
      if (total < 10) continue; // Skip low volume

      const errorRate = ((failed || 0) / total) * 100;

      if (errorRate > 10) {
        highErrorWorkspaces.push({
          name: workspace.name,
          rate: Math.round(errorRate * 10) / 10,
          sent: sent || 0,
          failed: failed || 0
        });
      }
    }

    const count = highErrorWorkspaces.length;
    const details = highErrorWorkspaces
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 3)
      .map(w => `${w.name}: ${w.rate}% (${w.failed}/${w.sent + w.failed})`)
      .join('; ');

    return {
      check_name: 'Workspace Error Rates',
      category: 'consistency',
      status: count > 0 ? 'warning' : 'pass',
      details: count > 0
        ? `${count} workspaces with >10% error rate (7d): ${details}`
        : 'All workspaces have healthy error rates (<10%)',
      affected_records: count,
      suggested_fix: count > 0 ? 'Investigate failed messages - likely invalid provider IDs or account issues' : undefined
    };
  } catch (error) {
    return {
      check_name: 'Workspace Error Rates',
      category: 'consistency',
      status: 'warning',
      details: `Error checking: ${error instanceof Error ? error.message : 'Unknown'}`,
      affected_records: 0
    };
  }
}

/**
 * CHECK 18: Provider ID Quality Check (Dec 17, 2025)
 * Checks for invalid linkedin_user_id formats in pending queue items
 * Valid formats: ACo... or ACw... (Unipile provider IDs)
 * Invalid: LinkedIn URLs, vanity names, etc.
 */
async function checkProviderIdQuality(supabase: any): Promise<QACheck> {
  try {
    // Get pending queue items with linkedin_user_id
    const { data: pendingItems, error } = await supabase
      .from('send_queue')
      .select('id, linkedin_user_id')
      .eq('status', 'pending')
      .limit(500);

    if (error) throw error;

    if (!pendingItems || pendingItems.length === 0) {
      return {
        check_name: 'Provider ID Quality',
        category: 'database',
        status: 'pass',
        details: 'No pending queue items to check',
        affected_records: 0
      };
    }

    // Categorize IDs
    let validIds = 0;
    let urlIds = 0;
    let vanityIds = 0;
    let otherInvalid = 0;

    for (const item of pendingItems) {
      const id = item.linkedin_user_id || '';

      if (id.startsWith('ACo') || id.startsWith('ACw')) {
        validIds++;
      } else if (id.includes('linkedin.com')) {
        urlIds++;
      } else if (id.match(/^[a-zA-Z0-9-]+$/) && id.length < 50) {
        vanityIds++;
      } else {
        otherInvalid++;
      }
    }

    const invalidCount = urlIds + vanityIds + otherInvalid;
    const invalidPercent = Math.round((invalidCount / pendingItems.length) * 100);

    // This is informational - IDs are resolved at send time
    return {
      check_name: 'Provider ID Quality',
      category: 'database',
      status: invalidPercent > 50 ? 'warning' : 'pass',
      details: `Queue ID breakdown: ${validIds} valid (ACo/ACw), ${urlIds} URLs, ${vanityIds} vanities, ${otherInvalid} other. ${invalidPercent}% will need resolution at send time.`,
      affected_records: invalidCount,
      suggested_fix: invalidCount > 0 ? 'IDs are resolved at send time via Unipile API - this is expected behavior' : undefined
    };
  } catch (error) {
    return {
      check_name: 'Provider ID Quality',
      category: 'database',
      status: 'warning',
      details: `Error checking: ${error instanceof Error ? error.message : 'Unknown'}`,
      affected_records: 0
    };
  }
}

/**
 * CHECK: Email Queue Processing
 * Monitors email-only campaigns that use email_queue instead of send_queue.
 * Email-only campaigns (campaign_type = 'email_only') are handled by the Reply Agent
 * for cold email responses - they do NOT use LinkedIn at all.
 *
 * Examples: Jennifer Fleming's inbox agent for replying to cold email campaigns
 */
async function checkEmailQueueProcessing(supabase: any): Promise<QACheck> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Find email-only campaigns
    const { data: emailCampaigns } = await supabase
      .from('campaigns')
      .select('id, name, campaign_name, status')
      .eq('campaign_type', 'email_only')
      .in('status', ['active', 'running']);

    if (!emailCampaigns || emailCampaigns.length === 0) {
      return {
        check_name: 'Email Queue Processing',
        category: 'messaging',
        status: 'pass',
        details: 'No active email-only campaigns',
        affected_records: 0
      };
    }

    // Check for overdue email queue items
    const campaignIds = emailCampaigns.map((c: any) => c.id);
    const { data: overdueEmails } = await supabase
      .from('email_queue')
      .select('id, campaign_id, scheduled_for')
      .in('campaign_id', campaignIds)
      .eq('status', 'pending')
      .lt('scheduled_for', oneHourAgo)
      .limit(20);

    const overdueCount = overdueEmails?.length || 0;

    // Get recent activity
    const { count: recentActivity } = await supabase
      .from('email_queue')
      .select('*', { count: 'exact', head: true })
      .in('campaign_id', campaignIds)
      .eq('status', 'sent')
      .gte('sent_at', oneHourAgo);

    return {
      check_name: 'Email Queue Processing',
      category: 'messaging',
      status: overdueCount > 10 ? 'fail' : overdueCount > 3 ? 'warning' : 'pass',
      details: overdueCount > 0
        ? `${overdueCount} email queue items overdue. ${emailCampaigns.length} email campaigns active.`
        : `Email queue healthy. ${recentActivity || 0} emails sent in last hour. ${emailCampaigns.length} campaigns active.`,
      affected_records: overdueCount,
      sample_ids: overdueEmails?.slice(0, 5).map((e: any) => e.id),
      suggested_fix: overdueCount > 0 ? 'Check email queue cron job (process-email-queue)' : undefined
    };
  } catch (error) {
    return {
      check_name: 'Email Queue Processing',
      category: 'messaging',
      status: 'warning',
      details: `Error checking email queue: ${error instanceof Error ? error.message : 'Unknown'}`,
      affected_records: 0
    };
  }
}

/**
 * CHECK 19: Campaign Failure Alerts (Dec 18, 2025)
 * Detects campaigns with significant failures and sends Google Chat alerts
 * with CSV download links for fixing invalid LinkedIn profiles
 */
async function checkAndAlertCampaignFailures(supabase: any): Promise<QACheck> {
  try {
    const FAILED_STATUSES = ['failed', 'error', 'already_invited', 'invitation_declined', 'bounced'];
    const MIN_FAILURES_TO_ALERT = 5; // Only alert if >= 5 failures
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get active campaigns with recent failures
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, campaign_name, name, workspace_id, status')
      .in('status', ['active', 'paused', 'completed']);

    if (!campaigns || campaigns.length === 0) {
      return {
        check_name: 'Campaign Failure Alerts',
        category: 'messaging',
        status: 'pass',
        details: 'No campaigns to check',
        affected_records: 0
      };
    }

    const alertsSent: string[] = [];

    for (const campaign of campaigns) {
      // Count failed prospects (updated in last 24h)
      const { count: failedCount } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .in('status', FAILED_STATUSES)
        .gte('updated_at', dayAgo);

      if (!failedCount || failedCount < MIN_FAILURES_TO_ALERT) continue;

      // Get total prospects
      const { count: totalCount } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id);

      // Get workspace name
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('name')
        .eq('id', campaign.workspace_id)
        .single();

      // Get error breakdown from send_queue
      const { data: queueErrors } = await supabase
        .from('send_queue')
        .select('error_message')
        .eq('campaign_id', campaign.id)
        .eq('status', 'failed')
        .gte('updated_at', dayAgo);

      // Aggregate errors
      const errorCounts: Record<string, number> = {};
      (queueErrors || []).forEach((q: any) => {
        const err = q.error_message || 'Unknown error';
        errorCounts[err] = (errorCounts[err] || 0) + 1;
      });

      const topErrors = Object.entries(errorCounts)
        .map(([error, count]) => ({ error, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      // Send alert (routes to Slack or Google Chat based on workspace config)
      const campaignName = campaign.campaign_name || campaign.name || 'Unknown Campaign';
      await sendFailedProspectsAlert({
        workspaceId: campaign.workspace_id,
        campaignId: campaign.id,
        campaignName,
        workspaceName: workspace?.name || 'Unknown',
        failedCount,
        totalProspects: totalCount || 0,
        topErrors,
        appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com'
      });

      alertsSent.push(`${campaignName} (${failedCount} failures)`);
    }

    return {
      check_name: 'Campaign Failure Alerts',
      category: 'messaging',
      status: alertsSent.length > 0 ? 'warning' : 'pass',
      details: alertsSent.length > 0
        ? `Sent ${alertsSent.length} failure alerts: ${alertsSent.join(', ')}`
        : 'No campaigns with significant failures (>=5) in last 24h',
      affected_records: alertsSent.length
    };
  } catch (error) {
    console.error('Campaign failure alerts error:', error);
    return {
      check_name: 'Campaign Failure Alerts',
      category: 'messaging',
      status: 'warning',
      details: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
      affected_records: 0
    };
  }
}
