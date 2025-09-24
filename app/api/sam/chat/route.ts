import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    console.log('🤖 SAM AI: Processing message:', message);

    // Try to use OpenRouter for AI responses
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com'}/api/sam/openrouter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `You are Sam, a helpful AI sales assistant. The user says: "${message}". Respond as Sam would - professional, knowledgeable about sales, and focused on helping with sales strategy, prospecting, outreach, and pipeline management. Keep your response conversational and helpful.`,
          use_case: 'sam_reasoning',
          max_tokens: 300,
          temperature: 0.7
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.message) {
          console.log('✅ SAM AI: AI-powered response generated');
          return NextResponse.json({
            response: result.message,
            timestamp: new Date().toISOString(),
            aiPowered: true,
            model_used: result.model_used,
            user: { authenticated: false, anonymous: true }
          });
        }
      }
    } catch (openrouterError) {
      console.log('⚠️ OpenRouter unavailable, using smart fallback');
    }

    // Smart fallback responses with improved keyword matching
    const samResponses = {
      'sales strategy': "I'd love to help with your sales strategy! Let's start with your target market - who are your ideal customers and what challenges are they facing?",
      'prospecting': "Great choice! Prospecting is the foundation of sales success. Are you looking to expand into new industries, target specific roles, or improve your current outreach?",
      'outreach': "Outreach is my specialty! Are you focusing on email campaigns, LinkedIn messaging, or a multi-channel approach? I can help optimize your messaging for better response rates.",
      'pipeline': "Pipeline management is crucial for predictable revenue. Are you looking to improve lead qualification, track deal progression, or optimize your sales process?",
      'lead generation': "Lead generation is where it all starts! What's your current approach - are you using content marketing, paid ads, referrals, or direct outreach?",
      'greeting': "Hello! I'm Sam, your AI-powered sales assistant. I help with prospecting, personalized outreach, and managing your sales pipeline. What would you like to work on today?",
      'default': "Hello! I'm Sam, your AI-powered sales assistant. I help with prospecting, personalized outreach, and managing your sales pipeline. What would you like to work on today?"
    };

    // Improved keyword matching
    const lowerMessage = message.toLowerCase();
    let samResponse = samResponses.default;
    
    if (lowerMessage.includes('hi') || lowerMessage.includes('hello') || lowerMessage.includes('hey')) {
      samResponse = samResponses.greeting;
    } else if (lowerMessage.includes('strategy')) {
      samResponse = samResponses['sales strategy'];
    } else if (lowerMessage.includes('prospect')) {
      samResponse = samResponses.prospecting;
    } else if (lowerMessage.includes('outreach') || lowerMessage.includes('email') || lowerMessage.includes('linkedin')) {
      samResponse = samResponses.outreach;
    } else if (lowerMessage.includes('pipeline') || lowerMessage.includes('deal')) {
      samResponse = samResponses.pipeline;
    } else if (lowerMessage.includes('lead') || lowerMessage.includes('generation')) {
      samResponse = samResponses['lead generation'];
    }

    console.log('✅ SAM AI: Smart fallback response generated');

    return NextResponse.json({
      response: samResponse,
      timestamp: new Date().toISOString(),
      aiPowered: false,
      fallback_mode: true,
      user: { authenticated: false, anonymous: true }
    });

  } catch (error) {
    console.error('❌ SAM AI Error:', error);
    return NextResponse.json({
      response: "Hello! I'm Sam, your AI-powered sales assistant. I help with prospecting, personalized outreach, and managing your sales pipeline. What would you like to work on today?",
      timestamp: new Date().toISOString(),
      aiPowered: false,
      user: { authenticated: false, anonymous: true }
    });
  }
}