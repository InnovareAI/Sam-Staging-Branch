/**
 * Search Intent Detection for ICP-Aware Search
 * Detects when user wants to search and determines if KB ICP should be used
 */

import { supabaseKnowledge } from './supabase-knowledge';

export interface SearchIntent {
  detected: boolean;
  type: 'icp_search' | 'custom_search' | 'validation' | 'none';
  confidence: number;
  suggestedICP?: {
    id: string;
    name: string;
    summary: string;
    industries: string[];
    roles: string[];
  };
}

/**
 * Search keywords that indicate user wants to find prospects
 */
const SEARCH_KEYWORDS = [
  'find prospects',
  'search for',
  'look for',
  'identify leads',
  'discover people',
  'target',
  'reach out to',
  'campaign for',
  'find companies',
  'find people',
  'search linkedin',
  'prospect',
  'looking for',
  'need to find',
  'help me find',
  'can you find',
  'get me',
  'pull a list'
];

/**
 * Detect if user message indicates search intent
 */
export function detectSearchKeywords(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return SEARCH_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Detect search intent and recommend ICP usage
 */
export async function detectSearchIntent(
  userMessage: string,
  workspaceId: string
): Promise<SearchIntent> {
  // 1. Check for search keywords
  const hasSearchKeywords = detectSearchKeywords(userMessage);

  if (!hasSearchKeywords) {
    return {
      detected: false,
      type: 'none',
      confidence: 0
    };
  }

  // 2. Fetch workspace ICPs
  const icps = await supabaseKnowledge.getICPs({ workspaceId });

  if (icps.length === 0) {
    // No ICP exists - definitely custom search
    return {
      detected: true,
      type: 'custom_search',
      confidence: 1.0
    };
  }

  const icp = icps[0]; // Use most recent ICP

  // 3. Simple keyword matching (fast, no embeddings needed)
  const messageWords = userMessage.toLowerCase().split(/\s+/);

  // Check if message mentions ICP industries
  const mentionsIndustry = icp.industries?.some(industry =>
    messageWords.some(word => industry.toLowerCase().includes(word) || word.includes(industry.toLowerCase()))
  );

  // Check if message mentions ICP roles
  const mentionsRole = icp.job_titles?.some(role =>
    messageWords.some(word => role.toLowerCase().includes(word) || word.includes(role.toLowerCase()))
  );

  // 4. Determine intent based on keyword match
  if (mentionsIndustry || mentionsRole) {
    // User mentioned ICP-related terms - high confidence ICP search
    return {
      detected: true,
      type: 'icp_search',
      confidence: 0.9,
      suggestedICP: {
        id: icp.id,
        name: icp.name || 'Your ICP',
        summary: buildICPSummary(icp),
        industries: icp.industries || [],
        roles: icp.job_titles || []
      }
    };
  }

  // 5. Generic search request - ask for validation
  return {
    detected: true,
    type: 'validation',
    confidence: 0.6,
    suggestedICP: {
      id: icp.id,
      name: icp.name || 'Your ICP',
      summary: buildICPSummary(icp),
      industries: icp.industries || [],
      roles: icp.job_titles || []
    }
  };
}

/**
 * Build human-readable ICP summary
 */
function buildICPSummary(icp: any): string {
  const parts: string[] = [];

  if (icp.industries && icp.industries.length > 0) {
    parts.push(`${icp.industries.slice(0, 2).join(', ')} industry`);
  }

  if (icp.job_titles && icp.job_titles.length > 0) {
    parts.push(`${icp.job_titles.slice(0, 2).join(', ')}`);
  }

  if (icp.company_size_min || icp.company_size_max) {
    const min = icp.company_size_min || '?';
    const max = icp.company_size_max || '?';
    parts.push(`${min}-${max} employees`);
  }

  return parts.join(' | ');
}

/**
 * Get SAM response template for search intent
 */
export function getICPAwareSearchPrompt(intent: SearchIntent): string | null {
  if (!intent.detected || intent.type === 'none') {
    return null;
  }

  switch (intent.type) {
    case 'icp_search':
      return `\n**ICP-AWARE SEARCH DETECTED**

User wants to search. I have an ICP saved that matches their request:

**${intent.suggestedICP!.name}**
${intent.suggestedICP!.summary}

RESPONSE TEMPLATE:
"I can search for prospects matching your ICP:
- Industry: ${intent.suggestedICP!.industries.join(', ')}
- Roles: ${intent.suggestedICP!.roles.join(', ')}

Should I use this ICP, or are you looking for something different?"

WAIT for user confirmation before proceeding.`;

    case 'validation':
      return `\n**SEARCH INTENT DETECTED (VALIDATION NEEDED)**

User wants to search. I have an ICP that might match:

**${intent.suggestedICP!.name}**
${intent.suggestedICP!.summary}

RESPONSE TEMPLATE:
"Got it, you want to find prospects. Quick check - I have an ICP for:
- ${intent.suggestedICP!.industries.join(', ')}
- ${intent.suggestedICP!.roles.join(', ')}

Is this what you're looking for, or something different?"

WAIT for user confirmation.`;

    case 'custom_search':
      return `\n**CUSTOM SEARCH NEEDED**

User wants to search but NO ICP exists in KB.

RESPONSE TEMPLATE:
"Sure! I can find prospects for you. What specific criteria should I use?

(You can give me industry, role, company size, location, etc.)"

Then capture criteria and offer to save as ICP for future use.`;

    default:
      return null;
  }
}
