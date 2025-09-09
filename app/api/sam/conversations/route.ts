import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';

// Demo user configuration for non-authenticated access
const DEMO_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  workspace_id: '00000000-0000-4000-8000-000000000001', 
  name: 'Demo User'
};

// GET /api/sam/conversations - List user's conversations
export async function GET(req: NextRequest) {
  try {
    console.log('🔍 Sam conversations API called (demo mode)');
    
    const supabase = supabaseAdmin();
    
    // Use demo user for non-authenticated access
    const userId = DEMO_USER.id;
    const workspaceId = DEMO_USER.workspace_id;
    
    console.log('📊 Using demo user:', userId, 'workspace:', workspaceId);

    // Get conversations for demo user
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
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .order('last_active_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching conversations:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log('📋 Found conversations:', conversations?.length || 0);
    return NextResponse.json({ conversations: conversations || [] });

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
    console.log('🆕 Creating new conversation (demo mode)');
    
    const body = await req.json();
    const { title } = body;

    const supabase = supabaseAdmin();
    
    // Use demo user for non-authenticated access
    const userId = DEMO_USER.id;
    const workspaceId = DEMO_USER.workspace_id;

    // Create new conversation
    const { data: conversation, error } = await supabase
      .from('sam_conversations')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        tenant_id: workspaceId,
        title: title || 'New Conversation',
        status: 'active',
        current_discovery_stage: 'business_context',
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

    console.log('✅ Created conversation:', conversation?.id);
    return NextResponse.json({ conversation });

  } catch (error) {
    console.error('Error in conversations POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}