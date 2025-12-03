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
          campaign_type: campaignType || 'linkedin', // Use campaign_type (primary field)
          type: campaignType, // Keep type for backward compatibility
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
      if (csvData && csvData.length > 0) {
        // Map to track linkedin_url_hash -> master_prospect_id
        const masterProspectIds: Map<string, string> = new Map();

        // STEP 1: Upsert to workspace_prospects (master table)
        for (const p of csvData) {
          const linkedinUrl = p.linkedin_url || p.linkedinUrl || p.contact?.linkedin_url;
          if (!linkedinUrl) continue;

          const linkedinUrlHash = normalizeLinkedInUrl(linkedinUrl);
          const firstName = p.firstName || p.first_name || p.name?.split(' ')[0] || 'Unknown';
          const lastName = p.lastName || p.last_name || p.name?.split(' ').slice(1).join(' ') || '';

          const workspaceProspectData = {
            workspace_id: workspaceId,
            linkedin_url: linkedinUrl,
            linkedin_url_hash: linkedinUrlHash,
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

          if (!upsertError && upsertedProspect && linkedinUrlHash) {
            masterProspectIds.set(linkedinUrlHash, upsertedProspect.id);
          }
        }

        // STEP 2: Insert to campaign_prospects WITH master_prospect_id
        const prospectsToInsert = csvData
          .filter((p: any) => p.linkedin_url || p.linkedinUrl || p.contact?.linkedin_url)
          .map((p: any) => {
            const linkedinUrl = p.linkedin_url || p.linkedinUrl || p.contact?.linkedin_url;
            const linkedinUrlHash = normalizeLinkedInUrl(linkedinUrl);
            return {
              campaign_id: draftId,
              workspace_id: workspaceId,
              master_prospect_id: linkedinUrlHash ? masterProspectIds.get(linkedinUrlHash) : null,
              first_name: p.firstName || p.first_name || p.name?.split(' ')[0] || 'Unknown',
              last_name: p.lastName || p.last_name || p.name?.split(' ').slice(1).join(' ') || '',
              linkedin_url: linkedinUrl,
              provider_id: p.provider_id || p.providerId || null,
              company: p.company || p.organization || null,
              title: p.title || p.job_title || null,
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
          campaign_type: campaignType || 'linkedin', // Use campaign_type (primary field)
          type: campaignType, // Keep type for backward compatibility
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
          { error: 'Failed to create draft' },
          { status: 500 }
        );
      }

      // DATABASE-FIRST: Upsert to workspace_prospects then campaign_prospects
      if (csvData && csvData.length > 0) {
        // Map to track linkedin_url_hash -> master_prospect_id
        const masterProspectIds: Map<string, string> = new Map();

        // STEP 1: Upsert to workspace_prospects (master table)
        for (const p of csvData) {
          const linkedinUrl = p.linkedin_url || p.linkedinUrl || p.contact?.linkedin_url;
          if (!linkedinUrl) continue;

          const linkedinUrlHash = normalizeLinkedInUrl(linkedinUrl);
          const firstName = p.firstName || p.first_name || p.name?.split(' ')[0] || 'Unknown';
          const lastName = p.lastName || p.last_name || p.name?.split(' ').slice(1).join(' ') || '';

          const workspaceProspectData = {
            workspace_id: workspaceId,
            linkedin_url: linkedinUrl,
            linkedin_url_hash: linkedinUrlHash,
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

          if (!upsertError && upsertedProspect && linkedinUrlHash) {
            masterProspectIds.set(linkedinUrlHash, upsertedProspect.id);
          }
        }

        // STEP 2: Insert to campaign_prospects WITH master_prospect_id
        const prospectsToInsert = csvData
          .filter((p: any) => p.linkedin_url || p.linkedinUrl || p.contact?.linkedin_url)
          .map((p: any) => {
            const linkedinUrl = p.linkedin_url || p.linkedinUrl || p.contact?.linkedin_url;
            const linkedinUrlHash = normalizeLinkedInUrl(linkedinUrl);
            return {
              campaign_id: campaign.id,
              workspace_id: workspaceId,
              master_prospect_id: linkedinUrlHash ? masterProspectIds.get(linkedinUrlHash) : null,
              first_name: p.firstName || p.first_name || p.name?.split(' ')[0] || 'Unknown',
              last_name: p.lastName || p.last_name || p.name?.split(' ').slice(1).join(' ') || '',
              linkedin_url: linkedinUrl,
              provider_id: p.provider_id || p.providerId || null,
              company: p.company || p.organization || null,
              title: p.title || p.job_title || null,
              status: 'pending',
              created_at: new Date().toISOString()
            };
          });

        if (prospectsToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('campaign_prospects')
            .insert(prospectsToInsert);

          if (insertError) {
            console.error('Error inserting prospects:', insertError);
          }
        }
      }

      return NextResponse.json({
        success: true,
        draftId: campaign.id,
        message: 'Draft created successfully',
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

      return NextResponse.json({ draft });
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

      // Enrich drafts with prospect count from campaign_prospects table
      // (CSV uploads put prospects there, not in draft_data.csvData)
      const enrichedDrafts = await Promise.all(
        (drafts || []).map(async (draft) => {
          const { count } = await supabase
            .from('campaign_prospects')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', draft.id);

          return {
            ...draft,
            prospect_count: count || draft.draft_data?.csvData?.length || 0
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
