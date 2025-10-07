import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
        const { data: userData } = await supabase.auth.admin.listUsers();
        const user = userData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

        if (user) {
          // Get user's workspace
          const { data: userProfile } = await supabase
            .from('users')
            .select('current_workspace_id')
            .eq('id', user.id)
            .single();

          const workspaceId = userProfile?.current_workspace_id;

          if (workspaceId) {
            // Store in workspace_accounts
            const { error: dbError } = await supabase
              .from('workspace_accounts')
              .upsert({
                workspace_id: workspaceId,
                user_id: user.id,
                account_type: 'email',
                account_identifier: email,
                account_name: email,
                unipile_account_id: accountData.id,
                connection_status: 'connected',
                is_active: true,
                account_metadata: {
                  platform: accountData.type,
                  provider: accountData.type === 'GMAIL' ? 'google' : 'microsoft',
                  unipile_data: accountData,
                  connected_at: new Date().toISOString()
                }
              }, {
                onConflict: 'workspace_id,user_id,account_type,account_identifier'
              });

            if (dbError) {
              console.error('❌ Database error:', dbError);
            } else {
              console.log('✅ Stored email account in workspace_accounts');
            }
          }
        }
      }
    } catch (dbError) {
      console.error('❌ Database connection error:', dbError);
      // Continue anyway - don't fail the OAuth flow
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