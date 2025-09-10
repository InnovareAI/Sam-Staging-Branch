import { NextRequest, NextResponse } from 'next/server';
import { supabaseKnowledge } from '@/lib/supabase-knowledge';
import { createClient } from '@supabase/supabase-js';

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

// Use shared supabase admin client

export async function POST(req: NextRequest) {
  try {
    // Create Supabase client from request headers
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get Authorization header
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      await supabase.auth.setSession({ access_token: token, refresh_token: '' });
    }

    // Get current user - allow both authenticated and anonymous users
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    // Anonymous users are allowed - don't require authentication
    let currentUser = null;
    if (user && !authError) {
      currentUser = {
        id: user.id,
        email: user.email,
        supabaseId: user.id
      };
    }

    const body = await req.json();
    const { message, conversationHistory = [] } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' }, 
        { status: 400 }
      );
    }

    // Determine exact script position based on conversation length and content
    const isFirstMessage = conversationHistory.length === 0;
    
    // Analyze conversation to determine script position
    let scriptPosition = 'greeting';
    const lastAssistantMessage = conversationHistory.filter(msg => msg.role === 'assistant').pop()?.content?.toLowerCase() || '';
    const lastUserMessage = conversationHistory.filter(msg => msg.role === 'user').pop()?.content?.toLowerCase() || '';
    
    if (conversationHistory.length === 0) {
      scriptPosition = 'greeting';
    } else if (lastAssistantMessage.includes("how's your day going")) {
      scriptPosition = 'dayResponse';
    } else if (lastAssistantMessage.includes("chat with sam") && lastAssistantMessage.includes("does that make sense")) {
      scriptPosition = 'knowledgeBase';
    } else if (lastAssistantMessage.includes("knowledge base") && lastAssistantMessage.includes("clear so far")) {
      scriptPosition = 'contactCenter';
    } else if (lastAssistantMessage.includes("contact center") && lastAssistantMessage.includes("following along")) {
      scriptPosition = 'campaignHub';
    } else if (lastAssistantMessage.includes("campaign hub") && lastAssistantMessage.includes("still with me")) {
      scriptPosition = 'leadPipeline';
    } else if (lastAssistantMessage.includes("lead pipeline") && lastAssistantMessage.includes("all good")) {
      scriptPosition = 'analytics';
    } else if (lastAssistantMessage.includes("analytics") || lastAssistantMessage.includes("overview") || lastAssistantMessage.includes("jump straight")) {
      scriptPosition = 'discovery';
    } else {
      scriptPosition = 'discovery';
    }

    // Build Sam's system prompt with the EXACT conversation scripts from training data
    let systemPrompt = `You are Sam, an AI-powered Sales Assistant. You MUST follow the exact conversation scripts from the SAM training data methodically.

CRITICAL RULE: Use the EXACT wording from the scripts below. Do not paraphrase or improvise.

SCRIPT POSITION: ${scriptPosition}

=== EXACT CONVERSATION SCRIPTS FROM TRAINING DATA ===

## FULL ONBOARDING FLOW (Room Tour Intro)

### Opening Script (10 VARIATIONS - Use one randomly)
1. "Hi there! How's your day going? Busy morning or a bit calmer?"
2. "Hey! How are things treating you today? Hectic or pretty manageable so far?"
3. "Good morning! What's the pace like for you today? Running around or taking it steady?"
4. "Hello! How's your day shaping up? Jam-packed schedule or breathing room?"
5. "Hi! What's the energy like on your end today? Full throttle or cruising along?"
6. "Hey there! How's the day treating you? Non-stop action or finding some rhythm?"
7. "Good day! How are you holding up today? Back-to-back meetings or space to think?"
8. "Hi! What's your day looking like? Total chaos or surprisingly smooth?"
9. "Hello there! How's the workload today? Swamped or actually manageable?"
10. "Hey! How's your Tuesday/Wednesday/etc. going? Crazy busy or decent flow?"

IMPORTANT: Pick ONE variation randomly for each new conversation. Don't repeat the same greeting for different users.
(wait for response)

### Response Based on Their Answer (VARIATIONS):

**If BUSY/HECTIC/CRAZY/SWAMPED (5 variations - pick one):**
1. "I get that. I'm Sam. My role is to take the heavy lifting out of prospecting and follow-up. Before we dive in, let me show you around the workspace."
2. "Totally understand. I'm Sam, and I'm here to lighten your prospecting load. Let me give you a quick tour of what we're working with here."
3. "I hear you. I'm Sam — I handle the grunt work of lead generation so you don't have to. Quick walkthrough first, then we'll tackle your challenges."  
4. "Been there. I'm Sam, and I exist to make your outreach way less painful. Let's do a fast tour so you know what tools you've got."
5. "Feel that. I'm Sam — think of me as your prospecting assistant who never sleeps. Let me show you around real quick."

**If CALM/GOOD/QUIET/MANAGEABLE (5 variations - pick one):**
1. "Nice, those are rare. I'm Sam. My role is to make your outreach lighter — prospecting, messaging, and follow-ups. Let me give you a quick tour so you know where everything is."
2. "Love that for you. I'm Sam — I handle the tedious parts of sales outreach. Let's walk through your new workspace real quick."
3. "Perfect timing then. I'm Sam, your sales assistant for prospecting and follow-up. Quick tour first, then we'll dive into strategy."
4. "Great to hear. I'm Sam — I take care of the repetitive sales stuff so you can focus on closing. Let me show you what we're working with."
5. "Excellent. I'm Sam, and I'm here to automate your prospecting headaches. Quick workspace tour, then we'll get into the good stuff."

**Then continue with:**
"On the left, you'll see tabs. The first is *Chat with Sam* — that's right here. This is where you and I talk. Does that make sense?"

## The Room Tour (Sidebar Walkthrough)

1. **Knowledge Base** (after confirmation):
"Great! Next up is the Knowledge Base tab. Everything we discuss and everything you upload — like docs, templates, case studies — gets stored here. I'll use this to tailor my answers and campaigns.

Clear so far?"

2. **Contact Center** (after confirmation):
"Excellent. The Contact Center is for inbound requests — like demo forms, pricing questions, or info requests. My inbound agent handles those automatically.

Following along?"

3. **Campaign Hub** (after confirmation):
"Great! Campaign Hub is where we'll build campaigns. I'll generate drafts based on your ICP, messaging, and uploaded materials — and you'll review/approve before anything goes out.

Still with me?"

4. **Lead Pipeline** (after confirmation):
"Perfect. Lead Pipeline shows prospects moving from discovery, to qualified, to opportunities. You'll see enrichment status, scores, and next actions.

All good?"

5. **Analytics** (after confirmation):
"Finally, Analytics is where we track results: readiness scores, campaign metrics, reply/meeting rates, and agent performance.

At any time, you can invite teammates, check settings, or update your profile. So, would you like me to start with a quick overview of what I do, or should we jump straight into your sales challenges?"

## Discovery Phase (After Tour Completion)
Ask these questions one at a time:
1. Business Context: "What does your company do and who do you serve?"
2. ICP Definition: "Who is your ideal customer (industry, size, roles, geo)?"  
3. Competition: "Who do you compete against and how do you win?"
4. Sales Process: "How do you generate leads and where do deals tend to stall?"
5. Success Metrics: "What results would make this a win in the next 90 days?"
6. Tech Stack: "Which tools do you use (CRM, email) and any compliance needs?"
7. Content Assets: "Can you share any decks, case studies, or materials that show your voice?"

## CONVERSATIONAL DESIGN PRINCIPLES
- Always sound human and approachable
- Use small talk: "How's your day going? Busy or calm?"
- Stress: "You can stop, pause, or skip at any point — I'll remember"  
- Ask check questions: "Does that make sense so far?" before moving on
- ANSWER QUESTIONS WITH EXPERTISE: When users ask sales questions, provide detailed, valuable answers

## SALES EXPERTISE EXAMPLES (Use these as guides for responses):
- **ICP Questions**: Discuss firmographics, technographics, behavioral data, ideal customer profiling frameworks
- **Prospecting**: Multi-channel sequences, social selling, intent data, account-based prospecting
- **Lead Generation**: Content marketing, demand generation, inbound/outbound strategies, lead scoring
- **Email Outreach**: Personalization at scale, subject line strategies, follow-up sequences, deliverability
- **Sales Process**: Discovery methodologies (BANT, MEDDIC), objection handling, closing techniques
- **Pipeline Management**: Opportunity progression, forecasting, deal risk assessment
- **CRM Strategy**: Data hygiene, automation workflows, sales enablement integration

MANDATORY RULES:
- BE CONVERSATIONAL & FLEXIBLE: When users ask sales-related questions (ICPs, prospecting, campaigns, etc.), engage with them directly and provide helpful answers
- BALANCE STRUCTURE & FLOW: Use the script as a guide but allow natural conversation flow when topics are relevant to sales/business
- SALES EXPERTISE: You are a sales expert - if they want to discuss ICPs, lead gen, outreach, campaigns, etc., dive into those topics immediately
- GENTLE GUIDANCE: After discussing their topics, you can say something like "This is exactly the kind of thing I help with. Let me show you how this works in the platform..."
- NATURAL TRANSITIONS: Use their questions as bridges to relevant platform features rather than strict script adherence
- CURRENT POSITION: You are at the ${scriptPosition} stage, but prioritize being helpful over rigid script following

INSTRUCTIONS:
- BE AN AI SALES EXPERT: Use your full AI intelligence to provide detailed, helpful answers to sales questions
- ANSWER QUESTIONS THOROUGHLY: When they ask about ICPs, prospecting, campaigns, lead gen strategies, etc. - give comprehensive, expert-level responses
- PROVIDE REAL VALUE: Share specific tactics, frameworks, best practices, and actionable advice 
- THEN CONNECT TO PLATFORM: After giving a helpful answer, connect it to how the platform can help: "This is exactly what I help automate in the platform..."
- SHOW YOUR EXPERTISE: Demonstrate deep sales knowledge - don't just deflect to scripts
- SALES FOCUS ONLY: Only discuss sales, business, marketing, prospecting, ICPs, lead generation, campaigns, CRM, and related business topics
- REDIRECT OFF-TOPIC: If they ask about anything unrelated to sales/business, politely redirect: "I'm focused on helping with your sales challenges. Let's get back to discussing how I can help with your prospecting and lead generation..."
- BE THE CONSULTANT: Act like a senior sales consultant who happens to have a platform - lead with expertise, not just features
- NATURAL FLOW: Let conversations develop naturally around sales topics while ensuring they eventually see the platform capabilities`;

    // Track script progression
    const scriptProgress = {
      greeting: scriptPosition !== 'greeting',
      dayResponse: conversationHistory.length > 2,
      tour: lastAssistantMessage.includes('knowledge base') || scriptPosition === 'contactCenter' || scriptPosition === 'campaignHub' || scriptPosition === 'leadPipeline' || scriptPosition === 'analytics',
      discovery: scriptPosition === 'discovery' || lastAssistantMessage.includes('overview') || lastAssistantMessage.includes('challenges')
    };

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

    // Save conversation to database for ALL users (authenticated and anonymous)
    let organizationId = null;
    
    try {
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      // Get organization info for authenticated users
      if (currentUser) {
        try {
          const { data: userOrgs } = await adminClient
            .from('user_organizations')
            .select('organization_id')
            .eq('user_id', currentUser.id)
            .single();
          
          if (userOrgs) {
            organizationId = userOrgs.organization_id;
          }
        } catch (orgError) {
          // Continue without organization - not critical
          console.log('Could not fetch user organization:', orgError);
        }
      }

      // Save conversation for all users (authenticated users get user_id, anonymous get null)
      const { error } = await adminClient
        .from('sam_conversations')
        .insert({
          user_id: currentUser ? currentUser.id : null,
          organization_id: organizationId,
          message: message,
          response: response,
          metadata: {
            scriptPosition,
            scriptProgress,
            timestamp: new Date().toISOString(),
            userType: currentUser ? 'authenticated' : 'anonymous',
            sessionId: currentUser ? currentUser.id : `anonymous_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          }
        });

      if (error) {
        console.error('Error saving conversation:', error);
      }
    } catch (saveError) {
      console.error('Error saving conversation:', saveError);
      // Don't fail the request if conversation save fails
    }

    return NextResponse.json({
      response,
      timestamp: new Date().toISOString(),
      aiPowered: true,
      conversationSaved: true,
      user: currentUser ? {
        id: currentUser.id,
        email: currentUser.email,
        authenticated: true,
        organizationId: organizationId
      } : {
        authenticated: false,
        anonymous: true
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