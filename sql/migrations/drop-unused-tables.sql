-- Database Cleanup: Drop 76 Unused Tables
-- Generated: 2025-10-08
-- Reason: Tables defined in schemas but NEVER referenced in codebase
-- Impact: ~55% database size reduction
--
-- IMPORTANT: Run this in STAGING first, verify no issues for 24 hours,
-- then apply to production.
--
-- Backup command before running:
-- pg_dump -h HOST -U USER -d DATABASE -t "table_pattern" > backup.sql

-- ============================================================================
-- SECTION 1: Campaign & Messaging Tables (14 tables)
-- ============================================================================

DROP TABLE IF EXISTS campaign_intelligence_results CASCADE;
DROP TABLE IF EXISTS campaign_messages CASCADE;
DROP TABLE IF EXISTS campaign_replies CASCADE;
DROP TABLE IF EXISTS campaign_reply_actions CASCADE;
DROP TABLE IF EXISTS campaign_response_metrics CASCADE;
DROP TABLE IF EXISTS campaign_status_updates CASCADE;
DROP TABLE IF EXISTS message_responses CASCADE;
DROP TABLE IF EXISTS message_sends CASCADE;
DROP TABLE IF EXISTS message_templates CASCADE;
DROP TABLE IF EXISTS email_responses CASCADE;
DROP TABLE IF EXISTS linkedin_responses CASCADE;
DROP TABLE IF EXISTS meeting_requests CASCADE;
DROP TABLE IF EXISTS scheduled_follow_ups CASCADE;
DROP TABLE IF EXISTS nurture_sequences CASCADE;

-- ============================================================================
-- SECTION 2: Funnel System Tables (10 tables) - ENTIRE SYSTEM UNUSED
-- ============================================================================

DROP TABLE IF EXISTS core_funnel_executions CASCADE;
DROP TABLE IF EXISTS core_funnel_templates CASCADE;
DROP TABLE IF EXISTS dynamic_funnel_definitions CASCADE;
DROP TABLE IF EXISTS dynamic_funnel_executions CASCADE;
DROP TABLE IF EXISTS dynamic_funnel_steps CASCADE;
DROP TABLE IF EXISTS funnel_adaptation_logs CASCADE;
DROP TABLE IF EXISTS funnel_performance_metrics CASCADE;
DROP TABLE IF EXISTS funnel_step_logs CASCADE;
DROP TABLE IF EXISTS sam_funnel_analytics CASCADE;
DROP TABLE IF EXISTS sam_funnel_template_performance CASCADE;

-- ============================================================================
-- SECTION 3: Approval System Tables (6 tables)
-- ============================================================================

DROP TABLE IF EXISTS approval_notification_log CASCADE;
DROP TABLE IF EXISTS prospect_approval_data CASCADE;
DROP TABLE IF EXISTS prospect_approval_decisions CASCADE;
DROP TABLE IF EXISTS prospect_learning_logs CASCADE;
DROP TABLE IF EXISTS reply_approval_decisions CASCADE;
DROP TABLE IF EXISTS reply_learning_data CASCADE;

-- ============================================================================
-- SECTION 4: Multi-Provider Integration Tables (6 tables) - NEVER USED
-- Note: Superseded by user_unipile_accounts
-- ============================================================================

DROP TABLE IF EXISTS user_provider_accounts CASCADE;
DROP TABLE IF EXISTS synchronized_calendar_events CASCADE;
DROP TABLE IF EXISTS synchronized_contacts CASCADE;
DROP TABLE IF EXISTS synchronized_emails CASCADE;
DROP TABLE IF EXISTS synchronized_messages CASCADE;
DROP TABLE IF EXISTS provider_sync_status CASCADE;

-- ============================================================================
-- SECTION 5: Workspace & Admin Tables (8 tables)
-- ============================================================================

