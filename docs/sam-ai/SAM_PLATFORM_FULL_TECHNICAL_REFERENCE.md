# SAM Platform – Full Technical Reference

**Document version**: 1.0  \
**Last updated**: September 26, 2025  \
**Maintainer**: Codex CLI session (tvonlinz)

---

## Table of Contents
- [Purpose & Scope](#purpose--scope)
- [High-Level Architecture](#high-level-architecture)
- [Database Layer](#database-layer)
  - [Core Schemas](#core-schemas)
  - [Knowledge RAG Infrastructure](#knowledge-rag-infrastructure)
  - [Conversation Threads](#conversation-threads)
  - [n8n Automation Tables](#n8n-automation-tables)
  - [Security & RLS](#security--rls)
- [Application Layer](#application-layer)
  - [App Shell & Navigation](#app-shell--navigation)
  - [Authentication & Workspace Handling](#authentication--workspace-handling)
  - [Chat Experience](#chat-experience)
  - [Knowledge Base UX](#knowledge-base-ux)
  - [Campaign Hub](#campaign-hub)
  - [Supporting Components](#supporting-components)
- [API Surface](#api-surface)
  - [Chat Endpoints](#chat-endpoints)
  - [Knowledge Base Endpoints](#knowledge-base-endpoints)
  - [Lead & MCP Orchestration](#lead--mcp-orchestration)
  - [Third-Party Integrations](#third-party-integrations)
- [Model Context Protocol (MCP) Layer](#model-context-protocol-mcp-layer)
- [n8n Orchestration](#n8n-orchestration)
- [Knowledge Base Operations](#knowledge-base-operations)
- [Chat Retrieval-Augmented Generation (RAG)](#chat-retrieval-augmented-generation-rag)
- [Automation & Email Stack](#automation--email-stack)
- [Testing & Tooling](#testing--tooling)
- [Operational Considerations](#operational-considerations)
- [Known Gaps & TODOs](#known-gaps--todos)
- [Change Log](#change-log)

---

## Purpose & Scope
This document captures the end-to-end technical state of the SAM AI platform across:
- PostgreSQL/Supabase schema and migrations
- Next.js application structure and feature modules
- Knowledge Base ingestion, tagging, embedding, and retrieval
- Multi-agent MCP integration and automation orchestration
- n8n workflow infrastructure and supporting tables
- Chat interface behavior, fallbacks, and thread persistence
- Third-party touchpoints (OpenRouter, Mistral, ReachInbox, Unipile, Bright Data, Apify)

The goal is to provide a single source of truth for engineers onboarding to, operating, or extending the SAM codebase.

---

## High-Level Architecture
- **Frontend**: Next.js App Router with React 18 and TypeScript (`app/page.tsx`, `components/`). Styling relies on Tailwind CSS and shadcn primitives.
- **Backend**: Next.js route handlers (`app/api/**`). Heavy operations (knowledge ingestion, MCP orchestration) use Supabase service-role clients server-side.
- **Database**: Supabase Postgres with extensive migrations under `supabase/migrations/`. pgvector powers semantic search.
- **AI/LLM**: OpenRouter hosts Claude 3.7 Sonnet and Mistral models; fallback heuristics exist where keys are absent.
- **Automations**: n8n orchestrates campaigns; ReachInbox covers email send, Unipile for LinkedIn, Bright Data/Apify for prospect research.
- **Knowledge Base**: Multi-step ingestion pipeline (upload → AI tagging → vectorization) with Supabase storage and vector tables.
- **MCP Layer**: Central registry for agent integrations enabling consistent tool invocation from the orchestrator.

---

## Database Layer
### Core Schemas
- Foundational tables (workspaces, workspace_members, campaigns, etc.) created across migrations `20250923160000_create_workspace_tables.sql` and adjacent files.
- Tenant isolation enforced via RLS and policies in migrations `20250922140000_comprehensive_icp_configuration.sql` through `20250923070000_complete_multi_tenant_separation.sql`.

### Knowledge RAG Infrastructure
- `knowledge_base_documents` enriched with AI metadata, tagging, and status fields (`supabase/migrations/20250925133000_create_knowledge_rag_infra.sql:3`).
- `knowledge_base_vectors` stores chunked embeddings, tagged metadata, and references back to documents (`supabase/migrations/20250925133000_create_knowledge_rag_infra.sql:22`).
- `sam_knowledge_summaries` maintains lightweight summaries and tag sets per document for UI consumption (`supabase/migrations/20250925133000_create_knowledge_rag_infra.sql:48`).
- `document_ai_analysis` records each AI processing pass for auditing (`supabase/migrations/20250925133000_create_knowledge_rag_infra.sql:74`).
- `match_workspace_knowledge` SQL function performs vector similarity search with optional section filters (`supabase/migrations/20250925133000_create_knowledge_rag_infra.sql:102`).

### Conversation Threads
- Threading schema defined in `20250911_create_threaded_conversations.sql`, creating `sam_conversation_threads`, `sam_thread_messages`, and `sam_conversation_intelligence` tables with RLS and triggers (`supabase/migrations/20250911_create_threaded_conversations.sql:1`).
- Triggers update thread activity on message insert (`supabase/migrations/20250911_create_threaded_conversations.sql:133`).

### n8n Automation Tables
- `workflow_templates`, `workspace_n8n_workflows`, and `n8n_campaign_executions` store master workflows, per-workspace deployment, and execution metrics (`supabase/migrations/20250916000101_n8n_only_schema.sql:1`).
- Unique constraint ensures only one “active” workflow per workspace (`supabase/migrations/20250916000101_n8n_only_schema.sql:66`).

### Security & RLS
- Every new table enables Row Level Security with policies tying access to workspace membership (`supabase/migrations/20250925133000_create_knowledge_rag_infra.sql:36`, `supabase/migrations/20250911_create_threaded_conversations.sql:98`).
- Service-role policies allow backend route handlers to manage all records.

---

## Application Layer
### App Shell & Navigation
- The master view `app/page.tsx` orchestrates chat, tabs (Knowledge Base, Campaign Hub, Lead Pipeline, Analytics, Audit Trail), modals, and notifications (`app/page.tsx:1`).
- Supabase client component manages authentication state and workspace context (`app/page.tsx:47`).

### Authentication & Workspace Handling
- Uses Supabase Auth with session hydration via `createClientComponentClient` (`app/page.tsx:30`).
- Workspace selection stored on profiles (`users.current_workspace_id`) and enforced before KB uploads (`app/api/knowledge-base/upload-document/route.ts:37`).

### Chat Experience
- `handleSendMessage` maps slash keywords (#icp, #leads, #messaging) and funnels messages into thread endpoints (`app/page.tsx:945`).
- Conversation history sidebar uses `useSamThreadedChat` hook to fetch threads, filter by tags/priority, and load messages (`lib/hooks/useSamThreadedChat.ts:1`, `components/ConversationHistory.tsx:1`).

### Knowledge Base UX
- `app/components/KnowledgeBase.tsx` packages upload, AI tagging, vectorization, and status display. Steps call `/api/knowledge-base/upload-document`, `/process-document`, and `/vectorize-content` sequentially (`app/components/KnowledgeBase.tsx:35`).
- Document lists merge metadata from `knowledge_base_documents` and `sam_knowledge_summaries` (`app/api/knowledge-base/documents/route.ts:41`).

### Campaign Hub
- `app/components/CampaignHub.tsx` couples campaign configuration with inline “Chat with SAM” assistant for template generation (`app/components/CampaignHub.tsx:1414`). Manages message list, auto template application, and UI toggles.

### Supporting Components
- `components/ConnectionStatusBar.tsx` reflects integration health.
- `components/DemoModeToggle.tsx`, `components/InviteUserPopup.tsx`, `components/AuthModal.tsx` cover auxiliary workflows.

---

## API Surface
### Chat Endpoints
- `POST /api/sam/chat` handles unauthenticated quick replies, trying OpenRouter then keyword fallbacks (`app/api/sam/chat/route.ts:1`).
- `POST /api/sam/chat-simple` is a variant that always attempts OpenRouter and marks responses as simplified (`app/api/sam/chat-simple/route.ts:1`).
- `GET|POST /api/sam/threads/[threadId]/messages` persists conversational messages with Supabase service-role access and uses OpenRouter for assistant replies, falling back to templated copy if unavailable (`app/api/sam/threads/[threadId]/messages/route.ts:1`). Retrieval path pulls knowledge via `match_workspace_knowledge`.

### Knowledge Base Endpoints
- `POST /knowledge-base/upload-document` handles file/URL ingestion, validates workspace, and stores raw extracted content (`app/api/knowledge-base/upload-document/route.ts:1`). File parsing for PDF/DOCX/PPTX is stubbed.
- `POST /knowledge-base/process-document` triggers Mistral analysis via OpenRouter, returning tags, categories, and metadata; fallback uses word-frequency heuristics (`app/api/knowledge-base/process-document/route.ts:1`).
- `POST /knowledge-base/vectorize-content` chunks content, generates embeddings, and writes vectors/summaries (`app/api/knowledge-base/vectorize-content/route.ts:1`). Embedding failures fall back to deterministic pseudo vectors.
- `GET /knowledge-base/documents` fetches merged document metadata for the authenticated workspace (`app/api/knowledge-base/documents/route.ts:41`).
- `GET /knowledge-base/search` proxies to Supabase RPC `search_knowledge_base_sections` (`app/api/knowledge-base/search/route.ts:1`).

### Lead & MCP Orchestration
- `POST /api/leads/mcp-orchestrator` selects MCP agents, plans execution, aggregates results, and optionally triggers n8n workflows (`app/api/leads/mcp-orchestrator/route.ts:1`).
- Registry initialization ensures Bright Data, Apify, Unipile, ReachInbox, n8n, and other agents are ready before executing tasks.

### Third-Party Integrations
- Additional route handlers exist for Unipile OAuth flow (`app/api/unipile/**`), LinkedIn test connection, and knowledge base data operations (see `app/api/unipile/hosted-auth/route.ts` et al.).
- Email endpoints (e.g., invitation workflows) rely on Postmark and template rendering (`app/api/test/send-invitation-email/route.ts`).

---

## Model Context Protocol (MCP) Layer
- `lib/mcp/mcp-registry.ts` centralizes MCP server creation for Bright Data, Apify, Google Search, WebSearch, Unipile, n8n, ReachInbox, and Reply Agent, exposing tool catalogs (`lib/mcp/mcp-registry.ts:1`).
- `MCPAgentOrchestrator` plans multi-agent workflows, selecting research, intelligence, validation, and synthesis tasks per request volume/budget/compliance, and executes them with progress callbacks (`lib/mcp/agent-orchestrator.ts:1`).
- Each server (e.g., `lib/mcp/bright-data-mcp.ts`, `lib/mcp/n8n-mcp.ts`, `lib/mcp/reachinbox-mcp.ts`) lists tools and handles `tools/call` requests with error responses where integration fails.

---

## n8n Orchestration
- n8n MCP server exposes operations to list workflows, fetch details, create workflows, execute manually, and inspect execution history (`lib/mcp/n8n-mcp.ts:28`).
- Supabase schema tracks per-workspace deployment, channel/email/linkedin configuration, and execution success metrics (`supabase/migrations/20250916000101_n8n_only_schema.sql:41`).
- Campaign orchestrator optionally triggers n8n workflows when `auto_import_to_campaign` is specified in lead requests (`app/api/leads/mcp-orchestrator/route.ts:108`).

---

## Knowledge Base Operations
1. **Upload**: Authenticated user selects workspace and uploads file/URL (`app/components/KnowledgeBase.tsx:57`).
2. **Extraction**: Server saves temp file and performs basic text extraction (txt supported; PDF/DOCX/PPTX placeholder) (`app/api/knowledge-base/upload-document/route.ts:67`).
3. **AI Analysis**: Mistral via OpenRouter classifies tags, categories, summary, and metadata (`app/api/knowledge-base/process-document/route.ts:10`).
4. **Vectorization**: Chunks content, requests embeddings (`text-embedding-3-small`), stores vectors and metadata; fallback vector generated if embedding fails (`app/api/knowledge-base/vectorize-content/route.ts:29`).
5. **Summaries**: `sam_knowledge_summaries` updated to power quick display.
6. **Retrieval**: Chat endpoints call `match_workspace_knowledge` to pull context for assistant responses.

Scripts:
- `scripts/seed-demo-knowledge-base.js` seeds example documents using `.env.seed` configuration (`scripts/seed-demo-knowledge-base.js:1`).

---

## Chat Retrieval-Augmented Generation (RAG)
- `POST /api/sam/threads/[threadId]/messages` requests embeddings for user prompts (`createQueryEmbedding`) and queries `match_workspace_knowledge` for relevant snippets (`app/api/sam/threads/[threadId]/messages/route.ts:70`).
- OpenRouter call composes system prompt + conversation history + user message; fallback responses cover campaign, templates, analytics, revenue, competitor topics, or default greeting (`app/api/sam/threads/[threadId]/messages/route.ts:17`).
- Response metadata includes `aiPowered`, `fallback_mode`, and `model_used` flags for UI display.

---

## Automation & Email Stack
- ReachInbox MCP server manages email accounts, campaign launches, stats, and actions (`lib/mcp/reachinbox-mcp.ts:1`).
- Email invitation/testing endpoints use Postmark templates (`app/api/test/send-invitation-email/route.ts`).
- Unipile integration handles LinkedIn OAuth, account retrieval, and status checks (`app/api/unipile/**`).

---

## Testing & Tooling
- npm scripts: `npm run lint`, `npm run test:integration`, `npm run test:email`, `npm run seed:demo`, `npm run deploy:*` (see `package.json:6`).
- Monitoring scripts: `npm run monitoring:health|metrics|alerts` hitting production endpoints.
- Backups via `npm run backup:*` orchestrate snapshot logic defined in `docs/scripts/deployment/backup-rollback.js`.

---

## Operational Considerations
- **Env Requirements**: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `OPENROUTER_API_KEY`, MCP credentials (Bright Data, Apify, Unipile, ReachInbox), n8n base URL/API key.
- **Fallback Behavior**: Without OpenRouter, chat and knowledge ingestion degrade to heuristics; ensure keys exist in production.
- **File Processing**: Non-text knowledge uploads currently return placeholder strings—production requires pdf-parse/docx/pptx handlers.
- **Embedding Errors**: Synthetic fallback embeddings allow ingestion to proceed but degrade retrieval accuracy—monitor logs for repeated failures.
- **n8n Deployments**: Unique active workflow constraint means failed deployments may block reactivation; ensure status updates on failure paths.
- **Service Role Usage**: Some API routes rely on service-role keys (`process-document`, `vectorize-content`, thread messaging). Restrict public access and avoid exposing endpoints without auth.

---

## Known Gaps & TODOs
1. **Document Extraction**: Implement real parsers for PDF/DOCX/PPTX and sanitize HTML ingestion (`app/api/knowledge-base/upload-document/route.ts:15`).
2. **Embedding Retries**: Replace deterministic fallback vector with queued retry/job mechanism to maintain retrieval quality (`app/api/knowledge-base/vectorize-content/route.ts:29`).
3. **n8n Error Handling**: Add retries and status synchronization between `workspace_n8n_workflows` and n8n API responses (`lib/mcp/n8n-mcp.ts`).
4. **Thread Message Persistence**: When saving existing chat history via ConversationHistory, messages are not re-written to Supabase (`components/ConversationHistory.tsx:65`). Implement API writes.
5. **Rate Limiting & Abuse Protection**: Chat endpoints lack explicit throttling—add per-user limits to prevent runaway costs.
6. **Monitoring & Alerts**: Ensure `monitoring:*` scripts tie into dashboards; add alerts for OpenRouter failures and embedding fallback usage.
7. **Docs Sync**: Align this reference with `SAM_SYSTEM_TECHNICAL_OVERVIEW.md` to avoid divergence.

---

## Change Log
- **2025-09-26**: Initial comprehensive write-up covering database, app, knowledge base, chat, MCP, and automation systems.
