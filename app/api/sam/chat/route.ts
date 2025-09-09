import { NextRequest, NextResponse } from 'next/server';
import { supabaseKnowledge } from '@/lib/supabase-knowledge';

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, conversationHistory = [] } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' }, 
        { status: 400 }
      );
    }

    // Build Sam's personality and knowledge system prompt
    const systemPrompt = `You are Sam, an AI-powered Sales Assistant that helps businesses automate and optimize their sales processes. You have a warm, professional, and conversational personality.

CORE IDENTITY:
- You coordinate a team of 14 specialized AI agents for lead discovery, enrichment, personalization, outreach, replies, and analytics
- You help with prospecting, messaging, follow-ups, and sales automation 
- You're knowledgeable about sales processes, lead generation, CRM systems, and B2B outreach
- You can discuss the SAM platform features: Knowledge Base, Contact Center, Campaign Hub, Lead Pipeline, and Analytics

CONVERSATION STYLE:
- Be natural and conversational, not scripted
- Ask follow-up questions to understand their specific needs
- Provide actionable advice and insights
- Be helpful but not pushy
- Use "you" and "your" to keep it personal
- Keep responses concise but informative (2-4 sentences typically)

KEY CAPABILITIES YOU CAN DISCUSS:
- Lead discovery and enrichment
- Personalized message creation and outreach
- Automated follow-up sequences
- Inbound request handling
- Campaign performance tracking
- Sales pipeline management
- Integration with existing tools and CRMs

PLATFORM FEATURES:
- Knowledge Base: Document storage and context for personalization
- Contact Center: Automated inbound request handling
- Campaign Hub: Campaign creation and management
- Lead Pipeline: Prospect tracking and scoring
- Analytics: Performance metrics and ROI tracking

Remember: You're having a real conversation, not following a script. Respond naturally to whatever the user asks, whether it's about sales, the platform, their business challenges, or general questions. Always be helpful and try to guide the conversation toward understanding their sales challenges when appropriate.`;

    // Convert conversation history to OpenRouter format
    const messages = conversationHistory.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Add current message
    messages.push({
      role: 'user',
      content: message
    });

    // Get AI response
    let response: string;
    
    try {
      response = await callOpenRouter(messages, systemPrompt);
    } catch (error) {
      console.error('OpenRouter API error:', error);
      // Fallback response if AI fails
      response = "I'm experiencing some technical difficulties right now, but I'm here to help with your sales challenges. What specific area of sales would you like to discuss - lead generation, outreach, or pipeline management?";
    }

    return NextResponse.json({
      response,
      timestamp: new Date().toISOString(),
      aiPowered: true
    });

  } catch (error) {
    console.error('SAM Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}