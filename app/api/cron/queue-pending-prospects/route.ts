import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeCompanyName } from '@/lib/prospect-normalization';
import { extractLinkedInSlug, getBestLinkedInIdentifier } from '@/lib/linkedin-utils';

/**
 * Cron job to queue pending prospects for active campaigns
 *
 * This catches campaigns that:
 * 1. Have status='active'
 * 2. Have prospects with status='pending'
 * 3. But those prospects are NOT in send_queue
 *
 * Runs every 5 minutes via Netlify scheduled functions
 * POST /api/cron/queue-pending-prospects
 */

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  // Verify cron secret
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🔍 [v3] Checking for unqueued pending prospects (connector + messenger)...');

  try {
    // 1. Get all active campaigns (both connector and messenger types)
    // CRITICAL FIX (Dec 4): Also fetch connection_message and linkedin_config for message source
    // FIX (Dec 4): Also handle messenger campaigns, not just connector
    // FIX (Dec 15): Join with workspaces to get timezone settings for business hours calculation
    const { data: activeCampaigns, error: campError } = await supabase
      .from('campaigns')
      .select(`
        id, campaign_name, linkedin_account_id, message_templates, connection_message, linkedin_config, campaign_type, workspace_id,
        workspaces!inner(id, settings)
      `)
      .eq('status', 'active')
      .in('campaign_type', ['connector', 'messenger']);

    if (campError) {
      console.error('Error fetching campaigns:', campError);
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
    }

    if (!activeCampaigns || activeCampaigns.length === 0) {
      console.log('✅ No active campaigns');
      return NextResponse.json({ success: true, message: 'No active campaigns', queued: 0 });
    }

    console.log(`📊 Found ${activeCampaigns.length} active campaigns`);

    let totalQueued = 0;
    const campaignsProcessed = [];

    for (const campaign of activeCampaigns) {
      console.log(`\n🔍 Checking campaign: ${campaign.id} (${campaign.campaign_name || 'unnamed'})`);

      // 2. Get prospects that need to be queued
      // CRITICAL FIX (Dec 4): Include company, title for full personalization
      // FIX (Dec 4): campaign_prospects has company_name, NOT company
      // FIX (Dec 4): For messenger campaigns, prospects are 'approved' (1st connections), not 'pending'
      const isMessengerCampaign = campaign.campaign_type === 'messenger';
      const targetStatuses = isMessengerCampaign
        ? ['approved', 'pending']  // Messenger: queue approved/pending 1st connections
        : ['pending', 'approved']; // Connector: queue pending OR approved prospects (approval flow sets 'approved')

      const { data: pendingProspects, error: prospError } = await supabase
        .from('campaign_prospects')
        .select('id, first_name, last_name, linkedin_url, linkedin_user_id, company_name, title')
        .eq('campaign_id', campaign.id)
        .in('status', targetStatuses)
        .not('linkedin_url', 'is', null);

      if (prospError) {
        console.error(`  ❌ Error fetching prospects for ${campaign.id}:`, prospError.message);
        continue;
      }

      if (!pendingProspects || pendingProspects.length === 0) {
        console.log(`  ⏭️ No pending prospects with linkedin_url for ${campaign.id}`);
        continue;
      }

      console.log(`  📊 Found ${pendingProspects.length} pending prospects with linkedin_url`);

      // 3. Check which are already in queue FOR THIS CAMPAIGN
      // FIX (Dec 18): Don't use .in() with large arrays - it can fail silently
      // Instead, get ALL queue entries for this campaign and filter locally
      const { data: existingQueue, error: queueError } = await supabase
        .from('send_queue')
        .select('prospect_id')
        .eq('campaign_id', campaign.id);

      if (queueError) {
        console.error(`  ❌ Error checking queue for ${campaign.id}:`, queueError.message);
        continue;
      }

      console.log(`  📬 Existing queue entries (this campaign): ${existingQueue?.length || 0}`);

      const existingIds = new Set((existingQueue || []).map(q => q.prospect_id));
      let unqueuedProspects = pendingProspects.filter(p => !existingIds.has(p.id));

      console.log(`  🆕 After same-campaign filter: ${unqueuedProspects.length} unqueued`);

      // ============================================
      // CROSS-CAMPAIGN DEDUPLICATION (Dec 5, 2025)
      // Prevents: "Should delay", "Cannot resend yet", "Cannot invite attendee"
      // ============================================

      if (unqueuedProspects.length > 0) {
        // Get all linkedin_urls for unqueued prospects
        const linkedinUrls = unqueuedProspects
          .map(p => p.linkedin_url)
          .filter(Boolean) as string[];

        // FIX (Dec 19): Also extract slugs for send_queue comparison
        // send_queue.linkedin_user_id stores slugs/provider_ids, NOT full URLs
        const linkedinSlugs = unqueuedProspects
          .map(p => extractLinkedInSlug(p.linkedin_url))
          .filter(Boolean) as string[];

        // Normalize URLs for comparison (remove trailing slashes, lowercase)
        const normalizeUrl = (url: string) => url?.toLowerCase().replace(/\/+$/, '').trim();

        // FIX (Dec 18): Batch the .in() queries to avoid silent failures with large arrays
        // Supabase/PostgREST has limits on array size in .in() clauses
        const BATCH_SIZE = 100;
        const sentSlugs = new Set<string>();
        const contactedUrls = new Set<string>();

        // 3a. Check if linkedin_user_id was ALREADY SENT in ANY campaign's send_queue (batched)
        // FIX (Dec 19): Use slugs, not URLs - send_queue.linkedin_user_id stores slugs/provider_ids
        for (let i = 0; i < linkedinSlugs.length; i += BATCH_SIZE) {
          const batch = linkedinSlugs.slice(i, i + BATCH_SIZE);
          const { data: previouslySent, error: sentError } = await supabase
            .from('send_queue')
            .select('linkedin_user_id')
            .in('status', ['sent', 'pending', 'failed', 'skipped'])
            .in('linkedin_user_id', batch);

          if (sentError) {
            console.error(`  ❌ Error checking cross-campaign queue (batch ${i}):`, sentError.message);
          }
          (previouslySent || []).forEach(s => sentSlugs.add(s.linkedin_user_id?.toLowerCase()));
        }

        // 3b. Check if linkedin_url exists in ANY campaign_prospects with contacted status (batched)
        const contactedStatuses = [
          'connection_request_sent',
          'already_invited',
          'connected',
          'messaged',
          'replied',
          'failed'  // Don't retry failed ones either
        ];

        for (let i = 0; i < linkedinUrls.length; i += BATCH_SIZE) {
          const batch = linkedinUrls.slice(i, i + BATCH_SIZE);
          const { data: previouslyContacted, error: contactedError } = await supabase
            .from('campaign_prospects')
            .select('linkedin_url')
            .in('status', contactedStatuses)
            .in('linkedin_url', batch);

          if (contactedError) {
            console.error(`  ❌ Error checking contacted prospects (batch ${i}):`, contactedError.message);
          }
          (previouslyContacted || []).forEach(c => contactedUrls.add(normalizeUrl(c.linkedin_url)));
        }

        // Filter out prospects already contacted
        const beforeCount = unqueuedProspects.length;
        unqueuedProspects = unqueuedProspects.filter(p => {
          const normalizedUrl = normalizeUrl(p.linkedin_url);
          // FIX (Dec 19): Also check by slug for send_queue comparison
          const slug = extractLinkedInSlug(p.linkedin_url)?.toLowerCase();
          const inSentQueue = slug ? sentSlugs.has(slug) : false;
          const wasContacted = contactedUrls.has(normalizedUrl);

          if (inSentQueue || wasContacted) {
            // Only log first 5 skipped to avoid log spam
            if (beforeCount - unqueuedProspects.length < 5) {
              console.log(`  🚫 Skipping ${p.first_name} ${p.last_name} - already contacted (queue: ${inSentQueue}, status: ${wasContacted})`);
            }
            return false;
          }
          return true;
        });

        const skippedCount = beforeCount - unqueuedProspects.length;
        if (skippedCount > 0) {
          console.log(`  ⚠️ Skipped ${skippedCount} prospects already contacted in other campaigns`);
        }
      }

      console.log(`  🆕 Unqueued prospects: ${unqueuedProspects.length}`);

      if (unqueuedProspects.length === 0) {
        console.log(`  ⏭️ All ${pendingProspects.length} prospects already in queue`);
        continue;
      }

      console.log(`⚠️ Campaign "${campaign.campaign_name}": ${unqueuedProspects.length} unqueued prospects`);

      // 4. Queue them with 2-minute spacing
      // CRITICAL FIX (Dec 4): Check multiple sources for connection message
      // FIX (Dec 4): Handle messenger campaigns - use direct_message_1 instead of connection_request
      const linkedinConfig = campaign.linkedin_config as { connection_message?: string } | null;
      const isMessenger = campaign.campaign_type === 'messenger';

      let messageTemplate: string | null = null;
      let messageType: string;

      if (isMessenger) {
        // Messenger campaigns send direct messages to 1st connections
        messageTemplate = campaign.message_templates?.direct_message_1 || null;
        messageType = 'direct_message_1';
      } else {
        // Connector campaigns send connection requests
        messageTemplate =
          campaign.message_templates?.connection_request ||
          campaign.connection_message ||
          linkedinConfig?.connection_message ||
          null;
        messageType = 'connection_request';
      }

      if (!messageTemplate) {
        console.error(`⚠️ Campaign "${campaign.campaign_name}" (${campaign.campaign_type}) has NO ${isMessenger ? 'direct_message_1' : 'connection message'} - skipping`);
        continue;
      }

      // RANDOMIZED SCHEDULING (Dec 11, 2025)
      // Instead of fixed intervals, use random 20-45 minute gaps
      // This looks more human-like and avoids LinkedIn detection
      const MIN_SPACING_MINUTES = 20;
      const MAX_SPACING_MINUTES = 45;
      const queueRecords = [];

      // Start with a random offset (0-15 minutes from now)
      const initialOffset = Math.floor(Math.random() * 15);
      let currentTime = new Date(Date.now() + initialOffset * 60 * 1000);

      // Helper: Get random interval between min and max
      const getRandomInterval = () => {
        return MIN_SPACING_MINUTES + Math.floor(Math.random() * (MAX_SPACING_MINUTES - MIN_SPACING_MINUTES + 1));
      };

      // ============================================
      // TIMEZONE-AWARE BUSINESS HOURS (Dec 15, 2025)
      // Uses workspace.settings.default_timezone or timezone
      // Falls back to America/Los_Angeles (PST) if not set
      // ============================================
      type WorkspaceSettings = {
        default_timezone?: string;
        timezone?: string;
        default_working_hours?: { start: number; end: number };
      };

      const workspace = (campaign as any).workspaces as { settings: WorkspaceSettings } | null;
      const workspaceSettings = workspace?.settings || {} as WorkspaceSettings;

      // Get timezone from workspace settings (supports both field names)
      const timezone = workspaceSettings.default_timezone || workspaceSettings.timezone || 'America/Los_Angeles';

      // Get business hours from workspace settings or default to 9-17
      const businessHoursStart = workspaceSettings.default_working_hours?.start || 9;
      const businessHoursEnd = workspaceSettings.default_working_hours?.end || 17;

      console.log(`  🌍 Using timezone: ${timezone} (business hours: ${businessHoursStart}:00-${businessHoursEnd}:00)`);

      // Helper: Get hour in target timezone
      const getHourInTimezone = (date: Date, tz: string): number => {
        const formatter = new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          hour12: false,
          timeZone: tz
        });
        return parseInt(formatter.format(date), 10);
      };

      // Helper: Get day of week in target timezone (0 = Sunday, 6 = Saturday)
      const getDayInTimezone = (date: Date, tz: string): number => {
        const formatter = new Intl.DateTimeFormat('en-US', {
          weekday: 'short',
          timeZone: tz
        });
        const day = formatter.format(date);
        const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
        return dayMap[day] ?? 0;
      };

      // Helper: Check if time is within business hours in the workspace timezone
      const isBusinessHours = (date: Date) => {
        const hour = getHourInTimezone(date, timezone);
        return hour >= businessHoursStart && hour < businessHoursEnd;
      };

      // Helper: Check if date is a weekend in the workspace timezone
      const isWeekend = (date: Date) => {
        const day = getDayInTimezone(date, timezone);
        return day === 0 || day === 6; // Sunday = 0, Saturday = 6
      };

      // Helper: Move to next business day at start of business hours
      const moveToNextBusinessDay = (date: Date) => {
        const next = new Date(date);

        // Get current hour in timezone to calculate offset to next business day start
        const currentHour = getHourInTimezone(next, timezone);

        // If we're before business hours today, move to business hours start
        if (currentHour < businessHoursStart && !isWeekend(next)) {
          // Calculate how many hours to add to reach businessHoursStart
          const hoursToAdd = businessHoursStart - currentHour;
          next.setTime(next.getTime() + hoursToAdd * 60 * 60 * 1000);
          // Reset minutes to 0
          next.setMinutes(0, 0, 0);
          return next;
        }

        // Otherwise, move to tomorrow and set to business hours start
        next.setTime(next.getTime() + 24 * 60 * 60 * 1000);

        // Skip weekends
        while (isWeekend(next)) {
          next.setTime(next.getTime() + 24 * 60 * 60 * 1000);
        }

        // Set to business hours start
        const targetHour = getHourInTimezone(next, timezone);
        const hoursToAdd = businessHoursStart - targetHour;
        next.setTime(next.getTime() + hoursToAdd * 60 * 60 * 1000);
        next.setMinutes(0, 0, 0);

        return next;
      };

      // Helper: Validate linkedin_user_id format
      // Valid formats: ACo/ACw IDs, LinkedIn URLs, or vanity names
      const isValidLinkedInId = (id: string | null | undefined): boolean => {
        if (!id) return false;
        const trimmed = id.trim();
        // Valid ACo/ACw ID (preferred)
        if (trimmed.startsWith('ACo') || trimmed.startsWith('ACw')) return true;
        // LinkedIn URL (will be resolved at send time)
        if (trimmed.includes('linkedin.com/in/')) return true;
        // Vanity name (alphanumeric with dashes, will be resolved)
        if (/^[a-zA-Z0-9-]+$/.test(trimmed) && trimmed.length >= 3) return true;
        return false;
      };

      for (let i = 0; i < unqueuedProspects.length; i++) {
        const prospect = unqueuedProspects[i];

        // Pre-validate LinkedIn ID before queuing
        const linkedinId = prospect.linkedin_user_id || prospect.linkedin_url;
        if (!isValidLinkedInId(linkedinId)) {
          console.log(`  ⚠️ Skipping ${prospect.first_name} ${prospect.last_name} - invalid LinkedIn ID: "${linkedinId}"`);
          continue;
        }

        // Skip weekends
        while (isWeekend(currentTime)) {
          currentTime = moveToNextBusinessDay(currentTime);
        }

        // If outside business hours, move to next business day
        if (!isBusinessHours(currentTime)) {
          currentTime = moveToNextBusinessDay(currentTime);
        }

        const scheduledTime = new Date(currentTime);

        // Full personalization - all variable formats
        // FIX (Dec 18): Normalize company name to human-friendly format
        // "Goldman Sachs Group, Inc." → "Goldman Sachs"
        const firstName = prospect.first_name || '';
        const lastName = prospect.last_name || '';
        const rawCompanyName = prospect.company_name || '';
        const companyName = normalizeCompanyName(rawCompanyName) || rawCompanyName;
        const title = prospect.title || '';

        // Log original template for debugging
        if (i === 0) {
          console.log(`  📝 Original template (${messageType}): "${messageTemplate.substring(0, 80)}..."`);
        }

        // CRITICAL: Process double-brace {{var}} BEFORE single-brace {var}
        // Otherwise {firstName} matches inside {{firstName}} leaving {value}
        const personalizedMessage = messageTemplate
          // Double-brace patterns FIRST (most specific)
          .replace(/\{\{firstName\}\}/g, firstName)
          .replace(/\{\{lastName\}\}/g, lastName)
          .replace(/\{\{companyName\}\}/g, companyName)
          .replace(/\{\{company\}\}/gi, companyName)
          .replace(/\{\{first_name\}\}/gi, firstName)
          .replace(/\{\{last_name\}\}/gi, lastName)
          .replace(/\{\{company_name\}\}/gi, companyName)
          // Single-brace patterns AFTER (less specific)
          .replace(/\{firstName\}/g, firstName)
          .replace(/\{lastName\}/g, lastName)
          .replace(/\{companyName\}/g, companyName)
          .replace(/\{first_name\}/gi, firstName)
          .replace(/\{last_name\}/gi, lastName)
          .replace(/\{company_name\}/gi, companyName)
          .replace(/\{company\}/gi, companyName)
          .replace(/\{title\}/gi, title);

        // Log first personalized message for debugging
        if (i === 0) {
          console.log(`  ✨ Personalized (${firstName}): "${personalizedMessage.substring(0, 80)}..."`);
        }

        // CRITICAL FIX (Dec 18): Extract slug from URL to prevent "User ID does not match format" errors
        // Use getBestLinkedInIdentifier to get the cleanest ID format
        const cleanLinkedInId = getBestLinkedInIdentifier(prospect) || extractLinkedInSlug(prospect.linkedin_url);

        queueRecords.push({
          campaign_id: campaign.id,
          prospect_id: prospect.id,
          linkedin_user_id: cleanLinkedInId,
          message: personalizedMessage,
          scheduled_for: scheduledTime.toISOString(),
          status: 'pending',
          message_type: messageType  // 'connection_request' for connector, 'direct_message_1' for messenger
        });

        // Advance time by random interval (20-45 minutes)
        const randomInterval = getRandomInterval();
        currentTime = new Date(currentTime.getTime() + randomInterval * 60 * 1000);

        // Log scheduling for first few prospects
        if (i < 3) {
          console.log(`  📅 Scheduled ${firstName} at ${scheduledTime.toISOString()} (next: +${randomInterval}min)`);
        }
      }

      // 5. Insert queue records ONE BY ONE to prevent batch failures
      // CRITICAL FIX (Dec 18): Batch inserts fail ALL records if ANY has a constraint violation
      // One-by-one inserts allow partial success and proper error tracking
      let insertedCount = 0;
      let insertErrors: string[] = [];

      for (const record of queueRecords) {
        const { error: insertError } = await supabase
          .from('send_queue')
          .insert(record);

        if (insertError) {
          insertErrors.push(`${record.linkedin_user_id}: ${insertError.message}`);
          // Log first few errors only to avoid spam
          if (insertErrors.length <= 3) {
            console.warn(`  ⚠️ Failed to queue: ${insertError.message}`);
          }
        } else {
          insertedCount++;
        }
      }

      if (insertErrors.length > 0) {
        console.error(`  ❌ ${insertErrors.length} queue inserts failed for ${campaign.campaign_name}`);
      }

      totalQueued += insertedCount;
      campaignsProcessed.push({
        name: campaign.campaign_name,
        queued: insertedCount
      });

      console.log(`✅ Queued ${insertedCount}/${queueRecords.length} for "${campaign.campaign_name}"`);
    }

    console.log(`\n📊 Total queued: ${totalQueued} prospects across ${campaignsProcessed.length} campaigns`);

    return NextResponse.json({
      success: true,
      totalQueued,
      campaignsProcessed,
      message: totalQueued > 0
        ? `Queued ${totalQueued} prospects`
        : 'All prospects already queued'
    });

  } catch (error: any) {
    console.error('❌ Cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
