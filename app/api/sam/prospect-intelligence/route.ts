/**
 * SAM AI Prospect Intelligence API
 * 
 * Enhanced endpoint that integrates MCP tools for real-time prospect research
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { mcpRegistry, createMCPConfig } from '@/lib/mcp/mcp-registry'

// Initialize MCP if needed
let mcpInitialized = false

async function ensureMCPInitialized() {
  if (mcpInitialized) return true

  try {
    const config = createMCPConfig()
    const result = await mcpRegistry.initialize(config)
    mcpInitialized = result.success
    return result.success
  } catch (error) {
    console.error('MCP initialization failed:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const body = await request.json()
    const { 
      type, 
      data, 
      methodology = 'meddic',
      urgency = 'medium',
      budget = 100,
      conversationId 
    } = body

    // Validate request
    if (!type || !data) {
      return NextResponse.json({
        success: false,
        error: 'Request type and data are required'
      }, { status: 400 })
    }

    // Ensure MCP is initialized
    const mcpReady = await ensureMCPInitialized()
    if (!mcpReady) {
      return NextResponse.json({
        success: false,
        error: 'Intelligence services temporarily unavailable',
        fallback: true
      }, { status: 503 })
    }

    let intelligenceResult

    switch (type) {
      case 'linkedin_url_research':
        intelligenceResult = await researchLinkedInUrl(data, methodology, urgency, budget)
        break
      
      case 'company_analysis':
        intelligenceResult = await analyzeCompany(data, methodology)
        break
      
      case 'prospect_search':
        intelligenceResult = await searchProspects(data, methodology, urgency, budget)
        break
      
      case 'strategic_insights':
        intelligenceResult = await generateStrategicInsights(data, methodology)
        break

      case 'boolean_linkedin_search':
        intelligenceResult = await executeBooleanLinkedInSearch(data, methodology, urgency, budget)
        break

      case 'company_intelligence_search':
        intelligenceResult = await executeCompanyIntelligenceSearch(data, methodology)
        break

      case 'icp_research_search':
        intelligenceResult = await executeICPResearchSearch(data, methodology, urgency, budget)
        break
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown intelligence type: ${type}`
        }, { status: 400 })
    }

    // Store intelligence result for conversation context
    if (conversationId && intelligenceResult.success) {
      await storeIntelligenceForConversation(user.id, conversationId, type, intelligenceResult.data)
    }

    return NextResponse.json({
      success: intelligenceResult.success,
      type,
      data: intelligenceResult.data,
      metadata: {
        methodology,
        urgency,
        processingTime: intelligenceResult.processingTime,
        confidence: intelligenceResult.confidence,
        source: intelligenceResult.source,
        costEstimate: intelligenceResult.costEstimate
      },
      error: intelligenceResult.error,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Prospect intelligence API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      fallback: true
    }, { status: 500 })
  }
}

// Research LinkedIn URL using best available MCP tool
async function researchLinkedInUrl(
  data: { url: string, extractEmails?: boolean }, 
  methodology: string,
  urgency: string,
  budget: number
) {
  const startTime = Date.now()
  
  try {
    // Validate LinkedIn URL first
    const validation = await mcpRegistry.callTool({
      method: 'tools/call',
      params: {
        name: 'validate_linkedin_url',
        arguments: { url: data.url }
      }
    })

    if (validation.isError) {
      return {
        success: false,
        error: 'Invalid LinkedIn URL',
        data: null,
        processingTime: Date.now() - startTime
      }
    }

    // Use smart routing for best source
    const researchResult = await mcpRegistry.researchProspectWithBestSource({
      profileUrls: [data.url],
      maxResults: 1,
      budget,
      urgency: urgency as any
    })

    if (researchResult.isError) {
      return {
        success: false,
        error: researchResult.content[0]?.text || 'Research failed',
        data: null,
        processingTime: Date.now() - startTime
      }
    }

    // Parse result and generate strategic insights
    const researchData = JSON.parse(researchResult.content[0]?.text || '{}')
    
    // Generate strategic insights if we have prospect data
    let insights = null
    if (researchData.prospects?.length > 0) {
      const insightsResult = await mcpRegistry.generateIntelligenceReport(
        researchData.prospects,
        methodology as any
      )
      
      if (!insightsResult.isError) {
        insights = JSON.parse(insightsResult.content[0]?.text || '{}')
      }
    }

    return {
      success: true,
      data: {
        prospect: researchData.prospects?.[0] || null,
        insights: insights,
        raw: researchData
      },
      processingTime: Date.now() - startTime,
      confidence: researchData.confidence || 0.8,
      source: researchData.source || 'mcp-auto',
      costEstimate: researchData.costEstimate || '$0.01'
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Research failed',
      data: null,
      processingTime: Date.now() - startTime
    }
  }
}

// Analyze company using MCP tools
async function analyzeCompany(
  data: { companyUrls: string[], includeCompetitors?: boolean },
  methodology: string
) {
  const startTime = Date.now()
  
  try {
    const analysisResult = await mcpRegistry.callTool({
      method: 'tools/call',
      params: {
        name: 'analyze_company',
        arguments: {
          companyUrls: data.companyUrls,
          includeCompetitors: data.includeCompetitors || false,
          includeTechnology: true
        }
      }
    })

    if (analysisResult.isError) {
      return {
        success: false,
        error: analysisResult.content[0]?.text || 'Company analysis failed',
        data: null,
        processingTime: Date.now() - startTime
      }
    }

    const analysisData = JSON.parse(analysisResult.content[0]?.text || '{}')

    return {
      success: true,
      data: analysisData,
      processingTime: Date.now() - startTime,
      confidence: 0.85,
      source: 'bright-data-mcp',
      costEstimate: '$0.05'
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Company analysis failed',
      data: null,
      processingTime: Date.now() - startTime
    }
  }
}

// Search for prospects using criteria
async function searchProspects(
  data: { searchCriteria: any, maxResults?: number },
  methodology: string,
  urgency: string,
  budget: number
) {
  const startTime = Date.now()
  
  try {
    const searchResult = await mcpRegistry.researchProspectWithBestSource({
      searchCriteria: data.searchCriteria,
      maxResults: data.maxResults || 10,
      budget,
      urgency: urgency as any
    })

    if (searchResult.isError) {
      return {
        success: false,
        error: searchResult.content[0]?.text || 'Prospect search failed',
        data: null,
        processingTime: Date.now() - startTime
      }
    }

    const searchData = JSON.parse(searchResult.content[0]?.text || '{}')

    return {
      success: true,
      data: searchData,
      processingTime: Date.now() - startTime,
      confidence: searchData.confidence || 0.8,
      source: searchData.source || 'mcp-auto',
      costEstimate: searchData.costEstimate || '$0.10'
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Prospect search failed',
      data: null,
      processingTime: Date.now() - startTime
    }
  }
}

// Generate strategic insights from prospect data
async function generateStrategicInsights(
  data: { prospects: any[] },
  methodology: string
) {
  const startTime = Date.now()
  
  try {
    const insightsResult = await mcpRegistry.generateIntelligenceReport(
      data.prospects,
      methodology as any
    )

    if (insightsResult.isError) {
      return {
        success: false,
        error: insightsResult.content[0]?.text || 'Insights generation failed',
        data: null,
        processingTime: Date.now() - startTime
      }
    }

    const insightsData = JSON.parse(insightsResult.content[0]?.text || '{}')

    return {
      success: true,
      data: insightsData,
      processingTime: Date.now() - startTime,
      confidence: insightsData.confidence || 0.9,
      source: 'bright-data-mcp',
      costEstimate: '$0.02'
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Insights generation failed',
      data: null,
      processingTime: Date.now() - startTime
    }
  }
}

// Store intelligence result for conversation context
async function storeIntelligenceForConversation(
  userId: string,
  conversationId: string,
  type: string,
  data: any
) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    await supabase
      .from('sam_conversation_intelligence')
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        intelligence_type: type,
        intelligence_data: data,
        created_at: new Date().toISOString()
      })
  } catch (error) {
    // Don't fail the main request if storage fails
    console.error('Failed to store intelligence for conversation:', error)
  }
}

// Execute Boolean LinkedIn search using WebSearch MCP
async function executeBooleanLinkedInSearch(
  data: { query: string, maxResults?: number, includeSnippets?: boolean },
  methodology: string,
  urgency: string,
  budget: number
) {
  const startTime = Date.now()
  
  try {
    const searchResult = await mcpRegistry.callTool({
      method: 'tools/call',
      params: {
        name: 'boolean_linkedin_search',
        arguments: {
          query: data.query,
          maxResults: data.maxResults || 10,
          includeSnippets: data.includeSnippets ?? true
        }
      }
    })

    if (searchResult.isError) {
      return {
        success: false,
        error: searchResult.content[0]?.text || 'Boolean LinkedIn search failed',
        data: null,
        processingTime: Date.now() - startTime
      }
    }

    const searchData = JSON.parse(searchResult.content[0]?.text || '{}')

    return {
      success: true,
      data: searchData,
      processingTime: Date.now() - startTime,
      confidence: 0.9,
      source: 'websearch-mcp',
      costEstimate: '$0.01'
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Boolean LinkedIn search failed',
      data: null,
      processingTime: Date.now() - startTime
    }
  }
}

// Execute Company Intelligence search using WebSearch MCP
async function executeCompanyIntelligenceSearch(
  data: { companyName: string, searchType?: string, maxResults?: number },
  methodology: string
) {
  const startTime = Date.now()
  
  try {
    const searchResult = await mcpRegistry.callTool({
      method: 'tools/call',
      params: {
        name: 'company_intelligence_search',
        arguments: {
          companyName: data.companyName,
          searchType: data.searchType || 'overview',
          maxResults: data.maxResults || 10
        }
      }
    })

    if (searchResult.isError) {
      return {
        success: false,
        error: searchResult.content[0]?.text || 'Company intelligence search failed',
        data: null,
        processingTime: Date.now() - startTime
      }
    }

    const searchData = JSON.parse(searchResult.content[0]?.text || '{}')

    return {
      success: true,
      data: searchData,
      processingTime: Date.now() - startTime,
      confidence: 0.87,
      source: 'websearch-mcp',
      costEstimate: '$0.02'
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Company intelligence search failed',
      data: null,
      processingTime: Date.now() - startTime
    }
  }
}

// Execute ICP Research search using WebSearch MCP
async function executeICPResearchSearch(
  data: { 
    industry: string, 
    jobTitles: string[], 
    companySize?: string, 
    geography?: string,
    maxResults?: number 
  },
  methodology: string,
  urgency: string,
  budget: number
) {
  const startTime = Date.now()
  
  try {
    const searchResult = await mcpRegistry.callTool({
      method: 'tools/call',
      params: {
        name: 'icp_research_search',
        arguments: {
          industry: data.industry,
          jobTitles: data.jobTitles,
          companySize: data.companySize || 'any',
          geography: data.geography || 'United States',
          maxResults: data.maxResults || 15
        }
      }
    })

    if (searchResult.isError) {
      return {
        success: false,
        error: searchResult.content[0]?.text || 'ICP research search failed',
        data: null,
        processingTime: Date.now() - startTime
      }
    }

    const searchData = JSON.parse(searchResult.content[0]?.text || '{}')

    return {
      success: true,
      data: searchData,
      processingTime: Date.now() - startTime,
      confidence: searchData.marketSize?.confidence || 0.85,
      source: 'websearch-mcp',
      costEstimate: '$0.03'
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'ICP research search failed',
      data: null,
      processingTime: Date.now() - startTime
    }
  }
}