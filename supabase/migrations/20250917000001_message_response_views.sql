-- Message and Response Tracking Views
-- Enhanced views for comprehensive message/response monitoring across all platforms
-- Created: 2025-09-17

-- 1. Unified Message Overview - All outbound messages across campaigns and platforms
CREATE OR REPLACE VIEW unified_message_overview AS
SELECT 
  cm.id,
  cm.campaign_id,
  c.name as campaign_name,
  c.campaign_type,
  cm.platform,
  cm.recipient_name,
  cm.recipient_email,
  cm.recipient_linkedin_profile,
  cm.subject_line,
  cm.message_content,
  cm.sent_at,
  cm.sender_account,
  cm.delivery_status,
  cm.reply_count,
  cm.last_reply_at,
  
  -- Response metrics
  CASE 
    WHEN cm.reply_count > 0 THEN 'responded'
    WHEN cm.sent_at < NOW() - INTERVAL '7 days' THEN 'no_response'
    ELSE 'pending'
  END as response_status,
  
  -- Time since sent
  EXTRACT(EPOCH FROM (NOW() - cm.sent_at)) / 3600.0 as hours_since_sent,
  
  -- Workspace info
  cm.workspace_id,
  w.name as workspace_name,
  w.slug as workspace_slug
  
FROM campaign_messages cm
JOIN campaigns c ON cm.campaign_id = c.id
JOIN workspaces w ON cm.workspace_id = w.id
ORDER BY cm.sent_at DESC;

-- 2. Response Analytics Dashboard - Key metrics for message performance
CREATE OR REPLACE VIEW response_analytics_dashboard AS
SELECT 
  cm.workspace_id,
  w.name as workspace_name,
  cm.platform,
  c.campaign_type,
  
  -- Message volume
  COUNT(DISTINCT cm.id) as total_messages_sent,
  COUNT(DISTINCT CASE WHEN cm.sent_at >= NOW() - INTERVAL '7 days' THEN cm.id END) as messages_last_7_days,
  COUNT(DISTINCT CASE WHEN cm.sent_at >= NOW() - INTERVAL '30 days' THEN cm.id END) as messages_last_30_days,
  
  -- Response rates
  COUNT(DISTINCT CASE WHEN cm.reply_count > 0 THEN cm.id END) as messages_with_replies,
  ROUND(
    (COUNT(DISTINCT CASE WHEN cm.reply_count > 0 THEN cm.id END)::decimal / 
     NULLIF(COUNT(DISTINCT cm.id), 0) * 100), 2
  ) as overall_response_rate_percent,
  
  -- Recent response rates (last 30 days)
  ROUND(
    (COUNT(DISTINCT CASE WHEN cm.reply_count > 0 AND cm.sent_at >= NOW() - INTERVAL '30 days' THEN cm.id END)::decimal / 
     NULLIF(COUNT(DISTINCT CASE WHEN cm.sent_at >= NOW() - INTERVAL '30 days' THEN cm.id END), 0) * 100), 2
  ) as recent_response_rate_percent,
  
  -- Average response times
  AVG(cr.response_time_hours) as avg_response_time_hours,
  
  -- Reply sentiment analysis
  COUNT(DISTINCT CASE WHEN cr.reply_sentiment = 'positive' THEN cr.id END) as positive_replies,
  COUNT(DISTINCT CASE WHEN cr.reply_sentiment = 'interested' THEN cr.id END) as interested_replies,
  COUNT(DISTINCT CASE WHEN cr.reply_sentiment = 'negative' THEN cr.id END) as negative_replies,
  
  -- Engagement quality
  COUNT(DISTINCT CASE WHEN cr.requires_action = true THEN cr.id END) as actionable_replies,
  COUNT(DISTINCT CASE WHEN cr.is_processed = false AND cr.requires_action = true THEN cr.id END) as pending_actions

FROM campaign_messages cm
JOIN campaigns c ON cm.campaign_id = c.id
JOIN workspaces w ON cm.workspace_id = w.id
LEFT JOIN campaign_replies cr ON cm.id = cr.campaign_message_id
GROUP BY cm.workspace_id, w.name, cm.platform, c.campaign_type
ORDER BY total_messages_sent DESC;

