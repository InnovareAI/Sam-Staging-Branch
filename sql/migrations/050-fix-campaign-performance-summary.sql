-- Migration: Fix campaign_performance_summary view to count actual prospect activity
-- Date: December 15, 2025
-- Issue: View was counting campaign_messages table (empty) instead of campaign_prospects status

-- Must DROP first because column types are changing
DROP VIEW IF EXISTS campaign_performance_summary CASCADE;

-- Recreate the view to count from campaign_prospects
CREATE VIEW campaign_performance_summary AS
SELECT
    c.id as campaign_id,
    c.workspace_id,
    c.name as campaign_name,
    c.status,
    c.campaign_type,
    c.ab_test_variant,
    c.launched_at,
    c.created_by,
    -- Total prospects in campaign
    COUNT(DISTINCT cp.id) as total_prospects,
    -- Count prospects with connection request sent as "messages sent"
    COUNT(DISTINCT CASE
        WHEN cp.status IN ('connection_request_sent', 'connected', 'replied', 'follow_up_sent', 'follow_up_2_sent', 'follow_up_3_sent')
        THEN cp.id
    END) as messages_sent,
    -- Count prospects with replied status
    COUNT(DISTINCT CASE WHEN cp.status = 'replied' THEN cp.id END) as replies_received,
    -- Calculate reply rate
    CASE
        WHEN COUNT(DISTINCT CASE
            WHEN cp.status IN ('connection_request_sent', 'connected', 'replied', 'follow_up_sent', 'follow_up_2_sent', 'follow_up_3_sent')
            THEN cp.id
        END) > 0
        THEN ROUND(
            (COUNT(DISTINCT CASE WHEN cp.status = 'replied' THEN cp.id END)::decimal /
             COUNT(DISTINCT CASE
                WHEN cp.status IN ('connection_request_sent', 'connected', 'replied', 'follow_up_sent', 'follow_up_2_sent', 'follow_up_3_sent')
                THEN cp.id
             END) * 100), 2)
        ELSE 0
    END as reply_rate_percent,
    -- Placeholder for avg response time (needs campaign_replies table data)
    NULL::decimal as avg_response_time_hours,
    -- Count positive/interested replies (from campaign_replies if exists, otherwise 0)
    COALESCE((
        SELECT COUNT(DISTINCT cr.id)
        FROM campaign_replies cr
        WHERE cr.campaign_id = c.id AND cr.reply_sentiment = 'positive'
    ), 0) as positive_replies,
    COALESCE((
        SELECT COUNT(DISTINCT cr.id)
        FROM campaign_replies cr
        WHERE cr.campaign_id = c.id AND cr.reply_sentiment = 'interested'
    ), 0) as interested_replies,
    -- Pending replies that need action
    COALESCE((
        SELECT COUNT(DISTINCT cr.id)
        FROM campaign_replies cr
        WHERE cr.campaign_id = c.id AND cr.requires_action = true AND cr.is_processed = false
    ), 0) as pending_replies,
    -- Meetings booked (placeholder - would need meetings table)
    0 as meetings_booked
FROM campaigns c
LEFT JOIN campaign_prospects cp ON c.id = cp.campaign_id
GROUP BY c.id, c.workspace_id, c.name, c.status, c.campaign_type, c.ab_test_variant, c.launched_at, c.created_by;

-- Grant access
GRANT SELECT ON campaign_performance_summary TO authenticated;
GRANT SELECT ON campaign_performance_summary TO service_role;
