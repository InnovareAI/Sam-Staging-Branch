import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabase-route-client'
import { enrichProspectName, normalizeFullName } from '@/lib/enrich-prospect-name'

// Helper to normalize LinkedIn URL to vanity name (for deduplication)
function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  if (match) {
    return match[1].toLowerCase().trim();
  }
  return url.replace(/^\/+|\/+$/g, '').toLowerCase().trim();
}

/**
 * POST /api/campaigns/add-approved-prospects
 * Add approved prospects to a campaign
 * IMPORTANT: Automatically enriches missing names from LinkedIn via Unipile
 *
 * DATABASE-FIRST ARCHITECTURE (Dec 2025):
 * 1. Upsert prospects to workspace_prospects (master table)
 * 2. Insert to campaign_prospects WITH master_prospect_id FK
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient()

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const body = await request.json()
    const { campaign_id, workspace_id, prospect_ids } = body

    if (!campaign_id || !workspace_id || !prospect_ids || !Array.isArray(prospect_ids)) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: campaign_id, workspace_id, prospect_ids'
      }, { status: 400 })
    }

    // Verify workspace access
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({
        success: false,
        error: 'Not a member of this workspace'
      }, { status: 403 })
    }

    // Get approved prospect data (with session info for workspace validation)
    const { data: prospects, error: prospectError } = await supabase
      .from('prospect_approval_data')
      .select(`
        *,
        prospect_approval_sessions(
          workspace_id,
          campaign_name,
          campaign_tag
        )
      `)
      .in('prospect_id', prospect_ids)
      .eq('approval_status', 'approved')

    // Filter prospects that match workspace_id
    const validProspects = (prospects || []).filter(
      p => p.prospect_approval_sessions?.workspace_id === workspace_id
    )

    if (prospectError) {
      console.error('Error fetching approved prospects:', prospectError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch approved prospects'
      }, { status: 500 })
    }

    if (!validProspects || validProspects.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No approved prospects found with provided IDs for this workspace'
      }, { status: 404 })
    }

    // CRITICAL: Check if any prospects are already in active campaigns
    // This prevents the same person from receiving conflicting messages from multiple campaigns
    const linkedinUrls = validProspects
      .map(p => p.contact?.linkedin_url || p.linkedin_url)
      .filter(Boolean)
      .map(url => url.toLowerCase().trim().replace(/\/$/, ''))

    const emails = validProspects
      .map(p => p.contact?.email)
      .filter(Boolean)
      .map(email => email.toLowerCase().trim())

    // Find prospects already in active campaigns (sequence not completed)
    const { data: existingProspects, error: checkError } = await supabase
      .from('campaign_prospects')
      .select(`
        id,
        first_name,
        last_name,
        linkedin_url,
        email,
        status,
        campaign_id,
        campaigns!inner(name, status)
      `)
      .eq('workspace_id', workspace_id)
      .neq('campaign_id', campaign_id) // Different campaign
      .in('status', ['pending', 'approved', 'processing', 'cr_sent', 'fu1_sent', 'fu2_sent', 'fu3_sent', 'fu4_sent', 'fu5_sent', 'connection_requested', 'connected', 'messaging', 'completed'])
      .or(`linkedin_url.in.(${linkedinUrls.length > 0 ? linkedinUrls.map(u => `"${u}"`).join(',') : '""'}),email.in.(${emails.length > 0 ? emails.map(e => `"${e}"`).join(',') : '""'})`)

    if (checkError) {
      console.error('Error checking for duplicate prospects:', checkError)
      // Continue anyway - don't block the entire operation
    }

    const conflictingProspects = (existingProspects || []).filter(p => {
      // Only block if the prospect is in an ACTIVE campaign (not completed/archived)
      return p.campaigns?.status === 'active' || p.campaigns?.status === 'draft'
    })

    if (conflictingProspects.length > 0) {
      const conflictDetails = conflictingProspects.map(p => ({
        name: `${p.first_name} ${p.last_name}`,
        linkedin_url: p.linkedin_url,
        current_campaign: p.campaigns?.name || 'Unknown',
        status: p.status
      }))

      console.warn('⚠️ Campaign conflict detected:', {
        count: conflictingProspects.length,
        conflicts: conflictDetails
      })

      return NextResponse.json({
        success: false,
        error: 'campaign_conflict',
        message: `${conflictingProspects.length} prospect(s) are already in active campaigns. Remove them from existing campaigns before adding to this one.`,
        conflicts: conflictDetails
      }, { status: 409 })
    }

    // Get campaign and its LinkedIn account to set prospect ownership
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, created_by, workspace_id')
      .eq('id', campaign_id)
      .single()

    // Get the campaign creator's LinkedIn account (Unipile)
    const { data: linkedInAccount } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', campaign?.created_by)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected')
      .single()

    const unipileAccountId = linkedInAccount?.unipile_account_id || null

    // =========================================================================
    // DATABASE-FIRST ARCHITECTURE (Dec 2025)
    // Step 1: Upsert to workspace_prospects (master table)
    // Step 2: Insert to campaign_prospects WITH master_prospect_id FK
    // =========================================================================

    // Transform and enrich prospects, then upsert to workspace_prospects
    const processedProspects = await Promise.all(validProspects.map(async prospect => {
      // Normalize and extract name parts from SAM data
      const normalized = normalizeFullName(prospect.name || '')
      let firstName = normalized.firstName
      let lastName = normalized.lastName

      // AUTOMATIC ENRICHMENT: If names are missing, fetch from LinkedIn
      if (!firstName || !lastName) {
        console.log('Missing name for prospect, attempting enrichment:', {
          prospect_id: prospect.prospect_id,
          linkedin_url: prospect.contact?.linkedin_url
        });

        const enriched = await enrichProspectName(
          prospect.contact?.linkedin_url || null,
          firstName,
          lastName,
          unipileAccountId
        );

        firstName = enriched.firstName;
        lastName = enriched.lastName;

        if (enriched.enriched) {
          console.log('Successfully enriched name:', {
            prospect_id: prospect.prospect_id,
            name: `${firstName} ${lastName}`
          });
        }
      }

      // Extract LinkedIn URL and provider_id
      let linkedinUrl = prospect.contact?.linkedin_url || prospect.linkedin_url || null;
      const linkedinUserId = prospect.contact?.linkedin_provider_id || null;

      // Clean LinkedIn URL: Remove query parameters
      if (linkedinUrl) {
        try {
          const match = linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
          if (match) {
            linkedinUrl = `https://www.linkedin.com/in/${match[1]}`;
          }
        } catch (error) {
          console.error('Error cleaning LinkedIn URL:', linkedinUrl, error);
        }
      }

      const linkedinUrlHash = normalizeLinkedInUrl(linkedinUrl);
      const email = prospect.contact?.email || null;
      const emailHash = email ? email.toLowerCase().trim() : null;

      return {
        // Data for workspace_prospects
        workspace_id,
        first_name: firstName,
        last_name: lastName,
        linkedin_url: linkedinUrl,
        linkedin_url_hash: linkedinUrlHash,
        linkedin_profile_url: linkedinUrl, // Keep old column in sync
        email,
        email_hash: emailHash,
        company: prospect.company?.name || '',
        company_name: prospect.company?.name || '', // Keep old column in sync
        title: prospect.title || '',
        job_title: prospect.title || '', // Keep old column in sync
        location: prospect.location || null,
        linkedin_provider_id: linkedinUserId,
        connection_degree: prospect.connection_degree,
        source: 'approval_workflow',
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        active_campaign_id: campaign_id,
        enrichment_data: {
          campaign_name: prospect.prospect_approval_sessions?.campaign_name,
          campaign_tag: prospect.prospect_approval_sessions?.campaign_tag,
          industry: prospect.company?.industry?.[0] || null
        },
        // Extra data needed for campaign_prospects
        _campaign_data: {
          linkedin_user_id: linkedinUserId,
          industry: prospect.company?.industry?.[0] || 'Not specified',
          unipile_account_id: unipileAccountId,
          personalization_data: {
            source: 'approved_prospects',
            campaign_name: prospect.prospect_approval_sessions?.campaign_name,
            campaign_tag: prospect.prospect_approval_sessions?.campaign_tag,
            approved_at: new Date().toISOString(),
            connection_degree: prospect.connection_degree
          }
        }
      };
    }));

    // STEP 1: Upsert to workspace_prospects (master table)
    console.log('DATABASE-FIRST: Upserting', processedProspects.length, 'prospects to workspace_prospects');
    const masterProspectIds: Map<string, string> = new Map(); // linkedinUrlHash -> workspace_prospect.id

    for (const prospect of processedProspects) {
      if (!prospect.linkedin_url_hash) continue;

      const workspaceProspectData = {
        workspace_id: prospect.workspace_id,
        first_name: prospect.first_name,
        last_name: prospect.last_name,
        linkedin_url: prospect.linkedin_url,
        linkedin_url_hash: prospect.linkedin_url_hash,
        linkedin_profile_url: prospect.linkedin_profile_url,
        email: prospect.email,
        email_hash: prospect.email_hash,
        company: prospect.company,
        company_name: prospect.company_name,
        title: prospect.title,
        job_title: prospect.job_title,
        location: prospect.location,
        linkedin_provider_id: prospect.linkedin_provider_id,
        connection_degree: prospect.connection_degree,
        source: prospect.source,
        approval_status: prospect.approval_status,
        approved_at: prospect.approved_at,
        active_campaign_id: prospect.active_campaign_id,
        enrichment_data: prospect.enrichment_data
      };

      const { data: upsertedProspect, error: upsertError } = await supabase
        .from('workspace_prospects')
        .upsert(workspaceProspectData, {
          onConflict: 'workspace_id,linkedin_url_hash',
          ignoreDuplicates: false
        })
        .select('id')
        .single();

      if (upsertError) {
        // If upsert failed, try to fetch existing
        if (upsertError.code === '23505') {
          const { data: existing } = await supabase
            .from('workspace_prospects')
            .select('id')
            .eq('workspace_id', workspace_id)
            .eq('linkedin_url_hash', prospect.linkedin_url_hash)
            .single();
          if (existing) {
            masterProspectIds.set(prospect.linkedin_url_hash, existing.id);
            // Update active_campaign_id
            await supabase
              .from('workspace_prospects')
              .update({ active_campaign_id: campaign_id, approval_status: 'approved' })
              .eq('id', existing.id);
          }
        } else {
          console.error('Error upserting workspace_prospect:', upsertError);
        }
      } else if (upsertedProspect) {
        masterProspectIds.set(prospect.linkedin_url_hash, upsertedProspect.id);
      }
    }

    console.log('DATABASE-FIRST: Created/found', masterProspectIds.size, 'workspace_prospects records');

    // STEP 2: Transform for campaign_prospects WITH master_prospect_id
    const campaignProspects = processedProspects.map(prospect => ({
      campaign_id,
      workspace_id,
      master_prospect_id: prospect.linkedin_url_hash ? masterProspectIds.get(prospect.linkedin_url_hash) : null,
      first_name: prospect.first_name,
      last_name: prospect.last_name,
      email: prospect.email,
      company_name: prospect.company_name,
      linkedin_url: prospect.linkedin_url,
      linkedin_url_hash: prospect.linkedin_url_hash,
      linkedin_user_id: prospect._campaign_data.linkedin_user_id,
      title: prospect.title,
      location: prospect.location,
      industry: prospect._campaign_data.industry,
      status: 'approved',
      notes: null,
      added_by_unipile_account: prospect._campaign_data.unipile_account_id,
      personalization_data: prospect._campaign_data.personalization_data
    }));

    // Insert into campaign_prospects
    const { data: insertedProspects, error: insertError } = await supabase
      .from('campaign_prospects')
      .insert(campaignProspects)
      .select()

    if (insertError) {
      console.error('Error inserting campaign prospects:', insertError)
      return NextResponse.json({
        success: false,
        error: 'Failed to add prospects to campaign',
        details: insertError.message
      }, { status: 500 })
    }

    console.log('DATABASE-FIRST: Inserted', insertedProspects.length, 'campaign_prospects with master_prospect_id');

    // Log what was inserted
    const prospectsWithLinkedIn = insertedProspects.filter(p => p.linkedin_url);
    const prospectsWithoutLinkedIn = insertedProspects.filter(p => !p.linkedin_url);

    console.log(`✅ Inserted ${insertedProspects.length} prospects to campaign`);
    console.log(`📊 With LinkedIn URL: ${prospectsWithLinkedIn.length}`);
    console.log(`⚠️  Without LinkedIn URL: ${prospectsWithoutLinkedIn.length}`);

    // CRITICAL: Mark prospects as 'added_to_campaign' in prospect_approval_data
    // This prevents them from showing up in future "approved prospects" lists
    if (prospect_ids && prospect_ids.length > 0) {
      const { error: updateError } = await supabase
        .from('prospect_approval_data')
        .update({ approval_status: 'added_to_campaign' })
        .in('prospect_id', prospect_ids);

      if (updateError) {
        console.warn('⚠️ Failed to update prospect_approval_data status:', updateError.message);
        // Non-fatal - prospects are already added to campaign
      } else {
        console.log(`✅ Marked ${prospect_ids.length} prospects as 'added_to_campaign'`);
      }
    }

    if (prospectsWithoutLinkedIn.length > 0) {
      console.warn('❌ Prospects missing LinkedIn URL:', prospectsWithoutLinkedIn.map(p => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`
      })));
    }

    // AUTO-ENRICHMENT: Enrich prospects with missing company/location data via BrightData
    const needsEnrichment = insertedProspects.filter(p =>
      p.linkedin_url && (
        !p.company_name ||
        p.company_name === 'unavailable' ||
        !p.location ||
        p.location === 'unavailable'
      )
    );

    if (needsEnrichment.length > 0) {
      console.log(`🔍 Auto-enriching ${needsEnrichment.length} prospects with BrightData...`);

      // Call enrichment API asynchronously (don't block the response)
      fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/api/prospects/enrich`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': request.headers.get('cookie') || ''
        },
        body: JSON.stringify({
          prospectIds: needsEnrichment.map(p => p.id),
          autoEnrich: true
        })
      })
      .then(async (res) => {
        if (res.ok) {
          const enrichmentData = await res.json();
          console.log(`✅ Auto-enrichment completed: ${enrichmentData.enriched_count} prospects enriched`);
        } else {
          console.error('⚠️ Auto-enrichment failed:', res.status);
        }
      })
      .catch((err) => {
        console.error('⚠️ Auto-enrichment error:', err.message);
        // Non-fatal - prospects are already added, enrichment is bonus
      });
    }

    return NextResponse.json({
      success: true,
      message: `Added ${insertedProspects.length} prospects to campaign`,
      added_count: insertedProspects.length,
      with_linkedin: prospectsWithLinkedIn.length,
      without_linkedin: prospectsWithoutLinkedIn.length,
      auto_enrichment_triggered: needsEnrichment.length > 0,
      prospects_to_enrich: needsEnrichment.length,
      prospects: insertedProspects
    })

  } catch (error) {
    console.error('Add approved prospects error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
