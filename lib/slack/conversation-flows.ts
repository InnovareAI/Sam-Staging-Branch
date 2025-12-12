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
// ANALYZE & STRATEGY FLOW
// =============================================================================

export interface AnalyzeResponse {
  message: string;
  blocks?: any[];
}

export async function handleAnalyzeFlow(
  workspaceId: string,
  channelId: string,
  userId: string,
  input: string
): Promise<AnalyzeResponse> {
  const lower = input.toLowerCase();

  // Get comprehensive analytics data
  const analytics = await getWorkspaceAnalytics(workspaceId);

  // Determine what type of analysis to show
  if (lower.includes('message') || lower.includes('template') || lower.includes('copy')) {
    return generateMessageAnalysis(analytics);
  }

  if (lower.includes('time') || lower.includes('when') || lower.includes('schedule')) {
    return generateTimingAnalysis(analytics);
  }

  if (lower.includes('industry') || lower.includes('segment') || lower.includes('icp')) {
    return generateSegmentAnalysis(analytics);
  }

  // Default: Show overview with options
  return generateOverviewAnalysis(analytics, workspaceId);
}

async function getWorkspaceAnalytics(workspaceId: string): Promise<any> {
  // Get campaigns with stats
  const { data: campaigns } = await supabaseAdmin()
    .from('campaigns')
    .select('id, name, status, created_at, message_templates')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(10);

  // Get prospect stats by status
  const { data: prospects } = await supabaseAdmin()
    .from('campaign_prospects')
    .select('status, campaign_id, contacted_at, responded_at, company_name, title')
    .eq('workspace_id', workspaceId);

  // Get recent replies
  const { data: replies } = await supabaseAdmin()
    .from('campaign_prospects')
    .select('first_name, last_name, company_name, title, responded_at, campaign_id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'replied')
    .order('responded_at', { ascending: false })
    .limit(20);

  // Calculate stats
  const stats = {
    totalProspects: prospects?.length || 0,
    sent: prospects?.filter(p => ['connection_request_sent', 'connected', 'replied', 'follow_up_sent'].includes(p.status)).length || 0,
    connected: prospects?.filter(p => ['connected', 'replied', 'follow_up_sent'].includes(p.status)).length || 0,
    replied: prospects?.filter(p => p.status === 'replied').length || 0,
    pending: prospects?.filter(p => p.status === 'pending').length || 0,
  };

  stats.acceptanceRate = stats.sent > 0 ? ((stats.connected / stats.sent) * 100).toFixed(1) : '0';
  stats.replyRate = stats.connected > 0 ? ((stats.replied / stats.connected) * 100).toFixed(1) : '0';
  stats.overallConversion = stats.sent > 0 ? ((stats.replied / stats.sent) * 100).toFixed(1) : '0';

  // Group by campaign
  const campaignStats: Record<string, any> = {};
  campaigns?.forEach(c => {
    const campaignProspects = prospects?.filter(p => p.campaign_id === c.id) || [];
    campaignStats[c.id] = {
      name: c.name,
      status: c.status,
      total: campaignProspects.length,
      sent: campaignProspects.filter(p => ['connection_request_sent', 'connected', 'replied'].includes(p.status)).length,
      connected: campaignProspects.filter(p => ['connected', 'replied'].includes(p.status)).length,
      replied: campaignProspects.filter(p => p.status === 'replied').length,
    };
  });

  // Analyze by title/role
  const titleStats: Record<string, { total: number; replied: number }> = {};
  prospects?.forEach(p => {
    const title = normalizeTitle(p.title || 'Unknown');
    if (!titleStats[title]) titleStats[title] = { total: 0, replied: 0 };
    titleStats[title].total++;
    if (p.status === 'replied') titleStats[title].replied++;
  });

  // Analyze by industry/company
  const industryStats: Record<string, { total: number; replied: number }> = {};
  prospects?.forEach(p => {
    const industry = extractIndustry(p.company_name || 'Unknown');
    if (!industryStats[industry]) industryStats[industry] = { total: 0, replied: 0 };
    industryStats[industry].total++;
    if (p.status === 'replied') industryStats[industry].replied++;
  });

  return {
    campaigns,
    campaignStats,
    stats,
    titleStats,
    industryStats,
    replies,
    prospects,
  };
}

function normalizeTitle(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('ceo') || lower.includes('chief executive')) return 'CEO/Founder';
  if (lower.includes('cto') || lower.includes('chief technology')) return 'CTO';
  if (lower.includes('cmo') || lower.includes('chief marketing')) return 'CMO';
  if (lower.includes('vp') || lower.includes('vice president')) return 'VP';
  if (lower.includes('director')) return 'Director';
  if (lower.includes('head of')) return 'Head of';
  if (lower.includes('manager')) return 'Manager';
  if (lower.includes('founder') || lower.includes('owner')) return 'CEO/Founder';
  return 'Other';
}

