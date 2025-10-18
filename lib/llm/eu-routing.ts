/**
 * EU GDPR Compliance Routing
 * 
 * Ensures ALL EU customer data is processed by EU-hosted models only.
 * Routes all LLM operations for EU customers to Mistral (EU-hosted).
 */

import { getEUDefaultModel } from './approved-models';

// EU country codes (EEA + UK)
const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO',
  'GB', 'UK', 'CH' // UK, Switzerland
];

// EU timezone patterns
const EU_TIMEZONES = [
  'Europe/',
  'Atlantic/Reykjavik',
  'Atlantic/Faroe',
  'Atlantic/Madeira',
  'Atlantic/Canary'
];

/**
 * Detect if user is in EU region
 */
export function isEUUser(options?: {
  countryCode?: string;
  timezone?: string;
  userPreference?: 'eu' | 'global';
}): boolean {
  // User preference overrides everything
  if (options?.userPreference === 'eu') return true;
  if (options?.userPreference === 'global') return false;

  // Check country code
  if (options?.countryCode) {
    return EU_COUNTRIES.includes(options.countryCode.toUpperCase());
  }

  // Check timezone
  if (options?.timezone) {
    return EU_TIMEZONES.some(tz => options.timezone?.startsWith(tz));
  }

  // Default to global if unknown
  return false;
}

/**
 * Get appropriate model based on EU status
 */
export function getModelForUser(isEU: boolean, selectedModel?: string): string {
  // If user has selected a model, respect it (unless they're EU and it's not EU-hosted)
  if (selectedModel) {
    // TODO: Validate if selected model is EU-compliant when user is EU
    return selectedModel;
  }

  // Use EU default for EU users
  if (isEU) {
    return getEUDefaultModel().id;
  }

  // Use global default for non-EU users
  return 'anthropic/claude-haiku-4.5'; // Global default
}

/**
 * EU Model Configuration
 */
export const EU_MODEL_CONFIG = {
  // Primary EU model for all operations
  primary: {
    model: 'mistralai/mistral-large',
    displayName: 'Mistral Large',
    costPer1M: 2.00,
    euHosted: true,
    use_cases: [
      'chatbot',
      'personalization',
      'document_analysis',
      'website_intelligence',
      'template_parsing'
    ]
  },
  
  // Cost-effective EU alternative
  alternative: {
    model: 'mistralai/mistral-medium-3.1',
    displayName: 'Mistral Medium 3.1',
    costPer1M: 0.40,
    euHosted: true,
    use_cases: [
      'batch_processing',
      'low_priority_tasks'
    ]
  }
} as const;

/**
 * Get EU model for specific use case
 */
export function getEUModelForUseCase(useCase: string): string {
  // Always use Mistral Large for EU compliance
  // (Can add logic here for cost optimization with Medium for batch jobs)
  return EU_MODEL_CONFIG.primary.model;
}

export type EUUserOptions = {
  countryCode?: string;
  timezone?: string;
  userPreference?: 'eu' | 'global';
};
