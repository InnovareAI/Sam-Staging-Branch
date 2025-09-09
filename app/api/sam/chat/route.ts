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

    // Use the consultant-style onboarding flow for new conversations
    let response = "";
    const isFirstMessage = conversationHistory.length === 0;
    
    if (isFirstMessage) {
      // Step 1: Small Talk (Human Entry)
      response = "Hey there — how's your day going so far? Calm, or one of those fire-drill mornings?";
    } else {
      // Handle responses based on conversation context
      const userInput = message.toLowerCase();
      
      // Step 2 & 3: Acknowledge, empathize, and position as consultant
      if (userInput.includes('calm') || userInput.includes('good') || userInput.includes('quiet')) {
        response = "Nice, those are rare. Always good to start a chat without too many fires burning.\n\nI'm SAM — think of me as your GTM consultant in AI form. I work alongside founders, sales, and marketing leads to take the heavy lifting out of prospecting, outreach, and follow-up.\n\nBefore we dive into your business, would it help if I give you a quick overview of how I work and the features I bring to the table? Or would you prefer we go straight into your current GTM challenges?";
      } else if (userInput.includes('hectic') || userInput.includes('busy') || userInput.includes('crazy') || userInput.includes('fire')) {
        response = "Makes sense — most GTM leaders I talk with are juggling ten things at once. That's exactly why I keep things simple here.\n\nI'm SAM — think of me as your GTM consultant in AI form. I work alongside founders, sales, and marketing leads to take the heavy lifting out of prospecting, outreach, and follow-up.\n\nBefore we dive into your business, would it help if I give you a quick overview of how I work and the features I bring to the table? Or would you prefer we go straight into your current GTM challenges?";
      }
      // Step 5: Branching options
      else if (userInput.includes('explain features') || userInput.includes('overview') || userInput.includes('how you work')) {
        response = "Sure thing. Here's the quick version: I coordinate a team of 14 specialized AI agents. Together, they handle lead discovery, enrichment, personalization, outreach, replies, and analytics. I'll walk you through how each part fits your workflow.\n\nWhich area would you like me to dive deeper into first — lead discovery and enrichment, personalized outreach, or automated follow-ups and analytics?";
      } else if (userInput.includes('challenges') || userInput.includes('talk about my') || userInput.includes('straight into')) {
        response = "Great — let's make this about you. Tell me, where do you feel the most friction in your GTM motion right now — finding leads, personalizing messaging, or staying consistent with follow-ups?";
      }
      // Handle objections if detected
      else if (objectionResponse) {
        response = objectionResponse;
      }
      // Add persona-specific guidance if detected
      else if (personaGuidance) {
        response = personaGuidance + "\n\nWhat's the biggest challenge you're facing in your current sales process?";
      }
      // Default consultant response
      else {
        response = "I'm SAM — your GTM consultant in AI form. I help founders, sales, and marketing teams take the heavy lifting out of prospecting and outreach.\n\nWhat's bringing you here today? Are you looking to scale your lead generation, improve your outreach personalization, or streamline your follow-up process?";
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