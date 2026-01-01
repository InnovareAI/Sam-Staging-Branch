
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/security/route-auth';

export async function GET(request: Request) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    // Get InnovareAI workspace
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id, name')
      .ilike('name', '%innovareai%')
      .single();

    if (!workspace) {
      return NextResponse.json({ error: 'InnovareAI workspace not found' });
    }

    // Get members
    const { data: members } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspace.id);

    const memberDetails = await Promise.all(
      (members || []).map(async (member) => {
        const { data: user } = await supabase.auth.admin.getUserById(member.user_id);
        return {
          user_id: member.user_id,
          email: user.user?.email,
          role: member.role,
          joined_at: member.joined_at
        };
      })
    );

    // Get workspace accounts
    const { data: accounts } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', workspace.id);

    // Get prospects
    const { data: prospects } = await supabase
      .from('workspace_prospects')
      .select('id, email, first_name, last_name, company, created_at')
      .eq('workspace_id', workspace.id)
      .limit(50);

    // Get campaigns
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, name, status, created_at')
      .eq('workspace_id', workspace.id);

    return NextResponse.json({
      workspace: workspace.name,
      workspace_id: workspace.id,
      members: memberDetails,
      accounts: accounts,
      prospects_count: prospects?.length || 0,
      prospects_sample: prospects?.slice(0, 10),
      campaigns: campaigns
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
