/**
 * SAM AI Thread Messages API
 * 
 * Handles messages within conversation threads with enhanced prospect intelligence
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Helper function to call OpenRouter API
async function callOpenRouter(messages: any[], systemPrompt: string) {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  
  if (!openRouterKey) {
    throw new Error('OpenRouter API key not configured');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://app.meet-sam.com',
      'X-Title': 'SAM AI Platform'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'I apologize, but I had trouble processing that request.';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const resolvedParams = await params
    const supabase = createRouteHandlerClient({ cookies: cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Verify thread ownership
    const { data: thread } = await supabase
      .from('sam_conversation_threads')
      .select('id, user_id')
      .eq('id', resolvedParams.threadId)
      .eq('user_id', user.id)
      .single()

    if (!thread) {
      return NextResponse.json({
        success: false,
        error: 'Thread not found'
      }, { status: 404 })
    }

    // Load messages
    const { data: messages, error } = await supabase
      .from('sam_thread_messages')
      .select('*')
      .eq('thread_id', resolvedParams.threadId)
      .order('message_order', { ascending: true })

    if (error) {
      console.error('Failed to load messages:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to load messages'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      messages: messages || [],
      count: messages?.length || 0
    })

  } catch (error) {
    console.error('Get messages API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const resolvedParams = await params
    const supabase = createRouteHandlerClient({ cookies: cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const body = await request.json()
    const { content } = body

    if (!content?.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Message content is required'
      }, { status: 400 })
    }

    // Get thread details
    const { data: thread, error: threadError } = await supabase
      .from('sam_conversation_threads')
      .select('*')
      .eq('id', resolvedParams.threadId)
      .eq('user_id', user.id)
      .single()

    if (threadError || !thread) {
      return NextResponse.json({
        success: false,
        error: 'Thread not found'
      }, { status: 404 })
    }

    // Get message count for ordering
    const { count: messageCount } = await supabase
      .from('sam_thread_messages')
      .select('*', { count: 'exact', head: true })
      .eq('thread_id', resolvedParams.threadId)

    const nextOrder = (messageCount || 0) + 1

    // Check for LinkedIn URLs and trigger prospect intelligence
    let prospectIntelligence = null
    let hasProspectIntelligence = false
    const linkedInUrlPattern = /https?:\/\/(www\.)?linkedin\.com\/in\/[^\s]+/gi
    const linkedInUrls = content.match(linkedInUrlPattern)
    
    if (linkedInUrls && linkedInUrls.length > 0) {
      try {
        const intelligenceResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/api/sam/prospect-intelligence`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': request.headers.get('Authorization') || ''
          },
          body: JSON.stringify({
            type: 'linkedin_url_research',
            data: { url: linkedInUrls[0] },
            methodology: thread.sales_methodology,
            conversationId: resolvedParams.threadId
          })
        })

        if (intelligenceResponse.ok) {
          prospectIntelligence = await intelligenceResponse.json()
          hasProspectIntelligence = true

          // Update thread with prospect info if available
          if (prospectIntelligence?.success && prospectIntelligence.data.prospect) {
            const prospect = prospectIntelligence.data.prospect
            await supabase
              .from('sam_conversation_threads')
              .update({
                prospect_name: prospect.fullName || thread.prospect_name,
                prospect_company: prospect.company || thread.prospect_company,
                prospect_linkedin_url: linkedInUrls[0],
                thread_type: 'linkedin_research',
                title: prospect.fullName && prospect.company 
                  ? `${prospect.fullName} - ${prospect.company}`
                  : thread.title
              })
              .eq('id', resolvedParams.threadId)
          }
        }
      } catch (error) {
        console.error('Prospect intelligence error:', error)
      }
    }

    // Create user message
    const { data: userMessage, error: userError } = await supabase
      .from('sam_thread_messages')
      .insert({
        thread_id: resolvedParams.threadId,
        user_id: user.id,
        role: 'user',
        content: content.trim(),
        message_order: nextOrder,
        has_prospect_intelligence: hasProspectIntelligence,
        prospect_intelligence_data: prospectIntelligence
      })
      .select()
      .single()

    if (userError) {
      console.error('Failed to save user message:', userError)
      return NextResponse.json({
        success: false,
        error: 'Failed to save message'
      }, { status: 500 })
    }

    // Get conversation history for AI context
    const { data: previousMessages } = await supabase
      .from('sam_thread_messages')
      .select('role, content')
      .eq('thread_id', resolvedParams.threadId)
      .order('message_order', { ascending: true })

    const conversationHistory = previousMessages?.slice(-10) || [] // Last 10 messages for context

    // Build enhanced system prompt with thread context
    let systemPrompt = `You are Sam, an AI-powered Sales Assistant. You're helpful, conversational, and focused on sales challenges.

THREAD CONTEXT:
- Thread Type: ${thread.thread_type}
- Sales Methodology: ${thread.sales_methodology.toUpperCase()}
- Priority: ${thread.priority}
${thread.prospect_name ? `- Prospect: ${thread.prospect_name}` : ''}
${thread.prospect_company ? `- Company: ${thread.prospect_company}` : ''}
${thread.campaign_name ? `- Campaign: ${thread.campaign_name}` : ''}
${thread.deal_stage ? `- Deal Stage: ${thread.deal_stage}` : ''}

CORE APPROACH: Be natural and responsive to user needs. Provide expert sales advice and insights.`

    // Add prospect intelligence if available
    if (prospectIntelligence?.success) {
      const prospectData = prospectIntelligence.data.prospect
      const insights = prospectIntelligence.data.insights
      
      systemPrompt += `\n\nPROSPECT INTELLIGENCE:
- Name: ${prospectData?.fullName || 'Not available'}
- Title: ${prospectData?.jobTitle || 'Not available'}
- Company: ${prospectData?.company || 'Not available'}
- Location: ${prospectData?.location || 'Not available'}

Strategic Insights: ${insights?.strategicInsights?.map((insight: any) => insight.insight).join(', ') || 'Standard discovery approach'}

Use this intelligence naturally to provide valuable sales insights and suggestions.`
    }

    // Generate AI response
    let aiResponse: string
    try {
      const messages = conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      }))

      aiResponse = await callOpenRouter(messages, systemPrompt)
      
      // Clean up prompt leakage
      aiResponse = aiResponse.replace(/\([^)]*script[^)]*\)/gi, '')
      aiResponse = aiResponse.replace(/\[[^\]]*script[^\]]*\]/gi, '')
      aiResponse = aiResponse.trim()
      
    } catch (error) {
      console.error('OpenRouter API error:', error)
      aiResponse = "I'm experiencing some technical difficulties right now, but I'm here to help with your sales challenges. What specific area would you like to discuss?"
    }

    // Create Sam's response message
    const { data: samMessage, error: samError } = await supabase
      .from('sam_thread_messages')
      .insert({
        thread_id: resolvedParams.threadId,
        user_id: user.id,
        role: 'assistant',
        content: aiResponse,
        message_order: nextOrder + 1,
        model_used: 'anthropic/claude-3.5-sonnet'
      })
      .select()
      .single()

    if (samError) {
      console.error('Failed to save Sam message:', samError)
      return NextResponse.json({
        success: false,
        error: 'Failed to save AI response'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      userMessage,
      samMessage,
      prospectIntelligence: prospectIntelligence?.success ? {
        hasData: true,
        prospectName: prospectIntelligence.data.prospect?.fullName,
        prospectTitle: prospectIntelligence.data.prospect?.jobTitle,
        prospectCompany: prospectIntelligence.data.prospect?.company,
        confidence: prospectIntelligence.metadata?.confidence,
        methodology: prospectIntelligence.metadata?.methodology
      } : null,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Send message API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}