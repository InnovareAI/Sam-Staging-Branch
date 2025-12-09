import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

/**
 * Pre-flight Check for Campaign Prospects
 *
 * Comprehensive validation before sending prospects to campaigns:
 * 1. Previous contact history (CR sent, connected, failed, pending)
 * 2. LinkedIn URL validity and profile resolution
 * 3. Actual connection degree from LinkedIn
 * 4. Provider ID (chat ID) resolution for messaging
 * 5. Rate limit status check
 * 6. Duplicate detection within batch
 *
 * Returns categorized results for user review before proceeding.
 */

// Unipile API helper
async function unipileRequest(endpoint: string) {
  const dsn = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
  const apiKey = process.env.UNIPILE_API_KEY;

  if (!apiKey) throw new Error('UNIPILE_API_KEY not configured');

  const baseUrl = dsn.includes('://') ? dsn : `https://${dsn}`;
  const url = `${baseUrl}${endpoint}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-KEY': apiKey,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Unipile API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

interface ProspectCheck {
  id: string;
  name: string;
  linkedin_url?: string;
  email?: string;
  connection_degree?: string;
  // After verification
  verified_provider_id?: string;
  verified_connection_degree?: string;
  profile_exists?: boolean;
  previous_status?: string;
  previous_campaign?: string;
  is_duplicate?: boolean;
  duplicate_of?: string;
  errors: string[];
  warnings: string[];
  can_proceed: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prospects, workspaceId, campaignType } = await req.json();

    if (!prospects || !Array.isArray(prospects)) {
      return NextResponse.json({
        error: 'prospects array is required'
      }, { status: 400 });
    }

    if (!workspaceId) {
      return NextResponse.json({
        error: 'workspaceId is required'
      }, { status: 400 });
    }

    // Verify workspace access
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get Unipile LinkedIn account for this workspace
    const { data: workspaceAccount } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id')
      .eq('workspace_id', workspaceId)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected')
      .single();

    const unipileAccountId = workspaceAccount?.unipile_account_id;
    const canVerifyLinkedIn = !!unipileAccountId;

    console.log(`🔍 Pre-flight check for ${prospects.length} prospects (campaign type: ${campaignType})`);
    const startTime = Date.now();

    // Step 1: Check for duplicates within the batch
    const seenLinkedInUrls = new Map<string, string>(); // normalized URL -> first prospect ID
    const seenEmails = new Map<string, string>(); // email -> first prospect ID

    // Step 2: Get previous contact history from database
    const linkedinUrls: string[] = [];
    const emails: string[] = [];

    for (const prospect of prospects) {
      const linkedinUrl = prospect.contact?.linkedin_url || prospect.linkedin_url || prospect.linkedinUrl;
      const email = prospect.contact?.email || prospect.email;

      if (linkedinUrl) {
        const normalized = normalizeLinkedInUrl(linkedinUrl);
        if (normalized) linkedinUrls.push(normalized);
      }
      if (email) {
        emails.push(email.toLowerCase().trim());
      }
    }

    // Query existing prospects
    console.log(`⏱️ Starting existing prospects query (${linkedinUrls.length} URLs, ${emails.length} emails) at ${Date.now() - startTime}ms`);
    const existingProspects = await fetchExistingProspects(supabase, workspaceId, linkedinUrls, emails);
    console.log(`⏱️ Existing prospects query complete (${existingProspects.length} found) at ${Date.now() - startTime}ms`);

    // Step 3: Check rate limit status based on campaign type
    // - Connector: 20/day, 100/week (LinkedIn CR limits)
    // - Messenger: 100/day, 700/week (LinkedIn message limits)
    // - Email: 40/day per account
    let rateLimitStatus = null;
    if (campaignType === 'connector') {
      rateLimitStatus = await checkConnectorRateLimitStatus(supabase, workspaceId);
    } else if (campaignType === 'messenger') {
      rateLimitStatus = await checkMessengerRateLimitStatus(supabase, workspaceId);
    } else if (campaignType === 'email') {
      rateLimitStatus = await checkEmailRateLimitStatus(supabase, workspaceId);
    }

    // Step 4: Process each prospect
    const results: ProspectCheck[] = [];
    let processedCount = 0;

    for (const prospect of prospects) {
      const linkedinUrl = prospect.contact?.linkedin_url || prospect.linkedin_url || prospect.linkedinUrl;
      const email = prospect.contact?.email || prospect.email;
      const name = prospect.name || prospect.contact?.name || 'Unknown';
      const prospectId = prospect.id || `temp_${processedCount}`;

      const check: ProspectCheck = {
        id: prospectId,
        name,
        linkedin_url: linkedinUrl,
        email,
        connection_degree: prospect.connection_degree || prospect.connectionDegree,
        errors: [],
        warnings: [],
        can_proceed: true
      };

      // Check for duplicates within batch
      if (linkedinUrl) {
        const normalizedUrl = normalizeLinkedInUrl(linkedinUrl);
        if (normalizedUrl) {
          if (seenLinkedInUrls.has(normalizedUrl)) {
            check.is_duplicate = true;
            check.duplicate_of = seenLinkedInUrls.get(normalizedUrl);
            check.errors.push('Duplicate LinkedIn URL in batch');
            check.can_proceed = false;
          } else {
            seenLinkedInUrls.set(normalizedUrl, prospectId);
          }
        }
      }

      if (email) {
        const normalizedEmail = email.toLowerCase().trim();
        if (seenEmails.has(normalizedEmail)) {
          check.is_duplicate = true;
          check.duplicate_of = seenEmails.get(normalizedEmail);
          check.warnings.push('Duplicate email in batch');
        } else {
          seenEmails.set(normalizedEmail, prospectId);
        }
      }

      // Check previous contact history
      const previousContact = findPreviousContact(existingProspects, linkedinUrl, email);
      if (previousContact) {
        check.previous_status = previousContact.status;
        check.previous_campaign = previousContact.campaign_name;

        if (['connection_request_sent', 'connected', 'replied', 'messaging', 'completed'].includes(previousContact.status)) {
          check.errors.push(`Already contacted (${previousContact.status}) in "${previousContact.campaign_name}"`);
          check.can_proceed = false;
        } else if (previousContact.status === 'already_invited') {
          check.errors.push('Has pending LinkedIn invitation');
          check.can_proceed = false;
        } else if (previousContact.status === 'failed') {
          check.warnings.push(`Previously failed: ${previousContact.error_message || 'Unknown error'}`);
        }
      }

      // For LinkedIn campaigns, verify profile and get provider_id
      if (campaignType !== 'email' && linkedinUrl && canVerifyLinkedIn && !check.is_duplicate) {
        try {
          const vanityMatch = linkedinUrl.match(/linkedin\.com\/in\/([^\/?#]+)/i);
          if (vanityMatch) {
            const vanityId = vanityMatch[1];

            // Rate limit: Don't overload API - process max 20 profiles
            if (processedCount < 20) {
              const profile = await unipileRequest(`/api/v1/users/${vanityId}?account_id=${unipileAccountId}`);

              if (profile.provider_id) {
                check.verified_provider_id = profile.provider_id;
                check.profile_exists = true;

                // Get actual connection degree
                if (profile.network_distance === 'FIRST_DEGREE') {
                  check.verified_connection_degree = '1st';
                } else if (profile.network_distance === 'SECOND_DEGREE') {
                  check.verified_connection_degree = '2nd';
                } else if (profile.network_distance === 'THIRD_DEGREE') {
                  check.verified_connection_degree = '3rd';
                } else {
                  check.verified_connection_degree = 'OUT_OF_NETWORK';
                }

                // Check campaign type compatibility
                if (campaignType === 'messenger' && check.verified_connection_degree !== '1st') {
                  check.errors.push(`Not 1st degree connection (${check.verified_connection_degree}) - use Connector campaign`);
                  check.can_proceed = false;
                } else if (campaignType === 'connector' && check.verified_connection_degree === '1st') {
                  check.warnings.push('Already connected - consider Messenger campaign instead');
                }
              } else {
                check.profile_exists = false;
                check.warnings.push('Could not resolve LinkedIn profile');
              }

              // Small delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 100));
            } else {
              check.warnings.push('Profile not verified (batch limit reached)');
            }
          } else {
            check.errors.push('Invalid LinkedIn URL format');
            check.can_proceed = false;
          }
        } catch (error) {
          check.warnings.push(`Profile lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Email campaign validation
      if (campaignType === 'email') {
        if (!email || !email.includes('@')) {
          check.errors.push('Missing or invalid email address');
          check.can_proceed = false;
        }
      }

      results.push(check);
      processedCount++;
    }

    // Summarize results
    const summary = {
      total: results.length,
      canProceed: results.filter(r => r.can_proceed).length,
      blocked: results.filter(r => !r.can_proceed).length,
      alreadyContacted: results.filter(r => r.previous_status && ['connection_request_sent', 'connected', 'replied'].includes(r.previous_status)).length,
      pendingInvitation: results.filter(r => r.previous_status === 'already_invited').length,
      previouslyFailed: results.filter(r => r.previous_status === 'failed').length,
      duplicates: results.filter(r => r.is_duplicate).length,
      wrongDegree: results.filter(r => r.errors.some(e => e.includes('degree'))).length,
      profileNotFound: results.filter(r => r.profile_exists === false).length,
      verified: results.filter(r => r.verified_provider_id).length,
      rateLimitStatus
    };

    console.log(`⏱️ Total preflight time: ${Date.now() - startTime}ms`);
    console.log(`📊 Pre-flight complete:
      - Can proceed: ${summary.canProceed}
      - Blocked: ${summary.blocked}
      - Already contacted: ${summary.alreadyContacted}
      - Pending invitation: ${summary.pendingInvitation}
      - Duplicates: ${summary.duplicates}
      - Wrong degree: ${summary.wrongDegree}`);

    return NextResponse.json({
      success: true,
      results,
      summary,
      // Return only prospects that can proceed
      validProspects: results
        .filter(r => r.can_proceed)
        .map(r => ({
          ...prospects.find(p => (p.id || `temp_${prospects.indexOf(p)}`) === r.id),
          linkedin_user_id: r.verified_provider_id,
          connection_degree: r.verified_connection_degree || r.connection_degree
        }))
    });

  } catch (error) {
    console.error('Pre-flight check error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Full error details:', JSON.stringify(error, null, 2));
    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: errorMessage
    }, { status: 500 });
  }
}

