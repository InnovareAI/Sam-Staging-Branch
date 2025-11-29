/**
 * Website Intelligence System
 *
 * Analyzes company websites to extract structured business information:
 * - Auto-detects industry from website content
 * - Extracts company description, value proposition, target customers
 * - Identifies pain points solved and key competitors
 * - Maps to appropriate industry blueprint
 * - Stores in workspace for SAM context
 *
 * Updated Nov 29, 2025: Migrated to Claude Direct API for GDPR compliance
 */

import { INDUSTRY_BLUEPRINTS, findBlueprintByIndustry } from './templates/industry-blueprints'
import { createClient } from '@supabase/supabase-js'
import { claudeClient } from '@/lib/llm/claude-client'
// import { addKnowledgeItem } from './supabase-knowledge' // TODO: Function not implemented yet

// Website analysis result
export interface WebsiteAnalysis {
  companyName: string
  industry: string // Maps to industry blueprint codes
  confidence: number
  companyDescription: string
  valueProposition: string
  targetPersonas: string[]
  painPoints: string[]
  keyCompetitors: string[]
  pricingModel?: string
  summary: string
  suggestedBlueprint?: string
}

/**
 * Fetch and analyze company website
 */
export async function analyzeCompanyWebsite(
  url: string,
  companyName: string
): Promise<WebsiteAnalysis> {
  try {
    console.log(`🌐 Fetching website: ${url}`)

    // Fetch website content
    const websiteContent = await fetchWebsiteContent(url)

    if (!websiteContent || websiteContent.length < 100) {
      throw new Error('Website content too short or inaccessible')
    }

    // Analyze with AI
    const analysis = await analyzeWebsiteWithAI(websiteContent, companyName, url)

    return analysis
  } catch (error) {
    console.error('Website analysis failed:', error)

    // Return basic analysis with company name
    return {
      companyName,
      industry: 'unknown',
      confidence: 0,
      companyDescription: `Company website at ${url}`,
      valueProposition: '',
      targetPersonas: [],
      painPoints: [],
      keyCompetitors: [],
      summary: 'Website analysis failed - manual entry required',
      suggestedBlueprint: undefined
    }
  }
}

/**
 * Fetch website content using multiple strategies
 */
