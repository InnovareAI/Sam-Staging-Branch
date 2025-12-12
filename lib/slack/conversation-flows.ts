/**
 * Slack Conversation Flows
 *
 * Handles multi-turn conversations for:
 * - ICP Setup
 * - LinkedIn Search
 * - Campaign Creation
 */

import { supabaseAdmin } from '@/app/lib/supabase';

// Conversation state storage (in-memory for now, should move to Redis/DB for production)
const conversationStates = new Map<string, ConversationState>();

export interface ConversationState {
  workspaceId: string;
  channelId: string;
  userId: string;
  flow: 'icp_setup' | 'search' | 'campaign_create' | 'quick_campaign' | null;
  step: number;
  data: Record<string, any>;
  createdAt: Date;
  lastUpdated: Date;
}

// Get conversation key
function getConvoKey(workspaceId: string, channelId: string, userId: string): string {
  return `${workspaceId}:${channelId}:${userId}`;
}

// Get or create conversation state
export function getConversationState(workspaceId: string, channelId: string, userId: string): ConversationState | null {
  const key = getConvoKey(workspaceId, channelId, userId);
  const state = conversationStates.get(key);

  // Clean up stale conversations (older than 30 minutes)
  if (state && Date.now() - state.lastUpdated.getTime() > 30 * 60 * 1000) {
    conversationStates.delete(key);
    return null;
  }

  return state || null;
}

// Set conversation state
export function setConversationState(
  workspaceId: string,
  channelId: string,
  userId: string,
  updates: Partial<ConversationState>
): ConversationState {
  const key = getConvoKey(workspaceId, channelId, userId);
  const existing = conversationStates.get(key);

  const state: ConversationState = {
    workspaceId,
    channelId,
    userId,
    flow: null,
    step: 0,
    data: {},
    createdAt: new Date(),
    ...existing,
    ...updates,
    lastUpdated: new Date(),
  };

  conversationStates.set(key, state);
  return state;
}

// Clear conversation state
export function clearConversationState(workspaceId: string, channelId: string, userId: string): void {
  const key = getConvoKey(workspaceId, channelId, userId);
  conversationStates.delete(key);
}

// =============================================================================
// ICP SETUP FLOW
// =============================================================================

export interface ICPSetupResponse {
  message: string;
  blocks?: any[];
  completed?: boolean;
  icp?: any;
}

