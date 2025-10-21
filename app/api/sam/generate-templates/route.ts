import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      workspace_id,
      campaign_name,
      campaign_type,
      prospect_count,
      user_input,
      conversation_history,
      prospect_sample
    } = await req.json();

    // Fetch relevant KB insights
    let kbInsights: any[] = [];
    if (workspace_id) {
      const { data: kbContent } = await supabase
        .from('knowledge_base')
        .select('title, content')
        .eq('workspace_id', workspace_id)
        .eq('is_active', true)
        .or('section_id.eq.messaging,section_id.eq.value_proposition,section_id.eq.company_info')
        .limit(5);

      kbInsights = kbContent || [];
    }

    // Build context for SAM AI
    const context = {
      campaign: {
        name: campaign_name,
        type: campaign_type,
        prospect_count
      },
      prospects: prospect_sample || [],
      conversation: conversation_history || [],
      user_request: user_input,
      knowledge_base: kbInsights
    };

    // Generate intelligent templates based on context
    const templates = await generateLinkedInTemplates(context);

    return NextResponse.json({
      success: true,
      response: templates.response,
      templates: {
        connection_message: templates.connection_message,
        alternative_message: templates.alternative_message,
        follow_up_messages: templates.follow_up_messages
      },
      metadata: {
        generated_at: new Date().toISOString(),
        campaign_type,
        prospect_count
      }
    });

  } catch (error: any) {
    console.error('SAM template generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate templates', details: error.message },
      { status: 500 }
    );
  }
}