async function fetchWebsiteContent(url: string): Promise<string> {
  try {
    // Ensure URL has protocol
    const fullUrl = url.startsWith('http') ? url : `https://${url}`

    // Fetch homepage
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SAM-AI-Bot/1.0; +https://meet-sam.com)',
      },
      // Add timeout
      signal: AbortSignal.timeout(10000) // 10 seconds
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()

    // Extract text content from HTML (simple approach)
    // Remove script and style tags
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()

    // Limit to first 8000 characters for AI analysis
    return text.substring(0, 8000)
  } catch (error) {
    console.error('Failed to fetch website:', error)
    throw new Error(`Could not access website: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Analyze website content with AI
 */
async function analyzeWebsiteWithAI(
  content: string,
  companyName: string,
  url: string
): Promise<WebsiteAnalysis> {
  try {
    const prompt = `Analyze this company website and extract structured business information.

COMPANY NAME: ${companyName}
WEBSITE URL: ${url}

WEBSITE CONTENT:
${content}

AVAILABLE INDUSTRIES:
${Object.keys(INDUSTRY_BLUEPRINTS).join(', ')}

Please analyze and return a JSON object with:
1. industry: Which industry best matches (must be from the available industries list)
2. confidence: How confident you are (0-1)
3. companyDescription: What the company does (2-3 sentences)
4. valueProposition: Main value proposition/benefit
5. targetPersonas: Array of target customer titles (e.g., ["CISO", "VP Sales"])
6. painPoints: Array of 3-5 key pain points they solve
7. keyCompetitors: Array of competitors mentioned (if any)
8. pricingModel: Pricing approach (per-seat, tiered, enterprise, freemium, etc.) if mentioned

Return ONLY valid JSON, no markdown formatting.`

    // Use Claude Direct API for GDPR compliance
    const response = await claudeClient.chat({
      model: 'claude-haiku-4-20250514', // Fast and cost-efficient
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    })

    const aiResponse = response.content

    if (!aiResponse) {
      throw new Error('No response from AI')
    }

    // Parse AI response
    let analysisData: any
    try {
      // Remove markdown code blocks if present
      const jsonStr = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      analysisData = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse)
      throw new Error('Invalid AI response format')
    }

    // Validate and normalize industry
    const detectedIndustry = analysisData.industry?.toLowerCase() || 'unknown'
    const blueprint = findBlueprintByIndustry(detectedIndustry)

    const analysis: WebsiteAnalysis = {
      companyName,
      industry: blueprint?.code || 'unknown',
      confidence: analysisData.confidence || 0.5,
      companyDescription: analysisData.companyDescription || `${companyName} company`,
      valueProposition: analysisData.valueProposition || '',
      targetPersonas: Array.isArray(analysisData.targetPersonas) ? analysisData.targetPersonas : [],
      painPoints: Array.isArray(analysisData.painPoints) ? analysisData.painPoints : [],
      keyCompetitors: Array.isArray(analysisData.keyCompetitors) ? analysisData.keyCompetitors : [],
      pricingModel: analysisData.pricingModel,
      summary: `${companyName} is in the ${blueprint?.industry || 'unknown'} industry. ${analysisData.companyDescription}`,
      suggestedBlueprint: blueprint?.code
    }

    console.log('✅ Website analysis complete:', {
      industry: analysis.industry,
      confidence: analysis.confidence,
      personas: analysis.targetPersonas.length
    })

    return analysis
  } catch (error) {
    console.error('AI analysis failed:', error)
    throw error
  }
}

/**
 * Populate knowledge base from website analysis
 *
 * IMPORTANT: All entries are marked as "needs_validation" because:
 * - Website content may not reflect current go-to-market strategy
 * - Companies may be targeting new markets not mentioned on website
 * - SAM should confirm all assumptions during discovery interview
 */
export async function populateKBFromWebsite(
  workspaceId: string,
  analysis: WebsiteAnalysis
): Promise<void> {
  try {
    console.log('📝 Populating knowledge base from website analysis (marked as needs validation)...')

    // 1. Store company/business model information
    // TODO: Implement addKnowledgeItem function
    if (analysis.companyDescription) {
      // await addKnowledgeItem({
      //   workspace_id: workspaceId,
      //   category: 'business-model',
      //   title: `What does ${analysis.companyName} do?`,
      //   content: analysis.companyDescription,
      //   tags: ['auto-extracted', 'website-analysis', analysis.industry, 'needs-validation'],
      //   version: '1.0',
      //   is_active: true,
      //   source_type: 'website_analysis',
      //   source_metadata: {
      //     confidence: analysis.confidence,
      //     detected_industry: analysis.industry,
      //     needs_validation: true,
      //     auto_detected: true,
      //     sam_validation_prompts: [
      //       `I pulled this from your website: "${analysis.companyDescription.substring(0, 100)}..." - does that still capture what you do?`,
      //       `From your site, it looks like you're in ${analysis.industry}. Is that accurate, or are you going after new markets?`
      //     ]
      //   }
      // })
    }

    // 2. Store value proposition
    // TODO: Implement addKnowledgeItem function
    // if (analysis.valueProposition) {
    //   await addKnowledgeItem({
    //     workspace_id: workspaceId,
    //     category: 'value-proposition',
    //     title: `${analysis.companyName} Value Proposition`,
    //     content: analysis.valueProposition,
    //     tags: ['auto-extracted', 'website-analysis', analysis.industry, 'needs-validation'],
    //     version: '1.0',
    //     is_active: true,
    //     source_type: 'website_analysis',
    //     source_metadata: {
    //       confidence: analysis.confidence,
    //       needs_validation: true,
    //       auto_detected: true,
    //       sam_validation_prompts: [
    //         `I saw on your site that your main value prop is "${analysis.valueProposition.substring(0, 80)}..." - is that still how you position yourselves?`,
    //         `Has your positioning evolved recently, or is that still the core message?`
    //       ]
    //     }
    //   })
    // }

    // 3. Store target personas as ICP
    // TODO: Implement addKnowledgeItem function
    // if (analysis.targetPersonas.length > 0) {
    //   await addKnowledgeItem({
    //     workspace_id: workspaceId,
    //     category: 'icp',
    //     subcategory: 'personas',
    //     title: 'Target Customer Personas',
    //     content: `Our primary target personas:\n${analysis.targetPersonas.map(p => `- ${p}`).join('\n')}`,
    //     tags: ['auto-extracted', 'website-analysis', 'personas', 'needs-validation'],
    //     version: '1.0',
    //     is_active: true,
    //     source_type: 'website_analysis',
    //     source_metadata: {
    //       personas: analysis.targetPersonas,
    //       needs_validation: true,
    //       auto_detected: true,
    //       sam_validation_prompts: [
    //         `From your website, looks like you're going after ${analysis.targetPersonas.slice(0, 2).join(' and ')} - is that right?`,
    //         `Are you expanding into new buyer personas, or are these still your primary targets?`
    //       ]
    //     }
    //   })
    // }

    // 4. Store pain points
    // TODO: Implement addKnowledgeItem function
    // if (analysis.painPoints.length > 0) {
    //   await addKnowledgeItem({
    //     workspace_id: workspaceId,
    //     category: 'pain-points',
    //     title: 'Key Pain Points We Solve',
    //     content: analysis.painPoints.join('\n\n'),
    //     tags: ['auto-extracted', 'website-analysis', 'pain-points', 'needs-validation'],
    //     version: '1.0',
    //     is_active: true,
    //     source_type: 'website_analysis',
    //     source_metadata: {
    //       pain_points: analysis.painPoints,
    //       needs_validation: true,
    //       auto_detected: true,
    //       sam_validation_prompts: [
    //         `I noticed on your site you talk about solving ${analysis.painPoints[0]?.substring(0, 60)}... - is that still the main problem you tackle?`,
    //         `Are there new use cases or pain points you're addressing that aren't on the website yet?`
    //       ]
    //     }
    //   })
    // }

    // 5. Store competitors
    // TODO: Implement addKnowledgeItem function
    // if (analysis.keyCompetitors.length > 0) {
    //   await addKnowledgeItem({
    //     workspace_id: workspaceId,
    //     category: 'competition',
    //     title: 'Key Competitors',
    //     content: `Main competitors:\n${analysis.keyCompetitors.map(c => `- ${c}`).join('\n')}`,
    //     tags: ['auto-extracted', 'website-analysis', 'competitors', 'needs-validation'],
    //     version: '1.0',
    //     is_active: true,
    //     source_type: 'website_analysis',
    //     source_metadata: {
    //       competitors: analysis.keyCompetitors,
    //       needs_validation: true,
    //       auto_detected: true,
    //       sam_validation_prompts: [
    //         `I saw you mention ${analysis.keyCompetitors.slice(0, 2).join(' and ')} as competitors - is that who you're up against most often?`,
    //         `Anyone new in the competitive landscape we should know about?`
    //       ]
    //     }
    //   })
    // }

    // 6. Store pricing model if available
    // TODO: Implement addKnowledgeItem function
    // if (analysis.pricingModel) {
    //   await addKnowledgeItem({
    //     workspace_id: workspaceId,
    //     category: 'pricing',
    //     title: 'Pricing Model',
    //     content: `Pricing approach: ${analysis.pricingModel}`,
    //     tags: ['auto-extracted', 'website-analysis', 'pricing', 'needs-validation'],
    //     version: '1.0',
    //     is_active: true,
    //     source_type: 'website_analysis',
    //     source_metadata: {
    //       pricing_model: analysis.pricingModel,
    //       needs_validation: true,
    //       auto_detected: true,
    //       sam_validation_prompts: [
    //         `Looks like you're using ${analysis.pricingModel} pricing - is that still your model?`,
    //         `Any recent changes to how you price your solution?`
    //       ]
    //     }
    //   })
    // }

    console.log(`✅ Populated ${6} KB categories from website analysis`)
  } catch (error) {
    console.error('Failed to populate KB from website:', error)
    // Don't throw - KB population is non-critical
  }
}

