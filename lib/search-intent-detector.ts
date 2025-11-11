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
    // Tech verticals
    'saas', 'b2b saas', 'b2c saas', 'fintech', 'healthtech', 'edtech', 'martech', 'proptech',
    'insurtech', 'legaltech', 'regtech', 'hrtech', 'adtech', 'cleantech', 'agritech',
    'cybersecurity', 'ai', 'artificial intelligence', 'machine learning', 'blockchain',
    'web3', 'crypto', 'devtools', 'infrastructure', 'cloud', 'data analytics',

    // Traditional industries
    'ecommerce', 'e-commerce', 'd2c', 'dtc', 'marketplace', 'consumer goods',
    'manufacturing', 'automotive', 'aerospace', 'industrial',
    'healthcare', 'medical devices', 'biotech', 'pharmaceuticals', 'life sciences',
    'finance', 'banking', 'wealth management', 'payments', 'finserv',
    'real estate', 'commercial real estate', 'residential real estate',
    'insurance', 'legal services', 'professional services',
    'consulting', 'agency', 'creative agency', 'marketing agency',
    'logistics', 'supply chain', 'transportation', 'shipping',
    'retail', 'hospitality', 'restaurants', 'food and beverage',
    'construction', 'architecture', 'engineering',
    'energy', 'oil and gas', 'renewable energy', 'utilities',
    'telecommunications', 'media', 'entertainment', 'gaming',
    'education', 'higher education', 'k-12',
    'nonprofit', 'government', 'public sector'
  ];
  const lowerMessage = message.toLowerCase();
  return specificIndustries.some(industry => lowerMessage.includes(industry));
}

/**
 * Helper: Check if message has specific role (not just "CEO" or "founder")
 */
function hasSpecificRole(message: string): boolean {
  const specificRoles = [
    // C-Suite
    'cto', 'chief technology officer', 'cfo', 'chief financial officer',
    'cmo', 'chief marketing officer', 'coo', 'chief operating officer',
    'cro', 'chief revenue officer', 'cso', 'chief sales officer',
    'cpo', 'chief product officer', 'chro', 'chief human resources',
    'ciso', 'chief information security',

    // VP/SVP Level
    'vp sales', 'vp of sales', 'vice president sales', 'svp sales',
    'vp marketing', 'vp of marketing', 'vice president marketing', 'svp marketing',
    'vp engineering', 'vp of engineering', 'vice president engineering',
    'vp product', 'vp of product', 'vice president product',
    'vp operations', 'vp of operations', 'vice president operations',
    'vp finance', 'vp of finance', 'vice president finance',
    'vp customer success', 'vp of customer success',
    'vp revenue', 'vp of revenue', 'vice president revenue',

    // Director Level
    'director of sales', 'sales director', 'director sales development',
    'director of marketing', 'marketing director', 'director demand generation',
    'director of engineering', 'engineering director', 'director of product',
    'director of operations', 'operations director', 'director of finance',
    'director of customer success', 'director of revenue operations',

    // Head Of
    'head of sales', 'head of marketing', 'head of growth', 'head of revenue',
    'head of product', 'head of engineering', 'head of operations',
    'head of customer success', 'head of finance', 'head of people',
    'head of business development', 'head of partnerships',

    // Specialized Roles
    'revenue operations', 'revops', 'revenue ops manager', 'revops director',
    'growth marketing', 'growth marketing manager', 'growth lead',
    'demand generation', 'demand gen manager', 'demand gen director',
    'sales development', 'sdr manager', 'bdr manager',
    'account executive', 'enterprise sales', 'sales manager',
    'product manager', 'senior product manager', 'product lead',
    'engineering manager', 'software engineering manager', 'tech lead',
    'customer success manager', 'csm', 'customer success director',
    'marketing operations', 'marketing ops', 'campaign manager',
    'business development', 'bd manager', 'partnerships manager',
    'sales enablement', 'sales operations', 'sales ops manager'
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
    questions.push("**1. What specific type of tech company?**\n   Examples: B2B SaaS, FinTech, HealthTech, eCommerce, AI/ML, Cybersecurity, DevTools, Marketplace, etc.");
  }

  if (missingCriteria.includes('specific_industry') && questions.length === 0) {
    questions.push("**1. What industry are they in?**\n   Examples: B2B SaaS, Healthcare, Real Estate, Finance, Manufacturing, Legal, Consulting, etc.");
  }

  if (vagueTerms.includes('ceo') || vagueTerms.includes('founder') || missingCriteria.includes('specific_role')) {
    const questionNum = questions.length + 1;
    questions.push(`**${questionNum}. What's their specific role or function?**\n   Examples: VP Sales, Head of Marketing, CRO, CFO, VP Engineering, Director of Growth, RevOps, etc.`);
  }

  if (missingCriteria.includes('company_size') || vagueTerms.includes('startup') || vagueTerms.includes('small')) {
    const questionNum = questions.length + 1;
    questions.push(`**${questionNum}. What company size range works best?**\n   Examples: 1-10 (early startup), 10-50 (growth stage), 50-200 (scaling), 200-1000 (mid-market), 1000+ (enterprise)`);
  }

  if (missingCriteria.includes('funding_stage')) {
    const questionNum = questions.length + 1;
    questions.push(`**${questionNum}. What funding stage?**\n   Examples: Pre-Seed, Seed, Series A, Series B/C, Bootstrapped, Profitable, Public`);
  }

  // Add location if not already specified
  const questionNum = questions.length + 1;
  questions.push(`**${questionNum}. Any location preference?**\n   Examples: US-based, Bay Area, NYC, Remote-first, Europe, Global (leave blank if no preference)`);

  return questions.join('\n\n');
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
"I can definitely help you find prospects! But let's get more specific so we can find the *right* people instead of just a random list.

Broad searches like 'tech CEOs' or 'startup founders' usually return 1000s of profiles that don't fit your actual target market. The more specific we are, the better your results (and response rates) will be.

Quick questions to dial this in:

${questions}

Once I have these details, I'll pull a highly targeted list of prospects who actually match your ICP."

DO NOT proceed with search until user provides specific answers.
AFTER user answers, confirm the refined criteria before searching.`;

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
