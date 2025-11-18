/**
 * N8N Field Mapping Utilities
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

/**
 * Maps a database prospect to N8N-compatible format
 * Sends BOTH camelCase AND snake_case versions of all fields
 *
 * @param {Object} prospect - Database prospect object
 * @param {Object} options - Additional options
 * @param {string} options.campaignId - Campaign ID
 * @param {number} options.sendDelayMinutes - Delay in minutes before sending
 * @returns {Object} N8N-compatible prospect object
 *
 * @example
 * const prospect = {
 *   id: '123',
 *   first_name: 'John',
 *   last_name: 'Doe',
 *   company_name: 'Acme Inc',
 *   linkedin_url: 'https://linkedin.com/in/johndoe',
 *   linkedin_user_id: 'abc123'
 * };
 *
 * const n8nProspect = buildN8NProspect(prospect, {
 *   campaignId: 'campaign-123',
 *   sendDelayMinutes: 5
 * });
 */
export function buildN8NProspect(prospect, options = {}) {
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
    first_name: prospect.first_name,  // N8N expects snake_case
    lastName: prospect.last_name,
    last_name: prospect.last_name,  // N8N expects snake_case

    // Company fields (BOTH camelCase AND snake_case)
    companyName: prospect.company_name,
    company_name: prospect.company_name,  // N8N expects snake_case
    title: prospect.title,

    // LinkedIn fields (BOTH camelCase AND snake_case)
    linkedinUrl: prospect.linkedin_url,
    linkedin_url: prospect.linkedin_url,  // N8N expects snake_case
    linkedinUsername: linkedinUsername,
    linkedin_username: linkedinUsername,  // N8N expects snake_case
    linkedinUserId: prospect.linkedin_user_id,
    linkedin_user_id: prospect.linkedin_user_id,  // N8N expects snake_case

    // Email (if present)
    email: prospect.email,

    // Timing (BOTH camelCase AND snake_case)
    sendDelayMinutes: sendDelayMinutes,
    send_delay_minutes: sendDelayMinutes  // N8N expects snake_case
  };
}

/**
 * Maps database message templates to N8N-compatible format
 * Sends BOTH camelCase AND snake_case versions of all fields
 * Includes all 6 message types (connection request + 5 follow-ups)
 *
 * @param {Object} templates - Database message_templates object
 * @returns {Object} N8N-compatible messages object
 *
 * @example
 * const templates = {
 *   connection_request: "Hi {first_name}...",
 *   follow_up_messages: [
 *     "Following up...",
 *     "Still interested?",
 *     "Last chance...",
 *     "Final follow-up...",
 *     "Thanks anyway..."
 *   ],
 *   alternative_message: "Thanks for connecting..."
 * };
 *
 * const n8nMessages = buildN8NMessages(templates);
 */
export function buildN8NMessages(templates) {
  if (!templates || !templates.connection_request) {
    throw new Error('CRITICAL: Missing connection_request in message templates. Campaign cannot execute without messages.');
  }

  return {
    // Connection request (3 variants for maximum compatibility)
    connectionRequest: templates.connection_request,
    connection_request: templates.connection_request,  // N8N expects snake_case
    cr: templates.connection_request,  // N8N also checks this field

    // Follow-up messages (N8N expects snake_case)
    follow_up_1: templates.follow_up_messages?.[0] || '',
    follow_up_2: templates.follow_up_messages?.[1] || '',
    follow_up_3: templates.follow_up_messages?.[2] || '',
    follow_up_4: templates.follow_up_messages?.[3] || '',
    goodbye_message: templates.follow_up_messages?.[4] || '',

    // Alternative/acceptance message (sent after connection is accepted)
    alternative_message: templates.alternative_message || templates.follow_up_messages?.[0] || ''
  };
}

/**
 * Validates that a prospect has all required fields for N8N execution
 *
 * @param {Object} prospect - Database prospect object
 * @throws {Error} If required fields are missing
 */
export function validateProspect(prospect) {
  const required = ['id', 'first_name', 'last_name', 'linkedin_url'];
  const missing = required.filter(field => !prospect[field]);

  if (missing.length > 0) {
    throw new Error(`CRITICAL: Prospect ${prospect.id || 'unknown'} missing required fields: ${missing.join(', ')}`);
  }

  // Warn if optional but important fields are missing
  if (!prospect.company_name) {
    console.warn(`⚠️  Prospect ${prospect.id} missing company_name - message placeholder {company_name} will be empty`);
  }

  if (!prospect.linkedin_user_id) {
    console.warn(`⚠️  Prospect ${prospect.id} missing linkedin_user_id - may cause Unipile API issues`);
  }
}

/**
 * Validates that message templates have all required fields for N8N execution
 *
 * @param {Object} templates - Database message_templates object
 * @throws {Error} If required fields are missing
 */
