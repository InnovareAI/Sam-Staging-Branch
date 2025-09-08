import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';

// GET /api/sam/conversations - List user's conversations
export async function GET(req: NextRequest) {
  try {
    console.log('🔍 Sam conversations API called');
    const { userId } = await auth();
    console.log('👤 User ID from auth:', userId);
    
    if (!userId) {
      console.log('❌ No user ID - unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('📊 Creating supabase admin client...');
    const supabase = supabaseAdmin();
    
    // Get user's workspace/tenant info
    const { data: userData } = await supabase
      .from('users')
      .select('id, current_workspace_id')
      .eq('clerk_id', userId)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get conversations for this user's workspace
    const { data: conversations, error } = await supabase
      .from('sam_conversations')
      .select(`
        id,
        title,
        status,
        current_discovery_stage,
        discovery_progress,
        last_sam_message,
        last_user_message,
        last_active_at,
        created_at,
        updated_at
      `)
      .eq('workspace_id', userData.current_workspace_id)
      .eq('user_id', userData.id)
      .order('last_active_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching conversations:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ conversations });

  } catch (error) {
    console.error('Error in conversations GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/sam/conversations - Create new conversation
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title } = body;

    const supabase = supabaseAdmin();
    
    // Get user's workspace/tenant info
    const { data: userData } = await supabase
      .from('users')
      .select('id, current_workspace_id')
      .eq('clerk_id', userId)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create new conversation
    const { data: conversation, error } = await supabase
      .from('sam_conversations')
      .insert({
        workspace_id: userData.current_workspace_id,
        user_id: userData.id,
        tenant_id: userData.current_workspace_id,
        title: title || 'New Conversation',
        status: 'active',
        current_discovery_stage: 'introduction',
        discovery_progress: 0,
        conversation_context: {},
        business_profile: {}
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ conversation });

  } catch (error) {
    console.error('Error in conversations POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}