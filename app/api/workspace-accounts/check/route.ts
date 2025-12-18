import { NextRequest, NextResponse } from 'next/server';
import { createCleanRouteHandlerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const workspace_id = searchParams.get('workspace_id');

    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
    }

    const supabase = await createCleanRouteHandlerClient();

    // Check LinkedIn connection
    const { data: linkedinAccounts } = await supabase
      .from('workspace_accounts')
      .select('id, unipile_account_id, connection_status')
      .eq('workspace_id', workspace_id)
      .eq('account_type', 'linkedin')
      .in('connection_status', ['connected', 'active'])
      .limit(1);

    const linkedinAccount = linkedinAccounts?.[0] || null;

    // Check Email connection - use limit(1) instead of maybeSingle()
    // because user may have multiple email accounts connected
    const { data: emailAccounts } = await supabase
      .from('workspace_accounts')
      .select('id, unipile_account_id, connection_status')
      .eq('workspace_id', workspace_id)
      .eq('account_type', 'email')
      .in('connection_status', ['connected', 'active'])
      .limit(1);

    const emailAccount = emailAccounts?.[0] || null;

    return NextResponse.json({
      success: true,
      linkedin_connected: !!linkedinAccount,
      linkedin_account_id: linkedinAccount?.id || null,
      linkedin_unipile_id: linkedinAccount?.unipile_account_id || null,
      email_connected: !!emailAccount,
      email_account_id: emailAccount?.id || null,
      email_unipile_id: emailAccount?.unipile_account_id || null
    });
  } catch (error) {
    console.error('Error checking workspace accounts:', error);
    return NextResponse.json(
      {
        error: 'Failed to check workspace accounts',
        linkedin_connected: false,
        email_connected: false
      },
      { status: 500 }
    );
  }
}
