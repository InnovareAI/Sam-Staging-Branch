
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/security/route-auth';

export async function POST(request: Request) {
  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  // Create Supabase client at runtime (not build time)
  try {
    const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';
    const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

    console.log('🔧 Adding workspace membership for tl@innovareai.com...');

    // Add user to workspace_members
    const { data: membership, error: insertError } = await supabase
      .from('workspace_members')
      .upsert({
        workspace_id: workspaceId,
        user_id: userId,
        role: 'admin' // Use 'admin' role (owner, admin, or member)
      }, {
        onConflict: 'workspace_id,user_id'
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Failed to add membership:', insertError);
      return NextResponse.json({
        success: false,
        error: insertError.message
      }, { status: 500 });
    }

    console.log('✅ Membership added:', membership);

    // Verify it worked
    const { data: verification } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single();

    return NextResponse.json({
      success: true,
      message: 'Workspace membership added',
      membership,
      verification
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
