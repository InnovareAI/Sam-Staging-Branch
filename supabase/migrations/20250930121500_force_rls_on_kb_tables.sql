-- Enforce row level security on knowledge base tables

-- Core tables
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base FORCE ROW LEVEL SECURITY;

ALTER TABLE public.knowledge_base_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_sections FORCE ROW LEVEL SECURITY;

ALTER TABLE public.knowledge_base_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_content FORCE ROW LEVEL SECURITY;

ALTER TABLE public.icp_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icp_configurations FORCE ROW LEVEL SECURITY;

-- Structured tables
ALTER TABLE public.knowledge_base_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_documents FORCE ROW LEVEL SECURITY;

ALTER TABLE public.knowledge_base_icps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_icps FORCE ROW LEVEL SECURITY;

ALTER TABLE public.knowledge_base_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_products FORCE ROW LEVEL SECURITY;

ALTER TABLE public.knowledge_base_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_competitors FORCE ROW LEVEL SECURITY;

ALTER TABLE public.knowledge_base_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_personas FORCE ROW LEVEL SECURITY;
