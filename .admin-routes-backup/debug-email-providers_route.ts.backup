import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function callUnipileAPI(endpoint: string) {
  const unipileDsn = process.env.UNIPILE_DSN;
  const unipileApiKey = process.env.UNIPILE_API_KEY;

  const url = `https://${unipileDsn}/api/v1/${endpoint}`;
  const response = await fetch(url, {
    headers: { 'X-API-KEY': unipileApiKey!, 'Accept': 'application/json' }
  });
  return await response.json();
}

export async function GET() {
  try {
    // Get tl@innovareai.com user
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const user = users?.find(u => u.email === 'tl@innovareai.com');

    if (!user) {
      return NextResponse.json({ error: 'User tl@innovareai.com not found' });
    }

    // Get workspace
    const { data: userData } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    const workspaceId = userData?.current_workspace_id;

    // Get workspace email accounts
    const { data: workspaceAccounts } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('account_type', 'email');

    const workspaceAccountIds = new Set(workspaceAccounts?.map(a => a.unipile_account_id) || []);

    // Get Unipile accounts
    const unipileResponse = await callUnipileAPI('accounts');
    const allAccounts = unipileResponse.items || [];

    const emailAccounts = allAccounts
      .filter((account: any) => {
        const belongsToWorkspace = workspaceAccountIds.has(account.id);
        const accountType = account.type?.toUpperCase() || '';
        const isEmailType = accountType.includes('GOOGLE') || accountType.includes('OUTLOOK') || accountType === 'MESSAGING';

        return belongsToWorkspace && isEmailType;
      });

    return NextResponse.json({
      user_id: user.id,
      user_email: user.email,
      workspace_id: workspaceId,
      workspace_accounts_count: workspaceAccounts?.length || 0,
      workspace_accounts: workspaceAccounts,
      workspace_account_ids: Array.from(workspaceAccountIds),
      unipile_total: allAccounts.length,
      filtered_email_accounts: emailAccounts.length,
      email_accounts: emailAccounts
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