export async function handleICPSetupFlow(
  workspaceId: string,
  channelId: string,
  userId: string,
  input: string
): Promise<ICPSetupResponse> {
  const state = getConversationState(workspaceId, channelId, userId);

  // Start new ICP setup if not in flow
  if (!state || state.flow !== 'icp_setup') {
    setConversationState(workspaceId, channelId, userId, {
      flow: 'icp_setup',
      step: 1,
      data: { titles: [], industries: [], locations: [] },
    });

    return {
      message: "Let's define your Ideal Customer Profile! I'll ask a few questions.\n\n*1️⃣ What job titles are you targeting?*\n(e.g., \"VP of Sales, Sales Director, Head of Sales\")",
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: "Let's define your *Ideal Customer Profile*! I'll ask a few questions." } },
        { type: 'divider' },
        { type: 'section', text: { type: 'mrkdwn', text: '*1️⃣ What job titles are you targeting?*\n_Example: VP of Sales, Sales Director, Head of Sales_' } },
      ],
    };
  }

  // Process based on current step
  switch (state.step) {
    case 1: // Titles
      const titles = input.split(/[,;]/).map(t => t.trim()).filter(t => t.length > 0);
      setConversationState(workspaceId, channelId, userId, {
        step: 2,
        data: { ...state.data, titles },
      });

      return {
        message: `Got it! Targeting: ${titles.join(', ')}\n\n*2️⃣ What industries?*\n(e.g., \"SaaS, FinTech, B2B Tech\")`,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: `✓ Titles: *${titles.join(', ')}*` } },
          { type: 'section', text: { type: 'mrkdwn', text: '*2️⃣ What industries?*\n_Example: SaaS, FinTech, B2B Tech_' } },
        ],
      };

    case 2: // Industries
      const industries = input.split(/[,;]/).map(t => t.trim()).filter(t => t.length > 0);
      setConversationState(workspaceId, channelId, userId, {
        step: 3,
        data: { ...state.data, industries },
      });

      return {
        message: `Industries: ${industries.join(', ')}\n\n*3️⃣ What company size? (employees)*`,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: `✓ Industries: *${industries.join(', ')}*` } },
          { type: 'section', text: { type: 'mrkdwn', text: '*3️⃣ What company size?* (employees)' } },
          {
            type: 'actions',
            elements: [
              { type: 'button', text: { type: 'plain_text', text: '1-50' }, action_id: 'icp_size_1_50', value: '1-50' },
              { type: 'button', text: { type: 'plain_text', text: '51-200' }, action_id: 'icp_size_51_200', value: '51-200' },
              { type: 'button', text: { type: 'plain_text', text: '201-500' }, action_id: 'icp_size_201_500', value: '201-500' },
              { type: 'button', text: { type: 'plain_text', text: '500+' }, action_id: 'icp_size_500_plus', value: '500+' },
            ],
          },
        ],
      };

    case 3: // Company size
      let sizeMin = 1, sizeMax = 50;
      const sizeLower = input.toLowerCase();
      if (sizeLower.includes('51') || sizeLower.includes('200')) {
        sizeMin = 51; sizeMax = 200;
      } else if (sizeLower.includes('201') || sizeLower.includes('500')) {
        sizeMin = 201; sizeMax = 500;
      } else if (sizeLower.includes('500+') || sizeLower.includes('500 plus') || parseInt(input) > 500) {
        sizeMin = 500; sizeMax = 10000;
      } else if (sizeLower.includes('1-50') || sizeLower.includes('small')) {
        sizeMin = 1; sizeMax = 50;
      }

      setConversationState(workspaceId, channelId, userId, {
        step: 4,
        data: { ...state.data, company_size_min: sizeMin, company_size_max: sizeMax },
      });

      return {
        message: `Company size: ${sizeMin}-${sizeMax} employees\n\n*4️⃣ What locations?*\n(e.g., \"United States, United Kingdom, Berlin\")`,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: `✓ Company size: *${sizeMin}-${sizeMax}* employees` } },
          { type: 'section', text: { type: 'mrkdwn', text: '*4️⃣ What locations?*\n_Example: United States, United Kingdom, Berlin_' } },
        ],
      };

    case 4: // Locations
      const locations = input.split(/[,;]/).map(t => t.trim()).filter(t => t.length > 0);
      const icpData = { ...state.data, locations };

      // Save ICP to database
      const { data: icp, error } = await supabaseAdmin()
        .from('workspace_icp')
        .insert({
          workspace_id: workspaceId,
          name: 'Default ICP',
          is_default: true,
          titles: icpData.titles,
          industries: icpData.industries,
          company_size_min: icpData.company_size_min,
          company_size_max: icpData.company_size_max,
          locations: locations,
        })
        .select()
        .single();

      // Clear conversation state
      clearConversationState(workspaceId, channelId, userId);

      if (error) {
        return {
          message: `Sorry, I couldn't save your ICP: ${error.message}`,
          completed: true,
        };
      }

      const sizeText = icpData.company_size_max >= 10000 ? `${icpData.company_size_min}+` : `${icpData.company_size_min}-${icpData.company_size_max}`;

      return {
        message: `✅ *ICP Saved!*\n\n📋 *Your ICP:*\n• Titles: ${icpData.titles.join(', ')}\n• Industries: ${icpData.industries.join(', ')}\n• Company size: ${sizeText} employees\n• Locations: ${locations.join(', ')}\n\nSay *\"search\"* to find prospects matching this ICP!`,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: '✅ *ICP Saved!*' } },
          { type: 'divider' },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `📋 *Your ICP:*\n• Titles: ${icpData.titles.join(', ')}\n• Industries: ${icpData.industries.join(', ')}\n• Company size: ${sizeText} employees\n• Locations: ${locations.join(', ')}`,
            },
          },
          {
            type: 'actions',
            elements: [
              { type: 'button', text: { type: 'plain_text', text: '🔍 Search Prospects' }, action_id: 'search_from_icp', value: icp?.id || '', style: 'primary' },
              { type: 'button', text: { type: 'plain_text', text: '✏️ Edit ICP' }, action_id: 'edit_icp', value: icp?.id || '' },
            ],
          },
        ],
        completed: true,
        icp,
      };

    default:
      clearConversationState(workspaceId, channelId, userId);
      return {
        message: "Something went wrong. Let's start over - say \"set up my ICP\" to begin.",
        completed: true,
      };
  }
}

// =============================================================================
// SEARCH FLOW
// =============================================================================

export interface SearchResponse {
  message: string;
  blocks?: any[];
  prospects?: any[];
  searchQuery?: any;
}

