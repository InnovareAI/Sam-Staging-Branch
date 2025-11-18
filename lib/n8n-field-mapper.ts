/**
 * N8N Field Mapping Utilities (TypeScript version for API routes)
 *
 * CRITICAL: N8N workflows expect snake_case field names
 * JavaScript/API conventions use camelCase
 *
 * This library ensures BOTH naming conventions are always sent
 * to prevent blank messages, "undefined" placeholders, and missing data.
 *
 * @see /Users/tvonlinz/Desktop/N8N_MESSAGE_BUGS_COMPLETE_FIX.md
 * @see /Users/tvonlinz/Desktop/N8N_AUDIT_FIXES_APPLIED.md
 */

export interface DatabaseProspect {
  id: string;
  first_name: string;
  last_name: string;
  company_name?: string;
  title?: string;
  linkedin_url: string;
  linkedin_user_id?: string;
  email?: string;
}

export interface N8NProspect {
  id: string;
  prospectId: string;
  campaignId: string;
  firstName: string;
  first_name: string;
  lastName: string;
  last_name: string;
  companyName?: string;
  company_name?: string;
  title?: string;
  linkedinUrl: string;
  linkedin_url: string;
  linkedinUsername: string | null;
  linkedin_username: string | null;
  linkedinUserId?: string;
  linkedin_user_id?: string;
  email?: string;
  sendDelayMinutes: number;
  send_delay_minutes: number;
}

export interface MessageTemplates {
  connection_request: string;
  follow_up_messages?: string[];
  alternative_message?: string;
}

export interface N8NMessages {
  connectionRequest: string;
  connection_request: string;
  cr: string;
  follow_up_1: string;
  follow_up_2: string;
  follow_up_3: string;
  follow_up_4: string;
  goodbye_message: string;
  alternative_message: string;
}

/**
 * Maps a database prospect to N8N-compatible format
 * Sends BOTH camelCase AND snake_case versions of all fields
 */
export function buildN8NProspect(
  prospect: DatabaseProspect,
  options: {
    campaignId: string;
    sendDelayMinutes?: number;
  }
): N8NProspect {
  const { campaignId, sendDelayMinutes = 0 } = options;

  // Extract LinkedIn username from URL
  const linkedinUsername = prospect.linkedin_url
    ? prospect.linkedin_url.split('/in/')[1]?.replace(/\/$/, '')
    : null;

  return {
    // IDs (no case conversion needed)
    id: prospect.id,
    prospectId: prospect.id,
    campaignId: campaignId,

    // Name fields (BOTH camelCase AND snake_case)
    firstName: prospect.first_name,
    first_name: prospect.first_name,
    lastName: prospect.last_name,
    last_name: prospect.last_name,

    // Company fields (BOTH camelCase AND snake_case)
    companyName: prospect.company_name,
    company_name: prospect.company_name,
    title: prospect.title,

    // LinkedIn fields (BOTH camelCase AND snake_case)
    linkedinUrl: prospect.linkedin_url,
    linkedin_url: prospect.linkedin_url,
    linkedinUsername: linkedinUsername,
    linkedin_username: linkedinUsername,
    linkedinUserId: prospect.linkedin_user_id,
    linkedin_user_id: prospect.linkedin_user_id,

    // Email (if present)
    email: prospect.email,

    // Timing (BOTH camelCase AND snake_case)
    sendDelayMinutes: sendDelayMinutes,
    send_delay_minutes: sendDelayMinutes
  };
}

/**
 * Maps database message templates to N8N-compatible format
 * Sends BOTH camelCase AND snake_case versions of all fields
 * Includes all 6 message types (connection request + 5 follow-ups)
 */
