import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

// Helper to normalize LinkedIn URL to hash (vanity name only)
function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  if (match) return match[1].toLowerCase().trim();
  return url.replace(/^\/+|\/+$/g, '').toLowerCase().trim();
}

/**
 * Transfer approved prospects from prospect_approval_data to campaign_prospects
 * POST /api/campaigns/transfer-prospects
 * Body: { campaign_id: string, session_id?: string, campaign_name?: string }
 *
 * DATABASE-FIRST: Upserts to workspace_prospects first, then campaign_prospects with master_prospect_id FK
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { campaign_id, session_id, campaign_name } = body;

    // Get workspace_id
    const workspaceId = user.user_metadata.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    // Find campaign
    let campaign;
    if (campaign_id) {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('id', campaign_id)
        .single();

      if (error) {
        return NextResponse.json({
          error: 'Campaign not found',
          details: error.message
        }, { status: 404 });
      }
      campaign = data;
    } else if (campaign_name) {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('workspace_id', workspaceId)
        .ilike('name', `%${campaign_name}%`)
        .limit(1)
        .single();

      if (error) {
        return NextResponse.json({
          error: 'Campaign not found by name',
          details: error.message,
          searched_name: campaign_name
        }, { status: 404 });
      }
      campaign = data;
    } else {
      return NextResponse.json({
        error: 'Either campaign_id or campaign_name required'
      }, { status: 400 });
    }

    // Get approved prospects from prospect_approval_data
    let query = supabase
      .from('prospect_approval_data')
      .select('*')
      .eq('approval_status', 'approved');

    // If session_id provided, filter by it
    // Otherwise get all approved prospects with matching campaign name
    if (session_id) {
      query = query.eq('session_id', session_id);
    } else if (campaign.name) {
      // Try to match by campaign name in prospect data
      query = query.eq('campaign_name', campaign.name);
    }

    const { data: approvedProspects, error: prospectsError } = await query;

    if (prospectsError) {
      return NextResponse.json({
        error: 'Failed to fetch approved prospects',
        details: prospectsError.message
      }, { status: 500 });
    }

    if (!approvedProspects || approvedProspects.length === 0) {
      return NextResponse.json({
        error: 'No approved prospects found',
        campaign_name: campaign.name,
        session_id: session_id || null
      }, { status: 404 });
    }

    // Get LinkedIn account for prospect ownership
    const { data: linkedInAccount } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected')
      .single();

    const unipileAccountId = linkedInAccount?.unipile_account_id || null;

    // DATABASE-FIRST: Upsert all prospects to workspace_prospects master table first
    console.log(`💾 Step 1: Upserting ${approvedProspects.length} prospects to workspace_prospects`);

    // Prepare master prospects data
    const masterProspectsData = approvedProspects.map(prospect => {
      const contact = prospect.contact || {};
      const linkedinUrl = contact.linkedin_url || contact.linkedinUrl || prospect.linkedin_url || null;
      const fullName = prospect.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();

      let firstName = 'Unknown';
      let lastName = '';
      if (fullName && fullName.trim() !== '') {
        const nameParts = fullName.trim().split(/\s+/);
        if (nameParts.length >= 2) {
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ');
        } else if (nameParts.length === 1) {
          firstName = nameParts[0];
        }
      }

      return {
        workspace_id: workspaceId,
        linkedin_url: linkedinUrl,
        linkedin_url_hash: normalizeLinkedInUrl(linkedinUrl),
        first_name: firstName,
        last_name: lastName,
        email: contact.email || null,
        company: prospect.company?.name || contact.company || contact.companyName || '',
        title: prospect.title || contact.title || contact.headline || '',
        location: prospect.location || contact.location || null,
        linkedin_provider_id: contact.linkedin_provider_id || null,
        source: 'transfer',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }).filter(p => p.linkedin_url_hash); // Only upsert those with valid LinkedIn URLs

    // Batch upsert to workspace_prospects
    let masterIdMap: Record<string, string> = {};
    if (masterProspectsData.length > 0) {
      const { error: masterError } = await supabase
        .from('workspace_prospects')
        .upsert(masterProspectsData, {
          onConflict: 'workspace_id,linkedin_url_hash',
          ignoreDuplicates: false
        });

      if (masterError) {
        console.error('⚠️ Master prospect upsert warning:', masterError.message);
      } else {
        console.log(`✅ Upserted ${masterProspectsData.length} prospects to workspace_prospects`);
      }

      // Get master_prospect_ids for linking
      const linkedinHashes = masterProspectsData.map(p => p.linkedin_url_hash).filter(Boolean);
      const { data: masterRecords } = await supabase
        .from('workspace_prospects')
        .select('id, linkedin_url_hash')
        .eq('workspace_id', workspaceId)
        .in('linkedin_url_hash', linkedinHashes);

      if (masterRecords) {
        masterIdMap = masterRecords.reduce((acc: Record<string, string>, r: any) => {
          acc[r.linkedin_url_hash] = r.id;
          return acc;
        }, {});
      }
    }

    // Transform and insert prospects with master_prospect_id
    console.log(`💾 Step 2: Inserting ${approvedProspects.length} prospects to campaign_prospects`);

    const campaignProspects = approvedProspects.map(prospect => {
      const contact = prospect.contact || {};
      const linkedinUrl = contact.linkedin_url || contact.linkedinUrl || prospect.linkedin_url || null;
      const linkedinHash = normalizeLinkedInUrl(linkedinUrl);

      // FIXED: Use prospect.name field and parse it properly
      // prospect_approval_data has "name" field, NOT contact.firstName/lastName
      const fullName = prospect.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();

      // Parse the full name properly (remove titles, credentials, etc.)
      let firstName = 'Unknown';
      let lastName = 'User';

      if (fullName && fullName.trim() !== '') {
        // Split on first space: "Hyelim Kim" -> firstName: "Hyelim", lastName: "Kim"
        const nameParts = fullName.trim().split(/\s+/);
        if (nameParts.length >= 2) {
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ');
        } else if (nameParts.length === 1) {
          firstName = nameParts[0];
          lastName = '';
        }
      }

      return {
        campaign_id: campaign.id,
        workspace_id: workspaceId,
        master_prospect_id: linkedinHash ? masterIdMap[linkedinHash] || null : null,  // FK to workspace_prospects
        first_name: firstName,
        last_name: lastName,
        email: contact.email || null,
        company_name: prospect.company?.name || contact.company || contact.companyName || '',
        linkedin_url: linkedinUrl,
        title: prospect.title || contact.title || contact.headline || '',
        location: prospect.location || contact.location || null,
        industry: prospect.company?.industry?.[0] || 'Not specified',
        status: 'approved',
        notes: null,
        added_by_unipile_account: unipileAccountId,
        personalization_data: {
          source: 'manual_transfer',
          session_id: session_id || null,
          approval_data_id: prospect.id,
          transferred_at: new Date().toISOString()
        }
      };
    });

    // Insert prospects into campaign_prospects
    const { data: inserted, error: insertError } = await supabase
      .from('campaign_prospects')
      .insert(campaignProspects)
      .select();

    if (insertError) {
      return NextResponse.json({
        error: 'Failed to insert prospects',
        details: insertError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name
      },
      prospects_transferred: inserted.length,
      details: {
        from_session: session_id || 'all approved',
        linkedin_account: unipileAccountId || 'none'
      }
    });

  } catch (error: any) {
    console.error('Transfer prospects error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
