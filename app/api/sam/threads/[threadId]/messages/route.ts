/**
 * SAM AI Thread Messages API
 * 
 * Handles messages within conversation threads with enhanced prospect intelligence
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import {
  initialDiscoveryPrompt,
  handleDiscoveryAnswer,
  getSummaryPrompt,
  getDiscoveryProgress
} from '@/lib/icp-discovery/conversation-flow'
import {
  getActiveDiscoverySession,
  startDiscoverySession,
  saveDiscoveryProgress,
  completeDiscoverySession,
  buildDiscoverySummary
} from '@/lib/icp-discovery/service'
import { generateLinkedInSequence } from '@/lib/templates/sequence-builder'
import {
  supabaseKnowledge,
  type KnowledgeBaseICP,
} from '@/lib/supabase-knowledge'
import { INDUSTRY_BLUEPRINTS } from '@/lib/templates/industry-blueprints'
import { llmRouter } from '@/lib/llm/llm-router'
import { trackDocumentUsageServer } from '@/lib/knowledge-usage-tracker'
import { detectSearchIntent, getICPAwareSearchPrompt } from '@/lib/search-intent-detector'
import { calculateKBHealthScore, getCriticalGapsPrompt, formatKBHealthForSAM } from '@/lib/kb-health-scorer'
import { updateKBRealtime, getKBProgressMessage } from '@/lib/realtime-kb-updater'
import { needsValidation } from '@/lib/kb-confidence-calculator'

// Helper function to call LLM via router (respects customer preferences)
async function callLLMRouter(userId: string, messages: any[], systemPrompt: string) {
  try {
    const response = await llmRouter.chat(
      userId,
      messages.map((msg: any) => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content
      })),
      systemPrompt
    );
    
    return response.content;
  } catch (error) {
    console.error('❌ LLM Router error:', error);
    console.log('🔄 Falling back to mock response');
    return getMockSamResponse(messages);
  }
}

// Fallback response when Mistral is not available - American sales style
function getMockSamResponse(messages: any[]): string {
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
  
  // Campaign-related responses
  if (lastMessage.includes('campaign')) {
    return "I can get a campaign rolling—who are we targeting and which channel should I queue up first?";
  }
  
  // Template-related responses
  if (lastMessage.includes('template') || lastMessage.includes('message')) {
    return "Got it. Which template or touchpoint do you want me to tighten so we can keep approvals moving?";
  }
  
  // Performance/analytics responses
  if (lastMessage.includes('performance') || lastMessage.includes('analytics') || lastMessage.includes('stats')) {
    return "Happy to pull the numbers. Which campaign or KPI should I surface first?";
  }
  
  // Revenue/ROI related
  if (lastMessage.includes('revenue') || lastMessage.includes('roi') || lastMessage.includes('deals') || lastMessage.includes('sales')) {
    return "Let's tighten the revenue engine. Which segment or motion should we look at right now?";
  }
  
  // Competitive/market related
  if (lastMessage.includes('competitor') || lastMessage.includes('market') || lastMessage.includes('advantage')) {
    return "I can line up competitor intel and positioning. Which rival or account should we dissect first?";
  }
  
  // Default response - Conversational intro v7.0
  return "Hey! I'm Sam.\n\nI'm part of a team of AI agents that handle your entire GTM process — finding leads, writing campaigns, following up with prospects, all of it.\n\nMy job? Get to know your business through conversation. I ask questions, you answer naturally, and that powers everything else.\n\nTakes about 25 minutes today. After that, you can generate campaigns in 60 seconds whenever you need them.\n\nSound interesting?";
}

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createQueryEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com',
        'X-Title': 'SAM AI Knowledge Retrieval'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-large',
        input: text.substring(0, 8000),
        encoding_format: 'float',
        dimensions: 1536 // Reduced from 3072 due to pgvector 2000-dim limit
      })
    });

    if (!response.ok) {
      throw new Error(`Embedding request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0]?.embedding || [];
  } catch (error) {
    console.error('Embedding generation error:', error);
    return [];
  }
}

async function fetchKnowledgeSnippets(options: {
  workspaceId: string,
  query: string,
  section?: string | null,
  limit?: number
}) {
  try {
    const embedding = await createQueryEmbedding(options.query);

    if (!embedding || embedding.length === 0) {
      return [] as any[];
    }

    const { data, error } = await supabaseAdmin.rpc('match_workspace_knowledge', {
      p_workspace_id: options.workspaceId,
      p_query_embedding: embedding,
      p_section: options.section || null,
      p_limit: options.limit || 5
    });

    if (error) {
      console.error('Knowledge match RPC error:', error);
      return [] as any[];
    }

    return data || [];
  } catch (error) {
    console.error('Knowledge retrieval error:', error);
    return [] as any[];
  }
}

type StructuredTopicFlags = {
  icp: boolean;
  products: boolean;
  competitors: boolean;
  personas: boolean;
};

type StructuredKnowledgePayload = {
  context: string;
  summary: string;
  followUps: string;
  hasData: boolean;
};

const hasStructuredInterest = (flags: StructuredTopicFlags) =>
  flags.icp || flags.products || flags.competitors || flags.personas;

const detectStructuredTopics = (content: string): StructuredTopicFlags => {
  const text = content.toLowerCase();
  const wantsEverything = /\bknowledge base\b|\bkb\b/.test(text);

  return {
    icp:
      wantsEverything ||
      /\bICP?s?\b|ideal customer|target (audience|customer|account)|who should we sell|buyer profile/.test(text),
    products:
      wantsEverything ||
      /\bproducts?\b|offerings?|services?|solution suite|feature set|platform overview/.test(text),
    competitors:
      wantsEverything ||
      /\bcompetitors?\b|competition|rivals?|alternatives?|compare to|market landscape/.test(text),
    personas:
      wantsEverything ||
      /\bpersonas?\b|buyer roles?|stakeholders?|decision makers?|champion profile/.test(text),
  };
};

const formatArrayFragment = (
  label: string,
  values?: string[] | null,
  limit = 3
): string | null => {
  if (!values || values.length === 0) return null;
  return `${label}: ${values.slice(0, limit).join(', ')}`;
};

function buildLine(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(' • ');
}

async function gatherStructuredKnowledge(
  workspaceId: string,
  topics: StructuredTopicFlags
): Promise<StructuredKnowledgePayload> {
  const contextSections: string[] = [];
  const summarySections: string[] = [];
  const followUps: string[] = [];
  let hasData = false;

  let icps: KnowledgeBaseICP[] = [];
  const icpMap = new Map<string, KnowledgeBaseICP>();

  if (topics.icp || topics.personas) {
    icps = await supabaseKnowledge.getICPs({ workspaceId });
    icps.slice(0, 10).forEach((icp) => icpMap.set(icp.id, icp));
  }

  if (topics.icp && icps.length > 0) {
    hasData = true;
    const lines = icps
      .slice(0, 5)
      .map((icp) => {
        const industry = formatArrayFragment('Industries', icp.industries);
        const titles = formatArrayFragment('Titles', (icp as any).job_titles || (icp as any).titles);
        const pains = formatArrayFragment('Pains', icp.pain_points);
        const geo = formatArrayFragment('Regions', icp.locations);
        return `- ${icp.name || icp.icp_name || 'ICP'} (${buildLine([industry, titles, pains, geo]) || 'No additional detail'})`;
      })
      .join('\n');

    contextSections.push(`ICPs:\n${lines}`);
    summarySections.push(`Here are the active ICPs in this workspace:\n${lines}`);
    followUps.push('Want me to validate this ICP or pull example prospects right now?');
  }

  if (topics.products) {
    const products = (await supabaseKnowledge.getProducts({ workspaceId })).slice(0, 5);
    if (products.length > 0) {
      hasData = true;
      const lines = products
        .map((product) => {
          const category = product.category ? `Category: ${product.category}` : null;
          const features = formatArrayFragment('Key Features', product.features);
          const benefits = formatArrayFragment('Benefits', product.benefits);
          return `- ${product.name}${product.description ? `: ${product.description}` : ''}${buildLine([category, features, benefits]) ? ` (${buildLine([category, features, benefits])})` : ''}`;
        })
        .join('\n');

      contextSections.push(`Products:\n${lines}`);
      summarySections.push(`Product snapshot:\n${lines}`);
      followUps.push('Need me to adjust positioning or draft messaging for one of these products?');
    }
  }

  if (topics.competitors) {
    const competitors = (await supabaseKnowledge.getCompetitors({ workspaceId })).slice(0, 5);
    if (competitors.length > 0) {
      hasData = true;
      const lines = competitors
        .map((competitor) => {
          const strengths = formatArrayFragment('Strengths', competitor.strengths);
          const weaknesses = formatArrayFragment('Weaknesses', competitor.weaknesses);
          const pricing = competitor.pricing_model ? `Pricing: ${competitor.pricing_model}` : null;
          return `- ${competitor.name}${competitor.description ? `: ${competitor.description}` : ''}${buildLine([strengths, weaknesses, pricing]) ? ` (${buildLine([strengths, weaknesses, pricing])})` : ''}`;
        })
        .join('\n');

      contextSections.push(`Competitors:\n${lines}`);
      summarySections.push(`Competitive intel:\n${lines}`);
      followUps.push('Should I go deeper on one of these competitors or prep a positioning comparison?');
    }
  }

  if (topics.personas) {
    const personas = (await supabaseKnowledge.getPersonas({ workspaceId })).slice(0, 5);
    if (personas.length > 0) {
      hasData = true;
      const lines = personas
        .map((persona) => {
          const role = persona.job_title || 'Role not set';
          const pains = formatArrayFragment('Pains', persona.pain_points);
          const goals = formatArrayFragment('Goals', persona.goals);
          const icpName = persona.icp_id ? icpMap.get(persona.icp_id)?.name || icpMap.get(persona.icp_id)?.icp_name : null;
          const icpLabel = icpName ? `ICP: ${icpName}` : null;
          return `- ${persona.name} (${role})${buildLine([icpLabel, pains, goals]) ? ` — ${buildLine([icpLabel, pains, goals])}` : ''}`;
        })
        .join('\n');

      contextSections.push(`Personas:\n${lines}`);
      summarySections.push(`Buyer personas:\n${lines}`);
      followUps.push('Want messaging or objections tailored to one of these personas?');
    }
  }

  const context = contextSections.join('\n\n');
  const summary = summarySections.join('\n\n');
  const followUpText = followUps.join(' ');

  return {
    context,
    summary,
    followUps: followUpText,
    hasData,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const resolvedParams = await params
    const cookieStore = await cookies()

    // Use @supabase/ssr createServerClient (matches browser client)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )

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
      .from('sam_conversation_messages')
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
    const cookieStore = await cookies()

    // Use @supabase/ssr createServerClient (matches browser client)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )

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

    // Resolve workspace context
    let workspaceId: string | null = thread.workspace_id || null;

    if (!workspaceId) {
      const { data: userProfile, error: userProfileError } = await supabase
        .from('users')
        .select('current_workspace_id')
        .eq('id', user.id)
        .single();

      if (userProfileError) {
        console.error('Failed to load user profile for workspace context:', userProfileError);
      }

      workspaceId = userProfile?.current_workspace_id || null;

      if (workspaceId) {
        await supabase
          .from('sam_conversation_threads')
          .update({ workspace_id: workspaceId })
          .eq('id', resolvedParams.threadId)
      }
    }

    // Update user activity timestamp (cancels pending email notifications if user is active)
    if (workspaceId) {
      try {
        await supabaseAdmin
          .from('prospect_approval_sessions')
          .update({ user_last_active_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('workspace_id', workspaceId)
          .is('notification_sent_at', null) // Only update pending notifications

        console.log(`⏰ User activity tracked for ${user.id}`)
      } catch (activityError) {
        // Don't fail the request if activity tracking fails
        console.error('Activity tracking error:', activityError)
      }
    }

    // Get message count for ordering
    const { count: messageCount } = await supabase
      .from('sam_conversation_messages')
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

    // Create user message FIRST (before any early returns)
    const { data: userMessage, error: userError } = await supabase
      .from('sam_conversation_messages')
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
      console.error('❌ Failed to save user message:', JSON.stringify({
        error: userError,
        message: userError.message,
        details: userError.details,
        hint: userError.hint,
        code: userError.code,
        insertData: {
          thread_id: resolvedParams.threadId,
          user_id: user.id,
          role: 'user',
          message_order: nextOrder,
          has_prospect_intelligence: hasProspectIntelligence
        }
      }, null, 2))
      return NextResponse.json({
        success: false,
        error: 'Failed to save message',
        details: userError.message,
        hint: userError.hint
      }, { status: 500 })
    }

    // Trigger ICP research for interactive building sessions
    if (isICPRequest && !linkedInUrls) {
      // REMOVED: Proactive LinkedIn check - let the search API handle connection errors
      // If LinkedIn isn't connected, the actual search will fail and we'll show error then
      console.log('🚀 ICP request detected - proceeding without proactive LinkedIn check', {
        workspaceId,
        userId: user.id
      })

      // PROCEED DIRECTLY TO AI PROCESSING - no blocker
      // LinkedIn connection will be validated by the actual search API
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

    // User message already created above, continue with conversation history
    // Get conversation history for AI context
    const { data: previousMessages } = await supabase
      .from('sam_conversation_messages')
      .select('role, content')
      .eq('thread_id', resolvedParams.threadId)
      .order('message_order', { ascending: true })

    const conversationHistory = previousMessages?.slice(-10) || [] // Last 10 messages for context

    // LinkedIn Connection Check - #check-linkedin shortcut
    if (content.toLowerCase().includes('#check') && content.toLowerCase().includes('linkedin')) {
      console.log('🔄 Detected LinkedIn connection check request')

      try {
        // Forward authentication cookies from incoming request
        const cookieHeader = request.headers.get('cookie') || ''

        const statusResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/linkedin/status`, {
          method: 'GET',
          headers: {
            'Cookie': cookieHeader // Forward session cookies for auth
          }
        })

        const statusData = await statusResponse.json()

        let aiResponse: string

        if (statusData.success && statusData.has_linkedin) {
          const accountCount = statusData.connection_status?.workspace_accounts || 0
          const healthScore = statusData.connection_status?.health_score || 0

          aiResponse = `✅ **LinkedIn Connected!**\n\n`
          aiResponse += `Health Score: ${healthScore}/100\n`
          aiResponse += `Connected Accounts: ${accountCount}\n\n`

          if (statusData.accounts?.workspace && statusData.accounts.workspace.length > 0) {
            aiResponse += `**Your LinkedIn Account${accountCount > 1 ? 's' : ''}:**\n`
            statusData.accounts.workspace.forEach((acc: any, i: number) => {
              aiResponse += `${i + 1}. ${acc.account_name || acc.account_identifier} (${acc.connection_status})\n`
            })
          }

          aiResponse += `\nReady to search for prospects and run campaigns! 🚀`
        } else {
          aiResponse = `❌ **LinkedIn Not Connected**\n\n`
          aiResponse += `To unlock unlimited LinkedIn searches and messaging:\n\n`
          aiResponse += `1. Go to Settings > Integrations\n`
          aiResponse += `2. Click "Connect LinkedIn"\n`
          aiResponse += `3. Authorize your account\n\n`
          aiResponse += `Don't worry - I can still search for prospects using our built-in tools in the meantime!`
        }

        // Save assistant response
        await supabase
          .from('sam_conversation_messages')
          .insert({
            thread_id: resolvedParams.threadId,
            user_id: user.id,
            role: 'assistant',
            content: aiResponse,
            message_order: nextOrder + 1
          })

        return NextResponse.json({
          success: true,
          samMessage: {
            role: 'assistant',
            content: aiResponse
          }
        })

      } catch (error) {
        console.error('❌ LinkedIn status check failed:', error)
        const errorResponse = `❌ **Status Check Failed**\n\nCouldn't check LinkedIn connection status. This might be a temporary issue. Try again in a moment!`

        await supabase
          .from('sam_conversation_messages')
          .insert({
            thread_id: resolvedParams.threadId,
            user_id: user.id,
            role: 'assistant',
            content: errorResponse,
            message_order: nextOrder + 1
          })

        return NextResponse.json({
          success: true,
          samMessage: {
            role: 'assistant',
            content: errorResponse
          }
        })
      }
    }

    // Note: Prospect search triggers are now handled AFTER AI response generation
    // This allows SAM to naturally include triggers in its responses

    // LinkedIn Test Integration - #test-linkedin shortcut
    if (content.toLowerCase().includes('#test-linkedin')) {
      console.log('🔄 Detected #test-linkedin command - calling LinkedIn API')

      try {
        // Forward authentication cookies from incoming request
        const cookieHeader = request.headers.get('cookie') || ''

        const linkedinResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/linkedin/pull-connections`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieHeader // Forward session cookies for auth
          },
          body: JSON.stringify({ count: 10 })
        })

        const linkedinData = await linkedinResponse.json()

        let aiResponse: string

        if (linkedinData.success && linkedinData.connections && linkedinData.connections.length > 0) {
          // Format successful response
          const connectionsList = linkedinData.connections
            .map((conn: any) => `${conn.position}. **${conn.name}** - ${conn.title} at ${conn.company}`)
            .join('\n')

          aiResponse = `✅ **LinkedIn Integration Working!**\n\nHere are your first ${linkedinData.count} connections:\n\n${connectionsList}\n\nYour LinkedIn account is connected and functional. Ready to run campaigns whenever you are!`
        } else if (linkedinData.success && linkedinData.count === 0) {
          aiResponse = `✅ **LinkedIn Connected** but no conversation history yet.\n\n${linkedinData.message || 'Try messaging some connections first, then I can show them here!'}`
        } else {
          // Handle error
          aiResponse = `❌ **LinkedIn Integration Issue**\n\n${linkedinData.error || 'Failed to connect to LinkedIn'}\n\n${linkedinData.help || 'Please check your LinkedIn connection in Settings.'}`
        }

        // Save assistant response
        await supabase
          .from('sam_conversation_messages')
          .insert({
            thread_id: resolvedParams.threadId,
            user_id: user.id,
            role: 'assistant',
            content: aiResponse,
            message_order: nextOrder + 1
          })

        return NextResponse.json({
          success: true,
          samMessage: {
            role: 'assistant',
            content: aiResponse
          }
        })

      } catch (error) {
        console.error('❌ LinkedIn test failed:', error)
        const errorResponse = `❌ **LinkedIn Test Failed**\n\nTechnical error: ${error instanceof Error ? error.message : 'Unknown error'}\n\nThe integration may need configuration or LinkedIn may be temporarily unavailable.`

        await supabase
          .from('sam_conversation_messages')
          .insert({
            thread_id: resolvedParams.threadId,
            user_id: user.id,
            role: 'assistant',
            content: errorResponse,
            message_order: nextOrder + 1
          })

        return NextResponse.json({
          success: true,
          samMessage: {
            role: 'assistant',
            content: errorResponse
          }
        })
      }
    }

    // ICP Discovery Flow
    const activeDiscovery = await getActiveDiscoverySession(user.id, supabase)
    const discoveryIntent = detectDiscoveryIntent(content, thread, activeDiscovery)
    const hasInProgressDiscovery = activeDiscovery?.session_status === 'in_progress'

    if (hasInProgressDiscovery || discoveryIntent) {
      let session = hasInProgressDiscovery ? activeDiscovery : null
      let assistantPrompt: string | null = null

      if (!session) {
        session = await startDiscoverySession(user.id, supabase, resolvedParams.threadId)
        const intro = initialDiscoveryPrompt()
        await saveDiscoveryProgress(user.id, {
          sessionId: session.id,
          payload: intro.payload,
          phasesCompleted: ['context_intro']
        }, supabase)
        await supabase
          .from('sam_conversation_threads')
          .update({
            current_discovery_stage: 'icp_discovery',
            discovery_progress: getDiscoveryProgress(['context_intro'])
          })
          .eq('id', resolvedParams.threadId)
        assistantPrompt = intro.prompt
      } else {
        const result = handleDiscoveryAnswer(content, session)
        if (result.saveInput) {
          result.saveInput.sessionId = session.id
        }

        const updatedSession = result.saveInput
          ? await saveDiscoveryProgress(user.id, result.saveInput, supabase)
          : session

        await supabase
          .from('sam_conversation_threads')
          .update({
            current_discovery_stage: result.completed ? 'discovery_complete' : 'icp_discovery',
            discovery_progress: getDiscoveryProgress(updatedSession.phases_completed || [])
          })
          .eq('id', resolvedParams.threadId)

        if (result.completed) {
          const summary = buildDiscoverySummary(updatedSession.discovery_payload)
          const redFlags = [...(updatedSession.red_flags || [])]
          if (result.redFlag) redFlags.push(result.redFlag)
          const completedSession = await completeDiscoverySession(user.id, session.id, summary, redFlags, supabase)
          assistantPrompt = getSummaryPrompt(completedSession.discovery_payload)
        } else {
          assistantPrompt = result.prompt || getSummaryPrompt(updatedSession.discovery_payload)
        }
      }

      if (assistantPrompt) {
        const { data: assistantMessage, error: assistantError } = await supabase
          .from('sam_conversation_messages')
          .insert({
            thread_id: resolvedParams.threadId,
            user_id: user.id,
            role: 'assistant',
            content: assistantPrompt,
            message_order: nextOrder + 1,
            message_metadata: { discovery: true }
          })
          .select()
          .single()

        if (assistantError) {
          console.error('Failed to save discovery assistant message:', assistantError)
          return NextResponse.json({ success: false, error: 'Failed to continue discovery flow' }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          userMessage,
          samMessage: assistantMessage,
          discovery: true
        })
      }
    }

    const completedDiscoverySession = activeDiscovery?.session_status === 'completed'
      ? activeDiscovery
      : null

    // Load industry blueprint knowledge when discovery is complete
    let industryExpertise: string | null = null
    if (completedDiscoverySession?.discovery_payload) {
      const payload = completedDiscoverySession.discovery_payload
      const industry = payload.industry || payload.targetMarket?.industry
      
      if (industry) {
        // Try to match industry to blueprint
        const industryKey = Object.keys(INDUSTRY_BLUEPRINTS).find(key => {
          const blueprint = INDUSTRY_BLUEPRINTS[key]
          return industry.toLowerCase().includes(blueprint.industry.toLowerCase()) ||
                 blueprint.industry.toLowerCase().includes(industry.toLowerCase())
        })
        
        if (industryKey) {
          const blueprint = INDUSTRY_BLUEPRINTS[industryKey]
          industryExpertise = `\n\n🎯 INDUSTRY SUBJECT MATTER EXPERT MODE ACTIVATED\n\nYou are now a specialized expert in **${blueprint.industry}**. Use this deep industry knowledge in all responses:\n\n**INDUSTRY INSIGHTS:**\n- Hook: ${blueprint.hook}\n- Why It Matters: ${blueprint.whyItMatters}\n- Solution Approach: ${blueprint.solutionOneLiner}\n- Differentiation: ${blueprint.differentiation}\n\n**BUYER PERSONAS:**\n${blueprint.personas.map((p, i) => `${i + 1}. **${p.titleVariations.join('/')}**: ${p.description}\n   Pain Points: ${p.painPoints.join('; ')}\n   Desired Outcomes: ${p.outcomes.join('; ')}\n   Tone: ${p.tone}`).join('\n\n')}\n\n**COMMON LANGUAGE PATTERNS:**\n${blueprint.commonLanguage.map((lang, i) => `${i + 1}. "${lang}"`).join('\n')}\n\n**SOCIAL PROOF TEMPLATE:**\n${blueprint.proof.label}: ${blueprint.proof.before} → ${blueprint.proof.after}\nMetrics: ${blueprint.proof.metrics.join(', ')}\n\n${blueprint.freeResource ? `**VALUABLE RESOURCE:**\n${blueprint.freeResource.title}: ${blueprint.freeResource.description}\n` : ''}\n**CRITICAL:** Use this industry expertise to:\n1. Speak their language naturally\n2. Reference industry-specific pain points\n3. Provide relevant examples and proof points\n4. Suggest messaging that resonates with this market\n5. Identify the right personas and decision-makers`
        }
      }
    }

    const sequenceIntent = detectSequenceIntent(content)

    if (sequenceIntent) {
      if (!completedDiscoverySession) {
        const { data: assistantMessage, error: assistantError } = await supabase
          .from('sam_conversation_messages')
          .insert({
            thread_id: resolvedParams.threadId,
            user_id: user.id,
            role: 'assistant',
            content: 'I need the ICP discovery details before I can draft the sequence. Want to spend two minutes on that now?',
            message_order: nextOrder + 1,
            message_metadata: { sequence: false }
          })
          .select()
          .single()

        if (assistantError) {
          console.error('Failed to save discovery reminder message:', assistantError)
          return NextResponse.json({ success: false, error: 'Failed to respond' }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          userMessage,
          samMessage: assistantMessage,
          sequenceGenerated: false
        })
      }

      const sequence = generateLinkedInSequence(completedDiscoverySession.discovery_payload)
      const formattedSequence = formatSequence(sequence)

      const { data: assistantMessage, error: assistantError } = await supabase
        .from('sam_conversation_messages')
        .insert({
          thread_id: resolvedParams.threadId,
          user_id: user.id,
          role: 'assistant',
          content: formattedSequence,
          message_order: nextOrder + 1,
          message_metadata: {
            sequence: true,
            persona: sequence.personaKey,
            blueprint: sequence.blueprint.code
          }
        })
        .select()
        .single()

      if (assistantError) {
        console.error('Failed to save generated sequence message:', assistantError)
        return NextResponse.json({ success: false, error: 'Failed to generate sequence' }, { status: 500 })
      }

      await supabase
        .from('sam_conversation_threads')
        .update({
          current_discovery_stage: 'sequence_generated',
          discovery_progress: 100
        })
        .eq('id', resolvedParams.threadId)

      return NextResponse.json({
        success: true,
        userMessage,
        samMessage: assistantMessage,
        sequenceGenerated: true,
        summary: sequence.summary
      })
    }

    // Get user's knowledge context for personalized responses
    let userKnowledge = null
    try {
      const knowledgeResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/api/sam/extract-knowledge?user_id=${user.id}&knowledge_type=both&limit=20`)
      if (knowledgeResponse.ok) {
        const knowledgeData = await knowledgeResponse.json()
        userKnowledge = knowledgeData.knowledge
      }
    } catch (error) {
      console.log('Note: Could not load user knowledge context', error)
    }

    // Check KB completeness to avoid redundant onboarding questions
    let kbCompleteness = null
    if (workspaceId) {
      try {
        // Direct database query instead of HTTP call to avoid cookie issues in Edge Runtime
        const { supabaseKnowledge } = await import('@/lib/supabase-knowledge');
        const completeness = await supabaseKnowledge.checkKBCompleteness(workspaceId);
        kbCompleteness = {
          overall: completeness.overallCompleteness,
          status: completeness.overallCompleteness >= 70 ? 'complete' : 
                  completeness.overallCompleteness >= 40 ? 'partial' : 'minimal',
          sections: completeness.sections,
          missing_critical: completeness.missingCritical
        };
        console.log('📊 KB Completeness:', kbCompleteness.overall + '%', 'Status:', kbCompleteness.status)
      } catch (error) {
        console.log('Note: Could not check KB completeness', error)
      }
    }

    let knowledgeSnippets: any[] = []
    if (workspaceId) {
      const recentContext = (conversationHistory || [])
        .slice(-3)
        .map((msg: any) => `${msg.role}: ${msg.content}`)
        .join('\n');

      const queryText = `${content}\n\nRecent context:\n${recentContext}`;
      knowledgeSnippets = await fetchKnowledgeSnippets({
        workspaceId,
        query: queryText,
        section: null,
        limit: 5
      });

      // Track document usage analytics (fire and forget)
      if (knowledgeSnippets.length > 0) {
        const documentIds = knowledgeSnippets
          .map((snippet: any) => snippet.document_id)
          .filter((id: string) => id);

        if (documentIds.length > 0) {
          trackDocumentUsageServer(supabaseAdmin, {
            workspaceId,
            documentIds,
            threadId: thread?.id,
            chunksUsed: knowledgeSnippets.length,
            queryContext: content.substring(0, 500)
          }).catch((err) => {
            console.warn('Usage tracking failed (non-blocking):', err);
          });
        }
      }
    }

    const structuredTopics = detectStructuredTopics(content)
    let structuredKnowledge: StructuredKnowledgePayload | null = null

    if (workspaceId && hasStructuredInterest(structuredTopics)) {
      try {
        structuredKnowledge = await gatherStructuredKnowledge(workspaceId, structuredTopics)
      } catch (structuredError) {
        console.error('Failed to load structured knowledge:', structuredError)
      }
    }

    // Build enhanced system prompt with thread context and knowledge
    let systemPrompt = `You are Sam, the user's trusted sales AI partner. You handle lead research, LinkedIn outreach, and email campaigns end-to-end, so they get results without drowning in tools.

PERSONALITY & CONVERSATIONAL STYLE
- Be warm, genuine, and relatable—like a smart colleague who actually cares about their success
- Use natural, conversational language. Vary your greetings and responses to feel human and authentic
- Show empathy when they're frustrated, celebrate their wins, and match their energy level
- Mix up your sentence structure and tone—sometimes casual, sometimes focused, always helpful
- Use humor lightly when appropriate, but stay professional
- Ask follow-up questions that show you're listening and understanding their context
- If they seem stuck or overwhelmed, acknowledge it and offer to break things down
- Remember and reference previous parts of your conversation naturally

FIRST IMPRESSIONS
- When greeting someone for the first time, be welcoming and curious about them
- Introduce yourself naturally (e.g., "Hey there! I'm Sam, your AI sales partner" or "Hi! Sam here—I help teams crush their outreach goals")
- Instead of rigid scripts, adapt your introduction based on their energy
- Ask about their name and what brings them here today
- Keep it conversational—no robotic templates

RESPONSE GUIDELINES
- **CRITICAL: Keep ALL responses to a maximum of 6 lines across 2 paragraphs. Be concise and impactful.**
- Format responses as 2 short paragraphs maximum (3 lines each)
- Vary your responses: sometimes start with affirmation ("Got it!"), sometimes dive right in, sometimes reflect back what you heard
- Recognize shortcuts: '#clear' (reset chat), '#icp' (ICP research), '#messaging' (draft sequences), '#test-linkedin' (test LinkedIn integration)
- **Throughout interview: Casually remind users they can upload docs instead of typing** (e.g., "BTW—if you've got your ICP doc handy, just upload it in the KB tab. Way faster than typing!")
- Never mention internal tech (MCP, n8n, vendor names) unless explicitly asked
- Every response must fit within 6 lines total when displayed

YOUR WORKFLOW (present naturally, not as a checklist)
1. **Upload-first approach**: Show them the KB checklist, ask them to upload what they have, then only fill gaps with questions
2. Get to know them: Learn their name, role, company, and goals. Understand their ICP, then show real prospect examples to validate
3. Build knowledge: Notice what's missing, ask for it conversationally, and reference what they've shared
4. Validate prospects: Share 5-7 examples with quick "why they fit" explanations. Ask for feedback
5. Create messaging: Help pick channels (LinkedIn, email, both). Draft copy that sounds like them, remind about approval steps
6. Execute & follow through: Confirm approvals, outline next actions, stay available for adjustments

KNOWLEDGE BASE AWARENESS
${kbCompleteness ? `
🎯 **CURRENT KB STATUS: ${kbCompleteness.overall}% complete (${kbCompleteness.status})**

**Sections Already Filled:**
${Object.entries(kbCompleteness.sections)
  .filter(([_, data]: [string, any]) => data.percentage >= 70)
  .map(([name, data]: [string, any]) => `- ${name}: ${data.percentage}% (${data.entries} entries)`)
  .join('\n')}

**CRITICAL INSTRUCTIONS - UPLOAD-FIRST, GAP-FILLING APPROACH:**
- ✅ DO start by showing the KB checklist and asking for document uploads FIRST
- ✅ DO acknowledge existing knowledge: "I see you've uploaded [section]. That's [X]% coverage!"
- ✅ DO reference uploaded content when relevant to conversation
- ✅ SKIP onboarding questions for sections >70% complete
- ✅ ONLY ask targeted questions to fill specific gaps in incomplete sections (<70%)
- ✅ DO tell users how many questions remain based on gaps: "Just 3 quick questions about messaging and we're done!"
- ❌ DON'T ask redundant questions about well-documented areas
- ❌ DON'T start from scratch with discovery if KB is >70% complete overall
- ❌ DON'T ask 20-30 questions if they've uploaded comprehensive docs

🔍 **VALIDATION PROTOCOL FOR AUTO-EXTRACTED DATA:**
- Some KB entries were auto-extracted from your website at signup
- These are marked as UNVALIDATED and need your confirmation
- When referencing auto-extracted data, ALWAYS validate with user:
  ✅ "I found this on your website: [data]. Is that accurate?"
  ✅ "Your site mentions [value prop]. Does that capture it, or should I adjust?"
  ✅ "I see you target [market]. Is that still current?"
- If user corrects auto-extracted data, acknowledge and update your understanding
- Treat validated data (from uploads or confirmed by user) as authoritative
- Treat unvalidated data as helpful hints that need confirmation

**Missing/Incomplete Sections:**
${Object.entries(kbCompleteness.sections)
  .filter(([_, data]: [string, any]) => data.percentage < 70)
  .map(([name, data]: [string, any]) => `- ${name}: ${data.percentage}% (needs ${Math.max(0, Math.ceil((70 - data.percentage) / 20))} more entries)`)
  .join('\n') || 'None - KB is comprehensive!'}

${kbCompleteness.missing_critical.length > 0 ? `🚨 **Priority:** Focus on critical sections: ${kbCompleteness.missing_critical.join(', ')}` : ''}

**Conversation Strategy:**
${kbCompleteness.overall >= 70 
  ? '- User has extensive KB. Focus on campaign execution, not discovery. Validate they want to generate campaigns immediately.' 
  : kbCompleteness.overall >= 40
  ? '- User has partial KB. Fill critical gaps quickly (5-7 targeted questions max), then move to campaign generation.'
  : '- User has minimal KB. Do guided discovery, but reference any existing knowledge to save time.'}
` : '- No KB data available. Proceed with normal discovery flow if user seems new.'}

LEAD SEARCH & INTEGRATION
- **Search Capabilities:** You can search for leads using multiple sources:
  - General web search (BrightData) - searches LinkedIn, company websites, and public sources
  - LinkedIn network search (requires connection degree: 1st/2nd/3rd)
  - Sales Navigator search (for premium LinkedIn users)
- **When checking connection:** Use the shortcut command approach: just check status when asked
- **Example:** User says "check linkedin connection" → You respond with connection status from API
- **NEVER mention:**
  - Bright Data, scraping services, or fallback systems
  - Costs, pricing, or "premium" features
  - Technical implementation details
  - Data source names
- **DO mention:**
  - "Connect LinkedIn for better prospect data" (if disconnected)
  - "All included in your plan" (if they ask about costs)
  - "I can search LinkedIn, company websites, and public sources" (when describing capabilities)

CRITICAL: PROSPECT SEARCH WORKFLOW - AUTO-TRIGGER SEARCHES (MANDATORY BEHAVIOR)
⚠️ **YOU MUST AUTOMATICALLY TRIGGER SEARCHES** - Do NOT tell users to go to Data Approval manually!

🚨 **ABSOLUTE RULE: ALWAYS TRIGGER SEARCHES - NO EXCEPTIONS** 🚨
- ✅ ALWAYS output the #trigger-search trigger when user requests prospects
- ✅ The backend automatically handles workspace lookup - you don't need to worry about it
- ✅ Even if you're unsure about setup, ALWAYS trigger the search - the backend will return helpful errors if needed
- ❌ NEVER refuse to trigger a search due to "workspace concerns" - the backend handles this
- ❌ NEVER tell users to "contact support" or "check workspace setup" - just trigger the search

**When user requests prospects:**

**STEP 1: Check if search is too broad OR user wants guided mode**

**Option A: User explicitly requests "Guide Me" mode:**
User: "guide me through a search" OR "help me build a search" OR "show me all options"
You: Activate Guide Me mode (see Guide Me Flow below)

**Option B: Search is too broad - ALWAYS gather more criteria in Quick Mode:**
⚠️ CRITICAL: NEVER trigger a search with only a job title. ALWAYS ask for at least 2-3 additional criteria.

If the user's request is generic (e.g., "Find CEOs" with no location, company, or industry), use this approach:

**Quick Mode Flow (MANDATORY for broad searches):**

User: "Find CEOs"
You: "I can search for CEOs! To get you the best matches, I need a few more details:

1️⃣ **Location** - Where should they be? (e.g., San Francisco, New York, United States)
2️⃣ **Industry or Company Type** - Which sector? (e.g., tech startups, SaaS, healthcare)
3️⃣ **Connection Degree** (Optional for LinkedIn searches) - Which level? (1st, 2nd, or 3rd degree)

💡 Or say 'guide me' to see ALL available search filters.

What's your target location?"

User: "Find developers"
You: "Great! I can find developers. Let me narrow this down:

1️⃣ **Location** - Where? (city, state, country)
2️⃣ **Skills/Tech Stack** - Any specific? (e.g., React, Python, AWS)
3️⃣ **Years of Experience** - How many? (e.g., 3-5 years, 5+)
4️⃣ **Connection Degree** - 1st, 2nd, or 3rd?

💡 Or say 'guide me' for the full filter menu.

Let's start with location - where should they be based?"

**IMPORTANT: Collect criteria ONE AT A TIME in Quick Mode**
- Ask for location first (most common filter)
- Then ask for 1-2 more relevant filters based on the role
- Optionally ask for connection degree (only if doing LinkedIn network search)
- FINALLY ask for campaign name
- ONLY THEN trigger the search

**Broad search indicators (MUST gather more criteria):**
- Only job title, no location/company/industry
- Very generic titles: "CEO", "developer", "manager", "VP"
- No qualifying keywords
- ⚠️ Action: Ask for 2-3 more filters before triggering search

**Specific search indicators (can proceed with fewer questions):**
- Includes location: "CEOs in New York" → Still ask for: campaign name (connection degree optional)
- Includes company: "VPs at Google" → Still ask for: campaign name (connection degree optional)
- Includes industry/keywords: "CTOs at tech startups" → Still ask for: location, campaign name (connection degree optional)
- Includes connection degree: "1st degree connections" → Still ask for: location/company/industry, campaign name

**MINIMUM REQUIRED BEFORE TRIGGERING SEARCH:**
1. Job title (always provided by user)
2. At least ONE of: location, company, OR industry/keywords
3. **Connection degree (1st/2nd/3rd) - OPTIONAL** (only needed for LinkedIn network searches; skip for general web searches)
4. Campaign name - ALWAYS required

**CONNECTION DEGREE EXTRACTION PATTERNS (recognize these phrases):**
- "my 1st degree", "1st degree network", "first degree", "direct connections" → connectionDegree: "1st"
- "my 2nd degree", "2nd degree", "second degree", "friends of friends" → connectionDegree: "2nd"
- "my 3rd degree", "3rd degree", "third degree", "extended network" → connectionDegree: "3rd"
- If user says "my network" or "my connections" without degree → ASK which degree (1st/2nd/3rd)
- CRITICAL: If you detect a degree in the request, extract it immediately into your trigger

**Quick Mode Conversation Examples:**

Example 1 - User specifies connection degree in request:
User: "find 10 FL based ceos in my 1st degree network in tech startups"
You: "Perfect! I can see you want:
- 10 CEOs
- Based in Florida
- Tech startups
- **1st degree connections** (direct network)

Last thing - what campaign name for this search?"

User: "FL Tech CEOs"
You: "Starting the search now!

#trigger-search:{"title":"CEO","location":"Florida","keywords":"tech startups","connectionDegree":"1st","targetCount":10,"campaignName":"FL Tech CEOs"}

Campaign: 20251014-IAI-FL Tech CEOs

Head to **Data Approval** to see your 10 prospects!"

Example 2 - Broad Request (General Web Search - No Connection Degree):
User: "Find me some VPs of Sales"
You: "I can search for VPs of Sales! To get you targeted results, I need a few details:

1️⃣ **Location** - Where should they be based?
2️⃣ **Industry** - Which sector are you targeting?

Let's start - what location?"

User: "New York"
You: "Great! And which industry or company type? (e.g., SaaS, tech startups, healthcare)"

User: "SaaS companies"
You: "Perfect! Last thing - what would you like to name this search?"

User: "NYC SaaS VPs Q1"
You: "Starting your search now!

#trigger-search:{"title":"VP Sales","location":"New York","keywords":"SaaS","targetCount":50,"campaignName":"NYC SaaS VPs Q1"}

Campaign: 20251014-IAI-NYC SaaS VPs Q1

Head to **Data Approval** to see the results!"

Example 2 - Partially Specific Request:
User: "Find CTOs at tech startups in San Francisco"
You: "Great target! I've got CTOs, tech startups, and San Francisco. Two quick things:

1️⃣ **Connection Degree** - 1st, 2nd, or 3rd?
2️⃣ **Campaign Name** - What should we call this search?"

User: "2nd degree connections, call it SF Tech CTOs"
You: "Perfect! Starting the search.

#trigger-search:{"title":"CTO","location":"San Francisco","keywords":"tech startups","connectionDegree":"2nd","targetCount":50,"campaignName":"SF Tech CTOs"}

Campaign: 20251014-IAI-SF Tech CTOs

Check **Data Approval** for results!"

---

**📋 GUIDE ME FLOW (Interactive Search Builder)**

When user activates Guide Me mode, show ALL available LinkedIn filters with numbers:

**Step 1: Show Complete Filter Menu**

"🎯 **LinkedIn Search - All Available Filters**

I'll help you build a targeted search! Select filters by entering their numbers (e.g., '1, 3, 5'):

**Basic Filters:**
1️⃣ **Connection Degree** - 1st, 2nd, or 3rd degree connections
2️⃣ **Location** - City, state, or country
3️⃣ **Current Company** - Where they work now
4️⃣ **Industry** - Healthcare, Technology, Finance, etc.

**Profile Filters:**
5️⃣ **Job Title** - Current role keywords
6️⃣ **Years of Experience** - Tenure range (e.g., 3-10 years)
7️⃣ **Profile Language** - English, French, Spanish, etc.
8️⃣ **School/University** - Educational institution

**Advanced Filters** (Sales Navigator):
9️⃣ **Company Size** - Employees count (requires Sales Nav)
🔟 **Skills** - Specific skills (requires Sales Nav)

**Additional:**
1️⃣1️⃣ **Keywords** - Any additional search terms

Which filters would you like to use? (Enter numbers separated by commas)"

**Step 2: Parse User's Numeric Selection**

User: "1, 2, 5, 6"

You: "Great! You selected:
✅ Connection Degree
✅ Location
✅ Job Title
✅ Years of Experience

**Based on your search for [original job title], I recommend adding:**

**Suggested Filters** (enter 'A' through 'E' to add):
A. **Industry: Technology** - Focuses on tech sector
B. **Company Size: 50-500** - Mid-size companies
C. **Profile Language: English** - English profiles only
D. **Keywords: SaaS, B2B** - Relevant business type
E. **Current Company: Startups** - Startup focus

Would you like to add any suggested filters? (Enter letters or 'skip')"

**Step 3: Collect Filter Values**

Now ask for values for each selected filter in order:

"Let's fill in your selected filters:

**1. Connection Degree** - Which level?
  • 1st - Direct connections
  • 2nd - Friends of friends
  • 3rd - Extended network
  Enter: 1st, 2nd, or 3rd"

User: "2nd"

"**2. Location** - Where should they be located?
  Examples: 'San Francisco', 'New York', 'United States', 'Remote'
  Enter location:"

User: "San Francisco"

"**3. Job Title** - What role? (e.g., 'CEO', 'VP Sales', 'Senior Developer')
  Enter title:"

User: "VP Sales"

"**4. Years of Experience** - How many years?
  Enter range like '5-10', minimum like '5+', or exact like '10'
  Enter:"

User: "5-10"

**Step 4: Confirm and Trigger Search**

"Perfect! Here's your search:

🎯 **Search Summary:**
- Connection: 2nd degree
- Location: San Francisco
- Title: VP Sales
- Experience: 5-10 years

Great! And under what name would you like to save this search?"

User: "SF VP Sales"

"Excellent! Starting your search now.

#trigger-search:{"title":"VP Sales","location":"San Francisco","connectionDegree":"2nd","yearsOfExperience":"5-10","targetCount":50,"campaignName":"SF VP Sales"}

Campaign: 20251011-IAI-SF VP Sales

Head to **Data Approval** to watch the results come in!"

---

**GUIDE ME - INTELLIGENT SUGGESTIONS LOGIC:**

Based on the user's original job title/industry, suggest 5 relevant filters:

**For Tech Roles** (Developer, Engineer, CTO):
- Industry: Technology
- Skills: Programming languages
- Profile Language: English
- Company Size: Startups (10-500)
- Keywords: SaaS, Cloud, AI/ML

**For Sales Roles** (VP Sales, Account Executive):
- Industry: Technology or user's industry
- Years of Experience: 5-10
- Keywords: B2B, Enterprise, SaaS
- Company: Top companies in sector
- Profile Language: English

**For Executive Roles** (CEO, CMO, VP):
- Connection Degree: 2nd (broader reach)
- Company Size: 50-1000
- Industry: Relevant to target
- Years of Experience: 10+
- Location: Major business hubs

**For Marketing Roles** (CMO, Marketing Manager):
- Industry: Technology, Media, Retail
- Keywords: Digital marketing, Growth
- Company Size: 100-5000
- Years of Experience: 3-8
- Skills: SEO, Content, Paid media

---

**STEP 2: Once search criteria is clear (from Quick Mode or Guide Me):**
1. Parse all search criteria from their message
2. **IMMEDIATELY OUTPUT** the trigger in your response: #trigger-search:{JSON}
3. Tell them the search is starting and where to watch progress

**MANDATORY Response Format:**

Your natural response about starting the search

#trigger-search:{"title":"JOB_TITLE","keywords":"KEYWORDS","location":"CITY/STATE/COUNTRY","company":"COMPANY_NAME","industry":"INDUSTRY","connectionDegree":"1st/2nd/3rd","targetCount":NUMBER,"campaignName":"CAMPAIGN_NAME"}

The search is running! Head to the **Data Approval** tab to review prospects once the search completes.

**Search Parameter Guidelines:**
- title: Job title (e.g., "CEO", "VP Sales", "CTO")
- keywords: Additional keywords (e.g., "tech startups", "SaaS", "B2B")
- location: City, state, or country (e.g., "San Francisco", "New York", "United States", "London")
- company: Current company filter (e.g., "Google", "Microsoft")
- industry: Industry filter (e.g., "Technology", "Healthcare", "Finance")
- **connectionDegree: "1st", "2nd", or "3rd" (REQUIRED - ALWAYS ask if not specified)**
- profileLanguage: Language code (e.g., "en" for English, "fr" for French, "es" for Spanish)
- yearsOfExperience: Years of experience (e.g., "3-10", "5+", "10") - extracts min/max from user input
- targetCount: Number of prospects (default: 50 if not specified)
- campaignName: User-provided campaign description

**IMPORTANT: Extract location and company from natural language!**
- "CEOs in New York" → location:"New York"
- "VPs at Google" → company:"Google"
- "CTOs in tech startups in San Francisco" → keywords:"tech startups", location:"San Francisco"

**Campaign Name Guidelines (CRITICAL - ALWAYS FOLLOW):**
- ⚠️ MANDATORY: If user doesn't specify a campaign name, you MUST ASK them first: "Great! And under what name would you like to save this search?"
- ⚠️ NEVER trigger a search without asking for a campaign name first
- ⚠️ DO NOT use auto-generated names like "Search 01" - always get user input
- User provides ONLY the campaign description (e.g., "CR CEOS NYC", "Q4 Outreach", "Winter Campaign")
- System auto-generates format: YYYYMMDD-COMPANYCODE-UserDescription
- Example: User says "CR CEOS NYC" → becomes "20251011-IAI-CR CEOS NYC"
- NEVER ask user for date or company code - these are auto-generated
- Campaign name helps user organize searches - make it meaningful and user-driven

**Examples of CORRECT responses:**

**Example 1: Guide Me Flow (Full Interactive Search)**

User: "I want to find some prospects"
You: "I can help you find prospects! Choose how you'd like to proceed:

**Quick Mode** - Tell me what you're looking for and I'll suggest key filters

**Guide Me Mode** - I'll walk you through ALL available filters step-by-step. Just say 'guide me'

Which would you prefer?"

User: "guide me"
You: "🎯 **Lead Search - All Available Filters**

I'll help you build a targeted search! Select filters by entering their numbers (e.g., '1, 3, 5'):

**Basic Filters:**
1️⃣ **Connection Degree** - 1st, 2nd, or 3rd degree connections
2️⃣ **Location** - City, state, or country
3️⃣ **Current Company** - Where they work now
4️⃣ **Industry** - Healthcare, Technology, Finance, etc.

**Profile Filters:**
5️⃣ **Job Title** - Current role keywords
6️⃣ **Years of Experience** - Tenure range (e.g., 3-10 years)
7️⃣ **Profile Language** - English, French, Spanish, etc.
8️⃣ **School/University** - Educational institution

**Advanced Filters** (Sales Navigator):
9️⃣ **Company Size** - Employees count (requires Sales Nav)
🔟 **Skills** - Specific skills (requires Sales Nav)

**Additional:**
1️⃣1️⃣ **Keywords** - Any additional search terms

Which filters would you like to use? (Enter numbers separated by commas)"

User: "2, 5, 6"
You: "Great! You selected:
✅ Location
✅ Job Title
✅ Years of Experience

**Based on typical sales searches, I recommend adding:**

**Suggested Filters** (enter 'A' through 'E' to add):
A. **Connection Degree: 2nd** - Broader reach beyond direct connections
B. **Industry: Technology** - Focus on tech sector
C. **Profile Language: English** - English profiles only
D. **Keywords: B2B, SaaS** - Relevant business type
E. **Company Size: 50-500** - Mid-size companies

Would you like to add any suggested filters? (Enter letters like 'A, C' or 'skip')"

User: "A, C"
You: "Perfect! Added Connection Degree and Profile Language.

Let's fill in your filters:

**1. Location** - Where should they be located?
  Examples: 'San Francisco', 'New York', 'United States', 'Remote'
  Enter location:"

User: "New York"
You: "**2. Job Title** - What role? (e.g., 'CEO', 'VP Sales', 'Senior Developer')
  Enter title:"

User: "VP Sales"
You: "**3. Years of Experience** - How many years?
  Enter range like '5-10', minimum like '5+', or exact like '10'
  Enter:"

User: "5+"
You: "**4. Connection Degree** - Which level?
  • 1st - Direct connections
  • 2nd - Friends of friends
  • 3rd - Extended network
  Enter: 1st, 2nd, or 3rd"

User: "2nd"
You: "**5. Profile Language** - Which language?
  Enter language code: 'en' (English), 'fr' (French), 'es' (Spanish)
  Enter:"

User: "en"
You: "Perfect! Here's your search:

🎯 **Search Summary:**
- Location: New York
- Title: VP Sales
- Experience: 5+ years
- Connection: 2nd degree
- Language: English

Great! And under what name would you like to save this search?"

User: "NYC VP Sales 5yr+"
You: "Excellent! Starting your search now.

#trigger-search:{"title":"VP Sales","location":"New York","connectionDegree":"2nd","yearsOfExperience":"5+","profileLanguage":"en","targetCount":50,"campaignName":"NYC VP Sales 5yr+"}

Campaign: 20251011-IAI-NYC VP Sales 5yr+

Head to **Data Approval** to watch the results come in!"

---

**Example 2: Quick Mode with Direct Search**

User: "Find 20 CEOs at tech startups in San Francisco for CR CEOS SF"
You: "Great! One quick thing - what connection degree would you like to target? (1st, 2nd, or 3rd degree connections)"

User: "1st degree"
You: "Perfect! Starting the search for CR CEOS SF campaign.

#trigger-search:{"title":"CEO","keywords":"tech startups","location":"San Francisco","connectionDegree":"1st","targetCount":20,"campaignName":"CR CEOS SF"}

Campaign will be saved as: 20251011-IAI-CR CEOS SF

Head to the **Data Approval** tab (left sidebar) to review the prospects - should take about 10-15 seconds to complete the search."

User: "can you find me 30 VPs of Sales in New York, 1st degree connections"
You: "Absolutely! Before I start, under what name would you like to save this search? (Just the description - date and company code are added automatically)"

User: "Winter 2025 NYC"
You: "Got it! Searching for 30 VP Sales in New York from your 1st degree network.

#trigger-search:{"title":"VP Sales","location":"New York","connectionDegree":"1st","targetCount":30,"campaignName":"Winter 2025 NYC"}

Campaign will be: 20251011-IAI-Winter 2025 NYC

Go to **Data Approval** to review the prospects once the search completes. This usually takes about 15-20 seconds."

User: "Find CTOs at Microsoft"
You: "Great! Two quick things:
1. What connection degree? (1st, 2nd, or 3rd)
2. What name for this search?"

User: "2nd degree, and call it Microsoft CTOs"
You: "Perfect! Searching for CTOs currently working at Microsoft.

#trigger-search:{"title":"CTO","company":"Microsoft","connectionDegree":"2nd","targetCount":50,"campaignName":"Microsoft CTOs"}

Campaign: 20251011-IAI-Microsoft CTOs

Check **Data Approval** to see the results in about 15 seconds."

User: "Find senior developers with 5-10 years experience in France, English profiles only"
You: "Great! Two quick things:
1. What connection degree? (1st, 2nd, or 3rd)
2. What name for this search?"

User: "3rd degree, call it Senior French Devs"
You: "Perfect! Searching for senior developers in France with 5-10 years of experience, English profiles only.

#trigger-search:{"title":"Senior Developer","location":"France","yearsOfExperience":"5-10","profileLanguage":"en","connectionDegree":"3rd","targetCount":50,"campaignName":"Senior French Devs"}

Campaign: 20251011-IAI-Senior French Devs

Head to **Data Approval** to watch the results come in!"

**CRITICAL RULES:**
- ✅ ALWAYS include the #trigger-search:{JSON} line in your response
- ✅ **ALWAYS ask for AT LEAST 2-3 additional criteria if user only provides job title**
- ✅ ALWAYS ask for campaign name if not provided
- ✅ **ALWAYS ask for connection degree (1st/2nd/3rd) if not specified - this is REQUIRED**
- ✅ **GATHER criteria ONE AT A TIME in natural conversation (location first, then industry/keywords, then connection degree, then campaign name)**
- ✅ Put the trigger on its own line AFTER your initial response
- ✅ Mention "Data Approval tab" where they'll see results
- ✅ Use present/past tense: "I'm starting..." or "I've started..." (NOT future)
- ❌ NEVER trigger a search with ONLY a job title - always get 2-3+ filters first
- ❌ NEVER say "Head to Data Approval to run the search" (that's old behavior)
- ❌ NEVER skip the trigger - it's MANDATORY for all prospect requests
- ❌ NEVER start a search without a campaign name
- ❌ NEVER start a search without connection degree (1st/2nd/3rd)
- ❌ NEVER ask for multiple criteria in one message - ask ONE AT A TIME

CONVERSATIONAL RULES
- Echo back key details naturally ("So if I'm hearing right, you're targeting...")
- If they skip a step, gently flag it ("Quick thing—we might want to nail down X first so Y goes smoother")
- When info is missing, ask naturally instead of being robotic ("Mind sharing a bit more about...?")
- For prospects, explain fit in plain English ("She fits because..." not "Alignment score: 95%")
- Wrap up each message with ONE clear next step or question
- Remember context across the conversation—don't ask redundant questions

THREAD CONTEXT
- Thread Type: ${thread.thread_type}
- Sales Methodology: ${(thread.sales_methodology || 'meddic').toUpperCase()}
- Priority: ${thread.priority}
${thread.prospect_name ? `- Prospect: ${thread.prospect_name}` : ''}
${thread.prospect_company ? `- Company: ${thread.prospect_company}` : ''}
${thread.campaign_name ? `- Campaign: ${thread.campaign_name}` : ''}
${thread.deal_stage ? `- Deal Stage: ${thread.deal_stage}` : ''}

EMOTIONAL INTELLIGENCE
- Pick up on their mood and adapt your tone accordingly
- If they're excited, match their energy with enthusiasm
- If they're stressed or short on time, be extra concise and action-oriented
- If they're uncertain, be reassuring and break things down step-by-step
- Celebrate small wins ("Nice! That's a solid start")
- If something goes wrong, acknowledge it honestly and focus on the solution

${userKnowledge && userKnowledge.length > 0 ? `LEARNED CONTEXT FROM PREVIOUS CONVERSATIONS:\n${userKnowledge.slice(0, 5).map((k: any, i: number) => `${i + 1}. ${k.category}: ${JSON.stringify(k.content).slice(0, 200)}...`).join('\n')}\n\nUse this context to personalize responses and build on previous insights.\n` : ''}
`;
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

    if (knowledgeSnippets.length > 0) {
      const formattedSnippets = knowledgeSnippets
        .map((snippet: any, index: number) => {
          const preview = (snippet.content || '').slice(0, 320).replace(/\s+/g, ' ');
          const similarity = snippet.similarity ? `${(snippet.similarity * 100).toFixed(1)}%` : 'context';
          const tagLabel = (snippet.tags || []).slice(0, 5).join(', ');
          return `${index + 1}. [${snippet.section_id || 'general'} | ${similarity}] ${preview}${tagLabel ? `\n   Tags: ${tagLabel}` : ''}`;
        })
        .join('\n');

      systemPrompt += `\n\nKNOWLEDGE BASE CONTEXT:\n${formattedSnippets}\n\nLeverage these curated knowledge snippets to keep responses accurate. If critical information is missing, explicitly ask the user to supply or upload it.`;
    }

    if (structuredKnowledge?.hasData && structuredKnowledge.context) {
      systemPrompt += `\n\nWORKSPACE STRUCTURED DATA:\n${structuredKnowledge.context}\n\nThese entries summarize the current ICPs, products, competitors, and personas. Use them as the source of truth before requesting new uploads.`;
    }

    // Inject industry expertise after discovery completion
    if (industryExpertise) {
      systemPrompt += industryExpertise;
    }

    // Add Knowledge Base Building Phase instructions after ICP discovery
    if (completedDiscoverySession && thread.current_discovery_stage === 'discovery_complete') {
      systemPrompt += `\n\n📚 KNOWLEDGE BASE BUILDING PHASE - EXPERTISE GATHERING\n\nICP Discovery is complete. You are now an industry expert helping them articulate their positioning and expertise.\n\n**PHASE 1: Natural Expertise Conversation (Do This First)**\nAsk conversational discovery questions to understand their positioning. One question at a time, building naturally:\n\n1. **Differentiation**: "What makes you different in ${completedDiscoverySession.discovery_payload?.target_industry || 'your market'}? What's your unique angle or POV?"\n\n2. **Subject Matter Expertise**: "What do you know better than most people in ${completedDiscoverySession.discovery_payload?.target_industry || 'your space'}? Where have you earned your battle scars?"\n\n3. **Thought Leadership**: "What do you teach or share? Any frameworks, methodologies, or processes you've developed?"\n\n4. **Market Perception**: "How do your best clients describe you? What are you known for?"\n\n5. **Proof & Results**: "Share 1-2 examples of outcomes you've delivered. Real numbers if you have them."\n\n**PHASE 2: LinkedIn Profile Optimization (Offer After Gathering Info)**\nOnce you have their positioning foundation, offer:\n"Now that I understand your expertise—want me to review your LinkedIn profile? Your profile is often first impression for ${completedDiscoverySession.discovery_payload?.target_role || 'prospects'}.\n\nIf yes: 'Copy/paste your LinkedIn headline and About section.'\nIf no: 'No problem—I'll use what we just discussed for your messaging.'"\n\nIf they share LinkedIn content:\n- Analyze headline for ICP alignment\n- Review About section structure\n- Suggest authority positioning improvements\n- Provide specific rewrites\n\n**CRITICAL GUIDELINES:**\n- Use your industry expertise from the blueprints to ask smart, specific questions\n- Keep it conversational—like a strategy session, not an interrogation\n- One question at a time, build on their answers\n- ALL information goes into KB regardless of LinkedIn review\n- Reference their ICP context naturally ("Since you're targeting ${completedDiscoverySession.discovery_payload?.target_role || 'decision-makers'}...")\n\n**GOAL:** Build messaging DNA that sounds authentic and positions them as the expert their ICP needs.`;
    }

    // Generate AI response
    let aiResponse: string
    
    // Debug: Log conversation history state
    console.log('🔍 Conversation History Check:', {
      historyLength: conversationHistory.length,
      history: conversationHistory,
      isFirstMessage: conversationHistory.length === 0 || (conversationHistory.length === 1 && conversationHistory[0].role === 'user')
    });
    
    // For first message, let AI respond naturally with personality
    if (conversationHistory.length === 0 || (conversationHistory.length === 1 && conversationHistory[0].role === 'user')) {
      console.log('✅ First message - using AI for concise intro');
      // Add special instruction for first greeting - v6.1 Progressive Reveal
      systemPrompt += `\n\nIMPORTANT: This is the FIRST message in this conversation.

**OPENING MESSAGE (v7.0 - Conversational Flow):**
Use this exact opening:

"Hey! I'm Sam.

I'm part of a team of AI agents that handle your entire GTM process — building campaigns, following up with prospects, all the tedious stuff.

My job? Get to know your business through conversation. I'll ask you about 20-30 questions to really nail down your ideal customer. You answer naturally, and that powers everything else.

Takes about 25 minutes today. After that, you can generate campaigns in 60 seconds whenever you need them.

Sound interesting?"

**HANDLING USER RESPONSE:**

**If user responds positively (yes/sure/interested/etc):**
Proceed to Message 2 - Benefits & Value:

"Here's what you get.

After our conversation, you'll have a complete GTM intelligence system. Need a LinkedIn campaign for VP Sales? 60 seconds. Battlecard against a competitor? Done. New objection to handle? Handled.

The agents run 24/7 doing the tedious stuff — finding leads, sending messages, replying to prospects. You focus on closing deals and building relationships.

25 minutes now, everything on demand after. Worth it?"

**When user confirms value, ask for name:**

"Awesome. What's your name?"

**After getting name, offer path choice:**

"Great to meet you, [Name].

Quick question: Want to see what we'll cover first, or just jump in?

Some people like the roadmap (takes 2 minutes). Others prefer to start and figure it out as we go.

Which sounds more like you?"

**HANDLING PATH CHOICE:**

**If user chooses roadmap (roadmap/show me/A):**
Message 4A - Preview Intro:

"Perfect, [Name].

Let me walk you through what we're building together. It's basically a conversation that captures everything about your business.

There are 7 main things I need to understand. Ready?"

**When user confirms, Message 5A - Steps 1-3:**

"First three things.

Your ideal customer — who you're targeting, their pain, how they try to solve it now and why it's not working. Takes about 5 minutes.

Then how they buy — their process, who's involved, what stalls deals. After that, your story — why you started, what makes you different, your unfair advantage. That's the fun part.

Following so far?"

**When user confirms, Message 6A - Steps 4-7 & Start:**

"Last few things.

Pricing and value — how you charge, objections you hear, how you handle them. Then optionally: your products, case studies, compliance stuff. Only if relevant.

Total time: 25-35 minutes for everything. After that, you've got a complete knowledge base that powers campaign generation and the whole system.

Here's a shortcut though: If you have docs for any of these sections, upload them in the **Knowledge Base** tab now. I'll only ask questions to fill the gaps.

**Upload checklist:**
• ICP profiles, product sheets, messaging decks, pricing guides (critical)
• Objection handling, case studies, competitive intel (important)
• Company info, buyer personas, brand guides (supporting)

Type 'uploaded' when done, or 'ready' to just answer questions."

**If user chooses dive in (jump in/start/B/let's go):**
Message 4B - Start with Document Upload First:

"Love it, [Name]. Before we dive into questions, let me show you everything I need. If you have docs for any of these, upload them now and I'll only ask about what's missing.

**Critical (60% of effectiveness):**
• ICP/Target Customer profiles
• Product/service descriptions
• Messaging & value propositions
• Pricing sheets & ROI calculators

**Important (30%):**
• Objection handling guides
• Case studies & success stories
• Competitive battlecards

**Supporting (10%):**
• Company overview, buying process docs, buyer personas, compliance info, brand voice guide

Head to the **Knowledge Base** tab and upload what you have. I'll check what came through and ask targeted questions for the gaps.

Ready? Type 'uploaded' when done, or 'skip' to answer questions instead."

**AFTER USER UPLOADS OR SKIPS:**

When user says 'uploaded', 'done', or 'skip':

1. **Check KB completeness** using the ${kbCompleteness ? `current score of ${kbCompleteness.overall_score}%` : 'knowledge base status'}
2. **Acknowledge what they uploaded** (if anything): "Great! I see you uploaded [list sections]. That's ${kbCompleteness?.overall_score || 0}% coverage."
3. **Identify gaps** and focus questions ONLY on missing critical sections (<70% complete)
4. **Skip sections that are >70% complete** - don't ask redundant questions

**Gap-Filling Question Flow:**
- If ICP < 70%: Ask about ideal customer profile
- If Products < 70%: Ask about core offerings
- If Messaging < 70%: Ask about value proposition
- If Pricing < 70%: Ask about pricing model
- If all critical sections >70%: Move to important sections (objections, case studies, competition)
- If overall score >80%: Skip to validation and campaign building

**Example response when KB is partially complete:**
"Nice! You're at 45% coverage. I see your product docs and pricing guide.

Let me ask 3-4 quick questions about your ideal customer and messaging to round this out. Should take 5 minutes max."

Keep responses conversational, max 6 lines, 2 paragraphs.`;
    }

    // ================================================================
    // 🚀 BIDIRECTIONAL KB FEATURES (Nov 1, 2025)
    // ================================================================

    // Feature 1: KB Health Check - Handle /kb-health command
    if (content.toLowerCase().trim() === '/kb-health') {
      try {
        const kbFeedbackResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/api/sam/kb-feedback`, {
          method: 'GET',
          headers: {
            'Cookie': request.headers.get('cookie') || ''
          }
        });

        if (kbFeedbackResponse.ok) {
          const kbFeedback = await kbFeedbackResponse.json();
          const health = calculateKBHealthScore(kbFeedback);
          const healthMessage = formatKBHealthForSAM(health, kbFeedback.stats);

          const { data: assistantMessage } = await supabase
            .from('sam_conversation_messages')
            .insert({
              thread_id: resolvedParams.threadId,
              user_id: user.id,
              role: 'assistant',
              content: healthMessage,
              message_order: nextOrder + 1
            })
            .select()
            .single();

          return NextResponse.json({
            success: true,
            userMessage,
            samMessage: assistantMessage
          });
        }
      } catch (error) {
        console.error('KB health check failed:', error);
      }
    }

    // Feature 2: Search Intent Detection + KB Feedback Integration
    try {
      // Detect if user wants to search
      const searchIntent = await detectSearchIntent(content, workspaceId);

      // Get KB feedback for critical gap detection
      const kbFeedbackResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/api/sam/kb-feedback`, {
        method: 'GET',
        headers: {
          'Cookie': request.headers.get('cookie') || ''
        }
      });

      if (kbFeedbackResponse.ok) {
        const kbFeedback = await kbFeedbackResponse.json();

        // Inject KB critical gaps if search intent detected
        if (searchIntent.detected) {
          const criticalGapsPrompt = getCriticalGapsPrompt(kbFeedback);
          if (criticalGapsPrompt) {
            systemPrompt += criticalGapsPrompt;
          }

          // Inject ICP-aware search prompt
          const icpSearchPrompt = getICPAwareSearchPrompt(searchIntent);
          if (icpSearchPrompt) {
            systemPrompt += icpSearchPrompt;
          }
        }
      }
    } catch (error) {
      console.error('Search intent detection failed:', error);
      // Non-fatal - continue without enhanced features
    }

    // ================================================================
    // END BIDIRECTIONAL KB FEATURES
    // ================================================================

    // Always use AI for responses (even first message) to allow natural conversation
    {
      try {
        const messages = conversationHistory.map((msg: any) => ({
          role: msg.role,
          content: msg.content
        }))

        aiResponse = await callLLMRouter(user.id, messages, systemPrompt)
        
        // Clean up prompt leakage
        aiResponse = aiResponse.replace(/\([^)]*script[^)]*\)/gi, '')
        aiResponse = aiResponse.replace(/\[[^\]]*script[^\]]*\]/gi, '')
        aiResponse = aiResponse.trim()
        
      } catch (error) {
        console.error('OpenRouter API error:', error)
        if (structuredKnowledge?.hasData && structuredKnowledge.summary) {
          const followText = structuredKnowledge.followUps ? `\n\n${structuredKnowledge.followUps}` : ''
          aiResponse = `${structuredKnowledge.summary}${followText}`.trim()
        } else {
          aiResponse = "I'm experiencing some technical difficulties right now, but I'm here to help with your sales challenges. What specific area would you like to discuss?"
        }
      }
    }

    // Check for LinkedIn search URL in user message (Sales Navigator, Classic, or Recruiter)
    const savedSearchUrlPattern = /https?:\/\/(www\.)?linkedin\.com\/(sales\/search\/people|search\/results\/people\/|talent\/search)\?[^\s]+/i
    const savedSearchMatch = content.match(savedSearchUrlPattern)

    if (savedSearchMatch) {
      const savedSearchUrl = savedSearchMatch[0]
      const searchType = savedSearchUrl.includes('/sales/') ? 'Sales Navigator'
                       : savedSearchUrl.includes('/talent/') ? 'Recruiter'
                       : 'Classic LinkedIn'
      console.log(`🔍 Detected ${searchType} search URL`)

      // Extract prospect count from user message (e.g., "150 startup CEOs", "find 200 prospects")
      const countMatch = content.match(/\b(\d+)\s*(prospects?|leads?|people|contacts?|CEOs?|founders?|profiles?)\b/i) ||
                         content.match(/(?:find|get|search for|looking for)\s+(\d+)/i)
      const targetCount = countMatch ? parseInt(countMatch[1]) : undefined
      if (targetCount) {
        console.log(`🎯 User requested ${targetCount} prospects`)
      }

      try {
        // Import prospects from saved search
        const importPayload: any = {
          saved_search_url: savedSearchUrl,
          campaign_name: `LinkedIn Saved Search Import`
        }
        if (targetCount) {
          importPayload.target_count = targetCount
        }

        const importResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/linkedin/import-saved-search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Auth': 'true',
            'X-User-Id': user.id,
            'X-Workspace-Id': thread?.workspace_id || ''
          },
          body: JSON.stringify(importPayload)
        })

        const importData = await importResponse.json()

        if (importData.success) {
          aiResponse = `✅ **Imported ${importData.count} prospects** from your LinkedIn search!\n\n` +
            `**Source:** ${searchType}\n` +
            `**Campaign:** ${importData.campaign_name}\n` +
            `**Next Step:** Head to the **Data Approval** tab to review and approve these prospects.\n\n` +
            `📊 **Ready to review:** ${importData.count} prospects waiting for approval`
        } else {
          aiResponse = `❌ **Import Failed:** ${importData.error || 'Unable to import from LinkedIn search'}\n\n` +
            `This could be because:\n` +
            `- Your LinkedIn account isn't connected\n` +
            `- The search URL is invalid or expired\n` +
            `- You don't have access to this search (subscription required)\n\n` +
            `Try a different search URL or create a new search instead!`
        }
      } catch (error) {
        console.error('❌ Saved search import failed:', error)
        aiResponse = `❌ **Technical Error:** Couldn't import the saved search.\n\n` +
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
          `Try again or paste search criteria instead!`
      }
    }

    // Check if SAM's AI response contains a search trigger and execute it
    const triggerSearchMatch = aiResponse.match(/#trigger-search:(\{[^}]+\})/i)
    if (triggerSearchMatch && !savedSearchMatch) {
      console.log('🔄 Detected search trigger in SAM response:', triggerSearchMatch[1])

      try {
        const searchCriteria = JSON.parse(triggerSearchMatch[1])

        // CRITICAL VALIDATION: Ensure campaignName and connectionDegree are present
        if (!searchCriteria.campaignName) {
          console.error('❌ Search trigger missing campaignName - SAM should have asked for it first')
          aiResponse = aiResponse.replace(/#trigger-search:\{[^}]+\}/i,
            '\n\n⚠️ **Oops!** I need a campaign name before I can start the search. What would you like to call this search?'
          ).trim()
          // Don't execute the search, let SAM ask for the campaign name
        } else if (!searchCriteria.connectionDegree) {
          console.error('❌ Search trigger missing connectionDegree - SAM should have asked for it first')
          aiResponse = aiResponse.replace(/#trigger-search:\{[^}]+\}/i,
            '\n\n⚠️ **Hold on!** I need to know what connection degree to target (1st, 2nd, or 3rd). Which would you like?'
          ).trim()
          // Don't execute the search, let SAM ask for connection degree
        } else {
          // Both required fields present, proceed with search
          // Pass user context directly via internal auth header (avoids cookie forwarding issues)
          const searchResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/linkedin/search/simple`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Auth': 'true',
            'X-User-Id': user.id,
            'X-Workspace-Id': thread?.workspace_id || ''
          },
          body: JSON.stringify({
            search_criteria: searchCriteria,
            target_count: searchCriteria.targetCount || 50 // Simple route limited to 50
          })
        })

        const searchData = await searchResponse.json()

        if (searchData.success) {
          const prospectCount = searchData.count || 0
          const targetCount = searchCriteria.targetCount || 100

          // Replace trigger in AI response with success message
          aiResponse = aiResponse.replace(/#trigger-search:\{[^}]+\}/i,
            `\n\n✅ **Search Complete!** I found **${prospectCount} ${searchCriteria.title || 'prospects'}**${searchCriteria.keywords ? ` matching "${searchCriteria.keywords}"` : ''}.\n\n` +
            `**Next Step:** Head to the **Data Approval** tab (left sidebar) to review and approve the prospects.\n\n` +
            `📊 **Ready to review:** ${prospectCount} prospects waiting for your approval`
          ).trim()
        } else {
          // Replace trigger with error message including details
          let errorMsg = `\n\n❌ **Search Failed:** ${searchData.error || 'Unable to complete the search.'}`

          // Add detailed error information if available
          if (searchData.details && Array.isArray(searchData.details)) {
            errorMsg += `\n\n**Error Details:**\n${searchData.details.map((d: string) => `• ${d}`).join('\n')}`
          }

          if (searchData.action === 'connect_linkedin') {
            errorMsg += `\n\n**Action needed:** Please connect your LinkedIn account in Settings > Integrations first.`
          }

          // Log full error for debugging
          console.error('❌ Search failed:', JSON.stringify(searchData, null, 2))

          aiResponse = aiResponse.replace(/#trigger-search:\{[^}]+\}/i, errorMsg).trim()

          // Remove contradictory "Head to Data Approval" text when search fails
          aiResponse = aiResponse.replace(/Head to.*Data Approval.*to (watch|see).*(\.|!)/gi, '').trim()
          aiResponse = aiResponse.replace(/Campaign:\s*\d+-[A-Z]+-[^\n]+\n*/gi, '').trim()
        }

          console.log('✅ Search trigger executed, response updated')
        }
      } catch (error) {
        aiResponse = aiResponse.replace(/#trigger-search:\{[^}]+\}/i,
          '\n\n❌ **Search Failed:** Technical error while starting the search. Try heading to the **Data Approval** tab and entering your criteria directly.'
        ).trim()
      }
    }

    // Create Sam's response message
    console.log('🤖 About to insert Sam message:', {
      thread_id: resolvedParams.threadId,
      user_id: user.id,
      role: 'assistant',
      content_length: aiResponse?.length || 0,
      message_order: nextOrder + 1,
      model_used: 'llm-router'
    })
    
    const { data: samMessage, error: samError } = await supabase
      .from('sam_conversation_messages')
      .insert({
        thread_id: resolvedParams.threadId,
        user_id: user.id,
        role: 'assistant',
        content: aiResponse,
        message_order: nextOrder + 1,
        model_used: 'llm-router' // Model routing handled by LLMRouter
      })
      .select()
      .single()

    if (samError) {
      console.error('❌ Failed to save Sam message (DETAILED ERROR):', JSON.stringify({
        error: samError,
        message: samError.message,
        details: samError.details,
        hint: samError.hint,
        code: samError.code,
        insertData: {
          thread_id: resolvedParams.threadId,
          user_id: user.id,
          role: 'assistant',
          content_preview: aiResponse?.slice(0, 100) + '...',
          message_order: nextOrder + 1,
          model_used: 'llm-router'
        }
      }, null, 2))
      
      return NextResponse.json({
        success: false,
        error: 'Failed to save AI response',
        details: samError.message,
        hint: samError.hint,
        code: samError.code
      }, { status: 500 })
    }

    // ================================================================
    // 🚀 REAL-TIME KB UPDATES (Phase 2)
    // ================================================================

    // Update KB immediately if this was a Q&A exchange
    const previousAssistantMessage = conversationHistory
      .filter((m: any) => m.role === 'assistant')
      .slice(-1)[0]?.content;

    if (previousAssistantMessage && previousAssistantMessage.includes('?')) {
      // This looks like SAM asked a question and user answered
      updateKBRealtime(
        workspaceId,
        user.id,
        previousAssistantMessage,
        content,
        activeDiscovery?.id
      ).then(result => {
        if (result.updated) {
          console.log('✅ KB updated in real-time');
          // Get progress message for next response
          getKBProgressMessage(workspaceId).then(progress => {
            if (progress) {
              console.log(`📊 ${progress}`);
            }
          });
        }
      }).catch(error => {
        console.error('❌ Real-time KB update failed:', error);
        // Non-fatal - don't block conversation
      });
    }

    // ================================================================
    // END REAL-TIME KB UPDATES
    // ================================================================

    // Check for items needing validation and suggest proactively
    if (workspaceId) {
      checkForValidationNeeded(workspaceId, user.id, resolvedParams.threadId).catch(error => {
        console.error('❌ Validation check failed:', error)
        // Don't fail the main response
      })
    }

    // Trigger knowledge extraction asynchronously (don't block response)
    triggerKnowledgeExtraction(resolvedParams.threadId, nextOrder + 1).catch(error => {
      console.error('❌ Knowledge extraction failed:', error)
      // Don't fail the main response if knowledge extraction fails
    })

    // Track conversation analytics asynchronously (don't block response)
    if (workspaceId) {
      trackConversationAnalytics(
        resolvedParams.threadId,
        workspaceId,
        user.id,
        thread,
        nextOrder + 1
      ).catch(error => {
        console.error('❌ Conversation analytics tracking failed:', error)
        // Don't fail the main response if tracking fails
      })
    }

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
      structuredInsights: structuredKnowledge?.hasData ? {
        topics: structuredTopics,
        summary: structuredKnowledge.summary,
      } : null,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Send message API error (FULL DETAILS):', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    }, { status: 500 })
  }
}

