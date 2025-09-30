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
      .from('sam_conversation_messages')
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

    // NEW: Auto-populate ICP categories from conversation data
    await autoPopulateICPCategories(supabase, thread, messages)

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
    const workspaceId = thread.workspace_id ?? null

    await supabase
      .from('knowledge_base')
      .upsert({
        workspace_id: workspaceId,
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

// NEW: Auto-populate ICP categories from SAM conversation data
async function autoPopulateICPCategories(supabase: any, thread: any, messages: any[]) {
  try {
    console.log(`🎯 Auto-populating ICP categories from thread: ${thread.id}`)
    
    // Get workspace ID from thread
    const { data: workspace } = await supabase
      .from('sam_conversation_threads')
      .select('workspace_id')
      .eq('id', thread.id)
      .single()

    if (!workspace?.workspace_id) {
      console.log('❌ No workspace found for thread')
      return
    }

    const workspaceId = workspace.workspace_id

    // Extract comprehensive ICP data from conversation
    const icpData = extractComprehensiveICPData(messages, thread)
    
    // Always create the structure even if some categories are empty
    const completeICPData = ensureCompleteICPStructure(icpData, thread)

    // Find existing ICP configuration or create new one
    let { data: existingICP } = await supabase
      .from('icp_configurations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('icp_name', 'Conversation Intelligence')
      .single()

    if (existingICP) {
      // Update existing ICP with new data
      console.log(`📝 Updating existing ICP configuration: ${existingICP.id}`)
      
      const updatedData = mergeICPData(existingICP, completeICPData)
      
      await supabase
        .from('icp_configurations')
        .update(updatedData)
        .eq('id', existingICP.id)
        
      console.log(`✅ Updated ICP configuration with conversation intelligence`)
    } else {
      // Create new ICP configuration
      console.log(`🆕 Creating new ICP configuration from conversation`)
      
      const { data: newICP, error: createError } = await supabase
        .from('icp_configurations')
        .insert({
          workspace_id: workspaceId,
          icp_name: 'Conversation Intelligence',
          overview: completeICPData.overview,
          target_profile: completeICPData.target_profile,
          decision_makers: completeICPData.decision_makers,
          pain_points: completeICPData.pain_points,
          buying_process: completeICPData.buying_process,
          messaging: completeICPData.messaging,
          success_metrics: completeICPData.success_metrics,
          advanced: completeICPData.advanced
        })
        .select()
        .single()

      if (createError) {
        console.error('❌ Failed to create ICP configuration:', createError)
        return
      }

      console.log(`✅ Created new ICP configuration: ${newICP.id}`)
    }

  } catch (error) {
    console.error('❌ Error in autoPopulateICPCategories:', error)
  }
}

// Extract comprehensive ICP data from conversation
function extractComprehensiveICPData(messages: any[], thread: any): any {
  const userMessages = messages.filter(m => m.role === 'user')
  const allContent = messages.map(m => m.content).join('\n')
  
  const icpData: any = {}

  // 1. OVERVIEW - Extract ICP summary and key metrics
  if (thread.prospect_name || thread.prospect_company) {
    icpData.overview = {
      profile_name: thread.prospect_company || 'Prospect Profile',
      last_updated: new Date().toISOString(),
      conversation_source: thread.id,
      key_characteristics: extractKeyCharacteristics(allContent),
      engagement_quality: calculateEngagementQuality(messages),
      conversation_themes: extractConversationThemes(messages)
    }
  }

  // 2. TARGET PROFILE - Company size, industry, geography, technology
  const targetProfile = extractTargetProfile(allContent, thread)
  if (Object.keys(targetProfile).length > 0) {
    icpData.target_profile = targetProfile
  }

  // 3. DECISION MAKERS - Authority levels, influence patterns, stakeholder hierarchies
  const decisionMakers = extractDecisionMakers(allContent, thread)
  if (Object.keys(decisionMakers).length > 0) {
    icpData.decision_makers = decisionMakers
  }

  // 4. PAIN POINTS & SIGNALS - Operational challenges, buying signals, growth pressures
  const painPoints = extractPainPointsAndSignals(allContent, messages)
  if (Object.keys(painPoints).length > 0) {
    icpData.pain_points = painPoints
  }

  // 5. BUYING PROCESS - Stakeholder analysis, approval workflows, evaluation stages
  const buyingProcess = extractBuyingProcess(allContent, messages, thread)
  if (Object.keys(buyingProcess).length > 0) {
    icpData.buying_process = buyingProcess
  }

  // 6. MESSAGING STRATEGY - Value propositions, competitive positioning, role-based communication
  const messaging = extractMessagingStrategy(allContent, messages)
  if (Object.keys(messaging).length > 0) {
    icpData.messaging = messaging
  }

  // 7. SUCCESS METRICS - Industry KPIs, ROI models, performance benchmarks
  const successMetrics = extractSuccessMetrics(allContent, messages)
  if (Object.keys(successMetrics).length > 0) {
    icpData.success_metrics = successMetrics
  }

  // 8. ADVANCED CLASSIFICATION - Technology adoption, compliance, market trends, culture
  const advanced = extractAdvancedClassification(allContent, thread)
  if (Object.keys(advanced).length > 0) {
    icpData.advanced = advanced
  }

  return icpData
}

// Ensure complete ICP structure with all subcategories, even if data is sparse
function ensureCompleteICPStructure(icpData: any, thread: any): any {
  const timestamp = new Date().toISOString()
  const conversationId = thread.id
  
  return {
    // 1. OVERVIEW - Always create with basic conversation metadata
    overview: {
      profile_name: icpData.overview?.profile_name || thread.prospect_company || 'Conversation Profile',
      last_updated: timestamp,
      conversation_source: conversationId,
      key_characteristics: icpData.overview?.key_characteristics || [],
      engagement_quality: icpData.overview?.engagement_quality || 'Unknown',
      conversation_themes: icpData.overview?.conversation_themes || [],
      conversation_count: 1,
      data_completeness: calculateDataCompleteness(icpData),
      subcategories: {
        'profile_summary': icpData.overview?.profile_summary || 'Auto-generated from conversation',
        'engagement_metrics': icpData.overview?.engagement_metrics || { quality: 'Unknown', message_count: 0 },
        'conversation_history': icpData.overview?.conversation_history || [{ id: conversationId, date: timestamp }]
      }
    },

    // 2. TARGET PROFILE - Company demographics and characteristics  
    target_profile: {
      company_size: icpData.target_profile?.company_size || [],
      industries: icpData.target_profile?.industries || [],
      geographic_focus: icpData.target_profile?.geographic_focus || [],
      technology_stack: icpData.target_profile?.technology_stack || [],
      company_stage: icpData.target_profile?.company_stage || 'Unknown',
      revenue_range: icpData.target_profile?.revenue_range || 'Unknown',
      subcategories: {
        'demographics': icpData.target_profile?.demographics || { size: 'Unknown', stage: 'Unknown' },
        'industry_focus': icpData.target_profile?.industry_focus || { primary: [], secondary: [] },
        'geographic_markets': icpData.target_profile?.geographic_markets || { primary: [], expansion: [] },
        'technology_requirements': icpData.target_profile?.technology_requirements || { required: [], preferred: [] }
      }
    },

    // 3. DECISION MAKERS - Authority levels and stakeholder analysis
    decision_makers: {
      identified_roles: icpData.decision_makers?.identified_roles || [],
      authority_level: icpData.decision_makers?.authority_level || [],
      primary_contact: icpData.decision_makers?.primary_contact || {
        name: thread.prospect_name || 'Unknown',
        company: thread.prospect_company || 'Unknown',
        engagement_level: 'Unknown'
      },
      stakeholder_map: icpData.decision_makers?.stakeholder_map || {},
      subcategories: {
        'executive_level': icpData.decision_makers?.executive_level || { identified: [], authority: 'Unknown' },
        'operational_level': icpData.decision_makers?.operational_level || { identified: [], influence: 'Unknown' },
        'technical_stakeholders': icpData.decision_makers?.technical_stakeholders || { identified: [], involvement: 'Unknown' },
        'purchasing_authority': icpData.decision_makers?.purchasing_authority || { budget_holders: [], approval_process: 'Unknown' }
      }
    },

    // 4. PAIN POINTS & SIGNALS - Challenges and buying indicators
    pain_points: {
      operational_challenges: icpData.pain_points?.operational_challenges || [],
      buying_signals: icpData.pain_points?.buying_signals || [],
      growth_pressures: icpData.pain_points?.growth_pressures || [],
      urgency_indicators: icpData.pain_points?.urgency_indicators || [],
      subcategories: {
        'current_challenges': icpData.pain_points?.current_challenges || { operational: [], technical: [], business: [] },
        'buying_indicators': icpData.pain_points?.buying_indicators || { budget: false, timeline: false, authority: false },
        'competitive_pressures': icpData.pain_points?.competitive_pressures || { mentions: [], urgency: 'Unknown' },
        'growth_initiatives': icpData.pain_points?.growth_initiatives || { scaling: [], efficiency: [], expansion: [] }
      }
    },

    // 5. BUYING PROCESS - Purchase workflow and evaluation stages
    buying_process: {
      evaluation_stages: icpData.buying_process?.evaluation_stages || [],
      timeline: icpData.buying_process?.timeline || [],
      stakeholder_involvement: icpData.buying_process?.stakeholder_involvement || [],
      decision_criteria: icpData.buying_process?.decision_criteria || [],
      subcategories: {
        'evaluation_framework': icpData.buying_process?.evaluation_framework || { stages: [], criteria: [] },
        'approval_workflow': icpData.buying_process?.approval_workflow || { steps: [], stakeholders: [] },
        'vendor_evaluation': icpData.buying_process?.vendor_evaluation || { process: 'Unknown', criteria: [] },
        'implementation_planning': icpData.buying_process?.implementation_planning || { timeline: 'Unknown', requirements: [] }
      }
    },

    // 6. MESSAGING STRATEGY - Communication and positioning
    messaging: {
      value_propositions: icpData.messaging?.value_propositions || [],
      communication_preferences: icpData.messaging?.communication_preferences || [],
      competitive_mentions: icpData.messaging?.competitive_mentions || [],
      effective_messaging: icpData.messaging?.effective_messaging || [],
      subcategories: {
        'value_messaging': icpData.messaging?.value_messaging || { primary: [], secondary: [], proof_points: [] },
        'communication_style': icpData.messaging?.communication_style || { preference: 'Unknown', tone: 'Unknown' },
        'competitive_positioning': icpData.messaging?.competitive_positioning || { differentiators: [], objections: [] },
        'channel_preferences': icpData.messaging?.channel_preferences || { email: 'Unknown', linkedin: 'Unknown', phone: 'Unknown' }
      }
    },

    // 7. SUCCESS METRICS - KPIs and performance indicators
    success_metrics: {
      relevant_kpis: icpData.success_metrics?.relevant_kpis || [],
      performance_benchmarks: icpData.success_metrics?.performance_benchmarks || [],
      success_timeline: icpData.success_metrics?.success_timeline || [],
      roi_expectations: icpData.success_metrics?.roi_expectations || 'Unknown',
      subcategories: {
        'business_metrics': icpData.success_metrics?.business_metrics || { revenue: [], efficiency: [], growth: [] },
        'operational_kpis': icpData.success_metrics?.operational_kpis || { productivity: [], quality: [], cost: [] },
        'success_timeline': icpData.success_metrics?.success_timeline || { immediate: [], short_term: [], long_term: [] },
        'roi_framework': icpData.success_metrics?.roi_framework || { calculation: 'Unknown', timeline: 'Unknown', benchmarks: [] }
      }
    },

    // 8. ADVANCED CLASSIFICATION - Technology adoption and market trends
    advanced: {
      technology_adoption: icpData.advanced?.technology_adoption || [],
      compliance_requirements: icpData.advanced?.compliance_requirements || [],
      market_trends: icpData.advanced?.market_trends || [],
      company_culture: icpData.advanced?.company_culture || [],
      innovation_readiness: icpData.advanced?.innovation_readiness || 'Unknown',
      subcategories: {
        'tech_maturity': icpData.advanced?.tech_maturity || { adoption_stage: 'Unknown', innovation_appetite: 'Unknown' },
        'compliance_framework': icpData.advanced?.compliance_framework || { requirements: [], readiness: 'Unknown' },
        'market_positioning': icpData.advanced?.market_positioning || { trends: [], competitive_landscape: 'Unknown' },
        'organizational_culture': icpData.advanced?.organizational_culture || { values: [], decision_style: 'Unknown' }
      }
    }
  }
}

// Calculate data completeness percentage
function calculateDataCompleteness(icpData: any): number {
  const totalCategories = 8
  let populatedCategories = 0
  
  const categories = ['overview', 'target_profile', 'decision_makers', 'pain_points', 'buying_process', 'messaging', 'success_metrics', 'advanced']
  
  categories.forEach(category => {
    if (icpData[category] && Object.keys(icpData[category]).length > 0) {
      populatedCategories++
    }
  })
  
  return Math.round((populatedCategories / totalCategories) * 100)
}

// Extract key characteristics from conversation
function extractKeyCharacteristics(content: string): string[] {
  const characteristics = []
  const lower = content.toLowerCase()
  
  // Company type indicators
  if (lower.includes('startup') || lower.includes('early stage')) characteristics.push('Early-stage company')
  if (lower.includes('enterprise') || lower.includes('large company')) characteristics.push('Enterprise organization')
  if (lower.includes('agency') || lower.includes('consultant')) characteristics.push('Service provider')
  if (lower.includes('saas') || lower.includes('software')) characteristics.push('Technology company')
  if (lower.includes('remote') || lower.includes('distributed')) characteristics.push('Remote-first organization')
  
  // Growth indicators
  if (lower.includes('scaling') || lower.includes('growing')) characteristics.push('High-growth company')
  if (lower.includes('funding') || lower.includes('series')) characteristics.push('Venture-backed')
  
  return characteristics.slice(0, 10) // Limit to top 10
}

// Calculate engagement quality score
function calculateEngagementQuality(messages: any[]): string {
  const userMessages = messages.filter(m => m.role === 'user')
  const totalLength = userMessages.reduce((sum, msg) => sum + msg.content.length, 0)
  const avgLength = totalLength / Math.max(userMessages.length, 1)
  
  // Score based on message length and frequency
  if (avgLength > 200 && userMessages.length > 5) return 'High'
  if (avgLength > 100 && userMessages.length > 3) return 'Medium'
  return 'Low'
}

// Extract target profile information
function extractTargetProfile(content: string, thread: any): any {
  const profile: any = {}
  const lower = content.toLowerCase()
  
  // Company size
  const sizeIndicators = []
  if (lower.includes('startup') || lower.includes('1-10') || lower.includes('small team')) sizeIndicators.push('1-10 employees')
  if (lower.includes('small company') || lower.includes('10-50')) sizeIndicators.push('10-50 employees')
  if (lower.includes('mid-size') || lower.includes('50-200')) sizeIndicators.push('50-200 employees')
  if (lower.includes('large') || lower.includes('200-1000')) sizeIndicators.push('200-1000 employees')
  if (lower.includes('enterprise') || lower.includes('1000+')) sizeIndicators.push('1000+ employees')
  
  if (sizeIndicators.length > 0) {
    profile.company_size = sizeIndicators
  }
  
  // Industry
  const industries = []
  const industryKeywords = {
    'Technology/SaaS': ['saas', 'software', 'technology', 'tech', 'app'],
    'Healthcare': ['healthcare', 'medical', 'health', 'hospital', 'clinic'],
    'Financial Services': ['finance', 'financial', 'bank', 'fintech', 'investment'],
    'E-commerce': ['e-commerce', 'ecommerce', 'retail', 'online store'],
    'Manufacturing': ['manufacturing', 'factory', 'production', 'industrial'],
    'Consulting': ['consulting', 'consultant', 'advisory', 'services'],
    'Education': ['education', 'university', 'school', 'training'],
    'Real Estate': ['real estate', 'property', 'construction']
  }
  
  for (const [industry, keywords] of Object.entries(industryKeywords)) {
    if (keywords.some(keyword => lower.includes(keyword))) {
      industries.push(industry)
    }
  }
  
  if (industries.length > 0) {
    profile.industries = industries
  }
  
  // Geographic focus
  const geography = []
  const geoKeywords = ['united states', 'north america', 'europe', 'asia', 'global', 'international', 'remote']
  geoKeywords.forEach(geo => {
    if (lower.includes(geo)) {
      geography.push(geo.charAt(0).toUpperCase() + geo.slice(1))
    }
  })
  
  if (geography.length > 0) {
    profile.geographic_focus = geography
  }
  
  // Technology stack
  const techStack = []
  const techKeywords = ['salesforce', 'hubspot', 'aws', 'azure', 'google cloud', 'slack', 'microsoft', 'zoom']
  techKeywords.forEach(tech => {
    if (lower.includes(tech)) {
      techStack.push(tech)
    }
  })
  
  if (techStack.length > 0) {
    profile.technology_stack = techStack
  }
  
  return profile
}

// Extract decision makers information
function extractDecisionMakers(content: string, thread: any): any {
  const decisionMakers: any = {}
  const lower = content.toLowerCase()
  
  // Job titles and roles
  const roles = []
  const rolePatterns = [
    { pattern: /\b(?:ceo|chief executive)\b/gi, role: 'Chief Executive Officer' },
    { pattern: /\b(?:cto|chief technology)\b/gi, role: 'Chief Technology Officer' },
    { pattern: /\b(?:cfo|chief financial)\b/gi, role: 'Chief Financial Officer' },
    { pattern: /\b(?:cmo|chief marketing)\b/gi, role: 'Chief Marketing Officer' },
    { pattern: /\b(?:vp|vice president)\s+(?:sales|marketing|engineering|operations)\b/gi, role: 'Vice President' },
    { pattern: /\b(?:director|head)\s+of\s+(?:sales|marketing|engineering|operations|product)\b/gi, role: 'Director/Head' },
    { pattern: /\b(?:founder|co-founder)\b/gi, role: 'Founder' }
  ]
  
  rolePatterns.forEach(({ pattern, role }) => {
    const matches = content.match(pattern)
    if (matches) {
      roles.push(...matches.map(match => match.trim()))
    }
  })
  
  if (roles.length > 0) {
    decisionMakers.identified_roles = roles
  }
  
  // Authority indicators
  const authorityIndicators = []
  if (lower.includes('decision maker') || lower.includes('makes decisions')) authorityIndicators.push('Primary decision maker')
  if (lower.includes('budget') || lower.includes('approve')) authorityIndicators.push('Budget authority')
  if (lower.includes('team') || lower.includes('manages')) authorityIndicators.push('Team leadership')
  if (lower.includes('stakeholder') || lower.includes('influence')) authorityIndicators.push('Key stakeholder')
  
  if (authorityIndicators.length > 0) {
    decisionMakers.authority_level = authorityIndicators
  }
  
  // Influence patterns
  if (thread.prospect_name) {
    decisionMakers.primary_contact = {
      name: thread.prospect_name,
      company: thread.prospect_company,
      linkedin_url: thread.prospect_linkedin_url,
      engagement_level: calculateEngagementQuality([{ role: 'user', content }])
    }
  }
  
  return decisionMakers
}

// Extract pain points and buying signals
function extractPainPointsAndSignals(content: string, messages: any[]): any {
  const painPoints: any = {}
  const lower = content.toLowerCase()
  
  // Operational challenges
  const challenges = []
  const challengeKeywords = ['challenge', 'problem', 'issue', 'difficult', 'struggle', 'pain point']
  challengeKeywords.forEach(keyword => {
    if (lower.includes(keyword)) {
      const sentences = content.split('.')
      sentences.forEach(sentence => {
        if (sentence.toLowerCase().includes(keyword)) {
          challenges.push(sentence.trim())
        }
      })
    }
  })
  
  if (challenges.length > 0) {
    painPoints.operational_challenges = challenges.slice(0, 5)
  }
  
  // Buying signals
  const buyingSignals = []
  const signalKeywords = ['budget', 'timeline', 'implementation', 'next steps', 'move forward', 'proposal', 'quote']
  signalKeywords.forEach(signal => {
    if (lower.includes(signal)) {
      buyingSignals.push(signal)
    }
  })
  
  if (buyingSignals.length > 0) {
    painPoints.buying_signals = buyingSignals
  }
  
  // Growth pressures
  const growthPressures = []
  if (lower.includes('scale') || lower.includes('scaling')) growthPressures.push('Scaling challenges')
  if (lower.includes('efficiency') || lower.includes('optimize')) growthPressures.push('Efficiency needs')
  if (lower.includes('competition') || lower.includes('competitive')) growthPressures.push('Competitive pressure')
  if (lower.includes('growth') || lower.includes('expand')) growthPressures.push('Growth initiatives')
  
  if (growthPressures.length > 0) {
    painPoints.growth_pressures = growthPressures
  }
  
  return painPoints
}

// Extract buying process information
function extractBuyingProcess(content: string, messages: any[], thread: any): any {
  const buyingProcess: any = {}
  const lower = content.toLowerCase()
  
  // Evaluation stages
  const evaluationStages = []
  if (lower.includes('research') || lower.includes('evaluate')) evaluationStages.push('Research/Evaluation')
  if (lower.includes('demo') || lower.includes('presentation')) evaluationStages.push('Demo/Presentation')
  if (lower.includes('proposal') || lower.includes('quote')) evaluationStages.push('Proposal/Quote')
  if (lower.includes('approval') || lower.includes('sign off')) evaluationStages.push('Approval Process')
  
  if (evaluationStages.length > 0) {
    buyingProcess.evaluation_stages = evaluationStages
  }
  
  // Timeline indicators
  const timelineIndicators = []
  const timePatterns = [/\d+\s*(?:days?|weeks?|months?)/gi]
  timePatterns.forEach(pattern => {
    const matches = content.match(pattern)
    if (matches) {
      timelineIndicators.push(...matches)
    }
  })
  
  if (timelineIndicators.length > 0) {
    buyingProcess.timeline = timelineIndicators
  }
  
  // Stakeholder involvement
  const stakeholders = []
  if (lower.includes('team') || lower.includes('colleagues')) stakeholders.push('Team involvement')
  if (lower.includes('management') || lower.includes('executive')) stakeholders.push('Executive approval')
  if (lower.includes('technical') || lower.includes('it team')) stakeholders.push('Technical team')
  if (lower.includes('legal') || lower.includes('compliance')) stakeholders.push('Legal/Compliance')
  
  if (stakeholders.length > 0) {
    buyingProcess.stakeholder_involvement = stakeholders
  }
  
  return buyingProcess
}

// Extract messaging strategy
function extractMessagingStrategy(content: string, messages: any[]): any {
  const messaging: any = {}
  const lower = content.toLowerCase()
  
  // Value propositions mentioned
  const valueProps = []
  if (lower.includes('save time') || lower.includes('efficiency')) valueProps.push('Time savings/Efficiency')
  if (lower.includes('save money') || lower.includes('cost')) valueProps.push('Cost reduction')
  if (lower.includes('revenue') || lower.includes('growth')) valueProps.push('Revenue growth')
  if (lower.includes('automation') || lower.includes('automate')) valueProps.push('Automation benefits')
  if (lower.includes('scale') || lower.includes('scalability')) valueProps.push('Scalability')
  
  if (valueProps.length > 0) {
    messaging.value_propositions = valueProps
  }
  
  // Communication preferences
  const commPrefs = []
  const userMessages = messages.filter(m => m.role === 'user')
  const avgLength = userMessages.reduce((sum, msg) => sum + msg.content.length, 0) / Math.max(userMessages.length, 1)
  
  if (avgLength > 300) commPrefs.push('Detailed discussions')
  if (avgLength < 100) commPrefs.push('Concise communication')
  if (lower.includes('technical') || lower.includes('specs')) commPrefs.push('Technical focus')
  if (lower.includes('business') || lower.includes('roi')) commPrefs.push('Business focus')
  
  if (commPrefs.length > 0) {
    messaging.communication_preferences = commPrefs
  }
  
  // Competitive positioning
  const competitive = []
  if (lower.includes('competitor') || lower.includes('alternative')) {
    const sentences = content.split('.')
    sentences.forEach(sentence => {
      if (sentence.toLowerCase().includes('competitor') || sentence.toLowerCase().includes('alternative')) {
        competitive.push(sentence.trim())
      }
    })
  }
  
  if (competitive.length > 0) {
    messaging.competitive_mentions = competitive.slice(0, 3)
  }
  
  return messaging
}

// Extract success metrics
function extractSuccessMetrics(content: string, messages: any[]): any {
  const metrics: any = {}
  const lower = content.toLowerCase()
  
  // KPI mentions
  const kpis = []
  if (lower.includes('roi') || lower.includes('return on investment')) kpis.push('ROI')
  if (lower.includes('conversion') || lower.includes('conversion rate')) kpis.push('Conversion rate')
  if (lower.includes('response rate') || lower.includes('engagement')) kpis.push('Response/Engagement rate')
  if (lower.includes('revenue') || lower.includes('sales')) kpis.push('Revenue/Sales')
  if (lower.includes('efficiency') || lower.includes('productivity')) kpis.push('Efficiency/Productivity')
  
  if (kpis.length > 0) {
    metrics.relevant_kpis = kpis
  }
  
  // Performance benchmarks
  const benchmarks = []
  const numberPatterns = [/\d+%/g, /\d+x/g, /\$[\d,]+/g]
  numberPatterns.forEach(pattern => {
    const matches = content.match(pattern)
    if (matches) {
      benchmarks.push(...matches.slice(0, 5))
    }
  })
  
  if (benchmarks.length > 0) {
    metrics.performance_benchmarks = benchmarks
  }
  
  // Success timeline
  const timeline = []
  if (lower.includes('immediate') || lower.includes('right away')) timeline.push('Immediate results')
  if (lower.includes('30 days') || lower.includes('month')) timeline.push('30-day results')
  if (lower.includes('90 days') || lower.includes('quarter')) timeline.push('90-day results')
  if (lower.includes('annual') || lower.includes('yearly')) timeline.push('Annual results')
  
  if (timeline.length > 0) {
    metrics.success_timeline = timeline
  }
  
  return metrics
}

// Extract advanced classification
function extractAdvancedClassification(content: string, thread: any): any {
  const advanced: any = {}
  const lower = content.toLowerCase()
  
  // Technology adoption
  const techAdoption = []
  if (lower.includes('early adopter') || lower.includes('bleeding edge')) techAdoption.push('Early adopter')
  if (lower.includes('conservative') || lower.includes('proven')) techAdoption.push('Conservative adopter')
  if (lower.includes('beta') || lower.includes('test')) techAdoption.push('Beta tester')
  
  if (techAdoption.length > 0) {
    advanced.technology_adoption = techAdoption
  }
  
  // Compliance requirements
  const compliance = []
  if (lower.includes('gdpr') || lower.includes('privacy')) compliance.push('GDPR/Privacy')
  if (lower.includes('hipaa') || lower.includes('healthcare')) compliance.push('HIPAA/Healthcare')
  if (lower.includes('sox') || lower.includes('financial')) compliance.push('SOX/Financial')
  if (lower.includes('security') || lower.includes('iso')) compliance.push('Security/ISO')
  
  if (compliance.length > 0) {
    advanced.compliance_requirements = compliance
  }
  
  // Market trends
  const trends = []
  if (lower.includes('remote work') || lower.includes('distributed')) trends.push('Remote work trend')
  if (lower.includes('ai') || lower.includes('artificial intelligence')) trends.push('AI adoption')
  if (lower.includes('automation') || lower.includes('digital transformation')) trends.push('Digital transformation')
  
  if (trends.length > 0) {
    advanced.market_trends = trends
  }
  
  // Company culture
  const culture = []
  if (lower.includes('fast-paced') || lower.includes('agile')) culture.push('Fast-paced/Agile')
  if (lower.includes('data-driven') || lower.includes('analytics')) culture.push('Data-driven')
  if (lower.includes('innovation') || lower.includes('innovative')) culture.push('Innovation-focused')
  if (lower.includes('collaborative') || lower.includes('team-oriented')) culture.push('Collaborative')
  
  if (culture.length > 0) {
    advanced.company_culture = culture
  }
  
  return advanced
}

// Merge new ICP data with existing data
function mergeICPData(existing: any, newData: any): any {
  const merged = { ...existing }
  
  for (const [category, data] of Object.entries(newData)) {
    if (typeof data === 'object' && data !== null) {
      merged[category] = { ...merged[category], ...data }
    }
  }
  
  // Update metadata
  merged.updated_at = new Date().toISOString()
  
  return merged
}
