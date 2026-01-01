
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/security/route-auth';

export async function GET(request: Request) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    // Get all workspace accounts
    const { data: allAccounts, error } = await supabase
      .from('workspace_accounts')
      .select(`
        *,
        workspaces(name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by workspace
    const byWorkspace: Record<string, any[]> = {};
    allAccounts?.forEach(acc => {
      const wsName = acc.workspaces?.name || 'Unknown';
      if (!byWorkspace[wsName]) byWorkspace[wsName] = [];
      byWorkspace[wsName].push({
        account_type: acc.account_type,
        account_identifier: acc.account_identifier,
        account_name: acc.account_name,
        unipile_account_id: acc.unipile_account_id,
        connection_status: acc.connection_status,
        user_id: acc.user_id,
        created_at: acc.created_at
      });
    });

    return NextResponse.json({
      total: allAccounts?.length || 0,
      by_workspace: byWorkspace,
      all_accounts: allAccounts
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