-- 3. Recent Activity Feed - Latest messages and responses for monitoring
CREATE OR REPLACE VIEW recent_activity_feed AS
SELECT 
  'message_sent' as activity_type,
  cm.id as activity_id,
  cm.workspace_id,
  w.name as workspace_name,
  cm.platform,
  c.name as campaign_name,
  cm.recipient_name as contact_name,
  cm.recipient_email,
  cm.subject_line as summary,
  cm.message_content as content,
  cm.sent_at as activity_timestamp,
  'outbound' as direction,
  cm.delivery_status as status
FROM campaign_messages cm
JOIN campaigns c ON cm.campaign_id = c.id
JOIN workspaces w ON cm.workspace_id = w.id

UNION ALL

SELECT 
  'reply_received' as activity_type,
  cr.id as activity_id,
  cr.workspace_id,
  w.name as workspace_name,
  cr.platform,
  c.name as campaign_name,
  cr.sender_name as contact_name,
  cr.sender_email,
  CASE 
    WHEN LENGTH(cr.reply_content) > 100 
    THEN LEFT(cr.reply_content, 100) || '...'
    ELSE cr.reply_content
  END as summary,
  cr.reply_content as content,
  cr.received_at as activity_timestamp,
  'inbound' as direction,
  CASE 
    WHEN cr.is_processed THEN 'processed'
    WHEN cr.requires_action THEN 'pending_action'
    ELSE 'acknowledged'
  END as status
FROM campaign_replies cr
JOIN campaigns c ON cr.campaign_id = c.id
JOIN workspaces w ON cr.workspace_id = w.id

ORDER BY activity_timestamp DESC;

-- 4. Platform Performance Comparison - Compare LinkedIn vs Email performance
CREATE OR REPLACE VIEW platform_performance_comparison AS
SELECT 
  platform,
  
  -- Volume metrics
  COUNT(DISTINCT cm.id) as total_messages,
  COUNT(DISTINCT cm.campaign_id) as campaigns_used,
  COUNT(DISTINCT cm.workspace_id) as workspaces_active,
  
  -- Response metrics
  COUNT(DISTINCT CASE WHEN cm.reply_count > 0 THEN cm.id END) as messages_with_responses,
  ROUND(
    (COUNT(DISTINCT CASE WHEN cm.reply_count > 0 THEN cm.id END)::decimal / 
     NULLIF(COUNT(DISTINCT cm.id), 0) * 100), 2
  ) as response_rate_percent,
  
  -- Timing metrics
  AVG(cr.response_time_hours) as avg_response_time_hours,
  MIN(cr.response_time_hours) as fastest_response_hours,
  MAX(cr.response_time_hours) as slowest_response_hours,
  
  -- Quality metrics
  ROUND(
    (COUNT(DISTINCT CASE WHEN cr.reply_sentiment IN ('positive', 'interested') THEN cr.id END)::decimal / 
     NULLIF(COUNT(DISTINCT cr.id), 0) * 100), 2
  ) as positive_sentiment_percent,
  
  -- Delivery success
  ROUND(
    (COUNT(DISTINCT CASE WHEN cm.delivery_status IN ('sent', 'delivered', 'read') THEN cm.id END)::decimal / 
     NULLIF(COUNT(DISTINCT cm.id), 0) * 100), 2
  ) as delivery_success_percent,
  
  -- Recent activity (last 30 days)
  COUNT(DISTINCT CASE WHEN cm.sent_at >= NOW() - INTERVAL '30 days' THEN cm.id END) as recent_messages,
  COUNT(DISTINCT CASE WHEN cr.received_at >= NOW() - INTERVAL '30 days' THEN cr.id END) as recent_replies
  
FROM campaign_messages cm
LEFT JOIN campaign_replies cr ON cm.id = cr.campaign_message_id
GROUP BY platform
ORDER BY total_messages DESC;

