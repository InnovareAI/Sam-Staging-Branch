-- PERFECT PRODUCTION SCHEMA
-- Generated from OpenAPI Spec

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$ SELECT id FROM public.users LIMIT 1; $$ LANGUAGE sql;
CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$ SELECT 'authenticated'; $$ LANGUAGE sql;

CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY,
  name TEXT,
  slug TEXT,
  owner_id UUID,
  organization_id UUID,
  settings TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  billing_starts_at TIMESTAMPTZ,
  tenant TEXT,
  company_url TEXT,
  detected_industry TEXT,
  company_description TEXT,
  target_personas JSONB,
  pain_points JSONB,
  value_proposition TEXT,
  key_competitors JSONB,
  pricing_model TEXT,
  website_analysis_status TEXT,
  website_analyzed_at TIMESTAMPTZ,
  manual_overrides TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT,
  subscription_cancelled_at TIMESTAMPTZ,
  subscription_cancel_at TIMESTAMPTZ,
  is_active BOOLEAN,
  client_code TEXT,
  reseller_affiliation TEXT,
  commenting_agent_enabled BOOLEAN
);

CREATE TABLE IF NOT EXISTS public.workspace_accounts (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  user_id UUID,
  account_type TEXT,
  account_identifier TEXT,
  account_name TEXT,
  unipile_account_id TEXT,
  platform_account_id TEXT,
  connection_status TEXT,
  connected_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  account_metadata TEXT,
  capabilities TEXT,
  limitations TEXT,
  is_active BOOLEAN,
  error_details TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  unipile_sources TEXT,
  daily_message_limit INTEGER,
  messages_sent_today INTEGER,
  last_message_date TEXT,
  scheduling_url TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.system_alerts (
  id UUID PRIMARY KEY,
  alert_type TEXT,
  component TEXT,
  title TEXT,
  message TEXT,
  resolved BOOLEAN,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,
  metadata TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.sam_knowledge_summaries (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  document_id UUID,
  section_id TEXT,
  total_chunks INTEGER,
  total_tokens INTEGER,
  tags JSONB,
  quick_summary TEXT,
  metadata TEXT,
  sam_ready BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.linkedin_post_monitors (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  hashtags JSONB,
  keywords JSONB,
  n8n_workflow_id TEXT,
  n8n_webhook_url TEXT,
  status TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  timezone TEXT,
  daily_start_time TIMESTAMPTZ,
  auto_approve_enabled BOOLEAN,
  auto_approve_start_time TIMESTAMPTZ,
  auto_approve_end_time TIMESTAMPTZ,
  profile_vanities JSONB,
  profile_provider_ids JSONB,
  name TEXT,
  metadata TEXT,
  last_scraped_at TIMESTAMPTZ,
  scrapes_today INTEGER,
  scrape_count_reset_date TEXT
);

CREATE TABLE IF NOT EXISTS public.core_funnel_performance_view (
  template_id UUID,
  template_name TEXT,
  funnel_type TEXT,
  industry TEXT,
  target_role TEXT,
  total_executions INTEGER,
  avg_response_rate DECIMAL,
  avg_conversion_rate DECIMAL,
  active_executions INTEGER,
  avg_prospects_per_execution DECIMAL,
  last_execution_date TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.competitive_intelligence (
  id UUID PRIMARY KEY,
  competitor_name TEXT,
  first_mentioned TIMESTAMPTZ,
  last_mentioned TIMESTAMPTZ,
  mention_context TEXT,
  positioning_notes TEXT,
  source TEXT,
  status TEXT,
  embedding TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.workspace_dpa_agreements (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  dpa_version TEXT,
  status TEXT,
  signed_at TIMESTAMPTZ,
  signed_by UUID,
  signed_by_name TEXT,
  signed_by_title TEXT,
  signed_by_email TEXT,
  signature_method TEXT,
  ip_address TEXT,
  user_agent TEXT,
  consent_text TEXT,
  scroll_completion BOOLEAN,
  signed_dpa_pdf_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.workspace_reply_agent_config (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  enabled BOOLEAN,
  approval_mode TEXT,
  response_tone TEXT,
  reply_delay_hours INTEGER,
  ai_model TEXT,
  reply_guidelines TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  notification_channels JSONB
);

CREATE TABLE IF NOT EXISTS public.linkedin_comment_replies (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  post_id UUID,
  original_comment_id TEXT,
  original_comment_text TEXT,
  original_comment_author_name TEXT,
  original_comment_author_profile_id TEXT,
  reply_text TEXT,
  replied_at TIMESTAMPTZ,
  replied_by UUID,
  unipile_response TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.email_send_queue (
  id UUID PRIMARY KEY,
  campaign_id UUID,
  prospect_id UUID,
  email_account_id TEXT,
  recipient_email TEXT,
  subject TEXT,
  body TEXT,
  from_name TEXT,
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status TEXT,
  error_message TEXT,
  message_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  variant TEXT
);

CREATE TABLE IF NOT EXISTS public.workspace_integrations (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  integration_type TEXT,
  status TEXT,
  config TEXT,
  connected_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.linkedin_posted_with_engagement (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  post_social_id TEXT,
  comment_text TEXT,
  replies_count INTEGER,
  reactions TEXT,
  replies TEXT,
  posted_at TIMESTAMPTZ,
  user_replied BOOLEAN,
  last_reply_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.knowledge_base_competitors (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  name TEXT,
  description TEXT,
  website TEXT,
  market_share TEXT,
  market_position TEXT,
  strengths TEXT,
  weaknesses TEXT,
  opportunities TEXT,
  threats TEXT,
  pricing_info TEXT,
  product_comparison TEXT,
  metadata TEXT,
  tags JSONB,
  is_active BOOLEAN,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.conversation_analytics (
  id UUID PRIMARY KEY,
  thread_id UUID,
  workspace_id UUID,
  user_id UUID,
  duration_seconds INTEGER,
  message_count INTEGER,
  completion_status TEXT,
  completion_rate DECIMAL,
  persona_used TEXT,
  thread_type TEXT,
  user_engagement_score DECIMAL,
  response_quality_score DECIMAL,
  industry TEXT,
  company_size TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.knowledge_base_sections (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  section_id TEXT,
  title TEXT,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN,
  sort_order INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.linkedin_active_monitors (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  hashtags JSONB,
  keywords JSONB,
  status TEXT,
  n8n_workflow_id TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.email_campaign_prospects (
  id UUID PRIMARY KEY,
  campaign_id UUID,
  workspace_id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  title TEXT,
  reachinbox_campaign_id TEXT,
  reachinbox_lead_id TEXT,
  emails_sent INTEGER,
  emails_opened INTEGER,
  emails_clicked INTEGER,
  emails_replied INTEGER,
  emails_bounced BOOLEAN,
  first_sent_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  first_opened_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  first_clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  reply_sentiment TEXT,
  meeting_booked BOOLEAN,
  meeting_booked_at TIMESTAMPTZ,
  trial_signup BOOLEAN,
  trial_signup_at TIMESTAMPTZ,
  converted_to_mrr BOOLEAN,
  mrr_converted_at TIMESTAMPTZ,
  mrr_value DECIMAL,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.gdpr_deletion_requests (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  prospect_id UUID,
  email_address TEXT,
  linkedin_profile_url TEXT,
  full_name TEXT,
  request_type TEXT,
  request_source TEXT,
  status TEXT,
  verification_method TEXT,
  verification_completed_at TIMESTAMPTZ,
  verified_by UUID,
  scheduled_execution_date TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  executed_by UUID,
  deletion_scope TEXT,
  backup_reference TEXT,
  notes TEXT,
  rejection_reason TEXT,
  requested_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  request_metadata TEXT
);

CREATE TABLE IF NOT EXISTS public.user_memory_preferences (
  id UUID PRIMARY KEY,
  user_id UUID,
  workspace_id UUID,
  auto_archive_enabled BOOLEAN,
  archive_frequency_days INTEGER,
  max_active_threads INTEGER,
  memory_retention_days INTEGER,
  importance_threshold INTEGER,
  auto_restore_on_login BOOLEAN,
  memory_notifications BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.user_workspaces (
  user_id UUID,
  workspace_id UUID,
  role TEXT,
  status TEXT
);

CREATE TABLE IF NOT EXISTS public.workspace_prospects_decrypted (
  id UUID PRIMARY KEY,
  workspace_id TEXT,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  job_title TEXT,
  location TEXT,
  industry TEXT,
  email_address TEXT,
  linkedin_profile_url TEXT,
  pii_is_encrypted BOOLEAN,
  pii_encrypted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.campaign_optimizations (
  id UUID PRIMARY KEY,
  campaign_id UUID,
  metrics TEXT,
  suggestions TEXT,
  applied_suggestions TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.funnel_performance_metrics (
  id UUID PRIMARY KEY,
  campaign_id UUID,
  funnel_type TEXT,
  template_or_definition_id UUID,
  execution_id UUID,
  prospects_total INTEGER,
  prospects_contacted INTEGER,
  prospects_responded INTEGER,
  prospects_converted INTEGER,
  prospects_unsubscribed INTEGER,
  response_rate DECIMAL,
  conversion_rate DECIMAL,
  unsubscribe_rate DECIMAL,
  step_performance TEXT,
  avg_response_time TEXT,
  avg_conversion_time TEXT,
  funnel_completion_rate DECIMAL,
  response_sentiment_scores TEXT,
  message_quality_scores TEXT,
  personalization_effectiveness DECIMAL,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  workspace_id UUID
);

CREATE TABLE IF NOT EXISTS public.crm_sync_logs (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  connection_id UUID,
  sync_type TEXT,
  entity_type TEXT,
  operation TEXT,
  status TEXT,
  records_processed INTEGER,
  records_succeeded INTEGER,
  records_failed INTEGER,
  error_details TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.campaign_linkedin_accounts (
  workspace_id UUID,
  workspace_name TEXT,
  user_id UUID,
  user_email TEXT,
  member_role TEXT,
  unipile_account_id TEXT,
  linkedin_account_name TEXT,
  linkedin_public_identifier TEXT,
  linkedin_profile_url TEXT,
  connection_status TEXT,
  is_available_for_campaigns BOOLEAN
);

CREATE TABLE IF NOT EXISTS public.workspace_invoices (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  organization_id UUID,
  billing_period_start TIMESTAMPTZ,
  billing_period_end TIMESTAMPTZ,
  total_messages INTEGER,
  total_campaigns INTEGER,
  total_prospects INTEGER,
  total_ai_credits INTEGER,
  total_amount_cents INTEGER,
  currency TEXT,
  status TEXT,
  invoice_pdf_url TEXT,
  stripe_invoice_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.campaign_performance_summary (
  campaign_id UUID,
  workspace_id UUID,
  campaign_name TEXT,
  status TEXT,
  campaign_type TEXT,
  ab_test_variant TEXT,
  launched_at TIMESTAMPTZ,
  created_by UUID,
  total_prospects INTEGER,
  messages_sent INTEGER,
  replies_received INTEGER,
  reply_rate_percent DECIMAL,
  avg_response_time_hours DECIMAL,
  positive_replies INTEGER,
  interested_replies INTEGER,
  pending_replies INTEGER,
  meetings_booked INTEGER
);

CREATE TABLE IF NOT EXISTS public.prospect_exports (
  id UUID PRIMARY KEY,
  session_id UUID,
  user_id UUID,
  workspace_id UUID,
  prospect_count INTEGER,
  export_data TEXT,
  export_format TEXT,
  share_url TEXT,
  google_sheets_url TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.website_requests (
  id UUID PRIMARY KEY,
  request_type TEXT,
  source TEXT,
  email TEXT,
  company_name TEXT,
  contact_name TEXT,
  phone TEXT,
  website_url TEXT,
  website_domain TEXT,
  seo_score INTEGER,
  geo_score INTEGER,
  analysis_data TEXT,
  analysis_summary TEXT,
  report_url TEXT,
  report_html TEXT,
  report_storage_path TEXT,
  lead_status TEXT,
  contacted_at TIMESTAMPTZ,
  contacted_by UUID,
  last_contact_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  assigned_to UUID,
  assigned_at TIMESTAMPTZ,
  internal_notes TEXT,
  client_notes TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  referrer TEXT,
  report_viewed BOOLEAN,
  report_viewed_at TIMESTAMPTZ,
  report_downloaded BOOLEAN,
  report_downloaded_at TIMESTAMPTZ,
  calendly_clicked BOOLEAN,
  calendly_clicked_at TIMESTAMPTZ,
  meeting_scheduled BOOLEAN,
  meeting_scheduled_at TIMESTAMPTZ,
  converted_to_client BOOLEAN,
  converted_at TIMESTAMPTZ,
  client_id UUID,
  project_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  access_token TEXT,
  token_used BOOLEAN
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  user_id UUID,
  role TEXT,
  joined_at TIMESTAMPTZ,
  linkedin_unipile_account_id TEXT,
  status TEXT
);

CREATE TABLE IF NOT EXISTS public.system_health_checks (
  id UUID PRIMARY KEY,
  check_date TIMESTAMPTZ,
  checks TEXT,
  ai_analysis TEXT,
  recommendations TEXT,
  overall_status TEXT,
  duration_ms INTEGER,
  fixes_proposed TEXT,
  fixes_applied TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.cron_job_logs (
  id UUID PRIMARY KEY,
  job_name TEXT,
  run_at TIMESTAMPTZ,
  status TEXT,
  details TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  invited_by UUID,
  invited_email TEXT,
  role TEXT,
  token TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID
);

CREATE TABLE IF NOT EXISTS public.knowledge_base_personas (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  name TEXT,
  description TEXT,
  avatar_url TEXT,
  job_title TEXT,
  seniority_level TEXT,
  department TEXT,
  age_range TEXT,
  location TEXT,
  goals TEXT,
  challenges TEXT,
  motivations TEXT,
  frustrations TEXT,
  decision_criteria TEXT,
  preferred_channels TEXT,
  content_preferences TEXT,
  metadata TEXT,
  tags JSONB,
  is_active BOOLEAN,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.linkedin_queue_summary (
  workspace_id UUID,
  status TEXT,
  count INTEGER,
  earliest TIMESTAMPTZ,
  latest TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.workflow_templates (
  id UUID PRIMARY KEY,
  template_name TEXT,
  template_version TEXT,
  n8n_workflow_json TEXT,
  customization_points TEXT,
  required_credentials JSONB,
  min_n8n_version TEXT,
  required_integrations JSONB,
  compatibility_matrix TEXT,
  description TEXT,
  changelog TEXT,
  status TEXT,
  is_default BOOLEAN,
  created_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  deprecated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.slack_app_config (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  slack_team_id TEXT,
  slack_team_name TEXT,
  bot_token TEXT,
  bot_user_id TEXT,
  access_token TEXT,
  signing_secret TEXT,
  app_id TEXT,
  features_enabled TEXT,
  status TEXT,
  last_verified_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  default_channel TEXT
);

CREATE TABLE IF NOT EXISTS public.campaign_prospects (
  id UUID PRIMARY KEY,
  campaign_id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  company_name TEXT,
  linkedin_url TEXT,
  linkedin_user_id TEXT,
  title TEXT,
  phone TEXT,
  location TEXT,
  industry TEXT,
  status TEXT,
  notes TEXT,
  personalization_data TEXT,
  n8n_execution_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  contacted_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  workspace_id UUID,
  added_by UUID,
  added_by_unipile_account TEXT,
  connection_accepted_at TIMESTAMPTZ,
  follow_up_due_at TIMESTAMPTZ,
  follow_up_sequence_index INTEGER,
  last_follow_up_at TIMESTAMPTZ,
  unipile_account_id TEXT,
  scheduled_send_at TIMESTAMPTZ,
  engagement_score INTEGER,
  priority_level TEXT,
  scoring_metadata TEXT,
  validation_status TEXT,
  validation_errors TEXT,
  validation_warnings TEXT,
  has_previous_contact BOOLEAN,
  previous_contact_status TEXT,
  validated_at TIMESTAMPTZ,
  connection_degree TEXT,
  master_prospect_id UUID,
  linkedin_url_hash TEXT,
  company_website TEXT,
  company_name_normalized TEXT,
  title_normalized TEXT,
  location_normalized TEXT,
  ab_variant TEXT,
  last_processed_message_id TEXT,
  meeting_id UUID,
  meeting_scheduled_at TIMESTAMPTZ,
  meeting_status TEXT,
  reply_sentiment TEXT,
  meeting_booked BOOLEAN,
  meeting_booked_at TIMESTAMPTZ,
  trial_signup BOOLEAN,
  trial_signup_at TIMESTAMPTZ,
  converted_to_mrr BOOLEAN,
  mrr_converted_at TIMESTAMPTZ,
  mrr_value DECIMAL,
  sam_reply_sent_at TIMESTAMPTZ,
  sam_reply_included_calendar BOOLEAN,
  prospect_calendar_link TEXT,
  follow_up_trigger TEXT,
  calendar_follow_up_due_at TIMESTAMPTZ,
  conversation_stage TEXT,
  first_calendar_click_at TIMESTAMPTZ,
  first_demo_click_at TIMESTAMPTZ,
  first_pdf_click_at TIMESTAMPTZ,
  total_link_clicks INTEGER,
  last_link_click_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.workspace_blacklists (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  linkedin_account_id TEXT,
  blacklist_type TEXT,
  comparison_type TEXT,
  keyword TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.hitl_reply_approval_sessions (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  campaign_execution_id UUID,
  original_message_id TEXT,
  original_message_content TEXT,
  original_message_channel TEXT,
  prospect_name TEXT,
  prospect_email TEXT,
  prospect_linkedin_url TEXT,
  prospect_company TEXT,
  sam_suggested_reply TEXT,
  sam_confidence_score DECIMAL,
  sam_reasoning TEXT,
  approval_status TEXT,
  assigned_to_email TEXT,
  assigned_to TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  final_message TEXT,
  rejection_reason TEXT,
  approval_email_sent_at TIMESTAMPTZ,
  approval_email_opened_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  timeout_hours INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY,
  prospect_id UUID,
  workspace_id UUID,
  campaign_id UUID,
  booking_url TEXT,
  booking_platform TEXT,
  booking_event_type TEXT,
  title TEXT,
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  timezone TEXT,
  meeting_link TEXT,
  meeting_platform TEXT,
  phone_number TEXT,
  our_attendee_email TEXT,
  our_attendee_name TEXT,
  prospect_email TEXT,
  prospect_name TEXT,
  status TEXT,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT,
  cancellation_reason TEXT,
  no_show_detected_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rescheduled_to UUID,
  reminder_24h_sent_at TIMESTAMPTZ,
  reminder_1h_sent_at TIMESTAMPTZ,
  reminder_15m_sent_at TIMESTAMPTZ,
  no_show_follow_up_sent_at TIMESTAMPTZ,
  post_meeting_follow_up_sent_at TIMESTAMPTZ,
  reschedule_attempts INTEGER,
  max_reschedule_attempts INTEGER,
  our_calendar_event_id TEXT,
  their_calendar_event_id TEXT,
  calendar_synced_at TIMESTAMPTZ,
  outcome TEXT,
  next_steps TEXT,
  notes TEXT,
  metadata TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  source_reply_draft_id UUID
);

CREATE TABLE IF NOT EXISTS public.reply_feedback_reasons (
  id UUID PRIMARY KEY,
  reply_id UUID,
  reason TEXT,
  custom_reason TEXT,
  created_at TIMESTAMPTZ,
  created_by UUID
);

CREATE TABLE IF NOT EXISTS public.sam_conversation_attachments (
  id UUID PRIMARY KEY,
  thread_id UUID,
  message_id UUID,
  user_id UUID,
  workspace_id UUID,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  mime_type TEXT,
  storage_path TEXT,
  storage_bucket TEXT,
  processing_status TEXT,
  extracted_text TEXT,
  extracted_metadata TEXT,
  attachment_type TEXT,
  user_notes TEXT,
  analysis_results TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.linkedin_proxy_assignments (
  id UUID PRIMARY KEY,
  user_id UUID,
  linkedin_account_id TEXT,
  linkedin_account_name TEXT,
  detected_country TEXT,
  proxy_country TEXT,
  proxy_state TEXT,
  proxy_city TEXT,
  proxy_session_id TEXT,
  proxy_username TEXT,
  confidence_score DECIMAL,
  connectivity_status TEXT,
  connectivity_details TEXT,
  is_primary_account BOOLEAN,
  account_features TEXT,
  last_updated TIMESTAMPTZ,
  last_connectivity_test TIMESTAMPTZ,
  next_rotation_due TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.dynamic_funnel_executions (
  id UUID PRIMARY KEY,
  funnel_id UUID,
  campaign_id UUID,
  n8n_execution_id TEXT,
  n8n_workflow_id TEXT,
  status TEXT,
  current_step INTEGER,
  total_steps INTEGER,
  prospects_total INTEGER,
  prospects_in_step TEXT,
  prospects_completed INTEGER,
  prospects_failed INTEGER,
  adaptation_history TEXT,
  adaptation_triggers_fired TEXT,
  current_adaptation_version INTEGER,
  step_performance TEXT,
  overall_performance_score DECIMAL,
  response_patterns TEXT,
  started_at TIMESTAMPTZ,
  last_adaptation_at TIMESTAMPTZ,
  estimated_completion_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  performance_metrics TEXT,
  learning_insights TEXT,
  error_details TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  workspace_id UUID
);

CREATE TABLE IF NOT EXISTS public.linkedin_reposts (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  original_post_id UUID,
  original_social_id TEXT,
  original_author TEXT,
  original_share_url TEXT,
  repost_comment TEXT,
  repost_social_id TEXT,
  status TEXT,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.slack_pending_installations (
  id UUID PRIMARY KEY,
  slack_team_id TEXT,
  slack_team_name TEXT,
  bot_token TEXT,
  bot_user_id TEXT,
  authed_user_id TEXT,
  status TEXT,
  linked_workspace_id UUID,
  linked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.knowledge_base_vectors (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  document_id UUID,
  section_id TEXT,
  chunk_index INTEGER,
  content TEXT,
  embedding TEXT,
  metadata TEXT,
  tags JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  icp_id UUID
);

CREATE TABLE IF NOT EXISTS public.website_requests_dashboard (
  request_date TEXT,
  total_requests INTEGER,
  unique_leads INTEGER,
  avg_seo_score DECIMAL,
  avg_geo_score DECIMAL,
  new_leads INTEGER,
  contacted_leads INTEGER,
  qualified_leads INTEGER,
  proposals_sent INTEGER,
  converted_leads INTEGER,
  disqualified_leads INTEGER,
  reports_viewed INTEGER,
  calendly_clicks INTEGER,
  meetings_scheduled INTEGER,
  conversion_rate_percent DECIMAL
);

CREATE TABLE IF NOT EXISTS public.prospect_approval_decisions (
  id UUID PRIMARY KEY,
  session_id UUID,
  prospect_id TEXT,
  decision TEXT,
  reason TEXT,
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  is_immutable BOOLEAN,
  workspace_id UUID
);

CREATE TABLE IF NOT EXISTS public.workspace_prospects (
  id UUID PRIMARY KEY,
  workspace_id TEXT,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  job_title TEXT,
  linkedin_profile_url TEXT,
  email_address TEXT,
  location TEXT,
  industry TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  added_by UUID,
  added_by_unipile_account TEXT,
  email_address_encrypted TEXT,
  linkedin_profile_url_encrypted TEXT,
  pii_encryption_version INTEGER,
  pii_encrypted_at TIMESTAMPTZ,
  pii_is_encrypted BOOLEAN,
  consent_obtained BOOLEAN,
  consent_date TIMESTAMPTZ,
  consent_source TEXT,
  consent_withdrawn_at TIMESTAMPTZ,
  data_retention_days INTEGER,
  scheduled_deletion_date TIMESTAMPTZ,
  deletion_reason TEXT,
  processing_purposes JSONB,
  data_source TEXT,
  is_eu_resident BOOLEAN,
  gdpr_compliant BOOLEAN,
  data_processing_agreement_version TEXT,
  connection_degree INTEGER,
  linkedin_url TEXT,
  linkedin_url_hash TEXT,
  email TEXT,
  email_hash TEXT,
  company TEXT,
  title TEXT,
  phone TEXT,
  linkedin_provider_id TEXT,
  approval_status TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  batch_id TEXT,
  source TEXT,
  enrichment_data TEXT,
  active_campaign_id UUID,
  linkedin_chat_id TEXT,
  connection_status TEXT,
  company_website TEXT,
  company_name_normalized TEXT,
  title_normalized TEXT,
  location_normalized TEXT
);

CREATE TABLE IF NOT EXISTS public.follow_up_drafts (
  id UUID PRIMARY KEY,
  prospect_id UUID,
  campaign_id UUID,
  workspace_id UUID,
  message TEXT,
  subject TEXT,
  channel TEXT,
  tone TEXT,
  touch_number INTEGER,
  scenario TEXT,
  confidence_score DECIMAL,
  reasoning TEXT,
  status TEXT,
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,
  error_message TEXT,
  retry_count INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.email_responses (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  campaign_id UUID,
  prospect_id UUID,
  from_email TEXT,
  from_name TEXT,
  to_email TEXT,
  subject TEXT,
  message_id TEXT,
  text_body TEXT,
  html_body TEXT,
  stripped_text TEXT,
  has_attachments BOOLEAN,
  attachments TEXT,
  received_at TIMESTAMPTZ,
  processed BOOLEAN,
  processed_at TIMESTAMPTZ,
  sentiment TEXT,
  intent TEXT,
  requires_response BOOLEAN,
  ai_summary TEXT,
  ai_suggested_response TEXT,
  raw_email TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.qa_autofix_logs (
  id UUID PRIMARY KEY,
  issue_type TEXT,
  issue_description TEXT,
  severity TEXT,
  fix_applied TEXT,
  fix_status TEXT,
  affected_component TEXT,
  affected_file TEXT,
  metadata TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.workspace_workflow_credentials (
  id UUID PRIMARY KEY,
  workspace_n8n_workflow_id UUID,
  workspace_id TEXT,
  credential_type TEXT,
  credential_name TEXT,
  n8n_credential_id TEXT,
  is_active BOOLEAN,
  last_validated TIMESTAMPTZ,
  validation_status TEXT,
  validation_error TEXT,
  encrypted_config TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.rate_limits_by_account (
  unipile_account_id TEXT,
  account_name TEXT,
  workspace_name TEXT,
  status TEXT,
  prospect_count INTEGER,
  first_rate_limit TIMESTAMPTZ,
  last_rate_limit TIMESTAMPTZ,
  available_after TIMESTAMPTZ,
  is_available_now BOOLEAN
);

CREATE TABLE IF NOT EXISTS public.template_performance (
  id UUID PRIMARY KEY,
  template_id UUID,
  campaign_id UUID,
  total_sent INTEGER,
  total_responses INTEGER,
  response_rate DECIMAL,
  connection_rate DECIMAL,
  meeting_rate DECIMAL,
  date_start TEXT,
  date_end TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.meeting_follow_up_drafts (
  id UUID PRIMARY KEY,
  meeting_id UUID,
  prospect_id UUID,
  workspace_id UUID,
  follow_up_type TEXT,
  subject TEXT,
  message TEXT,
  channel TEXT,
  status TEXT,
  approval_token TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  rejected_reason TEXT,
  sent_at TIMESTAMPTZ,
  send_error TEXT,
  ai_model TEXT,
  ai_tokens_used INTEGER,
  generation_time_ms INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.website_requests_by_source (
  source TEXT,
  medium TEXT,
  campaign TEXT,
  total_requests INTEGER,
  conversions INTEGER,
  avg_seo_score DECIMAL,
  avg_geo_score DECIMAL,
  conversion_rate_percent DECIMAL
);

CREATE TABLE IF NOT EXISTS public.workspace_usage (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  organization_id UUID,
  usage_type TEXT,
  quantity INTEGER,
  metadata TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.linkedin_post_comments (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  monitor_id UUID,
  post_id UUID,
  comment_text TEXT,
  edited_comment_text TEXT,
  status TEXT,
  generated_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  scheduled_post_time TIMESTAMPTZ,
  generation_metadata TEXT,
  post_response TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  linkedin_comment_id TEXT,
  engagement_metrics TEXT,
  engagement_checked_at TIMESTAMPTZ,
  user_feedback TEXT,
  feedback_at TIMESTAMPTZ,
  digest_sent_at TIMESTAMPTZ,
  is_reply_to_comment BOOLEAN,
  reply_to_comment_id TEXT,
  reply_to_author_name TEXT,
  reactions_count INTEGER,
  replies_count INTEGER,
  performance_score DECIMAL,
  last_engagement_check TIMESTAMPTZ,
  author_replied BOOLEAN,
  author_liked BOOLEAN,
  expires_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.campaign_messages (
  id UUID PRIMARY KEY,
  campaign_id UUID,
  workspace_id UUID,
  platform TEXT,
  platform_message_id TEXT,
  conversation_id TEXT,
  thread_id TEXT,
  recipient_email TEXT,
  recipient_linkedin_profile TEXT,
  recipient_name TEXT,
  prospect_id UUID,
  subject_line TEXT,
  message_content TEXT,
  message_template_variant TEXT,
  sent_at TIMESTAMPTZ,
  sent_via TEXT,
  sender_account TEXT,
  expects_reply BOOLEAN,
  reply_received_at TIMESTAMPTZ,
  reply_count INTEGER,
  last_reply_at TIMESTAMPTZ,
  delivery_status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.inbox_message_tags (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  message_id TEXT,
  message_source TEXT,
  category_id UUID,
  detected_intent TEXT,
  confidence_score DECIMAL,
  ai_reasoning TEXT,
  ai_model TEXT,
  is_manual_override BOOLEAN,
  overridden_by UUID,
  overridden_at TIMESTAMPTZ,
  suggested_response TEXT,
  response_used BOOLEAN,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.workspace_analytics_reports (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  metrics TEXT,
  ai_insights TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.sam_conversation_messages (
  id UUID PRIMARY KEY,
  thread_id UUID,
  role TEXT,
  content TEXT,
  metadata TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  message_order INTEGER,
  user_id UUID,
  has_prospect_intelligence BOOLEAN,
  prospect_intelligence_data TEXT,
  message_metadata TEXT,
  model_used TEXT,
  workspace_id UUID
);

CREATE TABLE IF NOT EXISTS public.slack_user_mapping (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  slack_user_id TEXT,
  slack_username TEXT,
  slack_display_name TEXT,
  slack_email TEXT,
  sam_user_id UUID,
  is_admin BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.linkedin_posts_discovered (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  monitor_id UUID,
  social_id TEXT,
  share_url TEXT,
  post_content TEXT,
  author_name TEXT,
  author_profile_id TEXT,
  author_headline TEXT,
  hashtags JSONB,
  post_date TIMESTAMPTZ,
  engagement_metrics TEXT,
  status TEXT,
  skip_reason TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  author_title TEXT,
  approval_token TEXT,
  approval_status TEXT,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  digest_sent_at TIMESTAMPTZ,
  posted_via_email BOOLEAN,
  comment_eligible_at TIMESTAMPTZ,
  comment_generated_at TIMESTAMPTZ,
  author_country TEXT,
  post_intent TEXT,
  engagement_quality_score DECIMAL,
  quality_factors TEXT,
  expires_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.workspace_dpa_requirements (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  requires_dpa BOOLEAN,
  detection_method TEXT,
  detected_country TEXT,
  detected_at TIMESTAMPTZ,
  grace_period_start TIMESTAMPTZ,
  grace_period_end TIMESTAMPTZ,
  grace_period_active BOOLEAN,
  reminder_7_days_sent BOOLEAN,
  reminder_20_days_sent BOOLEAN,
  reminder_27_days_sent BOOLEAN,
  final_notice_sent BOOLEAN,
  service_blocked BOOLEAN,
  blocked_at TIMESTAMPTZ,
  block_reason TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.crm_contact_mappings (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  crm_type TEXT,
  sam_contact_id UUID,
  crm_contact_id TEXT,
  sam_updated_at TIMESTAMPTZ,
  crm_updated_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_error TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.linkedin_brand_guidelines (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  tone_of_voice TEXT,
  writing_style TEXT,
  topics_and_perspective TEXT,
  dos_and_donts TEXT,
  comment_framework TEXT,
  max_characters INTEGER,
  system_prompt TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  perspective_style TEXT,
  confidence_level TEXT,
  tone TEXT,
  formality TEXT,
  comment_length TEXT,
  question_frequency TEXT,
  use_workspace_knowledge BOOLEAN,
  what_you_do TEXT,
  what_youve_learned TEXT,
  pov_on_future TEXT,
  industry_talking_points TEXT,
  voice_reference TEXT,
  okay_funny BOOLEAN,
  okay_blunt BOOLEAN,
  casual_openers BOOLEAN,
  personal_experience BOOLEAN,
  strictly_professional BOOLEAN,
  framework_preset TEXT,
  custom_framework TEXT,
  example_comments JSONB,
  admired_comments JSONB,
  default_relationship_tag TEXT,
  comment_scope TEXT,
  auto_skip_generic BOOLEAN,
  post_age_awareness BOOLEAN,
  recent_comment_memory BOOLEAN,
  competitors_never_mention JSONB,
  end_with_cta TEXT,
  cta_style TEXT,
  timezone TEXT,
  posting_start_time TIMESTAMPTZ,
  posting_end_time TIMESTAMPTZ,
  post_on_weekends BOOLEAN,
  post_on_holidays BOOLEAN,
  daily_comment_limit INTEGER,
  min_days_between_profile_comments INTEGER,
  max_days_between_profile_comments INTEGER,
  tag_post_authors BOOLEAN,
  blacklisted_profiles JSONB,
  monitor_comments BOOLEAN,
  reply_to_high_engagement BOOLEAN,
  auto_approve_enabled BOOLEAN,
  auto_approve_start_time TIMESTAMPTZ,
  auto_approve_end_time TIMESTAMPTZ,
  profile_scrape_interval_days INTEGER,
  max_profile_scrapes_per_day INTEGER,
  voice_enabled BOOLEAN,
  voice_gender TEXT,
  elevenlabs_voice_id TEXT,
  voice_sample_url TEXT,
  voice_clone_status TEXT,
  auto_repost_enabled BOOLEAN,
  repost_min_likes INTEGER,
  repost_min_comments INTEGER,
  reposts_per_day INTEGER,
  country_code TEXT,
  block_job_posts BOOLEAN,
  block_event_posts BOOLEAN,
  block_promotional_posts BOOLEAN,
  block_repost_only BOOLEAN,
  block_generic_motivation BOOLEAN,
  block_self_promotion BOOLEAN,
  custom_blocked_keywords JSONB,
  apify_calls_today INTEGER,
  apify_calls_reset_date TEXT,
  digest_email TEXT,
  digest_enabled BOOLEAN,
  digest_time TIMESTAMPTZ,
  digest_timezone TEXT,
  last_digest_sent_at TIMESTAMPTZ,
  target_countries JSONB,
  priority_profiles TEXT,
  opportunity_digest_enabled BOOLEAN,
  opportunity_digest_time TEXT
);

CREATE TABLE IF NOT EXISTS public.campaign_funnel_overview (
  campaign_id UUID,
  campaign_name TEXT,
  funnel_type TEXT,
  funnel_name TEXT,
  campaign_status TEXT,
  n8n_workflow_id TEXT,
  n8n_execution_id TEXT,
  prospects_total INTEGER,
  prospects_contacted INTEGER,
  prospects_responded INTEGER,
  prospects_converted INTEGER,
  response_rate DECIMAL,
  conversion_rate DECIMAL,
  campaign_created_at TIMESTAMPTZ,
  campaign_updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.knowledge_gap_tracking (
  id UUID PRIMARY KEY,
  category TEXT,
  missing_info TEXT,
  impact_level TEXT,
  suggested_section TEXT,
  source_conversation UUID,
  insight_id UUID,
  status TEXT,
  embedding TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.reply_agent_metrics (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  date TEXT,
  replies_received INTEGER,
  drafts_generated INTEGER,
  drafts_approved INTEGER,
  drafts_edited INTEGER,
  drafts_refused INTEGER,
  intent_interested INTEGER,
  intent_curious INTEGER,
  intent_objection INTEGER,
  intent_timing INTEGER,
  intent_wrong_person INTEGER,
  intent_not_interested INTEGER,
  intent_question INTEGER,
  intent_vague_positive INTEGER,
  avg_intent_confidence DECIMAL,
  thumbs_up_count INTEGER,
  thumbs_down_count INTEGER,
  edit_rate DECIMAL,
  linkedin_replies INTEGER,
  email_replies INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.campaign_settings (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  user_id UUID,
  campaign_id UUID,
  connection_request_delay TEXT,
  follow_up_delay TEXT,
  max_messages_per_day INTEGER,
  preferred_send_times JSONB,
  active_days JSONB,
  timezone TEXT,
  auto_insert_company_name BOOLEAN,
  use_job_title BOOLEAN,
  include_industry_insights BOOLEAN,
  reference_mutual_connections BOOLEAN,
  daily_connection_limit INTEGER,
  respect_do_not_contact BOOLEAN,
  auto_pause_high_rejection BOOLEAN,
  require_message_approval BOOLEAN,
  scope TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.sam_learning_models (
  id UUID PRIMARY KEY,
  user_id UUID,
  workspace_id UUID,
  model_version INTEGER,
  model_type TEXT,
  learned_preferences TEXT,
  feature_weights TEXT,
  accuracy_score DECIMAL,
  sessions_trained_on INTEGER,
  last_training_session UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.sam_funnel_messages (
  id UUID PRIMARY KEY,
  execution_id UUID,
  campaign_id UUID,
  prospect_id UUID,
  step_number INTEGER,
  step_type TEXT,
  message_template TEXT,
  subject TEXT,
  scheduled_date TIMESTAMPTZ,
  sent_date TIMESTAMPTZ,
  week_number INTEGER,
  weekday TEXT,
  mandatory_element TEXT,
  cta_variation TEXT,
  status TEXT,
  response_received BOOLEAN,
  response_type TEXT,
  response_content TEXT,
  conditions TEXT,
  skip_reason TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  workspace_id UUID
);

CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  category TEXT,
  subcategory TEXT,
  title TEXT,
  content TEXT,
  tags JSONB,
  version TEXT,
  is_active BOOLEAN,
  source_attachment_id UUID,
  source_type TEXT,
  source_metadata TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  icp_id UUID
);

CREATE TABLE IF NOT EXISTS public.reply_agent_settings (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  sam_description TEXT,
  sam_differentiators TEXT,
  ideal_customer TEXT,
  objection_handling TEXT,
  proof_points TEXT,
  pricing_guidance TEXT,
  voice_reference TEXT,
  tone_of_voice TEXT,
  writing_style TEXT,
  dos_and_donts TEXT,
  default_cta TEXT,
  calendar_link TEXT,
  pushiness_level TEXT,
  handle_not_interested TEXT,
  handle_pricing TEXT,
  system_prompt_override TEXT,
  enabled BOOLEAN,
  approval_mode TEXT,
  ai_model TEXT,
  reply_delay_minutes INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  demo_video_link TEXT,
  pdf_overview_link TEXT,
  case_studies_link TEXT,
  landing_page_link TEXT,
  signup_link TEXT
);

CREATE TABLE IF NOT EXISTS public.oauth_states (
  id UUID PRIMARY KEY,
  state TEXT,
  workspace_id UUID,
  user_id UUID,
  provider TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.website_analysis_queue (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  website_url TEXT,
  analysis_depth TEXT,
  priority INTEGER,
  status TEXT,
  error_message TEXT,
  retry_count INTEGER,
  max_retries INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result_id UUID,
  prospect_id UUID,
  created_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.website_analysis_results (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  website_url TEXT,
  domain TEXT,
  analyzed_at TIMESTAMPTZ,
  status TEXT,
  error_message TEXT,
  seo_score INTEGER,
  geo_score INTEGER,
  overall_score INTEGER,
  seo_results TEXT,
  geo_results TEXT,
  recommendations TEXT,
  executive_summary TEXT,
  raw_html_hash TEXT,
  fetch_duration_ms INTEGER,
  analysis_duration_ms INTEGER,
  prospect_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.knowledge_base_document_usage (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  document_id UUID,
  thread_id UUID,
  message_id UUID,
  user_id UUID,
  chunks_used INTEGER,
  relevance_score DECIMAL,
  query_context TEXT,
  metadata TEXT,
  used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.dynamic_funnel_definitions (
  id UUID PRIMARY KEY,
  campaign_id UUID,
  name TEXT,
  description TEXT,
  ai_prompt TEXT,
  target_persona TEXT,
  business_objective TEXT,
  value_proposition TEXT,
  funnel_logic TEXT,
  adaptation_rules TEXT,
  n8n_workflow_json TEXT,
  n8n_workflow_id TEXT,
  created_by_sam BOOLEAN,
  ai_model_used TEXT,
  confidence_score DECIMAL,
  generation_reasoning TEXT,
  execution_count INTEGER,
  adaptation_count INTEGER,
  avg_performance_score DECIMAL,
  is_active BOOLEAN,
  is_experimental BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  workspace_id UUID
);

CREATE TABLE IF NOT EXISTS public.core_funnel_templates (
  id UUID PRIMARY KEY,
  funnel_type TEXT,
  name TEXT,
  description TEXT,
  industry TEXT,
  target_role TEXT,
  company_size TEXT,
  n8n_workflow_id TEXT,
  n8n_workflow_json TEXT,
  total_executions INTEGER,
  avg_response_rate DECIMAL,
  avg_conversion_rate DECIMAL,
  avg_completion_time TEXT,
  step_count INTEGER,
  default_timing TEXT,
  message_templates TEXT,
  personalization_variables TEXT,
  is_active BOOLEAN,
  is_featured BOOLEAN,
  created_by TEXT,
  tags JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  workspace_id UUID
);

CREATE TABLE IF NOT EXISTS public.crm_connections (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  crm_type TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scope JSONB,
  crm_account_id TEXT,
  crm_account_name TEXT,
  status TEXT,
  error_message TEXT,
  connected_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.sam_icp_discovery_sessions (
  id UUID PRIMARY KEY,
  user_id UUID,
  thread_id UUID,
  session_status TEXT,
  discovery_payload TEXT,
  phases_completed JSONB,
  red_flags JSONB,
  confidence_score DECIMAL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  question_responses TEXT,
  industry_context TEXT,
  prospecting_criteria TEXT,
  linkedin_profile_data TEXT,
  content_strategy TEXT,
  workspace_id UUID
);

CREATE TABLE IF NOT EXISTS public.linkedin_self_post_monitors (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  post_url TEXT,
  post_social_id TEXT,
  post_ugc_id TEXT,
  post_title TEXT,
  post_content TEXT,
  post_author_name TEXT,
  posted_at TIMESTAMPTZ,
  reply_prompt TEXT,
  reply_context TEXT,
  is_active BOOLEAN,
  auto_approve_replies BOOLEAN,
  max_replies_per_day INTEGER,
  check_frequency_minutes INTEGER,
  reply_to_questions_only BOOLEAN,
  skip_single_word_comments BOOLEAN,
  min_comment_length INTEGER,
  last_checked_at TIMESTAMPTZ,
  last_comment_id TEXT,
  total_comments_found INTEGER,
  total_replies_sent INTEGER,
  replies_sent_today INTEGER,
  replies_reset_date TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.v_commenting_expiration_status (
  workspace_id UUID,
  content_type TEXT,
  pending_count INTEGER,
  expired_needing_cleanup INTEGER,
  already_expired INTEGER,
  next_expiration TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.campaign_schedules (
  id UUID PRIMARY KEY,
  campaign_id UUID,
  scheduled_start_time TIMESTAMPTZ,
  scheduled_end_time TIMESTAMPTZ,
  timezone TEXT,
  repeat_frequency TEXT,
  repeat_until TIMESTAMPTZ,
  priority TEXT,
  max_daily_messages INTEGER,
  schedule_status TEXT,
  actual_start_time TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  resumed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  workspace_id UUID
);

CREATE TABLE IF NOT EXISTS public.booking_platforms (
  id UUID PRIMARY KEY,
  platform_name TEXT,
  url_pattern TEXT,
  scrape_enabled BOOLEAN,
  booking_enabled BOOLEAN,
  notes TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.reply_agent_drafts (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  campaign_id UUID,
  prospect_id UUID,
  inbound_message_id TEXT,
  inbound_message_text TEXT,
  inbound_message_at TIMESTAMPTZ,
  channel TEXT,
  prospect_name TEXT,
  prospect_linkedin_url TEXT,
  prospect_company TEXT,
  prospect_title TEXT,
  research_linkedin_profile TEXT,
  research_company_profile TEXT,
  research_website TEXT,
  draft_text TEXT,
  intent_detected TEXT,
  ai_model TEXT,
  status TEXT,
  approval_token UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  edited_text TEXT,
  rejection_reason TEXT,
  sent_at TIMESTAMPTZ,
  send_error TEXT,
  outbound_message_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  included_calendar_link BOOLEAN,
  prospect_sent_calendar_link TEXT
);

CREATE TABLE IF NOT EXISTS public.memory_snapshots (
  id UUID PRIMARY KEY,
  user_id UUID,
  workspace_id UUID,
  snapshot_date TIMESTAMPTZ,
  thread_count INTEGER,
  message_count INTEGER,
  memory_summary TEXT,
  thread_ids JSONB,
  archived_threads TEXT,
  importance_score INTEGER,
  user_notes TEXT,
  restore_count INTEGER,
  last_restored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.inbox_message_categories (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  color TEXT,
  icon TEXT,
  is_system BOOLEAN,
  is_active BOOLEAN,
  suggested_action TEXT,
  display_order INTEGER,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.dpa_versions (
  id UUID PRIMARY KEY,
  version TEXT,
  effective_date TEXT,
  content TEXT,
  is_current BOOLEAN,
  created_at TIMESTAMPTZ,
  created_by UUID
);

CREATE TABLE IF NOT EXISTS public.website_requests_active (
  id UUID PRIMARY KEY,
  email TEXT,
  company_name TEXT,
  website_url TEXT,
  website_domain TEXT,
  seo_score INTEGER,
  geo_score INTEGER,
  lead_status TEXT,
  assigned_to UUID,
  next_follow_up_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  days_since_request DECIMAL,
  follow_up_status TEXT
);

CREATE TABLE IF NOT EXISTS public.dpa_sub_processors (
  id UUID PRIMARY KEY,
  name TEXT,
  description TEXT,
  purpose TEXT,
  location TEXT,
  data_processed JSONB,
  dpa_url TEXT,
  added_date TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.knowledge_base_content (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  section_id TEXT,
  content_type TEXT,
  title TEXT,
  content TEXT,
  metadata TEXT,
  tags JSONB,
  is_active BOOLEAN,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.send_queue (
  id UUID PRIMARY KEY,
  campaign_id UUID,
  prospect_id UUID,
  linkedin_user_id TEXT,
  message TEXT,
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  message_type TEXT,
  requires_connection BOOLEAN,
  voice_message_url TEXT,
  variant TEXT
);

CREATE TABLE IF NOT EXISTS public.template_components (
  id UUID PRIMARY KEY,
  component_type TEXT,
  industry TEXT,
  role TEXT,
  language TEXT,
  content TEXT,
  performance_score DECIMAL,
  usage_count INTEGER,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.document_ai_analysis (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  document_id UUID,
  analysis_type TEXT,
  model_used TEXT,
  tags JSONB,
  categories JSONB,
  key_insights TEXT,
  summary TEXT,
  relevance_score DECIMAL,
  metadata TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.link_clicks (
  id UUID PRIMARY KEY,
  tracked_link_id UUID,
  clicked_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  country TEXT,
  city TEXT,
  is_first_click BOOLEAN
);

CREATE TABLE IF NOT EXISTS public.linkedin_comment_queue (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  post_id UUID,
  post_social_id TEXT,
  comment_text TEXT,
  comment_length INTEGER,
  requires_approval BOOLEAN,
  approval_status TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  generated_by TEXT,
  generation_model TEXT,
  confidence_score DECIMAL,
  status TEXT,
  posted_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.dynamic_funnel_performance_view (
  definition_id UUID,
  funnel_name TEXT,
  campaign_id UUID,
  target_persona TEXT,
  execution_count INTEGER,
  adaptation_count INTEGER,
  avg_performance_score DECIMAL,
  active_executions INTEGER,
  current_avg_performance DECIMAL,
  last_execution_date TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.workspace_meeting_agent_config (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  enabled BOOLEAN,
  auto_book BOOLEAN,
  approval_mode TEXT,
  reminder_24h_enabled BOOLEAN,
  reminder_1h_enabled BOOLEAN,
  reminder_15m_enabled BOOLEAN,
  no_show_detection_enabled BOOLEAN,
  no_show_grace_period_minutes INTEGER,
  max_reschedule_attempts INTEGER,
  default_meeting_duration INTEGER,
  ai_model TEXT,
  follow_up_guidelines TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.workspace_ai_search_config (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  website_url TEXT,
  website_locked BOOLEAN,
  enabled BOOLEAN,
  auto_analyze_prospects BOOLEAN,
  analysis_depth TEXT,
  check_meta_tags BOOLEAN,
  check_structured_data BOOLEAN,
  check_robots_txt BOOLEAN,
  check_sitemap BOOLEAN,
  check_page_speed BOOLEAN,
  check_llm_readability BOOLEAN,
  check_entity_clarity BOOLEAN,
  check_fact_density BOOLEAN,
  check_citation_readiness BOOLEAN,
  learn_from_outreach BOOLEAN,
  learn_from_comments BOOLEAN,
  send_analysis_reports BOOLEAN,
  report_email TEXT,
  ai_model TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.customer_insight_patterns (
  id UUID PRIMARY KEY,
  insight_type TEXT,
  description TEXT,
  frequency_score INTEGER,
  business_impact TEXT,
  last_seen TIMESTAMPTZ,
  source_conversations JSONB,
  embedding TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  name TEXT,
  description TEXT,
  campaign_type TEXT,
  status TEXT,
  channel_preferences TEXT,
  linkedin_config TEXT,
  email_config TEXT,
  n8n_execution_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  launched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  type TEXT,
  target_criteria TEXT,
  execution_preferences TEXT,
  template_id UUID,
  funnel_type TEXT,
  core_template_id UUID,
  dynamic_definition_id UUID,
  n8n_workflow_id TEXT,
  funnel_configuration TEXT,
  campaign_name TEXT,
  current_step INTEGER,
  connection_message TEXT,
  alternative_message TEXT,
  follow_up_messages TEXT,
  draft_data TEXT,
  funnel_id UUID,
  target_icp TEXT,
  ab_test_variant TEXT,
  message_templates TEXT,
  created_by UUID,
  send_schedule TEXT,
  next_execution_time TIMESTAMPTZ,
  auto_execute BOOLEAN,
  timezone TEXT,
  working_hours_start INTEGER,
  working_hours_end INTEGER,
  skip_weekends BOOLEAN,
  skip_holidays BOOLEAN,
  country_code TEXT,
  flow_settings TEXT,
  metadata TEXT,
  linkedin_account_id UUID,
  n8n_webhook_url TEXT,
  schedule_settings TEXT,
  message_sequence TIMESTAMPTZ,
  reachinbox_campaign_id TEXT,
  total_emails_sent INTEGER,
  total_emails_opened INTEGER,
  total_emails_replied INTEGER,
  total_emails_bounced INTEGER,
  total_link_clicked INTEGER,
  leads_count INTEGER
);

CREATE TABLE IF NOT EXISTS public.prospect_data_integrity (
  corrupted_sent INTEGER,
  corrupted_failed INTEGER,
  corrupted_pending INTEGER,
  total_prospects INTEGER,
  corruption_percentage DECIMAL
);

CREATE TABLE IF NOT EXISTS public.linkedin_searches (
  id UUID PRIMARY KEY,
  user_id UUID,
  workspace_id TEXT,
  unipile_account_id TEXT,
  search_query TEXT,
  search_params TEXT,
  api_type TEXT,
  category TEXT,
  results_count INTEGER,
  prospects TEXT,
  next_cursor TEXT,
  searched_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  email TEXT,
  token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.linkedin_comments_posted (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  post_id UUID,
  queue_id UUID,
  comment_id TEXT,
  post_social_id TEXT,
  comment_text TEXT,
  engagement_metrics TEXT,
  replies_count INTEGER,
  user_replied BOOLEAN,
  last_reply_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.workspace_searched_prospects (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  linkedin_url TEXT,
  linkedin_provider_id TEXT,
  first_name TEXT,
  last_name TEXT,
  first_seen_at TIMESTAMPTZ,
  search_session_id UUID,
  source TEXT
);

CREATE TABLE IF NOT EXISTS public.funnel_adaptation_logs (
  id UUID PRIMARY KEY,
  definition_id UUID,
  execution_id TEXT,
  event_type TEXT,
  trigger_reason TEXT,
  step_order INTEGER,
  original_config TEXT,
  adapted_config TEXT,
  adaptation_reasoning TEXT,
  before_performance TEXT,
  after_performance TEXT,
  adaptation_effectiveness DECIMAL,
  ai_model_used TEXT,
  confidence_score DECIMAL,
  timestamp TIMESTAMPTZ,
  workspace_id UUID
);

CREATE TABLE IF NOT EXISTS public.meeting_reminders (
  id UUID PRIMARY KEY,
  meeting_id UUID,
  workspace_id UUID,
  reminder_type TEXT,
  scheduled_for TIMESTAMPTZ,
  status TEXT,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  channel TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.deployment_logs (
  id UUID PRIMARY KEY,
  deployment_name TEXT,
  deployment_type TEXT,
  target_workspaces JSONB,
  target_count INTEGER,
  deployment_mode TEXT,
  status TEXT,
  success_count INTEGER,
  failure_count INTEGER,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  deployed_by UUID,
  metadata TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.system_health_logs (
  id UUID PRIMARY KEY,
  component TEXT,
  component_detail TEXT,
  status TEXT,
  response_time_ms INTEGER,
  cpu_usage DECIMAL,
  memory_usage DECIMAL,
  storage_usage DECIMAL,
  error_count INTEGER,
  error_message TEXT,
  metadata TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.conversation_insights (
  id UUID PRIMARY KEY,
  conversation_id UUID,
  user_id UUID,
  insights TEXT,
  trigger_type TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.account_rate_limits (
  id UUID PRIMARY KEY,
  account_id UUID,
  date TEXT,
  daily_cr_sent INTEGER,
  weekly_cr_sent INTEGER,
  daily_messages_sent INTEGER,
  status TEXT,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.linkedin_self_post_comment_replies (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  monitor_id UUID,
  comment_linkedin_id TEXT,
  comment_text TEXT,
  commenter_name TEXT,
  commenter_headline TEXT,
  commenter_linkedin_url TEXT,
  commenter_provider_id TEXT,
  commented_at TIMESTAMPTZ,
  comment_likes_count INTEGER,
  is_question BOOLEAN,
  sentiment TEXT,
  reply_text TEXT,
  generation_metadata TEXT,
  confidence_score DECIMAL,
  status TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  scheduled_post_time TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  reply_linkedin_id TEXT,
  failure_reason TEXT,
  post_response TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.message_outbox (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  campaign_id UUID,
  prospect_id UUID,
  reply_id UUID,
  channel TEXT,
  message_content TEXT,
  subject TEXT,
  status TEXT,
  scheduled_send_time TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  external_message_id TEXT,
  n8n_execution_id TEXT,
  metadata TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.workspace_icp (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  name TEXT,
  is_default BOOLEAN,
  titles JSONB,
  seniority_levels JSONB,
  industries JSONB,
  company_size_min INTEGER,
  company_size_max INTEGER,
  locations JSONB,
  countries JSONB,
  funding_stages JSONB,
  keywords JSONB,
  exclude_keywords JSONB,
  target_companies JSONB,
  exclude_companies JSONB,
  description TEXT,
  last_search_at TIMESTAMPTZ,
  last_search_results INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID
);

CREATE TABLE IF NOT EXISTS public.prospect_search_results (
  id UUID PRIMARY KEY,
  job_id UUID,
  prospect_data TEXT,
  batch_number INTEGER,
  created_at TIMESTAMPTZ,
  workspace_id UUID
);

CREATE TABLE IF NOT EXISTS public.data_retention_policies (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  policy_name TEXT,
  applies_to JSONB,
  default_retention_days INTEGER,
  inactive_prospect_retention_days INTEGER,
  campaign_data_retention_days INTEGER,
  message_history_retention_days INTEGER,
  eu_resident_retention_days INTEGER,
  non_eu_retention_days INTEGER,
  auto_delete_enabled BOOLEAN,
  notify_before_deletion_days INTEGER,
  legal_hold_enabled BOOLEAN,
  legal_hold_reason TEXT,
  legal_hold_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  is_active BOOLEAN
);

CREATE TABLE IF NOT EXISTS public.user_unipile_accounts (
  id UUID PRIMARY KEY,
  user_id UUID,
  unipile_account_id TEXT,
  platform TEXT,
  account_name TEXT,
  account_email TEXT,
  linkedin_public_identifier TEXT,
  linkedin_profile_url TEXT,
  connection_status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  linkedin_account_type TEXT,
  account_features TEXT,
  workspace_id UUID,
  account_metadata TEXT
);

CREATE TABLE IF NOT EXISTS public.knowledge_base_products (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  name TEXT,
  description TEXT,
  sku TEXT,
  category TEXT,
  price DECIMAL,
  currency TEXT,
  pricing_model TEXT,
  features TEXT,
  benefits TEXT,
  use_cases TEXT,
  specifications TEXT,
  metadata TEXT,
  tags JSONB,
  is_active BOOLEAN,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.workspace_account_limits (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  linkedin_limits TEXT,
  email_limits TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.crm_field_mappings (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  crm_type TEXT,
  sam_field TEXT,
  crm_field TEXT,
  field_type TEXT,
  data_type TEXT,
  is_required BOOLEAN,
  is_custom BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.tracked_links (
  id UUID PRIMARY KEY,
  short_code TEXT,
  destination_url TEXT,
  link_type TEXT,
  prospect_id UUID,
  campaign_id UUID,
  workspace_id UUID,
  source_type TEXT,
  source_id UUID,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.cron_job_schedule (
  jobid INTEGER,
  schedule TEXT,
  command TEXT,
  nodename TEXT,
  nodeport INTEGER,
  database TEXT,
  username TEXT,
  active BOOLEAN
);

CREATE TABLE IF NOT EXISTS public.knowledge_base_documents (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  section_id TEXT,
  filename TEXT,
  original_filename TEXT,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT,
  extracted_content TEXT,
  metadata TEXT,
  tags JSONB,
  categories JSONB,
  content_type TEXT,
  key_insights TEXT,
  summary TEXT,
  relevance_score DECIMAL,
  suggested_section TEXT,
  ai_metadata TEXT,
  status TEXT,
  processed_at TIMESTAMPTZ,
  vector_chunks INTEGER,
  vectorized_at TIMESTAMPTZ,
  uploaded_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  section TEXT,
  usage_count INTEGER,
  last_used_at TIMESTAMPTZ,
  last_used_in_thread_id UUID,
  first_used_at TIMESTAMPTZ,
  icp_id UUID
);

CREATE TABLE IF NOT EXISTS public.enrichment_jobs (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  user_id UUID,
  session_id UUID,
  prospect_ids JSONB,
  total_prospects INTEGER,
  status TEXT,
  processed_count INTEGER,
  failed_count INTEGER,
  current_prospect_id TEXT,
  current_prospect_url TEXT,
  error_message TEXT,
  enrichment_results TEXT,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.sam_conversation_threads (
  id UUID PRIMARY KEY,
  user_id UUID,
  organization_id UUID,
  workspace_id UUID,
  title TEXT,
  thread_type TEXT,
  prospect_name TEXT,
  prospect_company TEXT,
  prospect_linkedin_url TEXT,
  campaign_name TEXT,
  tags JSONB,
  priority TEXT,
  sales_methodology TEXT,
  status TEXT,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  memory_archived BOOLEAN,
  memory_archive_date TIMESTAMPTZ,
  memory_importance_score INTEGER,
  user_bookmarked BOOLEAN
);

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY,
  clerk_org_id TEXT,
  name TEXT,
  slug TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  billing_type TEXT,
  master_billing_email TEXT,
  stripe_customer_id TEXT
);

CREATE TABLE IF NOT EXISTS public.v_linkedin_account_status (
  user_account_id UUID,
  user_id UUID,
  workspace_id UUID,
  unipile_account_id TEXT,
  account_name TEXT,
  platform TEXT,
  user_connection_status TEXT,
  workspace_account_id UUID,
  workspace_connection_status TEXT,
  workspace_account_active BOOLEAN,
  mapping_status TEXT
);

CREATE TABLE IF NOT EXISTS public.prospect_approval_data (
  id UUID PRIMARY KEY,
  session_id UUID,
  prospect_id TEXT,
  name TEXT,
  title TEXT,
  location TEXT,
  profile_image TEXT,
  recent_activity TEXT,
  company TEXT,
  contact TEXT,
  connection_degree INTEGER,
  enrichment_score INTEGER,
  source TEXT,
  enriched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  approval_status TEXT,
  workspace_id UUID
);

CREATE TABLE IF NOT EXISTS public.workspace_encryption_keys (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  encrypted_key TEXT,
  key_version INTEGER,
  created_at TIMESTAMPTZ,
  rotated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN,
  created_by UUID
);

CREATE TABLE IF NOT EXISTS public.prospect_approval_sessions (
  id UUID PRIMARY KEY,
  batch_number INTEGER,
  user_id UUID,
  workspace_id UUID,
  status TEXT,
  total_prospects INTEGER,
  approved_count INTEGER,
  rejected_count INTEGER,
  pending_count INTEGER,
  icp_criteria TEXT,
  prospect_source TEXT,
  learning_insights TEXT,
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  campaign_name TEXT,
  campaign_tag TEXT,
  campaign_id UUID,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS public.n8n_campaign_executions (
  id UUID PRIMARY KEY,
  workspace_n8n_workflow_id UUID,
  campaign_approval_session_id UUID,
  workspace_id TEXT,
  n8n_execution_id TEXT,
  n8n_workflow_id TEXT,
  campaign_name TEXT,
  campaign_type TEXT,
  execution_config TEXT,
  total_prospects INTEGER,
  processed_prospects INTEGER,
  successful_outreach INTEGER,
  failed_outreach INTEGER,
  responses_received INTEGER,
  execution_status TEXT,
  current_step TEXT,
  progress_percentage DECIMAL,
  campaign_results TEXT,
  performance_metrics TEXT,
  error_details TEXT,
  estimated_completion_time TIMESTAMPTZ,
  estimated_duration_minutes INTEGER,
  actual_duration_minutes INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.workspace_subscriptions (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  stripe_subscription_id TEXT,
  status TEXT,
  plan TEXT,
  trial_end TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.sam_funnel_responses (
  id UUID PRIMARY KEY,
  execution_id UUID,
  message_id UUID,
  prospect_id UUID,
  response_type TEXT,
  response_content TEXT,
  response_date TIMESTAMPTZ,
  qualification_option TEXT,
  qualification_meaning TEXT,
  sam_analysis TEXT,
  sam_suggested_reply TEXT,
  sam_confidence_score DECIMAL,
  requires_approval BOOLEAN,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  approval_status TEXT,
  final_reply TEXT,
  action_taken TEXT,
  action_date TIMESTAMPTZ,
  follow_up_scheduled_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  workspace_id UUID
);

CREATE TABLE IF NOT EXISTS public.funnel_step_logs (
  id UUID PRIMARY KEY,
  execution_id TEXT,
  funnel_type TEXT,
  prospect_id UUID,
  step_identifier TEXT,
  step_type TEXT,
  result TEXT,
  execution_time_ms INTEGER,
  input_data TEXT,
  output_data TEXT,
  error_details TEXT,
  n8n_node_id TEXT,
  timestamp TIMESTAMPTZ,
  workspace_id UUID
);

CREATE TABLE IF NOT EXISTS public.slack_channels (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  channel_id TEXT,
  channel_name TEXT,
  channel_type TEXT,
  linked_campaign_id UUID,
  is_default BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.messaging_templates (
  id UUID PRIMARY KEY,
  workspace_id TEXT,
  template_name TEXT,
  campaign_type TEXT,
  industry TEXT,
  target_role TEXT,
  target_company_size TEXT,
  connection_message TEXT,
  alternative_message TEXT,
  follow_up_messages TEXT,
  language TEXT,
  tone TEXT,
  performance_metrics TEXT,
  is_active BOOLEAN,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.crm_conflict_resolutions (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  entity_type TEXT,
  entity_id TEXT,
  crm_type TEXT,
  strategy TEXT,
  winner_source TEXT,
  sam_record_id UUID,
  crm_record_id TEXT,
  sam_data TEXT,
  crm_data TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.knowledge_base_icps (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  title TEXT,
  description TEXT,
  industry TEXT,
  company_size TEXT,
  revenue_range TEXT,
  geography JSONB,
  pain_points TEXT,
  buying_process TEXT,
  metadata TEXT,
  tags JSONB,
  is_active BOOLEAN,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.slack_messages (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  channel_id TEXT,
  thread_ts TEXT,
  message_ts TEXT,
  direction TEXT,
  sender_type TEXT,
  sender_id TEXT,
  sender_name TEXT,
  content TEXT,
  sam_thread_id UUID,
  ai_response TEXT,
  processed_at TIMESTAMPTZ,
  raw_event TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.linkedin_comment_performance_stats (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  period_start TEXT,
  period_end TEXT,
  total_comments INTEGER,
  total_posted INTEGER,
  total_with_engagement INTEGER,
  total_reactions INTEGER,
  total_replies INTEGER,
  author_response_rate DECIMAL,
  performance_by_type TEXT,
  performance_by_length TEXT,
  top_openers TEXT,
  top_topics TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.magic_link_tokens (
  id UUID PRIMARY KEY,
  token TEXT,
  user_id UUID,
  used BOOLEAN,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.user_organizations (
  id UUID PRIMARY KEY,
  user_id UUID,
  organization_id UUID,
  role TEXT,
  joined_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.pii_access_log (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  user_id UUID,
  table_name TEXT,
  record_id UUID,
  field_name TEXT,
  access_type TEXT,
  ip_address TEXT,
  user_agent TEXT,
  accessed_at TIMESTAMPTZ,
  access_reason TEXT
);

CREATE TABLE IF NOT EXISTS public.email_providers (
  id UUID PRIMARY KEY,
  user_id UUID,
  provider_type TEXT,
  provider_name TEXT,
  email_address TEXT,
  status TEXT,
  config TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.campaign_prospects_backup_20241124 (
  id UUID PRIMARY KEY,
  campaign_id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  company_name TEXT,
  linkedin_url TEXT,
  linkedin_user_id TEXT,
  title TEXT,
  phone TEXT,
  location TEXT,
  industry TEXT,
  status TEXT,
  notes TEXT,
  personalization_data TEXT,
  n8n_execution_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  contacted_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  workspace_id UUID,
  added_by UUID,
  added_by_unipile_account TEXT,
  connection_accepted_at TIMESTAMPTZ,
  follow_up_due_at TIMESTAMPTZ,
  follow_up_sequence_index INTEGER,
  last_follow_up_at TIMESTAMPTZ,
  unipile_account_id TEXT,
  scheduled_send_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.prospect_learning_logs (
  id UUID PRIMARY KEY,
  session_id UUID,
  prospect_id TEXT,
  decision TEXT,
  reason TEXT,
  prospect_title TEXT,
  company_size TEXT,
  company_industry TEXT,
  connection_degree INTEGER,
  enrichment_score INTEGER,
  has_email BOOLEAN,
  has_phone BOOLEAN,
  learning_features TEXT,
  logged_at TIMESTAMPTZ,
  workspace_id UUID
);

CREATE TABLE IF NOT EXISTS public.sam_funnel_template_performance (
  id UUID PRIMARY KEY,
  template_id TEXT,
  template_type TEXT,
  total_executions INTEGER,
  total_prospects INTEGER,
  total_messages_sent INTEGER,
  total_responses INTEGER,
  total_positive_responses INTEGER,
  total_meetings_booked INTEGER,
  total_opt_outs INTEGER,
  avg_response_rate DECIMAL,
  avg_conversion_rate DECIMAL,
  avg_meeting_booking_rate DECIMAL,
  avg_opt_out_rate DECIMAL,
  step_performance TEXT,
  best_performing_cta TEXT,
  cta_test_confidence DECIMAL,
  best_start_day TEXT,
  optimal_timing TEXT,
  version_history TEXT,
  last_optimization_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.campaign_replies (
  id UUID PRIMARY KEY,
  campaign_id UUID,
  workspace_id UUID,
  prospect_id UUID,
  reply_text TEXT,
  platform TEXT,
  sender_email TEXT,
  sender_name TEXT,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  requires_review BOOLEAN,
  sentiment TEXT,
  status TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  ai_suggested_response TEXT,
  final_message TEXT,
  draft_generated_at TIMESTAMPTZ,
  priority TEXT,
  email_response_id UUID,
  metadata TEXT,
  campaign_message_id UUID,
  conversation_id TEXT,
  thread_id TEXT,
  reply_type TEXT,
  has_attachments BOOLEAN,
  sender_linkedin_profile TEXT,
  reply_sentiment TEXT,
  requires_action BOOLEAN,
  reply_priority TEXT,
  action_taken BOOLEAN,
  response_time_hours DECIMAL,
  is_processed BOOLEAN,
  processed_by UUID,
  intent TEXT,
  intent_confidence DECIMAL,
  intent_reasoning TEXT,
  feedback TEXT,
  feedback_reason TEXT,
  feedback_at TIMESTAMPTZ,
  feedback_by UUID,
  original_draft TEXT,
  draft_edited BOOLEAN,
  reply_channel TEXT,
  classification TEXT,
  classification_confidence DECIMAL,
  classification_metadata TEXT,
  requires_human_review BOOLEAN
);

CREATE TABLE IF NOT EXISTS public.slack_pending_actions (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  action_type TEXT,
  resource_type TEXT,
  resource_id UUID,
  channel_id TEXT,
  message_ts TEXT,
  user_id TEXT,
  action_data TEXT,
  expires_at TIMESTAMPTZ,
  status TEXT,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  current_workspace_id UUID,
  email_verified BOOLEAN,
  email_verified_at TIMESTAMPTZ,
  profile_country TEXT,
  subscription_status TEXT,
  trial_ends_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  subscription_plan TEXT,
  billing_cycle TEXT,
  profile_timezone TEXT
);

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  name TEXT,
  key_hash TEXT,
  key_prefix TEXT,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN,
  scopes JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.workspace_tiers (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  tier TEXT,
  tier_status TEXT,
  monthly_email_limit INTEGER,
  monthly_linkedin_limit INTEGER,
  daily_email_limit INTEGER,
  daily_linkedin_limit INTEGER,
  hitl_approval_required BOOLEAN,
  integration_config TEXT,
  tier_features TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  lead_search_tier TEXT,
  monthly_lead_search_quota INTEGER,
  monthly_lead_searches_used INTEGER,
  search_quota_reset_date TEXT
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY,
  user_id UUID,
  workspace_id UUID,
  session_start TIMESTAMPTZ,
  session_end TIMESTAMPTZ,
  duration_minutes INTEGER,
  pages_visited INTEGER,
  actions_performed INTEGER,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.core_funnel_executions (
  id UUID PRIMARY KEY,
  template_id UUID,
  campaign_id UUID,
  n8n_execution_id TEXT,
  n8n_workflow_id TEXT,
  status TEXT,
  current_step INTEGER,
  prospects_total INTEGER,
  prospects_processed INTEGER,
  prospects_active INTEGER,
  prospects_completed INTEGER,
  prospects_failed INTEGER,
  messages_sent INTEGER,
  responses_received INTEGER,
  meetings_booked INTEGER,
  unsubscribes INTEGER,
  started_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  estimated_completion_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  execution_variables TEXT,
  timing_overrides TEXT,
  final_stats TEXT,
  performance_summary TEXT,
  error_details TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  workspace_id UUID
);

CREATE TABLE IF NOT EXISTS public.icp_configurations (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  name TEXT,
  display_name TEXT,
  description TEXT,
  market_niche TEXT,
  industry_vertical TEXT,
  status TEXT,
  priority TEXT,
  target_profile TEXT,
  decision_makers TEXT,
  pain_points TEXT,
  buying_process TEXT,
  messaging_strategy TEXT,
  success_metrics TEXT,
  advanced_classification TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.webhook_error_logs (
  id UUID PRIMARY KEY,
  execution_id TEXT,
  workflow_id TEXT,
  event_type TEXT,
  error_message TEXT,
  error_code TEXT,
  stack_trace TEXT,
  payload_data TEXT,
  request_headers TEXT,
  resolved BOOLEAN,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  timestamp TIMESTAMPTZ,
  workspace_id UUID
);

CREATE TABLE IF NOT EXISTS public.workspace_n8n_workflows (
  id UUID PRIMARY KEY,
  workspace_id TEXT,
  user_id TEXT,
  n8n_instance_url TEXT,
  deployed_workflow_id TEXT,
  master_template_version TEXT,
  deployment_status TEXT,
  last_deployment_attempt TIMESTAMPTZ,
  deployment_error TEXT,
  workspace_config TEXT,
  channel_preferences TEXT,
  email_config TEXT,
  linkedin_config TEXT,
  reply_handling_config TEXT,
  credentials_config TEXT,
  integration_status TEXT,
  total_executions INTEGER,
  successful_executions INTEGER,
  failed_executions INTEGER,
  last_execution_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.workspaces_cancelling_soon (
  workspace_id UUID,
  workspace_name TEXT,
  subscription_status TEXT,
  subscription_cancel_at TIMESTAMPTZ,
  time_until_cancellation TEXT,
  accounts_to_delete INTEGER
);

CREATE TABLE IF NOT EXISTS public.workspace_stripe_customers (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.sam_funnel_executions (
  id UUID PRIMARY KEY,
  campaign_id UUID,
  workspace_id UUID,
  template_id TEXT,
  execution_type TEXT,
  status TEXT,
  prospects_total INTEGER,
  prospects_scheduled INTEGER,
  prospects_active INTEGER,
  prospects_completed INTEGER,
  prospects_responded INTEGER,
  start_date TIMESTAMPTZ,
  estimated_completion_date TIMESTAMPTZ,
  actual_completion_date TIMESTAMPTZ,
  schedule TEXT,
  personalization_data TEXT,
  client_messaging TEXT,
  response_rate DECIMAL,
  conversion_rate DECIMAL,
  meeting_booking_rate DECIMAL,
  opt_out_rate DECIMAL,
  cta_test_results TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.active_workspace_workflows (
  id UUID PRIMARY KEY,
  workspace_id TEXT,
  user_id TEXT,
  n8n_instance_url TEXT,
  deployed_workflow_id TEXT,
  master_template_version TEXT,
  deployment_status TEXT,
  last_deployment_attempt TIMESTAMPTZ,
  deployment_error TEXT,
  workspace_config TEXT,
  channel_preferences TEXT,
  email_config TEXT,
  linkedin_config TEXT,
  reply_handling_config TEXT,
  credentials_config TEXT,
  integration_status TEXT,
  total_executions INTEGER,
  successful_executions INTEGER,
  failed_executions INTEGER,
  last_execution_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  template_name TEXT,
  template_description TEXT
);

CREATE TABLE IF NOT EXISTS public.sam_funnel_analytics (
  id UUID PRIMARY KEY,
  execution_id UUID,
  template_id TEXT,
  step_number INTEGER,
  step_type TEXT,
  mandatory_element TEXT,
  messages_sent INTEGER,
  messages_delivered INTEGER,
  messages_read INTEGER,
  responses_received INTEGER,
  positive_responses INTEGER,
  negative_responses INTEGER,
  opt_outs INTEGER,
  cta_variation TEXT,
  cta_performance_score DECIMAL,
  avg_response_time TEXT,
  best_performing_day TEXT,
  best_performing_time TIMESTAMPTZ,
  calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  workspace_id UUID
);

CREATE TABLE IF NOT EXISTS public.workspace_inbox_agent_config (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  enabled BOOLEAN,
  categorization_enabled BOOLEAN,
  auto_categorize_new_messages BOOLEAN,
  response_suggestions_enabled BOOLEAN,
  suggest_for_categories JSONB,
  auto_tagging_enabled BOOLEAN,
  ai_model TEXT,
  categorization_instructions TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.kb_notifications (
  id UUID PRIMARY KEY,
  type TEXT,
  title TEXT,
  message TEXT,
  data TEXT,
  is_read BOOLEAN,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.campaigns_backup_20241124 (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  name TEXT,
  description TEXT,
  campaign_type TEXT,
  status TEXT,
  channel_preferences TEXT,
  linkedin_config TEXT,
  email_config TEXT,
  n8n_execution_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  launched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  type TEXT,
  target_criteria TEXT,
  execution_preferences TEXT,
  template_id UUID,
  funnel_type TEXT,
  core_template_id UUID,
  dynamic_definition_id UUID,
  n8n_workflow_id TEXT,
  funnel_configuration TEXT,
  campaign_name TEXT,
  current_step INTEGER,
  connection_message TEXT,
  alternative_message TEXT,
  follow_up_messages TEXT,
  draft_data TEXT,
  funnel_id UUID,
  target_icp TEXT,
  ab_test_variant TEXT,
  message_templates TEXT,
  created_by UUID,
  send_schedule TEXT,
  next_execution_time TIMESTAMPTZ,
  auto_execute BOOLEAN,
  timezone TEXT,
  working_hours_start INTEGER,
  working_hours_end INTEGER,
  skip_weekends BOOLEAN,
  skip_holidays BOOLEAN,
  country_code TEXT,
  flow_settings TEXT,
  metadata TEXT,
  linkedin_account_id UUID,
  n8n_webhook_url TEXT,
  schedule_settings TEXT,
  message_sequence TEXT
);

CREATE TABLE IF NOT EXISTS public.workspace_schedule_settings (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  timezone TEXT,
  weekly_schedule TEXT,
  inactive_dates TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.dynamic_funnel_steps (
  id UUID PRIMARY KEY,
  funnel_id UUID,
  step_order INTEGER,
  step_name TEXT,
  step_type TEXT,
  trigger_condition TEXT,
  timing_config TEXT,
  message_template TEXT,
  message_variables TEXT,
  channel_config TEXT,
  success_action TEXT,
  failure_action TEXT,
  adaptation_triggers TEXT,
  execution_count INTEGER,
  success_rate DECIMAL,
  avg_response_time TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  workspace_id UUID
);

CREATE TABLE IF NOT EXISTS public.agent_fix_proposals (
  id UUID PRIMARY KEY,
  health_check_id UUID,
  issue_type TEXT,
  issue_description TEXT,
  file_path TEXT,
  proposed_fix TEXT,
  confidence_score DECIMAL,
  status TEXT,
  applied_at TIMESTAMPTZ,
  applied_by UUID,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.dpa_update_notifications (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  notification_type TEXT,
  subject TEXT,
  message TEXT,
  sent_at TIMESTAMPTZ,
  acknowledged BOOLEAN,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID
);

CREATE TABLE IF NOT EXISTS public.prospect_search_jobs (
  id UUID PRIMARY KEY,
  user_id UUID,
  workspace_id UUID,
  search_criteria TEXT,
  search_type TEXT,
  search_source TEXT,
  status TEXT,
  progress_current INTEGER,
  progress_total INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_results INTEGER,
  error_message TEXT,
  retry_count INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.linkedin_messages (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  campaign_id UUID,
  prospect_id UUID,
  linkedin_account_id UUID,
  direction TEXT,
  message_type TEXT,
  subject TEXT,
  content TEXT,
  unipile_message_id TEXT,
  unipile_chat_id TEXT,
  linkedin_conversation_id TEXT,
  sender_linkedin_url TEXT,
  sender_name TEXT,
  sender_linkedin_id TEXT,
  recipient_linkedin_url TEXT,
  recipient_name TEXT,
  recipient_linkedin_id TEXT,
  status TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER,
  metadata TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.campaign_prospect_execution_state (
  id UUID PRIMARY KEY,
  campaign_id UUID,
  prospect_id UUID,
  current_step INTEGER,
  status TEXT,
  completed_steps JSONB,
  failed_steps JSONB,
  skipped_steps JSONB,
  linkedin_state TEXT,
  email_state TEXT,
  whatsapp_state TEXT,
  waiting_for_trigger TEXT,
  trigger_check_count INTEGER,
  trigger_max_checks INTEGER,
  next_check_at TIMESTAMPTZ,
  n8n_execution_id TEXT,
  last_executed_at TIMESTAMPTZ,
  next_execution_at TIMESTAMPTZ,
  last_error TEXT,
  error_count INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.workflow_deployment_history (
  id UUID PRIMARY KEY,
  workspace_n8n_workflow_id UUID,
  workspace_id TEXT,
  deployment_type TEXT,
  deployment_trigger TEXT,
  old_template_version TEXT,
  new_template_version TEXT,
  template_changes TEXT,
  configuration_changes TEXT,
  status TEXT,
  error_message TEXT,
  n8n_execution_id TEXT,
  deployed_workflow_id TEXT,
  deployment_duration_seconds INTEGER,
  initiated_by TEXT,
  deployment_notes TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.linkedin_author_relationships (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  author_profile_id TEXT,
  author_name TEXT,
  author_headline TEXT,
  author_company TEXT,
  total_comments_made INTEGER,
  total_replies_received INTEGER,
  total_likes_received INTEGER,
  author_responded_count INTEGER,
  avg_performance_score DECIMAL,
  best_performing_topic TEXT,
  first_interaction_at TIMESTAMPTZ,
  last_interaction_at TIMESTAMPTZ,
  last_comment_at TIMESTAMPTZ,
  relationship_strength TEXT,
  topics_discussed TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.sam_icp_knowledge_entries (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  user_id UUID,
  discovery_session_id UUID,
  question_id TEXT,
  question_text TEXT,
  answer_text TEXT,
  answer_structured TEXT,
  stage TEXT,
  category TEXT,
  confidence_score DECIMAL,
  is_shallow BOOLEAN,
  needs_clarification BOOLEAN,
  clarification_notes TEXT,
  embedding TEXT,
  indexed_for_rag BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  source_attachment_id UUID
);

