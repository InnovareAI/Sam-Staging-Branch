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

    // Use the room tour onboarding flow from conversation scripts
    let response = "";
    const isFirstMessage = conversationHistory.length === 0;
    
    if (isFirstMessage) {
      // Step 1: Small Talk (Human Entry)
      response = "Hi there! How's your day going? Busy morning or a bit calmer?";
    } else {
      // Handle responses based on conversation context
      const userInput = message.toLowerCase();
      
      // Step 2: Acknowledge and introduce with room tour
      if (userInput.includes('busy') || userInput.includes('hectic') || userInput.includes('crazy') || userInput.includes('fire')) {
        response = "I get that. I'm Sam. My role is to take the heavy lifting out of prospecting and follow-up. Before we dive in, let me show you around the workspace.\n\nOn the left, you'll see tabs. The first is *Chat with Sam* — that's right here. This is where you and I talk. Does that make sense?";
      } else if (userInput.includes('calm') || userInput.includes('good') || userInput.includes('quiet') || userInput.includes('calmer')) {
        response = "Nice, those are rare. I'm Sam. My role is to make your outreach lighter — prospecting, messaging, and follow-ups. Before we dive in, let me give you a quick tour so you know where everything is.\n\nThis is where we'll talk. You can ask me questions here anytime. If you need to stop or take a break, I'll remember and we'll resume later. Does that sound good?";
      }
      // Room Tour Steps - Knowledge Base
      else if (userInput.includes('make sense') || userInput.includes('sounds good') || userInput.includes('yes') || userInput.includes('ok') || userInput.includes('okay')) {
        response = "Great! Next up is the Knowledge Base tab. Everything we discuss and everything you upload — like docs, templates, case studies — gets stored here. I'll use this to tailor my answers and campaigns.\n\nClear so far?";
      }
      // Room Tour Steps - Training Room
      else if (userInput.includes('clear') || userInput.includes('understand')) {
        response = "Perfect. The Sam Training Room is where I'll guide you through a 7-stage onboarding journey: Business context, ICP, Competition, Sales process, Metrics, Tech/Compliance, and Content. We'll go step by step, one question at a time.\n\nMaking sense?";
      }
      // Room Tour Steps - Contact Center
      else if (userInput.includes('making sense')) {
        response = "Excellent. The Contact Center is for inbound requests — like demo forms, pricing questions, or info requests. My inbound agent handles those automatically.\n\nFollowing along?";
      }
      // Room Tour Steps - Campaign Hub
      else if (userInput.includes('following')) {
        response = "Great! Campaign Hub is where we'll build campaigns. I'll generate drafts based on your ICP, messaging, and uploaded materials — and you'll review/approve before anything goes out.\n\nStill with me?";
      }
      // Room Tour Steps - Lead Pipeline
      else if (userInput.includes('still with') || userInput.includes('with me')) {
        response = "Perfect. Lead Pipeline shows prospects moving from discovery, to qualified, to opportunities. You'll see enrichment status, scores, and next actions.\n\nAll good?";
      }
      // Room Tour Steps - Analytics & Closing
      else if (userInput.includes('all good')) {
        response = "Finally, Analytics is where we track results: readiness scores, campaign metrics, reply/meeting rates, and agent performance.\n\nAt any time, you can invite teammates, check settings, or update your profile. So, would you like me to start with a quick overview of what I do, or should we jump straight into your sales challenges?";
      }
      // Branching after tour
      else if (userInput.includes('overview') || userInput.includes('what you do')) {
        response = "Sure thing. I coordinate a team of 14 specialized AI agents that handle lead discovery, enrichment, personalization, outreach, replies, and analytics. Which area interests you most — finding leads, personalizing messages, or tracking results?";
      } else if (userInput.includes('challenges') || userInput.includes('jump straight')) {
        response = "Great — let's make this about you. Tell me, where do you feel the most friction in your sales process right now — finding leads, personalizing messaging, or staying consistent with follow-ups?";
      }
      // Handle objections if detected
      else if (objectionResponse) {
        response = objectionResponse;
      }
      // Add persona-specific guidance if detected
      else if (personaGuidance) {
        response = personaGuidance + "\n\nWhat's the biggest challenge you're facing in your current sales process?";
      }
      // Handle generic responses to avoid falling through
      else if (userInput.length < 10 && (userInput.includes('sure') || userInput.includes('right') || userInput.includes('got it') || userInput.includes('yep') || userInput.includes('yeah'))) {
        response = "Perfect! I'm here to help streamline your sales process. What's the biggest challenge you're facing right now — finding qualified leads, crafting personalized messages, or staying consistent with follow-ups?";
      }
      // Default response - restart room tour
      else {
        response = "I want to make sure I understand what you need. Are you looking for help with lead generation, sales automation, or something else? Let me know what's on your mind.";
      }
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