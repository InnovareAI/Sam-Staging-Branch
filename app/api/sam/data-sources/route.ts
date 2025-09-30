/**
 * Multi-Source Data Input System for SAM Chat
 * Aggregates data from LinkedIn (Unipile MCP), campaigns, knowledge base, and external sources
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

// Available data sources for SAM chat
interface DataSource {
  id: string
  name: string
  type: 'linkedin' | 'campaigns' | 'knowledge_base' | 'external_api' | 'user_upload'
  status: 'active' | 'inactive' | 'error'
  last_sync?: string
  description: string
  available_data: string[]
}

interface DataAggregationRequest {
  context_type: 'conversation' | 'campaign_planning' | 'prospect_research' | 'company_analysis'
  data_sources: string[]
  filters?: {
    company_name?: string
    industry?: string
    prospect_name?: string
    linkedin_url?: string
    date_range?: {
      start: string
      end: string
    }
  }
  max_results?: number
  workspace_id?: string
}

interface AggregatedData {
  source: string
  data_type: string
  content: any
  relevance_score: number
  timestamp: string
}

// GET - Get available data sources
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspace_id')

    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'workspace_id is required'
      }, { status: 400 })
    }

    const supabase = supabaseAdmin()

    // Get LinkedIn accounts via MCP
    let linkedinSources: DataSource[] = []
    try {
      // This would use the MCP tool to get LinkedIn accounts
      // For now, we'll simulate based on the accounts we saw
      linkedinSources = [
        {
          id: 'linkedin_thorsten',
          name: 'Thorsten Linz (Sales Navigator)',
          type: 'linkedin',
          status: 'active',
          last_sync: new Date().toISOString(),
          description: 'LinkedIn messaging and connection data',
          available_data: ['messages', 'connections', 'profile_data', 'company_data']
        },
        {
          id: 'linkedin_irish',
          name: 'Irish Cita De Ade',
          type: 'linkedin',
          status: 'active',
          last_sync: new Date().toISOString(),
          description: 'LinkedIn messaging and connection data',
          available_data: ['messages', 'connections', 'profile_data']
        },
        {
          id: 'linkedin_martin',
          name: 'Martin Schechtner',
          type: 'linkedin',
          status: 'active',
          last_sync: new Date().toISOString(),
          description: 'LinkedIn messaging and connection data',
          available_data: ['messages', 'connections', 'profile_data']
        },
        {
          id: 'linkedin_peter',
          name: 'Peter Noble',
          type: 'linkedin',
          status: 'active',
          last_sync: new Date().toISOString(),
          description: 'LinkedIn messaging and connection data',
          available_data: ['messages', 'connections', 'profile_data']
        },
        {
          id: 'linkedin_charissa',
          name: 'Charissa Daniel',
          type: 'linkedin',
          status: 'active',
          last_sync: new Date().toISOString(),
          description: 'LinkedIn messaging and connection data',
          available_data: ['messages', 'connections', 'profile_data']
        },
        {
          id: 'linkedin_noriko',
          name: 'Noriko Yokoi, Ph.D.',
          type: 'linkedin',
          status: 'active',
          last_sync: new Date().toISOString(),
          description: 'LinkedIn messaging and connection data',
          available_data: ['messages', 'connections', 'profile_data']
        }
      ]
    } catch (error) {
      console.warn('Failed to fetch LinkedIn sources:', error)
    }

    // Get campaign data sources
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, status, created_at')
      .eq('workspace_id', workspaceId)
      .limit(10)

    const campaignSources: DataSource[] = campaigns?.map(campaign => ({
      id: `campaign_${campaign.id}`,
      name: `Campaign: ${campaign.name}`,
      type: 'campaigns',
      status: campaign.status === 'active' ? 'active' : 'inactive',
      last_sync: campaign.created_at,
      description: 'Campaign performance and prospect data',
      available_data: ['prospects', 'responses', 'metrics', 'content']
    })) || []

    // Get knowledge base sources
    const { data: kbSections, error: kbError } = await supabase
      .from('knowledge_base_sections')
      .select('id, section_id, title, created_at')
      .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
      .limit(10)

    const knowledgeBaseSources: DataSource[] = kbSections?.map(section => ({
      id: `kb_${section.id}`,
      name: `Knowledge: ${section.title}`,
      type: 'knowledge_base',
      status: 'active',
      last_sync: section.created_at,
      description: 'Company knowledge and documentation',
      available_data: ['documents', 'icps', 'company_data', 'insights']
    })) || []

    // External API sources (placeholders for future integrations)
    const externalSources: DataSource[] = [
      {
        id: 'apollo_io',
        name: 'Apollo.io',
        type: 'external_api',
        status: 'inactive',
        description: 'B2B contact and company data',
        available_data: ['company_data', 'contact_data', 'technographics']
      },
      {
        id: 'zoominfo',
        name: 'ZoomInfo',
        type: 'external_api',
        status: 'inactive',
        description: 'Professional contact database',
        available_data: ['contact_data', 'company_data', 'intent_data']
      }
    ]

    const allSources = [
      ...linkedinSources,
      ...campaignSources,
      ...knowledgeBaseSources,
      ...externalSources
    ]

    return NextResponse.json({
      success: true,
      data_sources: allSources,
      summary: {
        total_sources: allSources.length,
        active_sources: allSources.filter(s => s.status === 'active').length,
        linkedin_accounts: linkedinSources.length,
        campaign_sources: campaignSources.length,
        knowledge_base_sources: knowledgeBaseSources.length
      }
    })

  } catch (error) {
    console.error('Data sources error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST - Aggregate data from multiple sources
export async function POST(request: NextRequest) {
  try {
    const body: DataAggregationRequest = await request.json()
    const { context_type, data_sources, filters, max_results = 50 } = body

    const supabase = supabaseAdmin()
    const workspaceId = request.headers.get('x-workspace-id') ?? body.workspace_id

    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'workspace_id header (x-workspace-id) or body value is required'
      }, { status: 400 })
    }
    
    let aggregatedData: AggregatedData[] = []

    // Process LinkedIn data sources
    const linkedinSources = data_sources.filter(s => s.startsWith('linkedin_'))
    if (linkedinSources.length > 0) {
      try {
        // This would use MCP tools to get recent messages and data
        const linkedinData = await aggregateLinkedInData(linkedinSources, filters)
        aggregatedData.push(...linkedinData)
      } catch (error) {
        console.warn('LinkedIn data aggregation failed:', error)
      }
    }

    // Process campaign data sources
    const campaignSources = data_sources.filter(s => s.startsWith('campaign_'))
    if (campaignSources.length > 0) {
      const campaignData = await aggregateCampaignData(campaignSources, filters, supabase, workspaceId)
      aggregatedData.push(...campaignData)
    }

    // Process knowledge base sources
    const kbSources = data_sources.filter(s => s.startsWith('kb_'))
    if (kbSources.length > 0) {
      const kbData = await aggregateKnowledgeBaseData(kbSources, filters, supabase, workspaceId)
      aggregatedData.push(...kbData)
    }

    // Sort by relevance score and limit results
    aggregatedData.sort((a, b) => b.relevance_score - a.relevance_score)
    aggregatedData = aggregatedData.slice(0, max_results)

    return NextResponse.json({
      success: true,
      context_type,
      total_results: aggregatedData.length,
      data: aggregatedData,
      metadata: {
        sources_processed: data_sources.length,
        linkedin_sources: linkedinSources.length,
        campaign_sources: campaignSources.length,
        knowledge_base_sources: kbSources.length
      }
    })

  } catch (error) {
    console.error('Data aggregation error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper function to aggregate LinkedIn data via MCP
async function aggregateLinkedInData(sources: string[], filters?: any): Promise<AggregatedData[]> {
  const data: AggregatedData[] = []
  
  // This would use the MCP tools to get recent messages
  // For now, return placeholder data structure
  sources.forEach(source => {
    data.push({
      source: source,
      data_type: 'linkedin_conversations',
      content: {
        type: 'recent_messages',
        message: 'LinkedIn conversation data would be aggregated here using MCP tools',
        account: source.replace('linkedin_', ''),
        filters_applied: filters
      },
      relevance_score: 0.8,
      timestamp: new Date().toISOString()
    })
  })

  return data
}

// Helper function to aggregate campaign data
async function aggregateCampaignData(sources: string[], filters: any, supabase: any, workspaceId: string): Promise<AggregatedData[]> {
  const data: AggregatedData[] = []
  
  for (const source of sources) {
    const campaignId = source.replace('campaign_', '')
    
    // Get campaign prospects and responses
    const { data: prospects, error } = await supabase
      .from('campaign_prospects')
      .select(`
        id,
        email,
        first_name,
        last_name,
        company_name,
        status,
        response_data,
        created_at
      `)
      .eq('campaign_id', campaignId)
      .limit(20)

    if (!error && prospects?.length) {
      data.push({
        source: source,
        data_type: 'campaign_prospects',
        content: {
          type: 'prospect_list',
          prospects: prospects,
          campaign_id: campaignId,
          total_prospects: prospects.length
        },
        relevance_score: 0.7,
        timestamp: new Date().toISOString()
      })
    }
  }

  return data
}

// Helper function to aggregate knowledge base data
async function aggregateKnowledgeBaseData(sources: string[], filters: any, supabase: any, workspaceId: string): Promise<AggregatedData[]> {
  const data: AggregatedData[] = []
  
  for (const source of sources) {
    const sectionId = source.replace('kb_', '')
    
    // Get knowledge base content
    let query = supabase
      .from('knowledge_base_content')
      .select(`
        id,
        title,
        content,
        content_type,
        tags,
        created_at
      `)
      .eq('section_id', sectionId)
      .eq('is_active', true)

    if (workspaceId) {
      query = query.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
    } else {
      query = query.is('workspace_id', null)
    }

    const { data: kbContent, error } = await query
      .order('created_at', { ascending: false })
      .limit(10)

    if (!error && kbContent?.length) {
      data.push({
        source: source,
        data_type: 'knowledge_base_content',
        content: {
          type: 'knowledge_documents',
          documents: kbContent,
          section_id: sectionId,
          total_documents: kbContent.length
        },
        relevance_score: 0.6,
        timestamp: new Date().toISOString()
      })
    }
  }

  return data
}
