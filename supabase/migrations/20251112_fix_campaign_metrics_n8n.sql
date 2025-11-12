-- Fix campaign_performance_summary to use campaign_prospects (N8N updates this table)
-- Previously used campaign_messages which N8N doesn't populate
-- Date: 2025-11-12
-- Issue: Campaign metrics showing 0 despite N8N updating prospect statuses

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
    -- Messages sent = prospects contacted (status: connection_requested or further)
    COUNT(DISTINCT CASE
        WHEN cp.status IN ('connection_requested', 'connected', 'replied_fu1', 'replied_fu2', 'replied_fu3', 'replied_fu4', 'replied_gb', 'completed')
        THEN cp.id
    END) as messages_sent,
    -- Replies = prospects who replied (any replied_* status)
    COUNT(DISTINCT CASE
        WHEN cp.status LIKE 'replied_%'
        THEN cp.id
    END) as replies_received,
    -- Reply rate percentage
    CASE
        WHEN COUNT(DISTINCT CASE
            WHEN cp.status IN ('connection_requested', 'connected', 'replied_fu1', 'replied_fu2', 'replied_fu3', 'replied_fu4', 'replied_gb', 'completed')
            THEN cp.id
        END) > 0
        THEN ROUND((COUNT(DISTINCT CASE
            WHEN cp.status LIKE 'replied_%'
            THEN cp.id
        END)::decimal / COUNT(DISTINCT CASE
            WHEN cp.status IN ('connection_requested', 'connected', 'replied_fu1', 'replied_fu2', 'replied_fu3', 'replied_fu4', 'replied_fu5', 'replied_gb', 'completed')
            THEN cp.id
        END) * 100), 2)
        ELSE 0
    END as reply_rate_percent,
    -- Avg response time (calculated from contacted_at to updated_at for replied prospects)
    AVG(CASE
        WHEN cp.status LIKE 'replied_%' AND cp.contacted_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (cp.updated_at::timestamp - cp.contacted_at::timestamp)) / 3600
    END) as avg_response_time_hours,
    -- Sentiment tracking (placeholder - can be enhanced with AI sentiment analysis)
    0 as positive_replies,
    0 as interested_replies,
    -- Pending replies (prospects who replied but not processed)
    COUNT(DISTINCT CASE
        WHEN cp.status LIKE 'replied_%'
        THEN cp.id
    END) as pending_replies,
    0 as meetings_booked
FROM campaigns c
LEFT JOIN campaign_prospects cp ON c.id = cp.campaign_id
GROUP BY c.id, c.workspace_id, c.name, c.status, c.campaign_type, c.ab_test_variant, c.launched_at, c.created_by;

COMMENT ON VIEW campaign_performance_summary IS 'Campaign metrics from campaign_prospects table (updated by N8N workflow)';

-- Grant permissions
GRANT SELECT ON campaign_performance_summary TO authenticated;
GRANT SELECT ON campaign_performance_summary TO anon;
