import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

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

    // SIMPLIFIED PRIVACY PROTECTION: For now, just show Thorsten's account for testing
    // TODO: Implement proper user association database table
    console.log('⚠️ TEMP: Using simplified privacy filter for testing');

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
    
    // TEMPORARY PRIVACY PROTECTION: Only show Thorsten Linz account for testing
    // In production, this needs proper user authentication and account association
    const userAccounts = accounts.filter((account: any) => {
      if (account.type !== 'LINKEDIN') return false;
      
      // Only show accounts that contain "Thorsten" or "tvonlinz" for testing
      const accountName = account.name?.toLowerCase() || '';
      const accountEmail = account.connection_params?.im?.publicIdentifier?.toLowerCase() || '';
      
      return accountName.includes('thorsten') || accountEmail.includes('tvonlinz');
    });

    console.log(`🔒 Privacy Protection: Showing ${userAccounts.length} of ${accounts.length} accounts (Thorsten only)`);
    console.log(`✅ Filtered accounts:`, userAccounts.map(acc => ({ name: acc.name, email: acc.connection_params?.im?.publicIdentifier })));
    
    // Transform user's LinkedIn accounts for Contact Center display
    const formattedAccounts = userAccounts
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
          temp_fix_active: true
        },
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({
      success: true,
      accounts: formattedAccounts,
      total: formattedAccounts.length,
      connected_count: formattedAccounts.filter(a => a.status === 'connected').length,
      temp_fix_active: true,
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