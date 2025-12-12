/**
 * Campaign Validation Agent
 *
 * Triggered when campaigns are viewed/created to detect setup issues:
 * - 0 prospects
 * - Missing message templates
 * - No LinkedIn account linked
 * - Wrong campaign type for the data
 * - Stuck prospects (approved but not queued)
 * - Missing required fields
 *
 * POST /api/campaigns/validate
 * Body: { campaignId: string } or { campaignIds: string[] }
 *
 * Returns validation results with auto-fix suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  suggestion?: string;
  autoFixable?: boolean;
  data?: Record<string, any>;
}

interface CampaignValidation {
  campaign_id: string;
  campaign_name: string;
  status: string;
  is_valid: boolean;
  issues: ValidationIssue[];
  auto_fixed?: string[];
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const campaignIds: string[] = body.campaignIds || (body.campaignId ? [body.campaignId] : []);
    const autoFix = body.autoFix !== false; // Default to true

    if (campaignIds.length === 0) {
      return NextResponse.json({ error: 'No campaign IDs provided' }, { status: 400 });
    }

    console.log(`🔍 Validating ${campaignIds.length} campaign(s)...`);

    const results: CampaignValidation[] = [];

    for (const campaignId of campaignIds) {
      const validation = await validateCampaign(campaignId, autoFix);
      results.push(validation);
    }

    const hasErrors = results.some(r => r.issues.some(i => i.type === 'error'));
    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
    const totalAutoFixed = results.reduce((sum, r) => sum + (r.auto_fixed?.length || 0), 0);

    return NextResponse.json({
      success: true,
      summary: {
        campaigns_checked: results.length,
        campaigns_with_issues: results.filter(r => r.issues.length > 0).length,
        total_issues: totalIssues,
        total_auto_fixed: totalAutoFixed,
        has_blocking_errors: hasErrors
      },
      validations: results
    });

  } catch (error) {
    console.error('Campaign validation error:', error);
    return NextResponse.json({
      error: 'Validation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function validateCampaign(campaignId: string, autoFix: boolean): Promise<CampaignValidation> {
  const issues: ValidationIssue[] = [];
  const autoFixed: string[] = [];

  // 1. Fetch campaign with all related data
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select(`
      id, name, campaign_name, status, campaign_type,
      linkedin_account_id, message_templates, connection_message, linkedin_config,
      workspace_id, created_at, updated_at
    `)
    .eq('id', campaignId)
    .single();

  if (campaignError || !campaign) {
    return {
      campaign_id: campaignId,
      campaign_name: 'Unknown',
      status: 'unknown',
      is_valid: false,
      issues: [{
        type: 'error',
        code: 'CAMPAIGN_NOT_FOUND',
        message: 'Campaign not found in database',
        suggestion: 'Check if the campaign ID is correct'
      }]
    };
  }

  const campaignName = campaign.campaign_name || campaign.name || 'Unnamed Campaign';

  // 2. Check prospect count
  const { count: prospectCount } = await supabase
    .from('campaign_prospects')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId);

  if (prospectCount === 0) {
    issues.push({
      type: 'error',
      code: 'NO_PROSPECTS',
      message: 'Campaign has 0 prospects',
      suggestion: 'Upload prospects via CSV or search LinkedIn',
      autoFixable: false
    });
  }

  // 3. Check prospect status distribution
  const { data: statusCounts } = await supabase
    .from('campaign_prospects')
    .select('status')
    .eq('campaign_id', campaignId);

  const statusDistribution: Record<string, number> = {};
  (statusCounts || []).forEach((p: any) => {
    statusDistribution[p.status] = (statusDistribution[p.status] || 0) + 1;
  });

  // 4. Check for stuck approved prospects (not queued for >1 hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: approvedProspects } = await supabase
    .from('campaign_prospects')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('status', 'approved')
    .lt('updated_at', oneHourAgo);

  if (approvedProspects && approvedProspects.length > 0) {
    // Check if these are actually in the queue
    const { data: queuedIds } = await supabase
      .from('send_queue')
      .select('prospect_id')
      .eq('campaign_id', campaignId)
      .in('prospect_id', approvedProspects.map(p => p.id));

    const queuedSet = new Set((queuedIds || []).map(q => q.prospect_id));
    const stuckCount = approvedProspects.filter(p => !queuedSet.has(p.id)).length;

    if (stuckCount > 0) {
      issues.push({
        type: 'error',
        code: 'STUCK_APPROVED_PROSPECTS',
        message: `${stuckCount} approved prospects not in queue (stuck >1 hour)`,
        suggestion: 'These prospects need to be added to the send queue',
        autoFixable: true,
        data: { count: stuckCount }
      });

      // Auto-fix: trigger the queue-pending-prospects logic
      if (autoFix) {
        const fixed = await autoFixStuckApprovedProspects(campaign, approvedProspects.filter(p => !queuedSet.has(p.id)));
        if (fixed > 0) {
          autoFixed.push(`Queued ${fixed} stuck approved prospects`);
        }
      }
    }
  }

  // 5. Check message templates
  const isConnector = campaign.campaign_type === 'connector';
  const isMessenger = campaign.campaign_type === 'messenger';
  const linkedinConfig = campaign.linkedin_config as { connection_message?: string } | null;

  if (isConnector) {
    const hasConnectionMessage =
      campaign.message_templates?.connection_request ||
      campaign.connection_message ||
      linkedinConfig?.connection_message;

    if (!hasConnectionMessage) {
      issues.push({
        type: 'error',
        code: 'MISSING_CONNECTION_MESSAGE',
        message: 'Connector campaign has no connection request message',
        suggestion: 'Add a connection request message in campaign settings',
        autoFixable: false
      });
    }
  }

  if (isMessenger) {
    const hasDirectMessage = campaign.message_templates?.direct_message_1;
    if (!hasDirectMessage) {
      issues.push({
        type: 'error',
        code: 'MISSING_DIRECT_MESSAGE',
        message: 'Messenger campaign has no direct message template',
        suggestion: 'Add a direct message template in campaign settings',
        autoFixable: false
      });
    }
  }

  // 6. Check LinkedIn account
  if (!campaign.linkedin_account_id) {
    issues.push({
      type: 'error',
      code: 'NO_LINKEDIN_ACCOUNT',
      message: 'No LinkedIn account linked to campaign',
      suggestion: 'Link a LinkedIn account in campaign settings',
      autoFixable: false
    });
  } else {
    // Verify the account exists and is connected
    const { data: account } = await supabase
      .from('workspace_accounts')
      .select('id, connection_status, account_name')
      .eq('unipile_account_id', campaign.linkedin_account_id)
      .single();

    if (!account) {
      issues.push({
        type: 'error',
        code: 'LINKEDIN_ACCOUNT_NOT_FOUND',
        message: 'Linked LinkedIn account not found in workspace',
        suggestion: 'Re-link LinkedIn account or check account ID',
        autoFixable: false
      });
    } else if (account.connection_status !== 'connected') {
      issues.push({
        type: 'error',
        code: 'LINKEDIN_ACCOUNT_DISCONNECTED',
        message: `LinkedIn account "${account.account_name}" is ${account.connection_status}`,
        suggestion: 'Reconnect the LinkedIn account in Settings',
        autoFixable: false
      });
    }
  }

  // 7. Check campaign type vs prospect data
  if (isMessenger && prospectCount && prospectCount > 0) {
    // Messenger campaigns should have 1st-degree connections
    const { count: withoutLinkedInId } = await supabase
      .from('campaign_prospects')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .is('linkedin_user_id', null);

    if (withoutLinkedInId && withoutLinkedInId > prospectCount! * 0.5) {
      issues.push({
        type: 'warning',
        code: 'MESSENGER_MISSING_LINKEDIN_IDS',
        message: `${withoutLinkedInId} prospects missing LinkedIn user IDs (needed for direct messages)`,
        suggestion: 'Messenger campaigns work best with 1st-degree connections who have linkedin_user_id',
        autoFixable: false
      });
    }
  }

  // 8. Check for pending queue items that are overdue
  const { data: overdueQueue } = await supabase
    .from('send_queue')
    .select('id, scheduled_for')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .lt('scheduled_for', oneHourAgo);

  if (overdueQueue && overdueQueue.length > 0) {
    issues.push({
      type: 'warning',
      code: 'OVERDUE_QUEUE_ITEMS',
      message: `${overdueQueue.length} queue items overdue (scheduled >1 hour ago)`,
      suggestion: 'Check if process-send-queue cron is running',
      autoFixable: true,
      data: { count: overdueQueue.length }
    });

    // Auto-fix: reschedule overdue items
    if (autoFix) {
      const now = new Date();
      for (let i = 0; i < overdueQueue.length; i++) {
        const newTime = new Date(now.getTime() + i * 2 * 60 * 1000);
        await supabase
          .from('send_queue')
          .update({ scheduled_for: newTime.toISOString() })
          .eq('id', overdueQueue[i].id);
      }
      autoFixed.push(`Rescheduled ${overdueQueue.length} overdue queue items`);
    }
  }

  // 9. Check campaign status vs activity
  if (campaign.status === 'active') {
    const { count: sentCount } = await supabase
      .from('campaign_prospects')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .in('status', ['connection_request_sent', 'messaged', 'connected', 'replied']);

    const { count: pendingQueueCount } = await supabase
      .from('send_queue')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    if (sentCount === 0 && (!pendingQueueCount || pendingQueueCount === 0)) {
      // Active campaign with no sent and no pending = might be stuck
      const approvedCount = statusDistribution['approved'] || 0;
      const pendingCount = statusDistribution['pending'] || 0;

      if (approvedCount > 0) {
        issues.push({
          type: 'warning',
          code: 'ACTIVE_NO_PROGRESS',
          message: `Active campaign has ${approvedCount} approved prospects but none sent/queued`,
          suggestion: 'Prospects may need to be added to the send queue',
          autoFixable: true
        });
      } else if (pendingCount > 0) {
        issues.push({
          type: 'info',
          code: 'AWAITING_APPROVAL',
          message: `Campaign has ${pendingCount} prospects waiting for approval`,
          suggestion: 'Approve prospects in Data Approval screen to start sending',
          autoFixable: false
        });
      }
    }
  }

  // 10. Check for duplicate LinkedIn URLs within campaign
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('linkedin_url')
    .eq('campaign_id', campaignId)
    .not('linkedin_url', 'is', null);

  if (prospects && prospects.length > 0) {
    const urlCounts: Record<string, number> = {};
    prospects.forEach((p: any) => {
      const url = p.linkedin_url?.toLowerCase().replace(/\/+$/, '');
      if (url) {
        urlCounts[url] = (urlCounts[url] || 0) + 1;
      }
    });
    const duplicates = Object.entries(urlCounts).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      issues.push({
        type: 'warning',
        code: 'DUPLICATE_PROSPECTS',
        message: `${duplicates.length} duplicate LinkedIn URLs found in campaign`,
        suggestion: 'Remove duplicates to avoid sending multiple messages to same person',
        autoFixable: false,
        data: { count: duplicates.length }
      });
    }
  }

  const isValid = !issues.some(i => i.type === 'error');

  console.log(`  ${isValid ? '✅' : '❌'} ${campaignName}: ${issues.length} issues, ${autoFixed.length} auto-fixed`);

  return {
    campaign_id: campaignId,
    campaign_name: campaignName,
    status: campaign.status,
    is_valid: isValid,
    issues,
    auto_fixed: autoFixed.length > 0 ? autoFixed : undefined
  };
}

async function autoFixStuckApprovedProspects(campaign: any, stuckProspects: any[]): Promise<number> {
  try {
    // Get full prospect data
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, linkedin_url, company_name, title')
      .in('id', stuckProspects.map(p => p.id));

    if (!prospects || prospects.length === 0) return 0;

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

    if (!messageTemplate) return 0;

    // Queue the prospects
    const queueRecords = [];
    let currentTime = new Date();
    const MIN_SPACING = 20;
    const MAX_SPACING = 45;

    for (const prospect of prospects) {
      if (!prospect.linkedin_url) continue;

      let message = messageTemplate;
      message = message.replace(/\{first_name\}/gi, prospect.first_name || '');
      message = message.replace(/\{last_name\}/gi, prospect.last_name || '');
      message = message.replace(/\{company\}/gi, prospect.company_name || '');
      message = message.replace(/\{title\}/gi, prospect.title || '');

      queueRecords.push({
        campaign_id: campaign.id,
        prospect_id: prospect.id,
        linkedin_user_id: prospect.linkedin_url,
        message: message.trim(),
        scheduled_for: currentTime.toISOString(),
        status: 'pending',
        message_type: isMessenger ? 'direct_message_1' : 'connection_request'
      });

      const spacing = MIN_SPACING + Math.floor(Math.random() * (MAX_SPACING - MIN_SPACING + 1));
      currentTime = new Date(currentTime.getTime() + spacing * 60 * 1000);
    }

    if (queueRecords.length === 0) return 0;

    const { data: inserted, error } = await supabase
      .from('send_queue')
      .insert(queueRecords)
      .select('id');

    if (error) {
      console.error('Failed to auto-fix stuck prospects:', error);
      return 0;
    }

    // Update prospect status
    await supabase
      .from('campaign_prospects')
      .update({ status: 'queued', updated_at: new Date().toISOString() })
      .in('id', prospects.map(p => p.id));

    return inserted?.length || 0;
  } catch (error) {
    console.error('Auto-fix error:', error);
    return 0;
  }
}
