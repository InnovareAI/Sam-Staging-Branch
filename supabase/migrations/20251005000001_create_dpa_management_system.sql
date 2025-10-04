-- DPA Management System for EU/GDPR Compliance
-- Self-service and SME tiers only (enterprise gets custom agreements)

-- ====================================
-- 1. DPA Versions Table
-- ====================================
CREATE TABLE IF NOT EXISTS public.dpa_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  effective_date DATE NOT NULL,
  content TEXT NOT NULL, -- Full DPA legal text
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by uuid REFERENCES auth.users(id)
);

-- Index for current version lookup
CREATE INDEX idx_dpa_versions_current ON public.dpa_versions(is_current) WHERE is_current = true;

-- ====================================
-- 2. Workspace DPA Agreements Table
-- ====================================
CREATE TABLE IF NOT EXISTS public.workspace_dpa_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) NOT NULL,
  dpa_version TEXT NOT NULL,

  -- Status tracking
  status TEXT NOT NULL CHECK (status IN (
    'pending_signature',
    'signed',
    'superseded',
    'terminated'
  )),

  -- Signature details
  signed_at TIMESTAMP,
  signed_by uuid REFERENCES auth.users(id),
  signed_by_name TEXT,
  signed_by_title TEXT,
  signed_by_email TEXT,

  -- Signature method (click_through for self-service/SME)
  signature_method TEXT CHECK (signature_method IN (
    'click_through',
    'custom_agreement' -- for enterprise
  )) DEFAULT 'click_through',

  -- Click-through signature metadata
  ip_address INET,
  user_agent TEXT,
  consent_text TEXT,
  scroll_completion BOOLEAN DEFAULT false,

  -- Signed PDF storage
  signed_dpa_pdf_url TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Unique constraint: one active DPA per workspace
  UNIQUE(workspace_id, dpa_version)
);

-- Indexes
CREATE INDEX idx_workspace_dpa_workspace ON public.workspace_dpa_agreements(workspace_id);
CREATE INDEX idx_workspace_dpa_status ON public.workspace_dpa_agreements(status);
CREATE INDEX idx_workspace_dpa_signed_at ON public.workspace_dpa_agreements(signed_at);

-- ====================================
-- 3. Workspace DPA Requirements Table
-- ====================================
CREATE TABLE IF NOT EXISTS public.workspace_dpa_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) NOT NULL UNIQUE,

  -- Auto-detection
  requires_dpa BOOLEAN DEFAULT false,
  detection_method TEXT CHECK (detection_method IN (
    'billing_country',
    'user_location',
    'manual_override'
  )),
  detected_country TEXT,
  detected_at TIMESTAMP,

  -- Grace period tracking
  grace_period_start TIMESTAMP,
  grace_period_end TIMESTAMP,
  grace_period_active BOOLEAN DEFAULT false,

  -- Reminder tracking
  reminder_7_days_sent BOOLEAN DEFAULT false,
  reminder_20_days_sent BOOLEAN DEFAULT false,
  reminder_27_days_sent BOOLEAN DEFAULT false,
  final_notice_sent BOOLEAN DEFAULT false,

  -- Service blocking
  service_blocked BOOLEAN DEFAULT false,
  blocked_at TIMESTAMP,
  block_reason TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for active requirements
CREATE INDEX idx_workspace_dpa_requirements_active ON public.workspace_dpa_requirements(requires_dpa) WHERE requires_dpa = true;
CREATE INDEX idx_workspace_dpa_requirements_grace ON public.workspace_dpa_requirements(grace_period_active) WHERE grace_period_active = true;

-- ====================================
-- 4. DPA Sub-processors Table
-- ====================================
CREATE TABLE IF NOT EXISTS public.dpa_sub_processors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  purpose TEXT NOT NULL,
  location TEXT NOT NULL, -- Country/region
  data_processed TEXT[], -- Array of data types
  dpa_url TEXT, -- URL to their DPA
  added_date DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for active sub-processors
CREATE INDEX idx_dpa_sub_processors_active ON public.dpa_sub_processors(is_active) WHERE is_active = true;

-- ====================================
-- 5. DPA Update Notifications Table
-- ====================================
CREATE TABLE IF NOT EXISTS public.dpa_update_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) NOT NULL,
  notification_type TEXT CHECK (notification_type IN (
    'new_sub_processor',
    'dpa_version_update',
    'policy_change'
  )),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP,
  acknowledged_by uuid REFERENCES auth.users(id)
);

-- Index for unacknowledged notifications
CREATE INDEX idx_dpa_notifications_unacked ON public.dpa_update_notifications(workspace_id, acknowledged) WHERE acknowledged = false;

-- ====================================
-- 6. Row Level Security (RLS) Policies
-- ====================================

-- Enable RLS on all tables
ALTER TABLE public.dpa_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_dpa_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_dpa_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dpa_sub_processors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dpa_update_notifications ENABLE ROW LEVEL SECURITY;

-- DPA Versions: Public read access
CREATE POLICY "Anyone can view current DPA versions"
  ON public.dpa_versions FOR SELECT
  USING (is_current = true);

-- Workspace DPA Agreements: Workspace members only
CREATE POLICY "Workspace members can view their DPA agreements"
  ON public.workspace_dpa_agreements FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace admins can insert DPA agreements"
  ON public.workspace_dpa_agreements FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Workspace admins can update DPA agreements"
  ON public.workspace_dpa_agreements FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Workspace DPA Requirements: Workspace members only
