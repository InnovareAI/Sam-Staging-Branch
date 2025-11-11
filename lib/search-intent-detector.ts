/**
 * Search Intent Detection for ICP-Aware Search
 * Detects when user wants to search and determines if KB ICP should be used
 * NOW: Validates search criteria specificity and asks qualifying questions
 */

import { supabaseKnowledge } from './supabase-knowledge';

export interface SearchIntent {
  detected: boolean;
  type: 'icp_search' | 'custom_search' | 'validation' | 'none' | 'needs_qualification';
  confidence: number;
  suggestedICP?: {
    id: string;
    name: string;
    summary: string;
    industries: string[];
    roles: string[];
  };
  missingCriteria?: string[];
  vagueTerms?: string[];
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
 * Vague industry/role terms that need qualification
 */
const VAGUE_TERMS = {
  industries: [
    'tech', 'technology', 'startup', 'startups', 'companies', 'businesses',
    'firms', 'organizations', 'software', 'digital', 'online', 'enterprise'
  ],
  roles: [
    'ceo', 'founder', 'executive', 'leader', 'manager', 'director', 'vp',
    'owner', 'head', 'chief'
  ],
  companySize: ['small', 'medium', 'large', 'big', 'startup']
};

/**
 * Detect if user message indicates search intent
 */
export function detectSearchKeywords(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return SEARCH_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Check if search criteria is too vague and needs qualification
 */
export function detectVagueCriteria(message: string): {
  isVague: boolean;
  vagueTerms: string[];
  missingCriteria: string[];
} {
  const lowerMessage = message.toLowerCase();
  const vagueTerms: string[] = [];
  const missingCriteria: string[] = [];

  // Check for vague industry terms
  const hasVagueIndustry = VAGUE_TERMS.industries.some(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    if (regex.test(message)) {
      vagueTerms.push(term);
      return true;
    }
    return false;
  });

  // Check for vague role terms
  const hasVagueRole = VAGUE_TERMS.roles.some(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    if (regex.test(message)) {
      vagueTerms.push(term);
      return true;
    }
    return false;
  });

  // Check for vague company size
  const hasVagueSize = VAGUE_TERMS.companySize.some(term => {
    if (lowerMessage.includes(term)) {
      vagueTerms.push(term);
      return true;
    }
    return false;
  });

  // Check what critical criteria is missing
  if (!hasSpecificIndustry(message)) {
    missingCriteria.push('specific_industry');
  }
  if (!hasSpecificRole(message)) {
    missingCriteria.push('specific_role');
  }
  if (!hasCompanySize(message)) {
    missingCriteria.push('company_size');
  }
  if (!hasFundingStage(message)) {
    missingCriteria.push('funding_stage');
  }

  const isVague = vagueTerms.length > 0 || missingCriteria.length >= 2;

  return {
    isVague,
    vagueTerms,
    missingCriteria
  };
}

/**
 * Helper: Check if message has specific industry (not just "tech" or "startup")
 */
function hasSpecificIndustry(message: string): boolean {
  const specificIndustries = [
    'saas', 'fintech', 'healthtech', 'edtech', 'martech', 'proptech',
    'ecommerce', 'e-commerce', 'manufacturing', 'healthcare', 'finance',
    'real estate', 'insurance', 'legal', 'consulting', 'agency',
    'logistics', 'supply chain', 'retail', 'hospitality', 'construction'
  ];
  const lowerMessage = message.toLowerCase();
  return specificIndustries.some(industry => lowerMessage.includes(industry));
}

/**
 * Helper: Check if message has specific role (not just "CEO" or "founder")
 */
function hasSpecificRole(message: string): boolean {
  const specificRoles = [
    'vp sales', 'vp marketing', 'vp engineering', 'cto', 'cfo', 'cmo', 'coo',
    'head of sales', 'head of marketing', 'sales director', 'marketing director',
    'revenue operations', 'revops', 'growth marketing', 'demand generation',
    'product manager', 'engineering manager'
  ];
  const lowerMessage = message.toLowerCase();
  return specificRoles.some(role => lowerMessage.includes(role));
}

/**
 * Helper: Check if message specifies company size
 */
function hasCompanySize(message: string): boolean {
  const sizePatterns = [
    /\d+\s*-\s*\d+\s*(employees|people|team)/i, // "50-200 employees"
    /\d+\+\s*(employees|people)/i, // "100+ employees"
    /(series\s*[a-d]|seed|pre-seed)/i // Funding rounds
  ];
  return sizePatterns.some(pattern => pattern.test(message));
}

