import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Firebase auth - workspace comes from header
    let authContext;
    try {
      authContext = await verifyAuth(request);
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json({
        success: false,
        error: authError.message
      }, { status: authError.statusCode });
    }

    const { userId } = authContext;

    // 1. Check user profile country (used by Unipile for proxy assignment)
    const { rows: profileRows } = await pool.query(
      `SELECT id, email, profile_country, created_at FROM users WHERE id = $1`,
      [userId]
    );

    const profile = profileRows[0];

    // 2. Get Unipile LinkedIn accounts
    const { rows: unipileAccounts } = await pool.query(
      `SELECT unipile_account_id, platform, account_name, account_email, connection_status, created_at
       FROM user_unipile_accounts
       WHERE user_id = $1 AND platform = 'LINKEDIN'`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      user: {
        auth_user_id: userId,
        profile_id: profile?.id,
        email: profile?.email,
        created_at: profile?.created_at,
        profile_country: profile?.profile_country || 'Not set',
      },
      unipile_configuration: {
        proxy_country: profile?.profile_country || 'Not set',
        note: 'This country is sent to Unipile when connecting LinkedIn accounts. Unipile handles the actual proxy assignment on their backend.',
      },
      unipile_linkedin_accounts: unipileAccounts?.map((acc: any) => ({
        unipile_account_id: acc.unipile_account_id,
        account_name: acc.account_name,
        account_email: acc.account_email,
        connection_status: acc.connection_status,
        created_at: acc.created_at,
      })) || [],
      summary: {
        has_profile_country: !!profile?.profile_country,
        linkedin_accounts_count: unipileAccounts?.length || 0,
        proxy_managed_by: 'Unipile (backend)',
      }
    });

  } catch (error) {
    console.error('Proxy diagnostic error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
