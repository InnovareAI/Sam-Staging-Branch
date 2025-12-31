/**
 * Multi-Source Data Input System for SAM Chat
 * Aggregates data from LinkedIn (Unipile MCP), campaigns, knowledge base, and external sources
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool } from '@/lib/auth'

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
    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspace_id')

    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'workspace_id is required'
      }, { status: 400 })
    }

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
    const campaignRes = await pool.query(
      'SELECT id, name, status, created_at FROM campaigns WHERE workspace_id = $1 LIMIT 10',
      [workspaceId]
    );

    const campaignSources: DataSource[] = campaignRes.rows.map(campaign => ({
      id: `campaign_${campaign.id}`,
      name: `Campaign: ${campaign.name}`,
      type: 'campaigns',
      status: campaign.status === 'active' ? 'active' : 'inactive',
      last_sync: campaign.created_at,
      description: 'Campaign performance and prospect data',
      available_data: ['prospects', 'responses', 'metrics', 'content']
    }))

    // Get knowledge base sources
    const kbRes = await pool.query(
      'SELECT id, section_id, title, created_at FROM knowledge_base_sections WHERE workspace_id = $1 OR workspace_id IS NULL LIMIT 10',
      [workspaceId]
    );

    const knowledgeBaseSources: DataSource[] = kbRes.rows.map(section => ({
      id: `kb_${section.id}`,
      name: `Knowledge: ${section.title}`,
      type: 'knowledge_base',
      status: 'active',
      last_sync: section.created_at,
      description: 'Company knowledge and documentation',
      available_data: ['documents', 'icps', 'company_data', 'insights']
    }))

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
    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const body: DataAggregationRequest = await request.json()
    const { context_type, data_sources, filters, max_results = 50 } = body

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
      const campaignData = await aggregateCampaignData(campaignSources, filters, workspaceId)
      aggregatedData.push(...campaignData)
    }

    // Process knowledge base sources
    const kbSources = data_sources.filter(s => s.startsWith('kb_'))
    if (kbSources.length > 0) {
      const kbData = await aggregateKnowledgeBaseData(kbSources, filters, workspaceId)
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
async function aggregateCampaignData(sources: string[], filters: any, workspaceId: string): Promise<AggregatedData[]> {
  const data: AggregatedData[] = []

  for (const source of sources) {
    const campaignId = source.replace('campaign_', '')

    // Get campaign prospects and responses
    const res = await pool.query(
      `SELECT id, email, first_name, last_name, company_name, status, response_data, created_at
       FROM campaign_prospects
       WHERE campaign_id = $1
       LIMIT 20`,
      [campaignId]
    );

    const prospects = res.rows;

    if (prospects?.length) {
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
async function aggregateKnowledgeBaseData(sources: string[], filters: any, workspaceId: string): Promise<AggregatedData[]> {
  const data: AggregatedData[] = []

  for (const source of sources) {
    const sectionId = source.replace('kb_', '')

    // Get knowledge base content
    let query = `
      SELECT id, title, content, content_type, tags, created_at
      FROM knowledge_base_content
      WHERE section_id = $1 AND is_active = true
    `;
    const params: any[] = [sectionId];

    if (workspaceId) {
      query += ` AND (workspace_id = $2 OR workspace_id IS NULL)`;
      params.push(workspaceId);
    } else {
      query += ` AND workspace_id IS NULL`;
    }

    query += ` ORDER BY created_at DESC LIMIT 10`;

    const res = await pool.query(query, params);
    const kbContent = res.rows;

    if (kbContent?.length) {
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