CREATE POLICY "Workspace members can view their DPA requirements"
  ON public.workspace_dpa_requirements FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- DPA Sub-processors: Public read access (transparency requirement)
CREATE POLICY "Anyone can view active sub-processors"
  ON public.dpa_sub_processors FOR SELECT
  USING (is_active = true);

-- DPA Update Notifications: Workspace members only
CREATE POLICY "Workspace members can view their DPA notifications"
  ON public.dpa_update_notifications FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can acknowledge DPA notifications"
  ON public.dpa_update_notifications FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- ====================================
-- 7. Functions
-- ====================================

-- Function to check if workspace needs DPA
CREATE OR REPLACE FUNCTION public.check_workspace_dpa_requirement(p_workspace_id uuid)
RETURNS BOOLEAN AS $$
DECLARE
  v_requires_dpa BOOLEAN;
BEGIN
  SELECT requires_dpa INTO v_requires_dpa
  FROM public.workspace_dpa_requirements
  WHERE workspace_id = p_workspace_id;

  RETURN COALESCE(v_requires_dpa, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get DPA status for workspace
CREATE OR REPLACE FUNCTION public.get_workspace_dpa_status(p_workspace_id uuid)
RETURNS TABLE (
  requires_dpa BOOLEAN,
  has_signed_dpa BOOLEAN,
  dpa_version TEXT,
  days_remaining INTEGER,
  is_blocked BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    req.requires_dpa,
    CASE WHEN dpa.status = 'signed' THEN true ELSE false END AS has_signed_dpa,
    dpa.dpa_version,
    CASE
      WHEN req.grace_period_end IS NOT NULL
      THEN EXTRACT(DAY FROM (req.grace_period_end - NOW()))::INTEGER
      ELSE NULL
    END AS days_remaining,
    req.service_blocked
  FROM public.workspace_dpa_requirements req
  LEFT JOIN public.workspace_dpa_agreements dpa
    ON dpa.workspace_id = req.workspace_id
    AND dpa.status = 'signed'
  WHERE req.workspace_id = p_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================
-- 8. Seed Initial Data
-- ====================================

-- Insert current DPA version
INSERT INTO public.dpa_versions (version, effective_date, content, is_current)
VALUES (
  '1.0',
  CURRENT_DATE,
  'SAM AI DATA PROCESSING AGREEMENT v1.0

[Full DPA legal text will be inserted here - placeholder for now]

This agreement governs the processing of personal data between SAM AI (Processor) and the Customer (Controller) in accordance with GDPR and other applicable data protection laws.',
  true
)
ON CONFLICT (version) DO NOTHING;

-- Insert initial sub-processors
INSERT INTO public.dpa_sub_processors (name, description, purpose, location, data_processed)
VALUES
  (
    'Supabase (PostgreSQL)',
    'Database and authentication provider',
    'Data storage, user authentication, real-time subscriptions',
    'United States (AWS us-west-1)',
    ARRAY['prospect_data', 'campaign_data', 'user_profiles', 'knowledge_base']
  ),
  (
    'OpenRouter',
    'AI model routing and API gateway',
    'LLM inference, embeddings generation, AI responses',
    'United States',
    ARRAY['conversation_history', 'document_content', 'knowledge_base']
  ),
  (
    'Anthropic',
    'Claude AI model provider',
    'Document analysis, SAM AI conversations, content generation',
    'United States',
    ARRAY['conversation_history', 'document_content']
  ),
  (
    'Unipile',
    'LinkedIn and email integration',
    'Campaign message delivery, reply monitoring',
    'European Union (France)',
    ARRAY['linkedin_messages', 'email_messages', 'prospect_data']
  ),
  (
    'Postmark',
    'Transactional email delivery',
    'System notifications, password resets, DPA reminders',
    'United States',
    ARRAY['email_addresses', 'notification_content']
  ),
  (
    'Netlify',
    'Application hosting and CDN',
    'Frontend hosting, serverless functions, API routes',
    'United States',
    ARRAY['request_metadata', 'api_logs']
  )
ON CONFLICT DO NOTHING;

-- ====================================
-- 9. Comments
-- ====================================

COMMENT ON TABLE public.dpa_versions IS 'Version control for Data Processing Agreements';
COMMENT ON TABLE public.workspace_dpa_agreements IS 'Signed DPA agreements for each workspace (self-service/SME only)';
COMMENT ON TABLE public.workspace_dpa_requirements IS 'Tracks which workspaces require DPA and grace period status';
COMMENT ON TABLE public.dpa_sub_processors IS 'List of third-party sub-processors for GDPR transparency';
COMMENT ON TABLE public.dpa_update_notifications IS 'Notifications for DPA updates and new sub-processors';

COMMENT ON COLUMN public.workspace_dpa_agreements.signature_method IS 'click_through for self-service/SME, custom_agreement for enterprise';
COMMENT ON COLUMN public.workspace_dpa_agreements.scroll_completion IS 'Whether user scrolled to bottom of DPA before signing';
COMMENT ON COLUMN public.workspace_dpa_requirements.grace_period_end IS '30 days from workspace creation or EU detection';
