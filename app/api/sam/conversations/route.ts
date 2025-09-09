import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { supabaseAdmin } from '../../../../lib/supabase';

// GET /api/sam/conversations - List user's conversations
export async function GET(req: NextRequest) {
  try {
    // Get authenticated user from Clerk
    const { userId, orgId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('🔍 Sam conversations API called for user:', userId, 'org:', orgId);
    
    const supabase = supabaseAdmin();

    // Get conversations for authenticated user and their current organization
    let query = supabase
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
        updated_at,
        organization_id
      `)
      .eq('user_id', userId)
      .order('last_active_at', { ascending: false })
      .limit(20);

    // If user is in an organization, filter by organization
    if (orgId) {
      query = query.eq('organization_id', orgId);
    } else {
      // If no organization, show personal conversations only
      query = query.is('organization_id', null);
    }

    const { data: conversations, error } = await query;

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
    // Get authenticated user from Clerk
    const { userId, orgId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('🆕 Creating new conversation for user:', userId, 'org:', orgId);
    
    const body = await req.json();
    const { title } = body;

    const supabase = supabaseAdmin();

    // Create new conversation for authenticated user in their current organization
    const { data: conversation, error } = await supabase
      .from('sam_conversations')
      .insert({
        user_id: userId,
        organization_id: orgId || null, // Associate with current organization
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

    console.log('✅ Created conversation:', conversation?.id, 'for org:', orgId);
    return NextResponse.json({ conversation });

  } catch (error) {
    console.error('Error in conversations POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}