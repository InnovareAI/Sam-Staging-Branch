# Structured Knowledge Base Migration Guide

## 1. Context

SAM now stores knowledge base intelligence in five dedicated tables instead of the legacy `knowledge_base_content` catch‑all bucket. The new schema separates structured data (ICPs, products, competitors, personas, documents) while enforcing workspace isolation with strict RLS policies.

This document captures everything you need to understand, execute, and troubleshoot the migration.

## 2. Target Schema

| Table | Purpose | Key Columns | RLS Policy |
| --- | --- | --- | --- |
| `knowledge_base_icps` | Ideal customer profiles | `workspace_id`, `name`, `industries`, `job_titles`, `locations`, `technologies`, `qualification_criteria`, `messaging_framework`, `is_active` | Members of the owning workspace only |
| `knowledge_base_products` | Product catalog | `workspace_id`, `name`, `description`, `category`, `features`, `benefits`, `use_cases`, `target_segments`, `pricing`, `is_active` | Members of the owning workspace only |
| `knowledge_base_competitors` | Competitive intelligence | `workspace_id`, `name`, `website`, `strengths`, `weaknesses`, `pricing_model`, `key_features`, `target_market`, `competitive_positioning`, `is_active` | Members of the owning workspace only |
| `knowledge_base_personas` | Buyer / user personas | `workspace_id`, `name`, `icp_id`, `job_title`, `department`, `seniority_level`, `decision_making_role`, `pain_points`, `goals`, `communication_preferences`, `objections`, `messaging_approach`, `is_active` | Members of the owning workspace only |
| `knowledge_base_documents` | Document uploads (unchanged) | `workspace_id`, `section_id`, `filename`, `extracted_content`, `tags`, `summary`, `vector_chunks`, `is_active` | Members of the owning workspace only |

Each table ships with:

- Workspace foreign key and unique indexes (`workspace_id` + business keys)
- Trigger to update `updated_at`
- `created_by`, `created_at`, `updated_at` metadata
- GIN indexes on array/JSON columns for performance

## 3. Migration Script

**File:** `scripts/migrate-legacy-knowledge-base.js`

**Purpose:** Read legacy `knowledge_base_content` rows for sections `icp`, `products`, `competition`, and `personas`, normalize the JSON payload, and upsert into the structured tables.

**Usage:**

```bash
# Preview the migration (no writes)
npm run migrate:kb -- --dry-run

# Apply changes (rerun without the flag)
npm run migrate:kb
```

The script requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment. It uses `dotenv` and automatically loads `.env.seed` (if present) so staging/prod credentials remain consistent.

### Transformation details

| Section | Target | Notes |
| --- | --- | --- |
| `icp` | `knowledge_base_icps` | Infers arrays from strings, preserves `qualification_criteria` and `messaging_framework` JSON, skips rows missing `workspace_id` or `name` |
| `products` | `knowledge_base_products` | Maps features/benefits/use cases/competitive advantages, copies structured pricing info |
| `competition` | `knowledge_base_competitors` | Captures strengths, weaknesses, pricing model, positioning |
| `personas` | `knowledge_base_personas` | Preserves role metadata, optional `icp_id`, and structured messaging preferences |

Skipped rows are counted and reported (`skipReasons` map). Insert errors dump the payload to help debug bad data.

## 4. Deployment Checklist Summary

1. **Backup:** `npm run backup:create`
2. **Dry Run:** `npm run migrate:kb -- --dry-run`
3. **Migration:** `npm run migrate:kb`
4. **Verification:** rerun dry run (should report 0 transformed rows) + UI smoke test
5. **Monitoring:** watch Netlify + Supabase logs for 1 hour after deploy
6. **Rollback:** `npm run backup:rollback` (restores the DB snapshot)

Full checklist is stored in `DEPLOYMENT_CHECKLIST.md`.

## 5. Frontend / API Updates

- `/api/knowledge-base/{icps,products,competitors,personas}` expose CRUD endpoints with automatic workspace resolution
- `lib/supabase-knowledge.ts` provides typed helpers (`getICPs`, `getProducts`, `getCompetitors`, `getPersonas`, `getDocuments`)
- `app/components/KnowledgeBase.tsx` loads and renders structured data alongside legacy document uploads
- Quick-add buttons in each tab post directly to the new API routes

Any chat or automation flows should switch from legacy `knowledge_base` queries to the new helpers for richer context.

## 6. Verification Steps

1. **API smoke test (staging/prod):**
   - `GET /api/knowledge-base/icps`
   - `POST /api/knowledge-base/icps { "name": "Test" }`
   - `PUT /api/knowledge-base/icps { "id": "...", "name": "Updated" }`
   - `DELETE /api/knowledge-base/icps?id=...`
   (repeat for products/competitors/personas)

2. **UI smoke test:**
   - Knowledge Base → ICPs: add/edit/view structured card
   - Products tab: verify structured grid + quick add
   - Competition tab: confirm competitor entries render
   - Personas tab: confirm persona library shows structured data

3. **Chat:** Ask “What are our ICPs?” and confirm responses draw from the new tables (after chat flow uses `supabaseKnowledge` helpers).

## 7. Rollback Plan

If any issue is detected:

1. Restore the DB snapshot (`npm run backup:rollback`)
2. Redeploy the previous Netlify build (if necessary)
3. File an incident note including the migration log output

The migration script is idempotent (upsert on conflict). Re-running it after a rollback is safe once data issues are addressed.

## 8. Future Enhancements

- `--section=<section>` flag for targeted migrations
- Detailed audit logging per row migrated
- Scheduled job to keep structured tables in sync until all legacy writers are retired
- Extended UI forms (edit/delete rich fields rather than quick prompts)

With the structured schema in place, the knowledge base is ready for enterprise-scale use and advanced analytics.

## 9. Development Seed Script

For demos or staging environments, run `node scripts/seed-demo-knowledge-base.js` to populate the new tables with representative data. The script now seeds:

- `knowledge_base_icps` with two sample ICPs (Series A SaaS Sales Leaders, RevOps & GTM Agencies)
- `knowledge_base_products` with the SAM orchestrated outbound offer
- `knowledge_base_competitors` with Outreach.io and Apollo.io comparison notes
- `knowledge_base_personas` with personas tied to the seeded ICP records

It also refreshes the legacy `icp_configurations`, document vectors, and RAG summaries so chat responses remain coherent.

Environment requirements mirror the migration tool: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, and `WORKSPACE_ID` (optionally `SEED_UPLOADED_BY`). The script is idempotent—re-running it replaces prior seed rows for the same workspace.
