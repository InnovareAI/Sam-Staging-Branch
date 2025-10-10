-- Prospect Search Jobs System
-- Handles async LinkedIn/Brightdata searches with real-time progress tracking

-- Jobs table
CREATE TABLE IF NOT EXISTS prospect_search_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID,

  -- Search configuration
  search_criteria JSONB NOT NULL,
  search_type TEXT NOT NULL, -- 'linkedin', 'brightdata', 'apollo'
  search_source TEXT, -- 'classic', 'sales_navigator', 'recruiter'

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'queued', -- queued, processing, completed, failed, cancelled
  progress_current INTEGER DEFAULT 0,
  progress_total INTEGER DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_results INTEGER,

  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Results table (streamed as job processes)
CREATE TABLE IF NOT EXISTS prospect_search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES prospect_search_jobs(id) ON DELETE CASCADE,

  -- Prospect data
  prospect_data JSONB NOT NULL,
  batch_number INTEGER, -- Track which API page this came from

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prospect_search_jobs_user_id ON prospect_search_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_prospect_search_jobs_workspace_id ON prospect_search_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_prospect_search_jobs_status ON prospect_search_jobs(status);
CREATE INDEX IF NOT EXISTS idx_prospect_search_jobs_created_at ON prospect_search_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospect_search_results_job_id ON prospect_search_results(job_id);

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_prospect_search_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prospect_search_jobs_updated_at
  BEFORE UPDATE ON prospect_search_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_prospect_search_jobs_updated_at();

-- Enable Row Level Security
ALTER TABLE prospect_search_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_search_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for prospect_search_jobs
CREATE POLICY "Users can view their own search jobs"
  ON prospect_search_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own search jobs"
  ON prospect_search_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own search jobs"
  ON prospect_search_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for prospect_search_results
CREATE POLICY "Users can view results from their own jobs"
  ON prospect_search_results FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM prospect_search_jobs WHERE user_id = auth.uid()
    )
  );

-- Service role can do everything (for background functions)
CREATE POLICY "Service role has full access to jobs"
  ON prospect_search_jobs FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to results"
  ON prospect_search_results FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable Realtime for live progress updates
ALTER PUBLICATION supabase_realtime ADD TABLE prospect_search_jobs;

-- Comments for documentation
COMMENT ON TABLE prospect_search_jobs IS 'Tracks async prospect search jobs with real-time progress';
COMMENT ON TABLE prospect_search_results IS 'Stores prospect data from completed search jobs';
COMMENT ON COLUMN prospect_search_jobs.search_type IS 'linkedin, brightdata, or apollo';
COMMENT ON COLUMN prospect_search_jobs.search_source IS 'classic, sales_navigator, or recruiter (for LinkedIn)';
COMMENT ON COLUMN prospect_search_jobs.status IS 'queued, processing, completed, failed, or cancelled';
