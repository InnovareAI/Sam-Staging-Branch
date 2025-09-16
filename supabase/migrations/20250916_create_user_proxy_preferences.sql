-- Create user_proxy_preferences table for Bright Data auto IP assignment
CREATE TABLE IF NOT EXISTS user_proxy_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    detected_location text,
    linkedin_location text,
    preferred_country text NOT NULL,
    preferred_state text,
    preferred_city text,
    confidence_score numeric(3,2) DEFAULT 0.0,
    session_id text,
    is_manual_selection boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_updated timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT valid_confidence_score CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    CONSTRAINT valid_country_code CHECK (length(preferred_country) = 2)
);

-- Create index for faster lookups by user
CREATE INDEX idx_user_proxy_preferences_user_id ON user_proxy_preferences(user_id);
CREATE INDEX idx_user_proxy_preferences_last_updated ON user_proxy_preferences(last_updated DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE user_proxy_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own proxy preferences" ON user_proxy_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own proxy preferences" ON user_proxy_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own proxy preferences" ON user_proxy_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own proxy preferences" ON user_proxy_preferences
    FOR DELETE USING (auth.uid() = user_id);

-- Add helpful comments
COMMENT ON TABLE user_proxy_preferences IS 'Stores user preferences for Bright Data proxy IP assignment based on location detection and manual selection';
COMMENT ON COLUMN user_proxy_preferences.detected_location IS 'Auto-detected user location from IP geolocation services';
COMMENT ON COLUMN user_proxy_preferences.linkedin_location IS 'Location extracted from LinkedIn profile for enhanced accuracy';
COMMENT ON COLUMN user_proxy_preferences.preferred_country IS 'Two-letter country code for proxy assignment (e.g., us, gb, de)';
COMMENT ON COLUMN user_proxy_preferences.preferred_state IS 'State/region code for proxy assignment (e.g., ca, ny, tx)';
COMMENT ON COLUMN user_proxy_preferences.preferred_city IS 'City code for proxy assignment when available';
COMMENT ON COLUMN user_proxy_preferences.confidence_score IS 'Confidence level of location mapping (0.0 to 1.0)';
COMMENT ON COLUMN user_proxy_preferences.session_id IS 'Unique session identifier for proxy rotation';
COMMENT ON COLUMN user_proxy_preferences.is_manual_selection IS 'True if user manually selected location, false for auto-detection';