-- 5. Conversation Thread View - Follow message threads with replies
CREATE OR REPLACE VIEW conversation_threads AS
SELECT 
  cm.conversation_id,
  cm.workspace_id,
  w.name as workspace_name,
  cm.platform,
  c.name as campaign_name,
  
  -- Contact information
  COALESCE(cm.recipient_name, cr.sender_name) as contact_name,
  COALESCE(cm.recipient_email, cr.sender_email) as contact_email,
  COALESCE(cm.recipient_linkedin_profile, cr.sender_linkedin_profile) as contact_linkedin,
  
  -- Thread summary
  cm.subject_line,
  COUNT(DISTINCT cm.id) as outbound_messages,
  COUNT(DISTINCT cr.id) as inbound_replies,
  MIN(cm.sent_at) as thread_started_at,
  MAX(GREATEST(cm.sent_at, COALESCE(cr.received_at, cm.sent_at))) as last_activity_at,
  
  -- Thread status
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN cr.requires_action = true AND cr.is_processed = false THEN cr.id END) > 0 THEN 'needs_attention'
    WHEN MAX(cr.received_at) > MAX(cm.sent_at) THEN 'awaiting_response'
    WHEN MAX(cm.sent_at) > MAX(COALESCE(cr.received_at, '1900-01-01'::timestamptz)) THEN 'sent_no_reply'
    ELSE 'conversation_complete'
  END as thread_status,
  
  -- Engagement quality
  AVG(cr.response_time_hours) as avg_response_time,
  STRING_AGG(DISTINCT cr.reply_sentiment, ', ') as sentiment_summary,
  COUNT(DISTINCT CASE WHEN cr.requires_action = true THEN cr.id END) as actionable_replies
  
FROM campaign_messages cm
JOIN campaigns c ON cm.campaign_id = c.id
JOIN workspaces w ON cm.workspace_id = w.id
LEFT JOIN campaign_replies cr ON cm.conversation_id = cr.conversation_id AND cm.platform = cr.platform
WHERE cm.conversation_id IS NOT NULL
GROUP BY cm.conversation_id, cm.workspace_id, w.name, cm.platform, c.name, cm.subject_line,
         COALESCE(cm.recipient_name, cr.sender_name), 
         COALESCE(cm.recipient_email, cr.sender_email),
         COALESCE(cm.recipient_linkedin_profile, cr.sender_linkedin_profile)
ORDER BY last_activity_at DESC;

-- 6. Daily Message Volume Trends - Track sending patterns over time
CREATE OR REPLACE VIEW daily_message_trends AS
SELECT 
  DATE(cm.sent_at) as message_date,
  cm.workspace_id,
  w.name as workspace_name,
  cm.platform,
  
  -- Daily volume
  COUNT(DISTINCT cm.id) as messages_sent,
  COUNT(DISTINCT cm.recipient_email) as unique_recipients_emailed,
  COUNT(DISTINCT cm.recipient_linkedin_profile) as unique_linkedin_contacts,
  
  -- Campaign activity
  COUNT(DISTINCT cm.campaign_id) as active_campaigns,
  STRING_AGG(DISTINCT c.name, ', ') as campaign_names,
  
  -- Delivery success
  COUNT(DISTINCT CASE WHEN cm.delivery_status IN ('sent', 'delivered', 'read') THEN cm.id END) as successful_deliveries,
  ROUND(
    (COUNT(DISTINCT CASE WHEN cm.delivery_status IN ('sent', 'delivered', 'read') THEN cm.id END)::decimal / 
     NULLIF(COUNT(DISTINCT cm.id), 0) * 100), 2
  ) as delivery_success_rate,
  
  -- Daily response tracking (replies received same day)
  COUNT(DISTINCT CASE WHEN cr.received_at::date = cm.sent_at::date THEN cr.id END) as same_day_replies
  
FROM campaign_messages cm
JOIN campaigns c ON cm.campaign_id = c.id
JOIN workspaces w ON cm.workspace_id = w.id
LEFT JOIN campaign_replies cr ON cm.id = cr.campaign_message_id
WHERE cm.sent_at >= NOW() - INTERVAL '90 days' -- Last 90 days
GROUP BY DATE(cm.sent_at), cm.workspace_id, w.name, cm.platform
ORDER BY message_date DESC, workspace_name, platform;

-- Add comments for documentation
COMMENT ON VIEW unified_message_overview IS 'Complete overview of all outbound messages with response status and timing';
COMMENT ON VIEW response_analytics_dashboard IS 'Key performance metrics for message campaigns and response rates';
COMMENT ON VIEW recent_activity_feed IS 'Real-time activity feed showing latest messages sent and replies received';
COMMENT ON VIEW platform_performance_comparison IS 'Comparative analysis of LinkedIn vs Email performance metrics';
COMMENT ON VIEW conversation_threads IS 'Threaded view of conversations showing complete message exchanges';
COMMENT ON VIEW daily_message_trends IS 'Daily trends and patterns in message volume and delivery success';

-- Grant access to authenticated users (follows existing RLS patterns)
-- Views inherit RLS from underlying tables, so no additional policies needed