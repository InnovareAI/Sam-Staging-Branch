import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    console.log('🤖 SAM ULTRAHARD: Processing:', message);

    // ULTRAHARD FIX: Direct OpenRouter call
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com'}/api/sam/openrouter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `You are Sam, a helpful sales AI assistant. User says: "${message}". Reply as Sam - friendly, helpful, focused on sales. Be brief.`,
        use_case: 'message_personalization'
      })
    });

    const result = await response.json();
    const samResponse = result.success ? result.message : "Hi! I'm Sam, your AI sales assistant. I can help with prospecting, outreach, and pipeline management. What would you like to work on?";

    console.log('✅ SAM ULTRAHARD: Response generated');

    return NextResponse.json({
      response: samResponse,
      timestamp: new Date().toISOString(),
      aiPowered: result.success,
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