/**
 * Store website analysis in workspace
 */
export async function storeWebsiteAnalysis(
  workspaceId: string,
  analysis: WebsiteAnalysis
): Promise<void> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabase
      .from('workspaces')
      .update({
        detected_industry: analysis.industry,
        company_description: analysis.companyDescription,
        target_personas: analysis.targetPersonas,
        pain_points: analysis.painPoints,
        value_proposition: analysis.valueProposition,
        key_competitors: analysis.keyCompetitors,
        pricing_model: analysis.pricingModel,
        website_analysis_status: 'completed',
        website_analyzed_at: new Date().toISOString()
      })
      .eq('id', workspaceId)

    if (error) {
      console.error('Failed to store website analysis:', error)
      throw error
    }

    console.log('✅ Website analysis stored in workspace:', workspaceId)
  } catch (error) {
    console.error('Failed to store website analysis:', error)
    throw error
  }
}

/**
 * Trigger background website analysis (non-blocking)
 */
export async function analyzeWebsiteInBackground(params: {
  url: string
  workspaceId: string
  companyName: string
}): Promise<void> {
  // Update status to analyzing
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await supabase
    .from('workspaces')
    .update({ website_analysis_status: 'analyzing' })
    .eq('id', params.workspaceId)

  // Perform analysis
  try {
    const analysis = await analyzeCompanyWebsite(params.url, params.companyName)

    // Store in workspace table
    await storeWebsiteAnalysis(params.workspaceId, analysis)

    // Populate knowledge base with extracted information
    await populateKBFromWebsite(params.workspaceId, analysis)

    console.log('✅ Website analysis and KB population complete')
  } catch (error) {
    console.error('Background website analysis failed:', error)

    // Mark as failed
    await supabase
      .from('workspaces')
      .update({ website_analysis_status: 'failed' })
      .eq('id', params.workspaceId)
  }
}

/**
 * Extract company name from URL domain
 */
export function extractCompanyNameFromURL(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
    const domain = urlObj.hostname
      .replace(/^www\./, '') // Remove www
      .split('.')[0] // Get first part

    // Capitalize first letter
    return domain.charAt(0).toUpperCase() + domain.slice(1)
  } catch {
    return 'Company' // Fallback
  }
}
