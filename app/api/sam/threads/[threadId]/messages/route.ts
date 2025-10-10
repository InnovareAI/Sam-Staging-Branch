/**
 * SAM AI Thread Messages API
 * 
 * Handles messages within conversation threads with enhanced prospect intelligence
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
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
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
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
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
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

    // Trigger ICP research for interactive building sessions
    if (isICPRequest && !linkedInUrls) {
      // CHECK: Is LinkedIn connected before proceeding with ICP discovery?
      const { data: linkedInAccount } = await supabase
        .from('user_unipile_accounts')
        .select('unipile_account_id, connection_status')
        .eq('user_id', user.id)
        .eq('platform', 'LINKEDIN')
        .eq('connection_status', 'active')
        .maybeSingle()

      if (!linkedInAccount) {
        // LinkedIn not connected - provide helpful message with connection link
        const connectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings/integrations?connect=linkedin`

        const linkedInPromptMessage = {
          role: 'assistant' as const,
          content: `To find prospects and run ICP discovery, I need access to your LinkedIn account.\n\n**Why LinkedIn?**\n- Search the full LinkedIn database for your ideal prospects\n- Unlimited searches (no quota limits)\n- Access to real-time prospect data\n\n**Connect your LinkedIn account here:**\n[Connect LinkedIn Now](${connectUrl})\n\nOnce connected, I'll be able to search for prospects and help you build your ICP!`
        }

        // Save the assistant's prompt message
        await supabase
          .from('sam_conversation_messages')
          .insert({
            thread_id: resolvedParams.threadId,
            role: 'assistant',
            content: linkedInPromptMessage.content,
            created_at: new Date().toISOString()
          })

        return NextResponse.json({
          success: true,
          message: linkedInPromptMessage.content,
          requiresLinkedIn: true,
          connectUrl
        })
      }

      // LinkedIn is connected - proceed with ICP discovery
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
    let systemPrompt = `You are Sam, the user's trusted sales AI partner. You handle LinkedIn and email outreach end-to-end, so they get results without drowning in tools.

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
- Never mention internal tech (MCP, n8n, vendor names) unless explicitly asked
- Every response must fit within 6 lines total when displayed

YOUR WORKFLOW (present naturally, not as a checklist)
1. Get to know them: Learn their name, role, company, and goals. Understand their ICP, then show real prospect examples to validate
2. Build knowledge: Notice what's missing, ask for it conversationally, and reference what they've shared
3. Validate prospects: Share 5-7 examples with quick "why they fit" explanations. Ask for feedback
4. Create messaging: Help pick channels (LinkedIn, email, both). Draft copy that sounds like them, remind about approval steps
5. Execute & follow through: Confirm approvals, outline next actions, stay available for adjustments

LINKEDIN INTEGRATION & PROSPECT SEARCH
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

CRITICAL: PROSPECT SEARCH WORKFLOW - AUTO-TRIGGER SEARCHES (MANDATORY BEHAVIOR)
⚠️ **YOU MUST AUTOMATICALLY TRIGGER SEARCHES** - Do NOT tell users to go to Data Approval manually!

**When user requests prospects:**
1. Parse the search criteria from their message
2. **IMMEDIATELY OUTPUT** the trigger in your response: #trigger-search:{JSON}
3. Tell them the search is starting and where to watch progress

**MANDATORY Response Format:**

Your natural response about starting the search

#trigger-search:{"title":"JOB_TITLE","keywords":"KEYWORDS","connectionDegree":"1st/2nd/3rd","targetCount":NUMBER}

The search is running! Head to the **Data Approval** tab to watch prospects populate in real-time.

**Examples of CORRECT responses:**

User: "Find 20 CEOs at tech startups"
You: "Perfect! I'm starting that search now.

#trigger-search:{"title":"CEO","keywords":"tech startups","targetCount":20}

Head to the **Data Approval** tab (left sidebar) to watch the 20 prospects populate in real-time - should take about 10-15 seconds."

User: "can you find me 30 VPs of Sales, 1st degree connections"
You: "Absolutely! Searching for 30 VP Sales from your 1st degree network now.

#trigger-search:{"title":"VP Sales","connectionDegree":"1st","targetCount":30}

Go to **Data Approval** to watch the progress bar. This usually takes about 15-20 seconds."

**CRITICAL RULES:**
- ✅ ALWAYS include the #trigger-search:{JSON} line in your response
- ✅ Put the trigger on its own line AFTER your initial response
- ✅ Mention "Data Approval tab" where they'll see results
- ✅ Use present/past tense: "I'm starting..." or "I've started..." (NOT future)
- ❌ NEVER say "Head to Data Approval to run the search" (that's old behavior)
- ❌ NEVER skip the trigger - it's MANDATORY for all prospect requests

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

Ready to start with your ideal customer?"

**If user chooses dive in (jump in/start/B/let's go):**
Message 4B - Start Immediately:

"Love it, [Name]. Let's go.

First thing: Who are you trying to reach?

Tell me about your ideal customer. Their role, industry, company size. Just describe them however feels natural."

**PROGRESSIVE STEP REVEAL (for option B users):**
Reveal each step only when transitioning to it (2-3 lines max):
- Step 2: "Great! **Step 2:** Now let's map your expertise and unique value proposition."
- Step 3: "**Step 3:** Let's review how prospects see you—your LinkedIn presence and positioning."
- Step 4: "**Step 4:** Time to build your prospect list. I'll help identify the right people."
- Step 5: "**Step 5:** Now we'll create your messaging sequences with A/B testing built in."
- Step 6: "**Step 6:** Let me suggest thought leadership content to position you as an expert."
- Step 7: "**Step 7:** Ready to launch! Let's get your campaign live with full tracking."

Keep responses conversational, max 6 lines, 2 paragraphs.`;
    }
    
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

    // Check if SAM's AI response contains a search trigger and execute it
    const triggerSearchMatch = aiResponse.match(/#trigger-search:(\{[^}]+\})/i)
    if (triggerSearchMatch) {
      console.log('🔄 Detected search trigger in SAM response:', triggerSearchMatch[1])

      try {
        const searchCriteria = JSON.parse(triggerSearchMatch[1])

        // Get all cookies from the cookie store to forward to direct search endpoint
        const allCookies = cookieStore.getAll()
        const cookieHeader = allCookies.map(c => `${c.name}=${c.value}`).join('; ')

        const searchResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/linkedin/search/simple`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieHeader
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
          // Replace trigger with error message
          let errorMsg = `\n\n❌ **Search Failed:** ${searchData.error || 'Unable to complete the search.'}`
          if (searchData.action === 'connect_linkedin') {
            errorMsg += `\n\n**Action needed:** Please connect your LinkedIn account in Settings > Integrations first.`
          }
          aiResponse = aiResponse.replace(/#trigger-search:\{[^}]+\}/i, errorMsg).trim()
        }

        console.log('✅ Search trigger executed, response updated')
      } catch (error) {
        console.error('❌ Search trigger execution failed:', error)
        // Remove trigger from response if execution fails
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
  lines.push(`Here’s the 8-touch LinkedIn sequence targeting ${sequence.blueprint.industry} (${sequence.personaKey}).`)
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
  lines.push('When you’re ready I can tighten any step or adapt it for email.')
  return lines.join('\n')
}
