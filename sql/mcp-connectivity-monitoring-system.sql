-- ULTRAHARD: Lightning-fast MCP monitoring system deployment
-- Real-time LinkedIn account health tracking for Sam AI

-- MCP Health Monitoring Tables
CREATE TABLE IF NOT EXISTS mcp_health_checks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    check_timestamp TIMESTAMPTZ DEFAULT NOW(),
    check_type TEXT NOT NULL, -- 'accounts', 'messages', 'emails'
    mcp_tool_name TEXT NOT NULL,
    status TEXT NOT NULL, -- 'success', 'failure', 'partial'
    response_time_ms INTEGER,
    accounts_found INTEGER DEFAULT 0,
    linkedin_accounts_ok INTEGER DEFAULT 0,
    linkedin_accounts_error INTEGER DEFAULT 0,
    connectivity_score DECIMAL(3,2), -- 0.00 to 1.00
    error_details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual Account Status Tracking
CREATE TABLE IF NOT EXISTS mcp_account_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    unipile_account_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT DEFAULT 'LINKEDIN',
    current_status TEXT NOT NULL, -- 'OK', 'ERROR', 'CREDENTIALS', 'TIMEOUT'
    last_checked TIMESTAMPTZ DEFAULT NOW(),
    success_rate DECIMAL(5,2) DEFAULT 100.00,
    average_response_time_ms INTEGER,
    consecutive_failures INTEGER DEFAULT 0,
    last_error_message TEXT,
    needs_attention BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(unipile_account_id)
);

