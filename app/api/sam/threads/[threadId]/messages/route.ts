/**
 * SAM AI Thread Messages API
 * 
 * Handles messages within conversation threads with enhanced prospect intelligence
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Helper function to call OpenRouter API
async function callOpenRouterAPI(messages: any[], systemPrompt: string) {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  
  if (!openRouterKey) {
    console.log('⚠️  OpenRouter API key not configured, using fallback');
    return getMockSamResponse(messages);
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://innovareai.com',
        'X-Title': 'Sam AI Sales Consultant'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.7-sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((msg: any) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          }))
        ],
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in OpenRouter response');
    }

    return content;
    
  } catch (error) {
    console.error('❌ OpenRouter API error:', error);
    console.log('🔄 Falling back to mock response');
    return getMockSamResponse(messages);
  }
}

// Fallback response when Mistral is not available - American sales style
function getMockSamResponse(messages: any[]): string {
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
  
  // Campaign-related responses
  if (lastMessage.includes('campaign')) {
    return "Let's build a winning campaign! I've got the tools to create high-converting campaigns that actually drive revenue. I can optimize targeting, craft compelling messaging, and track ROI in real-time. What's your target market and what results are you looking to achieve?";
  }
  
  // Template-related responses
  if (lastMessage.includes('template') || lastMessage.includes('message')) {
    return "Time to make your messaging convert! I can analyze and optimize your templates for maximum response rates using proven sales psychology and AI-powered insights. Let's turn those templates into revenue-generating machines. What templates need optimization?";
  }
  
  // Performance/analytics responses
  if (lastMessage.includes('performance') || lastMessage.includes('analytics') || lastMessage.includes('stats')) {
    return "Let's dive into the numbers! I can show you exactly which campaigns are driving revenue, what response rates you're hitting, and where to optimize for better ROI. Data-driven sales decisions lead to bigger wins. What metrics do you want to review?";
  }
  
  // Revenue/ROI related
  if (lastMessage.includes('revenue') || lastMessage.includes('roi') || lastMessage.includes('deals') || lastMessage.includes('sales')) {
    return "Now we're talking! Revenue growth is what it's all about. I can help you identify which strategies are actually moving the needle, optimize your sales funnel, and scale what's working. What part of your revenue engine needs attention?";
  }
  
  // Competitive/market related
  if (lastMessage.includes('competitor') || lastMessage.includes('market') || lastMessage.includes('advantage')) {
    return "Let's dominate the competition! I can help you analyze market positioning, craft messaging that differentiates you, and build campaigns that outperform competitors. Winning in sales is about execution and smart strategy. What competitive challenges are you facing?";
  }
  
  // Default response - American sales energy
  return "Hey there! I'm Sam, your AI-powered sales weapon! I'm here to help you crush your revenue goals with high-converting campaigns, optimized messaging, and data-driven insights. I don't just give advice - I can actually execute campaigns, optimize templates, and track performance in real-time. Ready to accelerate your sales results? What's the biggest opportunity you want to tackle?";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const resolvedParams = await params
    const supabase = createRouteHandlerClient({ cookies: cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Verify thread ownership
    const { data: thread } = await supabase
      .from('sam_conversation_threads')
      .select('id, user_id')
      .eq('id', resolvedParams.threadId)
      .eq('user_id', user.id)
      .single()

    if (!thread) {
      return NextResponse.json({
        success: false,
        error: 'Thread not found'
      }, { status: 404 })
    }

    // Load messages
    const { data: messages, error } = await supabase
      .from('sam_thread_messages')
      .select('*')
      .eq('thread_id', resolvedParams.threadId)
      .order('message_order', { ascending: true })

    if (error) {
      console.error('Failed to load messages:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to load messages'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      messages: messages || [],
      count: messages?.length || 0
    })

  } catch (error) {
    console.error('Get messages API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const resolvedParams = await params
    const supabase = createRouteHandlerClient({ cookies: cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const body = await request.json()
    const { content } = body

    if (!content?.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Message content is required'
      }, { status: 400 })
    }

    // Get thread details
    const { data: thread, error: threadError } = await supabase
      .from('sam_conversation_threads')
      .select('*')
      .eq('id', resolvedParams.threadId)
      .eq('user_id', user.id)
      .single()

    if (threadError || !thread) {
      return NextResponse.json({
        success: false,
        error: 'Thread not found'
      }, { status: 404 })
    }

    // Get message count for ordering
    const { count: messageCount } = await supabase
      .from('sam_thread_messages')
      .select('*', { count: 'exact', head: true })
      .eq('thread_id', resolvedParams.threadId)

    const nextOrder = (messageCount || 0) + 1

    // Check for LinkedIn URLs and ICP building requests to trigger prospect intelligence
    let prospectIntelligence = null
    let hasProspectIntelligence = false
    const linkedInUrlPattern = /https?:\/\/(www\.)?linkedin\.com\/in\/[^\s]+/gi
    const linkedInUrls = content.match(linkedInUrlPattern)
    
    // Detect ICP building requests
    const icpKeywords = ['build icp', 'ideal customer', 'find prospects', 'target audience', 'who should i target', 'search for', 'show me examples', 'vp sales', 'director', 'manager', 'cto', 'ceo']
    const isICPRequest = icpKeywords.some(keyword => content.toLowerCase().includes(keyword))
    
    if (linkedInUrls && linkedInUrls.length > 0) {
      try {
        const intelligenceResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/api/sam/prospect-intelligence`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': request.headers.get('Authorization') || ''
          },
          body: JSON.stringify({
            type: 'linkedin_url_research',
            data: { url: linkedInUrls[0] },
            methodology: thread.sales_methodology,
            conversationId: resolvedParams.threadId
          })
        })

        if (intelligenceResponse.ok) {
          prospectIntelligence = await intelligenceResponse.json()
          hasProspectIntelligence = true

          // Update thread with prospect info if available
          if (prospectIntelligence?.success && prospectIntelligence.data.prospect) {
            const prospect = prospectIntelligence.data.prospect
            await supabase
              .from('sam_conversation_threads')
              .update({
                prospect_name: prospect.fullName || thread.prospect_name,
                prospect_company: prospect.company || thread.prospect_company,
                prospect_linkedin_url: linkedInUrls[0],
                thread_type: 'linkedin_research',
                title: prospect.fullName && prospect.company 
                  ? `${prospect.fullName} - ${prospect.company}`
                  : thread.title
              })
              .eq('id', resolvedParams.threadId)
          }
        }
      } catch (error) {
        console.error('Prospect intelligence error:', error)
      }
    }

    // Trigger ICP research for interactive building sessions
    if (isICPRequest && !linkedInUrls) {
      try {
        // Extract job titles and criteria from user message
        const jobTitles = extractJobTitles(content)
        const industry = extractIndustry(content)
        const companySize = extractCompanySize(content)
        
        if (jobTitles.length > 0) {
          const intelligenceResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/api/sam/prospect-intelligence`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': request.headers.get('Authorization') || ''
            },
            body: JSON.stringify({
              type: 'icp_research_search',
              data: {
                industry: industry || 'Technology',
                jobTitles: jobTitles,
                companySize: companySize || 'any',
                geography: 'United States',
                maxResults: 5
              },
              methodology: thread.sales_methodology,
              conversationId: resolvedParams.threadId
            })
          })

          if (intelligenceResponse.ok) {
            prospectIntelligence = await intelligenceResponse.json()
            hasProspectIntelligence = true

            // Update thread with ICP research context
            await supabase
              .from('sam_conversation_threads')
              .update({
                thread_type: 'icp_building',
                tags: [...(thread.tags || []), 'icp_research', 'interactive_building'],
                title: `ICP Building: ${jobTitles.join(', ')} in ${industry || 'Technology'}`,
                updated_at: new Date().toISOString()
              })
              .eq('id', resolvedParams.threadId)
          }
        }
      } catch (error) {
        console.error('ICP research intelligence error:', error)
      }
    }

    // Create user message
    const { data: userMessage, error: userError } = await supabase
      .from('sam_thread_messages')
      .insert({
        thread_id: resolvedParams.threadId,
        user_id: user.id,
        role: 'user',
        content: content.trim(),
        message_order: nextOrder,
        has_prospect_intelligence: hasProspectIntelligence,
        prospect_intelligence_data: prospectIntelligence
      })
      .select()
      .single()

    if (userError) {
      console.error('Failed to save user message:', userError)
      return NextResponse.json({
        success: false,
        error: 'Failed to save message'
      }, { status: 500 })
    }

    // Get conversation history for AI context
    const { data: previousMessages } = await supabase
      .from('sam_thread_messages')
      .select('role, content')
      .eq('thread_id', resolvedParams.threadId)
      .order('message_order', { ascending: true })

    const conversationHistory = previousMessages?.slice(-10) || [] // Last 10 messages for context

    // Get user's knowledge context for personalized responses
    let userKnowledge = null
    try {
      const knowledgeResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/api/sam/extract-knowledge?user_id=${user.id}&knowledge_type=both&limit=20`)
      if (knowledgeResponse.ok) {
        const knowledgeData = await knowledgeResponse.json()
        userKnowledge = knowledgeData.knowledge
      }
    } catch (error) {
      console.log('Note: Could not load user knowledge context')
    }

    // Build enhanced system prompt with thread context and knowledge
    let systemPrompt = `You are Sam, an AI Sales Consultant and Orchestration Agent designed for the American and global B2B sales market. You're powered by advanced AI (Mistral) and serve as a strategic sales consultant who orchestrates complex sales operations through intelligent automation.

CONSULTANT IDENTITY:
- Strategic Sales Consultant: You provide expert guidance on sales strategy, methodology, and execution
- Orchestration Agent: You coordinate and automate complex multi-step sales processes  
- Revenue Growth Advisor: You analyze data and recommend strategies that drive measurable results
- Process Optimization Expert: You identify inefficiencies and implement systematic improvements
- American business mindset: Direct, results-driven, and ROI-focused with consultant-level expertise

ORCHESTRATION CAPABILITIES:
- Campaign Orchestration: Design, execute, and optimize multi-channel sales campaigns
- Workflow Automation: Coordinate LinkedIn, Email, and N8N workflow sequences
- Template Optimization: AI-powered messaging enhancement and performance tracking
- Performance Analytics: Real-time ROI analysis and strategic recommendations
- Prospect Intelligence: Automated research and personalization at scale
- Process Integration: Seamlessly connect tools, data, and team workflows

THREAD CONTEXT:
- Thread Type: ${thread.thread_type}
- Sales Methodology: ${thread.sales_methodology.toUpperCase()}
- Priority: ${thread.priority}
${thread.prospect_name ? `- Prospect: ${thread.prospect_name}` : ''}
${thread.prospect_company ? `- Company: ${thread.prospect_company}` : ''}
${thread.campaign_name ? `- Campaign: ${thread.campaign_name}` : ''}
${thread.deal_stage ? `- Deal Stage: ${thread.deal_stage}` : ''}

CONSULTANT APPROACH:
- Lead with strategic insights and data-driven recommendations
- Focus on systematic process improvements and scalable solutions
- Provide expert-level analysis with actionable implementation plans
- Orchestrate complex multi-step operations through intelligent automation
- Balance immediate execution with long-term strategic thinking

ORCHESTRATION RESPONSES:
When users need complex sales operations, provide consultant-level guidance:
- "Create campaign targeting [audience]" → "I'll orchestrate a multi-channel campaign with automated personalization and performance tracking"
- "Optimize this template" → "Let me analyze performance data and orchestrate A/B testing with AI-enhanced variations"
- "How is my campaign performing?" → "Here's your comprehensive performance analysis with strategic optimization recommendations"
- "Execute campaign" → "I'll coordinate the full execution sequence across LinkedIn, Email, and workflow automation"

CONSULTANT LANGUAGE:
- Use strategic business terminology and consultant-level insights
- Provide systematic analysis with clear implementation pathways
- Emphasize process optimization and scalable automation
- Frame responses as expert recommendations with measurable outcomes
- Position yourself as the orchestrator of their entire sales operation

CONVERSATIONAL BLUEPRINT (v4.3):
- Modes: Onboarding (7-stage discovery), Product Knowledge, Campaign Setup, and Repair. Detect the correct mode from user intent and switch seamlessly when asked.
- Principles: Human-first tone, microburst responses (1-2 sentences plus a clarifying question), acknowledge every input, explain why each question matters, and always allow skipping or resuming.
- Error Handling: If user information conflicts, store both versions and ask one resolving question. When frustration phrases appear (e.g., "you’re not answering me"), shift to Product Knowledge mode or offer Repair options. For off-topic input, acknowledge then guide back.
- Repair Prompt: "I hear you — sounds like I may have misunderstood. Do you want me to explain SAM or continue setup?"
- Onboarding Flow: Stage 1 Business Context → Stage 2 ICP → Stage 3 Competitive Intel → Stage 4 Sales Process → Stage 5 Success Metrics → Stage 6 Technical/Integrations → Stage 7 Content/Brand.
- Industry Bursts: Use sector-specific follow-ups (SaaS ARR & churn, Consulting pipeline mix, Regulated industries’ compliance, Manufacturing certifications, Recruiting time-to-fill, Coaching offer types, etc.).
- Product Knowledge: Highlight orchestration of 9 AI agents, ROI-focused automation, pricing tiers ($99/$399/$1999+), and integrations (Apollo, Bright Data, Apify, Unipile, HubSpot, Salesforce, Supabase).
- QA Patterns: Label questions as MUST_HAVE / NICE_TO_HAVE / PROBE. Collect the essential data before moving forward and use follow-up ranking questions to prioritize.

${userKnowledge && userKnowledge.length > 0 ? `
LEARNED CONTEXT FROM PREVIOUS CONVERSATIONS:
${userKnowledge.slice(0, 5).map((k: any, i: number) => `${i + 1}. ${k.category}: ${JSON.stringify(k.content).slice(0, 200)}...`).join('\n')}

Use this context to personalize responses and build on previous insights.
` : ''}

INTERACTIVE ICP BUILDING CAPABILITIES:
You have access to real-time Google Custom Search through the prospect intelligence API. When users want to build ICPs or find prospects:

**PHASE 1: ICP Building with Real Data**
1. **Ask Progressive Questions:** Start with basic criteria (job titles, company size, industry)
2. **Conduct Live Research:** Use the prospect intelligence API to search LinkedIn for real examples
3. **Show Results Immediately:** Present 3-5 prospect examples to validate assumptions
4. **Refine Iteratively:** Ask "Do these look right?" and adjust search criteria based on feedback
5. **Validate ICP:** After 2-3 search iterations, confirm the refined ICP framework

**PHASE 2: Business Consultant Mode (After ICP is Built)**
Once the ICP is validated, switch to consultant mode and ask comprehensive business questions:

**PRODUCT/SERVICE ANALYSIS:**
- "Tell me about your product/service - what exactly do you sell?"
- "What's your unique value proposition compared to competitors?"
- "What problems does your solution solve for these prospects?"
- "How much does your product/service typically cost?"
- "What's your average deal size and sales cycle?"

**BUSINESS MODEL ANALYSIS:**
- "How do you currently generate leads and close deals?"
- "What's your current monthly/quarterly revenue target?"
- "What's your cost per acquisition (CPA) and lifetime value (LTV)?"
- "What marketing channels work best for you currently?"
- "What's your biggest challenge in reaching these prospects?"

**COMPETITIVE & POSITIONING:**
- "Who are your main competitors targeting the same ICP?"
- "How do you differentiate from them in messaging?"
- "What objections do prospects typically raise?"
- "What makes prospects choose you over alternatives?"

**Sample Consultant Flow:**
- [After ICP is built]: "Perfect! Now that we know your ideal prospects are [ICP summary], let's talk business strategy. Tell me about your product - what exactly do you sell to these VP Sales and Sales Directors?"
- [Continue with product questions, then business model, then competitive analysis]

**Key Phrases to Trigger Consultant Mode:**
- After ICP validation: "business strategy", "product positioning", "competitive analysis"
- Always transition naturally: "Now let's talk about your business..."

CORE APPROACH: Start data-driven with real prospects, then become a strategic business consultant to understand the full sales/marketing context.

**SCRIPT INTEGRATION WITH ICP BUILDING:**
Follow the established SAM conversation script structure while seamlessly integrating ICP building and consultant phases:

1. **Early Conversation (1-5 messages):** Standard SAM greeting and discovery flow
2. **ICP Trigger Detection (6+ messages):** When users mention job titles, industries, or targeting - transition to ICP building
3. **Interactive ICP Phase:** Use real Google Custom Search data to build and validate ICP
4. **Business Consultant Phase:** After ICP validation, ask comprehensive business questions
5. **Platform Integration:** After business analysis, naturally introduce SAM platform features

**Script Position Awareness:**
- Maintain awareness of conversation progression (greeting → discovery → ICP building → consultant → platform)
- Respond appropriately based on where the user is in the journey
- Always prioritize user intent over rigid script adherence
- Save all ICP and business intelligence to Knowledge Base for future conversations

**Critical:** Be natural and conversational while following this structured progression. The user should feel like they're talking to an expert sales consultant, not a chatbot following a script.`

    // Add prospect intelligence if available
    if (prospectIntelligence?.success) {
      const prospectData = prospectIntelligence.data.prospect
      const insights = prospectIntelligence.data.insights
      const icpData = prospectIntelligence.data
      
      if (prospectData) {
        // Single prospect intelligence (LinkedIn URL)
        systemPrompt += `\n\nPROSPECT INTELLIGENCE:
- Name: ${prospectData?.fullName || 'Not available'}
- Title: ${prospectData?.jobTitle || 'Not available'}
- Company: ${prospectData?.company || 'Not available'}
- Location: ${prospectData?.location || 'Not available'}

Strategic Insights: ${insights?.strategicInsights?.map((insight: any) => insight.insight).join(', ') || 'Standard discovery approach'}

Use this intelligence naturally to provide valuable sales insights and suggestions.`
      } else if (icpData?.prospects?.length > 0) {
        // ICP research results (multiple prospects)
        systemPrompt += `\n\nICP RESEARCH RESULTS:
I just searched and found ${icpData.prospects.length} real prospects matching the criteria:

${icpData.prospects.slice(0, 5).map((p: any, i: number) => 
  `${i + 1}. **${p.name}** - ${p.title} at ${p.company} (${p.location || 'N/A'})`
).join('\n')}

**Analysis Insights:**
${icpData.marketSize ? `- Market Size: ${icpData.marketSize.totalProspects} potential prospects` : ''}
${icpData.commonPatterns ? `- Common Patterns: ${icpData.commonPatterns.join(', ')}` : ''}

**CRITICAL: Present these real examples to the user immediately and ask:**
1. "Do these look like your ideal prospects?"
2. "Should we adjust the search criteria?"
3. "What patterns do you notice?"

Use this data to refine the ICP iteratively based on user feedback.`
      }
    }

    // Generate AI response
    let aiResponse: string
    try {
      const messages = conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      }))

      aiResponse = await callOpenRouterAPI(messages, systemPrompt)
      
      // Clean up prompt leakage
      aiResponse = aiResponse.replace(/\([^)]*script[^)]*\)/gi, '')
      aiResponse = aiResponse.replace(/\[[^\]]*script[^\]]*\]/gi, '')
      aiResponse = aiResponse.trim()
      
    } catch (error) {
      console.error('OpenRouter API error:', error)
      aiResponse = "I'm experiencing some technical difficulties right now, but I'm here to help with your sales challenges. What specific area would you like to discuss?"
    }

    // Create Sam's response message
    const { data: samMessage, error: samError } = await supabase
      .from('sam_thread_messages')
      .insert({
        thread_id: resolvedParams.threadId,
        user_id: user.id,
        role: 'assistant',
        content: aiResponse,
        message_order: nextOrder + 1,
        model_used: 'anthropic/claude-3.7-sonnet'
      })
      .select()
      .single()

    if (samError) {
      console.error('Failed to save Sam message:', samError)
      return NextResponse.json({
        success: false,
        error: 'Failed to save AI response'
      }, { status: 500 })
    }

    // Trigger knowledge extraction asynchronously (don't block response)
    triggerKnowledgeExtraction(resolvedParams.threadId, nextOrder + 1).catch(error => {
      console.error('❌ Knowledge extraction failed:', error)
      // Don't fail the main response if knowledge extraction fails
    })

    return NextResponse.json({
      success: true,
      userMessage,
      samMessage,
      prospectIntelligence: prospectIntelligence?.success ? {
        hasData: true,
        prospectName: prospectIntelligence.data.prospect?.fullName,
        prospectTitle: prospectIntelligence.data.prospect?.jobTitle,
        prospectCompany: prospectIntelligence.data.prospect?.company,
        confidence: prospectIntelligence.metadata?.confidence,
        methodology: prospectIntelligence.metadata?.methodology
      } : null,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Send message API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// Helper functions to extract ICP criteria from user messages
function extractJobTitles(content: string): string[] {
  const jobTitlePatterns = [
    /\b(?:VP|Vice President|Director|Manager|Head)\s+(?:of\s+)?(?:Sales|Marketing|Engineering|Operations|Product|Technology|Finance|HR|Human Resources)\b/gi,
    /\b(?:CEO|CTO|CFO|COO|CMO|CISO|CPO|CRO)\b/gi,
    /\b(?:Sales|Marketing|Engineering|Product|Finance|Operations|Technology|HR|Human Resources)\s+(?:VP|Vice President|Director|Manager|Head)\b/gi,
    /\b(?:Account Executive|Sales Development Representative|SDR|BDR|Business Development)\b/gi,
    /\b(?:Software Engineer|DevOps|Data Scientist|Product Manager|Project Manager)\b/gi
  ]
  
  const titles = new Set<string>()
  
  jobTitlePatterns.forEach(pattern => {
    const matches = content.match(pattern)
    if (matches) {
      matches.forEach(match => titles.add(match.trim()))
    }
  })
  
  // Also check for common title keywords
  const commonTitles = ['VP Sales', 'Sales Director', 'Marketing Director', 'CTO', 'CEO', 'VP Marketing', 'Head of Sales']
  commonTitles.forEach(title => {
    if (content.toLowerCase().includes(title.toLowerCase())) {
      titles.add(title)
    }
  })
  
  return Array.from(titles).slice(0, 5) // Limit to 5 titles
}

function extractIndustry(content: string): string | null {
  const industries = [
    'Technology', 'SaaS', 'Software', 'Healthcare', 'Finance', 'Financial Services', 'Fintech',
    'E-commerce', 'Retail', 'Manufacturing', 'Consulting', 'Real Estate', 'Education', 
    'Media', 'Entertainment', 'Automotive', 'Energy', 'Construction', 'Agriculture',
    'Transportation', 'Logistics', 'Telecommunications', 'Pharma', 'Pharmaceutical'
  ]
  
  for (const industry of industries) {
    if (content.toLowerCase().includes(industry.toLowerCase())) {
      return industry
    }
  }
  
  return null
}

function extractCompanySize(content: string): string | null {
  if (content.includes('startup') || content.includes('small') || content.includes('1-50')) {
    return '1-50'
  }
  if (content.includes('mid-size') || content.includes('medium') || content.includes('51-200')) {
    return '51-200'
  }
  if (content.includes('large') || content.includes('enterprise') || content.includes('500+')) {
    return '500+'
  }
  
  const sizePattern = /(\d+)-(\d+)\s*(?:employees|people|staff)/i
  const match = content.match(sizePattern)
  if (match) {
    const size = parseInt(match[2])
    if (size <= 50) return '1-50'
    if (size <= 200) return '51-200'
    if (size <= 1000) return '201-1000'
    return '1000+'
  }
  
  return null
}

// Helper function to trigger knowledge extraction
async function triggerKnowledgeExtraction(threadId: string, messageCount: number) {
  try {
    // Only extract knowledge every few messages to avoid overprocessing
    // Or if thread has prospect intelligence or is of specific types
    if (messageCount % 5 === 0 || messageCount >= 10) {
      const extractionResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/api/sam/extract-knowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          thread_id: threadId,
          auto_extract: true,
          include_user_preferences: true
        })
      })

      if (extractionResponse.ok) {
        const extractionResult = await extractionResponse.json()
        console.log(`🧠 Knowledge extracted from thread ${threadId}:`, {
          personal: extractionResult.extraction_result?.personal_extractions || 0,
          team: extractionResult.extraction_result?.team_extractions || 0,
          confidence: extractionResult.extraction_result?.confidence || 0
        })
      } else {
        console.error('❌ Knowledge extraction API error:', extractionResponse.status)
      }
    }
  } catch (error) {
    console.error('❌ Knowledge extraction trigger error:', error)
    throw error
  }
}