// Helper: Normalize LinkedIn URL
function normalizeLinkedInUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([^\/?#]+)/i);
  if (!match) return null;
  return match[1].toLowerCase().replace(/\/+$/, '');
}

// Helper: Fetch existing prospects from database
// FIX (Dec 9, 2025): Batch queries to handle 200+ prospects without OR query overflow
async function fetchExistingProspects(
  supabase: any,
  workspaceId: string,
  linkedinUrls: string[],
  emails: string[]
): Promise<any[]> {
  const results: any[] = [];
  const BATCH_SIZE = 50; // Process 50 at a time to avoid query length issues

  // Query by LinkedIn URL in batches
  if (linkedinUrls.length > 0) {
    for (let i = 0; i < linkedinUrls.length; i += BATCH_SIZE) {
      const batch = linkedinUrls.slice(i, i + BATCH_SIZE);
      const linkedinConditions = batch.map(url => `linkedin_url.ilike.%${url}%`).join(',');

      try {
        const { data, error } = await supabase
          .from('campaign_prospects')
          .select('linkedin_url, email, status, error_message, campaigns(campaign_name)')
          .eq('workspace_id', workspaceId)
          .or(linkedinConditions);

        if (error) {
          console.error(`Error fetching batch ${i / BATCH_SIZE + 1}:`, error);
          continue;
        }
        if (data) results.push(...data);
      } catch (batchError) {
        console.error(`Exception in batch ${i / BATCH_SIZE + 1}:`, batchError);
        continue;
      }
    }
  }

  // Query by email in batches
  if (emails.length > 0) {
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE);

      try {
        const { data, error } = await supabase
          .from('campaign_prospects')
          .select('linkedin_url, email, status, error_message, campaigns(campaign_name)')
          .eq('workspace_id', workspaceId)
          .in('email', batch);

        if (error) {
          console.error(`Error fetching email batch ${i / BATCH_SIZE + 1}:`, error);
          continue;
        }
        if (data) results.push(...data);
      } catch (batchError) {
        console.error(`Exception in email batch ${i / BATCH_SIZE + 1}:`, batchError);
        continue;
      }
    }
  }

  return results;
}

