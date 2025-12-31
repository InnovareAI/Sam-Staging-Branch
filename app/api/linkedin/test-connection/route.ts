import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

async function callUnipileAPI(endpoint: string) {
  const unipileDsn = process.env.UNIPILE_DSN;
  const unipileApiKey = process.env.UNIPILE_API_KEY;

  if (!unipileDsn || !unipileApiKey) {
    throw new Error('Unipile API credentials not configured');
  }

  const response = await fetch(`https://${unipileDsn}/api/v1/${endpoint}`, {
    headers: {
      'X-API-KEY': unipileApiKey,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Unipile API error: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.json();
}

function evaluateAccountStatus(account: any) {
  const sources = account?.sources || [];
  const primary = sources[0];
  const status = primary?.status || 'UNKNOWN';
  const functional = status === 'OK' || status === 'RUNNING' || status === 'HEALTHY';

  return {
    account_id: account.id,
    name: account.name,
    raw_status: status,
    functional,
    last_test: new Date().toISOString(),
    error: functional ? null : 'Re-authentication required'
  };
}

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await verifyAuth(request);

    // Get workspace accounts
    const { rows: workspaceAccounts } = await pool.query(
      `SELECT unipile_account_id, connection_status
       FROM workspace_accounts
       WHERE workspace_id = $1 AND user_id = $2 AND account_type = 'linkedin'`,
      [workspaceId, userId]
    );

    if (!workspaceAccounts || workspaceAccounts.length === 0) {
      return NextResponse.json({
        success: true,
        functional: false,
        overall_status: 'no_accounts',
        account_count: 0,
        functional_count: 0,
        accounts: [],
        last_checked: new Date().toISOString()
      });
    }

    const unipileAccountsData = await callUnipileAPI('accounts');
    const allAccounts = Array.isArray(unipileAccountsData)
      ? unipileAccountsData
      : (unipileAccountsData.items || unipileAccountsData.accounts || []);

    const targetIds = new Set(
      workspaceAccounts
        .map((acc: any) => acc.unipile_account_id)
        .filter(Boolean)
    );

    const matchedAccounts = allAccounts.filter((account: any) => targetIds.has(account.id));

    const accountStatus = matchedAccounts.map(evaluateAccountStatus);
    const functionalAccounts = accountStatus.filter((acc: any) => acc.functional);

    let overallStatus: 'no_accounts' | 'fully_functional' | 'partially_functional' | 'all_non_functional';
    if (accountStatus.length === 0) {
      overallStatus = 'no_accounts';
    } else if (functionalAccounts.length === 0) {
      overallStatus = 'all_non_functional';
    } else if (functionalAccounts.length === accountStatus.length) {
      overallStatus = 'fully_functional';
    } else {
      overallStatus = 'partially_functional';
    }

    return NextResponse.json({
      success: true,
      functional: functionalAccounts.length > 0,
      overall_status: overallStatus,
      account_count: accountStatus.length,
      functional_count: functionalAccounts.length,
      accounts: accountStatus,
      summary: {
        total_accounts: accountStatus.length,
        functional_accounts: functionalAccounts.length,
        credential_issues: accountStatus.length - functionalAccounts.length,
        rate_limited: 0
      },
      last_checked: new Date().toISOString()
    });
  } catch (error) {
    console.error('LinkedIn connection test failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'LinkedIn connection test failed',
      functional: false,
      debug_error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