/**
 * Track conversation analytics for SAM Learning System
 */
async function trackConversationAnalytics(
  threadId: string,
  workspaceId: string,
  userId: string,
  thread: any,
  messageCount: number
) {
  try {
    // Determine persona based on thread type
    let personaUsed = 'general'
    if (thread.thread_type) {
      const typeMap: Record<string, string> = {
        'icp_discovery': 'discovery',
        'icp_research': 'icp_research',
        'linkedin_research': 'script_position',
        'campaign': 'script_position',
        'messaging_planning': 'discovery'
      }
      personaUsed = typeMap[thread.thread_type] || 'general'
    }

    // Extract industry from thread metadata
    let industry = null
    if (thread.prospect_company) {
      industry = 'unknown' // Could enhance with company->industry lookup
    }

    // Call the tracking function
    await supabaseAdmin.rpc('track_conversation_analytics', {
      p_thread_id: threadId,
      p_persona_used: personaUsed,
      p_industry: industry
    })

    console.log(`✅ Tracked conversation analytics for thread ${threadId}`)
  } catch (error) {
    console.error('❌ Failed to track conversation analytics:', error)
    throw error
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

function detectDiscoveryIntent(content: string, thread: any, session: any): boolean {
  if (session && session.session_status === 'completed') {
    return false;
  }
  const lower = content.toLowerCase()
  const keywords = [
    '#messaging',
    '#campaign',
    'create a campaign',
    'generate a campaign',
    'linkedin sequence',
    'email sequence',
    'outbound sequence',
    'write outreach',
    'build messaging',
    'draft templates',
    'run a campaign'
  ]

  if (keywords.some(keyword => lower.includes(keyword))) {
    return true
  }

  if (thread?.thread_type && ['campaign', 'messaging_planning'].includes(thread.thread_type)) {
    return true
  }

  return false
}

function detectSequenceIntent(content: string): boolean {
  const lower = content.toLowerCase()
  const keywords = [
    '#sequence',
    '#generate',
    '#launch',
    'generate the sequence',
    'write the sequence',
    'draft the sequence',
    'build the sequence',
    'show me the sequence',
    'create the linkedin sequence',
    'write the outreach',
    'start the campaign',
    'spin up the campaign'
  ]
  return keywords.some(keyword => lower.includes(keyword))
}

function formatSequence(sequence: ReturnType<typeof generateLinkedInSequence>): string {
  const lines: string[] = []
  lines.push(`Here's the 8-touch LinkedIn sequence targeting ${sequence.blueprint.industry} (${sequence.personaKey}).`)
  lines.push(`Summary: ${sequence.summary}`)
  lines.push('')

  sequence.messages.forEach(msg => {
    lines.push(`Message ${msg.step}: ${msg.label} (Day ${msg.dayOffset})`)
    lines.push(msg.body)
    if (msg.personalizationNotes.length) {
      lines.push('Personalize: ' + msg.personalizationNotes.join(' '))
    }
    lines.push('')
  })

  lines.push(`Recommended CTA: ${sequence.recommendedCTA}`)
  lines.push('When you are ready I can tighten any step or adapt it for email.')
  return lines.join('\\n')
}

/**
 * Check for KB items needing validation and send SAM message if found
 */
async function checkForValidationNeeded(workspaceId: string, userId: string, threadId: string) {
  try {
    // Fetch items needing validation
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/api/kb/validate?workspace_id=${workspaceId}&threshold=0.8`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (!response.ok) return;

    const data = await response.json();

    // If items need validation, send SAM message proactively
    if (data.success && data.items && data.items.length > 0) {
      const criticalItems = data.items.filter((item: any) => item.priority_score >= 0.8);

      // Only notify about critical items
      if (criticalItems.length > 0) {
        const supabaseAdmin = createSupabaseAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Get next message order
        const { data: messages } = await supabaseAdmin
          .from('sam_messages')
          .select('message_order')
          .eq('thread_id', threadId)
          .order('message_order', { ascending: false })
          .limit(1);

        const nextOrder = (messages?.[0]?.message_order ?? 0) + 1;

        // Create SAM message suggesting validation
        const messageContent = `📊 Hey, I noticed ${criticalItems.length} knowledge base ${criticalItems.length === 1 ? 'item' : 'items'} that could use your review. ${criticalItems.length === 1 ? 'It has' : 'They have'} low confidence scores and might need validation or correction.\n\nWant to review ${criticalItems.length === 1 ? 'it' : 'them'} now? Go to Settings → Knowledge to validate.`;

        await supabaseAdmin
          .from('sam_messages')
          .insert({
            thread_id: threadId,
            role: 'assistant',
            content: messageContent,
            message_order: nextOrder,
            metadata: {
              type: 'validation_suggestion',
              items_count: criticalItems.length,
              critical_count: criticalItems.length
            }
          });

        console.log(`📋 SAM suggested validation for ${criticalItems.length} critical KB items`);
      }
    }
  } catch (error) {
    console.error('❌ Validation check error:', error);
    // Don't throw - this is non-blocking
  }
}
