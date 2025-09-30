-- Create sam_icp_discovery_sessions table
CREATE TABLE IF NOT EXISTS public.sam_icp_discovery_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES public.sam_conversation_threads(id) ON DELETE CASCADE,
    session_status TEXT NOT NULL DEFAULT 'in_progress' CHECK (session_status IN ('in_progress', 'completed', 'abandoned')),
    discovery_payload JSONB DEFAULT '{}'::jsonb,
    phases_completed TEXT[] DEFAULT ARRAY[]::TEXT[],
    red_flags TEXT[] DEFAULT ARRAY[]::TEXT[],
    confidence_score DECIMAL(3,2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sam_icp_discovery_sessions_user_id ON public.sam_icp_discovery_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sam_icp_discovery_sessions_thread_id ON public.sam_icp_discovery_sessions(thread_id);
CREATE INDEX IF NOT EXISTS idx_sam_icp_discovery_sessions_status ON public.sam_icp_discovery_sessions(session_status);
CREATE INDEX IF NOT EXISTS idx_sam_icp_discovery_sessions_created_at ON public.sam_icp_discovery_sessions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.sam_icp_discovery_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own discovery sessions"
    ON public.sam_icp_discovery_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own discovery sessions"
    ON public.sam_icp_discovery_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own discovery sessions"
    ON public.sam_icp_discovery_sessions
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own discovery sessions"
    ON public.sam_icp_discovery_sessions
    FOR DELETE
    USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE public.sam_icp_discovery_sessions IS 'Stores ICP discovery session state and progress for SAM conversations';