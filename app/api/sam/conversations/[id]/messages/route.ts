import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { samKnowledge } from '../../../../../../lib/sam-knowledge';
import OpenAI from 'openai';

// Demo user configuration for non-authenticated access
const DEMO_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  workspace_id: '00000000-0000-4000-8000-000000000001',
  name: 'Demo User'
};

// GET /api/sam/conversations/[id]/messages - Get conversation messages
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    console.log('📬 Messages API called (demo mode)');
    
    const { id: conversationId } = await params;
    const supabase = supabaseAdmin();
    
    // Use demo user for non-authenticated access
    const userId = DEMO_USER.id;
    const workspaceId = DEMO_USER.workspace_id;

    // Get messages for demo user
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
      .eq('tenant_id', workspaceId)
      .order('message_order', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log('📨 Found messages:', messages?.length || 0);
    return NextResponse.json({ messages: messages || [] });

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
    console.log('💬 Sending message to Sam (demo mode)');
    
    const { id: conversationId } = await params;
    const body = await req.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Message content required' }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    
    // Use demo user for non-authenticated access
    const userId = DEMO_USER.id;
    const workspaceId = DEMO_USER.workspace_id;
    
    console.log('🔍 Demo user sending message:', content.trim());

    // Get conversation (verify it exists)
    const { data: conversation } = await supabase
      .from('sam_conversations')
      .select('id, current_discovery_stage, conversation_context, business_profile')
      .eq('id', conversationId)
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    if (!conversation) {
      console.error('❌ Conversation not found for demo user');
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
        tenant_id: workspaceId,
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
        // Generate intelligent fallback response using knowledge base
        const personaGuidance = samKnowledge.getPersonaGuidance(content.trim());
        const objectionResponse = samKnowledge.getObjectionResponse(content.trim());
        
        samResponse = `Hi! I'm Sam, your AI sales assistant with 14 specialized agents covering your entire sales process. I understand you said: "${content.trim()}"

${personaGuidance ? `${personaGuidance}\n\n` : ''}${objectionResponse ? `${objectionResponse}\n\n` : ''}I'm here to help you with:
• **Intelligent Prospecting**: Data enrichment and lead qualification
• **Personalized Outreach**: Context-aware messaging across channels  
• **Campaign Management**: Multi-channel campaign orchestration
• **Follow-up Automation**: Smart reply handling and nurturing
• **Analytics & Optimization**: Performance tracking and improvement suggestions

Key differentiators: Agent orchestration, context awareness, compliance-first approach, multi-tenant architecture, and ROI delivery in weeks not months.

To enable my full AI capabilities, please add your OpenRouter API key to the environment. What specific sales challenge can I help optimize today?`;
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

        // Load Sam's comprehensive knowledge base and generate dynamic system prompt
        const systemPrompt = samKnowledge.getSystemPrompt();

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
        tenant_id: workspaceId,
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