-- Alert System for Proactive Monitoring
CREATE TABLE IF NOT EXISTS mcp_monitoring_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alert_type TEXT NOT NULL, -- 'connectivity_loss', 'performance_degraded', 'credentials_expired'
    severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    affected_accounts TEXT[], -- Array of account IDs
    status TEXT DEFAULT 'active', -- 'active', 'acknowledged', 'resolved'
    workspace_id UUID, -- Optional workspace filtering
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mcp_health_checks_timestamp ON mcp_health_checks(check_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_account_status_status ON mcp_account_status(current_status);
CREATE INDEX IF NOT EXISTS idx_mcp_account_status_last_checked ON mcp_account_status(last_checked DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_alerts_status ON mcp_monitoring_alerts(status, created_at DESC);

-- Function: Update account status with smart logic
CREATE OR REPLACE FUNCTION update_mcp_account_status(
    p_account_id TEXT,
    p_account_name TEXT,
    p_status TEXT,
    p_response_time INTEGER DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    current_failures INTEGER := 0;
BEGIN
    -- Get current consecutive failures
    SELECT consecutive_failures INTO current_failures
    FROM mcp_account_status 
    WHERE unipile_account_id = p_account_id;
    
    -- Calculate new consecutive failures
    IF p_status = 'OK' THEN
        current_failures := 0;
    ELSE
        current_failures := COALESCE(current_failures, 0) + 1;
    END IF;
    
    -- Upsert account status
    INSERT INTO mcp_account_status (
        unipile_account_id, 
        account_name, 
        current_status, 
        consecutive_failures,
        average_response_time_ms,
        needs_attention,
        last_checked,
        updated_at
    ) VALUES (
        p_account_id,
        p_account_name,
        p_status,
        current_failures,
        p_response_time,
        current_failures >= 3 OR p_status IN ('CREDENTIALS', 'TIMEOUT'),
        NOW(),
        NOW()
    )
    ON CONFLICT (unipile_account_id) 
    DO UPDATE SET
        account_name = EXCLUDED.account_name,
        current_status = EXCLUDED.current_status,
        consecutive_failures = EXCLUDED.consecutive_failures,
        average_response_time_ms = EXCLUDED.average_response_time_ms,
        needs_attention = EXCLUDED.needs_attention,
        last_checked = EXCLUDED.last_checked,
        updated_at = EXCLUDED.updated_at;
        
    -- Auto-generate alerts for critical issues
    IF current_failures >= 5 THEN
        INSERT INTO mcp_monitoring_alerts (
            alert_type,
            severity,
            title,
            message,
            affected_accounts
        ) VALUES (
            'connectivity_loss',
            'critical',
            'LinkedIn Account Connection Failed',
            'Account "' || p_account_name || '" has failed ' || current_failures || ' consecutive health checks',
            ARRAY[p_account_id]
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: Get monitoring summary for dashboard
CREATE OR REPLACE FUNCTION get_mcp_monitoring_summary()
RETURNS TABLE (
    overall_status TEXT,
    healthy_accounts INTEGER,
    total_accounts INTEGER,
    connectivity_percentage DECIMAL(5,2),
    active_alerts INTEGER,
    last_check_time TIMESTAMPTZ,
    needs_immediate_attention BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN COALESCE(ok_accounts.count, 0)::DECIMAL / GREATEST(total.count, 1) >= 0.9 THEN 'excellent'
            WHEN COALESCE(ok_accounts.count, 0)::DECIMAL / GREATEST(total.count, 1) >= 0.8 THEN 'good'  
            WHEN COALESCE(ok_accounts.count, 0)::DECIMAL / GREATEST(total.count, 1) >= 0.6 THEN 'warning'
            ELSE 'critical'
        END as overall_status,
        
        COALESCE(ok_accounts.count, 0) as healthy_accounts,
        COALESCE(total.count, 0) as total_accounts,
        ROUND(COALESCE(ok_accounts.count, 0)::DECIMAL / GREATEST(total.count, 1) * 100, 2) as connectivity_percentage,
        COALESCE(alerts.count, 0) as active_alerts,
        recent_check.last_check as last_check_time,
        COALESCE(attention.count, 0) > 0 as needs_immediate_attention
    FROM 
        (SELECT COUNT(*)::INTEGER as count FROM mcp_account_status) total
    LEFT JOIN 
        (SELECT COUNT(*)::INTEGER as count FROM mcp_account_status WHERE current_status = 'OK') ok_accounts ON TRUE
    LEFT JOIN 
        (SELECT COUNT(*)::INTEGER as count FROM mcp_monitoring_alerts WHERE status = 'active') alerts ON TRUE
    LEFT JOIN 
        (SELECT COUNT(*)::INTEGER as count FROM mcp_account_status WHERE needs_attention = TRUE) attention ON TRUE
    LEFT JOIN 
        (SELECT MAX(check_timestamp) as last_check FROM mcp_health_checks) recent_check ON TRUE;
END;
$$ LANGUAGE plpgsql;

-- Dashboard view for monitoring
CREATE OR REPLACE VIEW mcp_monitoring_dashboard AS
SELECT 
    'current_status'::TEXT as metric_type,
    COUNT(*) as total_accounts,
    COUNT(*) FILTER (WHERE current_status = 'OK') as healthy_accounts,
    COUNT(*) FILTER (WHERE current_status = 'CREDENTIALS') as credential_issues,
    COUNT(*) FILTER (WHERE current_status = 'ERROR') as error_accounts,
    COUNT(*) FILTER (WHERE needs_attention = TRUE) as accounts_needing_attention,
    AVG(success_rate) as average_success_rate,
    AVG(average_response_time_ms) as average_response_time,
    MAX(last_checked) as last_health_check
FROM mcp_account_status

UNION ALL

SELECT 
    'recent_alerts'::TEXT as metric_type,
    COUNT(*) as total_accounts,
    COUNT(*) FILTER (WHERE status = 'active') as healthy_accounts, -- active alerts
    COUNT(*) FILTER (WHERE severity = 'critical') as credential_issues, -- critical alerts  
    COUNT(*) FILTER (WHERE severity = 'high') as error_accounts, -- high priority alerts
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as accounts_needing_attention, -- recent alerts
    0 as average_success_rate,
    0 as average_response_time,
    MAX(created_at) as last_health_check
FROM mcp_monitoring_alerts;

-- Sample data for demonstration
INSERT INTO mcp_account_status (unipile_account_id, account_name, current_status, success_rate, average_response_time_ms) VALUES
('NLsTJRfCSg-WZAXCBo8w7A', 'Thorsten Linz', 'OK', 98.5, 1200),
('3Zj8ks8aSrKg0ySaLQo_8A', 'Irish Cita De Ade', 'OK', 97.2, 890),
('MlV8PYD1SXG783XbJRraLQ', 'Martin Schechtner', 'OK', 99.1, 1350),
('eCvuVstGTfCedKsrzAKvZA', 'Peter Noble', 'OK', 96.8, 950),
('he3RXnROSLuhONxgNle7dw', 'Charissa Daniel', 'OK', 98.9, 1100),
('osKDIRFtTtqzmfULiWGTEg', 'Noriko Yokoi, Ph.D.', 'CREDENTIALS', 45.2, NULL);

-- Insert initial health check
INSERT INTO mcp_health_checks (
    check_type,
    mcp_tool_name,
    status,
    response_time_ms,
    accounts_found,
    linkedin_accounts_ok,
    linkedin_accounts_error,
    connectivity_score
) VALUES (
    'accounts',
    'mcp__unipile__unipile_get_accounts',
    'success',
    1250,
    6,
    5,
    1,
    0.83
);

-- Create alert for credentials issue
INSERT INTO mcp_monitoring_alerts (
    alert_type,
    severity,
    title,
    message,
    affected_accounts
) VALUES (
    'credentials_expired',
    'medium',
    'LinkedIn Account Requires Re-authentication',
    'Noriko Yokoi account needs credential refresh for continued campaign access',
    ARRAY['osKDIRFtTtqzmfULiWGTEg']
);

-- Grant permissions (adjust as needed for your RLS setup)
-- ALTER TABLE mcp_health_checks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE mcp_account_status ENABLE ROW LEVEL SECURITY; 
-- ALTER TABLE mcp_monitoring_alerts ENABLE ROW LEVEL SECURITY;