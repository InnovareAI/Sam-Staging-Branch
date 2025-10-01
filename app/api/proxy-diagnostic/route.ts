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
      .from('unipile_accounts')
      .select('id, provider, provider_account_id, display_name, status, created_at')
      .eq('user_id', user.id)
      .eq('provider', 'LINKEDIN');
    
    return NextResponse.json({
      success: true,
      user: {
        id: profile?.id,
        email: profile?.email,
        created_at: profile?.created_at,
        profile_country: profile?.profile_country || 'Not set',
      },
      unipile_configuration: {
        proxy_country: profile?.profile_country || 'Not set',
        note: 'This country is sent to Unipile when connecting LinkedIn accounts. Unipile handles the actual proxy assignment on their backend.',
      },
      unipile_linkedin_accounts: unipileAccounts?.map(acc => ({
        id: acc.id,
        provider_account_id: acc.provider_account_id,
        display_name: acc.display_name,
        status: acc.status,
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
