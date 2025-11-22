import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabase-route-client'
import { enrichProspectName, normalizeFullName } from '@/lib/enrich-prospect-name'

/**
 * POST /api/campaigns/add-approved-prospects
 * Add approved prospects to a campaign
 * IMPORTANT: Automatically enriches missing names from LinkedIn via Unipile
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

    // Transform prospects to campaign_prospects format with automatic name enrichment
    const campaignProspects = await Promise.all(validProspects.map(async prospect => {
      // Normalize and extract name parts from SAM data
      // This removes titles, credentials, and descriptions (e.g., "John Doe CEO, Startups..." → "John Doe")
      const normalized = normalizeFullName(prospect.name || '')
      let firstName = normalized.firstName
      let lastName = normalized.lastName

      // AUTOMATIC ENRICHMENT: If names are missing, fetch from LinkedIn
      if (!firstName || !lastName) {
        console.log('⚠️ Missing name for prospect, attempting enrichment:', {
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
          console.log('✅ Successfully enriched name:', {
            prospect_id: prospect.prospect_id,
            name: `${firstName} ${lastName}`
          });
        }
      }

      // CRITICAL: Extract LinkedIn URL and provider_id from multiple possible locations
      const linkedinUrl = prospect.contact?.linkedin_url || prospect.linkedin_url || null;
      const linkedinUserId = prospect.contact?.linkedin_provider_id || null;

      console.log('📊 Prospect data:', {
        prospect_id: prospect.prospect_id,
        name: `${firstName} ${lastName}`,
        linkedin_url: linkedinUrl,
        linkedin_user_id: linkedinUserId,
        has_contact: !!prospect.contact,
        contact_linkedin: prospect.contact?.linkedin_url,
        contact_provider_id: prospect.contact?.linkedin_provider_id,
        direct_linkedin: prospect.linkedin_url
      });

      return {
        campaign_id,
        workspace_id,
        first_name: firstName,
        last_name: lastName,
        email: prospect.contact?.email || null,
        company_name: prospect.company?.name || '',
        linkedin_url: linkedinUrl, // Cleaned LinkedIn URL (without query parameters)
        linkedin_user_id: linkedinUserId, // Authoritative LinkedIn provider_id (doesn't change)
        title: prospect.title || '',
        location: prospect.location || null,
        industry: prospect.company?.industry?.[0] || 'Not specified',
        status: 'approved',
        notes: null,
        added_by_unipile_account: unipileAccountId, // LinkedIn TOS: track which account found this prospect
        personalization_data: {
          source: 'approved_prospects',
          campaign_name: prospect.prospect_approval_sessions?.campaign_name,
          campaign_tag: prospect.prospect_approval_sessions?.campaign_tag,
          approved_at: new Date().toISOString(),
          connection_degree: prospect.connection_degree
        }
      }
    }))

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

    // Log what was inserted
    const prospectsWithLinkedIn = insertedProspects.filter(p => p.linkedin_url);
    const prospectsWithoutLinkedIn = insertedProspects.filter(p => !p.linkedin_url);

    console.log(`✅ Inserted ${insertedProspects.length} prospects to campaign`);
    console.log(`📊 With LinkedIn URL: ${prospectsWithLinkedIn.length}`);
    console.log(`⚠️  Without LinkedIn URL: ${prospectsWithoutLinkedIn.length}`);

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
      fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/prospects/enrich`, {
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
