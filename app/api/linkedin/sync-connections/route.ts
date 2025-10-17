import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

/**
 * POST /api/linkedin/sync-connections
 * Syncs LinkedIn connections from Unipile and stores their internal IDs
 * This enables messaging to 1st degree connections
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId, campaignId } = await req.json();

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
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

    console.log(`🔄 Syncing LinkedIn connections for user ${user.email}...`);

    // Step 1: Fetch LinkedIn connections from Unipile via MCP
    let connections = [];
    try {
      // Call Unipile MCP tool to get connections
      const mcpResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/mcp/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server: 'unipile',
          tool: 'unipile_get_connections',
          arguments: {
            account_id: user.id, // or get from user's linked LinkedIn account
            limit: 500 // Fetch up to 500 connections
          }
        })
      });

      if (!mcpResponse.ok) {
        throw new Error('Failed to fetch connections from Unipile');
      }

      const mcpData = await mcpResponse.json();
      connections = mcpData.connections || [];

      console.log(`✅ Fetched ${connections.length} LinkedIn connections from Unipile`);
    } catch (mcpError) {
      console.error('Unipile MCP error:', mcpError);
      // Fallback: Try direct Unipile API if MCP fails
      const unipileResponse = await fetchConnectionsFromUnipileDirect(user.id);
      connections = unipileResponse;
    }

    if (connections.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No LinkedIn connections found',
        synced: 0
      });
    }

    // Step 2: Store connections in linkedin_contacts table
    let syncedCount = 0;
    let resolvedCount = 0;
    const errors = [];

    for (const connection of connections) {
      try {
        // Extract LinkedIn profile URL and internal ID
        const profileUrl = connection.profile_url || connection.public_profile_url;
        const internalId = connection.id || connection.linkedin_id || connection.internal_id;
        const publicIdentifier = connection.public_identifier || extractPublicIdentifier(profileUrl);

        if (!profileUrl || !internalId) {
          console.warn(`⚠️ Skipping connection - missing profile URL or internal ID:`, connection);
          continue;
        }

        // Upsert to linkedin_contacts table using database function
        const { error: upsertError } = await supabase.rpc('upsert_linkedin_contact', {
          p_user_id: user.id,
          p_workspace_id: workspaceId,
          p_linkedin_profile_url: profileUrl,
          p_linkedin_internal_id: internalId,
          p_full_name: connection.name || connection.full_name,
          p_first_name: connection.first_name,
          p_last_name: connection.last_name,
          p_headline: connection.headline || connection.title,
          p_company_name: connection.company || connection.company_name,
          p_location: connection.location,
          p_profile_picture_url: connection.profile_picture || connection.avatar_url,
          p_discovery_method: 'unipile_api',
          p_connection_status: 'connected',
          p_can_message: true
        });

        if (upsertError) {
          errors.push({ connection: connection.name, error: upsertError.message });
          console.error(`❌ Failed to store connection ${connection.name}:`, upsertError);
        } else {
          syncedCount++;
        }

      } catch (error: any) {
        errors.push({ connection: connection.name, error: error.message });
        console.error(`❌ Error processing connection:`, error);
      }
    }

    console.log(`✅ Synced ${syncedCount}/${connections.length} LinkedIn connections`);

    // Step 3: If campaignId provided, resolve LinkedIn IDs for campaign prospects
    if (campaignId) {
      console.log(`🔍 Resolving LinkedIn IDs for campaign ${campaignId}...`);

      const { data: resolutions, error: resError } = await supabase.rpc('resolve_campaign_linkedin_ids', {
        p_campaign_id: campaignId,
        p_user_id: user.id
      });

      if (!resError && resolutions) {
        resolvedCount = resolutions.filter((r: any) => r.resolution_status === 'found').length;

        // Update campaign_prospects with resolved LinkedIn IDs
        for (const resolution of resolutions) {
          if (resolution.resolution_status === 'found' && resolution.linkedin_internal_id) {
            await supabase
              .from('campaign_prospects')
              .update({
                linkedin_user_id: resolution.linkedin_internal_id,
                status: 'ready',
                updated_at: new Date().toISOString()
              })
              .eq('campaign_id', campaignId)
              .eq('prospect_id', resolution.prospect_id);
          }
        }

        console.log(`✅ Resolved ${resolvedCount} LinkedIn IDs for campaign prospects`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced LinkedIn connections`,
      stats: {
        total_connections: connections.length,
        synced: syncedCount,
        errors: errors.length,
        campaign_prospects_resolved: resolvedCount
      },
      errors: errors.length > 0 ? errors : undefined,
      next_steps: resolvedCount > 0
        ? `${resolvedCount} prospects are now ready for messaging`
        : 'Run LinkedIn ID resolution for your campaign prospects'
    });

  } catch (error: any) {
    console.error('LinkedIn sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync LinkedIn connections', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Fallback: Fetch connections directly from Unipile API
 */
