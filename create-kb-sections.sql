-- Create knowledge_base_sections table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.knowledge_base_sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, section_id)
);

-- Enable RLS
ALTER TABLE public.knowledge_base_sections ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "KB sections are accessible by workspace members"
ON public.knowledge_base_sections FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.user_workspaces 
        WHERE user_id = auth.uid()
    )
);

-- Insert default sections for the workspace
INSERT INTO public.knowledge_base_sections (workspace_id, section_id, title, description, sort_order)
VALUES 
    ('babdcab8-1a78-4b2f-913e-6e9fd9821009', 'icp', 'Ideal Customer Profile', 'Target customer definitions and criteria', 1),
    ('babdcab8-1a78-4b2f-913e-6e9fd9821009', 'products', 'Products & Services', 'Product information and features', 2),
    ('babdcab8-1a78-4b2f-913e-6e9fd9821009', 'messaging', 'Messaging & Templates', 'Outreach templates and messaging frameworks', 3),
    ('babdcab8-1a78-4b2f-913e-6e9fd9821009', 'objections', 'Objection Handling', 'Common objections and responses', 4),
    ('babdcab8-1a78-4b2f-913e-6e9fd9821009', 'pricing', 'Pricing & ROI', 'Pricing information and ROI calculations', 5),
    ('babdcab8-1a78-4b2f-913e-6e9fd9821009', 'stories', 'Success Stories', 'Case studies and customer stories', 6),
    ('babdcab8-1a78-4b2f-913e-6e9fd9821009', 'process', 'Sales Process', 'Sales methodology and processes', 7)
ON CONFLICT (workspace_id, section_id) DO NOTHING;
