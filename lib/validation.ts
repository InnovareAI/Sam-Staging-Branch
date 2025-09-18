/**
 * Production-grade input validation schemas using Zod
 * Provides type-safe validation for all API endpoints
 */

import { z } from 'zod'

// UUID validation schema
const UUIDSchema = z.string().uuid('Invalid UUID format')

// Base execution preferences schema
const ExecutionPreferencesSchema = z.object({
  delay_between_prospects: z.number().min(1, 'Minimum 1 second delay').max(3600, 'Maximum 1 hour delay').optional(),
  max_daily_outreach: z.number().min(1, 'Minimum 1 prospect').max(1000, 'Maximum 1000 prospects per day').optional(),
  working_hours_start: z.number().min(0).max(23).optional(),
  working_hours_end: z.number().min(0).max(23).optional(),
  timezone: z.string().optional(),
  exclude_weekends: z.boolean().optional(),
  exclude_holidays: z.boolean().optional(),
  auto_pause_on_replies: z.boolean().optional()
}).strict().refine(data => {
  // Validate working hours logic
  if (data.working_hours_start !== undefined && data.working_hours_end !== undefined) {
    return data.working_hours_start < data.working_hours_end
  }
  return true
}, {
  message: 'Working hours start must be before end time'
})

// Notification preferences schema
const NotificationPreferencesSchema = z.object({
  email_updates: z.boolean().optional(),
  slack_notifications: z.boolean().optional(),
  webhook_url: z.string().url('Invalid webhook URL').optional(),
  real_time_alerts: z.boolean().optional(),
  daily_summary: z.boolean().optional(),
  weekly_reports: z.boolean().optional()
}).strict()

// Campaign execution POST request schema
export const CampaignExecutionRequestSchema = z.object({
  campaign_approval_session_id: UUIDSchema,
  execution_preferences: ExecutionPreferencesSchema.optional(),
  notification_preferences: NotificationPreferencesSchema.optional()
}).strict()

// Campaign execution GET request query params
export const CampaignExecutionQuerySchema = z.object({
  execution_id: UUIDSchema.optional(),
  limit: z.string().transform(val => {
    const num = parseInt(val, 10)
    return Math.min(Math.max(num, 1), 100) // Clamp between 1-100
  }).optional(),
  offset: z.string().transform(val => {
    const num = parseInt(val, 10)
    return Math.max(num, 0) // Minimum 0
  }).optional(),
  status: z.enum(['started', 'running', 'paused', 'completed', 'failed', 'cancelled']).optional()
}).strict()

// Campaign template validation
export const CampaignTemplateSchema = z.object({
  template_id: z.string().min(1, 'Template ID required'),
  prospects: z.array(z.object({
    id: UUIDSchema.optional(),
    email: z.string().email('Invalid email format'),
    first_name: z.string().min(1, 'First name required').max(100),
    last_name: z.string().min(1, 'Last name required').max(100),
    company_name: z.string().min(1, 'Company name required').max(200),
    linkedin_url: z.string().url('Invalid LinkedIn URL').optional(),
    industry: z.string().max(100).optional(),
    job_title: z.string().max(150).optional()
  })).min(1, 'At least one prospect required').max(1000, 'Maximum 1000 prospects per campaign'),
  campaign_name: z.string().min(1, 'Campaign name required').max(200),
  customizations: z.object({
    settings: ExecutionPreferencesSchema.optional(),
    message_overrides: z.record(z.string()).optional(),
    variable_overrides: z.record(z.string()).optional()
  }).optional()
}).strict()

// Prospect import validation
export const ProspectImportSchema = z.object({
  prospects: z.array(z.object({
    email: z.string().email('Invalid email format'),
    first_name: z.string().min(1).max(100),
    last_name: z.string().min(1).max(100),
    company_name: z.string().min(1).max(200),
    linkedin_url: z.string().url().optional(),
    phone: z.string().max(20).optional(),
    job_title: z.string().max(150).optional(),
    industry: z.string().max(100).optional(),
    company_size: z.string().max(50).optional(),
    location: z.string().max(200).optional()
  })).min(1).max(10000, 'Maximum 10,000 prospects per import'),
  source: z.enum(['csv_upload', 'api_import', 'manual_entry', 'apollo_scraper', 'sales_navigator']),
  campaign_id: UUIDSchema.optional(),
  deduplicate: z.boolean().default(true),
  validate_emails: z.boolean().default(true)
}).strict()

// N8N workflow configuration validation
export const N8nWorkflowConfigSchema = z.object({
  workflow_name: z.string().min(1).max(200),
  channel_preferences: z.object({
    email_enabled: z.boolean(),
    linkedin_enabled: z.boolean(),
    whatsapp_enabled: z.boolean().optional(),
    telegram_enabled: z.boolean().optional()
  }).refine(channels => 
    channels.email_enabled || channels.linkedin_enabled, 
    'At least one channel must be enabled'
  ),
  email_config: z.object({
    smtp_provider: z.enum(['gmail', 'outlook', 'sendgrid', 'mailgun', 'reachinbox']),
    from_name: z.string().min(1).max(100),
    from_email: z.string().email(),
    reply_to: z.string().email().optional(),
    daily_limit: z.number().min(1).max(1000)
  }).optional(),
  linkedin_config: z.object({
    account_id: z.string().min(1),
    daily_limit: z.number().min(1).max(100),
    use_sales_navigator: z.boolean().optional(),
    connection_message_limit: z.number().min(1).max(300).optional()
  }).optional(),
  reply_handling_config: z.object({
    auto_reply_enabled: z.boolean(),
    human_approval_required: z.boolean(),
    reply_detection_keywords: z.array(z.string()).optional(),
    escalation_email: z.string().email().optional()
  }).optional()
}).strict()

// Rate limiting validation
export const RateLimitSchema = z.object({
  key: z.string().min(1),
  limit: z.number().min(1).max(10000),
  window: z.number().min(60).max(86400), // 1 minute to 1 day
  identifier: z.string().optional()
}).strict()

// Webhook payload validation
export const WebhookPayloadSchema = z.object({
  event_type: z.enum(['campaign_started', 'campaign_completed', 'campaign_failed', 'prospect_contacted', 'reply_received']),
  campaign_execution_id: UUIDSchema,
  workspace_id: UUIDSchema,
  timestamp: z.string().datetime(),
  data: z.record(z.any()).optional()
}).strict()

/**
 * Generic validation wrapper with error formatting
 */
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  } else {
    return { success: false, errors: result.error }
  }
}

/**
 * Format Zod errors for API responses
 */
export function formatValidationError(error: z.ZodError): { field: string; message: string }[] {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message
  }))
}

/**
 * Sanitize string inputs to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>\"']/g, '') // Remove potentially dangerous characters
    .trim()
    .substring(0, 10000) // Limit length
}

/**
 * Validate environment variables at startup
 */
export const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  N8N_API_KEY: z.string().min(1),
  N8N_INSTANCE_URL: z.string().url(),
  NEXT_PUBLIC_BASE_URL: z.string().url().optional()
}).strict()

// Type exports for use in API routes
export type CampaignExecutionRequest = z.infer<typeof CampaignExecutionRequestSchema>
export type CampaignExecutionQuery = z.infer<typeof CampaignExecutionQuerySchema>
export type CampaignTemplate = z.infer<typeof CampaignTemplateSchema>
export type ProspectImport = z.infer<typeof ProspectImportSchema>
export type N8nWorkflowConfig = z.infer<typeof N8nWorkflowConfigSchema>
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>