async function fetchConnectionsFromUnipileDirect(userId: string) {
  try {
    const UNIPILE_DSN = process.env.UNIPILE_DSN;
    const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
    const UNIPILE_BASE_URL = `https://${UNIPILE_DSN}.unipile.com:13443`;

    // First, get user's LinkedIn account ID from Unipile
    const accountsResponse = await fetch(`${UNIPILE_BASE_URL}/api/v1/users/${userId}/accounts`, {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY!,
        'Accept': 'application/json'
      }
    });

    if (!accountsResponse.ok) {
      throw new Error('Failed to fetch Unipile accounts');
    }

    const accountsData = await accountsResponse.json();
    const linkedinAccount = accountsData.items?.find((acc: any) => acc.provider === 'LINKEDIN');

    if (!linkedinAccount) {
      console.log('No LinkedIn account found in Unipile');
      return [];
    }

    // Fetch connections for this LinkedIn account
    const connectionsResponse = await fetch(
      `${UNIPILE_BASE_URL}/api/v1/users/${userId}/accounts/${linkedinAccount.id}/connections?limit=500`,
      {
        headers: {
          'X-API-KEY': UNIPILE_API_KEY!,
          'Accept': 'application/json'
        }
      }
    );

    if (!connectionsResponse.ok) {
      throw new Error('Failed to fetch connections from Unipile');
    }

    const connectionsData = await connectionsResponse.json();
    return connectionsData.items || [];

  } catch (error) {
    console.error('Unipile direct API error:', error);
    return [];
  }
}

/**
 * Extract public identifier from LinkedIn profile URL
 * e.g., https://linkedin.com/in/pauldhaliwal -> pauldhaliwal
 */
function extractPublicIdentifier(profileUrl: string): string | null {
  if (!profileUrl) return null;
  const match = profileUrl.match(/\/in\/([^/?]+)/);
  return match ? match[1] : null;
}

/**
 * GET endpoint - returns sync status and info
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get count of stored LinkedIn contacts
    const { count } = await supabase
      .from('linkedin_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    return NextResponse.json({
      endpoint: 'LinkedIn Connection Sync API',
      description: 'Syncs your LinkedIn connections from Unipile and stores their messaging IDs',
      usage: {
        method: 'POST',
        body: {
          workspaceId: 'required - your workspace ID',
          campaignId: 'optional - resolve IDs for specific campaign'
        }
      },
      status: {
        stored_connections: count || 0,
        last_sync: 'Check linkedin_discovery_jobs table'
      },
      features: [
        'Fetches all LinkedIn connections via Unipile',
        'Stores LinkedIn Internal IDs (required for messaging)',
        'Matches profile URLs to prospects',
        'Auto-resolves IDs for campaign prospects',
        'Marks prospects as ready for messaging'
      ]
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Request failed', details: error.message },
      { status: 500 }
    );
  }
}
