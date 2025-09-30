-- RLS policies for knowledge base tables (workspace scoped)

-- Helper CTE for readability
-- Policies reference workspace_members to validate membership

-- knowledge_base (flat entries)
DROP POLICY IF EXISTS kb_select_scoped ON public.knowledge_base;
DROP POLICY IF EXISTS kb_mutate_scoped ON public.knowledge_base;

CREATE POLICY kb_select_scoped ON public.knowledge_base
FOR SELECT USING (
  workspace_id IS NULL OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_insert_scoped ON public.knowledge_base
FOR INSERT WITH CHECK (
  workspace_id IS NULL OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_update_scoped ON public.knowledge_base
FOR UPDATE USING (
  workspace_id IS NULL OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
) WITH CHECK (
  workspace_id IS NULL OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_delete_scoped ON public.knowledge_base
FOR DELETE USING (
  workspace_id IS NULL OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- knowledge_base_sections
DROP POLICY IF EXISTS kb_sections_select_scoped ON public.knowledge_base_sections;
DROP POLICY IF EXISTS kb_sections_insert_scoped ON public.knowledge_base_sections;
DROP POLICY IF EXISTS kb_sections_update_scoped ON public.knowledge_base_sections;
DROP POLICY IF EXISTS kb_sections_delete_scoped ON public.knowledge_base_sections;

CREATE POLICY kb_sections_select_scoped ON public.knowledge_base_sections
FOR SELECT USING (
  workspace_id IS NULL OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_sections_insert_scoped ON public.knowledge_base_sections
FOR INSERT WITH CHECK (
  workspace_id IS NULL OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_sections_update_scoped ON public.knowledge_base_sections
FOR UPDATE USING (
  workspace_id IS NULL OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
) WITH CHECK (
  workspace_id IS NULL OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_sections_delete_scoped ON public.knowledge_base_sections
FOR DELETE USING (
  workspace_id IS NULL OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- knowledge_base_content
DROP POLICY IF EXISTS kb_content_select_scoped ON public.knowledge_base_content;
DROP POLICY IF EXISTS kb_content_insert_scoped ON public.knowledge_base_content;
DROP POLICY IF EXISTS kb_content_update_scoped ON public.knowledge_base_content;
DROP POLICY IF EXISTS kb_content_delete_scoped ON public.knowledge_base_content;

CREATE POLICY kb_content_select_scoped ON public.knowledge_base_content
FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_content_insert_scoped ON public.knowledge_base_content
FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_content_update_scoped ON public.knowledge_base_content
FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
) WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_content_delete_scoped ON public.knowledge_base_content
FOR DELETE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- knowledge_base_documents
DROP POLICY IF EXISTS kb_documents_select_scoped ON public.knowledge_base_documents;
DROP POLICY IF EXISTS kb_documents_insert_scoped ON public.knowledge_base_documents;
DROP POLICY IF EXISTS kb_documents_update_scoped ON public.knowledge_base_documents;
DROP POLICY IF EXISTS kb_documents_delete_scoped ON public.knowledge_base_documents;

CREATE POLICY kb_documents_select_scoped ON public.knowledge_base_documents
FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_documents_insert_scoped ON public.knowledge_base_documents
FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_documents_update_scoped ON public.knowledge_base_documents
FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
) WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_documents_delete_scoped ON public.knowledge_base_documents
FOR DELETE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- icp_configurations
DROP POLICY IF EXISTS icp_config_select_scoped ON public.icp_configurations;
DROP POLICY IF EXISTS icp_config_insert_scoped ON public.icp_configurations;
DROP POLICY IF EXISTS icp_config_update_scoped ON public.icp_configurations;
DROP POLICY IF EXISTS icp_config_delete_scoped ON public.icp_configurations;

CREATE POLICY icp_config_select_scoped ON public.icp_configurations
FOR SELECT USING (
  workspace_id IS NULL OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY icp_config_insert_scoped ON public.icp_configurations
FOR INSERT WITH CHECK (
  workspace_id IS NULL OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY icp_config_update_scoped ON public.icp_configurations
FOR UPDATE USING (
  workspace_id IS NULL OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
) WITH CHECK (
  workspace_id IS NULL OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY icp_config_delete_scoped ON public.icp_configurations
FOR DELETE USING (
  workspace_id IS NULL OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- Structured tables: knowledge_base_icps, products, competitors, personas
DROP POLICY IF EXISTS kb_icps_select_scoped ON public.knowledge_base_icps;
DROP POLICY IF EXISTS kb_icps_insert_scoped ON public.knowledge_base_icps;
DROP POLICY IF EXISTS kb_icps_update_scoped ON public.knowledge_base_icps;
DROP POLICY IF EXISTS kb_icps_delete_scoped ON public.knowledge_base_icps;

CREATE POLICY kb_icps_select_scoped ON public.knowledge_base_icps
FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_icps_insert_scoped ON public.knowledge_base_icps
FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_icps_update_scoped ON public.knowledge_base_icps
FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
) WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_icps_delete_scoped ON public.knowledge_base_icps
FOR DELETE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- Products
DROP POLICY IF EXISTS kb_products_select_scoped ON public.knowledge_base_products;
DROP POLICY IF EXISTS kb_products_insert_scoped ON public.knowledge_base_products;
DROP POLICY IF EXISTS kb_products_update_scoped ON public.knowledge_base_products;
DROP POLICY IF EXISTS kb_products_delete_scoped ON public.knowledge_base_products;

CREATE POLICY kb_products_select_scoped ON public.knowledge_base_products
FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_products_insert_scoped ON public.knowledge_base_products
FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_products_update_scoped ON public.knowledge_base_products
FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
) WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_products_delete_scoped ON public.knowledge_base_products
FOR DELETE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- Competitors
DROP POLICY IF EXISTS kb_competitors_select_scoped ON public.knowledge_base_competitors;
DROP POLICY IF EXISTS kb_competitors_insert_scoped ON public.knowledge_base_competitors;
DROP POLICY IF EXISTS kb_competitors_update_scoped ON public.knowledge_base_competitors;
DROP POLICY IF EXISTS kb_competitors_delete_scoped ON public.knowledge_base_competitors;

CREATE POLICY kb_competitors_select_scoped ON public.knowledge_base_competitors
FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_competitors_insert_scoped ON public.knowledge_base_competitors
FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_competitors_update_scoped ON public.knowledge_base_competitors
FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
) WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_competitors_delete_scoped ON public.knowledge_base_competitors
FOR DELETE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- Personas
DROP POLICY IF EXISTS kb_personas_select_scoped ON public.knowledge_base_personas;
DROP POLICY IF EXISTS kb_personas_insert_scoped ON public.knowledge_base_personas;
DROP POLICY IF EXISTS kb_personas_update_scoped ON public.knowledge_base_personas;
DROP POLICY IF EXISTS kb_personas_delete_scoped ON public.knowledge_base_personas;

CREATE POLICY kb_personas_select_scoped ON public.knowledge_base_personas
FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_personas_insert_scoped ON public.knowledge_base_personas
FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_personas_update_scoped ON public.knowledge_base_personas
FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
) WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_personas_delete_scoped ON public.knowledge_base_personas
FOR DELETE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);
*** End Patch
PATCH