export function buildN8NMessages(templates: MessageTemplates): N8NMessages {
  if (!templates || !templates.connection_request) {
    throw new Error(
      'CRITICAL: Missing connection_request in message templates. Campaign cannot execute without messages.'
    );
  }

  return {
    // Connection request (3 variants for maximum compatibility)
    connectionRequest: templates.connection_request,
    connection_request: templates.connection_request,
    cr: templates.connection_request,

    // Follow-up messages (N8N expects snake_case)
    follow_up_1: templates.follow_up_messages?.[0] || '',
    follow_up_2: templates.follow_up_messages?.[1] || '',
    follow_up_3: templates.follow_up_messages?.[2] || '',
    follow_up_4: templates.follow_up_messages?.[3] || '',
    goodbye_message: templates.follow_up_messages?.[4] || '',

    // Alternative/acceptance message (sent after connection is accepted)
    alternative_message:
      templates.alternative_message || templates.follow_up_messages?.[0] || ''
  };
}

/**
 * Validates that a prospect has all required fields for N8N execution
 * Throws error if required fields are missing
 */
export function validateProspect(prospect: DatabaseProspect): void {
  const required: (keyof DatabaseProspect)[] = [
    'id',
    'first_name',
    'last_name',
    'linkedin_url'
  ];

  const missing = required.filter((field) => !prospect[field]);

  if (missing.length > 0) {
    throw new Error(
      `CRITICAL: Prospect ${prospect.id || 'unknown'} missing required fields: ${missing.join(', ')}`
    );
  }

  // Warn if optional but important fields are missing
  if (!prospect.company_name) {
    console.warn(
      `⚠️  Prospect ${prospect.id} missing company_name - message placeholder {company_name} will be empty`
    );
  }

  if (!prospect.linkedin_user_id) {
    console.warn(
      `⚠️  Prospect ${prospect.id} missing linkedin_user_id - may cause Unipile API issues`
    );
  }
}

/**
 * Validates that message templates have all required fields for N8N execution
 * Throws error if required fields are missing
 */
export function validateMessageTemplates(templates: MessageTemplates | null | undefined): void {
  if (!templates) {
    throw new Error(
      'CRITICAL: message_templates is null/undefined. Cannot execute campaign without messages.'
    );
  }

  if (!templates.connection_request) {
    throw new Error(
      'CRITICAL: Missing connection_request in message templates. This will cause blank LinkedIn messages.'
    );
  }

  if (!templates.follow_up_messages || !Array.isArray(templates.follow_up_messages)) {
    console.warn(
      '⚠️  Missing or invalid follow_up_messages array - follow-ups will not be sent'
    );
  }

  const expectedFollowUps = 5;
  const actualFollowUps = templates.follow_up_messages?.length || 0;
  if (actualFollowUps < expectedFollowUps) {
    console.warn(
      `⚠️  Only ${actualFollowUps}/${expectedFollowUps} follow-up messages defined - some follow-ups will be empty`
    );
  }
}

/**
 * EXAMPLE USAGE IN API ROUTES:
 *
 * ```typescript
 * import { buildN8NProspect, buildN8NMessages, validateProspect, validateMessageTemplates } from '@/lib/n8n-field-mapper';
 *
 * // Fetch campaign data
 * const { data: campaign } = await supabase
 *   .from('campaigns')
 *   .select('id, message_templates')
 *   .eq('id', campaignId)
 *   .single();
 *
 * // Validate templates
 * validateMessageTemplates(campaign.message_templates);
 *
 * // Build messages
 * const messages = buildN8NMessages(campaign.message_templates);
 *
 * // Build prospects
 * const n8nProspects = prospects.map((p, index) => {
 *   validateProspect(p);
 *   return buildN8NProspect(p, {
 *     campaignId: campaign.id,
 *     sendDelayMinutes: calculateDelay(index)
 *   });
 * });
 *
 * // Build payload
 * const payload = {
 *   workspaceId: campaign.workspace_id,
 *   campaignId: campaign.id,
 *   prospects: n8nProspects,
 *   messages: messages,
 *   // ... other fields
 * };
 * ```
 */
