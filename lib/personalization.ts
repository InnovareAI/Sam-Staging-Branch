/**
 * Universal message personalization - handles ALL variable formats
 * Used by: CR campaigns, follow-ups, emails, Charissa campaigns
 *
 * Supports:
 * - {snake_case}: {first_name}, {company_name}, {title}
 * - {{snake_case}}: {{first_name}}, {{company_name}}
 * - {camelCase}: {firstName}, {companyName}
 * - {{camelCase}}: {{firstName}}, {{company}} (Charissa format)
 */

export interface PersonalizationData {
  first_name?: string;
  last_name?: string;
  company_name?: string;
  company?: string;
  title?: string;
  job_title?: string;
  email?: string;
  location?: string;
  industry?: string;
}

export function personalizeMessage(
  template: string,
  data: PersonalizationData
): string {
  const firstName = data.first_name || '';
  const lastName = data.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const companyName = data.company_name || data.company || '';
  const title = data.title || data.job_title || '';
  const email = data.email || '';
  const location = data.location || '';
  const industry = data.industry || '';

  return template
    // === FIRST NAME ===
    .replace(/\{first_name\}/gi, firstName)
    .replace(/\{\{first_name\}\}/gi, firstName)
    .replace(/\{firstName\}/g, firstName)
    .replace(/\{\{firstName\}\}/g, firstName)

    // === LAST NAME ===
    .replace(/\{last_name\}/gi, lastName)
    .replace(/\{\{last_name\}\}/gi, lastName)
    .replace(/\{lastName\}/g, lastName)
    .replace(/\{\{lastName\}\}/g, lastName)

    // === FULL NAME ===
    .replace(/\{full_name\}/gi, fullName)
    .replace(/\{\{full_name\}\}/gi, fullName)
    .replace(/\{fullName\}/g, fullName)
    .replace(/\{\{fullName\}\}/g, fullName)
    .replace(/\{name\}/gi, fullName)
    .replace(/\{\{name\}\}/gi, fullName)

    // === COMPANY ===
    .replace(/\{company_name\}/gi, companyName)
    .replace(/\{\{company_name\}\}/gi, companyName)
    .replace(/\{companyName\}/g, companyName)
    .replace(/\{\{companyName\}\}/g, companyName)
    .replace(/\{company\}/gi, companyName)
    .replace(/\{\{company\}\}/gi, companyName)

    // === TITLE ===
    .replace(/\{title\}/gi, title)
    .replace(/\{\{title\}\}/gi, title)
    .replace(/\{job_title\}/gi, title)
    .replace(/\{\{job_title\}\}/gi, title)
    .replace(/\{jobTitle\}/g, title)
    .replace(/\{\{jobTitle\}\}/g, title)
    .replace(/\{role\}/gi, title)
    .replace(/\{\{role\}\}/gi, title)

    // === EMAIL ===
    .replace(/\{email\}/gi, email)
    .replace(/\{\{email\}\}/gi, email)

    // === LOCATION ===
    .replace(/\{location\}/gi, location)
    .replace(/\{\{location\}\}/gi, location)

    // === INDUSTRY ===
    .replace(/\{industry\}/gi, industry)
    .replace(/\{\{industry\}\}/gi, industry);
}

/**
 * Check if a message still has unreplaced variables
 */
export function hasUnreplacedVariables(message: string): boolean {
  return /\{[^}]+\}/.test(message);
}

/**
 * Extract unreplaced variable names from a message
 */
export function getUnreplacedVariables(message: string): string[] {
  const matches = message.match(/\{+[^}]+\}+/g) || [];
  return [...new Set(matches)];
}
