/**
 * LinkedIn Lead Scoring Service
 *
 * Scores commenters on your posts based on:
 * - Job title (seniority, decision-maker keywords)
 * - Company (size, industry match)
 * - Connection degree (1st, 2nd, 3rd)
 * - Comment quality (length, contains question)
 *
 * Used by self-post engagement to decide:
 * - Whether to send connection request
 * - Whether to enroll in DM sequence
 * - Whether to sync to CRM
 */

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

export interface CommenterProfile {
  provider_id: string;
  name: string;
  headline?: string;
  title?: string;
  company?: string;
  location?: string;
  connections?: number;
  connection_degree?: '1st' | '2nd' | '3rd' | 'Out of Network';
  profile_url?: string;
}

export interface ScoringRules {
  title_keywords: Record<string, number>;
  company_size_scoring: Record<string, number>;
  target_industries: string[];
  industry_bonus: number;
  first_degree_bonus: number;
  second_degree_bonus: number;
  third_degree_bonus: number;
  comment_length_bonus: number;
  question_bonus: number;
  min_score_for_cr: number;
  min_score_for_dm_sequence: number;
  min_score_for_crm_sync: number;
}

export interface ScoreBreakdown {
  title_score: number;
  title_matches: string[];
  company_score: number;
  connection_degree_score: number;
  comment_quality_score: number;
  industry_score: number;
  total_score: number;
  qualifying_actions: {
    connection_request: boolean;
    dm_sequence: boolean;
    crm_sync: boolean;
  };
}

// Default scoring rules (used if no custom rules configured)
export const DEFAULT_SCORING_RULES: ScoringRules = {
  title_keywords: {
    'ceo': 30, 'cto': 30, 'cfo': 25, 'coo': 25,
    'founder': 30, 'co-founder': 30, 'owner': 25,
    'president': 25, 'partner': 20,
    'vp': 20, 'vice president': 20,
    'director': 15, 'head of': 15,
    'manager': 10, 'lead': 10,
    'senior': 5, 'principal': 5
  },
  company_size_scoring: {
    '1-10': 5, '11-50': 10, '51-200': 15,
    '201-500': 20, '501-1000': 25,
    '1001-5000': 20, '5001-10000': 15,
    '10001+': 10
  },
  target_industries: [],
  industry_bonus: 15,
  first_degree_bonus: 20,
  second_degree_bonus: 10,
  third_degree_bonus: 0,
  comment_length_bonus: 5,
  question_bonus: 10,
  min_score_for_cr: 50,
  min_score_for_dm_sequence: 60,
  min_score_for_crm_sync: 40
};

/**
 * Fetch commenter profile from LinkedIn via Unipile
 */
