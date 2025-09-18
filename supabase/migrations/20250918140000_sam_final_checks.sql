-- Create table for SAM AI final check logs
CREATE TABLE IF NOT EXISTS sam_final_checks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Message details
    message_content TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_company TEXT,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    
    -- Final check results
    approved BOOLEAN NOT NULL DEFAULT false,
    confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.0,
    
    -- Issues analysis
    issues_count INTEGER NOT NULL DEFAULT 0,
    critical_issues_count INTEGER NOT NULL DEFAULT 0,
    issues_summary TEXT,
    
    -- Recommendations
    recommendations_count INTEGER NOT NULL DEFAULT 0,
    cultural_notes TEXT,
    
    -- Message metrics
    character_count INTEGER NOT NULL,
    detected_language TEXT DEFAULT 'en',
    message_type TEXT DEFAULT 'connection_request',
    platform TEXT DEFAULT 'linkedin',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS policies
ALTER TABLE sam_final_checks ENABLE ROW LEVEL SECURITY;

-- Users can only see their own final checks
CREATE POLICY "Users can view own final checks" ON sam_final_checks
    FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own final checks
CREATE POLICY "Users can insert own final checks" ON sam_final_checks
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Add indexes for performance
CREATE INDEX idx_sam_final_checks_user_id ON sam_final_checks(user_id);
CREATE INDEX idx_sam_final_checks_campaign_id ON sam_final_checks(campaign_id);
CREATE INDEX idx_sam_final_checks_created_at ON sam_final_checks(created_at);
CREATE INDEX idx_sam_final_checks_approved ON sam_final_checks(approved);
CREATE INDEX idx_sam_final_checks_confidence_score ON sam_final_checks(confidence_score);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sam_final_checks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sam_final_checks_updated_at_trigger
    BEFORE UPDATE ON sam_final_checks
    FOR EACH ROW
    EXECUTE FUNCTION update_sam_final_checks_updated_at();

-- Add comments for documentation
COMMENT ON TABLE sam_final_checks IS 'Logs all SAM AI final message checks with approval status and issues';
COMMENT ON COLUMN sam_final_checks.confidence_score IS 'AI confidence score from 0.0 to 1.0';
COMMENT ON COLUMN sam_final_checks.issues_summary IS 'Concatenated summary of all issues found';
COMMENT ON COLUMN sam_final_checks.cultural_notes IS 'Language-specific cultural guidance notes';
COMMENT ON COLUMN sam_final_checks.detected_language IS 'Detected language code (en, de, fr, nl)';