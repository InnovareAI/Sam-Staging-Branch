/**
 * Spintax Parser for Message Variation
 *
 * Spintax allows creating multiple message variations from a single template.
 * Syntax: {option1|option2|option3}
 *
 * Example:
 * "{Hi|Hello|Hey} {first_name}, {I noticed|I came across|I saw} your profile..."
 *
 * This creates 3 x 3 = 9 possible message variations, making each message
 * unique and harder for LinkedIn to detect as automated.
 *
 * Advanced features:
 * - Nested spintax: {outer {inner1|inner2} text|other option}
 * - Weighted options: {option1:3|option2:1} (option1 appears 3x more often)
 * - Empty options: {text|} (50% chance of no text)
 * - Escape braces: \{not spintax\}
 */

export interface SpintaxOptions {
  // Use a seed for deterministic output (same seed = same result)
  seed?: string;
  // Preserve original for debugging
  preserveOriginal?: boolean;
  // Max iterations to prevent infinite loops in malformed spintax
  maxIterations?: number;
}

export interface SpintaxResult {
  output: string;
  original: string;
  variationsCount: number;
  optionsSelected: string[];
}

/**
 * Parse and spin a spintax string
 * Returns a randomly selected combination
 */
export function spinText(text: string, options: SpintaxOptions = {}): SpintaxResult {
  const original = text;
  const optionsSelected: string[] = [];
  const maxIterations = options.maxIterations || 100;

  // Initialize random with seed if provided
  const random = options.seed ? seededRandom(options.seed) : Math.random;

  let result = text;
  let iterations = 0;

  // Keep processing until no more spintax blocks
  // CRITICAL FIX (Dec 15, 2025): Regex MUST require | to distinguish spintax from personalization vars
  // - Spintax: {option1|option2|option3} - has | separator
  // - Personalization: {company_name}, {first_name} - NO | separator
  // Without this fix, {company_name} gets processed as single-option spintax and loses its braces!
  const spintaxRegex = /\{([^{}]*\|[^{}]*)\}/g;

  while (spintaxRegex.test(result) && iterations < maxIterations) {
    result = result.replace(spintaxRegex, (match, content) => {
      // Split by | to get options
      const choices = parseSpintaxOptions(content);

      // Select random option (with weights if specified)
      const selected = selectWeightedOption(choices, random);
      optionsSelected.push(selected);

      return selected;
    });

    iterations++;
    spintaxRegex.lastIndex = 0; // Reset regex
  }

  // Count possible variations
  const variationsCount = countVariations(original);

  return {
    output: result.trim(),
    original,
    variationsCount,
    optionsSelected,
  };
}

/**
 * Parse spintax options, handling weights
 * Format: "option1|option2:3|option3" -> option2 has weight 3
 */
function parseSpintaxOptions(content: string): { text: string; weight: number }[] {
  return content.split('|').map(option => {
    // Check for weight syntax: "text:weight"
    const weightMatch = option.match(/^(.+):(\d+)$/);
    if (weightMatch) {
      return {
        text: weightMatch[1].trim(),
        weight: parseInt(weightMatch[2], 10),
      };
    }
    return {
      text: option.trim(),
      weight: 1,
    };
  });
}

/**
 * Select an option based on weights
 */
function selectWeightedOption(
  options: { text: string; weight: number }[],
  random: () => number
): string {
  const totalWeight = options.reduce((sum, opt) => sum + opt.weight, 0);
  let randomValue = random() * totalWeight;

  for (const option of options) {
    randomValue -= option.weight;
    if (randomValue <= 0) {
      return option.text;
    }
  }

  return options[options.length - 1].text;
}

/**
 * Count total possible variations in a spintax string
 */
export function countVariations(text: string): number {
  let count = 1;
  // CRITICAL FIX (Dec 15, 2025): Only count blocks with | as spintax
  // Blocks without | are personalization variables, not spintax options
  const regex = /\{([^{}]*\|[^{}]*)\}/g;
  let match;

  // Process innermost blocks first
  let processed = text;
  let iterations = 0;
  const maxIterations = 100;

  while ((match = regex.exec(processed)) !== null && iterations < maxIterations) {
    const options = match[1].split('|').length;
    count *= options;
    iterations++;
  }

  return count;
}

/**
 * Validate spintax syntax
 * Returns errors if malformed
 */
