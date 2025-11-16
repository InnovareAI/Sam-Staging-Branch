-- RPC Functions for N8N Enrichment Workflow
-- These functions allow atomic updates to enrichment_jobs from N8N HTTP Request nodes

-- Function to increment processed count and add result to enrichment_results
CREATE OR REPLACE FUNCTION increment_enrichment_processed(
  p_job_id UUID,
  p_result JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE enrichment_jobs
  SET
    processed_count = processed_count + 1,
    enrichment_results = enrichment_results || jsonb_build_array(p_result),
    updated_at = NOW()
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment failed count
CREATE OR REPLACE FUNCTION increment_enrichment_failed(
  p_job_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE enrichment_jobs
  SET
    failed_count = failed_count + 1,
    updated_at = NOW()
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION increment_enrichment_processed TO service_role;
GRANT EXECUTE ON FUNCTION increment_enrichment_failed TO service_role;

COMMENT ON FUNCTION increment_enrichment_processed IS 'Atomically increment processed count and append result to enrichment_results array';
COMMENT ON FUNCTION increment_enrichment_failed IS 'Atomically increment failed count for enrichment jobs';
