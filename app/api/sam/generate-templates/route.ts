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
    console.log('🤖 Generating templates with AI for campaign:', context.campaign.name);
    console.log('📊 Context:', {
      campaignType: context.campaign.type,
      prospectCount: context.campaign.prospect_count,
      hasKB: kbContext.length > 0
    });

    if (!process.env.OPENROUTER_API_KEY) {
      console.error('❌ OPENROUTER_API_KEY is not set - falling back to rule-based generation');
      throw new Error('OpenRouter API key not configured');
    }

    const prompt = `You are SAM, an expert outreach messaging strategist. Generate compelling ${context.campaign.type === 'email' ? 'email' : 'LinkedIn'} campaign templates based on the following context:

**Campaign Details:**
- Campaign Name: ${context.campaign.name}
- Campaign Type: ${context.campaign.type === 'connector' ? 'Connector (2nd/3rd degree LinkedIn connections - needs connection request)' : context.campaign.type === 'email' ? 'Email (cold email outreach - NOT LinkedIn)' : 'Messenger (1st degree LinkedIn connections - direct messages only)'}
- Number of Prospects: ${context.campaign.prospect_count}

**Prospect Profile:**${prospectContextStr}
- Industries: ${industries.join(', ') || 'Not specified'}
- Job Titles: ${jobTitles.join(', ') || 'Not specified'}${kbContextStr}${conversationStr}

**User Request:** ${context.user_request}

**Instructions:**
${context.campaign.type === 'connector'
  ? `Generate a 6-step LinkedIn messaging sequence:

1. CONNECTION REQUEST (max 275 characters including {first_name} variable)
   - Sent with the connection request to 2nd/3rd degree connections
   - Must include {first_name} personalization variable

2. MESSAGE 2 - Starts with "Hello {first_name},"
   - First message after connection is accepted
   - Must begin with "Hello {first_name}," greeting

3. MESSAGE 3 (no first name)
   - Follow-up message if no response to Message 2

4. MESSAGE 4 (no first name)
   - Continue building value and engagement

5. MESSAGE 5 (no first name)
   - Maintain relationship and offer

6. MESSAGE 6 - Goodbye message (no first name)
   - Polite closing if still no response
   - Leave door open for future connection`
  : context.campaign.type === 'email'
  ? `Generate a 6-step cold email outreach sequence:

IMPORTANT: This is EMAIL outreach, NOT LinkedIn. Do NOT mention "connecting", "LinkedIn", or "thanks for connecting".

1. INITIAL EMAIL
   - Subject line + body
   - Must include {first_name} personalization
   - Professional cold email introduction

2. FOLLOW-UP EMAIL 1 - Starts with "Hi {first_name},"
   - Sent if no response to initial email
   - Reference the previous email briefly
   - Provide additional value

3. FOLLOW-UP EMAIL 2 (no first name greeting)
   - Another value-add follow-up

4. FOLLOW-UP EMAIL 3 (no first name greeting)
   - Continue building interest

5. FOLLOW-UP EMAIL 4 (no first name greeting)
   - Maintain engagement

6. FOLLOW-UP EMAIL 5 - Goodbye email (no first name)
   - Polite closing if still no response
   - Leave door open for future contact`
  : `Generate a 6-step LinkedIn direct messaging sequence:

1. INITIAL MESSAGE - Direct message for 1st degree connections
   - Must include {first_name} personalization

2. MESSAGE 2 - Starts with "Hello {first_name},"
   - Must begin with "Hello {first_name}," greeting

3-5. MESSAGES 3-5 (no first name)
   - Progressive follow-ups building value

6. MESSAGE 6 - Goodbye message (no first name)
   - Polite closing if still no response`}

**Template Requirements:**
- Use personalization variables: {first_name}, {last_name}, {company_name}, {title}, {industry}
${context.campaign.type === 'email'
  ? `- Initial Email: Professional cold email introduction
- Follow-up emails should NOT mention "connecting" or "LinkedIn"
- Keep emails concise and scannable
- Do NOT include placeholders like [Your name], [Link], [Calendar link], etc.
- End emails with just "Best regards" - the sender's name will be added automatically
- Do NOT include square bracket placeholders - these are not variables`
  : `- Connection Request: MUST be max 275 characters including all variables`}
- Message 2: MUST start with "Hello {first_name}," or "Hi {first_name},"
- Messages 3-6: NO first name greeting
- Message 6: Should be a polite goodbye/closing message
- Be concise, professional, and value-focused
- Avoid overly salesy language
- Focus on genuine ${context.campaign.type === 'email' ? 'outreach' : 'connection'} and value exchange
- Match the tone requested by the user
- Reference the user's Knowledge Base goals, ICP, and value proposition
- ONLY use curly brace variables like {first_name} - NEVER use square bracket placeholders

**Output Format:**
Provide templates in this EXACT format:

${context.campaign.type === 'email' ? `**Initial Email:**
"[Your cold email here with {first_name}]"` : `**Connection Request:**
"[Your connection request here - max 275 characters with {first_name}]"`}

**Follow-up Message 1:**
"Hi {first_name}, [Your first follow-up message here]"

**Follow-up Message 2:**
"[Your second follow-up here - no first name]"

**Follow-up Message 3:**
"[Your third follow-up here - no first name]"

**Follow-up Message 4:**
"[Your fourth follow-up here - no first name]"

**Follow-up Message 5:**
"[Your goodbye message here - no first name]"

Then provide a brief explanation of your template strategy based on the Knowledge Base insights.`;

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
      const errorText = await response.text();
      console.error('❌ OpenRouter API error:', response.status, errorText);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const aiResult = await response.json();
    console.log('✅ OpenRouter API response received');

    if (!aiResult.choices || !aiResult.choices[0] || !aiResult.choices[0].message) {
      console.error('❌ Invalid AI response structure:', aiResult);
      throw new Error('Invalid response from OpenRouter API');
    }

    const aiResponse = aiResult.choices[0].message.content;
    console.log('📝 AI generated response length:', aiResponse.length);

    // Parse the AI response to extract templates
    const parsedTemplates = parseAITemplates(aiResponse, context.campaign.type);
    console.log('✅ Templates parsed successfully:', {
      hasConnectionMsg: !!parsedTemplates.connection_message,
      hasAltMsg: !!parsedTemplates.alternative_message,
      followUpCount: parsedTemplates.follow_up_messages.length
    });

    return parsedTemplates;

  } catch (error) {
    console.error('❌ AI generation failed, falling back to rule-based:', error);
    console.log('⚠️  Using fallback template generation');
    // Fallback to original rule-based generation
    return generateFallbackTemplates(context, industries, jobTitles, companies, kbContext);
  }
}

