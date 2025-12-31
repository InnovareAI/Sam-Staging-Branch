import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

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
    const { userId, workspaceId: authWorkspaceId, userEmail } = await verifyAuth(req);

    const body = await req.json();
    const { workspaceId: providedWorkspaceId, campaignId } = body;

    // Use provided workspace or fall back to auth context
    const workspaceId = providedWorkspaceId || authWorkspaceId;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    // Verify workspace membership
    const { rows: memberRows } = await pool.query(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId]
    );

    if (!memberRows || memberRows.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log(`Syncing LinkedIn connections for user ${userEmail}...`);

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
    const errors: any[] = [];
    const discoveredContacts = new Map<string, any>();

    for (const account of linkedinAccounts) {
      try {
        console.log(`Scanning message history for account: ${account.name}`);

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

        console.log(`Discovered ${discoveredContacts.size} unique contacts from messages`);

      } catch (accountError: any) {
        console.error(`Error scanning account ${account.name}:`, accountError);
        errors.push({ account: account.name, error: accountError.message });
      }
    }

    // Step 3: Store discovered connections in linkedin_contacts table
    for (const [senderId, contact] of discoveredContacts) {
      try {
        // Upsert to linkedin_contacts table using raw SQL
        await pool.query(
          `INSERT INTO linkedin_contacts
           (user_id, workspace_id, linkedin_profile_url, linkedin_internal_id, full_name, discovery_method, connection_status, can_message)
           VALUES ($1, $2, $3, $4, $5, 'message_history', 'connected', true)
           ON CONFLICT (user_id, linkedin_internal_id)
           DO UPDATE SET
             full_name = EXCLUDED.full_name,
             discovery_method = EXCLUDED.discovery_method,
             connection_status = EXCLUDED.connection_status,
             can_message = EXCLUDED.can_message,
             updated_at = NOW()`,
          [userId, workspaceId, contact.profileUrl, contact.internalId, contact.name]
        );
        syncedCount++;
      } catch (error: any) {
        errors.push({ contact: contact.name, error: error.message });
        console.error(`Error processing contact:`, error);
      }
    }

    console.log(`Synced ${syncedCount} LinkedIn connections from message history`);

    // Step 4: If campaignId provided, resolve LinkedIn IDs for campaign prospects
    if (campaignId) {
      console.log(`Resolving LinkedIn IDs for campaign ${campaignId}...`);

      // Get campaign prospects that need resolution
      const { rows: prospects } = await pool.query(
        `SELECT cp.prospect_id, cp.linkedin_url
         FROM campaign_prospects cp
         WHERE cp.campaign_id = $1 AND cp.linkedin_user_id IS NULL`,
        [campaignId]
      );

      for (const prospect of prospects) {
        // Try to find matching linkedin_contact
        const { rows: contacts } = await pool.query(
          `SELECT linkedin_internal_id FROM linkedin_contacts
           WHERE user_id = $1 AND linkedin_profile_url ILIKE $2`,
          [userId, `%${prospect.linkedin_url}%`]
        );

        if (contacts.length > 0) {
          await pool.query(
            `UPDATE campaign_prospects
             SET linkedin_user_id = $1, status = 'ready', updated_at = NOW()
             WHERE campaign_id = $2 AND prospect_id = $3`,
            [contacts[0].linkedin_internal_id, campaignId, prospect.prospect_id]
          );
          resolvedCount++;
        }
      }

      console.log(`Resolved ${resolvedCount} LinkedIn IDs for campaign prospects`);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced LinkedIn connections`,
      stats: {
        total_connections: discoveredContacts.size,
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
    const { userId } = await verifyAuth(req);

    // Get count of stored LinkedIn contacts
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int as count FROM linkedin_contacts WHERE user_id = $1`,
      [userId]
    );
    const count = countRows[0]?.count || 0;

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
        stored_connections: count,
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
