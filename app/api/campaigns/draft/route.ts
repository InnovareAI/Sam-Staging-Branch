import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Helper to normalize LinkedIn URL to hash (vanity name only)
function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  if (match) {
    return match[1].toLowerCase().trim();
  }
  return url.replace(/^\/+|\/+$/g, '').toLowerCase().trim();
}

/**
 * POST /api/campaigns/draft
 * Save or update a campaign draft
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      draftId, // If updating existing draft
      workspaceId,
      name,
      campaignType,
      currentStep,
      connectionMessage,
      alternativeMessage,
      followUpMessages,
      csvData, // Prospect data
    } = body;

    if (!workspaceId || !name) {
      return NextResponse.json(
        { error: 'workspaceId and name are required' },
        { status: 400 }
      );
    }

    // Verify workspace membership
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // CRITICAL FIX: No longer store csvData in draft_data
    // Prospects go directly into campaign_prospects table
    const draftData = {};

    if (draftId) {
      // Update existing draft
      const { data: campaign, error: updateError } = await supabase
        .from('campaigns')
        .update({
          name,
          campaign_type: campaignType, // FIXED (Dec 7): Don't default - preserve actual campaign type from frontend
          // NOTE: Do NOT set 'type' column - it has a CHECK constraint that rejects 'connector'/'messenger'
          current_step: currentStep,
          connection_message: connectionMessage,
          alternative_message: alternativeMessage,
          follow_up_messages: followUpMessages || [],
          draft_data: draftData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', draftId)
        .eq('workspace_id', workspaceId)
        .eq('status', 'draft') // Only update drafts
        .select()
        .single();

      if (updateError) {
        console.error('Error updating draft:', updateError);
        return NextResponse.json(
          { error: 'Failed to update draft' },
          { status: 500 }
        );
      }

      // DATABASE-FIRST: Upsert to workspace_prospects then campaign_prospects
      console.log('💾 [DRAFT] Received csvData:', csvData?.length || 0, 'prospects');
      console.log('💾 [DRAFT] Sample prospect:', JSON.stringify(csvData?.[0], null, 2));

      if (csvData && csvData.length > 0) {
        // Map to track linkedin_url_hash -> master_prospect_id
        const masterProspectIds: Map<string, string> = new Map();

        // STEP 1: Upsert to workspace_prospects (master table)
        // CRITICAL FIX (Dec 8): Support prospects with OR without LinkedIn URLs
        // Email/Messenger campaigns use email, LinkedIn campaigns use linkedin_url
        for (const p of csvData) {
          const linkedinUrl = p.linkedin_url || p.linkedinUrl || p.contact?.linkedin_url;
          const email = p.email || p.contact?.email;

          console.log(`💾 [PROSPECT] Processing: ${p.name}, LinkedIn: "${linkedinUrl || 'none'}", Email: "${email || 'none'}"`);

          // Skip only if prospect has NEITHER LinkedIn URL nor email
          if (!linkedinUrl && !email) {
            console.log(`⚠️  [SKIP] No LinkedIn URL OR email for: ${p.name}`);
            continue;
          }

          const linkedinUrlHash = linkedinUrl ? normalizeLinkedInUrl(linkedinUrl) : null;
          const firstName = p.firstName || p.first_name || p.name?.split(' ')[0] || 'Unknown';
          const lastName = p.lastName || p.last_name || p.name?.split(' ').slice(1).join(' ') || '';

          const workspaceProspectData = {
            workspace_id: workspaceId,
            linkedin_url: linkedinUrl || null,
            linkedin_url_hash: linkedinUrlHash,
            email: email || null,
            first_name: firstName,
            last_name: lastName,
            company: p.company || p.organization || null,
            title: p.title || p.job_title || null,
            source: 'csv_upload',
            approval_status: 'pending',
            active_campaign_id: draftId,
            linkedin_provider_id: p.provider_id || p.providerId || null
          };

          const { data: upsertedProspect, error: upsertError } = await supabase
            .from('workspace_prospects')
            .upsert(workspaceProspectData, {
              onConflict: 'workspace_id,linkedin_url_hash',
              ignoreDuplicates: false
            })
            .select('id')
            .single();

          if (!upsertError && upsertedProspect) {
            // Store by LinkedIn hash if available, otherwise by email
            const lookupKey = linkedinUrlHash || email;
            if (lookupKey) {
              masterProspectIds.set(lookupKey, upsertedProspect.id);
            }
          }
        }

        // STEP 2: Insert to campaign_prospects WITH master_prospect_id
        // CRITICAL FIX (Dec 8): Include prospects with email-only (no LinkedIn URL filter)
        const prospectsToInsert = csvData
          .filter((p: any) => {
            const hasLinkedIn = p.linkedin_url || p.linkedinUrl || p.contact?.linkedin_url;
            const hasEmail = p.email || p.contact?.email;
            return hasLinkedIn || hasEmail; // Accept either
          })
          .map((p: any) => {
            const linkedinUrl = p.linkedin_url || p.linkedinUrl || p.contact?.linkedin_url;
            const linkedinUrlHash = linkedinUrl ? normalizeLinkedInUrl(linkedinUrl) : null;
            const email = p.email || p.contact?.email;
            const lookupKey = linkedinUrlHash || email;

            return {
              campaign_id: draftId,
              workspace_id: workspaceId,
              master_prospect_id: lookupKey ? masterProspectIds.get(lookupKey) : null,
              first_name: p.firstName || p.first_name || p.name?.split(' ')[0] || 'Unknown',
              last_name: p.lastName || p.last_name || p.name?.split(' ').slice(1).join(' ') || '',
              linkedin_url: linkedinUrl || null,
              email: email || null,
              company_name: p.company || p.companyName || p.company_name || p.contact?.company || null,
              title: p.title || p.jobTitle || p.job_title || p.contact?.title || null,
              status: 'pending',
              created_at: new Date().toISOString()
            };
          });

        if (prospectsToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('campaign_prospects')
            .upsert(prospectsToInsert, {
              onConflict: 'campaign_id,linkedin_url',
              ignoreDuplicates: true
            });

          if (insertError) {
            console.error('Error inserting prospects:', insertError);
          }
        }
      }

      return NextResponse.json({
        success: true,
        draftId: campaign.id,
        message: 'Draft updated successfully',
      });
    } else {
      // Create new draft
      const { data: campaign, error: createError } = await supabase
        .from('campaigns')
        .insert({
          workspace_id: workspaceId,
          name,
          campaign_type: campaignType, // FIXED (Dec 7): Don't default - preserve actual campaign type from frontend
          // NOTE: Do NOT set 'type' column - it has a CHECK constraint that rejects 'connector'/'messenger'
          status: 'draft',
          current_step: currentStep || 1,
          connection_message: connectionMessage,
          alternative_message: alternativeMessage,
          follow_up_messages: followUpMessages || [],
          draft_data: draftData,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating draft:', createError);
        return NextResponse.json(
          { error: `Failed to create draft: ${createError.message || createError.code || JSON.stringify(createError)}` },
          { status: 500 }
        );
      }

      // DATABASE-FIRST: Upsert to workspace_prospects then campaign_prospects
      console.log('💾 [DRAFT] Received csvData:', csvData?.length || 0, 'prospects');
      console.log('💾 [DRAFT] Sample prospect:', JSON.stringify(csvData?.[0], null, 2));

      if (csvData && csvData.length > 0) {
        // Map to track linkedin_url_hash -> master_prospect_id
        const masterProspectIds: Map<string, string> = new Map();

        // STEP 1: Upsert to workspace_prospects (master table)
        // CRITICAL FIX (Dec 8): Support prospects with OR without LinkedIn URLs
        // Email/Messenger campaigns use email, LinkedIn campaigns use linkedin_url
        for (const p of csvData) {
          const linkedinUrl = p.linkedin_url || p.linkedinUrl || p.contact?.linkedin_url;
          const email = p.email || p.contact?.email;

          console.log(`💾 [PROSPECT] Processing: ${p.name}, LinkedIn: "${linkedinUrl || 'none'}", Email: "${email || 'none'}"`);

          // Skip only if prospect has NEITHER LinkedIn URL nor email
          if (!linkedinUrl && !email) {
            console.log(`⚠️  [SKIP] No LinkedIn URL OR email for: ${p.name}`);
            continue;
          }

          const linkedinUrlHash = linkedinUrl ? normalizeLinkedInUrl(linkedinUrl) : null;
          const firstName = p.firstName || p.first_name || p.name?.split(' ')[0] || 'Unknown';
          const lastName = p.lastName || p.last_name || p.name?.split(' ').slice(1).join(' ') || '';

          const workspaceProspectData = {
            workspace_id: workspaceId,
            linkedin_url: linkedinUrl || null,
            linkedin_url_hash: linkedinUrlHash,
            email: email || null,
            first_name: firstName,
            last_name: lastName,
            company: p.company || p.organization || null,
            title: p.title || p.job_title || null,
            source: 'csv_upload',
            approval_status: 'pending',
            active_campaign_id: campaign.id,
            linkedin_provider_id: p.provider_id || p.providerId || null
          };

          const { data: upsertedProspect, error: upsertError } = await supabase
            .from('workspace_prospects')
            .upsert(workspaceProspectData, {
              onConflict: 'workspace_id,linkedin_url_hash',
              ignoreDuplicates: false
            })
            .select('id')
            .single();

          if (!upsertError && upsertedProspect) {
            // Store by LinkedIn hash if available, otherwise by email
            const lookupKey = linkedinUrlHash || email;
            if (lookupKey) {
              masterProspectIds.set(lookupKey, upsertedProspect.id);
            }
          }
        }

        // STEP 2: Insert to campaign_prospects WITH master_prospect_id
        // CRITICAL FIX (Dec 8): Include prospects with email-only (no LinkedIn URL filter)
        const prospectsToInsert = csvData
          .filter((p: any) => {
            const hasLinkedIn = p.linkedin_url || p.linkedinUrl || p.contact?.linkedin_url;
            const hasEmail = p.email || p.contact?.email;
            return hasLinkedIn || hasEmail; // Accept either
          })
          .map((p: any) => {
            const linkedinUrl = p.linkedin_url || p.linkedinUrl || p.contact?.linkedin_url;
            const linkedinUrlHash = linkedinUrl ? normalizeLinkedInUrl(linkedinUrl) : null;
            const email = p.email || p.contact?.email;
            const lookupKey = linkedinUrlHash || email;

            return {
              campaign_id: campaign.id,
              workspace_id: workspaceId,
              master_prospect_id: lookupKey ? masterProspectIds.get(lookupKey) : null,
              first_name: p.firstName || p.first_name || p.name?.split(' ')[0] || 'Unknown',
              last_name: p.lastName || p.last_name || p.name?.split(' ').slice(1).join(' ') || '',
              linkedin_url: linkedinUrl || null,
              email: email || null,
              company_name: p.company || p.companyName || p.company_name || p.contact?.company || null,
              title: p.title || p.jobTitle || p.job_title || p.contact?.title || null,
              status: 'pending',
              created_at: new Date().toISOString()
            };
          });

        console.log(`💾 [INSERT CP] Inserting ${prospectsToInsert.length} prospects into campaign_prospects...`);

        if (prospectsToInsert.length > 0) {
          const { data: insertedData, error: insertError } = await supabase
            .from('campaign_prospects')
            .insert(prospectsToInsert)
            .select('id');

          if (insertError) {
            console.error('❌ [ERROR] Failed to insert prospects:', insertError);
            console.error('❌ [ERROR] Prospects that failed:', JSON.stringify(prospectsToInsert, null, 2));

            // CRITICAL FIX (Dec 8): Return error instead of continuing
            return NextResponse.json({
              success: false,
              error: 'Failed to insert prospects into campaign',
              details: insertError.message
            }, { status: 500 });
          } else {
            console.log(`✅ [SUCCESS] Inserted ${insertedData?.length || 0} prospects successfully`);

            // CRITICAL FIX (Dec 8): Verify insertion by counting prospects
            const { count, error: countError } = await supabase
              .from('campaign_prospects')
              .select('id', { count: 'exact', head: true })
              .eq('campaign_id', campaign.id);

            if (countError) {
              console.error('❌ [ERROR] Failed to verify prospect count:', countError);
            } else {
              console.log(`✅ [VERIFY] Campaign ${campaign.id} now has ${count} prospects in database`);
            }
          }
        } else {
          console.log('⚠️  [SKIP] No prospects to insert (all filtered out)');
        }
      }

      // CRITICAL FIX (Dec 8): Return prospect count in response
      const { count: finalCount } = await supabase
        .from('campaign_prospects')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id);

      return NextResponse.json({
        success: true,
        draftId: campaign.id,
        message: 'Draft created successfully',
        prospectCount: finalCount || 0
      });
    }
  } catch (error: any) {
    console.error('Draft save error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/campaigns/draft?workspaceId=xxx
 * Get all draft campaigns for a workspace
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const draftId = searchParams.get('draftId');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    // Verify workspace membership
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (draftId) {
      // Get specific draft
      const { data: draft, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', draftId)
        .eq('workspace_id', workspaceId)
        .eq('status', 'draft')
        .single();

      if (error) {
        console.error('Error fetching draft:', error);
        return NextResponse.json({ drafts: [] });
      }

      // CRITICAL FIX (Dec 8): Enrich single draft with prospects from campaign_prospects table
      // (was only enriching when fetching ALL drafts - caused prospects to disappear on refresh)
      const { data: prospects, count } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact' })
        .eq('campaign_id', draft.id);

      const enrichedDraft = {
        ...draft,
        prospect_count: count || draft.draft_data?.csvData?.length || 0,
        prospects: prospects || [] // Include full prospect data for loading
      };

      console.log(`✅ [GET DRAFT] Loaded draft ${draftId} with ${prospects?.length || 0} prospects`);

      return NextResponse.json({ draft: enrichedDraft });
    } else {
      // Get all drafts for workspace
      const { data: drafts, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'draft')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching drafts:', error);
        return NextResponse.json({ drafts: [] });
      }

      // Enrich drafts with prospect count AND prospects from campaign_prospects table
      // (CSV uploads put prospects there, not in draft_data.csvData)
      const enrichedDrafts = await Promise.all(
        (drafts || []).map(async (draft) => {
          const { data: prospects, count } = await supabase
            .from('campaign_prospects')
            .select('*', { count: 'exact' })
            .eq('campaign_id', draft.id);

          return {
            ...draft,
            prospect_count: count || draft.draft_data?.csvData?.length || 0,
            prospects: prospects || [] // Include full prospect data for loading
          };
        })
      );

      return NextResponse.json({ drafts: enrichedDrafts });
    }
  } catch (error: any) {
    console.error('Draft fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/campaigns/draft?draftId=xxx&workspaceId=xxx
 * Delete a draft campaign
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get('draftId');
    const workspaceId = searchParams.get('workspaceId');

    if (!draftId || !workspaceId) {
      return NextResponse.json(
        { error: 'draftId and workspaceId are required' },
        { status: 400 }
      );
    }

    // Verify workspace membership
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete draft
    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', draftId)
      .eq('workspace_id', workspaceId)
      .eq('status', 'draft'); // Only delete drafts

    if (deleteError) {
      console.error('Error deleting draft:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete draft' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Draft deleted successfully',
    });
  } catch (error: any) {
    console.error('Draft delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