export function validateMessageTemplates(templates) {
  if (!templates) {
    throw new Error('CRITICAL: message_templates is null/undefined. Cannot execute campaign without messages.');
  }

  if (!templates.connection_request) {
    throw new Error('CRITICAL: Missing connection_request in message templates. This will cause blank LinkedIn messages.');
  }

  if (!templates.follow_up_messages || !Array.isArray(templates.follow_up_messages)) {
    console.warn('⚠️  Missing or invalid follow_up_messages array - follow-ups will not be sent');
  }

  const expectedFollowUps = 5;
  const actualFollowUps = templates.follow_up_messages?.length || 0;
  if (actualFollowUps < expectedFollowUps) {
    console.warn(`⚠️  Only ${actualFollowUps}/${expectedFollowUps} follow-up messages defined - some follow-ups will be empty`);
  }
}

/**
 * Builds complete N8N webhook payload with all required fields
 *
 * @param {Object} campaign - Campaign configuration
 * @param {Array} prospects - Array of database prospect objects
 * @param {Object} templates - Database message_templates object
 * @param {Object} options - Additional options
 * @returns {Object} Complete N8N webhook payload
 *
 * @example
 * const payload = buildN8NPayload(
 *   {
 *     id: 'campaign-123',
 *     workspace_id: 'workspace-456',
 *     unipile_account_id: 'unipile-789'
 *   },
 *   prospects,
 *   messageTemplates,
 *   {
 *     channel: 'linkedin',
 *     campaignType: 'connector',
 *     calculateDelay: (index) => index * 5
 *   }
 * );
 */
export function buildN8NPayload(campaign, prospects, templates, options = {}) {
  const {
    channel = 'linkedin',
    campaignType = 'connector',
    calculateDelay = () => 0,
    accountTracking = {},
    scheduleSettings = {},
    timing = {}
  } = options;

  // Validate inputs
  validateMessageTemplates(templates);
  prospects.forEach(validateProspect);

  // Build prospect objects
  const n8nProspects = prospects.map((prospect, index) =>
    buildN8NProspect(prospect, {
      campaignId: campaign.id,
      sendDelayMinutes: calculateDelay(index, prospects.length)
    })
  );

  // Build messages object
  const n8nMessages = buildN8NMessages(templates);

  return {
    workspaceId: campaign.workspace_id,
    campaignId: campaign.id,
    channel: channel,
    campaignType: campaignType,
    unipileAccountId: campaign.unipile_account_id,

    accountTracking: {
      dailyMessageLimit: 20,
      messagesSentToday: 0,
      lastMessageDate: new Date().toISOString(),
      remainingToday: 20,
      ...accountTracking
    },

    scheduleSettings: {
      timezone: 'America/Los_Angeles',
      workingHoursStart: 5,
      workingHoursEnd: 18,
      skipWeekends: false,
      skipHolidays: false,
      ...scheduleSettings
    },

    prospects: n8nProspects,
    messages: n8nMessages,

    timing: {
      fu1DelayDays: 2,
      fu2DelayDays: 5,
      fu3DelayDays: 7,
      fu4DelayDays: 5,
      gbDelayDays: 7,
      ...timing
    },

    // Environment credentials (N8N expects BOTH camelCase AND snake_case)
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    unipileDsn: process.env.UNIPILE_DSN,
    unipile_dsn: process.env.UNIPILE_DSN,
    unipileApiKey: process.env.UNIPILE_API_KEY,
    unipile_api_key: process.env.UNIPILE_API_KEY
  };
}

/**
 * EXAMPLE USAGE IN CAMPAIGN SCRIPTS:
 *
 * ```javascript
 * import { buildN8NPayload } from './lib/n8n-field-mapper.mjs';
 *
 * // Fetch campaign data
 * const { data: campaign } = await supabase
 *   .from('campaigns')
 *   .select('id, workspace_id, unipile_account_id, message_templates')
 *   .eq('id', CAMPAIGN_ID)
 *   .single();
 *
 * // Fetch prospects
 * const { data: prospects } = await supabase
 *   .from('campaign_prospects')
 *   .select('*')
 *   .eq('campaign_id', CAMPAIGN_ID)
 *   .eq('status', 'pending');
 *
 * // Build payload (automatically handles all field mapping)
 * const payload = buildN8NPayload(
 *   campaign,
 *   prospects,
 *   campaign.message_templates,
 *   {
 *     calculateDelay: (index, total) => {
 *       // Your delay calculation logic
 *       return index * 5; // 5 minutes between each
 *     }
 *   }
 * );
 *
 * // Send to N8N
 * const response = await fetch('https://workflows.innovareai.com/webhook/connector-campaign', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify(payload)
 * });
 * ```
 */
