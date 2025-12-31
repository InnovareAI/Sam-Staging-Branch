import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

// Helper function to make Unipile API calls
async function callUnipileAPI(endpoint: string, method: string = 'GET', body?: any) {
  const unipileDsn = process.env.UNIPILE_DSN;
  const unipileApiKey = process.env.UNIPILE_API_KEY;

  if (!unipileDsn || !unipileApiKey) {
    throw new Error('Unipile API credentials not configured');
  }

  const url = `https://${unipileDsn}/api/v1/${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'X-API-KEY': unipileApiKey,
      'Accept': 'application/json',
      ...(body && { 'Content-Type': 'application/json' })
    },
    ...(body && { body: JSON.stringify(body) })
  };

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Unipile API error: ${response.status} ${response.statusText}`, errorText);
    throw new Error(`Unipile API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId, userEmail } = await verifyAuth(request);

    console.log(`Disconnecting LinkedIn accounts for user ${userEmail} (${userId})`);
    console.log(`User workspace: ${workspaceId}`);

    // First, get all LinkedIn accounts to delete from Unipile
    const { rows: accountsToDelete } = await pool.query(
      `SELECT * FROM workspace_accounts
       WHERE workspace_id = $1 AND account_type = 'linkedin'`,
      [workspaceId]
    );

    console.log(`Found ${accountsToDelete?.length || 0} LinkedIn accounts to disconnect`);

    // Delete from Unipile first
    let unipileDeletedCount = 0;
    let unipileErrors: any[] = [];

    for (const account of accountsToDelete || []) {
      if (account.unipile_account_id) {
        try {
          console.log(`Deleting Unipile account ${account.unipile_account_id} (${account.account_name})`);
          await callUnipileAPI(`accounts/${account.unipile_account_id}`, 'DELETE');
          unipileDeletedCount++;
          console.log(`Deleted from Unipile: ${account.account_name}`);
        } catch (error) {
          console.error(`Failed to delete from Unipile: ${account.account_name}`, error);
          unipileErrors.push({
            account_name: account.account_name,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    // Remove all LinkedIn accounts from workspace_accounts database
    const { rows: deletedAccounts } = await pool.query(
      `DELETE FROM workspace_accounts
       WHERE workspace_id = $1 AND account_type = 'linkedin'
       RETURNING *`,
      [workspaceId]
    );

    console.log(`Successfully disconnected ${deletedAccounts?.length || 0} LinkedIn accounts from workspace`);
    console.log(`Deleted ${unipileDeletedCount} accounts from Unipile`);

    return NextResponse.json({
      success: true,
      message: 'LinkedIn accounts disconnected successfully',
      disconnected_accounts: deletedAccounts?.length || 0,
      unipile_deleted_count: unipileDeletedCount,
      unipile_errors: unipileErrors.length > 0 ? unipileErrors : undefined,
      workspace_id: workspaceId,
      user_email: userEmail
    });

  } catch (error) {
    console.error('Disconnect error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Disconnect failed'
    }, { status: 500 });
  }
}
