import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

// API to extract knowledge from threaded conversations and feed into KB
export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseAdmin()
    const body = await request.json()
    
    const { 
      thread_id, 
      auto_extract = true, 
      include_user_preferences = true 
    } = body

    if (!thread_id) {
      return NextResponse.json({
        success: false,
        error: 'Thread ID required'
      }, { status: 400 })
    }

    console.log(`🧠 Extracting knowledge from thread: ${thread_id}`)

    // Get thread and messages
    const { data: thread } = await supabase
      .from('sam_conversation_threads')
      .select('*')
      .eq('id', thread_id)
      .single()

    if (!thread) {
      return NextResponse.json({
        success: false,
        error: 'Thread not found'
      }, { status: 404 })
    }

    // Get all messages in the thread
    const { data: messages } = await supabase
      .from('sam_thread_messages')
      .select('*')
      .eq('thread_id', thread_id)
      .order('message_order', { ascending: true })

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No messages found in thread'
      }, { status: 404 })
    }

    // Combine all conversation text
    const conversationText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n')

    // Get user privacy preferences
    let privacyPrefs = null
    if (include_user_preferences) {
      const { data: prefs } = await supabase
        .from('sam_user_privacy_preferences')
        .select('*')
        .eq('user_id', thread.user_id)
        .single()
      privacyPrefs = prefs
    }

    // Extract knowledge using the existing function
    const { data: extractionResult, error: extractionError } = await supabase
      .rpc('extract_knowledge_from_thread', {
        p_thread_id: thread_id,
        p_conversation_text: conversationText,
        p_user_context: {
          thread_type: thread.thread_type,
          prospect_name: thread.prospect_name,
          prospect_company: thread.prospect_company,
          tags: thread.tags,
          sales_methodology: thread.sales_methodology,
          deal_stage: thread.deal_stage,
          priority: thread.priority
        }
      })

    if (extractionError) {
      console.error('❌ Knowledge extraction failed:', extractionError)
      return NextResponse.json({
        success: false,
        error: 'Knowledge extraction failed',
        details: extractionError.message
      }, { status: 500 })
    }

    // Also update the main knowledge_base with key insights
    if (extractionResult?.team_extractions > 0) {
      const teamInsights = await extractTeamInsights(supabase, thread, messages)
      if (teamInsights.length > 0) {
        await updateGlobalKnowledgeBase(supabase, teamInsights, thread)
      }
    }

    console.log(`✅ Knowledge extraction completed for thread ${thread_id}`)
    
    return NextResponse.json({
      success: true,
      thread_id,
      extraction_result: extractionResult,
      conversation_length: messages.length,
      privacy_preferences: privacyPrefs ? {
        auto_extraction: privacyPrefs.auto_knowledge_extraction,
        requires_confirmation: privacyPrefs.require_extraction_confirmation
      } : null,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error in knowledge extraction:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET method to retrieve extracted knowledge for a user/thread
export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseAdmin()
    const { searchParams } = new URL(request.url)
    
    const user_id = searchParams.get('user_id')
    const thread_id = searchParams.get('thread_id')
    const knowledge_type = searchParams.get('knowledge_type') || 'both'
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!user_id) {
      return NextResponse.json({
        success: false,
        error: 'User ID required'
      }, { status: 400 })
    }

    let query = supabase
      .from('sam_extracted_knowledge')
      .select('*')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (thread_id) {
      query = query.eq('conversation_id', thread_id)
    }

    if (knowledge_type !== 'both') {
      query = query.eq('knowledge_type', knowledge_type)
    }

    const { data: knowledge } = await query

    return NextResponse.json({
      success: true,
      knowledge: knowledge || [],
      count: knowledge?.length || 0,
      filters: {
        user_id,
        thread_id,
        knowledge_type,
        limit
      }
    })

  } catch (error) {
    console.error('❌ Error retrieving knowledge:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper function to extract team-level insights
async function extractTeamInsights(supabase: any, thread: any, messages: any[]) {
  const insights = []
  
  // Extract ICP building insights
  const icpInsights = extractICPInsights(messages)
  if (icpInsights.jobTitles.length > 0 || icpInsights.industries.length > 0) {
    insights.push({
      category: 'icp_intelligence',
      subcategory: 'target_profiles',
      content: {
        job_titles: icpInsights.jobTitles,
        industries: icpInsights.industries,
        company_sizes: icpInsights.companySizes,
        geographic_focus: icpInsights.geography,
        research_validated: true,
        thread_type: thread.thread_type
      },
      confidence: 0.9
    })
  }

  // Extract business intelligence from consultant questions
  const businessInsights = extractBusinessInsights(messages)
  if (businessInsights.product || businessInsights.pricing || businessInsights.competitive) {
    insights.push({
      category: 'business_intelligence',
      subcategory: 'company_profile',
      content: {
        product_service: businessInsights.product,
        value_proposition: businessInsights.valueProposition,
        pricing_model: businessInsights.pricing,
        deal_size: businessInsights.dealSize,
        sales_cycle: businessInsights.salesCycle,
        competitive_landscape: businessInsights.competitive,
        main_challenges: businessInsights.challenges
      },
      confidence: 0.8
    })
  }
  
  // Extract prospect intelligence
  if (thread.prospect_name && thread.prospect_company) {
    const prospectData = {
      name: thread.prospect_name,
      company: thread.prospect_company,
      linkedin_url: thread.prospect_linkedin_url,
      conversation_themes: extractConversationThemes(messages),
      pain_points: extractPainPoints(messages),
      interests: extractInterests(messages)
    }
    
    insights.push({
      category: 'prospect_intelligence',
      subcategory: 'contact_profile',
      content: prospectData,
      confidence: 0.8
    })
  }

  // Extract sales methodology insights
  if (thread.sales_methodology && thread.deal_stage) {
    const salesData = {
      methodology: thread.sales_methodology,
      current_stage: thread.deal_stage,
      progression_signals: extractProgressionSignals(messages),
      objections_handled: extractObjections(messages)
    }
    
    insights.push({
      category: 'sales_intelligence',
      subcategory: 'methodology_insights',
      content: salesData,
      confidence: 0.7
    })
  }

  return insights
}

// Helper function to update global knowledge base
async function updateGlobalKnowledgeBase(supabase: any, insights: any[], thread: any) {
  for (const insight of insights) {
    const title = `${insight.category}: ${thread.prospect_company || 'Prospect'} - ${insight.subcategory}`
    const content = JSON.stringify(insight.content, null, 2)
    
    await supabase
      .from('knowledge_base')
      .upsert({
        category: 'conversational-design',
        subcategory: insight.category,
        title,
        content: `Thread ID: ${thread.id}\n\nInsights:\n${content}`,
        tags: [
          insight.category,
          insight.subcategory,
          thread.thread_type,
          ...(thread.tags || [])
        ],
        version: '4.4'
      })
  }
}

// Helper functions for content analysis
function extractConversationThemes(messages: any[]): string[] {
  const themes = new Set<string>()
  const userMessages = messages.filter(m => m.role === 'user')
  
  userMessages.forEach(msg => {
    const content = msg.content.toLowerCase()
    
    // Common business themes
    if (content.includes('budget') || content.includes('cost')) themes.add('budget_concerns')
    if (content.includes('timeline') || content.includes('deadline')) themes.add('timeline_pressure')
    if (content.includes('team') || content.includes('stakeholder')) themes.add('team_dynamics')
    if (content.includes('integration') || content.includes('technical')) themes.add('technical_requirements')
    if (content.includes('roi') || content.includes('value')) themes.add('value_proposition')
  })
  
  return Array.from(themes)
}

function extractPainPoints(messages: any[]): string[] {
  const painPoints = []
  const userMessages = messages.filter(m => m.role === 'user')
  
  userMessages.forEach(msg => {
    const content = msg.content.toLowerCase()
    
    // Common pain point indicators
    if (content.includes('problem') || content.includes('issue') || content.includes('challenge')) {
      // Extract the sentence containing the pain point
      const sentences = msg.content.split('.')
      sentences.forEach(sentence => {
        if (sentence.toLowerCase().includes('problem') || 
            sentence.toLowerCase().includes('issue') || 
            sentence.toLowerCase().includes('challenge')) {
          painPoints.push(sentence.trim())
        }
      })
    }
  })
  
  return painPoints.slice(0, 5) // Limit to top 5
}

function extractInterests(messages: any[]): string[] {
  const interests = new Set<string>()
  const userMessages = messages.filter(m => m.role === 'user')
  
  userMessages.forEach(msg => {
    const content = msg.content.toLowerCase()
    
    // Interest indicators
    if (content.includes('interested') || content.includes('like') || content.includes('want')) {
      if (content.includes('automation')) interests.add('automation')
      if (content.includes('analytics') || content.includes('reporting')) interests.add('analytics')
      if (content.includes('integration')) interests.add('integrations')
      if (content.includes('scale') || content.includes('growth')) interests.add('scalability')
      if (content.includes('efficiency')) interests.add('efficiency')
    }
  })
  
  return Array.from(interests)
}

function extractProgressionSignals(messages: any[]): string[] {
  const signals = []
  const userMessages = messages.filter(m => m.role === 'user')
  
  userMessages.forEach(msg => {
    const content = msg.content.toLowerCase()
    
    // Positive progression signals
    if (content.includes('next step') || content.includes('move forward')) {
      signals.push('ready_to_proceed')
    }
    if (content.includes('demo') || content.includes('presentation')) {
      signals.push('wants_demo')
    }
    if (content.includes('pricing') || content.includes('cost')) {
      signals.push('pricing_inquiry')
    }
    if (content.includes('team') || content.includes('colleague')) {
      signals.push('involving_stakeholders')
    }
  })
  
  return signals
}

function extractObjections(messages: any[]): string[] {
  const objections = []
  const userMessages = messages.filter(m => m.role === 'user')
  
  userMessages.forEach(msg => {
    const content = msg.content.toLowerCase()
    
    // Common objection patterns
    if (content.includes('but ') || content.includes('however ') || content.includes('concern')) {
      // Extract objection context
      const sentences = msg.content.split('.')
      sentences.forEach(sentence => {
        if (sentence.toLowerCase().includes('but ') || 
            sentence.toLowerCase().includes('however ') || 
            sentence.toLowerCase().includes('concern')) {
          objections.push(sentence.trim())
        }
      })
    }
  })
  
  return objections.slice(0, 3) // Limit to top 3
}

// Extract ICP building insights from conversation
function extractICPInsights(messages: any[]): any {
  const userMessages = messages.filter(m => m.role === 'user')
  const allContent = messages.map(m => m.content).join(' ')
  
  const jobTitles = new Set<string>()
  const industries = new Set<string>()
  const companySizes = new Set<string>()
  const geography = new Set<string>()
  
  // Extract job titles
  const jobTitlePatterns = [
    /\b(?:VP|Vice President|Director|Manager|Head)\s+(?:of\s+)?(?:Sales|Marketing|Engineering|Operations|Product|Technology|Finance|HR)\b/gi,
    /\b(?:CEO|CTO|CFO|COO|CMO|CISO|CPO|CRO)\b/gi,
    /\b(?:Account Executive|Sales Development|Product Manager)\b/gi
  ]
  
  jobTitlePatterns.forEach(pattern => {
    const matches = allContent.match(pattern)
    if (matches) {
      matches.forEach(match => jobTitles.add(match.trim()))
    }
  })
  
  // Extract industries
  const industryKeywords = ['Technology', 'SaaS', 'Software', 'Healthcare', 'Finance', 'Manufacturing', 'E-commerce', 'Consulting']
  industryKeywords.forEach(industry => {
    if (allContent.toLowerCase().includes(industry.toLowerCase())) {
      industries.add(industry)
    }
  })
  
  // Extract company sizes
  const sizePatterns = ['startup', 'small', '1-50', 'mid-size', '51-200', 'large', 'enterprise', '500+']
  sizePatterns.forEach(size => {
    if (allContent.toLowerCase().includes(size)) {
      companySizes.add(size)
    }
  })
  
  // Extract geography
  const geoKeywords = ['United States', 'North America', 'Europe', 'Asia', 'Global', 'Remote']
  geoKeywords.forEach(geo => {
    if (allContent.includes(geo)) {
      geography.add(geo)
    }
  })
  
  return {
    jobTitles: Array.from(jobTitles),
    industries: Array.from(industries),
    companySizes: Array.from(companySizes),
    geography: Array.from(geography)
  }
}

// Extract business intelligence from consultant conversations
function extractBusinessInsights(messages: any[]): any {
  const userMessages = messages.filter(m => m.role === 'user')
  const allContent = messages.map(m => m.content).join(' ')
  
  const insights = {
    product: null,
    valueProposition: null,
    pricing: null,
    dealSize: null,
    salesCycle: null,
    competitive: [],
    challenges: []
  }
  
  // Extract product/service mentions
  if (allContent.includes('we sell') || allContent.includes('our product') || allContent.includes('our service')) {
    const productMentions = userMessages.filter(msg => 
      msg.content.toLowerCase().includes('sell') || 
      msg.content.toLowerCase().includes('product') ||
      msg.content.toLowerCase().includes('service')
    )
    if (productMentions.length > 0) {
      insights.product = productMentions[0].content.slice(0, 500)
    }
  }
  
  // Extract pricing information
  const pricingPatterns = [/\$[\d,]+ per/, /\$[\d,]+ monthly/, /\$[\d,]+ annually/, /costs? \$[\d,]+/]
  pricingPatterns.forEach(pattern => {
    const match = allContent.match(pattern)
    if (match) {
      insights.pricing = match[0]
    }
  })
  
  // Extract deal size
  const dealSizePatterns = [/deal size.*\$[\d,]+/i, /average.*\$[\d,]+/i, /typically.*\$[\d,]+/i]
  dealSizePatterns.forEach(pattern => {
    const match = allContent.match(pattern)
    if (match) {
      insights.dealSize = match[0]
    }
  })
  
  // Extract sales cycle
  const salesCyclePatterns = [/\d+ days?/, /\d+ weeks?/, /\d+ months?/]
  if (allContent.includes('sales cycle') || allContent.includes('time to close')) {
    salesCyclePatterns.forEach(pattern => {
      const match = allContent.match(pattern)
      if (match) {
        insights.salesCycle = match[0]
      }
    })
  }
  
  // Extract competitive mentions
  const competitorKeywords = ['competitor', 'compete', 'vs ', 'alternative', 'compared to']
  competitorKeywords.forEach(keyword => {
    if (allContent.toLowerCase().includes(keyword)) {
      const competitiveMentions = userMessages.filter(msg => 
        msg.content.toLowerCase().includes(keyword)
      )
      insights.competitive.push(...competitiveMentions.map(m => m.content.slice(0, 200)))
    }
  })
  
  // Extract challenges
  const challengeKeywords = ['challenge', 'problem', 'difficult', 'struggle', 'issue']
  challengeKeywords.forEach(keyword => {
    if (allContent.toLowerCase().includes(keyword)) {
      const challengeMentions = userMessages.filter(msg => 
        msg.content.toLowerCase().includes(keyword)
      )
      insights.challenges.push(...challengeMentions.map(m => m.content.slice(0, 200)))
    }
  })
  
  return insights
}