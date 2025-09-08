import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// POST /api/workspaces/switch - Switch user's current workspace
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { workspace_id } = body;

    if (!workspace_id) {
      return NextResponse.json(
        { error: 'Missing workspace_id' }, 
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();
    
    // Use the stored function to switch workspace
    const { data, error } = await supabase.rpc('switch_user_workspace', {
      p_user_clerk_id: userId,
      p_workspace_id: workspace_id
    });

    if (error) {
      console.error('Error switching workspace:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      current_workspace_id: data.current_workspace_id 
    });

  } catch (error) {
    console.error('Workspace switching error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}