// Helper: Find previous contact for a prospect
function findPreviousContact(
  existingProspects: any[],
  linkedinUrl?: string,
  email?: string
): { status: string; campaign_name: string; error_message?: string } | null {
  const normalizedUrl = linkedinUrl ? normalizeLinkedInUrl(linkedinUrl) : null;
  const normalizedEmail = email?.toLowerCase().trim();

  for (const existing of existingProspects) {
    const existingUrl = existing.linkedin_url ? normalizeLinkedInUrl(existing.linkedin_url) : null;
    const existingEmail = existing.email?.toLowerCase().trim();

    if ((normalizedUrl && existingUrl === normalizedUrl) ||
        (normalizedEmail && existingEmail === normalizedEmail)) {
      return {
        status: existing.status,
        campaign_name: existing.campaigns?.campaign_name || 'Unknown Campaign',
        error_message: existing.error_message
      };
    }
  }

  return null;
}

// Helper: Check Connector (LinkedIn CR) rate limit status
async function checkConnectorRateLimitStatus(supabase: any, workspaceId: string): Promise<{
  dailyUsed: number;
  dailyLimit: number;
  weeklyUsed: number;
  weeklyLimit: number;
  canSend: boolean;
  warning?: string;
}> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Count CRs sent today
  const { count: dailyCount } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'connection_request_sent')
    .gte('contacted_at', todayStart);

  // Count CRs sent this week
  const { count: weeklyCount } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'connection_request_sent')
    .gte('contacted_at', weekStart);

  const dailyLimit = 20; // LinkedIn daily limit
  const weeklyLimit = 100; // LinkedIn weekly limit

  const dailyUsed = dailyCount || 0;
  const weeklyUsed = weeklyCount || 0;

  let warning: string | undefined;
  if (dailyUsed >= dailyLimit) {
    warning = 'Daily limit reached! Wait until tomorrow.';
  } else if (weeklyUsed >= weeklyLimit) {
    warning = 'Weekly limit reached! Wait until next week.';
  } else if (dailyUsed >= dailyLimit * 0.8) {
    warning = `Approaching daily limit (${dailyUsed}/${dailyLimit})`;
  } else if (weeklyUsed >= weeklyLimit * 0.8) {
    warning = `Approaching weekly limit (${weeklyUsed}/${weeklyLimit})`;
  }

  return {
    dailyUsed,
    dailyLimit,
    weeklyUsed,
    weeklyLimit,
    canSend: dailyUsed < dailyLimit && weeklyUsed < weeklyLimit,
    warning
  };
}

