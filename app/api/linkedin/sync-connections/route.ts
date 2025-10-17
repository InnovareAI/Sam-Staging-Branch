import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

// MCP function declarations
declare global {
  function mcp__unipile__unipile_get_accounts(): Promise<any[]>;
  function mcp__unipile__unipile_get_recent_messages(params: {
    account_id: string;
    batch_size: number;
  }): Promise<any[]>;
}

/**
 * POST /api/linkedin/sync-connections
 * Syncs LinkedIn connections from Unipile via message history and stores their internal IDs
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

    // Step 1: Get LinkedIn accounts via MCP
    const availableAccounts = await mcp__unipile__unipile_get_accounts();
    const linkedinAccounts = availableAccounts.filter((account: any) =>
      account.type === 'LINKEDIN' &&
      account.sources?.[0]?.status === 'OK'
    );

    if (linkedinAccounts.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No active LinkedIn accounts found',
        synced: 0
      });
    }

    // Step 2: Scan message history to discover connections (1st degree contacts)
    let syncedCount = 0;
    let resolvedCount = 0;
    const errors = [];
    const discoveredContacts = new Map<string, any>();

    for (const account of linkedinAccounts) {
      try {
        console.log(`📨 Scanning message history for account: ${account.name}`);

        // Get recent messages using MCP - these are from 1st degree connections
        const recentMessages = await mcp__unipile__unipile_get_recent_messages({
          account_id: account.sources[0].id,
          batch_size: 500 // Fetch up to 500 messages
        });

        for (const message of recentMessages) {
          // Skip messages sent by the account owner
          if (message.sender_id && message.sender_id !== account.connection_params?.im?.id) {
            const contactKey = message.sender_id;

            if (!discoveredContacts.has(contactKey)) {
              // New contact discovered - store their internal ID
              discoveredContacts.set(contactKey, {
                internalId: message.sender_id,
                name: message.sender_name,
                profileUrl: message.sender_profile_url || `https://www.linkedin.com/in/${message.sender_public_identifier || ''}`,
                lastMessageAt: message.timestamp
              });
            }
          }
        }

        console.log(`✅ Discovered ${discoveredContacts.size} unique contacts from messages`);

      } catch (accountError: any) {
        console.error(`Error scanning account ${account.name}:`, accountError);
        errors.push({ account: account.name, error: accountError.message });
      }
    }

    // Step 3: Store discovered connections in linkedin_contacts table
    for (const [senderId, contact] of discoveredContacts) {
      try {
        // Upsert to linkedin_contacts table using database function
        const { error: upsertError } = await supabase.rpc('upsert_linkedin_contact', {
          p_user_id: user.id,
          p_workspace_id: workspaceId,
          p_linkedin_profile_url: contact.profileUrl,
          p_linkedin_internal_id: contact.internalId,
          p_full_name: contact.name,
          p_discovery_method: 'message_history',
          p_connection_status: 'connected',
          p_can_message: true
        });

        if (upsertError) {
          errors.push({ contact: contact.name, error: upsertError.message });
          console.error(`❌ Failed to store contact ${contact.name}:`, upsertError);
        } else {
          syncedCount++;
        }

      } catch (error: any) {
        errors.push({ contact: contact.name, error: error.message });
        console.error(`❌ Error processing contact:`, error);
      }
    }

    console.log(`✅ Synced ${syncedCount} LinkedIn connections from message history`);

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
      description: 'Discovers LinkedIn connections via message history and stores their messaging IDs',
      usage: {
        method: 'POST',
        body: {
          workspaceId: 'required - your workspace ID',
          campaignId: 'optional - resolve IDs for specific campaign'
        }
      },
      status: {
        stored_connections: count || 0,
        discovery_method: 'message_history'
      },
      features: [
        'Scans LinkedIn message history to discover 1st degree connections',
        'Extracts LinkedIn Internal IDs from message senders',
        'Stores messageable contacts in linkedin_contacts table',
        'Matches connections to campaign prospects',
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
