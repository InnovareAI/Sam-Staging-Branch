/**
 * Prospect Research Pipeline — Scraping & Normalization
 *
 * Comprehensive normalization for:
 * - LinkedIn Personal Profile (headline, job title, location)
 * - LinkedIn Company Page (company name, size, industry)
 * - Company Website (products, services)
 *
 * Created: December 5, 2025
 */

// ============================================
// COMPANY NAME NORMALIZATION
// ============================================

const COMPANY_SUFFIXES = [
  'International',
  'Technologies',
  'Corporation',
  'Consulting',
  'Solutions',
  'Holdings',
  'Services',
  'Partners',
  'Company',
  'Limited',
  'Global',
  'Agency',
  'Group',
  'Corp',
  'Tech',
  'Inc',
  'LLC',
  'LLP',
  'Ltd',
  'plc',
  'PLC',
  'Co',
  'AG',
  'SA',
  'S.A.',
  'S.L.',
  'GmbH',
  'B.V.',
  'N.V.',
  'Pty',
  'Pvt',
];

/**
 * Normalize company name by removing legal suffixes and common business descriptors
 *
 * Examples:
 * - "ACA Tech Solutions" → "ACA"
 * - "ACA Tech Solutions Ltd." → "ACA"
 * - "BrightSpark Creative Agency" → "BrightSpark Creative"
 * - "The Smith Consulting Group" → "Smith"
 * - "DataPulse Analytics Inc." → "DataPulse Analytics"
 * - "IBM" → "IBM"
 * - "Stripe" → "Stripe"
 * - "Goldman Sachs Group, Inc." → "Goldman Sachs"
 */
export function normalizeCompanyName(name: string): string {
  if (!name || name.trim() === '') return '';

  let normalized = name.trim();

  // Strip "The" from start
  normalized = normalized.replace(/^The\s+/i, '');

  // Remove content in parentheses (often parent company names)
  normalized = normalized.replace(/\([^)]*\)/g, '').trim();

  // Strip suffixes iteratively (keep going until none left)
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of COMPANY_SUFFIXES) {
      const regex = new RegExp(`[\\s,]+${suffix.replace(/\./g, '\\.')}\\.?$`, 'i');
      if (regex.test(normalized)) {
        normalized = normalized.replace(regex, '').trim();
        changed = true;
      }
    }
  }

  // Strip trailing punctuation
  normalized = normalized.replace(/[.,&]+$/, '').trim();

  // Safety: if result is too short (< 3 chars), be more conservative
  if (normalized.length < 3) {
    // Fall back to just removing legal suffixes
    normalized = name
      .replace(/^The\s+/i, '')
      .replace(/[,\s]+(Inc\.?|LLC|Ltd\.?|Corp\.?|plc)$/i, '')
      .trim();
  }

  return normalized || name;
}

/**
 * Get display name (normalized) but keep original for reference
 */
export function getCompanyDisplayName(name: string): { original: string; normalized: string } {
  return {
    original: name,
    normalized: normalizeCompanyName(name),
  };
}

// ============================================
// JOB TITLE NORMALIZATION
// ============================================

const TITLE_MAPPINGS: Record<string, string> = {
  'ceo': 'CEO',
  'cto': 'CTO',
  'cfo': 'CFO',
  'coo': 'COO',
  'cmo': 'CMO',
  'cro': 'CRO',
  'cio': 'CIO',
  'cso': 'CSO',
  'cpo': 'CPO',
  'vp': 'VP',
  'svp': 'SVP',
  'evp': 'EVP',
  'avp': 'AVP',
  'dir': 'Director',
  'sr': 'Senior',
  'jr': 'Junior',
  'mgr': 'Manager',
  'eng': 'Engineer',
  'dev': 'Developer',
  'mktg': 'Marketing',
  'biz': 'Business',
  'ops': 'Operations',
  'hr': 'HR',
  'it': 'IT',
  'ai': 'AI',
  'ml': 'ML',
  'saas': 'SaaS',
  'b2b': 'B2B',
  'b2c': 'B2C',
};

const ACRONYMS_TO_PRESERVE = [
  'CEO', 'CTO', 'CFO', 'COO', 'CMO', 'CRO', 'CIO', 'CSO', 'CPO',
  'VP', 'SVP', 'EVP', 'AVP',
  'SaaS', 'AI', 'ML', 'IT', 'HR', 'B2B', 'B2C', 'API', 'UI', 'UX',
  'SEO', 'PPC', 'CRM', 'ERP', 'GTM', 'SDR', 'BDR', 'AE', 'AM',
];

/**
 * Normalize job title by standardizing abbreviations and fixing case
 *
 * Examples:
 * - "ceo & founder" → "CEO & Founder"
 * - "sr. software eng" → "Senior Software Engineer"
 * - "VP of sales" → "VP of Sales"
 * - "dir of marketing" → "Director of Marketing"
 */
