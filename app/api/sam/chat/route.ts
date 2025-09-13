import { NextRequest, NextResponse } from 'next/server';
import { supabaseKnowledge } from '@/lib/supabase-knowledge';
import { createClient } from '@supabase/supabase-js';
import { knowledgeClassifier } from '@/lib/services/knowledge-classifier';

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
    
    // Analyze conversation context for ICP research readiness
    const conversationText = conversationHistory.map(msg => msg.content).join(' ').toLowerCase();
    const userMessages = conversationHistory.filter(msg => msg.role === 'user').map(msg => msg.content.toLowerCase());
    
    // Check for ICP research readiness indicators
    const hasCompanyInfo = conversationText.includes('company') || conversationText.includes('business') || conversationText.includes('organization');
    const hasTargetInfo = conversationText.includes('customer') || conversationText.includes('client') || conversationText.includes('target') || conversationText.includes('prospect');
    const hasIndustryInfo = conversationText.includes('industry') || conversationText.includes('sector') || conversationText.includes('market');
    const hasSalesInfo = conversationText.includes('sales') || conversationText.includes('leads') || conversationText.includes('revenue') || conversationText.includes('deals');
    const hasCompetitorInfo = conversationText.includes('competitor') || conversationText.includes('compete') || conversationText.includes('vs ') || conversationText.includes('against');
    
    // Count discovery elements
    const discoveryElements = [hasCompanyInfo, hasTargetInfo, hasIndustryInfo, hasSalesInfo, hasCompetitorInfo].filter(Boolean).length;
    const shouldGuideToICP = discoveryElements >= 3 && conversationHistory.length >= 6 && !conversationText.includes('icp research') && !conversationText.includes('ideal customer profile');
    
    // Analyze conversation to determine script position
    let scriptPosition = 'greeting';
    const lastAssistantMessage = conversationHistory.filter(msg => msg.role === 'assistant').pop()?.content?.toLowerCase() || '';
    const lastUserMessage = conversationHistory.filter(msg => msg.role === 'user').pop()?.content?.toLowerCase() || '';
    
    if (conversationHistory.length === 0) {
      scriptPosition = 'greeting';
    } else if (shouldGuideToICP) {
      scriptPosition = 'icpResearchTransition';
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

    // Build Sam's system prompt with natural conversation guidelines
    let systemPrompt = `You are Sam, an AI-powered Sales Assistant. You're helpful, conversational, and focused on sales challenges.

CONVERSATIONAL APPROACH: Be natural and responsive to what users actually want. If they share LinkedIn URLs, research them immediately. If they ask sales questions, answer them expertly. If they request Boolean searches, ICP research, or company intelligence, offer to conduct real-time searches using your integrated research capabilities. Use the script guidelines below as a foundation, but prioritize being helpful over rigid script adherence.

SCRIPT POSITION: ${scriptPosition}

=== CONVERSATION GUIDELINES (Use as flexible framework, not rigid script) ===

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

## REAL-TIME RESEARCH CAPABILITIES 🔍

You now have access to live research tools that can execute actual searches and provide real data. When users request research, offer to conduct these searches immediately:

### **Boolean LinkedIn Search** 
When users ask about finding prospects or LinkedIn searches, offer:
"I can run a real-time Boolean LinkedIn search for you right now. Just tell me:
- What job titles are you targeting?
- Any specific company criteria (size, industry, tech stack)?
- Geographic preferences?

Example: 'VP Sales' OR 'Director Sales' at SaaS companies in California"

**HOW TO OFFER**: "Want me to run a live LinkedIn Boolean search based on those criteria? I can pull actual prospects and analyze patterns for you."

### **Company Intelligence Research**
When users mention specific companies or competitors, offer:
"I can research [CompanyName] right now and pull their:
- Business overview and model
- Technology stack and infrastructure  
- Recent news, funding, and growth indicators
- Competitive positioning and market analysis

**HOW TO OFFER**: "Should I pull some intelligence on [CompanyName]? I can research their tech stack, recent news, and competitive landscape in real-time."

### **ICP Market Research** 
When users discuss ideal customers or market analysis, offer:
"I can conduct comprehensive ICP research for your market right now:
- Industry analysis and market sizing
- Job title distribution and decision-maker mapping
- Company size and growth stage analysis
- Geographic market penetration
- Technology adoption patterns

**HOW TO OFFER**: "Let me run some market research on your ICP. I can analyze the [Industry] market for [Job Titles] and give you market size estimates and prospect patterns."

### **Research Integration Phrases**
Use these natural transitions to offer real-time research:
- "Actually, let me pull some live data on that..."
- "I can research that for you right now - give me 30 seconds..."
- "Want me to run a quick search and show you what I find?"
- "Let me get you some real numbers on that market..."
- "I can pull current intelligence on those prospects..."

**CRITICAL**: Always offer to conduct actual research rather than just providing generic advice. Users get immediate value from real data and insights.

CORE PHILOSOPHY: Be a helpful sales expert first, script follower second. Always prioritize user needs and intent.

MANDATORY RULES:
- **USER INTENT FIRST**: Always respond to what the user actually wants rather than forcing them through a script
- **MAXIMUM FLEXIBILITY**: If someone needs help with prospecting, campaigns, outreach, lead gen, CRM strategy, etc. - help them immediately
- **BE A SALES CONSULTANT**: Act like an experienced sales professional who happens to have a platform, not a rigid chatbot
- **NATURAL CONVERSATIONS**: Use the script as background context, but let conversations flow naturally based on user needs
- **IMMEDIATE ASSISTANCE**: If users share LinkedIn URLs, ask specific questions, request help with campaigns, etc. - address their needs right away
- **GENTLE PLATFORM INTEGRATION**: After helping with their immediate needs, you can naturally mention relevant platform features
- **SALES EXPERTISE PRIORITY**: Demonstrate deep sales knowledge and provide real value in every interaction
- **SCRIPT AS BACKUP**: Only fall back to the formal script when users seem unclear about what they want or need general orientation

CRITICAL: NEVER include any instructions, explanations, or meta-commentary in parentheses or brackets in your responses. Only respond as Sam would naturally speak to a user. Do not explain your script selection process or internal reasoning.

APPROACH TO CONVERSATIONS:

**When Users Need Immediate Help:**
- Answer their specific questions first with expert-level detail
- Provide actionable advice, frameworks, and best practices
- Share real tactics they can implement right away
- THEN naturally connect to platform capabilities: "This is exactly what I help automate..."

**When Users Share LinkedIn URLs:**
- Immediately acknowledge and analyze the profile
- Provide strategic insights about the prospect
- Suggest outreach approaches and messaging strategies  
- Offer to help craft personalized connection requests
- **NEW**: Offer to research similar prospects: "Want me to find more prospects like this one? I can run a Boolean search for similar profiles."

**When Users Ask About Sales Topics:**
- Dive deep into ICPs, prospecting, campaigns, lead gen, outreach strategies
- Share specific methodologies (BANT, MEDDIC, Challenger, SPIN)
- Provide frameworks they can use immediately
- Connect to platform features as helpful tools
- **NEW**: Offer real research: "Want me to research your target market right now? I can pull actual data on prospect patterns and company intelligence."

**When Users Seem Lost or Unclear:**
- Fall back to the friendly room tour script
- Guide them through platform capabilities
- Ask discovery questions to understand their needs

**Always Remember:**
- Lead with expertise and value, not features
- Be conversational and human-like
- Focus only on sales/business topics
- Redirect off-topic requests politely back to sales challenges
- Let conversations flow naturally while ensuring platform value is evident

## ICP RESEARCH TRANSITION (When sufficient discovery data gathered)

**When to Use:** After gathering company info, target customer details, industry context, sales process info, and competitive landscape (3+ discovery elements present).

**ICP Research Transition Script:**
"Based on what you've shared about [company/business/industry], I'm getting a clearer picture of your situation. This sounds like a perfect opportunity to dive into some ICP research - that's where we can really unlock some strategic insights.

Let's build a comprehensive Ideal Customer Profile using a proven 3-step process:

**Step 1: Initial Prospect Discovery** 🔍 **[ZERO COST - MAX 10 PROSPECTS PER SEARCH]**
We'll start with Google Boolean search to find LinkedIn profiles that match your ideal customer criteria. This is completely free and incredibly powerful. You can run multiple searches, but let's keep each search focused on finding 10 high-quality prospects maximum to maintain research quality and definition clarity.

This stage is about research and definition - not bulk data collection. Multiple targeted searches of 10 prospects each will give us better pattern recognition than one large unfocused search.

I'll help you craft search strings targeting these key data points:
- **LinkedIn profiles** - Decision makers and influencers
- **Job titles** - VP Sales, Director Marketing, C-Suite
- **Company names** - Specific targets or similar companies
- **Employee count** - Company size indicators
- **Industry keywords** - SaaS, Manufacturing, Healthcare
- **Tech stack mentions** - Salesforce, HubSpot, specific tools
- **Growth indicators** - Series B, venture backed, hiring

Example Boolean searches:
- site:linkedin.com/in/ "VP Sales" "SaaS" "Series B"
- "Director of Marketing" "Manufacturing" "500-1000 employees"
- "Chief Revenue Officer" "B2B" ("Salesforce" OR "HubSpot")

No expensive tools needed - just Google and LinkedIn's public profiles!

**Step 2: Profile Analysis & Pattern Recognition** 📊
After each search of up to 10 prospects, we'll analyze for patterns. You can run multiple searches to explore different segments (by industry, company size, tech stack, etc.) - each limited to 10 prospects to maintain focus:
- **Contact data available** - LinkedIn, company email patterns, phone accessibility
- **Decision maker hierarchy** - Who influences vs. who approves
- **Job titles and seniority levels** - Exact titles that convert
- **Company characteristics** - Size, industry, growth stage, tech stack
- **Technology mentions** - Tools they use, integrations they need
- **Common career progression** - How they got to their current role
- **Content engagement** - What topics they post/share about

**Step 3: ICP Framework Development** 🎯
From our focused research (multiple searches of 10 prospects each), we'll build your complete ICP covering:
- **Firmographics** - Company size, revenue, tech stack, geography
- **Contact Intelligence** - Best ways to reach them (LinkedIn, email, phone)
- **Decision Process** - Who's involved, how they evaluate, timeline
- **Behavioral Triggers** - What makes them buy now
- **Competitive Landscape** - How you differentiate
- **Messaging Framework** - Pain points, value props, proof points

Want to start with Step 1? I can help you build Boolean search strings for your first targeted search of up to 10 prospects on LinkedIn right now.

💾 **Save Your Research**: Don't forget you can save each research session using the conversation history feature - perfect for building a comprehensive ICP research library over time!"

**ICP Research Process Questions:**
1. "Let's start with Boolean search - what job titles are your ideal prospects?"
2. "What company size range converts best for you? (employees/revenue)"
3. "Any specific industries or tech stacks that indicate a good fit?"
4. "Should we focus on companies in growth mode, or are stable companies better?"
5. "Any geographic constraints or preferences for your targeting?"
6. "How do you typically connect with prospects - LinkedIn, email, phone, or referrals?"

**Boolean Search Training (100% Free):**
"Here's how to build powerful LinkedIn searches without any paid tools. Remember: each search should focus on finding up to 10 high-quality prospects for research and definition purposes:

**Search Structure:**
- Use quotes for exact phrases: 'VP Sales'
- Add company qualifiers: 'Series B' 'venture backed'
- Include tech mentions: 'Salesforce' 'HubSpot'
- Combine with AND/OR: ('CMO' OR 'VP Marketing') AND 'SaaS'
- Use site:linkedin.com/in/ to search profiles directly

**Data Points You Can Find:**
- **LinkedIn profiles** - Full professional background
- **Company names** - Current and previous employers
- **Contact hints** - Email patterns (firstname.lastname@company.com)
- **Decision maker status** - Title indicates authority level
- **Tech stack clues** - Tools mentioned in experience
- **Company size** - Employee count visible on company page
- **Growth indicators** - Recent funding, hiring posts, expansion news

**Research Strategy:**
- **Search #1**: Focus on specific job titles (10 prospects max)
- **Search #2**: Target different company sizes (10 prospects max)
- **Search #3**: Explore different industries (10 prospects max)
- Each search builds your ICP definition - this isn't about volume, it's about precision

**Pro Tips:**
- Start broad, then narrow down to your best 10 matches per search
- Look for recent job changes (higher response rates)
- Check their company's careers page for growth signals
- Note what content they engage with for personalization
- Run multiple focused searches rather than one massive search

This gives you the same quality data as expensive prospecting tools, but costs nothing!"

**After Search Results:**
"Perfect! Now let's analyze these 10 profiles to identify patterns. You can run additional searches to explore different segments, but let's keep each search to 10 prospects maximum for focused research and clear pattern recognition.

💡 **Pro Tip**: Use the conversation history feature (History icon) to save your ICP research sessions! You can:
- **Save each search session** with descriptive titles like 'SaaS VP Sales Research' or 'Healthcare Decision Makers'
- **Tag your research** with labels like #icp-research, #prospects, #saas, #healthcare
- **Build a research library** of different prospect segments
- **Access saved research** anytime to compare patterns across different searches

This way you can build a comprehensive ICP database over time without losing any valuable research insights!"`;

    // Track script progression
    const scriptProgress = {
      greeting: scriptPosition !== 'greeting',
      dayResponse: conversationHistory.length > 2,
      tour: lastAssistantMessage.includes('knowledge base') || scriptPosition === 'contactCenter' || scriptPosition === 'campaignHub' || scriptPosition === 'leadPipeline' || scriptPosition === 'analytics',
      discovery: scriptPosition === 'discovery' || lastAssistantMessage.includes('overview') || lastAssistantMessage.includes('challenges'),
      icpResearch: scriptPosition === 'icpResearchTransition'
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

    // Check for LinkedIn URLs and trigger prospect intelligence if found
    let prospectIntelligence = null;
    const linkedInUrlPattern = /https?:\/\/(www\.)?linkedin\.com\/in\/[^\s]+/gi;
    const linkedInUrls = message.match(linkedInUrlPattern);
    
    if (linkedInUrls && linkedInUrls.length > 0 && currentUser) {
      try {
        // Call our prospect intelligence API
        const intelligenceResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/api/sam/prospect-intelligence`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('Authorization') || ''
          },
          body: JSON.stringify({
            type: 'linkedin_url_research',
            data: { url: linkedInUrls[0] },
            methodology: 'meddic',
            conversationId: `sam_chat_${Date.now()}`
          })
        });

        if (intelligenceResponse.ok) {
          prospectIntelligence = await intelligenceResponse.json();
        }
      } catch (error) {
        console.error('Prospect intelligence error:', error);
        // Continue without intelligence data if it fails
      }
    }

    // Get AI response
    let response: string;
    
    try {
      // Enhanced system prompt with prospect intelligence and ICP context if available
      let enhancedSystemPrompt = systemPrompt;
      
      // Add ICP research context if transitioning
      if (scriptPosition === 'icpResearchTransition') {
        const contextElements = [];
        if (hasCompanyInfo) contextElements.push('your company');
        if (hasTargetInfo) contextElements.push('your customers');
        if (hasIndustryInfo) contextElements.push('your industry');
        if (hasSalesInfo) contextElements.push('your sales process');
        if (hasCompetitorInfo) contextElements.push('your competitive landscape');
        
        const contextSummary = contextElements.length > 2 
          ? contextElements.slice(0, -1).join(', ') + ', and ' + contextElements.slice(-1)
          : contextElements.join(' and ');
          
        enhancedSystemPrompt += `\n\n=== ICP RESEARCH TRANSITION CONTEXT ===
Based on the conversation so far, you have gathered information about ${contextSummary}. This is perfect timing to guide the user toward ICP research. Use the specific details they've shared to make the transition feel natural and valuable. Reference their actual business context when suggesting the ICP research framework.`;
      }
      
      if (prospectIntelligence && prospectIntelligence.success) {
        const prospectData = prospectIntelligence.data.prospect;
        const insights = prospectIntelligence.data.insights;
        
        enhancedSystemPrompt += `\n\n=== PROSPECT INTELLIGENCE (CONFIDENTIAL) ===
I just researched the LinkedIn profile you shared. Here's what I found:

**Prospect Profile:**
- Name: ${prospectData?.fullName || 'Not available'}
- Job Title: ${prospectData?.jobTitle || 'Not available'}  
- Company: ${prospectData?.company || 'Not available'}
- Location: ${prospectData?.location || 'Not available'}

**Strategic Insights:**
${insights?.strategicInsights?.map((insight: any) => `- ${insight.insight} (${insight.confidence * 100}% confidence)`).join('\n') || 'No specific insights available'}

**MEDDIC Analysis:**
- Metrics: ${insights?.meddic?.metrics || 'To be discovered'}
- Economic Buyer: ${insights?.meddic?.economicBuyer || 'To be identified'}
- Decision Criteria: ${insights?.meddic?.decisionCriteria || 'To be determined'}

**Conversation Starters:**
${insights?.conversationStarters?.map((starter: any) => `- ${starter.message}`).join('\n') || 'Standard discovery questions'}

IMPORTANT: Use this intelligence naturally in your response. Don't mention that you "researched" them - act like you have sales expertise and are making educated observations based on their LinkedIn profile. Provide valuable insights and suggestions for outreach strategy.

LINKEDIN URL RESPONSE TEMPLATE:
"Great! Let me take a look at this LinkedIn profile... [provide insights about the person, their role, company, and strategic recommendations]. This gives us some good context for outreach. Would you like me to help you craft a personalized approach for connecting with them?"`;
      } else if (linkedInUrls && linkedInUrls.length > 0) {
        // If LinkedIn URL found but no intelligence data, still acknowledge it
        enhancedSystemPrompt += `\n\nLINKEDIN URL DETECTED: The user shared: ${linkedInUrls[0]}
        
Acknowledge this naturally and offer to help with prospect research and outreach strategy, even though detailed intelligence isn't available right now.`;
      }
      
      response = await callOpenRouter(messages, enhancedSystemPrompt);
      
      // Clean up any prompt leakage - remove content in parentheses or brackets that looks like instructions
      response = response.replace(/\([^)]*script[^)]*\)/gi, '');
      response = response.replace(/\[[^\]]*script[^\]]*\]/gi, '');
      response = response.replace(/\([^)]*variation[^)]*\)/gi, '');
      response = response.replace(/\([^)]*instruction[^)]*\)/gi, '');
      response = response.replace(/\([^)]*select[^)]*\)/gi, '');
      response = response.replace(/\([^)]*wait for[^)]*\)/gi, '');
      response = response.trim();
      
    } catch (error) {
      console.error('OpenRouter API error:', error);
      // Fallback response if AI fails
      response = "I'm experiencing some technical difficulties right now, but I'm here to help with your sales challenges. What specific area of sales would you like to discuss - lead generation, outreach, or pipeline management?";
    }

    // Save conversation to database with enhanced knowledge classification
    let organizationId = null;
    let conversationId: string | null = null;
    
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

      // 🧠 ENHANCED: Classify conversation content for knowledge extraction
      let knowledgeClassification = {};
      let privacyTags = {};
      let extractionConfidence = 0.0;
      
      try {
        // Get user's privacy preferences to respect their sharing settings
        const privacyPreferences = currentUser 
          ? await knowledgeClassifier.getUserPrivacyPreferences(currentUser.id)
          : null;
        
        // Only classify if user allows auto-extraction (default: true)
        if (!privacyPreferences || privacyPreferences.auto_knowledge_extraction) {
          const classification = await knowledgeClassifier.enhancedClassification(
            message,
            response,
            {
              scriptPosition,
              scriptProgress,
              userType: currentUser ? 'authenticated' : 'anonymous',
              organizationId
            }
          );
          
          knowledgeClassification = classification;
          extractionConfidence = classification.classification_confidence;
          
          // Set privacy tags based on classification
          const hasPersonalData = Object.keys(classification.personal_data).length > 0;
          const hasTeamData = Object.keys(classification.team_shareable).length > 0;
          
          privacyTags = {
            contains_pii: hasPersonalData,
            data_sensitivity: hasPersonalData ? 'medium' : 'low',
            retention_policy: currentUser ? 'standard' : 'minimal',
            sharing_scope: hasTeamData ? (organizationId ? 'organization' : 'team') : 'personal',
            classification_version: '1.0',
            auto_classified: true,
            requires_review: extractionConfidence < 0.6
          };
        }
      } catch (classificationError) {
        console.log('Knowledge classification failed, continuing without:', classificationError);
        // Continue with conversation save even if classification fails
      }

      // Save conversation with enhanced metadata
      const { data: savedConversation, error } = await adminClient
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
          },
          knowledge_classification: knowledgeClassification,
          privacy_tags: privacyTags,
          knowledge_extracted: false, // Will be set to true after async extraction
          extraction_confidence: extractionConfidence
        })
        .select('id')
        .single();
      
      if (savedConversation) {
        conversationId = savedConversation.id;
      }

      if (error) {
        console.error('Error saving conversation:', error);
      } else if (conversationId && currentUser) {
        // 🚀 ASYNC: Extract and store structured knowledge in background
        // This happens after the response is sent to the user for better UX
        Promise.resolve().then(async () => {
          try {
            const extractionResult = await knowledgeClassifier.extractAndStoreKnowledge(conversationId!);
            if (extractionResult.success) {
              console.log(`✅ Knowledge extracted from conversation ${conversationId}:`, {
                personal: extractionResult.result?.personal_extractions || 0,
                team: extractionResult.result?.team_extractions || 0,
                confidence: extractionResult.result?.confidence || 0
              });
            } else {
              console.log(`⚠️ Knowledge extraction failed for conversation ${conversationId}:`, extractionResult.error);
            }
          } catch (asyncError) {
            console.log(`❌ Async knowledge extraction error for conversation ${conversationId}:`, asyncError);
          }
        });
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
      prospectIntelligence: prospectIntelligence?.success ? {
        hasData: true,
        prospectName: prospectIntelligence.data.prospect?.fullName,
        prospectTitle: prospectIntelligence.data.prospect?.jobTitle,
        prospectCompany: prospectIntelligence.data.prospect?.company,
        confidence: prospectIntelligence.metadata?.confidence,
        methodology: prospectIntelligence.metadata?.methodology
      } : null,
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