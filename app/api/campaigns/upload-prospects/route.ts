import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { enrichProspectName } from '@/lib/enrich-prospect-name';

// Simple JSON-based prospect upload for campaigns
// Used by CampaignHub when prospects are already in memory (not from CSV upload)
// IMPORTANT: Automatically enriches missing names from LinkedIn via Unipile

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Get user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { campaign_id, prospects } = body;

    console.log('📥 Upload prospects request:', {
      campaign_id,
      prospect_count: prospects?.length,
      user_id: user.id,
      user_email: user.email
    });

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 });
    }

    if (!prospects || !Array.isArray(prospects) || prospects.length === 0) {
      return NextResponse.json({ error: 'prospects array is required and must not be empty' }, { status: 400 });
    }

    // Verify campaign exists and user has access
    console.log('🔍 Checking campaign access:', { campaign_id, user_id: user.id });
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, workspace_id')
      .eq('id', campaign_id)
      .single();

    console.log('📊 Campaign query result:', {
      found: !!campaign,
      error: campaignError ? {
        message: campaignError.message,
        code: campaignError.code,
        details: campaignError.details,
        hint: campaignError.hint
      } : null,
      campaign: campaign ? { id: campaign.id, name: campaign.name, workspace_id: campaign.workspace_id } : null
    });

    if (campaignError || !campaign) {
      console.error('❌ Campaign not found or access denied:', {
        campaign_id,
        user_id: user.id,
        error: campaignError
      });
      return NextResponse.json({
        error: 'Campaign not found or access denied',
        details: campaignError ? campaignError.message : 'Campaign not found'
      }, { status: 404 });
    }

    // Verify user has access to this workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', campaign.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
    }

    // Get campaign details including creator for automatic name enrichment
    const { data: campaignDetails } = await supabase
      .from('campaigns')
      .select('created_by')
      .eq('id', campaign_id)
      .single();

    // Get the campaign creator's LinkedIn account for name enrichment
    const { data: linkedInAccount } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id')
      .eq('workspace_id', campaign.workspace_id)
      .eq('user_id', campaignDetails?.created_by)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected')
      .single();

    const unipileAccountId = linkedInAccount?.unipile_account_id || null;

    let inserted_count = 0;
    let updated_count = 0;
    let error_count = 0;
    const errors = [];
    const failedUploads = [];

    // Process each prospect
    for (let i = 0; i < prospects.length; i++) {
      try {
        const prospect = prospects[i];

        // DEBUG: Log what we received (ENHANCED FOR DEBUGGING)
        console.log(`\n🔍 ===== PROSPECT ${i + 1} RAW DATA =====`);
        console.log('Full prospect object:', JSON.stringify(prospect, null, 2));
        console.log('Key fields:');
        console.log('  - name:', prospect.name);
        console.log('  - first_name:', prospect.first_name);
        console.log('  - linkedin_url (direct):', prospect.linkedin_url);
        console.log('  - linkedin_profile_url:', prospect.linkedin_profile_url);
        console.log('  - contact object:', JSON.stringify(prospect.contact, null, 2));
        console.log('  - contact.linkedin_url:', prospect.contact?.linkedin_url);
        console.log('  - company.name:', prospect.company?.name);
        console.log('==========================================\n');

        // Prepare prospect data with automatic name enrichment
        // CRITICAL: Handle both direct fields and nested JSONB fields (contact, company)

        // Extract names from SAM data first
        let firstName = prospect.first_name?.trim() || (prospect.name ? prospect.name.split(' ')[0]?.trim() : '');
        let lastName = prospect.last_name?.trim() || (prospect.name ? prospect.name.split(' ').slice(1).join(' ')?.trim() : '');

        // MANDATORY ENRICHMENT: If names missing or empty, fetch from LinkedIn
        if (!firstName || !lastName || firstName === '' || lastName === '') {
          const linkedinUrl = prospect.linkedin_url || prospect.linkedin_profile_url || prospect.contact?.linkedin_url || null;

          if (linkedinUrl && unipileAccountId) {
            console.log(`⚠️ Missing name for prospect ${i + 1}, ENRICHING from LinkedIn (REQUIRED)`);

            const enriched = await enrichProspectName(
              linkedinUrl,
              firstName,
              lastName,
              unipileAccountId
            );

            firstName = enriched.firstName;
            lastName = enriched.lastName;

            if (enriched.enriched) {
              console.log(`✅ Successfully enriched name: ${firstName} ${lastName}`);
            }
          }

          // CRITICAL: Reject prospects without names
          if (!firstName || !lastName || firstName === '' || lastName === '') {
            console.error(`❌ REJECTING prospect ${i + 1}: Missing name even after enrichment`);
            failedUploads.push({
              row: i + 1,
              error: 'Missing required field: first_name or last_name',
              data: prospect
            });
            continue; // Skip this prospect
          }
        }

        const prospectData = {
          campaign_id: campaign_id,
          workspace_id: campaign.workspace_id,
          first_name: firstName,
          last_name: lastName,
          email: prospect.email || prospect.email_address || prospect.contact?.email || null,
          company_name: prospect.company_name || prospect.company?.name || prospect.company || '',
          title: prospect.title || prospect.job_title || '',
          linkedin_url: prospect.linkedin_url || prospect.linkedin_profile_url || prospect.contact?.linkedin_url || null,
          linkedin_user_id: prospect.linkedin_user_id || null,
          phone: prospect.phone || prospect.contact?.phone || null,
          location: prospect.location || '',
          industry: prospect.industry || prospect.company?.industry?.[0] || prospect.company?.industry || null,
          status: 'pending',
          notes: prospect.notes || null,
          personalization_data: {
            ...(prospect.personalization_data || {}),
            campaign_name: campaign.name,  // ALWAYS include campaign name
            source: 'upload_prospects',
            uploaded_at: new Date().toISOString()
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        console.log('💾 PREPARED DATA TO STORE:');
        console.log('  - first_name:', prospectData.first_name);
        console.log('  - last_name:', prospectData.last_name);
        console.log('  - linkedin_url:', prospectData.linkedin_url);
        console.log('  - company_name:', prospectData.company_name);
        console.log('  - email:', prospectData.email);

        // Check if prospect already exists for this campaign
        const { data: existing } = await supabase
          .from('campaign_prospects')
          .select('id')
          .eq('campaign_id', campaign_id)
          .eq('email', prospectData.email)
          .maybeSingle();

        if (existing) {
          // Update existing prospect
          const { error: updateError } = await supabase
            .from('campaign_prospects')
            .update({
              ...prospectData,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);

          if (updateError) {
            error_count++;
            errors.push({ index: i, error: updateError.message });
          } else {
            updated_count++;
          }
        } else {
          // Insert new prospect
          const { error: insertError } = await supabase
            .from('campaign_prospects')
            .insert(prospectData);

          if (insertError) {
            error_count++;
            errors.push({ index: i, error: insertError.message });
          } else {
            inserted_count++;
          }
        }
      } catch (error: any) {
        error_count++;
        errors.push({ index: i, error: error.message });
      }
    }

    // Count prospects with LinkedIn IDs
    const { count: prospects_with_linkedin_ids } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign_id)
      .not('linkedin_user_id', 'is', null);

    return NextResponse.json({
      success: true,
      message: 'Prospects uploaded successfully',
      campaign: {
        id: campaign.id,
        name: campaign.name
      },
      results: {
        total: prospects.length,
        inserted: inserted_count,
        updated: updated_count,
        errors: error_count
      },
      prospects_with_linkedin_ids: prospects_with_linkedin_ids || 0,
      error_details: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('Prospect upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload prospects', details: error.message },
      { status: 500 }
    );
  }
}