export function normalizeJobTitle(title: string): string {
  if (!title || title.trim() === '') return '';

  let normalized = title.trim();

  // Replace abbreviations with full words (before title casing)
  for (const [abbr, full] of Object.entries(TITLE_MAPPINGS)) {
    const regex = new RegExp(`\\b${abbr}\\.?\\b`, 'gi');
    normalized = normalized.replace(regex, full);
  }

  // Title case everything
  normalized = normalized
    .toLowerCase()
    .split(' ')
    .map(word => {
      // Don't capitalize small words unless they're first
      const smallWords = ['of', 'the', 'and', 'in', 'at', 'for', 'to', 'a', 'an', '&'];
      if (smallWords.includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');

  // Ensure first word is capitalized
  normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);

  // Fix acronyms that got lowercased (case-sensitive replacement)
  for (const acronym of ACRONYMS_TO_PRESERVE) {
    const regex = new RegExp(`\\b${acronym}\\b`, 'gi');
    normalized = normalized.replace(regex, acronym);
  }

  return normalized;
}

// ============================================
// HEADLINE NORMALIZATION
// ============================================

/**
 * Normalize LinkedIn headline by removing emoji spam and excessive punctuation
 *
 * Examples:
 * - "🚀 CEO & Founder | Helping B2B SaaS scale 🔥💡" → "CEO & Founder | Helping B2B SaaS scale"
 * - "Founder • Investor • Advisor • Speaker" → "Founder | Investor | Advisor | Speaker"
 */
export function normalizeHeadline(headline: string): string {
  if (!headline || headline.trim() === '') return '';

  let normalized = headline.trim();

  // Remove emoji (Unicode emoji ranges)
  normalized = normalized.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
  normalized = normalized.replace(/[\u{2600}-\u{26FF}]/gu, ''); // Misc symbols
  normalized = normalized.replace(/[\u{2700}-\u{27BF}]/gu, ''); // Dingbats

  // Replace bullet points and separators with pipe
  normalized = normalized.replace(/[•·⭐🔥💡🚀✨💪🎯📈]+/g, ' ');
  normalized = normalized.replace(/\s*[|]\s*/g, ' | ');

  // Remove multiple pipes/separators
  normalized = normalized.replace(/(\s*\|\s*)+/g, ' | ');

  // Clean up whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Remove leading/trailing pipes
  normalized = normalized.replace(/^\s*\|\s*/, '').replace(/\s*\|\s*$/, '');

  // Max length 200 chars
  if (normalized.length > 200) {
    normalized = normalized.substring(0, 197) + '...';
  }

  return normalized;
}

// ============================================
// LOCATION NORMALIZATION
// ============================================

/**
 * Normalize location by removing common suffixes
 *
 * Examples:
 * - "Greater London Area" → "London"
 * - "San Francisco Bay Area" → "San Francisco Bay"
 * - "New York Metropolitan" → "New York"
 * - "Retford, England, United Kingdom" → "Retford, England, United Kingdom" (unchanged)
 */
export function normalizeLocation(location: string): string {
  if (!location || location.trim() === '') return '';

  let normalized = location.trim();

  // Remove "Area" suffix
  normalized = normalized.replace(/\s+Area$/i, '');

  // Remove "Greater" prefix
  normalized = normalized.replace(/^Greater\s+/i, '');

  // Remove "Metropolitan"
  normalized = normalized.replace(/\s+Metropolitan$/i, '');
  normalized = normalized.replace(/\s+Metro$/i, '');

  // Clean up whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

// ============================================
// COMPANY SIZE NORMALIZATION
// ============================================

type CompanySizeBucket =
  | 'Startup (1-10)'
  | 'Small (11-50)'
  | 'Mid-Market (51-200)'
  | 'Mid-Market (201-500)'
  | 'Enterprise (501-1000)'
  | 'Enterprise (1K-5K)'
  | 'Large Enterprise (5K-10K)'
  | 'Large Enterprise (10K+)'
  | 'Unknown';

const SIZE_MAP: Record<string, CompanySizeBucket> = {
  '1-10': 'Startup (1-10)',
  '2-10': 'Startup (1-10)',
  '11-50': 'Small (11-50)',
  '51-200': 'Mid-Market (51-200)',
  '201-500': 'Mid-Market (201-500)',
  '501-1000': 'Enterprise (501-1000)',
  '1001-5000': 'Enterprise (1K-5K)',
  '5001-10000': 'Large Enterprise (5K-10K)',
  '10001+': 'Large Enterprise (10K+)',
  '10000+': 'Large Enterprise (10K+)',
};

/**
 * Normalize company size to standard buckets
 *
 * Examples:
 * - "11-50" → "Small (11-50)"
 * - "1001-5000 employees" → "Enterprise (1K-5K)"
 * - "50" → "Small (11-50)"
 */
export function normalizeCompanySize(size: string | number | null): CompanySizeBucket {
  if (!size) return 'Unknown';

  const sizeStr = String(size).toLowerCase().replace('employees', '').trim();

  // Try exact match
  if (SIZE_MAP[sizeStr]) return SIZE_MAP[sizeStr];

  // Try to extract numbers and match
  const match = sizeStr.match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num <= 10) return 'Startup (1-10)';
    if (num <= 50) return 'Small (11-50)';
    if (num <= 200) return 'Mid-Market (51-200)';
    if (num <= 500) return 'Mid-Market (201-500)';
    if (num <= 1000) return 'Enterprise (501-1000)';
    if (num <= 5000) return 'Enterprise (1K-5K)';
    if (num <= 10000) return 'Large Enterprise (5K-10K)';
    return 'Large Enterprise (10K+)';
  }

  return 'Unknown';
}

// ============================================
// INDUSTRY NORMALIZATION
// ============================================

const INDUSTRY_MAP: Record<string, string> = {
  // Tech
  'computer software': 'Software',
  'software development': 'Software',
  'information technology and services': 'IT Services',
  'information technology': 'IT Services',
  'it services and it consulting': 'IT Services',
  'internet': 'Internet/Tech',
  'technology, information and internet': 'Internet/Tech',
  'computer & network security': 'Cybersecurity',
  'computer networking': 'IT/Networking',
  'telecommunications': 'Telecommunications',

  // Services
  'marketing and advertising': 'Marketing Agency',
  'advertising services': 'Marketing Agency',
  'marketing services': 'Marketing Agency',
  'management consulting': 'Consulting',
  'business consulting and services': 'Consulting',
  'staffing and recruiting': 'Recruiting/Staffing',
  'human resources': 'HR Services',
  'human resources services': 'HR Services',
  'accounting': 'Accounting',
  'legal services': 'Legal',

  // Finance
  'financial services': 'Financial Services',
  'banking': 'Banking',
  'investment banking': 'Investment Banking',
  'investment management': 'Investment Management',
  'venture capital and private equity principals': 'VC/PE',
  'insurance': 'Insurance',

  // Other verticals
  'real estate': 'Real Estate',
  'commercial real estate': 'Real Estate',
  'manufacturing': 'Manufacturing',
  'construction': 'Construction',
  'healthcare': 'Healthcare',
  'hospitals and health care': 'Healthcare',
  'education': 'Education',
  'higher education': 'Education',
  'e-learning': 'Education',
  'retail': 'Retail',
  'e-commerce': 'E-commerce',
  'consumer goods': 'Consumer Goods',
  'food and beverage': 'Food & Beverage',
  'hospitality': 'Hospitality',
  'entertainment': 'Entertainment',
  'media production': 'Media',
  'professional training & coaching': 'Training/Coaching',
  'design': 'Design',
  'graphic design': 'Design',

  // Catch-alls
  'professional services': 'Professional Services',
  'business services': 'Business Services',
};

/**
 * Normalize industry to standard categories
 *
 * Examples:
 * - "computer software" → "Software"
 * - "marketing and advertising" → "Marketing Agency"
 * - "venture capital and private equity principals" → "VC/PE"
 */
export function normalizeIndustry(industry: string): string {
  if (!industry || industry.trim() === '') return 'Unknown';

  const lower = industry.toLowerCase().trim();
  return INDUSTRY_MAP[lower] || industry;
}

// ============================================
// COMPOSITE NORMALIZATION
// ============================================

export interface NormalizedProspect {
  // Personal
  firstName: string;
  lastName: string;
  headline: string;
  location: string;
  jobTitle: string;

  // Company
  companyName: string;
  companyDisplayName: string;
  companySize: CompanySizeBucket;
  industry: string;
}

/**
 * Normalize all prospect fields at once
 */
export function normalizeProspect(raw: {
  firstName?: string;
  lastName?: string;
  headline?: string;
  location?: string;
  jobTitle?: string;
  companyName?: string;
  companySize?: string | number;
  industry?: string;
}): NormalizedProspect {
  return {
    firstName: raw.firstName?.trim() || '',
    lastName: raw.lastName?.trim() || '',
    headline: normalizeHeadline(raw.headline || ''),
    location: normalizeLocation(raw.location || ''),
    jobTitle: normalizeJobTitle(raw.jobTitle || ''),
    companyName: raw.companyName?.trim() || '',
    companyDisplayName: normalizeCompanyName(raw.companyName || ''),
    companySize: normalizeCompanySize(raw.companySize || null),
    industry: normalizeIndustry(raw.industry || ''),
  };
}

// ============================================
// BATCH NORMALIZATION (for existing data)
// ============================================

export interface BatchNormalizationResult {
  total: number;
  processed: number;
  changes: Array<{
    id: string;
    field: string;
    before: string;
    after: string;
  }>;
}

/**
 * Generate SQL to normalize existing company names in campaign_prospects
 */
export function generateCompanyNormalizationSQL(): string {
  return `
-- Add normalized company name column if not exists
ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS company_name_normalized TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_company_normalized
ON campaign_prospects(company_name_normalized);

-- Update with normalized values
-- NOTE: Run this in batches for large tables
UPDATE campaign_prospects
SET company_name_normalized =
  LOWER(TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(company_name, '\\s*(Inc\\.?|Corp\\.?|LLC|Ltd\\.?|GmbH|S\\.A\\.|Co\\.|Company|Group|Holdings|Solutions|Technologies|International)$', '', 'i'),
        '^The\\s+', '', 'i'
      ),
      '[,.]$', ''
    )
  ))
WHERE company_name IS NOT NULL
  AND company_name != ''
  AND company_name_normalized IS NULL;
`;
}
