import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

export async function POST(request: NextRequest) {
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
    
    // Get all LinkedIn accounts for this user
    const { data: accounts, error: fetchError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'LINKEDIN')
      .order('created_at', { ascending: true });
    
    if (fetchError || !accounts) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch accounts'
      }, { status: 500 });
    }
    
    if (accounts.length <= 1) {
      return NextResponse.json({
        success: true,
        message: 'No duplicates found',
        total_accounts: accounts.length
      });
    }
    
    // Keep the oldest account, delete the rest
    const keepAccount = accounts[0];
    const duplicates = accounts.slice(1);
    
    // Delete from database
    const { error: deleteError } = await supabase
      .from('user_unipile_accounts')
      .delete()
      .in('id', duplicates.map(d => d.id));
    
    if (deleteError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to delete duplicates from database'
      }, { status: 500 });
    }
    
    // Delete from Unipile
    const unipileDsn = process.env.UNIPILE_DSN;
    const unipileApiKey = process.env.UNIPILE_API_KEY;
    
    if (unipileDsn && unipileApiKey) {
      for (const dup of duplicates) {
        try {
          await fetch(`https://${unipileDsn}/api/v1/accounts/${dup.unipile_account_id}`, {
            method: 'DELETE',
            headers: {
              'X-API-KEY': unipileApiKey,
              'Accept': 'application/json'
            }
          });
        } catch (err) {
          console.error(`Failed to delete ${dup.unipile_account_id} from Unipile:`, err);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Cleaned up ${duplicates.length} duplicate account(s)`,
      kept_account: {
        id: keepAccount.unipile_account_id,
        name: keepAccount.account_name,
        created_at: keepAccount.created_at
      },
      deleted_count: duplicates.length
    });
    
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
