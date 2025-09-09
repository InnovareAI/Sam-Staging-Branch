import { NextRequest, NextResponse } from 'next/server';
import { supabaseKnowledge } from '@/lib/supabase-knowledge';

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

    // Get the system prompt with integrated knowledge base
    const systemPrompt = await supabaseKnowledge.getSystemPrompt();
    
    // Get persona-specific guidance
    const personaGuidance = await supabaseKnowledge.getPersonaGuidance(message);
    
    // Get objection response if applicable
    const objectionResponse = await supabaseKnowledge.getObjectionResponse(message);

    // For now, return a knowledge-enhanced response
    let response = "I'm SAM AI! I'm here to help optimize your B2B sales process. ";
    
    // Add persona-specific guidance if detected
    if (personaGuidance) {
      response += personaGuidance + " ";
    }

    // Add objection handling if detected
    if (objectionResponse) {
      response += objectionResponse + " ";
    }

    // Add contextual help based on message content
    if (message.toLowerCase().includes('onboard') || message.toLowerCase().includes('getting started')) {
      response += "Let me walk you through our proven 5-step onboarding process that gets you seeing results in weeks, not months. First, I'd love to understand your current sales challenges. What's your biggest bottleneck right now - lead generation, personalization, or follow-up consistency?";
    } else if (message.toLowerCase().includes('industry') || message.toLowerCase().includes('vertical')) {
      response += "I can provide industry-specific insights for healthcare, finance, manufacturing, and more. What industry are you targeting?";
    } else {
      response += "How can I help you accelerate your B2B sales today? I can assist with lead generation strategies, personalized outreach, objection handling, or setting up automated campaigns.";
    }

    return NextResponse.json({
      response,
      timestamp: new Date().toISOString(),
      knowledgeUsed: {
        personaDetected: !!personaGuidance,
        objectionHandled: !!objectionResponse,
        systemPromptLength: systemPrompt.length
      }
    });

  } catch (error) {
    console.error('SAM Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}