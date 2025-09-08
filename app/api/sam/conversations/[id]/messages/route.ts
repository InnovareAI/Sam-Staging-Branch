import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import OpenAI from 'openai';

// GET /api/sam/conversations/[id]/messages - Get conversation messages
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: conversationId } = await params;
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

    // Verify conversation belongs to user
    const { data: conversation } = await supabase
      .from('sam_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('workspace_id', userData.current_workspace_id)
      .eq('user_id', userData.id)
      .single();

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Get messages
    const { data: messages, error } = await supabase
      .from('sam_conversation_messages')
      .select(`
        id,
        role,
        content,
        model_used,
        token_count,
        processing_time_ms,
        confidence_score,
        relevance_score,
        message_order,
        metadata,
        created_at
      `)
      .eq('conversation_id', conversationId)
      .eq('tenant_id', userData.current_workspace_id)
      .order('message_order', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ messages });

  } catch (error) {
    console.error('Error in messages GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/sam/conversations/[id]/messages - Send message to Sam
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: conversationId } = await params;
    const body = await req.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Message content required' }, { status: 400 });
    }

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

    // Verify conversation belongs to user
    const { data: conversation } = await supabase
      .from('sam_conversations')
      .select('id, current_discovery_stage, conversation_context, business_profile')
      .eq('id', conversationId)
      .eq('workspace_id', userData.current_workspace_id)
      .eq('user_id', userData.id)
      .single();

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Get next message order
    const { data: lastMessage } = await supabase
      .from('sam_conversation_messages')
      .select('message_order')
      .eq('conversation_id', conversationId)
      .order('message_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (lastMessage?.message_order || 0) + 1;

    // Store user message
    const { data: userMessage, error: userError } = await supabase
      .from('sam_conversation_messages')
      .insert({
        conversation_id: conversationId,
        tenant_id: userData.current_workspace_id,
        role: 'user',
        content: content.trim(),
        message_order: nextOrder,
        metadata: {}
      })
      .select()
      .single();

    if (userError) {
      console.error('Error storing user message:', userError);
      return NextResponse.json({ error: userError.message }, { status: 400 });
    }

    // Generate Sam's response using OpenRouter
    let samResponse = '';
    let modelUsed = 'fallback';
    let processingStartTime = Date.now();
    
    try {
      const openaiApiKey = process.env.OPENROUTER_API_KEY;
      
      if (!openaiApiKey || openaiApiKey === 'your_openrouter_api_key_here') {
        // Fallback to intelligent placeholder if no API key
        samResponse = `Hi! I'm Sam, your AI sales assistant. I understand you said: "${content.trim()}"

I'm here to help you with:
• Sales process optimization
• Lead qualification and management  
• Customer relationship insights
• Pipeline analysis and forecasting
• Sales strategy development

To enable my full AI capabilities, please add your OpenRouter API key to the environment. For now, I can still help with general sales guidance - what specific sales challenge can I assist you with today?`;
        modelUsed = 'fallback';
      } else {
        // Configure OpenAI client for OpenRouter
        const openai = new OpenAI({
          apiKey: openaiApiKey,
          baseURL: 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': 'https://app.meet-sam.com',
            'X-Title': 'SAM AI Sales Assistant',
          }
        });

        // Get conversation context for better responses
        const { data: recentMessages } = await supabase
          .from('sam_conversation_messages')
          .select('role, content')
          .eq('conversation_id', conversationId)
          .order('message_order', { ascending: false })
          .limit(10);

        // Build context from recent messages
        const conversationHistory = recentMessages?.reverse().map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })) || [];

        // Sam's personality and context
        const systemPrompt = `You are Sam, an expert AI sales assistant. Your role is to help users with all aspects of sales, lead management, customer relationships, and business growth.

Key traits:
- Professional yet friendly and approachable
- Expert in sales methodology, CRM, lead qualification
- Provide actionable, specific advice
- Ask clarifying questions to better understand needs
- Reference best practices from sales industry

Context: This is a multi-tenant sales platform. The user is working in their own workspace with their own data and leads.

Keep responses focused, helpful, and sales-oriented. If the user asks about non-sales topics, gently redirect to how you can help with their sales objectives.`;

        const response = await openai.chat.completions.create({
          model: 'anthropic/claude-3.5-sonnet', // Using Claude via OpenRouter
          messages: [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: content.trim() }
          ],
          max_tokens: 800,
          temperature: 0.7,
        });

        samResponse = response.choices[0]?.message?.content || 'I apologize, but I encountered an issue generating a response. Please try again.';
        modelUsed = 'anthropic/claude-3.5-sonnet';
      }
    } catch (error) {
      console.error('OpenRouter API Error:', error);
      samResponse = `I'm experiencing some technical difficulties right now. As your AI sales assistant, I'm still here to help! 

You mentioned: "${content.trim()}"

While I resolve this issue, I can still provide general sales guidance. What specific sales challenge are you working on? I can help with lead qualification, pipeline management, customer relationship strategies, or sales process optimization.`;
      modelUsed = 'error-fallback';
    }
    
    const processingTime = Date.now() - processingStartTime;

    // Store Sam's response
    const { data: samMessage, error: samError } = await supabase
      .from('sam_conversation_messages')
      .insert({
        conversation_id: conversationId,
        tenant_id: userData.current_workspace_id,
        role: 'assistant',
        content: samResponse,
        model_used: modelUsed,
        processing_time_ms: processingTime,
        message_order: nextOrder + 1,
        confidence_score: modelUsed === 'fallback' ? 0.6 : 0.9,
        relevance_score: modelUsed === 'fallback' ? 0.7 : 0.85,
        metadata: { 
          using_openrouter: modelUsed !== 'fallback',
          api_configured: process.env.OPENROUTER_API_KEY !== 'your_openrouter_api_key_here'
        }
      })
      .select()
      .single();

    if (samError) {
      console.error('Error storing Sam message:', samError);
      return NextResponse.json({ error: samError.message }, { status: 400 });
    }

    // Update conversation last messages and activity
    await supabase
      .from('sam_conversations')
      .update({
        last_user_message: content.trim(),
        last_sam_message: samResponse,
        last_active_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    return NextResponse.json({ 
      userMessage,
      samMessage,
      success: true 
    });

  } catch (error) {
    console.error('Error in messages POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}