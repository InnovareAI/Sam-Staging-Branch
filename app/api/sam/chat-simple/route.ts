import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    
    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    console.log('🤖 SAM Simple: Processing message:', message);

    // Direct OpenRouter call
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com'}/api/sam/openrouter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `You are Sam, a friendly sales assistant AI. User message: "${message}". Respond as Sam would - helpful, conversational, focused on sales. Keep it brief and friendly.`,
        use_case: 'message_personalization',
        max_tokens: 300,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter failed: ${response.status}`);
    }

    const result = await response.json();
    const samResponse = result.message || "Hi! I'm Sam, your AI sales assistant. How can I help you with sales prospecting, outreach, or pipeline management today?";

    console.log('✅ SAM Simple: Response generated successfully');

    return NextResponse.json({
      response: samResponse,
      timestamp: new Date().toISOString(),
      aiPowered: true,
      simplified: true,
      user: { authenticated: false, anonymous: true }
    });

  } catch (error) {
    console.error('❌ SAM Simple error:', error);
    return NextResponse.json({
      response: "Hi! I'm Sam, your sales assistant. I can help you with prospecting, outreach strategies, and sales pipeline management. What would you like to work on?",
      timestamp: new Date().toISOString(),
      aiPowered: false,
      fallback: true,
      user: { authenticated: false, anonymous: true }
    });
  }
}