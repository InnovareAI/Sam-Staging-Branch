-- Fix campaign RLS policies to use Supabase auth instead of Clerk
-- Replace clerk_id lookups with direct auth.uid() usage

-- Drop old policies
DROP POLICY IF EXISTS "Users can access workspace campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can access workspace campaign messages" ON campaign_messages;
DROP POLICY IF EXISTS "Users can access workspace campaign replies" ON campaign_replies;
DROP POLICY IF EXISTS "Users can access workspace campaign reply actions" ON campaign_reply_actions;

-- Recreate policies with Supabase auth

-- Campaigns: Users can see campaigns in their workspace
CREATE POLICY "Users can access workspace campaigns" ON campaigns
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Campaign messages: Users can see messages from their workspace campaigns
CREATE POLICY "Users can access workspace campaign messages" ON campaign_messages
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Campaign replies: Users can see replies to their workspace campaign messages
CREATE POLICY "Users can access workspace campaign replies" ON campaign_replies
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Campaign reply actions: Users can see actions on their workspace campaign replies
CREATE POLICY "Users can access workspace campaign reply actions" ON campaign_reply_actions
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

COMMENT ON POLICY "Users can access workspace campaigns" ON campaigns IS 'RLS policy using Supabase auth.uid()';
