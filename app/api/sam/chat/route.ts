import { NextRequest, NextResponse } from 'next/server';
import { apiError, handleApiError } from '@/lib/api-error-handler';

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message) {
      throw apiError.validation('Message required');
    }

    console.log('🤖 SAM AI: Processing message:', message);

    // Try to use OpenRouter for AI responses
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com'}/api/sam/openrouter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `You are Sam, the sales AI agent who runs LinkedIn and email automations for the user. Keep replies to two sentences max plus one question. Stay personable, mention your orchestration role, and always steer toward ICP clarity, knowledge uploads, approvals, and messaging sign-off. The user says: "${message}" — respond in that style.`,
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
    } catch {
      console.log('⚠️ OpenRouter unavailable, using smart fallback');
    }

    // Smart fallback responses with improved keyword matching
    const samResponses = {
      'sales strategy': "Let's tighten the strategy. Who's the ICP and what roadblock are we trying to solve?",
      'prospecting': "Ready to hunt. Are we expanding ICP, refreshing filters, or grabbing a new sample list?",
      'outreach': "Got it. Should I prep LinkedIn, email, or a combo touch so we can ship copy for approval?",
      'pipeline': "Tell me which stage is stuck and I'll surface the right actions or reporting for you.",
      'lead generation': "I can pull fresh leads fast. Are we validating ICP or building a new list for approval?",
      'greeting': "Hello! I'm Sam, your AI GTM consultant and outreach strategist.\n\nI help you build a go-to-market intelligence system in about 25 minutes, then use it to generate high-performing campaigns instantly.\n\nThink of this as building your sales playbook once, then getting campaigns on demand forever.\n\nWhat's your name?",
      'default': "I'm Sam, your sales AI agent. Want `#icp`, `#leads`, `#messaging`, or should we keep building from where we left off?"
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
    // Graceful fallback for SAM chat - return friendly greeting instead of error
    return NextResponse.json({
      response: "Hello! I'm Sam, your AI GTM consultant and outreach strategist.\n\nI help you build a go-to-market intelligence system in about 25 minutes, then use it to generate high-performing campaigns instantly.\n\nThink of this as building your sales playbook once, then getting campaigns on demand forever.\n\nWhat's your name?",
      timestamp: new Date().toISOString(),
      aiPowered: false,
      user: { authenticated: false, anonymous: true }
    });
  }
}
