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
    
    // 1. Check user profile country
    const { data: profile } = await supabase
      .from('users')
      .select('id, email, profile_country, created_at')
      .eq('id', user.id)
      .single();
    
    // 2. Check user proxy preferences (Bright Data auto-assigned)
    const { data: proxyPrefs } = await supabase
      .from('user_proxy_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    
    // 3. Check LinkedIn proxy assignments (per LinkedIn account)
    const { data: linkedinProxies } = await supabase
      .from('linkedin_proxy_assignments')
      .select('*')
      .eq('user_id', user.id);
    
    // 4. Get Unipile accounts
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
      proxy_preferences: proxyPrefs ? {
        preferred_country: proxyPrefs.preferred_country,
        preferred_state: proxyPrefs.preferred_state,
        preferred_city: proxyPrefs.preferred_city,
        detected_location: proxyPrefs.detected_location,
        confidence_score: proxyPrefs.confidence_score,
        session_id: proxyPrefs.session_id,
        is_manual_selection: proxyPrefs.is_manual_selection,
        last_updated: proxyPrefs.last_updated,
        created_at: proxyPrefs.created_at,
      } : null,
      linkedin_proxy_assignments: linkedinProxies?.map(lpa => ({
        linkedin_account_id: lpa.linkedin_account_id,
        linkedin_account_name: lpa.linkedin_account_name,
        detected_country: lpa.detected_country,
        proxy_country: lpa.proxy_country,
        proxy_state: lpa.proxy_state,
        proxy_city: lpa.proxy_city,
        proxy_session_id: lpa.proxy_session_id,
        proxy_username: lpa.proxy_username,
        connectivity_status: lpa.connectivity_status,
        is_primary_account: lpa.is_primary_account,
        last_updated: lpa.last_updated,
        created_at: lpa.created_at,
      })) || [],
      unipile_linkedin_accounts: unipileAccounts?.map(acc => ({
        id: acc.id,
        provider_account_id: acc.provider_account_id,
        display_name: acc.display_name,
        status: acc.status,
        created_at: acc.created_at,
      })) || [],
      summary: {
        has_profile_country: !!profile?.profile_country,
        has_proxy_preferences: !!proxyPrefs,
        linkedin_accounts_count: unipileAccounts?.length || 0,
        linkedin_proxies_assigned: linkedinProxies?.length || 0,
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
