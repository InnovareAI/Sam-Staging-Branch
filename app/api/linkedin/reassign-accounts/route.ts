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
      .eq('platform', 'LINKEDIN');
    
    if (fetchError || !accounts) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch accounts'
      }, { status: 500 });
    }
    
    const unipileDsn = process.env.UNIPILE_DSN;
    const unipileApiKey = process.env.UNIPILE_API_KEY;
    
    if (!unipileDsn || !unipileApiKey) {
      return NextResponse.json({
        success: false,
        error: 'Unipile not configured'
      }, { status: 500 });
    }
    
    const reassignments = [];
    const errors = [];
    
    for (const account of accounts) {
      try {
        // Get LinkedIn email from Unipile
        const response = await fetch(`https://${unipileDsn}/api/v1/accounts/${account.unipile_account_id}`, {
          headers: {
            'X-API-KEY': unipileApiKey,
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          errors.push({
            account_id: account.unipile_account_id,
            account_name: account.account_name,
            error: `Failed to fetch from Unipile: ${response.status}`
          });
          continue;
        }
        
        const unipileData = await response.json();
        const linkedinEmail = unipileData.connection_params?.im?.email || unipileData.connection_params?.email;
        
        if (!linkedinEmail) {
          errors.push({
            account_id: account.unipile_account_id,
            account_name: account.account_name,
            error: 'No email found in LinkedIn data'
          });
          continue;
        }
        
        // Find user with this email
        const { data: matchedUser } = await supabase
          .from('users')
          .select('id, email')
          .eq('email', linkedinEmail.toLowerCase())
          .single();
        
        if (!matchedUser) {
          errors.push({
            account_id: account.unipile_account_id,
            account_name: account.account_name,
            linkedin_email: linkedinEmail,
            error: 'No user found with this email in database'
          });
          continue;
        }
        
        // Update the account to the correct user
        const { error: updateError } = await supabase
          .from('user_unipile_accounts')
          .update({ user_id: matchedUser.id })
          .eq('id', account.id);
        
        if (updateError) {
          errors.push({
            account_id: account.unipile_account_id,
            account_name: account.account_name,
            error: `Failed to update: ${updateError.message}`
          });
          continue;
        }
        
        reassignments.push({
          account_id: account.unipile_account_id,
          account_name: account.account_name,
          linkedin_email: linkedinEmail,
          from_user: user.email,
          to_user: matchedUser.email,
          status: 'reassigned'
        });
        
      } catch (err) {
        errors.push({
          account_id: account.unipile_account_id,
          account_name: account.account_name,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      reassignments,
      errors,
      summary: {
        total: accounts.length,
        reassigned: reassignments.length,
        failed: errors.length
      }
    });
    
  } catch (error) {
    console.error('Reassignment error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