/**
 * Helper: Check if message specifies funding stage
 */
function hasFundingStage(message: string): boolean {
  const fundingStages = [
    'seed', 'pre-seed', 'series a', 'series b', 'series c', 'series d',
    'bootstrapped', 'profitable', 'revenue', 'funded', 'venture backed'
  ];
  const lowerMessage = message.toLowerCase();
  return fundingStages.some(stage => lowerMessage.includes(stage));
}

/**
 * Detect search intent and recommend ICP usage
 * NOW: Checks for vague criteria and asks qualifying questions BEFORE searching
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

  // 2. CRITICAL: Check if search criteria is too vague
  const vagueCheck = detectVagueCriteria(userMessage);

  if (vagueCheck.isVague) {
    // Criteria is too vague - need to qualify BEFORE searching
    return {
      detected: true,
      type: 'needs_qualification',
      confidence: 1.0,
      vagueTerms: vagueCheck.vagueTerms,
      missingCriteria: vagueCheck.missingCriteria
    };
  }

  // 3. Fetch workspace ICPs
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

  // 4. Simple keyword matching (fast, no embeddings needed)
  const messageWords = userMessage.toLowerCase().split(/\s+/);

  // Check if message mentions ICP industries
  const mentionsIndustry = icp.industries?.some(industry =>
    messageWords.some(word => industry.toLowerCase().includes(word) || word.includes(industry.toLowerCase()))
  );

  // Check if message mentions ICP roles
  const mentionsRole = icp.job_titles?.some(role =>
    messageWords.some(word => role.toLowerCase().includes(word) || word.includes(role.toLowerCase()))
  );

  // 5. Determine intent based on keyword match
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

  // 6. Generic search request - ask for validation
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
 * Generate qualifying questions based on missing/vague criteria
 */
export function generateQualificationQuestions(intent: SearchIntent): string {
  if (intent.type !== 'needs_qualification') {
    return '';
  }

  const questions: string[] = [];
  const vagueTerms = intent.vagueTerms || [];
  const missingCriteria = intent.missingCriteria || [];

  // Build context-aware questions
  if (vagueTerms.includes('tech') || vagueTerms.includes('technology') || vagueTerms.includes('startup')) {
    questions.push("**What type of tech/startup?** (e.g., SaaS, FinTech, HealthTech, eCommerce, AI/ML, etc.)");
  }

  if (missingCriteria.includes('specific_industry')) {
    questions.push("**What specific industry?** (e.g., B2B SaaS, Healthcare, Real Estate, Financial Services, etc.)");
  }

  if (vagueTerms.includes('ceo') || vagueTerms.includes('founder') || missingCriteria.includes('specific_role')) {
    questions.push("**What specific role/function?** (e.g., VP Sales, Head of Marketing, CFO, CRO, etc.)");
  }

  if (missingCriteria.includes('company_size') || vagueTerms.includes('startup') || vagueTerms.includes('small')) {
    questions.push("**What company size?** (e.g., 1-10, 10-50, 50-200, 200+ employees)");
  }

  if (missingCriteria.includes('funding_stage')) {
    questions.push("**What funding stage?** (e.g., Seed, Series A/B/C, Bootstrapped, Profitable)");
  }

  // Always add these for better targeting
  if (!questions.some(q => q.includes('company size'))) {
    questions.push("**Any company size preference?** (helps narrow down results)");
  }

  return questions.join('\n');
}

/**
 * Get SAM response template for search intent
 */
export function getICPAwareSearchPrompt(intent: SearchIntent): string | null {
  if (!intent.detected || intent.type === 'none') {
    return null;
  }

  switch (intent.type) {
    case 'needs_qualification':
      const questions = generateQualificationQuestions(intent);
      return `\n**VAGUE SEARCH CRITERIA DETECTED**

User's search is too broad and will generate poor results.
Vague terms: ${intent.vagueTerms?.join(', ') || 'multiple'}
Missing criteria: ${intent.missingCriteria?.join(', ') || 'multiple'}

RESPONSE TEMPLATE:
"I can help you find prospects, but let's niche down your search to get better, more targeted results. Broad searches like 'tech startup CEOs' usually return thousands of random profiles.

Let me ask a few quick questions to narrow this down:

${questions}

This will help me find highly relevant prospects who actually match what you're looking for."

DO NOT proceed with search until user provides specific answers.`;

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
