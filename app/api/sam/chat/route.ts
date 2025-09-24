import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    console.log('🤖 SAM ULTRAHARD: Processing:', message);

    // ULTRAHARD: Direct fallback response (bypass broken OpenRouter for now)
    const samResponses = {
      'sales strategy': "I'd love to help with your sales strategy! Let's start with your target market - who are your ideal customers and what challenges are they facing?",
      'prospecting': "Great choice! Prospecting is the foundation of sales success. Are you looking to expand into new industries, target specific roles, or improve your current outreach?",
      'outreach': "Outreach is my specialty! Are you focusing on email campaigns, LinkedIn messaging, or a multi-channel approach? I can help optimize your messaging for better response rates.",
      'pipeline': "Pipeline management is crucial for predictable revenue. Are you looking to improve lead qualification, track deal progression, or optimize your sales process?",
      'lead generation': "Lead generation is where it all starts! What's your current approach - are you using content marketing, paid ads, referrals, or direct outreach?",
      'default': "Hi! I'm Sam, your AI sales assistant. I specialize in helping with sales strategy, prospecting, outreach, and pipeline management. What specific challenge can I help you tackle today?"
    };

    // Simple keyword matching for immediate responses
    const lowerMessage = message.toLowerCase();
    let samResponse = samResponses.default;
    
    if (lowerMessage.includes('strategy')) samResponse = samResponses['sales strategy'];
    else if (lowerMessage.includes('prospect')) samResponse = samResponses.prospecting;
    else if (lowerMessage.includes('outreach') || lowerMessage.includes('email') || lowerMessage.includes('linkedin')) samResponse = samResponses.outreach;
    else if (lowerMessage.includes('pipeline') || lowerMessage.includes('deal')) samResponse = samResponses.pipeline;
    else if (lowerMessage.includes('lead') || lowerMessage.includes('generation')) samResponse = samResponses['lead generation'];

    console.log('✅ SAM ULTRAHARD: Response generated (fallback mode)');

    return NextResponse.json({
      response: samResponse,
      timestamp: new Date().toISOString(),
      aiPowered: false, // Using smart fallback for now
      fallback_mode: true,
      user: { authenticated: false, anonymous: true }
    });

  } catch (error) {
    console.error('❌ SAM ULTRAHARD Error:', error);
    return NextResponse.json({
      response: "Hi! I'm Sam, your sales assistant. I can help you with prospecting, outreach strategies, and sales pipeline management. What would you like to work on?",
      timestamp: new Date().toISOString(),
      aiPowered: false,
      user: { authenticated: false, anonymous: true }
    });
  }
}