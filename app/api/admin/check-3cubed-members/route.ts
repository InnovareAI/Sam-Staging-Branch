
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/security/route-auth';

export async function GET(request: Request) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    // Get 3cubed workspace
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('id', 'ecb08e55-2b7e-4d49-8f50-d38e39ce2482')
      .single();

    if (!workspace) {
      return NextResponse.json({ error: '3cubed workspace not found' });
    }

    // Get all members
    const { data: members } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspace.id);

    // Get user details
    const memberDetails = await Promise.all(
      (members || []).map(async (member) => {
        const { data: user } = await supabase.auth.admin.getUserById(member.user_id);
        return {
          user_id: member.user_id,
          email: user.user?.email,
          role: member.role,
          joined_at: member.joined_at,
          status: member.status
        };
      })
    );

    return NextResponse.json({
      workspace: workspace.name,
      workspace_id: workspace.id,
      member_count: memberDetails.length,
      members: memberDetails
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