// Helper: Check Email rate limit status (40 emails/day per account)
async function checkEmailRateLimitStatus(supabase: any, workspaceId: string): Promise<{
  dailyUsed: number;
  dailyLimit: number;
  weeklyUsed: number;
  weeklyLimit: number;
  canSend: boolean;
  warning?: string;
}> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  // Count emails sent today from email campaigns
  const { count: dailyCount } = await supabase
    .from('campaign_prospects')
    .select('*, campaigns!inner(campaign_type)', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('campaigns.campaign_type', 'email')
    .in('status', ['contacted', 'messaging', 'replied', 'completed'])
    .gte('contacted_at', todayStart);

  const dailyLimit = 40; // Email daily limit per account
  const dailyUsed = dailyCount || 0;

  let warning: string | undefined;
  if (dailyUsed >= dailyLimit) {
    warning = 'Daily email limit reached! Wait until tomorrow.';
  } else if (dailyUsed >= dailyLimit * 0.8) {
    warning = `Approaching daily limit (${dailyUsed}/${dailyLimit})`;
  }

  return {
    dailyUsed,
    dailyLimit,
    weeklyUsed: 0, // Email doesn't have weekly limit
    weeklyLimit: 0,
    canSend: dailyUsed < dailyLimit,
    warning
  };
}

// Helper: Check Messenger (LinkedIn DM) rate limit status - 100/day, 700/week
async function checkMessengerRateLimitStatus(supabase: any, workspaceId: string): Promise<{
  dailyUsed: number;
  dailyLimit: number;
  weeklyUsed: number;
  weeklyLimit: number;
  canSend: boolean;
  warning?: string;
}> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  // Calculate week start (Monday)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
  weekStart.setHours(0, 0, 0, 0);
  const weekStartISO = weekStart.toISOString();

  // Count messages sent today from messenger campaigns
  const { count: dailyCount } = await supabase
    .from('campaign_prospects')
    .select('*, campaigns!inner(campaign_type)', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('campaigns.campaign_type', 'messenger')
    .in('status', ['contacted', 'messaging', 'replied', 'completed'])
    .gte('contacted_at', todayStart);

  // Count messages sent this week from messenger campaigns
  const { count: weeklyCount } = await supabase
    .from('campaign_prospects')
    .select('*, campaigns!inner(campaign_type)', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('campaigns.campaign_type', 'messenger')
    .in('status', ['contacted', 'messaging', 'replied', 'completed'])
    .gte('contacted_at', weekStartISO);

  const dailyLimit = 100;
  const weeklyLimit = 700;
  const dailyUsed = dailyCount || 0;
  const weeklyUsed = weeklyCount || 0;

  let warning: string | undefined;
  if (dailyUsed >= dailyLimit) {
    warning = 'Daily message limit reached! Wait until tomorrow.';
  } else if (weeklyUsed >= weeklyLimit) {
    warning = 'Weekly message limit reached! Wait until next week.';
  } else if (dailyUsed >= dailyLimit * 0.8) {
    warning = `Approaching daily limit (${dailyUsed}/${dailyLimit})`;
  } else if (weeklyUsed >= weeklyLimit * 0.8) {
    warning = `Approaching weekly limit (${weeklyUsed}/${weeklyLimit})`;
  }

  return {
    dailyUsed,
    dailyLimit,
    weeklyUsed,
    weeklyLimit,
    canSend: dailyUsed < dailyLimit && weeklyUsed < weeklyLimit,
    warning
  };
}