export async function handleSearchFlow(
  workspaceId: string,
  channelId: string,
  userId: string,
  input: string
): Promise<SearchResponse> {
  // Get the workspace's default ICP
  const { data: icp } = await supabaseAdmin()
    .from('workspace_icp')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_default', true)
    .single();

  // Parse natural language search query
  const searchParams = parseSearchQuery(input, icp);

  // Build Unipile search query
  const searchQuery = buildUnipileQuery(searchParams);

  // Execute search
  const results = await executeLinkedInSearch(workspaceId, searchQuery);

  if (!results.success) {
    return {
      message: `❌ Search failed: ${results.error}`,
    };
  }

  const prospects = results.prospects || [];
  const count = prospects.length;

  if (count === 0) {
    return {
      message: "🔍 No prospects found matching your criteria. Try broadening your search.",
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: '🔍 *No prospects found*\nTry broadening your search criteria.' } },
        {
          type: 'actions',
          elements: [
            { type: 'button', text: { type: 'plain_text', text: '📝 Modify Search' }, action_id: 'modify_search' },
            { type: 'button', text: { type: 'plain_text', text: '⚙️ Edit ICP' }, action_id: 'edit_icp' },
          ],
        },
      ],
    };
  }

  // Format prospect preview
  const previewProspects = prospects.slice(0, 5);
  const prospectList = previewProspects.map((p: any, i: number) =>
    `${i + 1}. *${p.first_name} ${p.last_name}* - ${p.title || 'Unknown'} @ ${p.company || 'Unknown'}`
  ).join('\n');

  // Store search results temporarily for "add to campaign" action
  setConversationState(workspaceId, channelId, userId, {
    flow: 'search',
    step: 1,
    data: { searchResults: prospects, searchQuery: searchParams },
  });

  return {
    message: `🔍 Found *${count} prospects*!\n\n${prospectList}\n${count > 5 ? `\n_...and ${count - 5} more_` : ''}`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `🔍 Found *${count} prospects*!` } },
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: prospectList + (count > 5 ? `\n_...and ${count - 5} more_` : '') } },
      {
        type: 'actions',
        elements: [
          { type: 'button', text: { type: 'plain_text', text: '➕ Add to Campaign' }, action_id: 'add_to_campaign', value: JSON.stringify({ count }), style: 'primary' },
          { type: 'button', text: { type: 'plain_text', text: '🚀 Quick Campaign' }, action_id: 'quick_campaign', value: JSON.stringify({ count }) },
          { type: 'button', text: { type: 'plain_text', text: '📋 View All' }, action_id: 'view_all_prospects', value: JSON.stringify({ count }) },
        ],
      },
    ],
    prospects,
    searchQuery: searchParams,
  };
}

function parseSearchQuery(input: string, icp?: any): any {
  const params: any = {};

  // Use ICP as base if available
  if (icp) {
    params.titles = icp.titles || [];
    params.industries = icp.industries || [];
    params.locations = icp.locations || [];
    params.company_size_min = icp.company_size_min;
    params.company_size_max = icp.company_size_max;
  }

  // Parse natural language overrides
  const lower = input.toLowerCase();

  // Extract titles (look for patterns like "find CTOs" or "marketing directors")
  const titlePatterns = [
    /find\s+(\w+(?:\s+\w+)?(?:\s*,\s*\w+(?:\s+\w+)?)*)/i,
    /(cto|ceo|cfo|coo|vp|director|manager|head\s+of)\s*(?:of\s+)?(\w+)?/gi,
  ];

  for (const pattern of titlePatterns) {
    const match = input.match(pattern);
    if (match) {
      // Extract title from match
      const titleStr = match[1] || match[0];
      params.titleOverride = titleStr;
    }
  }

  // Extract locations
  const locationPatterns = [
    /in\s+([A-Za-z\s,]+?)(?:\s+(?:at|from|who|that|working)|\s*$)/i,
    /(?:located\s+in|based\s+in)\s+([A-Za-z\s,]+)/i,
  ];

  for (const pattern of locationPatterns) {
    const match = input.match(pattern);
    if (match) {
      params.locationOverride = match[1].split(/[,&]/).map((l: string) => l.trim());
    }
  }

  // Extract industries
  const industryPatterns = [
    /(?:in|at)\s+(\w+)\s+(?:companies|startups|firms)/i,
    /(saas|fintech|healthtech|edtech|b2b|tech|software)/gi,
  ];

  for (const pattern of industryPatterns) {
    const match = input.match(pattern);
    if (match) {
      params.industryOverride = match[1];
    }
  }

  // Extract limit
  const limitMatch = input.match(/(?:find|get|show)\s+(\d+)/i);
  if (limitMatch) {
    params.limit = parseInt(limitMatch[1]);
  }

  return params;
}

function buildUnipileQuery(params: any): any {
  return {
    keywords: params.titleOverride || params.titles?.join(' OR ') || '',
    location: params.locationOverride?.[0] || params.locations?.[0] || '',
    industry: params.industryOverride || params.industries?.[0] || '',
    company_size: params.company_size_min && params.company_size_max
      ? `${params.company_size_min}-${params.company_size_max}`
      : undefined,
    limit: params.limit || 25,
  };
}

