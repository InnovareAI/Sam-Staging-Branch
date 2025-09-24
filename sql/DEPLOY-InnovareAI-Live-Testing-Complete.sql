-- 🚀 LIVE TESTING DEPLOYMENT - INNOVAREAI WORKSPACE ONLY
-- Complete infrastructure for immediate campaign testing
-- Run this in Supabase Dashboard > SQL Editor

DO $$
DECLARE
  innovare_workspace_id UUID;
  test_campaign_id UUID;
  tl_user_id UUID;
  cs_user_id UUID;
  cl_user_id UUID;
BEGIN
  -- Get InnovareAI workspace ID
  SELECT id INTO innovare_workspace_id 
  FROM workspaces 
  WHERE name ILIKE '%InnovareAI%' 
  LIMIT 1;
  
  IF innovare_workspace_id IS NULL THEN
    RAISE EXCEPTION 'InnovareAI workspace not found';
  END IF;
  
  RAISE NOTICE '🏢 InnovareAI Workspace ID: %', innovare_workspace_id;

  -- Get user IDs for team members
  SELECT id INTO tl_user_id FROM auth.users WHERE email = 'tl@innovareai.com';
  SELECT id INTO cs_user_id FROM auth.users WHERE email = 'cs@innovareai.com';  
  SELECT id INTO cl_user_id FROM auth.users WHERE email = 'cl@innovareai.com';
  
  RAISE NOTICE '👥 Team Members: TL=%, CS=%, CL=%', tl_user_id, cs_user_id, cl_user_id;

  -- STEP 1: Create test prospects for InnovareAI workspace
  RAISE NOTICE '📋 Creating test prospects...';
  
  INSERT INTO workspace_prospects (
    workspace_id, 
    first_name, 
    last_name, 
    company_name, 
    job_title, 
    industry,
    linkedin_profile_url,
    linkedin_internal_id,
    email_address,
    location,
    created_at
  ) VALUES
  -- High-quality tech prospects
  (innovare_workspace_id, 'John', 'Smith', 'TechFlow Solutions', 'VP of Sales', 'SaaS', 
   'https://linkedin.com/in/johnsmith-techflow', 'ACoAAA123456789SAMPLE001', 
   'john.smith@techflow.com', 'San Francisco, CA', NOW()),
  
  (innovare_workspace_id, 'Sarah', 'Johnson', 'CloudScale Inc', 'Head of Growth', 'Cloud Computing', 
   'https://linkedin.com/in/sarah-johnson-growth', 'ACoAAA123456789SAMPLE002', 
   'sarah@cloudscale.io', 'Seattle, WA', NOW()),
   
  (innovare_workspace_id, 'Michael', 'Chen', 'DataForward Analytics', 'CTO', 'Data Analytics', 
   'https://linkedin.com/in/michael-chen-cto', 'ACoAAA123456789SAMPLE003', 
   'mchen@dataforward.com', 'Austin, TX', NOW()),
   
  (innovare_workspace_id, 'Emma', 'Rodriguez', 'AIFirst Robotics', 'VP Engineering', 'AI/Robotics', 
   'https://linkedin.com/in/emma-rodriguez-ai', 'ACoAAA123456789SAMPLE004', 
   'emma@aifirst.tech', 'Boston, MA', NOW()),
   
  (innovare_workspace_id, 'David', 'Park', 'ScaleUp Ventures', 'Partner', 'Venture Capital', 
   'https://linkedin.com/in/david-park-vc', 'ACoAAA123456789SAMPLE005', 
   'dpark@scaleup.vc', 'Palo Alto, CA', NOW())
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✅ Test prospects created';

  -- STEP 2: Create LIVE test campaign for InnovareAI
  RAISE NOTICE '🎯 Creating live test campaign...';
  
  INSERT INTO campaigns (
    workspace_id,
    name,
    description,
    type,
    status,
    daily_limit,
    linkedin_account_id,
    created_at,
    updated_at
  ) VALUES (
    innovare_workspace_id,
    'InnovareAI Live Test Campaign',
    'Live testing campaign for LinkedIn outreach - Tech industry prospects',
    'linkedin_outreach',
    'draft',
    10, -- Conservative daily limit for testing
    'NLsTJRfCSg-WZAXCBo8w7A', -- Thorsten's LinkedIn account ID
    NOW(),
    NOW()
  ) RETURNING id INTO test_campaign_id;
  
  RAISE NOTICE '✅ Campaign created: %', test_campaign_id;

  -- STEP 3: Associate prospects with campaign (ready for approval)
  RAISE NOTICE '🔗 Associating prospects with campaign...';
  
  INSERT INTO campaign_prospects (
    campaign_id,
    prospect_id,
    status,
    sequence_step,
    created_at
  )
  SELECT 
    test_campaign_id,
    wp.id,
    'pending_approval', -- Start with approval workflow
    0,
    NOW()
  FROM workspace_prospects wp
  WHERE wp.workspace_id = innovare_workspace_id
  AND wp.first_name IN ('John', 'Sarah', 'Michael', 'Emma', 'David');
  
  RAISE NOTICE '✅ Prospects associated with campaign';

  -- STEP 4: Create message templates for the campaign
  RAISE NOTICE '📝 Creating message templates...';
  
  -- Ensure message_templates table exists (create if needed)
  CREATE TABLE IF NOT EXISTS message_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    template_text TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    times_used INTEGER DEFAULT 0,
    total_responses INTEGER DEFAULT 0,
    response_rate DECIMAL(5,2) DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, name)
  );

  -- Insert templates for InnovareAI
  INSERT INTO message_templates (
    workspace_id,
    name,
    category,
    template_text,
    variables
  ) VALUES
  (innovare_workspace_id, 'Connection Request - Tech Focus', 'connection_request',
   'Hi {{first_name}}, I noticed your impressive work at {{company_name}} in the {{industry}} space. I''d love to connect and share some insights that could accelerate your growth initiatives.',
   '["first_name", "company_name", "industry"]'),
   
  (innovare_workspace_id, 'Follow Up 1 - Value Proposition', 'follow_up_1',
   'Thanks for connecting, {{first_name}}! Given {{company_name}}''s focus on {{industry}}, I thought you might be interested in how we''ve helped similar companies achieve 3x faster growth through AI-powered solutions.',
   '["first_name", "company_name", "industry"]'),
   
  (innovare_workspace_id, 'Follow Up 2 - Meeting Request', 'follow_up_2',
   '{{first_name}}, I''d love to show you a quick 15-minute demo of how {{company_name}} could benefit from our AI automation platform. Would you be open to a brief call this week?',
   '["first_name", "company_name"]')
  ON CONFLICT (workspace_id, name) DO NOTHING;
  
  RAISE NOTICE '✅ Message templates created';

  -- STEP 5: Create approval session for immediate testing
  RAISE NOTICE '✋ Creating approval session...';
  
  -- Ensure prospect approval tables exist
  CREATE TABLE IF NOT EXISTS prospect_approval_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    approver_id UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'pending',
    total_prospects INTEGER NOT NULL DEFAULT 0,
    approved_count INTEGER DEFAULT 0,
    rejected_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS prospect_approval_decisions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES prospect_approval_sessions(id) ON DELETE CASCADE,
    prospect_id UUID NOT NULL REFERENCES workspace_prospects(id) ON DELETE CASCADE,
    decision TEXT NOT NULL, -- 'approved', 'rejected', 'needs_revision'
    score INTEGER, -- 1-10 quality score
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Create approval session
  INSERT INTO prospect_approval_sessions (
    workspace_id,
    campaign_id,
    approver_id,
    status,
    total_prospects
  )
  SELECT 
    innovare_workspace_id,
    test_campaign_id,
    tl_user_id,
    'pending',
    (SELECT COUNT(*) FROM campaign_prospects WHERE campaign_id = test_campaign_id)
  RETURNING id INTO test_campaign_id; -- Reuse variable for session ID
  
  RAISE NOTICE '✅ Approval session created: %', test_campaign_id;

  -- STEP 6: Enable RLS policies for InnovareAI workspace
  RAISE NOTICE '🔒 Setting up security policies...';
  
  -- Enable RLS on tables if not already enabled
  ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
  ALTER TABLE campaign_prospects ENABLE ROW LEVEL SECURITY;
  ALTER TABLE workspace_prospects ENABLE ROW LEVEL SECURITY;
  ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
  ALTER TABLE prospect_approval_sessions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE prospect_approval_decisions ENABLE ROW LEVEL SECURITY;

  -- Create/update policies for workspace access
  DROP POLICY IF EXISTS "Users can manage campaigns in their workspaces" ON campaigns;
  CREATE POLICY "Users can manage campaigns in their workspaces" ON campaigns
    FOR ALL USING (
      workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "Users can manage prospects in their workspaces" ON workspace_prospects;
  CREATE POLICY "Users can manage prospects in their workspaces" ON workspace_prospects
    FOR ALL USING (
      workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    );

  -- STEP 7: Create API testing endpoints summary
  RAISE NOTICE '🔗 API Endpoints ready for testing:';
  RAISE NOTICE '  POST /api/campaigns/linkedin/execute-live';
  RAISE NOTICE '  GET  /api/campaigns/linkedin/execute-live?campaignId=%', test_campaign_id;
  RAISE NOTICE '  POST /api/prospect-approval/decide';

  -- STEP 8: Generate final deployment summary
  RAISE NOTICE '';
  RAISE NOTICE '🚀 INNOVAREAI LIVE TESTING DEPLOYMENT COMPLETE!';
  RAISE NOTICE '════════════════════════════════════════════════';
  RAISE NOTICE 'Workspace: InnovareAI (%)', innovare_workspace_id;
  RAISE NOTICE 'Campaign ID: %', test_campaign_id;
  RAISE NOTICE 'Test Prospects: 5 high-quality tech prospects';
  RAISE NOTICE 'LinkedIn Account: Thorsten Linz (NLsTJRfCSg-WZAXCBo8w7A)';
  RAISE NOTICE 'Message Templates: 3 templates (connection + 2 follow-ups)';
  RAISE NOTICE 'Status: Ready for immediate live testing';
  RAISE NOTICE '';
  RAISE NOTICE '📋 NEXT STEPS FOR LIVE TESTING:';
  RAISE NOTICE '1. Navigate to campaign in SAM AI dashboard';
  RAISE NOTICE '2. Approve prospects via approval session';
  RAISE NOTICE '3. Execute live campaign via API';
  RAISE NOTICE '4. Monitor real LinkedIn message sending';
  RAISE NOTICE '5. Track responses and performance';
  RAISE NOTICE '';
  RAISE NOTICE '⚡ READY TO GO LIVE! ⚡';

END $$;