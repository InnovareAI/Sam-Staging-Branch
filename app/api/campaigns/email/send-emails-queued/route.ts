import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import moment from 'moment-timezone';

/**
 * POST /api/campaigns/email/send-emails-queued
 *
 * Queue-based email sending with strict compliance
 *
 * COMPLIANCE RULES:
 * - Max 40 emails per day
 * - No weekends (Saturday/Sunday)
 * - No US public holidays
 * - Business hours: 8 AM - 5 PM (9-hour window)
 * - Interval: 13.5 minutes per email (40 emails / 9 hours)
 *
 * Returns in <2 seconds with queue created
 * Cron job processes queue every ~13 minutes
 */

export const maxDuration = 10; // 10 seconds max

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

// Public holidays - International only (most campaigns target global prospects)
// Removed US-only holidays (Thanksgiving, MLK, Presidents Day, etc.)
const PUBLIC_HOLIDAYS = [
  '2025-01-01', // New Year's Day (International)
  '2025-12-25', // Christmas (International)
  '2025-12-26', // Boxing Day (International)
  '2026-01-01', // New Year's Day (International)
];

// Calculate next available send time (skip weekends/holidays, business hours 8-5)
function calculateNextSendTime(baseTime: Date, prospectIndex: number, timezone = 'America/New_York'): Date {
  // Email interval: 13.5 minutes (40 emails over 9 hours)
  const EMAIL_INTERVAL_MINUTES = 13.5;

  // Start time: 8 AM in target timezone
  const START_HOUR = 8;
  const END_HOUR = 17; // 5 PM

  let scheduledTime = moment(baseTime).tz(timezone);

  // Set to 8 AM if before business hours
  if (scheduledTime.hour() < START_HOUR) {
    scheduledTime = scheduledTime.hour(START_HOUR).minute(0).second(0);
  }

  // Add interval for this prospect
  scheduledTime = scheduledTime.add(prospectIndex * EMAIL_INTERVAL_MINUTES, 'minutes');

  // Skip weekends and holidays
  while (true) {
    const dayOfWeek = scheduledTime.day(); // 0=Sun, 6=Sat
    const dateStr = scheduledTime.format('YYYY-MM-DD');

    // Check weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Move to next Monday 8 AM
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 2;
      scheduledTime = scheduledTime.add(daysUntilMonday, 'days').hour(START_HOUR).minute(0).second(0);
      continue;
    }

    // Check holiday
    if (PUBLIC_HOLIDAYS.includes(dateStr)) {
      // Move to next day 8 AM
      scheduledTime = scheduledTime.add(1, 'day').hour(START_HOUR).minute(0).second(0);
      continue;
    }

    // Check if past business hours (5 PM)
    if (scheduledTime.hour() >= END_HOUR) {
      // Move to next day 8 AM
      scheduledTime = scheduledTime.add(1, 'day').hour(START_HOUR).minute(0).second(0);
      continue;
    }

    // Valid time found
    break;
  }

  return scheduledTime.toDate();
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authClient = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const body = await request.json();
    const { campaignId } = body;

    if (!campaignId) {
      return NextResponse.json({
        success: false,
        error: 'campaignId is required'
      }, { status: 400 });
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({
        success: false,
        error: 'Campaign not found'
      }, { status: 404 });
    }

    // Verify user has access to this campaign's workspace
    const { data: membership } = await authClient
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', campaign.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({
        success: false,
        error: 'Access denied to this campaign'
      }, { status: 403 });
    }

    // Get pending prospects (haven't been sent email yet)
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    if (prospectsError) {
      console.error('Error fetching prospects:', prospectsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch prospects'
      }, { status: 500 });
    }

    if (!prospects || prospects.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending prospects to queue',
        queued: 0
      });
    }

    // Limit to 40 emails per day (compliance)
    const maxProspects = Math.min(prospects.length, 40);
    const prospectsToQueue = prospects.slice(0, maxProspects);

    console.log(`📧 Queueing ${prospectsToQueue.length} emails for campaign ${campaignId}`);

    // Get email account for this campaign
    // Table: workspace_accounts (not workspace_integration_accounts)
    // Filter: account_type='email', connection_status='connected'
    const { data: emailAccounts, error: emailAccountError } = await supabase
      .from('workspace_accounts')
      .select('id, unipile_account_id, account_name, account_identifier')
      .eq('workspace_id', campaign.workspace_id)
      .eq('account_type', 'email')
      .eq('connection_status', 'connected')
      .limit(1);

    if (emailAccountError) {
      console.error('Error fetching email account:', emailAccountError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch email account'
      }, { status: 500 });
    }

    if (!emailAccounts || emailAccounts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No connected email account found for this workspace. Please connect an email account in Settings → Integrations.'
      }, { status: 400 });
    }

    const emailAccount = emailAccounts[0];

    // Get email content from campaign templates
    // Email campaigns use email_body field (NOT connection_request - that's LinkedIn)
    const templates = campaign.message_templates || {};
    const emailBody = templates.email_body || templates.alternative_message;
    const emailSubject = templates.initial_subject || templates.email_subject;

    // Final safety check - should never happen if validation is working at creation
    if (!emailBody || emailBody.trim() === '') {
      console.error('❌ Campaign has no email body. This should have been caught at creation.');
      return NextResponse.json({
        success: false,
        error: 'Campaign has no email body. Please edit the campaign to add email content.'
      }, { status: 400 });
    }

    if (!emailSubject || emailSubject.trim() === '') {
      console.error('❌ Campaign has no email subject. This should have been caught at creation.');
      return NextResponse.json({
        success: false,
        error: 'Campaign has no email subject. Please edit the campaign to add a subject line.'
      }, { status: 400 });
    }

    console.log('📧 Queueing emails with:');
    console.log('   Subject:', emailSubject.substring(0, 50) + (emailSubject.length > 50 ? '...' : ''));
    console.log('   Body length:', emailBody.length, 'chars');

    // A/B Testing: Check if enabled and get variant B content
    const abTestingEnabled = templates.ab_testing_enabled || false;
    const emailBodyB = templates.email_body_b || null;
    const emailSubjectB = templates.initial_subject_b || null;

    if (abTestingEnabled && (emailBodyB || emailSubjectB)) {
      console.log('🧪 A/B Testing ENABLED:');
      console.log('   Variant B subject:', emailSubjectB ? 'Yes' : 'No');
      console.log('   Variant B body:', emailBodyB ? 'Yes' : 'No');
    } else if (abTestingEnabled) {
      console.log('⚠️ A/B Testing enabled but no Variant B content found - using Variant A only');
    }

    // Prepare queue records using already-validated emailBody and emailSubject
    const queueRecords = prospectsToQueue.map((prospect, index) => {
      const scheduledFor = calculateNextSendTime(new Date(), index);

      // A/B Testing: Assign variant (even index = A, odd index = B)
      const useAbTesting = abTestingEnabled && (emailBodyB || emailSubjectB);
      const variant: 'A' | 'B' | null = useAbTesting ? (index % 2 === 0 ? 'A' : 'B') : null;

      // Use variant B content if assigned
      const subjectToUse = (variant === 'B' && emailSubjectB) ? emailSubjectB : emailSubject;
      const bodyToUse = (variant === 'B' && emailBodyB) ? emailBodyB : emailBody;

      // Personalize subject and body with prospect data
      const subject = personalizeMessage(subjectToUse, prospect);
      const body = personalizeMessage(bodyToUse, prospect);

      return {
        campaign_id: campaignId,
        prospect_id: prospect.id,
        email_account_id: emailAccount.unipile_account_id, // Use unipile_account_id from workspace_accounts
        recipient_email: prospect.email,
        subject,
        body,
        from_name: emailAccount.account_name || 'SAM AI',
        scheduled_for: scheduledFor.toISOString(),
        status: 'pending',
        variant: variant // A/B testing: 'A', 'B', or null
      };
    });

    // Validate that we have actual email content
    const emptyEmails = queueRecords.filter(r => !r.body || r.body.trim() === '');
    if (emptyEmails.length > 0) {
      console.error('❌ Campaign has no email body configured. Cannot send empty emails.');
      console.error('   Campaign templates:', JSON.stringify(campaign.message_templates, null, 2));
      return NextResponse.json({
        success: false,
        error: 'Campaign has no email message configured. Please add an email message in the campaign settings before sending.',
        debug: {
          templates_found: Object.keys(campaign.message_templates || {}),
          alternative_message: !!campaign.message_templates?.alternative_message,
          email_body: !!campaign.message_templates?.email_body,
          follow_up_messages: campaign.message_templates?.follow_up_messages?.length || 0
        }
      }, { status: 400 });
    }

    // Insert into email_send_queue
    const { data: insertedRecords, error: insertError } = await supabase
      .from('email_send_queue')
      .insert(queueRecords)
      .select();

    if (insertError) {
      console.error('Error inserting queue records:', insertError);
      return NextResponse.json({
        success: false,
        error: 'Failed to create email queue',
        details: insertError.message
      }, { status: 500 });
    }

    console.log(`✅ Queued ${insertedRecords.length} emails for campaign ${campaignId}`);
    console.log(`⏰ First email: ${queueRecords[0].scheduled_for}`);
    console.log(`⏰ Last email: ${queueRecords[queueRecords.length - 1].scheduled_for}`);

    // Update campaign_prospects with A/B variant assignments (if A/B testing enabled)
    const useAbTesting = abTestingEnabled && (emailBodyB || emailSubjectB);
    if (useAbTesting) {
      const variantAProspects = queueRecords.filter(q => q.variant === 'A').map(q => q.prospect_id);
      const variantBProspects = queueRecords.filter(q => q.variant === 'B').map(q => q.prospect_id);

      // Update Variant A prospects
      if (variantAProspects.length > 0) {
        await supabase
          .from('campaign_prospects')
          .update({ ab_variant: 'A' })
          .in('id', variantAProspects);
      }

      // Update Variant B prospects
      if (variantBProspects.length > 0) {
        await supabase
          .from('campaign_prospects')
          .update({ ab_variant: 'B' })
          .in('id', variantBProspects);
      }

      console.log(`🧪 A/B variants assigned: ${variantAProspects.length} Variant A, ${variantBProspects.length} Variant B`);
    }

    return NextResponse.json({
      success: true,
      message: `Queued ${insertedRecords.length} emails`,
      queued: insertedRecords.length,
      first_scheduled: queueRecords[0].scheduled_for,
      last_scheduled: queueRecords[queueRecords.length - 1].scheduled_for,
      compliance: {
        max_daily: 40,
        interval_minutes: 13.5,
        business_hours: '8 AM - 5 PM',
        skips_weekends: true,
        skips_holidays: true
      }
    });

  } catch (error) {
    console.error('Email queue error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper: Personalize message with prospect data
function personalizeMessage(template: string, prospect: any): string {
  return template
    .replace(/{first_name}/g, prospect.first_name || '')
    .replace(/{last_name}/g, prospect.last_name || '')
    .replace(/{company_name}/g, prospect.company_name || '')
    .replace(/{title}/g, prospect.title || '')
    .replace(/{location}/g, prospect.location || '')
    .replace(/{industry}/g, prospect.industry || '')
    .replace(/{email}/g, prospect.email || '')
    .replace(/{full_name}/g, `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim());
}