function extractIndustry(company: string): string {
  const lower = company.toLowerCase();
  if (lower.includes('tech') || lower.includes('software') || lower.includes('saas')) return 'Tech/SaaS';
  if (lower.includes('finance') || lower.includes('bank') || lower.includes('capital')) return 'Finance';
  if (lower.includes('health') || lower.includes('medical') || lower.includes('pharma')) return 'Healthcare';
  if (lower.includes('retail') || lower.includes('commerce') || lower.includes('shop')) return 'Retail';
  if (lower.includes('consult') || lower.includes('advisory')) return 'Consulting';
  if (lower.includes('agency') || lower.includes('marketing')) return 'Marketing/Agency';
  return 'Other';
}

function generateOverviewAnalysis(analytics: any, workspaceId: string): AnalyzeResponse {
  const { stats, campaignStats, titleStats, replies } = analytics;

  // Find best performing title
  let bestTitle = { title: 'N/A', rate: 0 };
  Object.entries(titleStats).forEach(([title, data]: [string, any]) => {
    if (data.total >= 3) {
      const rate = (data.replied / data.total) * 100;
      if (rate > bestTitle.rate) {
        bestTitle = { title, rate };
      }
    }
  });

  // Find best performing campaign
  let bestCampaign = { name: 'N/A', rate: 0 };
  Object.values(campaignStats).forEach((c: any) => {
    if (c.sent >= 5) {
      const rate = (c.replied / c.sent) * 100;
      if (rate > bestCampaign.rate) {
        bestCampaign = { name: c.name, rate };
      }
    }
  });

  // Generate AI insights
  const insights: string[] = [];

  if (parseFloat(stats.acceptanceRate) > 30) {
    insights.push('✅ Your acceptance rate is strong! Your ICP targeting is working well.');
  } else if (parseFloat(stats.acceptanceRate) < 15) {
    insights.push('⚠️ Low acceptance rate. Consider refining your ICP or personalizing connection requests more.');
  }

  if (parseFloat(stats.replyRate) > 20) {
    insights.push('✅ Great reply rate! Your follow-up messages are resonating.');
  } else if (parseFloat(stats.replyRate) < 10 && stats.connected > 10) {
    insights.push('💡 Reply rate could improve. Try adding more value or asking engaging questions in follow-ups.');
  }

  if (bestTitle.rate > 25) {
    insights.push(`🎯 *${bestTitle.title}* titles respond best (${bestTitle.rate.toFixed(0)}% reply rate). Focus more here.`);
  }

  // Recent wins
  const recentReplies = replies?.slice(0, 3).map((r: any) =>
    `• ${r.first_name} ${r.last_name} (${r.title || 'Unknown'} at ${r.company_name || 'Unknown'})`
  ).join('\n') || '_No recent replies_';

  return {
    message: `📈 *Performance Overview*`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '📈 Performance Overview', emoji: true } },
      { type: 'divider' },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Total Prospects*\n${stats.totalProspects}` },
          { type: 'mrkdwn', text: `*CRs Sent*\n${stats.sent}` },
          { type: 'mrkdwn', text: `*Connected*\n${stats.connected} (${stats.acceptanceRate}%)` },
          { type: 'mrkdwn', text: `*Replied*\n${stats.replied} (${stats.replyRate}%)` },
        ],
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*🏆 Best Performing*\n• Campaign: ${bestCampaign.name} (${bestCampaign.rate.toFixed(0)}% conversion)\n• Title: ${bestTitle.title} (${bestTitle.rate.toFixed(0)}% reply rate)` },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*🔥 Recent Replies*\n${recentReplies}` },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*💡 AI Insights*\n${insights.length > 0 ? insights.join('\n') : '_Not enough data yet for insights._'}` },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Dive Deeper:*' },
      },
      {
        type: 'actions',
        elements: [
          { type: 'button', text: { type: 'plain_text', text: '📝 Message Analysis' }, action_id: 'analyze_messages' },
          { type: 'button', text: { type: 'plain_text', text: '⏰ Best Times' }, action_id: 'analyze_timing' },
          { type: 'button', text: { type: 'plain_text', text: '🎯 Segment Analysis' }, action_id: 'analyze_segments' },
          { type: 'button', text: { type: 'plain_text', text: '💡 Get Recommendations' }, action_id: 'get_recommendations' },
        ],
      },
    ],
  };
}

