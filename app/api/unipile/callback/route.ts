import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/auth';

/**
 * GET /api/unipile/callback
 * Handle Unipile OAuth callback for email connections
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    const status = searchParams.get('status');
    const error = searchParams.get('error');

    console.log('🔄 Unipile callback received:', { accountId, status, error });

    if (error || status !== 'success') {
      console.error('❌ Unipile OAuth failed:', error);
      // Redirect to frontend with error
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/contact-center?error=oauth_failed&message=${encodeURIComponent(error || 'Authentication failed')}`
      );
    }

    if (!accountId) {
      console.error('❌ No account ID in Unipile callback');
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/contact-center?error=missing_account&message=No account ID received`
      );
    }

    // Get account details from Unipile
    const unipileApiKey = process.env.UNIPILE_API_KEY;
    const unipileBaseUrl = process.env.UNIPILE_BASE_URL || 'https://api.unipile.com';

    const accountResponse = await fetch(`${unipileBaseUrl}/v1/accounts/${accountId}`, {
      headers: {
        'X-API-Key': unipileApiKey!,
      },
    });

    if (!accountResponse.ok) {
      console.error('❌ Failed to fetch account details from Unipile');
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/contact-center?error=account_fetch_failed`
      );
    }

    const accountData = await accountResponse.json();
    console.log('📧 Unipile account connected:', {
      id: accountData.id,
      email: accountData.email,
      type: accountData.type,
      status: accountData.status
    });

    // Store email account in workspace_accounts
    try {
      // Get user from session - extract from redirect or use service role to find by email
      const email = accountData.connection_params?.mail?.username ||
                    accountData.connection_params?.im?.email ||
                    accountData.connection_params?.email ||
                    accountData.name ||
                    accountData.email;

      if (email) {
        // Find user by email
        const { rows: users } = await pool.query(
          'SELECT id FROM users WHERE email = $1',
          [email.toLowerCase()]
        );
        const user = users[0];

        if (user) {
          // Get user's workspace
          const { rows: userProfiles } = await pool.query(
            'SELECT current_workspace_id FROM users WHERE id = $1',
            [user.id]
          );
          const workspaceId = userProfiles[0]?.current_workspace_id;

          if (workspaceId) {
            // Store in workspace_accounts
            await pool.query(
              `INSERT INTO workspace_accounts
               (workspace_id, user_id, account_type, account_identifier, account_name,
                unipile_account_id, connection_status, is_active, account_metadata)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (workspace_id, user_id, account_type, account_identifier)
               DO UPDATE SET
                 unipile_account_id = EXCLUDED.unipile_account_id,
                 connection_status = EXCLUDED.connection_status,
                 is_active = EXCLUDED.is_active,
                 account_metadata = EXCLUDED.account_metadata,
                 updated_at = NOW()`,
              [
                workspaceId,
                user.id,
                'email',
                email,
                email,
                accountData.id,
                'connected',
                true,
                JSON.stringify({
                  platform: accountData.type,
                  provider: accountData.type === 'GMAIL' ? 'google' : 'microsoft',
                  unipile_data: accountData,
                  connected_at: new Date().toISOString()
                })
              ]
            );

            console.log('✅ Stored email account in workspace_accounts');
          } else {
            throw new Error('No workspace found for user - cannot store email account');
          }
        } else {
          throw new Error('User not found - cannot store email account');
        }
      } else {
        throw new Error('No email address found in account data');
      }
    } catch (dbError) {
      console.error('❌ Database connection error:', dbError);
      // CRITICAL: Fail the flow - don't let user think account is connected when it's not
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/contact-center?error=account_connection_failed&message=${encodeURIComponent(dbError instanceof Error ? dbError.message : 'Failed to store email account')}`
      );
    }

    console.log(`✅ ${accountData.type} account connected successfully: ${accountData.email}`);

    // Redirect to frontend with success
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/contact-center?success=email_connected&email=${encodeURIComponent(accountData.email)}&platform=${accountData.type.toLowerCase()}`
    );

  } catch (error) {
    console.error('❌ Unipile callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/contact-center?error=callback_error&message=Internal server error`
    );
  }
}