async function executeLinkedInSearch(workspaceId: string, query: any): Promise<any> {
  try {
    // Get LinkedIn account for workspace
    const { data: account } = await supabaseAdmin()
      .from('workspace_accounts')
      .select('unipile_account_id')
      .eq('workspace_id', workspaceId)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected')
      .single();

    if (!account) {
      return { success: false, error: 'No LinkedIn account connected' };
    }

    // Call Unipile search API
    const searchUrl = `https://${process.env.UNIPILE_DSN}/api/v1/linkedin/search`;

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_id: account.unipile_account_id,
        type: 'people',
        keywords: query.keywords,
        location: query.location,
        limit: query.limit || 25,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Search failed: ${errorText}` };
    }

    const data = await response.json();

    // Map results to our prospect format
    const prospects = (data.items || []).map((item: any) => ({
      first_name: item.first_name || item.firstName || '',
      last_name: item.last_name || item.lastName || '',
      title: item.headline || item.title || '',
      company: item.company?.name || item.company || '',
      linkedin_url: item.public_profile_url || item.profile_url || '',
      provider_id: item.provider_id || item.id,
      location: item.location || '',
    }));

    return { success: true, prospects };

  } catch (error) {
    console.error('[Search] Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// =============================================================================
// CAMPAIGN CREATION FLOW
// =============================================================================

export interface CampaignCreateResponse {
  message: string;
  blocks?: any[];
  completed?: boolean;
  campaign?: any;
}

export async function handleCampaignCreateFlow(
  workspaceId: string,
  channelId: string,
  userId: string,
  input: string
): Promise<CampaignCreateResponse> {
  const state = getConversationState(workspaceId, channelId, userId);

  // Start new campaign creation if not in flow
  if (!state || state.flow !== 'campaign_create') {
    setConversationState(workspaceId, channelId, userId, {
      flow: 'campaign_create',
      step: 1,
      data: {},
    });

    return {
      message: "🚀 *Let's create a new campaign!*\n\n*1️⃣ What would you like to name this campaign?*",
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: "🚀 *Let's create a new campaign!*" } },
        { type: 'divider' },
        { type: 'section', text: { type: 'mrkdwn', text: '*1️⃣ What would you like to name this campaign?*' } },
      ],
    };
  }

  switch (state.step) {
    case 1: // Campaign name
      const campaignName = input.trim();
      setConversationState(workspaceId, channelId, userId, {
        step: 2,
        data: { ...state.data, name: campaignName },
      });

      return {
        message: `Great name! "${campaignName}"\n\n*2️⃣ What channel?*`,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: `✓ Campaign name: *${campaignName}*` } },
          { type: 'section', text: { type: 'mrkdwn', text: '*2️⃣ What channel?*' } },
          {
            type: 'actions',
            elements: [
              { type: 'button', text: { type: 'plain_text', text: '💼 LinkedIn' }, action_id: 'channel_linkedin', value: 'linkedin', style: 'primary' },
              { type: 'button', text: { type: 'plain_text', text: '📧 Email' }, action_id: 'channel_email', value: 'email' },
              { type: 'button', text: { type: 'plain_text', text: '🔀 Both' }, action_id: 'channel_both', value: 'both' },
            ],
          },
        ],
      };

    case 2: // Channel selection
      let channel = 'linkedin';
      const channelLower = input.toLowerCase();
      if (channelLower.includes('email')) channel = 'email';
      if (channelLower.includes('both') || channelLower.includes('multi')) channel = 'both';

      setConversationState(workspaceId, channelId, userId, {
        step: 3,
        data: { ...state.data, channel },
      });

      return {
        message: `👍 ${channel.charAt(0).toUpperCase() + channel.slice(1)} campaign.\n\n*3️⃣ Who do you want to target?*`,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: `✓ Channel: *${channel}*` } },
          { type: 'section', text: { type: 'mrkdwn', text: '*3️⃣ Who do you want to target?*' } },
          {
            type: 'actions',
            elements: [
              { type: 'button', text: { type: 'plain_text', text: '📋 Use My ICP' }, action_id: 'target_icp', value: 'icp', style: 'primary' },
              { type: 'button', text: { type: 'plain_text', text: '🔍 Search Now' }, action_id: 'target_search', value: 'search' },
              { type: 'button', text: { type: 'plain_text', text: '📤 Upload CSV' }, action_id: 'target_csv', value: 'csv' },
            ],
          },
        ],
      };

    case 3: // Target selection
      const targetMethod = input.toLowerCase();

      if (targetMethod.includes('icp') || targetMethod.includes('my icp')) {
        // Get ICP and search
        const { data: icp } = await supabaseAdmin()
          .from('workspace_icp')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('is_default', true)
          .single();

        if (!icp) {
          return {
            message: "You don't have an ICP set up yet. Say \"set up my ICP\" first, or choose \"Search Now\" to define criteria.",
          };
        }

        // Execute search with ICP
        const searchResults = await handleSearchFlow(workspaceId, channelId, userId, 'search');

        setConversationState(workspaceId, channelId, userId, {
          step: 4,
          data: { ...state.data, targetMethod: 'icp', prospects: searchResults.prospects || [] },
        });

        const prospectCount = searchResults.prospects?.length || 0;

        return {
          message: `🔍 Found *${prospectCount} prospects* matching your ICP!\n\n${searchResults.message}\n\n*Use all ${prospectCount}?*`,
          blocks: [
            ...(searchResults.blocks || []),
            {
              type: 'actions',
              elements: [
                { type: 'button', text: { type: 'plain_text', text: `✅ Use All ${prospectCount}` }, action_id: 'use_all_prospects', value: String(prospectCount), style: 'primary' },
                { type: 'button', text: { type: 'plain_text', text: '🔍 Filter More' }, action_id: 'filter_prospects' },
              ],
            },
          ],
        };
      }

      // Handle other target methods...
      return {
        message: "Please select a targeting method using the buttons above, or say \"use my ICP\", \"search\", or \"upload CSV\".",
      };

    case 4: // Confirm prospects
      const prospectCount = state.data.prospects?.length || 0;

      if (input.toLowerCase().includes('use all') || input.toLowerCase().includes('yes') || !isNaN(parseInt(input))) {
        setConversationState(workspaceId, channelId, userId, {
          step: 5,
          data: { ...state.data },
        });

        return {
          message: `✅ ${prospectCount} prospects added.\n\n*4️⃣ Now let's write your messages. First, the connection request:*\n\n💡 _Tips: Keep it short (300 chars), personalize, no selling_\n\nWant me to draft one based on your ICP?`,
          blocks: [
            { type: 'section', text: { type: 'mrkdwn', text: `✅ *${prospectCount} prospects* added` } },
            { type: 'divider' },
            { type: 'section', text: { type: 'mrkdwn', text: '*4️⃣ Now let\'s write your messages.*\n\nFirst, the *connection request*:\n💡 _Tips: Keep it short (300 chars), personalize, no selling_' } },
            {
              type: 'actions',
              elements: [
                { type: 'button', text: { type: 'plain_text', text: '✨ Draft for Me' }, action_id: 'draft_cr', style: 'primary' },
                { type: 'button', text: { type: 'plain_text', text: '✏️ I\'ll Write It' }, action_id: 'write_cr' },
              ],
            },
          ],
        };
      }

      return {
        message: `Say "use all ${prospectCount}" to continue, or specify how many prospects you want to use.`,
      };

    case 5: // Connection request message
      const shouldDraft = input.toLowerCase().includes('draft') || input.toLowerCase().includes('yes');

      if (shouldDraft) {
        // Generate AI draft
        const draft = await generateMessageDraft(workspaceId, 'connection_request', state.data);

        setConversationState(workspaceId, channelId, userId, {
          step: 6,
          data: { ...state.data, draftCR: draft },
        });

        return {
          message: `Here's a draft:\n\n---\n${draft}\n---\n\nWhat do you think?`,
          blocks: [
            { type: 'section', text: { type: 'mrkdwn', text: "Here's a draft connection request:" } },
            { type: 'section', text: { type: 'mrkdwn', text: `\`\`\`${draft}\`\`\`` } },
            {
              type: 'actions',
              elements: [
                { type: 'button', text: { type: 'plain_text', text: '✅ Use This' }, action_id: 'use_draft_cr', style: 'primary' },
                { type: 'button', text: { type: 'plain_text', text: '✏️ Edit' }, action_id: 'edit_draft_cr' },
                { type: 'button', text: { type: 'plain_text', text: '🔄 Try Another' }, action_id: 'retry_draft_cr' },
              ],
            },
          ],
        };
      } else {
        // User will write their own
        setConversationState(workspaceId, channelId, userId, {
          step: 6,
          data: { ...state.data },
        });

        return {
          message: "Great! Type your connection request message.\n\nYou can use these variables:\n• `{{first_name}}` - Prospect's first name\n• `{{company}}` - Their company\n• `{{title}}` - Their job title",
        };
      }

    case 6: // Save CR and ask for follow-up
      let connectionRequest = state.data.draftCR;

      if (!input.toLowerCase().includes('use this') && input.length > 20) {
        // User provided their own message
        connectionRequest = input;
      }

      setConversationState(workspaceId, channelId, userId, {
        step: 7,
        data: { ...state.data, connectionRequest },
      });

      return {
        message: "✓ Connection request saved!\n\n*5️⃣ Follow-up message* (sent 3 days after they accept):\n\nWant me to draft this too?",
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: '✓ Connection request saved!' } },
          { type: 'section', text: { type: 'mrkdwn', text: '*5️⃣ Follow-up message* (sent 3 days after they accept):' } },
          {
            type: 'actions',
            elements: [
              { type: 'button', text: { type: 'plain_text', text: '✨ Draft for Me' }, action_id: 'draft_fu', style: 'primary' },
              { type: 'button', text: { type: 'plain_text', text: '⏭️ Skip Follow-up' }, action_id: 'skip_fu' },
              { type: 'button', text: { type: 'plain_text', text: '✏️ I\'ll Write It' }, action_id: 'write_fu' },
            ],
          },
        ],
      };

    case 7: // Follow-up message
      let followUp: string | null = null;

      if (input.toLowerCase().includes('skip')) {
        followUp = null;
      } else if (input.toLowerCase().includes('draft') || input.toLowerCase().includes('yes')) {
        followUp = await generateMessageDraft(workspaceId, 'follow_up', state.data);

        // Show draft and ask for confirmation
        setConversationState(workspaceId, channelId, userId, {
          step: 8,
          data: { ...state.data, draftFU: followUp },
        });

        return {
          message: `Here's your follow-up:\n\n---\n${followUp}\n---`,
          blocks: [
            { type: 'section', text: { type: 'mrkdwn', text: "Here's your follow-up:" } },
            { type: 'section', text: { type: 'mrkdwn', text: `\`\`\`${followUp}\`\`\`` } },
            {
              type: 'actions',
              elements: [
                { type: 'button', text: { type: 'plain_text', text: '✅ Use This' }, action_id: 'use_draft_fu', style: 'primary' },
                { type: 'button', text: { type: 'plain_text', text: '✏️ Edit' }, action_id: 'edit_draft_fu' },
                { type: 'button', text: { type: 'plain_text', text: '🔄 Try Another' }, action_id: 'retry_draft_fu' },
              ],
            },
          ],
        };
      } else if (input.length > 20) {
        followUp = input;
      }

      // Move to final step
      setConversationState(workspaceId, channelId, userId, {
        step: 9,
        data: { ...state.data, followUp },
      });

      // Show sending schedule options
      return {
        message: "*6️⃣ Sending schedule:*",
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: '*6️⃣ Sending schedule:*' } },
          {
            type: 'actions',
            elements: [
              { type: 'button', text: { type: 'plain_text', text: '🚀 Aggressive (20/day)' }, action_id: 'schedule_aggressive', value: 'aggressive' },
              { type: 'button', text: { type: 'plain_text', text: '⚡ Normal (10/day)' }, action_id: 'schedule_normal', value: 'normal', style: 'primary' },
              { type: 'button', text: { type: 'plain_text', text: '🐢 Conservative (5/day)' }, action_id: 'schedule_conservative', value: 'conservative' },
            ],
          },
        ],
      };

    case 8: // Confirm follow-up draft
      let confirmedFU = state.data.draftFU;

      if (!input.toLowerCase().includes('use this') && input.length > 20) {
        confirmedFU = input;
      }

      setConversationState(workspaceId, channelId, userId, {
        step: 9,
        data: { ...state.data, followUp: confirmedFU },
      });

      return {
        message: "✓ Follow-up saved!\n\n*6️⃣ Sending schedule:*",
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: '✓ Follow-up saved!' } },
          { type: 'section', text: { type: 'mrkdwn', text: '*6️⃣ Sending schedule:*' } },
          {
            type: 'actions',
            elements: [
              { type: 'button', text: { type: 'plain_text', text: '🚀 Aggressive (20/day)' }, action_id: 'schedule_aggressive', value: 'aggressive' },
              { type: 'button', text: { type: 'plain_text', text: '⚡ Normal (10/day)' }, action_id: 'schedule_normal', value: 'normal', style: 'primary' },
              { type: 'button', text: { type: 'plain_text', text: '🐢 Conservative (5/day)' }, action_id: 'schedule_conservative', value: 'conservative' },
            ],
          },
        ],
      };

    case 9: // Schedule and create campaign
      let sendRate = 10;
      const scheduleLower = input.toLowerCase();
      if (scheduleLower.includes('aggressive') || scheduleLower.includes('20')) {
        sendRate = 20;
      } else if (scheduleLower.includes('conservative') || scheduleLower.includes('5')) {
        sendRate = 5;
      }

      const campaignData = state.data;
      const daysToComplete = Math.ceil((campaignData.prospects?.length || 0) / sendRate);

      // Create the campaign
      const campaign = await createCampaign(workspaceId, {
        name: campaignData.name,
        channel: campaignData.channel,
        prospects: campaignData.prospects || [],
        connectionRequest: campaignData.connectionRequest,
        followUp: campaignData.followUp,
        sendRate,
      });

      // Clear conversation state
      clearConversationState(workspaceId, channelId, userId);

      if (!campaign.success) {
        return {
          message: `❌ Failed to create campaign: ${campaign.error}`,
          completed: true,
        };
      }

      const prospectCountFinal = campaignData.prospects?.length || 0;

      return {
        message: `✅ *Campaign launched!*\n\n📋 *${campaignData.name}*\n• Channel: ${campaignData.channel}\n• Prospects: ${prospectCountFinal}\n• Connection Request: ✓\n• Follow-up: ${campaignData.followUp ? '✓ After 3 days' : 'Skipped'}\n• Speed: ${sendRate}/day (~${daysToComplete} days to complete)\n\nFirst batch sending in 30 minutes. I'll notify you of replies here!`,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: '✅ *Campaign launched!*' } },
          { type: 'divider' },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `📋 *${campaignData.name}*\n• Channel: ${campaignData.channel}\n• Prospects: ${prospectCountFinal}\n• Connection Request: ✓\n• Follow-up: ${campaignData.followUp ? '✓ After 3 days' : 'Skipped'}\n• Speed: ${sendRate}/day (~${daysToComplete} days to complete)`,
            },
          },
          { type: 'context', elements: [{ type: 'mrkdwn', text: 'First batch sending in 30 minutes. I\'ll notify you of replies here!' }] },
          {
            type: 'actions',
            elements: [
              { type: 'button', text: { type: 'plain_text', text: '📊 View Campaign' }, action_id: 'view_campaign', value: campaign.campaign?.id || '' },
              { type: 'button', text: { type: 'plain_text', text: '⏸️ Pause' }, action_id: 'pause_new_campaign', value: campaign.campaign?.id || '' },
            ],
          },
        ],
        completed: true,
        campaign: campaign.campaign,
      };

    default:
      clearConversationState(workspaceId, channelId, userId);
      return {
        message: "Something went wrong. Let's start over - say \"create campaign\" to begin.",
        completed: true,
      };
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function generateMessageDraft(workspaceId: string, type: 'connection_request' | 'follow_up', context: any): Promise<string> {
  // Get workspace info for context
  const { data: workspace } = await supabaseAdmin()
    .from('workspaces')
    .select('name, industry, company_description')
    .eq('id', workspaceId)
    .single();

  // Get ICP for context
  const { data: icp } = await supabaseAdmin()
    .from('workspace_icp')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_default', true)
    .single();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return type === 'connection_request'
      ? "Hi {{first_name}}, I noticed your work at {{company}} and would love to connect. Always great to meet others in the industry!"
      : "Thanks for connecting, {{first_name}}! I'd love to learn more about what {{company}} is working on. Would you be open to a quick chat?";
  }

  const prompt = type === 'connection_request'
    ? `Write a LinkedIn connection request for a ${icp?.titles?.[0] || 'professional'} in the ${icp?.industries?.[0] || 'technology'} industry. Keep it under 300 characters. Be genuine, not salesy. Use {{first_name}} and {{company}} variables.`
    : `Write a follow-up message after someone accepts a LinkedIn connection request. Keep it conversational and under 500 characters. Use {{first_name}} and {{company}} variables. The sender works at ${workspace?.name || 'a B2B company'}.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://app.meet-sam.com',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: 'You are a professional sales copywriter. Write concise, personalized outreach messages.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    const result = await response.json();
    return result.choices?.[0]?.message?.content || 'Hi {{first_name}}, would love to connect!';
  } catch (error) {
    console.error('[Draft] Error generating message:', error);
    return type === 'connection_request'
      ? "Hi {{first_name}}, I noticed your work at {{company}} and would love to connect!"
      : "Thanks for connecting, {{first_name}}! Would love to learn more about {{company}}.";
  }
}

async function createCampaign(workspaceId: string, data: {
  name: string;
  channel: string;
  prospects: any[];
  connectionRequest: string;
  followUp?: string | null;
  sendRate: number;
}): Promise<{ success: boolean; campaign?: any; error?: string }> {
  try {
    // Get LinkedIn account for the workspace
    const { data: account } = await supabaseAdmin()
      .from('workspace_accounts')
      .select('unipile_account_id')
      .eq('workspace_id', workspaceId)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected')
      .single();

    if (!account) {
      return { success: false, error: 'No LinkedIn account connected' };
    }

    // Create the campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin()
      .from('campaigns')
      .insert({
        workspace_id: workspaceId,
        name: data.name,
        campaign_type: data.channel,
        status: 'active',
        linkedin_account_id: account.unipile_account_id,
        message_templates: {
          connection_request: data.connectionRequest,
          follow_ups: data.followUp ? [{ message: data.followUp, delay_days: 3 }] : [],
        },
        schedule_settings: {
          send_rate: data.sendRate,
          business_hours_only: true,
        },
      })
      .select()
      .single();

    if (campaignError) {
      return { success: false, error: campaignError.message };
    }

    // Add prospects to campaign
    if (data.prospects.length > 0) {
      const prospectRecords = data.prospects.map(p => ({
        campaign_id: campaign.id,
        workspace_id: workspaceId,
        first_name: p.first_name,
        last_name: p.last_name,
        title: p.title,
        company: p.company,
        company_name: p.company,
        linkedin_url: p.linkedin_url,
        provider_id: p.provider_id,
        status: 'pending',
      }));

      await supabaseAdmin()
        .from('campaign_prospects')
        .insert(prospectRecords);
    }

    // Queue the campaign for sending
    // This triggers the send queue system
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com'}/api/campaigns/direct/send-connection-requests-queued`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: campaign.id }),
    });

    return { success: true, campaign };

  } catch (error) {
    console.error('[Campaign Create] Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// =============================================================================
// START MENU
// =============================================================================

export interface StartMenuResponse {
  message: string;
  blocks: any[];
}

export function getStartMenu(): StartMenuResponse {
  return {
    message: "👋 Hi! I'm SAM, your AI sales assistant. What would you like to do?",
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "👋 *Hi! I'm SAM, your AI sales assistant.*\n\nWhat would you like to do?",
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*🎯 Set Up ICP*\nDefine your ideal customer profile' },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'Set Up ICP' },
          action_id: 'start_icp_setup',
          style: 'primary',
        },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*🔍 Find Prospects*\nSearch LinkedIn for leads' },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'Search' },
          action_id: 'start_search',
        },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*🚀 Create Campaign*\nLaunch an outreach campaign' },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'Create Campaign' },
          action_id: 'start_campaign',
        },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*📊 Campaign Status*\nCheck your active campaigns' },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'View Status' },
          action_id: 'view_campaign_status',
        },
      },
      { type: 'divider' },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '💡 _Tip: You can also just type naturally, like "find marketing directors in London" or "create a new campaign"_',
          },
        ],
      },
    ],
  };
}