function generateMessageAnalysis(analytics: any): AnalyzeResponse {
  const { campaigns, campaignStats } = analytics;

  // Analyze message lengths and patterns
  const messageAnalysis: any[] = [];

  campaigns?.forEach((c: any) => {
    const stats = campaignStats[c.id];
    const templates = c.message_templates || {};
    const cr = templates.connection_request || '';
    const replyRate = stats.sent > 0 ? ((stats.replied / stats.sent) * 100).toFixed(1) : '0';

    messageAnalysis.push({
      campaign: c.name,
      crLength: cr.length,
      hasQuestion: cr.includes('?'),
      hasPersonalization: cr.includes('{{') || cr.toLowerCase().includes('noticed'),
      replyRate: parseFloat(replyRate),
    });
  });

  // Generate insights
  const insights: string[] = [];

  const avgLength = messageAnalysis.reduce((acc, m) => acc + m.crLength, 0) / messageAnalysis.length || 0;
  if (avgLength > 250) {
    insights.push('📏 Your messages are a bit long. Try keeping CRs under 200 characters for better acceptance.');
  } else if (avgLength < 100) {
    insights.push('✅ Nice! Short, punchy messages tend to perform better.');
  }

  const withQuestions = messageAnalysis.filter(m => m.hasQuestion);
  const withoutQuestions = messageAnalysis.filter(m => !m.hasQuestion);
  if (withQuestions.length > 0 && withoutQuestions.length > 0) {
    const avgWithQ = withQuestions.reduce((acc, m) => acc + m.replyRate, 0) / withQuestions.length;
    const avgWithoutQ = withoutQuestions.reduce((acc, m) => acc + m.replyRate, 0) / withoutQuestions.length;
    if (avgWithQ > avgWithoutQ) {
      insights.push('❓ Messages with questions get better replies. Keep asking engaging questions!');
    }
  }

  const personalizedMsgs = messageAnalysis.filter(m => m.hasPersonalization);
  if (personalizedMsgs.length < messageAnalysis.length / 2) {
    insights.push('✨ Try adding more personalization ({{first_name}}, company references) to boost engagement.');
  }

  return {
    message: '📝 *Message Analysis*',
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '📝 Message Analysis', emoji: true } },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Message Stats*\n• Average CR length: ${avgLength.toFixed(0)} characters\n• Messages with questions: ${messageAnalysis.filter(m => m.hasQuestion).length}/${messageAnalysis.length}\n• Personalized messages: ${messageAnalysis.filter(m => m.hasPersonalization).length}/${messageAnalysis.length}`,
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*💡 Recommendations*\n${insights.length > 0 ? insights.join('\n') : '_Keep testing different approaches!_'}` },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Best Practices:*\n• Keep CRs under 200 characters\n• Always include {{first_name}}\n• End with a soft question\n• Reference something specific about them' },
      },
      {
        type: 'actions',
        elements: [
          { type: 'button', text: { type: 'plain_text', text: '← Back to Overview' }, action_id: 'start_analyze' },
          { type: 'button', text: { type: 'plain_text', text: '✨ Generate New CR' }, action_id: 'generate_cr_suggestion' },
        ],
      },
    ],
  };
}

