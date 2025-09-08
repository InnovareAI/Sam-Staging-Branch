import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// POST /api/workspaces/join - Accept workspace invitation
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { invite_token } = body;

    if (!invite_token) {
      return NextResponse.json(
        { error: 'Missing invite_token' }, 
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();
    
    // Use the stored function to accept invitation
    const { data, error } = await supabase.rpc('accept_workspace_invitation', {
      p_invite_token: invite_token,
      p_user_clerk_id: userId
    });

    if (error) {
      console.error('Error accepting invitation:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      workspace: data 
    });

  } catch (error) {
    console.error('Invitation acceptance error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}