import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { mcpRegistry } from '@/lib/mcp/mcp-registry';

/**
 * Sync LinkedIn Internal IDs for campaign prospects
 *
 * This endpoint:
 * 1. Fetches recent LinkedIn messages from Unipile
 * 2. Extracts LinkedIn Internal IDs (ACoAAA...) from message participants
 * 3. Matches them to campaign prospects by profile URL or name
 * 4. Updates prospects with their LinkedIn Internal IDs for messaging
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { campaignId, workspaceId } = await req.json();

    if (!campaignId || !workspaceId) {
      return NextResponse.json({
        error: 'campaignId and workspaceId are required'
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

    console.log('🔄 Starting LinkedIn ID sync for campaign:', campaignId);

    // Step 1: Get campaign prospects without LinkedIn IDs
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, linkedin_profile_url, linkedin_user_id')
      .eq('campaign_id', campaignId)
      .is('linkedin_user_id', null); // Only get prospects missing LinkedIn IDs

    if (prospectsError) {
      console.error('Error fetching prospects:', prospectsError);
      return NextResponse.json({
        error: 'Failed to fetch prospects'
      }, { status: 500 });
    }

    if (!prospects || prospects.length === 0) {
      return NextResponse.json({
        message: 'All prospects already have LinkedIn IDs',
        resolved: 0,
        total: 0
      });
    }

    console.log(`📋 Found ${prospects.length} prospects missing LinkedIn IDs`);

    // Step 2: Get Unipile LinkedIn account
    let linkedinAccountId: string | null = null;

    try {
      const accountsResponse = await mcpRegistry.callTool({
        method: 'tools/call',
        params: { name: 'unipile_get_accounts' }
      });

      const accountsData = JSON.parse(accountsResponse.content[0]?.text || '{}');
      const linkedinAccounts = accountsData.accounts?.filter(
        (acc: any) => acc.provider === 'LINKEDIN'
      ) || [];

      if (linkedinAccounts.length === 0) {
        return NextResponse.json({
          error: 'No LinkedIn account connected to Unipile'
        }, { status: 400 });
      }

      linkedinAccountId = linkedinAccounts[0].id;
      console.log('✅ Found LinkedIn account:', linkedinAccountId);

    } catch (error) {
      console.error('Error getting Unipile accounts:', error);
      return NextResponse.json({
        error: 'Failed to connect to Unipile'
      }, { status: 500 });
    }

    // Step 3: Fetch recent LinkedIn messages (last 100)
    let messages: any[] = [];

    try {
      const messagesResponse = await mcpRegistry.callTool({
        method: 'tools/call',
        params: {
          name: 'unipile_get_recent_messages',
          arguments: {
            account_id: linkedinAccountId,
            limit: 100
          }
        }
      });

      const messagesData = JSON.parse(messagesResponse.content[0]?.text || '{}');
      messages = messagesData.messages || messagesData.items || [];

      console.log(`📬 Retrieved ${messages.length} recent LinkedIn messages`);

    } catch (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({
        error: 'Failed to fetch LinkedIn messages from Unipile'
      }, { status: 500 });
    }

    // Step 4: Extract LinkedIn Internal IDs from messages
    const linkedinIdMap = new Map<string, string>(); // profile_url -> internal_id
    const nameMap = new Map<string, string>(); // full_name -> internal_id

    for (const message of messages) {
      try {
        // Extract sender info
        const senderId = message.sender_id || message.from?.id;
        const senderProfileUrl = message.sender_profile_url || message.from?.profile_url;
        const senderName = message.sender_name || message.from?.name;

        if (senderId) {
          // Map by profile URL (most accurate)
          if (senderProfileUrl) {
            // Normalize LinkedIn URLs
            const normalizedUrl = senderProfileUrl
              .replace(/\/$/, '') // Remove trailing slash
              .replace(/\?.*$/, '') // Remove query params
              .toLowerCase();

            linkedinIdMap.set(normalizedUrl, senderId);
          }

          // Map by name (fallback)
          if (senderName) {
            const normalizedName = senderName.trim().toLowerCase();
            nameMap.set(normalizedName, senderId);
          }
        }

        // Also extract recipient info (for sent messages)
        const recipientId = message.recipient_id || message.to?.id;
        const recipientProfileUrl = message.recipient_profile_url || message.to?.profile_url;
        const recipientName = message.recipient_name || message.to?.name;

        if (recipientId) {
          if (recipientProfileUrl) {
            const normalizedUrl = recipientProfileUrl
              .replace(/\/$/, '')
              .replace(/\?.*$/, '')
              .toLowerCase();

            linkedinIdMap.set(normalizedUrl, recipientId);
          }

          if (recipientName) {
            const normalizedName = recipientName.trim().toLowerCase();
            nameMap.set(normalizedName, recipientId);
          }
        }

      } catch (error) {
        console.error('Error processing message:', error);
        continue;
      }
    }

    console.log(`🗺️ Built ID map with ${linkedinIdMap.size} profile URLs and ${nameMap.size} names`);

    // Step 5: Match prospects to LinkedIn IDs
    const resolvedProspects = [];
    const unresolvedProspects = [];

    for (const prospect of prospects) {
      let linkedinUserId: string | null = null;

      // Try to match by profile URL first (most accurate)
      if (prospect.linkedin_profile_url) {
        const normalizedUrl = prospect.linkedin_profile_url
          .replace(/\/$/, '')
          .replace(/\?.*$/, '')
          .toLowerCase();

        linkedinUserId = linkedinIdMap.get(normalizedUrl) || null;

        if (linkedinUserId) {
          console.log(`✅ Matched by URL: ${prospect.first_name} ${prospect.last_name} -> ${linkedinUserId}`);
        }
      }

      // Fallback: Try to match by name
      if (!linkedinUserId && prospect.first_name && prospect.last_name) {
        const fullName = `${prospect.first_name} ${prospect.last_name}`.trim().toLowerCase();
        linkedinUserId = nameMap.get(fullName) || null;

        if (linkedinUserId) {
          console.log(`⚠️ Matched by NAME (less accurate): ${prospect.first_name} ${prospect.last_name} -> ${linkedinUserId}`);
        }
      }

      if (linkedinUserId) {
        resolvedProspects.push({
          id: prospect.id,
          linkedin_user_id: linkedinUserId
        });
      } else {
        unresolvedProspects.push(prospect);
      }
    }

    console.log(`✅ Resolved ${resolvedProspects.length} LinkedIn IDs`);
    console.log(`❌ Could not resolve ${unresolvedProspects.length} LinkedIn IDs`);

    // Step 6: Update prospects with LinkedIn IDs
    const updatePromises = resolvedProspects.map(async (resolved) => {
      return supabase
        .from('campaign_prospects')
        .update({ linkedin_user_id: resolved.linkedin_user_id })
        .eq('id', resolved.id);
    });

    const updateResults = await Promise.all(updatePromises);
    const failedUpdates = updateResults.filter(r => r.error);

    if (failedUpdates.length > 0) {
      console.error('Some updates failed:', failedUpdates);
    }

    // Step 7: Return results
    return NextResponse.json({
      success: true,
      message: `Resolved ${resolvedProspects.length} out of ${prospects.length} LinkedIn IDs`,
      resolved: resolvedProspects.length,
      total: prospects.length,
      unresolved: unresolvedProspects.length,
      details: {
        resolved_prospects: resolvedProspects.map(p => ({
          id: p.id,
          linkedin_user_id: p.linkedin_user_id
        })),
        unresolved_prospects: unresolvedProspects.map(p => ({
          id: p.id,
          name: `${p.first_name} ${p.last_name}`,
          linkedin_profile_url: p.linkedin_profile_url
        }))
      }
    });

  } catch (error) {
    console.error('LinkedIn ID sync error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
