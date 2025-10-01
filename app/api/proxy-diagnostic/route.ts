import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
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
    
    // 1. Check user profile country (used by Unipile for proxy assignment)
    const { data: profile } = await supabase
      .from('users')
      .select('id, email, profile_country, created_at')
      .eq('id', user.id)
      .single();
    
    // 2. Get Unipile LinkedIn accounts
    const { data: unipileAccounts } = await supabase
      .from('user_unipile_accounts')
      .select('unipile_account_id, platform, account_name, account_email, connection_status, created_at')
      .eq('user_id', user.id)
      .eq('platform', 'LINKEDIN');
    
    return NextResponse.json({
      success: true,
      user: {
        auth_user_id: user.id,
        profile_id: profile?.id,
        email: profile?.email,
        created_at: profile?.created_at,
        profile_country: profile?.profile_country || 'Not set',
      },
      unipile_configuration: {
        proxy_country: profile?.profile_country || 'Not set',
        note: 'This country is sent to Unipile when connecting LinkedIn accounts. Unipile handles the actual proxy assignment on their backend.',
      },
      unipile_linkedin_accounts: unipileAccounts?.map(acc => ({
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
