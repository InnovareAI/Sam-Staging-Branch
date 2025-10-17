import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
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

  // Analyze user intent
  const userInput = context.user_request.toLowerCase();
  const isLeadGen = userInput.includes('lead') || userInput.includes('sale') || userInput.includes('revenue');
  const isNetworking = userInput.includes('network') || userInput.includes('connect') || userInput.includes('relationship');
  const isPartnership = userInput.includes('partner') || userInput.includes('collaborat');
  const isRecruiting = userInput.includes('recruit') || userInput.includes('hire') || userInput.includes('talent');

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
  }

  // Adjust tone
  if (tone === 'friendly') {
    connectionMessage = connectionMessage.replace('Hi {first_name}', 'Hey {first_name}');
    connectionMessage = connectionMessage.replace('Would love to connect', 'Would love to connect');
  } else if (tone === 'formal') {
    connectionMessage = connectionMessage.replace('Hi {first_name}', 'Dear {first_name}');
    connectionMessage = connectionMessage.replace("I'd love", 'I would appreciate the opportunity');
  }

  const response = `Perfect! I've created personalized LinkedIn templates for your "${context.campaign.name}" campaign${kbContext.length > 0 ? ' using insights from your Knowledge Base' : ''}.

**✨ Generated Templates:**

**Connection Request** (${connectionMessage.length}/275 characters):
"${connectionMessage}"

**Alternative Message** (${alternativeMessage.length}/115 characters):
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

  return {
    response,
    connection_message: connectionMessage,
    alternative_message: alternativeMessage,
    follow_up_messages: followUpMessages.filter(msg => msg.trim())
  };
}