export function isStartMenuTrigger(input: string): boolean {
  const lower = input.toLowerCase().trim();
  const triggers = [
    'hello', 'hi', 'hey', 'start', 'menu', 'help me',
    'what can you do', 'get started', 'begin', 'options',
    'show menu', 'main menu', 'home', 'sam'
  ];

  return triggers.some(t => lower === t || lower.startsWith(t + ' ') || lower.endsWith(' ' + t));
}

// =============================================================================
// INTENT DETECTION
// =============================================================================

export type ConversationIntent =
  | 'icp_setup'
  | 'search'
  | 'campaign_create'
  | 'quick_campaign'
  | 'campaign_status'
  | 'start_menu'
  | 'general'
  | 'continue_flow';

export function detectIntent(input: string, currentFlow: string | null): ConversationIntent {
  const lower = input.toLowerCase().trim();

  // Check for start menu trigger first (only if not in a flow)
  if (!currentFlow && isStartMenuTrigger(input)) {
    return 'start_menu';
  }

  // If already in a flow, continue it unless explicit exit
  if (currentFlow && !lower.includes('cancel') && !lower.includes('start over') && !lower.includes('exit')) {
    return 'continue_flow';
  }

  // ICP setup triggers
  if (
    lower.includes('set up') && lower.includes('icp') ||
    lower.includes('setup') && lower.includes('icp') ||
    lower.includes('define') && lower.includes('icp') ||
    lower.includes('create') && lower.includes('icp') ||
    lower.includes('my icp') ||
    lower.includes('ideal customer')
  ) {
    return 'icp_setup';
  }

  // Search triggers
  if (
    lower.startsWith('search') ||
    lower.startsWith('find') ||
    lower.includes('search for') ||
    lower.includes('find me') ||
    lower.includes('look for') ||
    (lower.includes('prospect') && (lower.includes('find') || lower.includes('search')))
  ) {
    return 'search';
  }

  // Campaign creation triggers
  if (
    lower.includes('create') && lower.includes('campaign') ||
    lower.includes('new campaign') ||
    lower.includes('start') && lower.includes('campaign') ||
    lower.includes('launch') && lower.includes('campaign')
  ) {
    return 'campaign_create';
  }

  // Quick campaign (search + campaign in one)
  if (
    lower.includes('quick campaign') ||
    (lower.includes('campaign') && (lower.includes('find') || lower.includes('search')))
  ) {
    return 'quick_campaign';
  }

  // Campaign status
  if (
    lower.includes('campaign') && (lower.includes('status') || lower.includes('stats') || lower.includes('how'))
  ) {
    return 'campaign_status';
  }

  return 'general';
}
