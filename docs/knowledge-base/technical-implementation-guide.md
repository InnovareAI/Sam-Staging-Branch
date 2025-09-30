# Knowledge Base System – Technical Implementation Guide (Current Schema)

> **Last updated:** January 2025  
> **Status:** Reflects the production schema created by `20250923220000_direct_knowledge_base_creation.sql`

## Overview

The knowledge base currently deployed with Sam AI is a lightweight, global store that supplies conversational context, ICP templates, and rich campaign metadata. Until workplace-scoped tables are introduced, the system operates on four shared tables with permissive RLS policies. This guide documents the real schema so engineering, documentation, and product teams stay aligned.

## Database Architecture

### 1. `public.knowledge_base`
Plain-text entries grouped by category and subcategory.

```sql
CREATE TABLE public.knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    subcategory TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    version TEXT DEFAULT '4.4',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Indexes:
- `idx_knowledge_base_category`
- `idx_knowledge_base_active`
- `idx_knowledge_base_tags`
- `idx_knowledge_base_content_search`

RLS:
```sql
CREATE POLICY "Knowledge base is readable by all"
  ON public.knowledge_base FOR SELECT
  USING (is_active = true);

CREATE POLICY "Knowledge base is writable by authenticated users"
  ON public.knowledge_base FOR ALL TO authenticated
  USING (true);
```

### 2. `public.knowledge_base_sections`
Global list of sections shown in the UI / discovery flows.

```sql
CREATE TABLE public.knowledge_base_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Indexes: `idx_kb_sections_active`, `idx_kb_sections_sort`

RLS mirrors the `knowledge_base` table (read all, write authenticated).

### 3. `public.knowledge_base_content`
JSONB payloads keyed by section identifier.

```sql
CREATE TABLE public.knowledge_base_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id TEXT NOT NULL,
    content_type TEXT NOT NULL,
    title TEXT,
    content JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Indexes:
- `idx_kb_content_section`
- `idx_kb_content_type`
- `idx_kb_content_active`
- `idx_kb_content_tags`

### 4. `public.icp_configurations`
Global ICP templates leveraged by discovery and campaign generation.

```sql
CREATE TABLE public.icp_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    market_niche TEXT NOT NULL,
    industry_vertical TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active','testing','archived','draft')),
    priority TEXT DEFAULT 'secondary' CHECK (priority IN ('primary','secondary','experimental')),
    target_profile JSONB NOT NULL DEFAULT '{}',
    decision_makers JSONB NOT NULL DEFAULT '{}',
    pain_points JSONB NOT NULL DEFAULT '{}',
    buying_process JSONB NOT NULL DEFAULT '{}',
    messaging_strategy JSONB NOT NULL DEFAULT '{}',
    success_metrics JSONB NOT NULL DEFAULT '{}',
    advanced_classification JSONB NOT NULL DEFAULT '{}',
    market_intelligence JSONB NOT NULL DEFAULT '{}',
    performance_metrics JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    complexity_level TEXT DEFAULT 'medium' CHECK (complexity_level IN ('simple','medium','complex')),
    is_active BOOLEAN DEFAULT true,
    is_template BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    version TEXT DEFAULT '1.0'
);
```

Indexes: `idx_icp_configs_active`, `idx_icp_configs_status`, `idx_icp_configs_industry`, `idx_icp_configs_tags`

RLS policies again allow reads for any session and writes for authenticated users.

## Key Limitations (Known)

| Area | Current Behaviour | Impact |
|------|-------------------|--------|
| Workspace isolation | **Not implemented** (tables are global) | Any authenticated user could write to shared KB. Future migration must add `workspace_id` columns + strict RLS. |
| Document storage | No `knowledge_base_documents` table | File uploads and text extraction are not persisted. |
| Personas / products / competitors | No dedicated tables (`knowledge_base_products`, etc.) | Persona/product data must be stored inside `knowledge_base_content.content` JSON or the `knowledge_base` table. |
| Audit trail | No per-record author columns | Cannot currently attribute KB entries to users. |
| Search | Relies on `to_tsvector` index | Works for plain text; JSON search limited to manual filtering. |

## API Touchpoints

Although the schema is global, the API layer scopes requests by workspace and user session. Key routes:

- `POST /api/knowledge-base/sections` – returns `knowledge_base_sections`
- `POST /api/knowledge-base/content` – upserts entries in `knowledge_base_content`
- `POST /api/knowledge-base/search` – uses `search_knowledge_base` RPC
- `POST /api/knowledge-base/icps` – lists or mutates `icp_configurations`

The API enforces workspace context in application code (filtering by tags/metadata), so do **not** rely on database-level isolation.

## Usage Patterns

- **Discovery flows** write structured payloads to `knowledge_base_content` (with `section_id` such as `icp`, `products`, `objections`).
- **Campaign generator** reads from both `knowledge_base` (flat text) and JSON entries inside `knowledge_base_content`.
- **Industry blueprints** are stored as rows inside `icp_configurations` with `is_template = true`.

## Roadmap to Full Tenant Isolation

1. Add `workspace_id UUID REFERENCES workspaces(id)` to all four tables.
2. Backfill existing data by assigning a default workspace or splitting per tenant.
3. Update RLS policies to filter by `workspace_id` instead of the current permissive rules.
4. Re-introduce structured tables (`knowledge_base_products`, `knowledge_base_competitors`, etc.) now that tenant scoping is available.
5. Restore document storage (`knowledge_base_documents`) once storage buckets are ready.

> **Update (2025-09-30):** The structured schema is now live. See `docs/knowledge-base/STRUCTURED_KB_MIGRATION_GUIDE.md` for detailed migration, verification, and rollback procedures.

These steps will bring the database back in line with the Stage 3 specification without blocking current product work.

## Operational Notes

- The `version` column on `knowledge_base` rows is legacy metadata; it is safe to ignore for new features.
- The `search_knowledge_base` SQL function performs full-text search over `content` and `title`. JSON content currently requires client-side filtering.
- Because RLS is permissive, any new mutation endpoint must double-check authorization at the application layer (workspace membership, role, etc.).

## Summary

The knowledge base in production is intentionally slim. This document replaces older workspace-aware diagrams so engineers, writers, and operators reference the same reality. Future migrations can layer tenant isolation and richer structures without breaking existing behavior, but until then, treat the schema above as the single source of truth.
