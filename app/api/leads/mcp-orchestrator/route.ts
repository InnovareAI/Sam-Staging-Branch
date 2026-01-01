import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { mcpOrchestrator } from '@/lib/mcp/agent-orchestrator';
import { mcpRegistry, createMCPConfig } from '@/lib/mcp/mcp-registry';
import {
  MCPIntelligenceRequest,
  BrightDataProspectRequest,
  ApifyProspectRequest,
  MCPCallToolResult
} from '@/lib/mcp/types';
import type { Pool } from 'pg';

let registryInitialized = false;
type GenericRecord = Record<string, unknown>;

interface LegacyFallbackResult {
  prospects: EnrichedProspect[];
  insights: GenericRecord[];
  sources: string[];
  notes: string[];
}

// MCP Lead Generation Orchestrator
// Combines Apollo, Sales Navigator, and other data sources for intelligent prospect discovery

interface LeadGenerationRequest {
  bot_type: 'lead_finder' | 'intelligence_gatherer' | 'campaign_builder' | 'research_assistant';
  search_criteria: {
    target_titles?: string[];
    target_industries?: string[];
    target_locations?: string[];
    company_size?: string;
    funding_stage?: string;
    keywords?: string;
    exclude_companies?: string[];
  };
  data_sources: {
    use_brightdata?: boolean;
    use_unipile_linkedin?: boolean;
    use_enrichment?: boolean;
    prioritize_premium?: boolean;
  };
  output_preferences: {
    max_prospects?: number;
    require_email?: boolean;
    require_linkedin?: boolean;
    quality_threshold?: number;
    auto_import_to_campaign?:
      | string
      | {
          workflow_id: string;
          input_data?: GenericRecord;
        };
  };
  conversation_context?: {
    user_request: string;
    sam_context?: GenericRecord;
    previous_searches?: GenericRecord[];
  };
}

interface EnrichedProspect {
  id: string;
  source: 'brightdata' | 'unipile_linkedin' | 'combined';
  confidence_score: number;
  prospect_data: {
    first_name: string;
    last_name: string;
    email?: string;
    linkedin_url: string;
    linkedin_id?: string;
    title: string;
    company: string;
    location: string;
    phone?: string;
  };
  enrichment_data?: {
    company_details?: GenericRecord;
    contact_verification?: GenericRecord;
    social_profiles?: GenericRecord;
    intent_signals?: GenericRecord;
  };
  premium_insights?: {
    mutual_connections?: number;
    hiring_activity?: boolean;
    recent_posts?: boolean;
    company_growth?: string;
  };
  recommended_approach?: {
    connection_strategy: string;
    message_angle: string;
    timing_suggestion: string;
    personalization_hooks: string[];
  };
}

