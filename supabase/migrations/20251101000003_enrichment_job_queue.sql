-- Enrichment Job Queue System
-- Allows async processing of prospect enrichment to avoid Netlify timeouts

CREATE TABLE IF NOT EXISTS enrichment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Job configuration
  session_id UUID,
  prospect_ids UUID[] NOT NULL,
  total_prospects INTEGER NOT NULL,

  -- Job status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  processed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,

  -- Progress tracking
  current_prospect_id UUID,
  current_prospect_url TEXT,
  error_message TEXT,

  -- Results
  enrichment_results JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX idx_enrichment_jobs_workspace ON enrichment_jobs(workspace_id);
CREATE INDEX idx_enrichment_jobs_user ON enrichment_jobs(user_id);
CREATE INDEX idx_enrichment_jobs_status ON enrichment_jobs(status);
CREATE INDEX idx_enrichment_jobs_created ON enrichment_jobs(created_at DESC);

-- RLS Policies
ALTER TABLE enrichment_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own jobs
CREATE POLICY "Users can view their own enrichment jobs"
  ON enrichment_jobs FOR SELECT
  USING (user_id = auth.uid());

-- Users can create jobs
CREATE POLICY "Users can create enrichment jobs"
  ON enrichment_jobs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own jobs (for cancellation)
CREATE POLICY "Users can update their own enrichment jobs"
  ON enrichment_jobs FOR UPDATE
  USING (user_id = auth.uid());

-- Service role can do everything (for background worker)
CREATE POLICY "Service role can manage all enrichment jobs"
  ON enrichment_jobs
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_enrichment_job_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enrichment_job_updated_at
  BEFORE UPDATE ON enrichment_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_enrichment_job_timestamp();

-- Function to clean up old completed jobs (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_enrichment_jobs()
RETURNS void AS $$
BEGIN
  DELETE FROM enrichment_jobs
  WHERE status IN ('completed', 'failed', 'cancelled')
    AND completed_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE enrichment_jobs IS 'Queue for async prospect enrichment jobs to avoid serverless function timeouts';
COMMENT ON COLUMN enrichment_jobs.status IS 'pending: waiting to start, processing: currently running, completed: finished successfully, failed: error occurred, cancelled: user cancelled';
COMMENT ON COLUMN enrichment_jobs.enrichment_results IS 'Array of enriched prospect data with verification status';
