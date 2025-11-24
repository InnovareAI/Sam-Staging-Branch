import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

/**
 * Get LinkedIn proxy information from Unipile
 * Returns the actual proxy location and settings assigned by Unipile
 */
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

    console.log(`🔍 Fetching proxy info for user ${user.email}`);

    // Get user's LinkedIn accounts from workspace_accounts
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    if (!userProfile?.current_workspace_id) {
      return NextResponse.json({
        success: false,
        error: 'No workspace found'
      }, { status: 400 });
    }

    const { data: linkedinAccounts } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id, account_name, account_identifier')
      .eq('workspace_id', userProfile.current_workspace_id)
      .eq('user_id', user.id)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected');

    if (!linkedinAccounts || linkedinAccounts.length === 0) {
      return NextResponse.json({
        success: true,
        has_linkedin: false,
        accounts: []
      });
    }

    // Fetch account details from Unipile for each account
    const unipileDSN = process.env.UNIPILE_DSN!;
    const unipileApiKey = process.env.UNIPILE_API_KEY!;

    const accountsWithProxy = [];

    for (const account of linkedinAccounts) {
      try {
        const accountUrl = unipileDSN.includes('.')
          ? `https://${unipileDSN}/api/v1/accounts/${account.unipile_account_id}`
          : `https://${unipileDSN}.unipile.com:13443/api/v1/accounts/${account.unipile_account_id}`;

        const accountResponse = await fetch(accountUrl, {
          headers: {
            'X-API-KEY': unipileApiKey,
            'Accept': 'application/json'
          }
        });

        if (!accountResponse.ok) {
          console.error(`Failed to fetch account ${account.unipile_account_id}:`, accountResponse.status);
          continue;
        }

        const accountData = await accountResponse.json();
        
        // Extract proxy information from Unipile response
        // According to Unipile docs, proxy info is in sources array
        const proxyInfo = {
          account_id: account.unipile_account_id,
          account_name: account.account_name,
          account_email: account.account_identifier,
          // Unipile assigns proxy based on detected location
          detected_location: accountData.connection_params?.im?.location || null,
          detected_country: accountData.connection_params?.im?.country || null,
          // Proxy assignment (Unipile handles this automatically)
          proxy_country: accountData.proxy?.country || 
                        accountData.connection_params?.im?.country ||
                        accountData.sources?.[0]?.proxy_country ||
                        null,
          proxy_city: accountData.proxy?.city || 
                     accountData.sources?.[0]?.proxy_city ||
                     null,
          proxy_provider: 'Unipile (Automatic)',
          proxy_type: 'Residential',
          connection_status: accountData.sources?.[0]?.status || 'unknown'
        };

        accountsWithProxy.push(proxyInfo);
        
        console.log(`✅ Fetched proxy info for ${account.account_name}:`, {
          detected_location: proxyInfo.detected_location,
          proxy_country: proxyInfo.proxy_country
        });

      } catch (error) {
        console.error(`Error fetching account ${account.unipile_account_id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      has_linkedin: accountsWithProxy.length > 0,
      accounts: accountsWithProxy
    });

  } catch (error) {
    console.error('💥 Proxy info fetch error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch proxy info'
    }, { status: 500 });
  }
}
