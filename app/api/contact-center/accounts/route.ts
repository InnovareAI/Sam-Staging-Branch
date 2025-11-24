import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

// Helper function to make Unipile API calls
async function callUnipileAPI(endpoint: string, method: string = 'GET') {
  const unipileDsn = process.env.UNIPILE_DSN;
  const unipileApiKey = process.env.UNIPILE_API_KEY;

  if (!unipileDsn || !unipileApiKey) {
    throw new Error('Unipile API credentials not configured');
  }

  const url = `https://${unipileDsn}/api/v1/${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'X-API-KEY': unipileApiKey,
      'Accept': 'application/json',
    }
  };

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Unipile API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching Unipile accounts for Contact Center...');

    // 🚨 SECURITY: Get user authentication for workspace filtering
    const supabase = createRouteHandlerClient({ cookies: cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        accounts: [],
        total: 0,
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }

    // Get user's current workspace
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()

    // 🚨 TEMPORARY: Allow super admins to access even without workspace association
    const userEmail = user.email?.toLowerCase() || ''
    const isSuperAdmin = ['tl@innovareai.com', 'cl@innovareai.com'].includes(userEmail)

    if (!userProfile?.current_workspace_id && !isSuperAdmin) {
      return NextResponse.json({
        success: false,
        error: 'User not associated with any workspace',
        accounts: [],
        total: 0,
        timestamp: new Date().toISOString()
      }, { status: 403 })
    }

    if (!process.env.UNIPILE_DSN || !process.env.UNIPILE_API_KEY) {
      console.error('❌ Unipile credentials not configured');
      return NextResponse.json({
        success: false,
        error: 'Unipile integration not configured. Please check environment variables.',
        accounts: [],
        total: 0,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // Fetch accounts directly from Unipile backend
    console.log('🌐 Making direct call to Unipile API...');
    const data = await callUnipileAPI('accounts');
    const accounts = Array.isArray(data) ? data : (data.items || data.accounts || []);

    console.log(`📊 Found ${accounts.length} total accounts from Unipile`);
    
    // 🛡️ SECURITY: Get user's associated accounts only
    const { data: userAccounts } = await supabase
      .from('user_unipile_accounts')
      .select('unipile_account_id, platform, account_name, account_email, linkedin_profile_url')
      .eq('user_id', user.id)

    const userAccountIds = new Set(userAccounts?.map(acc => acc.unipile_account_id) || [])
    console.log(`🔍 Debug: User associated account IDs:`, Array.from(userAccountIds))

    // Filter to only show LinkedIn accounts that belong to this user's workspace
    const workspaceLinkedInAccounts = accounts.filter((account: any) => 
      account.type === 'LINKEDIN' && userAccountIds.has(account.id)
    )

    console.log(`🔒 Security: User ${user.email} ${isSuperAdmin ? '(SUPER ADMIN)' : `in workspace ${userProfile?.current_workspace_id}`} has ${workspaceLinkedInAccounts.length} LinkedIn accounts`);
    const allLinkedInAccounts = accounts.filter((a: any) => a.type === 'LINKEDIN')
    console.log(`🔍 Debug: All LinkedIn accounts in Unipile: ${allLinkedInAccounts.length}`)
    console.log(`🔍 Debug: LinkedIn account IDs in Unipile:`, allLinkedInAccounts.map(acc => acc.id))
    console.log(`✅ User accounts:`, workspaceLinkedInAccounts.map(acc => ({ 
      id: acc.id, 
      name: acc.name, 
      email: acc.connection_params?.im?.publicIdentifier 
    })));
    
    // Transform user's LinkedIn accounts for Contact Center display
    const formattedAccounts = workspaceLinkedInAccounts
      .map((account: any) => {
        const sourceStatus = account.sources?.[0]?.status;
        const isConnected = sourceStatus === 'OK';
        const needsCredentials = sourceStatus === 'CREDENTIALS';
        
        return {
          id: account.id,
          name: account.name,
          platform: 'linkedin' as const,
          status: isConnected ? 'connected' as const : 
                  needsCredentials ? 'disconnected' as const : 'syncing' as const,
          lastSync: isConnected ? 'Connected' : 'Connection issue',
          messageCount: isConnected ? Math.floor(Math.random() * 20) + 5 : 0, // Mock count for now
          email: account.connection_params?.im?.publicIdentifier ? 
                 `@${account.connection_params.im.publicIdentifier}` : 
                 account.connection_params?.im?.username || account.name || 'LinkedIn User',
          organizations: account.connection_params?.im?.organizations?.map((org: any) => org.name) || [],
          // Additional debug info
          raw_status: sourceStatus,
          source_count: account.sources?.length || 0,
          created_at: account.created_at,
          updated_at: account.updated_at
        };
      });

    console.log('✅ Formatted accounts for Contact Center:', {
      total: formattedAccounts.length,
      connected: formattedAccounts.filter(a => a.status === 'connected').length,
      disconnected: formattedAccounts.filter(a => a.status === 'disconnected').length
    });

    // If no accounts found, provide helpful message
    if (formattedAccounts.length === 0) {
      return NextResponse.json({
        success: true,
        accounts: [],
        total: 0,
        message: `No LinkedIn accounts found in Unipile. Total accounts found: ${accounts.length}`,
        debug_info: {
          total_accounts_in_unipile: accounts.length,
          linkedin_accounts_found: accounts.filter((a: any) => a.type === 'LINKEDIN').length,
          all_account_types: accounts.map((a: any) => a.type),
          workspace_filtering_active: true,
          user_workspace: userProfile?.current_workspace_id || 'none'
        },
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({
      success: true,
      accounts: formattedAccounts,
      total: formattedAccounts.length,
      connected_count: formattedAccounts.filter(a => a.status === 'connected').length,
      workspace_filtering_active: true,
      user_workspace: userProfile?.current_workspace_id || 'none',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching Contact Center accounts from Unipile:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        success: false,
        error: `Failed to fetch connected accounts: ${errorMessage}`,
        accounts: [],
        total: 0,
        debug_info: {
          error_type: error instanceof Error ? error.constructor.name : typeof error,
          unipile_configured: !!(process.env.UNIPILE_DSN && process.env.UNIPILE_API_KEY)
        },
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}