function generateTimingAnalysis(analytics: any): AnalyzeResponse {
  const { prospects, replies } = analytics;

  // Analyze response times by day of week
  const dayStats: Record<string, { sent: number; replied: number }> = {
    'Monday': { sent: 0, replied: 0 },
    'Tuesday': { sent: 0, replied: 0 },
    'Wednesday': { sent: 0, replied: 0 },
    'Thursday': { sent: 0, replied: 0 },
    'Friday': { sent: 0, replied: 0 },
  };

  prospects?.forEach((p: any) => {
    if (p.contacted_at) {
      const day = new Date(p.contacted_at).toLocaleDateString('en-US', { weekday: 'long' });
      if (dayStats[day]) {
        dayStats[day].sent++;
        if (p.status === 'replied') dayStats[day].replied++;
      }
    }
  });

  // Find best day
  let bestDay = { day: 'N/A', rate: 0 };
  Object.entries(dayStats).forEach(([day, data]) => {
    if (data.sent >= 5) {
      const rate = (data.replied / data.sent) * 100;
      if (rate > bestDay.rate) {
        bestDay = { day, rate };
      }
    }
  });

  const dayBreakdown = Object.entries(dayStats)
    .map(([day, data]) => {
      const rate = data.sent > 0 ? ((data.replied / data.sent) * 100).toFixed(0) : '0';
      const bar = '█'.repeat(Math.min(Math.round(parseFloat(rate) / 10), 10));
      return `${day.substring(0, 3)}: ${bar} ${rate}% (${data.sent} sent)`;
    })
    .join('\n');

  return {
    message: '⏰ *Timing Analysis*',
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '⏰ Best Times to Send', emoji: true } },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*🏆 Best Day: ${bestDay.day}*\n${bestDay.rate.toFixed(0)}% reply rate` },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Reply Rates by Day*\n\`\`\`\n${dayBreakdown}\n\`\`\`` },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*💡 Recommendations*\n• Tuesday-Thursday typically perform best\n• Avoid Monday mornings (inbox overload)\n• Friday afternoons see lower engagement\n• Send between 9-11 AM local time',
        },
      },
      {
        type: 'actions',
        elements: [
          { type: 'button', text: { type: 'plain_text', text: '← Back to Overview' }, action_id: 'start_analyze' },
        ],
      },
    ],
  };
}

function generateSegmentAnalysis(analytics: any): AnalyzeResponse {
  const { titleStats, industryStats, stats } = analytics;

  // Sort titles by reply rate
  const sortedTitles = Object.entries(titleStats)
    .filter(([_, data]: [string, any]) => data.total >= 3)
    .map(([title, data]: [string, any]) => ({
      title,
      total: data.total,
      replied: data.replied,
      rate: (data.replied / data.total) * 100,
    }))
    .sort((a, b) => b.rate - a.rate);

  // Sort industries by reply rate
  const sortedIndustries = Object.entries(industryStats)
    .filter(([_, data]: [string, any]) => data.total >= 3)
    .map(([industry, data]: [string, any]) => ({
      industry,
      total: data.total,
      replied: data.replied,
      rate: (data.replied / data.total) * 100,
    }))
    .sort((a, b) => b.rate - a.rate);

  const titleBreakdown = sortedTitles.slice(0, 5).map(t =>
    `• *${t.title}*: ${t.rate.toFixed(0)}% reply rate (${t.total} contacted)`
  ).join('\n') || '_Not enough data_';

  const industryBreakdown = sortedIndustries.slice(0, 5).map(i =>
    `• *${i.industry}*: ${i.rate.toFixed(0)}% reply rate (${i.total} contacted)`
  ).join('\n') || '_Not enough data_';

  // Generate recommendations
  const recommendations: string[] = [];
  if (sortedTitles.length > 0 && sortedTitles[0].rate > 20) {
    recommendations.push(`🎯 Focus on *${sortedTitles[0].title}* titles - they're your best responders!`);
  }
  if (sortedIndustries.length > 0 && sortedIndustries[0].rate > 20) {
    recommendations.push(`🏢 *${sortedIndustries[0].industry}* companies engage most with your outreach.`);
  }
  if (sortedTitles.length > 2 && sortedTitles[sortedTitles.length - 1].rate < 5) {
    recommendations.push(`⚠️ Consider removing *${sortedTitles[sortedTitles.length - 1].title}* from your ICP - very low engagement.`);
  }

  return {
    message: '🎯 *Segment Analysis*',
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '🎯 Segment Performance', emoji: true } },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*By Job Title*\n${titleBreakdown}` },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*By Industry*\n${industryBreakdown}` },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*💡 Recommendations*\n${recommendations.length > 0 ? recommendations.join('\n') : '_Need more data to generate recommendations_'}` },
      },
      {
        type: 'actions',
        elements: [
          { type: 'button', text: { type: 'plain_text', text: '← Back to Overview' }, action_id: 'start_analyze' },
          { type: 'button', text: { type: 'plain_text', text: '⚙️ Update ICP' }, action_id: 'start_icp_setup' },
        ],
      },
    ],
  };
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
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*📈 Analyze & Strategy*\nPerformance insights & AI recommendations' },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'Analyze' },
          action_id: 'start_analyze',
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
  | 'analyze'
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

  // Analyze triggers
  if (
    lower.includes('analyze') ||
    lower.includes('analytics') ||
    lower.includes('performance') ||
    lower.includes('insights') ||
    lower.includes('strategy') ||
    lower.includes('how am i doing') ||
    lower.includes('results') ||
    lower.includes('metrics')
  ) {
    return 'analyze';
  }

  return 'general';
}