async function generateLinkedInTemplates(context: any) {
  // Extract KB insights
  const kbContext = context.knowledge_base || [];
  const valueProps = kbContext.filter((kb: any) => kb.title?.toLowerCase().includes('value') || kb.title?.toLowerCase().includes('pitch'));
  const messagingGuidelines = kbContext.filter((kb: any) => kb.title?.toLowerCase().includes('messaging') || kb.title?.toLowerCase().includes('template'));
  const companyInfo = kbContext.filter((kb: any) => kb.title?.toLowerCase().includes('company') || kb.title?.toLowerCase().includes('about'));

  // Extract prospect insights
  const prospects = context.prospects || [];
  const industries = [...new Set(prospects.map((p: any) => p.industry || p.company).filter(Boolean))];
  const jobTitles = [...new Set(prospects.map((p: any) => p.job_title || p.title).filter(Boolean))];
  const companies = [...new Set(prospects.map((p: any) => p.company_name || p.company).filter(Boolean))];

  // Build context for LLM
  const kbContextStr = kbContext.length > 0
    ? `\n\nKnowledge Base Context:\n${kbContext.map((kb: any) => `- ${kb.title}: ${kb.content}`).join('\n')}`
    : '';

  const prospectContextStr = prospects.length > 0
    ? `\n\nProspect Sample:\n${prospects.slice(0, 3).map((p: any) => `- ${p.title || p.job_title || 'Unknown'} at ${p.company || p.company_name || 'Unknown Company'}`).join('\n')}`
    : '';

  const conversationStr = context.conversation && context.conversation.length > 0
    ? `\n\nPrevious conversation:\n${context.conversation.map((msg: any) => `${msg.role}: ${msg.content}`).join('\n')}`
    : '';

  // Call OpenRouter AI for intelligent template generation
  try {
    const prompt = `You are SAM, an expert LinkedIn messaging strategist. Generate compelling LinkedIn campaign templates based on the following context:

**Campaign Details:**
- Campaign Name: ${context.campaign.name}
- Campaign Type: ${context.campaign.type === 'connector' ? 'Connector (2nd/3rd degree connections - needs connection request)' : 'Messenger (1st degree connections - direct messages only)'}
- Number of Prospects: ${context.campaign.prospect_count}

**Prospect Profile:**${prospectContextStr}
- Industries: ${industries.join(', ') || 'Not specified'}
- Job Titles: ${jobTitles.join(', ') || 'Not specified'}${kbContextStr}${conversationStr}

**User Request:** ${context.user_request}

**Instructions:**
${context.campaign.type === 'connector'
  ? `1. Generate a CONNECTION REQUEST message (max 275 characters) - this is sent with the connection request
2. Generate an ALTERNATIVE MESSAGE (max 115 characters) - for prospects already connected
3. Generate 2-3 FOLLOW-UP messages - sent after connection is accepted`
  : `1. Generate an INITIAL MESSAGE - direct message for 1st degree connections
2. Generate 2-3 FOLLOW-UP messages - sent if no response`}

**Template Requirements:**
- Use personalization variables: {first_name}, {last_name}, {company_name}, {title}, {industry}
- Be concise, professional, and value-focused
- Avoid overly salesy language
- Focus on genuine connection and value exchange
- Match the tone requested by the user

**Output Format:**
Provide templates in this EXACT format:

**Connection Request Message:**
"[Your connection request here]"

**Alternative Message:**
"[Your alternative message here]"

**Follow-up Message 1:**
"[Your first follow-up here]"

**Follow-up Message 2:**
"[Your second follow-up here]"

Then provide a brief explanation of your template strategy.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      console.error('OpenRouter API error:', await response.text());
      throw new Error('Failed to generate templates with AI');
    }

    const aiResult = await response.json();
    const aiResponse = aiResult.choices[0].message.content;

    // Parse the AI response to extract templates
    return parseAITemplates(aiResponse, context.campaign.type);

  } catch (error) {
    console.error('AI generation failed, falling back to rule-based:', error);
    // Fallback to original rule-based generation
    return generateFallbackTemplates(context, industries, jobTitles, companies, kbContext);
  }
}

function parseAITemplates(aiResponse: string, campaignType: string) {
  // Extract connection message
  const connectionMatch = aiResponse.match(/\*\*Connection Request Message:\*\*\s*\n?"([^"]+)"/i);
  const connectionMessage = connectionMatch ? connectionMatch[1].trim() : '';

  // Extract alternative message
  const altMatch = aiResponse.match(/\*\*Alternative Message:\*\*\s*\n?"([^"]+)"/i);
  const alternativeMessage = altMatch ? altMatch[1].trim() : '';

  // Extract follow-up messages
  const followUpMatches = [...aiResponse.matchAll(/\*\*Follow-up Message \d+:\*\*\s*\n?"([^"]+)"/gi)];
  const followUpMessages = followUpMatches.map(match => match[1].trim());

  return {
    response: aiResponse,
    connection_message: connectionMessage,
    alternative_message: alternativeMessage,
    follow_up_messages: followUpMessages
  };
}

function generateFallbackTemplates(context: any, industries: string[], jobTitles: string[], companies: string[], kbContext: any[]) {
  // Original hardcoded logic as fallback
  const userInput = context.user_request.toLowerCase();
  const isLeadGen = userInput.includes('lead') || userInput.includes('sale') || userInput.includes('revenue');
  const isNetworking = userInput.includes('network') || userInput.includes('connect') || userInput.includes('relationship');

  // Determine tone
  let tone = 'professional';
  if (userInput.includes('casual') || userInput.includes('friendly')) tone = 'friendly';
  if (userInput.includes('formal') || userInput.includes('enterprise')) tone = 'formal';

  // Generate campaign-specific templates
  let connectionMessage = '';
  let alternativeMessage = '';
  let followUpMessages = [''];

  // Extract value prop from KB if available
  let valueProp = valueProps.length > 0 ? valueProps[0].content.substring(0, 150) : `help ${jobTitles.length > 0 ? jobTitles[0].toLowerCase() : 'professionals'} like yourself streamline operations and drive growth`;

  if (context.campaign.type === 'connector') {
    // Connector campaigns: Need connection request + follow-ups
    if (isLeadGen) {
      connectionMessage = `Hi {first_name}, I noticed your work in ${industries.length > 0 ? industries[0] : '{industry}'} at {company_name}. I ${valueProp}. Would love to connect and share some insights that might be valuable for your revenue goals.`;

      followUpMessages = [
        `Thanks for connecting, {first_name}! I'm curious - what's the biggest challenge you're facing at {company_name} when it comes to ${isLeadGen ? 'revenue growth' : 'operations'}?`,
        `Hi {first_name}, I came across an interesting case study about ${industries.length > 0 ? industries[0] : 'your industry'} that I thought might resonate with your work at {company_name}. Would you be interested in a quick 5-minute chat to discuss?`
      ];
    } else if (isNetworking) {
      connectionMessage = `Hi {first_name}, I'm impressed by your work at {company_name}. I'm building connections with forward-thinking ${jobTitles.length > 0 ? jobTitles[0].toLowerCase() + 's' : 'professionals'} in ${industries.length > 0 ? industries[0] : '{industry}'} and would love to connect.`;

      followUpMessages = [
        `Thanks for connecting, {first_name}! I'd love to learn more about your journey in ${industries.length > 0 ? industries[0] : '{industry}'} and the interesting projects you're working on at {company_name}.`
      ];
    } else if (isPartnership) {
      connectionMessage = `Hi {first_name}, I've been following {company_name}'s work in ${industries.length > 0 ? industries[0] : '{industry}'} and I'm impressed. I believe there might be some interesting collaboration opportunities between our organizations. Would love to connect.`;

      followUpMessages = [
        `Thanks for connecting, {first_name}! I'd love to explore potential partnership opportunities between our companies. Do you have 10 minutes this week for a brief call?`
      ];
    } else {
      // Generic professional outreach
      connectionMessage = `Hi {first_name}, I noticed your impressive background in ${industries.length > 0 ? industries[0] : '{industry}'} at {company_name}. I'd love to connect and learn more about your work.`;

      followUpMessages = [
        `Thanks for connecting, {first_name}! I'm always interested in learning from experienced ${jobTitles.length > 0 ? jobTitles[0].toLowerCase() + 's' : 'professionals'} like yourself. What's the most exciting project you're working on at {company_name}?`
      ];
    }

    alternativeMessage = `Would love to connect with you on LinkedIn, {first_name}!`;
  } else if (context.campaign.type === 'messenger') {
    // Messenger campaigns: Direct messages to 1st degree connections (NO connection request)
    if (isLeadGen) {
      alternativeMessage = `Hi {first_name}! I've been following your work at {company_name} and I ${valueProp}. I'd love to share some insights that could help with your revenue goals. Do you have time for a quick chat?`;

      followUpMessages = [
        `Thanks for your time, {first_name}! What's the biggest challenge you're facing at {company_name} when it comes to revenue growth?`,
        `Hi {first_name}, I came across an interesting case study about ${industries.length > 0 ? industries[0] : 'your industry'} that I thought might resonate with your work. Would you like me to share it?`
      ];
    } else if (isNetworking) {
      alternativeMessage = `Hi {first_name}! I've been meaning to reach out - I'm really impressed by your work at {company_name}. Would love to learn more about your journey in ${industries.length > 0 ? industries[0] : '{industry}'}.`;

      followUpMessages = [
        `Hey {first_name}, what's the most exciting project you're working on at {company_name} these days?`
      ];
    } else if (isPartnership) {
      alternativeMessage = `Hi {first_name}! I've been following {company_name}'s work in ${industries.length > 0 ? industries[0] : '{industry}'} and I believe there might be some interesting collaboration opportunities. Do you have time for a brief call this week?`;

      followUpMessages = [
        `Thanks {first_name}! I'd love to explore how our organizations might work together. When would be a good time to connect?`
      ];
    } else {
      // Generic direct message
      alternativeMessage = `Hi {first_name}! Hope you're doing well. I've been impressed by your work at {company_name} and wanted to reach out to connect and learn more about what you're working on.`;

      followUpMessages = [
        `Thanks for responding, {first_name}! What's the most exciting challenge you're tackling at {company_name} these days?`
      ];
    }
    // Note: connectionMessage stays empty for messenger campaigns
  }

  // Adjust tone
  if (tone === 'friendly') {
    connectionMessage = connectionMessage.replace('Hi {first_name}', 'Hey {first_name}');
    connectionMessage = connectionMessage.replace('Would love to connect', 'Would love to connect');
  } else if (tone === 'formal') {
    connectionMessage = connectionMessage.replace('Hi {first_name}', 'Dear {first_name}');
    connectionMessage = connectionMessage.replace("I'd love", 'I would appreciate the opportunity');
  }

  // Generate campaign-type-specific response
  let response = '';

  if (context.campaign.type === 'connector') {
    response = `Perfect! I've created personalized LinkedIn templates for your "${context.campaign.name}" **connector campaign** (for 2nd/3rd degree connections)${kbContext.length > 0 ? ' using insights from your Knowledge Base' : ''}.

**✨ Generated Templates:**

**Connection Request Message** (${connectionMessage.length}/275 characters):
"${connectionMessage}"

**Alternative Message** (for already-connected prospects) (${alternativeMessage.length}/115 characters):
"${alternativeMessage}"

**Follow-up Messages:**
${followUpMessages.map((msg, i) => `${i + 1}. "${msg}"`).join('\n')}

**🎯 Template Strategy:**
${kbContext.length > 0 ? `• Enhanced with ${kbContext.length} Knowledge Base insight(s)\n` : ''}• ${isLeadGen ? 'Lead generation focus with value proposition' : ''}
• ${isNetworking ? 'Networking approach building professional relationships' : ''}
• ${isPartnership ? 'Partnership-oriented messaging for collaboration' : ''}
• ${tone.charAt(0).toUpperCase() + tone.slice(1)} tone as requested
• Industry-specific language for ${industries.length > 0 ? industries[0] : 'your target market'}
• Personalized for ${jobTitles.length > 0 ? jobTitles[0] : 'your audience'}

These templates are ready to use! Would you like me to adjust anything or shall we apply them to your campaign?`;
  } else if (context.campaign.type === 'messenger') {
    response = `Perfect! I've created personalized LinkedIn direct messages for your "${context.campaign.name}" **messenger campaign** (for 1st degree connections)${kbContext.length > 0 ? ' using insights from your Knowledge Base' : ''}.

**✨ Generated Templates:**

**Initial Message** (${alternativeMessage.length} characters):
"${alternativeMessage}"

**Follow-up Messages:**
${followUpMessages.map((msg, i) => `${i + 1}. "${msg}"`).join('\n')}

**🎯 Template Strategy:**
${kbContext.length > 0 ? `• Enhanced with ${kbContext.length} Knowledge Base insight(s)\n` : ''}• ${isLeadGen ? 'Lead generation focus with value proposition' : ''}
• ${isNetworking ? 'Networking approach building professional relationships' : ''}
• ${isPartnership ? 'Partnership-oriented messaging for collaboration' : ''}
• ${tone.charAt(0).toUpperCase() + tone.slice(1)} tone as requested
• Direct messaging approach for existing connections
• Industry-specific language for ${industries.length > 0 ? industries[0] : 'your target market'}
• Personalized for ${jobTitles.length > 0 ? jobTitles[0] : 'your audience'}

These templates are ready to use! Would you like me to adjust anything or shall we apply them to your campaign?`;
  }

  return {
    response,
    connection_message: connectionMessage,
    alternative_message: alternativeMessage,
    follow_up_messages: followUpMessages.filter(msg => msg.trim())
  };
}