import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);

    // Get all LinkedIn accounts for this user
    const { rows: accounts } = await pool.query(
      `SELECT * FROM user_unipile_accounts
       WHERE user_id = $1 AND platform = 'LINKEDIN'`,
      [userId]
    );

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch accounts'
      }, { status: 500 });
    }

    const unipileDsn = process.env.UNIPILE_DSN;
    const unipileApiKey = process.env.UNIPILE_API_KEY;

    if (!unipileDsn || !unipileApiKey) {
      return NextResponse.json({
        success: false,
        error: 'Unipile not configured'
      }, { status: 500 });
    }

    const reassignments: any[] = [];
    const errors: any[] = [];

    for (const account of accounts) {
      try {
        // Get LinkedIn email from Unipile
        const response = await fetch(`https://${unipileDsn}/api/v1/accounts/${account.unipile_account_id}`, {
          headers: {
            'X-API-KEY': unipileApiKey,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          errors.push({
            account_id: account.unipile_account_id,
            account_name: account.account_name,
            error: `Failed to fetch from Unipile: ${response.status}`
          });
          continue;
        }

        const unipileData = await response.json();
        const linkedinEmail = unipileData.connection_params?.im?.email || unipileData.connection_params?.email;

        if (!linkedinEmail) {
          errors.push({
            account_id: account.unipile_account_id,
            account_name: account.account_name,
            error: 'No email found in LinkedIn data'
          });
          continue;
        }

        // Find user with this email
        const { rows: matchedUserRows } = await pool.query(
          `SELECT id, email FROM users WHERE email = $1`,
          [linkedinEmail.toLowerCase()]
        );
        const matchedUser = matchedUserRows[0];

        if (!matchedUser) {
          errors.push({
            account_id: account.unipile_account_id,
            account_name: account.account_name,
            linkedin_email: linkedinEmail,
            error: 'No user found with this email in database'
          });
          continue;
        }

        // Update the account to the correct user
        await pool.query(
          `UPDATE user_unipile_accounts SET user_id = $1 WHERE id = $2`,
          [matchedUser.id, account.id]
        );

        // Get original user email for logging
        const { rows: originalUserRows } = await pool.query(
          `SELECT email FROM users WHERE id = $1`,
          [userId]
        );
        const originalUserEmail = originalUserRows[0]?.email || 'unknown';

        reassignments.push({
          account_id: account.unipile_account_id,
          account_name: account.account_name,
          linkedin_email: linkedinEmail,
          from_user: originalUserEmail,
          to_user: matchedUser.email,
          status: 'reassigned'
        });

      } catch (err) {
        errors.push({
          account_id: account.unipile_account_id,
          account_name: account.account_name,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      reassignments,
      errors,
      summary: {
        total: accounts.length,
        reassigned: reassignments.length,
        failed: errors.length
      }
    });

  } catch (error) {
    console.error('Reassignment error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
