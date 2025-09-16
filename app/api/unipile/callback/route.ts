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

    // TODO: Store account details in database
    // For now, we'll store in a simple table structure
    try {
      const { error: dbError } = await supabase
        .from('connected_accounts')
        .upsert({
          account_id: accountData.id,
          email: accountData.email,
          platform: accountData.type.toLowerCase(),
          provider: accountData.type === 'GMAIL' ? 'google' : 'microsoft',
          status: 'connected',
          metadata: {
            unipile_data: accountData,
            connected_at: new Date().toISOString(),
          },
        });

      if (dbError) {
        console.error('❌ Database error:', dbError);
        // Continue anyway - don't fail the OAuth flow
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