export function validateSpintax(text: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for unbalanced braces
  let braceCount = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{' && text[i - 1] !== '\\') braceCount++;
    if (text[i] === '}' && text[i - 1] !== '\\') braceCount--;

    if (braceCount < 0) {
      errors.push(`Unexpected closing brace at position ${i}`);
      braceCount = 0; // Reset to continue checking
    }
  }

  if (braceCount > 0) {
    errors.push(`${braceCount} unclosed brace(s)`);
  }

  // Check for empty blocks
  if (/\{\s*\}/.test(text)) {
    errors.push('Empty spintax block found');
  }

  // Check for blocks with only separators
  if (/\{\|+\}/.test(text)) {
    errors.push('Spintax block with only separators found');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate multiple unique spins from a template
 * Useful for previewing variations
 */
export function generatePreviews(text: string, count: number = 5): string[] {
  const previews: Set<string> = new Set();
  const maxAttempts = count * 10;
  let attempts = 0;

  while (previews.size < count && attempts < maxAttempts) {
    const result = spinText(text);
    previews.add(result.output);
    attempts++;
  }

  return Array.from(previews);
}

/**
 * Seeded random number generator for deterministic output
 * Same seed always produces same sequence
 */
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  // Simple LCG (Linear Congruential Generator)
  return () => {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return hash / 0x7fffffff;
  };
}

/**
 * Get a consistent spin for a specific prospect
 * Uses prospect ID as seed so they always get same message variation
 */
export function spinForProspect(text: string, prospectId: string): SpintaxResult {
  return spinText(text, { seed: prospectId });
}

// ============================================
// SPINTAX TEMPLATES
// Pre-built templates with variations
// ============================================

export const SPINTAX_TEMPLATES = {
  // Greetings
  greeting: '{Hi|Hello|Hey}',
  greeting_name: '{Hi|Hello|Hey} {first_name}',
  greeting_formal: '{Hello|Hi|Good morning|Good afternoon} {first_name}',

  // Opening lines
  opening_noticed: '{I noticed|I came across|I saw} your profile',
  opening_impressed: "{I was {impressed by|intrigued by|interested in} your work|Your background in {industry} caught my attention}",
  opening_connection: "{We're both connected to|I see we share connections with|Looks like we have mutual connections}",

  // Reason for reaching out
  reason_network: "{I'd love to connect|I wanted to reach out|I thought it would be great to connect}",
  reason_value: "{I think {we could learn from each other|there might be synergies|we could help each other}}",

  // Call to action
  cta_soft: "{Would you be open to connecting|I'd love to connect if you're interested|Let me know if you'd like to connect}?",
  cta_direct: "{Let's connect|I'd appreciate the connection|Looking forward to connecting}!",
  cta_question: "{Are you currently focusing on|Is your team working on|What's your take on} {topic}?",

  // Closings
  closing_simple: '{Best|Cheers|Thanks}',
  closing_warm: '{Looking forward to hearing from you|Hope to connect soon|Talk soon}',
};

/**
 * Build a full message template with spintax
 */
export function buildSpintaxTemplate(parts: {
  greeting?: string;
  opening?: string;
  body: string;
  cta?: string;
  closing?: string;
}): string {
  const lines: string[] = [];

  if (parts.greeting) {
    lines.push(parts.greeting + ',');
  }

  if (parts.opening) {
    lines.push('');
    lines.push(parts.opening);
  }

  lines.push('');
  lines.push(parts.body);

  if (parts.cta) {
    lines.push('');
    lines.push(parts.cta);
  }

  if (parts.closing) {
    lines.push('');
    lines.push(parts.closing);
  }

  return lines.join('\n');
}

// ============================================
// MESSAGE PERSONALIZATION WITH SPINTAX
// Combines spintax with variable replacement
// ============================================

export interface PersonalizationData {
  first_name?: string;
  last_name?: string;
  company_name?: string;
  title?: string;
  industry?: string;
  location?: string;
  mutual_connections?: string;
  topic?: string;
  [key: string]: string | undefined;
}

/**
 * Replace personalization variables in message
 * Supports multiple formats: {var}, {{var}}, {firstName}
 */
export function personalizeMessage(
  message: string,
  data: PersonalizationData
): string {
  let result = message;

  // Replace all variable formats
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    // {key} format
    result = result.replace(new RegExp(`\\{${key}\\}`, 'gi'), value);

    // {{key}} format
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), value);

    // camelCase format (first_name -> firstName)
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result = result.replace(new RegExp(`\\{${camelKey}\\}`, 'gi'), value);
  }

  return result;
}

/**
 * Full message processing: spintax + personalization
 * Order matters: spin first, then personalize
 */
export function processMessage(
  template: string,
  prospectId: string,
  personalization: PersonalizationData
): SpintaxResult & { personalized: string } {
  // 1. Spin the spintax (deterministic per prospect)
  const spinResult = spinForProspect(template, prospectId);

  // 2. Personalize the spun message
  const personalized = personalizeMessage(spinResult.output, personalization);

  return {
    ...spinResult,
    personalized,
  };
}

/**
 * Example usage:
 *
 * const template = `{Hi|Hello} {first_name},
 *
 * {I noticed|I came across} your profile and {was impressed by|was intrigued by} your work at {company_name}.
 *
 * {I'd love to connect|Would you be open to connecting}?
 *
 * {Best|Cheers},
 * John`;
 *
 * const result = processMessage(template, 'prospect-123', {
 *   first_name: 'Sarah',
 *   company_name: 'Acme Corp',
 * });
 *
 * // result.personalized might be:
 * // "Hello Sarah,
 * //
 * // I came across your profile and was impressed by your work at Acme Corp.
 * //
 * // Would you be open to connecting?
 * //
 * // Cheers,
 * // John"
 *
 * // Same prospect always gets same spin (deterministic)
 * // Different prospects get different spins (random per prospect)
 */
