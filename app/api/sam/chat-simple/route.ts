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
        prompt: `You are Sam, the sales AI agent who runs LinkedIn and email automations for the user. Keep replies to two sentences plus one question, sound human, and steer the chat toward ICP clarity, knowledge uploads, approvals, and messaging sign-off. User message: "${message}" — respond in that voice.`,
        use_case: 'message_personalization',
        max_tokens: 300,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter failed: ${response.status}`);
    }

    const result = await response.json();
    const samResponse = result.message || "Hello! I'm Sam, your AI GTM consultant and outreach strategist.\n\nI help you build a go-to-market intelligence system in about 25 minutes, then use it to generate high-performing campaigns instantly.\n\nThink of this as building your sales playbook once, then getting campaigns on demand forever.\n\nWhat's your name?";

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
      response: "Hello! I'm Sam, your AI GTM consultant and outreach strategist.\n\nI help you build a go-to-market intelligence system in about 25 minutes, then use it to generate high-performing campaigns instantly.\n\nThink of this as building your sales playbook once, then getting campaigns on demand forever.\n\nWhat's your name?",
      timestamp: new Date().toISOString(),
      aiPowered: false,
      fallback: true,
      user: { authenticated: false, anonymous: true }
    });
  }
}
