-- Add workspace_id to campaign_performance_summary view
-- This allows filtering analytics by workspace

DROP VIEW IF EXISTS campaign_performance_summary;

CREATE OR REPLACE VIEW campaign_performance_summary AS
SELECT
    c.id as campaign_id,
    c.workspace_id,
    c.name as campaign_name,
    c.status,
    c.campaign_type,
    c.ab_test_variant,
    c.launched_at,
    c.created_by,
    COUNT(DISTINCT cm.id) as messages_sent,
    COUNT(DISTINCT cr.id) as replies_received,
    CASE
        WHEN COUNT(DISTINCT cm.id) > 0
        THEN ROUND((COUNT(DISTINCT cr.id)::decimal / COUNT(DISTINCT cm.id) * 100), 2)
        ELSE 0
    END as reply_rate_percent,
    AVG(cr.response_time_hours) as avg_response_time_hours,
    COUNT(DISTINCT CASE WHEN cr.reply_sentiment = 'positive' THEN cr.id END) as positive_replies,
    COUNT(DISTINCT CASE WHEN cr.reply_sentiment = 'interested' THEN cr.id END) as interested_replies,
    COUNT(DISTINCT CASE WHEN cr.requires_action = true AND cr.is_processed = false THEN cr.id END) as pending_replies,
    -- Add meetings tracking (placeholder for now, can be enhanced later)
    0 as meetings_booked
FROM campaigns c
LEFT JOIN campaign_messages cm ON c.id = cm.campaign_id
LEFT JOIN campaign_replies cr ON cm.id = cr.campaign_message_id
GROUP BY c.id, c.workspace_id, c.name, c.status, c.campaign_type, c.ab_test_variant, c.launched_at, c.created_by;

COMMENT ON VIEW campaign_performance_summary IS 'Campaign performance metrics with workspace_id for filtering';
