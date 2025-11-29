-- System Health Checks Table
-- Stores daily health check results and AI analysis

CREATE TABLE IF NOT EXISTS system_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checks JSONB NOT NULL DEFAULT '[]',
  ai_analysis TEXT,
  recommendations JSONB DEFAULT '[]',
  overall_status VARCHAR(20) NOT NULL DEFAULT 'healthy',
  duration_ms INTEGER,
  fixes_proposed JSONB DEFAULT '[]',
  fixes_applied JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying recent checks
CREATE INDEX idx_health_checks_date ON system_health_checks(check_date DESC);
CREATE INDEX idx_health_checks_status ON system_health_checks(overall_status);

-- Agent Fix Proposals Table
-- Stores proposed code fixes from the debugging agent
CREATE TABLE IF NOT EXISTS agent_fix_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  health_check_id UUID REFERENCES system_health_checks(id),
  issue_type VARCHAR(100) NOT NULL,
  issue_description TEXT NOT NULL,
  file_path TEXT,
  proposed_fix TEXT,
  confidence_score DECIMAL(3,2),
  status VARCHAR(50) DEFAULT 'proposed', -- proposed, approved, applied, rejected
  applied_at TIMESTAMPTZ,
  applied_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fix_proposals_status ON agent_fix_proposals(status);
CREATE INDEX idx_fix_proposals_health_check ON agent_fix_proposals(health_check_id);

-- Grant access
GRANT ALL ON system_health_checks TO authenticated;
GRANT ALL ON agent_fix_proposals TO authenticated;