export async function fetchCommenterProfile(
  providerIdOrVanity: string,
  accountId: string
): Promise<CommenterProfile | null> {
  try {
    // Try provider_id first, then vanity URL
    let endpoint: string;
    if (providerIdOrVanity.startsWith('ACoA') || providerIdOrVanity.includes(':')) {
      // Provider ID format
      endpoint = `${UNIPILE_BASE_URL}/api/v1/users/profile?provider_id=${encodeURIComponent(providerIdOrVanity)}&account_id=${accountId}`;
    } else {
      // Vanity URL format - use legacy endpoint (more reliable)
      endpoint = `${UNIPILE_BASE_URL}/api/v1/users/${encodeURIComponent(providerIdOrVanity)}?account_id=${accountId}`;
    }

    const response = await fetch(endpoint, {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch profile: ${response.status}`);
      return null;
    }

    const data = await response.json();

    return {
      provider_id: data.provider_id || data.id,
      name: data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
      headline: data.headline || data.occupation,
      title: extractTitle(data.headline || data.occupation),
      company: extractCompany(data.headline || data.occupation) || data.company?.name,
      location: data.location || data.geo_location,
      connections: data.connections_count || data.follower_count,
      connection_degree: parseConnectionDegree(data.distance || data.connection_degree),
      profile_url: data.profile_url || data.public_profile_url
    };
  } catch (error) {
    console.error('Error fetching commenter profile:', error);
    return null;
  }
}

/**
 * Extract job title from headline (usually "Title at Company")
 */
function extractTitle(headline?: string): string | undefined {
  if (!headline) return undefined;

  // Common patterns: "Title at Company", "Title | Company", "Title @ Company"
  const atMatch = headline.match(/^(.+?)\s+(?:at|@|\|)\s+/i);
  if (atMatch) return atMatch[1].trim();

  // If no pattern, return first part before comma
  const commaMatch = headline.match(/^(.+?),/);
  if (commaMatch) return commaMatch[1].trim();

  // Return whole headline if short enough
  if (headline.length < 50) return headline;

  return headline.substring(0, 50);
}

/**
 * Extract company from headline
 */
function extractCompany(headline?: string): string | undefined {
  if (!headline) return undefined;

  // Common patterns: "Title at Company", "Title | Company"
  const atMatch = headline.match(/(?:at|@|\|)\s+(.+?)(?:$|,|\|)/i);
  if (atMatch) return atMatch[1].trim();

  return undefined;
}

/**
 * Parse connection degree from Unipile response
 */
function parseConnectionDegree(degree?: string | number): '1st' | '2nd' | '3rd' | 'Out of Network' {
  if (!degree) return 'Out of Network';

  const degreeStr = String(degree).toLowerCase();

  if (degreeStr.includes('1') || degreeStr === 'first') return '1st';
  if (degreeStr.includes('2') || degreeStr === 'second') return '2nd';
  if (degreeStr.includes('3') || degreeStr === 'third') return '3rd';

  return 'Out of Network';
}

/**
 * Score a commenter based on their profile and comment
 */
export function scoreCommenter(
  profile: CommenterProfile,
  commentText: string,
  rules: ScoringRules = DEFAULT_SCORING_RULES
): ScoreBreakdown {
  const breakdown: ScoreBreakdown = {
    title_score: 0,
    title_matches: [],
    company_score: 0,
    connection_degree_score: 0,
    comment_quality_score: 0,
    industry_score: 0,
    total_score: 0,
    qualifying_actions: {
      connection_request: false,
      dm_sequence: false,
      crm_sync: false
    }
  };

  // 1. Title scoring
  const titleLower = (profile.title || profile.headline || '').toLowerCase();
  for (const [keyword, points] of Object.entries(rules.title_keywords)) {
    if (titleLower.includes(keyword.toLowerCase())) {
      breakdown.title_score += points;
      breakdown.title_matches.push(keyword);
    }
  }
  // Cap title score at 40
  breakdown.title_score = Math.min(breakdown.title_score, 40);

  // 2. Connection degree scoring
  switch (profile.connection_degree) {
    case '1st':
      breakdown.connection_degree_score = rules.first_degree_bonus;
      break;
    case '2nd':
      breakdown.connection_degree_score = rules.second_degree_bonus;
      break;
    case '3rd':
      breakdown.connection_degree_score = rules.third_degree_bonus;
      break;
    default:
      breakdown.connection_degree_score = 0;
  }

  // 3. Comment quality scoring
  // Length bonus (per 50 chars, max 20 points)
  const lengthBonus = Math.min(Math.floor(commentText.length / 50) * rules.comment_length_bonus, 20);
  breakdown.comment_quality_score += lengthBonus;

  // Question bonus
  if (commentText.includes('?')) {
    breakdown.comment_quality_score += rules.question_bonus;
  }

  // 4. Industry scoring (if target industries configured)
  if (rules.target_industries.length > 0 && profile.headline) {
    const headlineLower = profile.headline.toLowerCase();
    for (const industry of rules.target_industries) {
      if (headlineLower.includes(industry.toLowerCase())) {
        breakdown.industry_score = rules.industry_bonus;
        break;
      }
    }
  }

  // Calculate total
  breakdown.total_score =
    breakdown.title_score +
    breakdown.company_score +
    breakdown.connection_degree_score +
    breakdown.comment_quality_score +
    breakdown.industry_score;

  // Determine qualifying actions
  breakdown.qualifying_actions = {
    connection_request: breakdown.total_score >= rules.min_score_for_cr,
    dm_sequence: breakdown.total_score >= rules.min_score_for_dm_sequence,
    crm_sync: breakdown.total_score >= rules.min_score_for_crm_sync
  };

  return breakdown;
}

/**
 * Generate a personalized connection request message
 */
export function generateCRMessage(
  profile: CommenterProfile,
  postTitle: string,
  customTemplate?: string
): string {
  const firstName = profile.name.split(' ')[0];

  if (customTemplate) {
    return customTemplate
      .replace('{first_name}', firstName)
      .replace('{name}', profile.name)
      .replace('{title}', profile.title || '')
      .replace('{company}', profile.company || '')
      .replace('{post_title}', postTitle);
  }

  // Default message
  return `Hi ${firstName}, thanks for engaging with my post${postTitle ? ` about ${postTitle}` : ''}! Would love to connect and continue the conversation.`;
}