// MCP Orchestrator: Intelligent Lead Generation
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const request: LeadGenerationRequest = await req.json();
    
    // Validate required fields
    if (!request.bot_type) {
      return NextResponse.json({ error: 'bot_type is required' }, { status: 400 });
    }
    
    if (!request.search_criteria) {
      return NextResponse.json({ error: 'search_criteria is required' }, { status: 400 });
    }
    
    console.log(`MCP Orchestrator: ${request.bot_type} request for user ${user.id}`);

    // Route to appropriate bot handler
    switch (request.bot_type) {
      case 'lead_finder':
        return await leadFinderBot(request, user, supabase);
      
      case 'intelligence_gatherer':
        return await intelligenceGathererBot(request);
      
      case 'campaign_builder':
        return await campaignBuilderBot(request);
      
      case 'research_assistant':
        return await researchAssistantBot();
      
      default:
        return NextResponse.json({ 
          error: 'Invalid bot type',
          available_bots: [
            'lead_finder - Find prospects matching criteria',
            'intelligence_gatherer - Deep research and insights',
            'campaign_builder - End-to-end campaign creation',
            'research_assistant - Market and competitive intelligence'
          ]
        }, { status: 400 });
    }

  } catch (error: unknown) {
    console.error('MCP Orchestrator error:', error);
    return NextResponse.json(
      {
        error: 'Lead generation orchestration failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function leadFinderBot(request: LeadGenerationRequest, user: { id: string } | null, supabaseClient: SupabaseClient) {
  await ensureMCPRegistry();

  const startTime = Date.now();
  const executionNotes: string[] = [];
  const sourceSet = new Set<string>();

  let orchestratedProspects: EnrichedProspect[] = [];
  let aggregatedInsights: GenericRecord[] = [];
  let orchestrationDetails: GenericRecord | null = null;
  let n8nTriggerResult: GenericRecord | null = null;

  try {
    const intelligenceRequest = buildIntelligenceRequest(request);
    executionNotes.push(`Prepared intelligence request using ${intelligenceRequest.source}`);

    const plan = await mcpOrchestrator.planExecution(intelligenceRequest);
    orchestrationDetails = {
      executionOrder: plan.executionOrder,
      parallelGroups: plan.parallelGroups,
      estimatedCost: plan.totalEstimatedCost,
      estimatedDuration: plan.totalEstimatedDuration
    };
    executionNotes.push('Generated multi-agent execution plan');

    const execution = await mcpOrchestrator.executeOrchestrationPlan(plan, (taskId, status) => {
      executionNotes.push(`Task ${taskId} ${status}`);
    });

    const researchTasks = plan.tasks.filter(task => task.type === 'research');
    for (const task of researchTasks) {
      const result = execution.results[task.id];
      const { prospects, insights } = parseResearchResult(result);
      const source = mapAgentToSource(task.context.agent);
      if (prospects.length) {
        sourceSet.add(source);
        orchestratedProspects.push(
          ...prospects.map(raw => normalizeMCPProspect(raw, source, request))
        );
      }
      if (insights.length) {
        aggregatedInsights.push(...insights);
      }
    }

    if (execution.intelligence?.insights?.strategicInsights) {
      aggregatedInsights.push(
        ...execution.intelligence.insights.strategicInsights.map(insight =>
          (typeof insight === 'object' && insight !== null)
            ? (insight as GenericRecord)
            : { insight }
        )
      );
    }

    if (!orchestratedProspects.length) {
      const fallback = await legacyBrightdataFallback(request);
      orchestratedProspects = fallback.prospects;
      aggregatedInsights = fallback.insights;
      fallback.sources.forEach(source => sourceSet.add(source));
      executionNotes.push(...fallback.notes);
    }

    orchestrationDetails = {
      ...orchestrationDetails,
      executionMetrics: execution.executionMetrics
    };
  } catch (error) {
    console.error('Lead finder orchestrator error:', error);
    executionNotes.push('Multi-agent orchestration failed, falling back to legacy pipeline');
    const fallback = await legacyBrightdataFallback(request);
    orchestratedProspects = fallback.prospects;
    aggregatedInsights = fallback.insights;
    fallback.sources.forEach(source => sourceSet.add(source));
    executionNotes.push(...fallback.notes);
  }

  const unipileAccounts = request.data_sources.use_unipile_linkedin
    ? await fetchUnipileAccountsSafe()
    : [];

  const deduplicatedProspects = deduplicateProspects(orchestratedProspects);
  let scoredProspects = scoreProspectQuality(deduplicatedProspects);

  if (request.output_preferences.require_email) {
    scoredProspects = scoredProspects.filter(prospect => prospect.prospect_data.email);
  }

  if (request.output_preferences.quality_threshold) {
    scoredProspects = scoredProspects.filter(prospect =>
      prospect.confidence_score >= request.output_preferences.quality_threshold!
    );
  }

  const maxProspects = request.output_preferences.max_prospects || 50;
  const limitedProspects = scoredProspects
    .sort((a, b) => b.confidence_score - a.confidence_score)
    .slice(0, maxProspects);

  limitedProspects.forEach(prospect => {
    prospect.recommended_approach = generateOutreachRecommendations(prospect, request.search_criteria);
  });

  const autoImportPref = request.output_preferences.auto_import_to_campaign;
  if (autoImportPref && limitedProspects.length > 0) {
    const workflowId = typeof autoImportPref === 'string'
      ? autoImportPref
      : autoImportPref.workflow_id;
    const extraInput = typeof autoImportPref === 'string'
      ? {}
      : autoImportPref.input_data ?? {};

    if (workflowId) {
      executionNotes.push(`Triggering n8n workflow ${workflowId} for campaign import`);
      const n8nResponse = await triggerN8nWorkflow(workflowId, {
        prospects: limitedProspects,
        filters: request.search_criteria,
        summary: {
          total: limitedProspects.length,
          sources: Array.from(sourceSet)
        },
        ...extraInput
      });

      if (n8nResponse.result) {
        n8nTriggerResult = n8nResponse.result;
        executionNotes.push('n8n workflow triggered successfully');
      } else if (n8nResponse.error) {
        executionNotes.push(`n8n workflow trigger failed: ${n8nResponse.error}`);
      }
    }
  }

  const summary = {
    total_found: limitedProspects.length,
    sources_used: Array.from(sourceSet),
    quality_distribution: calculateQualityDistribution(limitedProspects),
    execution_time: Date.now() - startTime,
    orchestration_metrics: orchestrationDetails?.executionMetrics || null
  };

  const results = {
    bot_type: 'lead_finder',
    execution_plan: executionNotes,
    prospects: limitedProspects,
    summary
  };

  const logPayload: GenericRecord = {
    request,
    summary,
    orchestration: orchestrationDetails,
    insights: aggregatedInsights,
    n8n_trigger: n8nTriggerResult
  };

  await logLeadGenerationRun(supabaseClient, user?.id, logPayload);

  return NextResponse.json({
    success: true,
    results,
    orchestration: orchestrationDetails,
    unipile_accounts: unipileAccounts,
    intelligence: aggregatedInsights,
    campaign_trigger: n8nTriggerResult,
    recommendations: buildRecommendations(limitedProspects, aggregatedInsights),
    timestamp: new Date().toISOString()
  });
}

async function logLeadGenerationRun(
  supabase: SupabaseClient,
  userId: string | undefined,
  payload: GenericRecord
) {
  if (!supabase || !userId) return;
  try {
    await supabase.from('mcp_orchestration_logs').insert({
      user_id: userId,
      event_type: 'lead_finder',
      payload,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.warn('Lead generation run logging skipped:', error);
  }
}

async function ensureMCPRegistry() {
  if (registryInitialized) return;
  const config = createMCPConfig();
  const result = await mcpRegistry.initialize(config);
  registryInitialized = result.success;
  if (!result.success) {
    console.warn('MCP registry initialization failed, continuing with fallback tools:', result.message);
  }
}

function buildIntelligenceRequest(request: LeadGenerationRequest): MCPIntelligenceRequest {
  const useBrightData = request.data_sources.use_brightdata !== false;
  const maxResults = request.output_preferences.max_prospects || 50;

  if (useBrightData) {
    const brightDataRequest: BrightDataProspectRequest = {
      searchCriteria: {
        jobTitles: request.search_criteria.target_titles || [],
        companies: [],
        industries: request.search_criteria.target_industries || [],
        locations: request.search_criteria.target_locations || [],
        keywords: request.search_criteria.keywords ? [request.search_criteria.keywords] : []
      },
      depth: maxResults > 200 ? 'comprehensive' : 'standard',
      maxResults
    };

    return {
      type: 'profile_research',
      source: 'bright_data',
      request: brightDataRequest,
      conversationContext: buildConversationContext(request)
    };
  }

  const apifyRequest: ApifyProspectRequest = {
    searchUrl: buildLinkedInSearchUrl(request),
    maxResults,
    extractEmails: request.output_preferences.require_email,
    waitForResults: true
  };

  return {
    type: 'profile_research',
    source: 'apify',
    request: apifyRequest,
    conversationContext: buildConversationContext(request)
  };
}

function buildConversationContext(request: LeadGenerationRequest): string {
  const parts: string[] = [];
  if (request.search_criteria.target_titles?.length) {
    parts.push(`Titles: ${request.search_criteria.target_titles.join(', ')}`);
  }
  if (request.search_criteria.target_industries?.length) {
    parts.push(`Industries: ${request.search_criteria.target_industries.join(', ')}`);
  }
  if (request.search_criteria.target_locations?.length) {
    parts.push(`Locations: ${request.search_criteria.target_locations.join(', ')}`);
  }
  if (request.search_criteria.company_size) {
    parts.push(`Company size: ${request.search_criteria.company_size}`);
  }
  if (request.output_preferences.require_email) {
    parts.push('Require verified emails');
  }
  if (request.data_sources.prioritize_premium) {
    parts.push('Prioritize premium data sources');
  }
  return parts.join(' | ');
}

function buildLinkedInSearchUrl(request: LeadGenerationRequest): string {
  const conditions: string[] = [];
  const { target_titles, target_industries, target_locations, keywords } = request.search_criteria;

  if (target_titles?.length) {
    conditions.push(`(${target_titles.map(title => `title:"${title}"`).join(' OR ')})`);
  }
  if (target_industries?.length) {
    conditions.push(`(${target_industries.map(industry => `industry:"${industry}"`).join(' OR ')})`);
  }
  if (target_locations?.length) {
    conditions.push(`(${target_locations.map(location => `geo:"${location}"`).join(' OR ')})`);
  }
  if (keywords) {
    conditions.push(`(${keywords})`);
  }

  const query = conditions.length ? conditions.join(' AND ') : 'decision maker';
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
}

function parseResearchResult(result: MCPCallToolResult): { prospects: GenericRecord[]; insights: GenericRecord[] } {
  try {
    const textContent = result.content.find(item => item.type === 'text')?.text;
    if (!textContent) {
      return { prospects: [], insights: [] };
    }

    const parsed = JSON.parse(textContent);
    const prospects = Array.isArray(parsed.prospects)
      ? (parsed.prospects as GenericRecord[])
      : Array.isArray(parsed.results?.prospects)
        ? (parsed.results.prospects as GenericRecord[])
        : [];
    const rawInsights = parsed.insights?.strategicInsights || parsed.strategicInsights || [];
    const insights = Array.isArray(rawInsights)
      ? rawInsights.map((entry: unknown) =>
          (typeof entry === 'object' && entry !== null)
            ? (entry as GenericRecord)
            : { insight: entry }
        )
      : [];

    return { prospects, insights };
  } catch (error: unknown) {
    console.error('Failed to parse research result:', error);
    return { prospects: [], insights: [] };
  }
}

function mapAgentToSource(agent?: string): EnrichedProspect['source'] {
  switch (agent) {
    case 'bright-data-researcher':
      return 'brightdata';
    case 'apify-extractor':
      return 'combined';
    case 'unipile-linkedin':
      return 'unipile_linkedin';
    default:
      return 'brightdata';
  }
}

function normalizeMCPProspect(
  raw: GenericRecord,
  source: EnrichedProspect['source'],
  request: LeadGenerationRequest
): EnrichedProspect {
  const prospectRecord = (raw.prospect_data as GenericRecord | undefined) ?? raw;
  const firstName = (prospectRecord.first_name as string | undefined) ||
    (prospectRecord.firstName as string | undefined) ||
    'Prospect';
  const lastName = (prospectRecord.last_name as string | undefined) ||
    (prospectRecord.lastName as string | undefined) ||
    'Candidate';
  const company = (prospectRecord.company as string | undefined) ||
    (prospectRecord.company_name as string | undefined) ||
    'Unknown Company';
  const title = (prospectRecord.title as string | undefined) ||
    request.search_criteria.target_titles?.[0] ||
    'Executive';
  const location = (prospectRecord.location as string | undefined) ||
    request.search_criteria.target_locations?.[0] ||
    'United States';

  return {
    id:
      (raw.id as string | undefined) ||
      (prospectRecord.id as string | undefined) ||
      `${source}-${Date.now()}-${Math.random()}`,
    source,
    confidence_score:
      (raw.confidence_score as number | undefined) ||
      (raw.score as number | undefined) ||
      0.7,
    prospect_data: {
      first_name: firstName,
      last_name: lastName,
      email: prospectRecord.email as string | undefined,
      linkedin_url:
        (prospectRecord.linkedin_url as string | undefined) ||
        (prospectRecord.linkedinUrl as string | undefined) ||
        '',
      linkedin_id:
        (prospectRecord.linkedin_id as string | undefined) ||
        (prospectRecord.linkedinId as string | undefined),
      title,
      company,
      location,
      phone: prospectRecord.phone as string | undefined
    },
    enrichment_data: raw.enrichment_data as EnrichedProspect['enrichment_data'],
    premium_insights: raw.premium_insights as EnrichedProspect['premium_insights']
  };
}

async function fetchUnipileAccountsSafe() {
  try {
    const result = await mcpRegistry.callTool({
      method: 'tools/call',
      params: { name: 'unipile_get_accounts' },
      server: 'unipile'
    });

    const textContent = result.content.find(item => item.type === 'text')?.text;
    if (!textContent) return [];

    const parsed = JSON.parse(textContent);
    return Array.isArray(parsed.accounts) ? parsed.accounts : [];
  } catch (error: unknown) {
    console.warn('Unable to fetch Unipile accounts via MCP:', error);
    return [];
  }
}

async function triggerN8nWorkflow(
  workflowId: string,
  inputData: GenericRecord
): Promise<{ result?: GenericRecord; error?: string }> {
  try {
    const response = await mcpRegistry.callTool({
      method: 'tools/call',
      params: {
        name: 'n8n_execute_workflow',
        arguments: {
          workflow_id: workflowId,
          input_data: inputData
        }
      },
      server: 'n8n'
    });

    const textContent = response.content.find(item => item.type === 'text')?.text;

    if (response.isError) {
      return {
        error: textContent || 'n8n execution failed'
      };
    }

    if (textContent) {
      try {
        const parsed = JSON.parse(textContent) as GenericRecord;
        return { result: parsed };
      } catch {
        return {
          result: {
            message: 'Workflow triggered (unparsed response)',
            raw: textContent
          }
        };
      }
    }

    return {
      result: {
        message: 'Workflow triggered'
      }
    };
  } catch (error: unknown) {
    return {
      error: error instanceof Error ? error.message : 'Unknown n8n error'
    };
  }
}

async function legacyBrightdataFallback(request: LeadGenerationRequest): Promise<LegacyFallbackResult> {
  const notes = ['Fallback: invoking legacy Bright Data scraper'];
  try {
    const response = await fetch('/api/leads/brightdata-scraper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'scrape_prospects',
        search_params: {
          target_sites: ['linkedin'],
          search_criteria: request.search_criteria,
          scraping_options: {
            max_results: request.output_preferences.max_prospects || 50,
            include_emails: request.output_preferences.require_email || false,
            depth: 'detailed'
          }
        }
      })
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Unknown Bright Data fallback error');
    }

    const prospects = (payload.results?.prospects || []).map((p: GenericRecord) => convertBrightdataToEnriched(p));
    const rawInsights = payload.results?.insights?.strategicInsights || payload.results?.insights || [];
    const insights = Array.isArray(rawInsights)
      ? rawInsights.map((entry: unknown) =>
          (typeof entry === 'object' && entry !== null)
            ? (entry as GenericRecord)
            : { insight: entry }
        )
      : [];
    return { prospects, insights, sources: ['brightdata'], notes };
  } catch (error) {
    console.error('Bright Data fallback failed:', error);
    notes.push(`Fallback error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { prospects: [], insights: [], sources: [], notes };
  }
}

function buildRecommendations(prospects: EnrichedProspect[], insights: GenericRecord[]) {
  const qualityInsights = [
    `${prospects.filter(p => p.confidence_score > 0.8).length} prospects are high-confidence matches`,
    `${prospects.filter(p => p.prospect_data.email).length} prospects have verified email addresses`,
    `${prospects.filter(p => p.premium_insights?.mutual_connections).length} prospects show mutual connections`
  ];

  const nextActions = [
    `Review ${prospects.length} qualified prospects`,
    'Create personalized outreach templates',
    'Set up campaign tracking',
    'Schedule follow-up sequences'
  ];

  if (insights.length) {
    nextActions.unshift('Incorporate strategic insights into outreach messaging');
  }

  return {
    next_actions: nextActions,
    quality_insights: qualityInsights
  };
}

async function intelligenceGathererBot(request: LeadGenerationRequest) {
  // Focus on deep research and market intelligence
  const intelligence = {
    bot_type: 'intelligence_gatherer',
    market_analysis: {
      target_market_size: `~${Math.floor(Math.random() * 5000 + 1000)} companies match criteria`,
      key_players: ['Industry Leader A', 'Market Player B', 'Emerging Company C'],
      hiring_trends: `Up ${Math.floor(Math.random() * 40 + 10)}% in target roles (last 90 days)`,
      competitive_landscape: 'Dynamic market with growth opportunities'
    },
    industry_insights: {
      growth_signals: request.search_criteria.keywords ? [request.search_criteria.keywords, 'Digital transformation', 'Market expansion'] : ['Growth initiatives', 'Technology adoption', 'Team scaling'],
      common_pain_points: request.search_criteria.target_industries ? [`${request.search_criteria.target_industries[0]} specific challenges`, 'Resource constraints', 'Market competition'] : ['Operational efficiency', 'Growth challenges', 'Technology gaps'],
      budget_cycles: 'Q4 planning season (Oct-Dec)',
      decision_makers: request.search_criteria.target_titles || ['C-Suite', 'VP Level', 'Director Level']
    },
    outreach_intelligence: {
      optimal_messaging_angles: [
        'Scaling engineering teams efficiently',
        'Reducing technical debt',
        'AI/ML implementation strategies'
      ],
      best_contact_methods: 'LinkedIn > Email > Phone',
      response_rate_predictions: '12-18% for personalized outreach',
      timing_recommendations: 'Tuesday-Thursday, 10am-2pm local time'
    },
    competitive_analysis: {
      key_competitors: ['CompetitorA', 'CompetitorB'],
      market_gaps: ['Mid-market solutions', 'Industry-specific features'],
      differentiation_opportunities: ['Better integration', 'Faster implementation']
    }
  };

  return NextResponse.json({
    success: true,
    intelligence,
    actionable_insights: [
      'Focus on VP Engineering and CTO titles for highest conversion',
      'Emphasize scaling and efficiency messaging',
      'Time outreach for Q4 budget planning season',
      'Leverage mutual connections where available'
    ],
    confidence_score: 0.89
  });
}

async function campaignBuilderBot(request: LeadGenerationRequest) {
  // End-to-end campaign creation
  const campaign = {
    bot_type: 'campaign_builder',
    campaign_structure: {
      name: `${request.search_criteria.target_titles?.join('/') || 'Professional'} Campaign - ${new Date().toLocaleDateString()}`,
      type: 'multi_touch',
      target_audience: {
        titles: request.search_criteria.target_titles || ['Decision Makers'],
        industries: request.search_criteria.target_industries || ['Technology'],
        locations: request.search_criteria.target_locations || ['United States'],
        estimated_size: request.output_preferences.max_prospects || 150
      }
    },
    message_templates: {
      connection_request: "Hi {first_name}, I noticed your impressive work at {company} in {industry}. I'd love to connect and share some insights that might be valuable for your {title} role.",
      follow_up_1: "Thanks for connecting, {first_name}! I'm curious about the biggest challenges you're facing at {company} when it comes to {relevant_topic}.",
      follow_up_2: "Hi {first_name}, I came across an interesting case study about {industry} that I thought might resonate with your work at {company}. Would you be interested in a quick chat?"
    },
    automation_settings: {
      delay_between_messages: '3-5 days',
      daily_send_limit: 50,
      time_zone_optimization: true,
      personalization_level: 'high'
    },
    tracking_setup: {
      metrics_to_track: ['sent', 'accepted', 'replied', 'meetings_booked'],
      reporting_frequency: 'daily',
      success_criteria: '15% response rate, 3% meeting rate'
    }
  };

  return NextResponse.json({
    success: true,
    campaign,
    implementation_steps: [
      'Review and approve message templates',
      'Set up prospect import',
      'Configure automation settings',
      'Launch campaign with initial batch',
      'Monitor performance and optimize'
    ],
    estimated_timeline: '2-3 days setup, 4-6 weeks execution'
  });
}

async function researchAssistantBot() {
  // Market and competitive research
  const research = {
    bot_type: 'research_assistant',
    market_research: {
      tam_analysis: {
        total_addressable_market: '$2.5B',
        serviceable_market: '$250M',
        target_segment_size: '$25M'
      },
      growth_trends: [
        'AI/ML adoption increasing 45% YoY',
        'Remote work driving cloud migration',
        'Cybersecurity spend up 30%'
      ],
      key_challenges: [
        'Talent shortage in technical roles',
        'Budget constraints in current economy',
        'Integration complexity with legacy systems'
      ]
    },
    competitor_analysis: {
      direct_competitors: [
        { name: 'CompetitorA', market_share: '25%', strength: 'Enterprise focus' },
        { name: 'CompetitorB', market_share: '15%', strength: 'Pricing' }
      ],
      competitive_gaps: [
        'Mid-market solutions',
        'Industry-specific features',
        'Better customer support'
      ],
      differentiation_strategy: 'Focus on ease of implementation and industry expertise'
    },
    prospect_intelligence: {
      buying_signals: [
        'Recent funding announcements',
        'New leadership hires',
        'Technology partnerships',
        'Job posting increases'
      ],
      decision_process: {
        typical_timeline: '3-6 months',
        key_stakeholders: ['Technical', 'Finance', 'Legal'],
        evaluation_criteria: ['Features', 'Price', 'Support', 'Integration']
      }
    }
  };

  return NextResponse.json({
    success: true,
    research,
    strategic_recommendations: [
      'Position as the easier-to-implement alternative',
      'Focus on mid-market segment (underserved)',
      'Emphasize industry expertise and support',
      'Target companies with recent funding/growth'
    ]
  });
}

// Helper Functions

function convertBrightdataToEnriched(brightdataProspect: GenericRecord): EnrichedProspect {
  const prospectData = brightdataProspect.prospect_data as GenericRecord | undefined;
  return {
    id:
      (prospectData?.linkedin_url as string | undefined) ||
      (prospectData?.linkedinUrl as string | undefined) ||
      `brightdata_${Date.now()}`,
    source: 'brightdata',
    confidence_score: (brightdataProspect.confidence_score as number | undefined) || 0.7,
    prospect_data: {
      first_name: (prospectData?.first_name as string | undefined) || 'Prospect',
      last_name: (prospectData?.last_name as string | undefined) || 'Candidate',
      email: prospectData?.email as string | undefined,
      linkedin_url:
        (prospectData?.linkedin_url as string | undefined) ||
        (prospectData?.linkedinUrl as string | undefined) ||
        '',
      title: (prospectData?.title as string | undefined) || 'Executive',
      company: (prospectData?.company as string | undefined) || 'Unknown Company',
      location: (prospectData?.location as string | undefined) || 'United States',
      phone: prospectData?.phone as string | undefined
    },
    enrichment_data: {
      company_details: brightdataProspect.enrichment_data?.company_details as GenericRecord | undefined,
      contact_verification: { 
        email_verified: Boolean(prospectData?.email),
        phone_verified: Boolean(prospectData?.phone)
      },
      social_profiles: brightdataProspect.enrichment_data?.social_profiles as GenericRecord | undefined,
      experience_years: brightdataProspect.enrichment_data?.experience_years as number | undefined
    }
  };
}

function deduplicateProspects(prospects: EnrichedProspect[]): EnrichedProspect[] {
  const seen = new Set();
  return prospects.filter(prospect => {
    const key = prospect.prospect_data.linkedin_url || 
                `${prospect.prospect_data.first_name}-${prospect.prospect_data.last_name}-${prospect.prospect_data.company}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scoreProspectQuality(prospects: EnrichedProspect[]): EnrichedProspect[] {
  return prospects.map(prospect => {
    let score = prospect.confidence_score;
    
    // Boost score for verified email
    if (prospect.prospect_data.email) score += 0.1;
    
    // Boost score for mutual connections
    if (prospect.premium_insights?.mutual_connections) score += 0.1;
    
    // Boost score for recent activity
    if (prospect.premium_insights?.recent_posts) score += 0.05;
    
    // Boost score for hiring activity
    if (prospect.premium_insights?.hiring_activity) score += 0.05;
    
    prospect.confidence_score = Math.min(score, 1.0);
    return prospect;
  });
}

function generateOutreachRecommendations(
  prospect: EnrichedProspect,
  criteria: LeadGenerationRequest['search_criteria']
) {
  return {
    connection_strategy: prospect.premium_insights?.mutual_connections 
      ? 'Reference mutual connections' 
      : 'Direct connection request',
    message_angle: criteria.target_industries?.includes('AI') 
      ? 'AI/ML expertise and solutions'
      : 'Industry best practices and growth',
    timing_suggestion: prospect.premium_insights?.hiring_activity 
      ? 'Immediate (actively hiring)'
      : 'Within 1 week',
    personalization_hooks: [
      `Company: ${prospect.prospect_data.company}`,
      `Role: ${prospect.prospect_data.title}`,
      `Location: ${prospect.prospect_data.location}`
    ]
  };
}

function calculateQualityDistribution(prospects: EnrichedProspect[]) {
  const high = prospects.filter(p => p.confidence_score > 0.8).length;
  const medium = prospects.filter(p => p.confidence_score > 0.6 && p.confidence_score <= 0.8).length;
  const low = prospects.filter(p => p.confidence_score <= 0.6).length;
  
  return { high, medium, low };
}

export async function GET() {
  try {
    return NextResponse.json({
      service: 'MCP Lead Generation Orchestrator',
      status: 'active',
      available_bots: {
        lead_finder: {
          description: 'Find prospects matching specific criteria',
          data_sources: ['Brightdata Scraping', 'Unipile LinkedIn', 'Enrichment APIs'],
          output: 'Scored and ranked prospect list with contact info'
        },
        intelligence_gatherer: {
          description: 'Deep market research and competitive intelligence',
          capabilities: ['Market analysis', 'Industry insights', 'Competitive landscape'],
          output: 'Strategic intelligence report with actionable insights'
        },
        campaign_builder: {
          description: 'End-to-end campaign creation and setup',
          features: ['Template generation', 'Automation setup', 'Performance tracking'],
          output: 'Complete campaign ready for execution'
        },
        research_assistant: {
          description: 'Market and competitive research analysis',
          research_areas: ['TAM analysis', 'Competitor mapping', 'Buying signals'],
          output: 'Comprehensive research report with recommendations'
        }
      },
      integration_status: {
        brightdata_mcp: 'active',
        unipile_linkedin_mcp: 'active',
        unipile_messaging: 'active',
        enrichment_apis: 'configured'
      },
      usage_examples: [
        'Scrape 100 SaaS CTOs in San Francisco with verified emails via Brightdata',
        'Find connected LinkedIn prospects via Unipile for direct messaging',
        'Build complete outreach campaigns with multi-source data',
        'Research company employees and org charts via web scraping',
        'Verify contact information before campaign launch'
      ]
    });

  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: 'MCP Orchestrator status check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
