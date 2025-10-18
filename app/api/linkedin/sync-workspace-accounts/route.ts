import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

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
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    console.log(`🔄 Syncing LinkedIn accounts for user ${user.email} (${user.id})`);

    // Get user's workspace
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    if (!userProfile?.current_workspace_id) {
      return NextResponse.json({
        success: false,
        error: 'No active workspace found'
      }, { status: 400 });
    }

    const workspaceId = userProfile.current_workspace_id;
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
    const { data: userLinkedInAccounts } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'LINKEDIN');

    const userAccountIds = new Set(userLinkedInAccounts?.map(acc => acc.unipile_account_id) || []);
    console.log(`👤 User has ${userAccountIds.size} LinkedIn account(s) in user_unipile_accounts`);

    // Filter to accounts belonging to this user
    const userLinkedInAccountsFromUnipile = linkedInAccounts.filter((acc: any) => 
      userAccountIds.has(acc.id)
    );

    console.log(`🔍 Matched ${userLinkedInAccountsFromUnipile.length} user account(s) in Unipile`);

    // Get existing workspace_accounts for this user
    const { data: existingWorkspaceAccounts } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('account_type', 'linkedin');

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
        const { data: oldAccounts } = await supabase
          .from('workspace_accounts')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('user_id', user.id)
          .eq('account_type', 'linkedin')
          .eq('account_identifier', accountIdentifier);

        // Delete old accounts with different Unipile IDs
        if (oldAccounts && oldAccounts.length > 0) {
          for (const oldAccount of oldAccounts) {
            if (oldAccount.unipile_account_id !== unipileAccount.id) {
              console.log(`🔄 Reconnection detected - removing old account: ${oldAccount.unipile_account_id}`);
              await supabase
                .from('workspace_accounts')
                .delete()
                .eq('id', oldAccount.id);
              deletedCount++;
            }
          }
        }

        // Upsert the current account
        const { error: upsertError } = await supabase
          .from('workspace_accounts')
          .upsert({
            workspace_id: workspaceId,
            user_id: user.id,
            account_type: 'linkedin',
            account_identifier: accountIdentifier,
            account_name: unipileAccount.name || connectionParams.publicIdentifier || accountIdentifier,
            unipile_account_id: unipileAccount.id,
            connection_status: connectionStatus,
            is_active: true,
            connected_at: new Date().toISOString(),
            account_metadata: {
              unipile_instance: process.env.UNIPILE_DSN || null,
              provider: unipileAccount.type,
              premium_features: connectionParams.premiumFeatures || []
            }
          }, {
            onConflict: 'workspace_id,user_id,account_type,account_identifier',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.error(`❌ Failed to upsert account ${unipileAccount.id}:`, upsertError);
          errors.push({ account_id: unipileAccount.id, error: upsertError.message });
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
        const { error: deleteError } = await supabase
          .from('workspace_accounts')
          .delete()
          .eq('id', existing.id);

        if (deleteError) {
          console.error(`❌ Failed to delete stale account:`, deleteError);
          errors.push({ account_id: existing.unipile_account_id, error: deleteError.message });
        } else {
          deletedCount++;
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
      user_email: user.email,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('💥 Sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed'
    }, { status: 500 });
  }
}
