import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

/**
 * Sync LinkedIn accounts from Unipile to workspace_accounts table
 * This ensures workspace_accounts is always in sync with what's actually in Unipile
 *
 * Call this:
 * - After disconnect/reconnect
 * - When search fails with "No LinkedIn account connected"
 * - Periodically to catch any drift
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate with Firebase
    const { userId, workspaceId, userEmail } = await verifyAuth(request);

    console.log(`🔄 Syncing LinkedIn accounts for user ${userEmail} (${userId})`);
    console.log(`🏢 User workspace: ${workspaceId}`);

    // Fetch ALL accounts from Unipile
    const unipileDSN = process.env.UNIPILE_DSN!;
    const unipileApiKey = process.env.UNIPILE_API_KEY!;

    const allAccountsUrl = unipileDSN.includes('.')
      ? `https://${unipileDSN}/api/v1/accounts`
      : `https://${unipileDSN}.unipile.com:13443/api/v1/accounts`;

    const allAccountsResponse = await fetch(allAccountsUrl, {
      headers: {
        'X-API-KEY': unipileApiKey,
        'Accept': 'application/json'
      }
    });

    if (!allAccountsResponse.ok) {
      console.error('❌ Failed to fetch Unipile accounts:', allAccountsResponse.status);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch accounts from Unipile: ${allAccountsResponse.status}`
      }, { status: 500 });
    }

    const allAccountsData = await allAccountsResponse.json();
    const allAccounts = Array.isArray(allAccountsData) ? allAccountsData : (allAccountsData.items || allAccountsData.accounts || []);

    // Filter to LinkedIn accounts only
    const linkedInAccounts = allAccounts.filter((account: any) => account.type === 'LINKEDIN');
    console.log(`📊 Found ${linkedInAccounts.length} LinkedIn accounts in Unipile`);

    // Get user's LinkedIn accounts from user_unipile_accounts
    const { rows: userLinkedInAccounts } = await pool.query(
      "SELECT * FROM user_unipile_accounts WHERE user_id = $1 AND platform = 'LINKEDIN'",
      [userId]
    );

    const userAccountIds = new Set(userLinkedInAccounts?.map(acc => acc.unipile_account_id) || []);
    console.log(`👤 User has ${userAccountIds.size} LinkedIn account(s) in user_unipile_accounts`);

    // Filter to accounts belonging to this user
    const userLinkedInAccountsFromUnipile = linkedInAccounts.filter((acc: any) =>
      userAccountIds.has(acc.id)
    );

    console.log(`🔍 Matched ${userLinkedInAccountsFromUnipile.length} user account(s) in Unipile`);

    // Get existing workspace_accounts for this user
    const { rows: existingWorkspaceAccounts } = await pool.query(
      "SELECT * FROM workspace_accounts WHERE workspace_id = $1 AND user_id = $2 AND account_type = 'linkedin'",
      [workspaceId, userId]
    );

    const existingAccountIds = new Set(existingWorkspaceAccounts?.map(acc => acc.unipile_account_id) || []);
    console.log(`💾 User has ${existingAccountIds.size} LinkedIn account(s) in workspace_accounts`);

    let addedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;
    const errors: any[] = [];

    // Add/Update accounts that exist in Unipile
    for (const unipileAccount of userLinkedInAccountsFromUnipile) {
      const connectionParams = unipileAccount.connection_params?.im || {};
      const accountIdentifier = connectionParams.email?.toLowerCase() ||
                               connectionParams.username?.toLowerCase() ||
                               unipileAccount.id;

      const connectionStatus = unipileAccount.sources?.some((source: any) => source.status === 'OK')
        ? 'connected'
        : 'pending';

      try {
        // Check if account with same identifier but different unipile_account_id exists (reconnection)
        const { rows: oldAccounts } = await pool.query(
          "SELECT * FROM workspace_accounts WHERE workspace_id = $1 AND user_id = $2 AND account_type = 'linkedin' AND account_identifier = $3",
          [workspaceId, userId, accountIdentifier]
        );

        // Delete old accounts with different Unipile IDs
        if (oldAccounts && oldAccounts.length > 0) {
          for (const oldAccount of oldAccounts) {
            if (oldAccount.unipile_account_id !== unipileAccount.id) {
              console.log(`🔄 Reconnection detected - removing old account: ${oldAccount.unipile_account_id}`);
              await pool.query('DELETE FROM workspace_accounts WHERE id = $1', [oldAccount.id]);
              deletedCount++;
            }
          }
        }

        // Upsert the current account
        const { rows: upsertResult } = await pool.query(
          `INSERT INTO workspace_accounts (
            workspace_id, user_id, account_type, account_identifier, account_name,
            unipile_account_id, unipile_sources, connection_status, is_active,
            connected_at, account_metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (workspace_id, user_id, account_type, account_identifier)
          DO UPDATE SET
            account_name = EXCLUDED.account_name,
            unipile_account_id = EXCLUDED.unipile_account_id,
            unipile_sources = EXCLUDED.unipile_sources,
            connection_status = EXCLUDED.connection_status,
            is_active = EXCLUDED.is_active,
            connected_at = EXCLUDED.connected_at,
            account_metadata = EXCLUDED.account_metadata
          RETURNING *`,
          [
            workspaceId,
            userId,
            'linkedin',
            accountIdentifier,
            unipileAccount.name || connectionParams.publicIdentifier || accountIdentifier,
            unipileAccount.id,
            JSON.stringify(unipileAccount.sources || []),
            connectionStatus,
            true,
            new Date().toISOString(),
            JSON.stringify({
              unipile_instance: process.env.UNIPILE_DSN || null,
              provider: unipileAccount.type,
              premium_features: connectionParams.premiumFeatures || []
            })
          ]
        );

        if (!upsertResult || upsertResult.length === 0) {
          console.error(`❌ Failed to upsert account ${unipileAccount.id}`);
          errors.push({ account_id: unipileAccount.id, error: 'Upsert returned no rows' });
        } else {
          if (existingAccountIds.has(unipileAccount.id)) {
            updatedCount++;
            console.log(`✅ Updated: ${unipileAccount.name} (${unipileAccount.id})`);
          } else {
            addedCount++;
            console.log(`✅ Added: ${unipileAccount.name} (${unipileAccount.id})`);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing account ${unipileAccount.id}:`, error);
        errors.push({
          account_id: unipileAccount.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Remove accounts from workspace_accounts that no longer exist in Unipile
    const unipileAccountIds = new Set(userLinkedInAccountsFromUnipile.map((acc: any) => acc.id));
    for (const existing of existingWorkspaceAccounts || []) {
      if (!unipileAccountIds.has(existing.unipile_account_id)) {
        console.log(`🗑️  Removing stale account: ${existing.account_name} (${existing.unipile_account_id})`);
        try {
          await pool.query('DELETE FROM workspace_accounts WHERE id = $1', [existing.id]);
          deletedCount++;
        } catch (deleteError) {
          console.error(`❌ Failed to delete stale account:`, deleteError);
          errors.push({ account_id: existing.unipile_account_id, error: deleteError instanceof Error ? deleteError.message : 'Delete failed' });
        }
      }
    }

    console.log(`✅ Sync complete - Added: ${addedCount}, Updated: ${updatedCount}, Deleted: ${deletedCount}`);

    return NextResponse.json({
      success: true,
      message: 'LinkedIn accounts synced successfully',
      summary: {
        added: addedCount,
        updated: updatedCount,
        deleted: deletedCount,
        errors: errors.length
      },
      workspace_id: workspaceId,
      user_email: userEmail,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('💥 Sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed'
    }, { status: 500 });
  }
}
