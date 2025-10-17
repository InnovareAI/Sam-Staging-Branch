-- Fix create_campaign function to work with Supabase auth (not Clerk)
-- Update to use auth.uid() directly instead of looking up clerk_id

CREATE OR REPLACE FUNCTION create_campaign(
    p_workspace_id UUID,
    p_name TEXT,
    p_description TEXT DEFAULT NULL,
    p_campaign_type TEXT DEFAULT 'multi_channel',
    p_target_icp JSONB DEFAULT '{}',
    p_ab_test_variant TEXT DEFAULT NULL,
    p_message_templates JSONB DEFAULT '{}',
    p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_campaign_id UUID;
    v_user_id UUID;
BEGIN
    -- Get user ID directly from auth.uid() (Supabase auth)
    -- If p_created_by is provided, use that, otherwise use current auth user
    v_user_id := COALESCE(p_created_by, auth.uid());

    INSERT INTO campaigns (
        workspace_id, name, description, campaign_type,
        target_icp, ab_test_variant, message_templates, created_by
    ) VALUES (
        p_workspace_id, p_name, p_description, p_campaign_type,
        p_target_icp, p_ab_test_variant, p_message_templates, v_user_id
    ) RETURNING id INTO v_campaign_id;

    RETURN v_campaign_id;
END;
$$;

COMMENT ON FUNCTION create_campaign IS 'Create a new campaign with Supabase auth support';
