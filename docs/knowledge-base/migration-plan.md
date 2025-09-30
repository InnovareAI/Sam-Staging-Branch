# Knowledge Base Migration (Workspace Scoped Schema)

This document outlines the exact steps to apply the new schema (`20250930120000_align_knowledge_base_schema.sql`) and keep existing tenants safe.

## 1. Pre-flight Checklist (WARP)
- [ ] Take a full PostgreSQL backup (e.g., `pg_dump` or Supabase backup UI).
- [ ] Confirm there are **no active users** manipulating KB data during the window.
- [ ] Export current table counts for reference:
  ```sql
  SELECT COUNT(*) FROM knowledge_base;
  SELECT COUNT(*) FROM knowledge_base_sections;
  SELECT COUNT(*) FROM knowledge_base_content;
  SELECT COUNT(*) FROM icp_configurations;
  ```

## 2. Apply Migration (WARP)
Run the new migration once backups are confirmed:
```bash
supabase db push \
  --migration-path supabase/migrations \
  --context production
```
This will:
- Add `workspace_id` to the existing KB tables.
- Tighten RLS policies so only workspace members (or global rows) can read/write.
- Create the structured tables (`knowledge_base_documents`, `_icps`, `_products`, `_competitors`, `_personas`).

## 3. Backfill Workspace IDs (WARP)
Decide how to treat existing rows:
- **Global content** – leave `workspace_id` as `NULL` so it remains shared.
- **Tenant-specific content** – set `workspace_id` explicitly.

Example template:
```sql
-- Replace <workspace_uuid> with the correct ID
UPDATE public.knowledge_base
SET workspace_id = '<workspace_uuid>'
WHERE workspace_id IS NULL
  AND category IN ('icp', 'pricing');

UPDATE public.knowledge_base_content
SET workspace_id = '<workspace_uuid>'
WHERE workspace_id IS NULL
  AND section_id IN ('icp', 'products');
```
Repeat for `knowledge_base_sections` and `icp_configurations` if needed.

## 4. Seed Sections Per Workspace (WARP)
Every workspace needs its default section rows. After the migration:
```sql
INSERT INTO public.knowledge_base_sections (
  workspace_id, section_id, title, description, icon, is_active, sort_order
)
SELECT w.id, defaults.section_id, defaults.title, defaults.description,
       defaults.icon, true, defaults.sort_order
FROM workspaces w
CROSS JOIN (
  VALUES
    ('overview', 'Company Overview', 'High-level summary', 'Building', 1),
    ('icp', 'ICP Configuration', 'Ideal customer definition', 'Target', 2),
    ('products', 'Products & Services', 'What you sell', 'Package', 3),
    ('competition', 'Competitive Landscape', 'Key competitors', 'Sword', 4),
    ('messaging', 'Messaging & Tone', 'Voice, tone, positioning', 'MessageCircle', 5),
    ('stories', 'Success Stories', 'Case studies & proof', 'Star', 6),
    ('objections', 'Objection Handling', 'Common pushbacks', 'HelpCircle', 7),
    ('pricing', 'Pricing & ROI', 'Pricing model + ROI proof', 'BadgeDollarSign', 8)
) AS defaults(section_id, title, description, icon, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.knowledge_base_sections s
  WHERE s.workspace_id = w.id
    AND s.section_id = defaults.section_id
);
```

## 5. Post-Migration Smoke Test (WARP)
- [ ] Insert/update a KB entry via the API as a workspace member.
- [ ] Confirm an unauthorised user cannot read/write other tenants’ content.
- [ ] Create sample rows in each new structured table (products, competitors, personas) and verify RLS.

## 6. Application Follow-up (Engineering)
- [ ] Update all API handlers/services to pass `workspace_id` on create/update.
- [ ] Start using the structured tables for ICPs, products, competitors, personas.
- [ ] Adjust tests to operate against workspace-scoped data.

**Rollback Plan:** If anything goes wrong, restore from the backup taken in Step 1, then re-apply the previous schema (no destructive ALTERs were run, so a restore is the quickest path).