function parseAITemplates(aiResponse: string, campaignType: string) {
  // Extract initial message based on campaign type
  let connectionMessage = '';

  if (campaignType === 'email') {
    // For email campaigns, look for "Initial Email"
    const emailMatch = aiResponse.match(/\*\*Initial Email:?\*\*\s*\n?"([^"]+)"/i);
    connectionMessage = emailMatch ? emailMatch[1].trim() : '';
  } else {
    // For LinkedIn campaigns, look for "Connection Request"
    const connectionMatch = aiResponse.match(/\*\*Connection Request:?\*\*\s*\n?"([^"]+)"/i);
    connectionMessage = connectionMatch ? connectionMatch[1].trim() : '';
  }

  // Extract all 5 follow-up messages (Messages 2-6)
  const followUpMessages: string[] = [];

  // Try to extract each follow-up message individually
  for (let i = 1; i <= 5; i++) {
    const regex = new RegExp(`\\*\\*Follow-up Message ${i}:?\\*\\*\\s*\\n?"([^"]+)"`, 'i');
    const match = aiResponse.match(regex);
    if (match) {
      followUpMessages.push(match[1].trim());
    }
  }

  // Fallback: try alternative formats if specific numbered messages not found
  if (followUpMessages.length === 0) {
    const altMatches = [...aiResponse.matchAll(/\*\*Follow-up Message \d+:?\*\*\s*\n?"([^"]+)"/gi)];
    followUpMessages.push(...altMatches.map(match => match[1].trim()));
  }

  // Ensure we have exactly 5 follow-up messages (pad with empty strings if needed)
  while (followUpMessages.length < 5) {
    followUpMessages.push('');
  }

  // Alternative message is no longer used - keeping for backwards compatibility
  const alternativeMessage = '';

  console.log(`📋 Parsed ${followUpMessages.length} follow-up messages`);

  return {
    response: aiResponse,
    connection_message: connectionMessage,
    alternative_message: alternativeMessage,
    follow_up_messages: followUpMessages.slice(0, 5) // Ensure exactly 5 messages
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
  } else if (context.campaign.type === 'email') {
    // Email campaigns: Cold email outreach (NO LinkedIn references)
    // These are placeholder templates - SAM AI will generate better ones via OpenRouter
    alternativeMessage = `Hi {first_name},

I noticed you're leading ${jobTitles.length > 0 ? jobTitles[0].toLowerCase() : 'initiatives'} at {company_name} and wanted to reach out.

We've been helping ${industries.length > 0 ? industries[0] : 'companies'} teams ${valueProp}.

Would you be open to a 15-minute call to see if this might be relevant for {company_name}?

Best regards`;

    followUpMessages = [
      `Hi {first_name}, wanted to follow up on my email from earlier this week. I'd love to share how we've helped similar ${industries.length > 0 ? industries[0] : 'companies'} achieve results. Would a quick call work for you?`,
      `{first_name} - I know things get busy. Just wanted to bump this up in case it got buried. Happy to work around your schedule if there's interest.`,
      `Quick question, {first_name} - is improving ${isLeadGen ? 'revenue growth' : 'operations'} something {company_name} is focused on right now? If so, I have some ideas that might help.`,
      `Last note from me, {first_name}. If the timing isn't right, no problem at all. Feel free to reach out whenever it makes sense for {company_name}.`
    ];
    // For email, use alternativeMessage as the initial email and connectionMessage stays empty
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
  } else if (context.campaign.type === 'email') {
    response = `Perfect! I've created personalized cold email templates for your "${context.campaign.name}" **email campaign**${kbContext.length > 0 ? ' using insights from your Knowledge Base' : ''}.

**✨ Generated Email Templates:**

**Initial Email:**
"${alternativeMessage}"

**Follow-up Emails:**
${followUpMessages.map((msg, i) => `${i + 1}. "${msg}"`).join('\n')}

**🎯 Template Strategy:**
${kbContext.length > 0 ? `• Enhanced with ${kbContext.length} Knowledge Base insight(s)\n` : ''}• ${isLeadGen ? 'Lead generation focus with value proposition' : ''}
• ${isNetworking ? 'Networking approach building professional relationships' : ''}
• ${isPartnership ? 'Partnership-oriented messaging for collaboration' : ''}
• ${tone.charAt(0).toUpperCase() + tone.slice(1)} tone as requested
• Cold email best practices for high deliverability
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