DROP TABLE IF EXISTS admin_workspace_sessions CASCADE;
DROP TABLE IF EXISTS workspace_account_sessions CASCADE;
DROP TABLE IF EXISTS workspace_permissions CASCADE;
DROP TABLE IF EXISTS workspace_usage_analytics CASCADE;
DROP TABLE IF EXISTS workspace_workflow_credentials CASCADE;
DROP TABLE IF EXISTS workflow_deployment_history CASCADE;
DROP TABLE IF EXISTS workflow_templates CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;

-- ============================================================================
-- SECTION 6: Monitoring & Logging Tables (6 tables)
-- ============================================================================

DROP TABLE IF EXISTS mcp_account_status CASCADE;
DROP TABLE IF EXISTS mcp_health_checks CASCADE;
DROP TABLE IF EXISTS mcp_monitoring_alerts CASCADE;
DROP TABLE IF EXISTS real_time_notifications CASCADE;
DROP TABLE IF EXISTS sales_notifications CASCADE;
DROP TABLE IF EXISTS webhook_error_logs CASCADE;

-- ============================================================================
-- SECTION 7: Prospect Management Tables (5 tables)
-- ============================================================================

DROP TABLE IF EXISTS prospect_assignment_rules CASCADE;
DROP TABLE IF EXISTS prospect_contact_history CASCADE;
DROP TABLE IF EXISTS prospect_exports CASCADE;
DROP TABLE IF EXISTS prospect_scores CASCADE;
DROP TABLE IF EXISTS prospect_segments CASCADE;

-- ============================================================================
-- SECTION 8: Configuration Tables (3 tables)
-- ============================================================================

DROP TABLE IF EXISTS ai_model_configurations CASCADE;
DROP TABLE IF EXISTS email_service_config CASCADE;
DROP TABLE IF EXISTS global_settings CASCADE;

-- ============================================================================
-- SECTION 9: Integration Tables (4 tables)
-- ============================================================================

DROP TABLE IF EXISTS activecampaign_contacts CASCADE;
DROP TABLE IF EXISTS activecampaign_tags CASCADE;
DROP TABLE IF EXISTS stripe_webhook_events CASCADE;
DROP TABLE IF EXISTS twilio_message_log CASCADE;

-- ============================================================================
-- SECTION 10: Workspace Billing Tables (4 tables)
-- ============================================================================

DROP TABLE IF EXISTS billing_invoices CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP TABLE IF EXISTS workspace_subscriptions CASCADE;

-- ============================================================================
-- SECTION 11: Analytics Tables (3 tables)
-- ============================================================================

DROP TABLE IF EXISTS campaign_analytics CASCADE;
DROP TABLE IF EXISTS engagement_metrics CASCADE;
DROP TABLE IF EXISTS workspace_analytics CASCADE;

-- ============================================================================
-- SECTION 12: SAM Funnel Message Tables (3 tables)
-- ============================================================================

DROP TABLE IF EXISTS sam_funnel_executions CASCADE;
DROP TABLE IF EXISTS sam_funnel_messages CASCADE;
DROP TABLE IF EXISTS sam_funnel_responses CASCADE;

-- ============================================================================
-- SECTION 13: Training & Circuit Breaker Tables (4 tables)
-- ============================================================================

DROP TABLE IF EXISTS circuit_breaker_events CASCADE;
DROP TABLE IF EXISTS conversation_training_data CASCADE;
DROP TABLE IF EXISTS model_training_feedback CASCADE;
DROP TABLE IF EXISTS training_analytics CASCADE;

-- ============================================================================
-- Verification Query
-- ============================================================================

-- Run this after dropping tables to verify they're gone:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('campaign_intelligence_results', 'campaign_messages', ...);

-- ============================================================================
-- Space Reclamation
-- ============================================================================

-- After dropping tables, reclaim disk space:
-- VACUUM FULL ANALYZE;
-- WARNING: VACUUM FULL locks tables and can take time on large databases
