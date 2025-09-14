import { NextRequest, NextResponse } from 'next/server';

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
    console.log('🔍 Fetching Unipile accounts for Contact Center backend integration...');

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
    
    // Log account details for debugging
    accounts.forEach((account: any, index: number) => {
      console.log(`Account ${index + 1}:`, {
        id: account.id,
        name: account.name,
        type: account.type,
        status: account.sources?.map((s: any) => s.status),
        created: account.created_at
      });
    });

    // Transform accounts for Contact Center display
    const formattedAccounts = accounts
      .filter((account: any) => account.type === 'LINKEDIN') // Focus on LinkedIn for now
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
          messageCount: isConnected ? Math.floor(Math.random() * 20) : 0, // Mock count for now
          email: account.connection_params?.im?.publicIdentifier ? 
                 `@${account.connection_params.im.publicIdentifier}` : 
                 account.connection_params?.im?.username || 'LinkedIn User',
          organizations: account.connection_params?.im?.organizations?.map((org: any) => org.name) || [],
          // Additional debug info
          raw_status: sourceStatus,
          source_count: account.sources?.length || 0
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
        message: 'No LinkedIn accounts found. Connect your LinkedIn through the Unipile integration first.',
        debug_info: {
          total_accounts: accounts.length,
          linkedin_accounts: accounts.filter((a: any) => a.type === 'LINKEDIN').length,
          other_accounts: accounts.filter((a: any) => a.type !== 'LINKEDIN').map((a: any) => a.type)
        },
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({
      success: true,
      accounts: formattedAccounts,
      total: formattedAccounts.length,
      connected_count: formattedAccounts.filter(a => a.status === 'connected').length,
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