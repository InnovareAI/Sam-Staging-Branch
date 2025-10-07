
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/security/route-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';
    const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

    // Check workspace_members
    const { data: membership, error: memberError } = await supabase
      .from('workspace_members')
      .select('*, workspaces(name, domain)')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single();

    // Get all memberships for this user
    const { data: allMemberships } = await supabase
      .from('workspace_members')
      .select('*, workspaces(name, domain)')
      .eq('user_id', userId);

    // Get user's current_workspace_id from users table
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', userId)
      .single();

    // Get workspace details
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    return NextResponse.json({
      user_id: userId,
      workspace_id: workspaceId,
      is_member: !!membership,
      membership_details: membership,
      membership_error: memberError,
      all_user_memberships: allMemberships,
      user_current_workspace: userProfile?.current_workspace_id,
      workspace_details: workspace
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
