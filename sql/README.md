# SQL Organization

This folder contains SQL scripts organized by purpose and status.

## Folder Structure

```
sql/
├── active/           # Currently used and maintained SQL scripts
│   ├── campaigns/    # Campaign-related schemas and queries
│   ├── knowledge-base/ # Knowledge base, RAG, and embeddings
│   ├── workspace/    # Workspace and multi-tenancy
│   ├── n8n/          # N8N workflow integrations
│   └── integrations/ # Third-party integrations (Unipile, etc)
├── deployments/      # Ready-to-deploy migration scripts
└── archive/          # Deprecated/old SQL files (kept for reference)
```

## How to Use

### Active Scripts
Scripts in `/active/` are currently in use and maintained. These are organized by feature area.

### Deployments
Scripts in `/deployments/` are ready to execute in Supabase Dashboard SQL Editor.

### Archive
Old or deprecated scripts for historical reference only.

## Current Active Scripts

### Knowledge Base
- **upgrade_embeddings_to_3072.sql** - Upgrades vector embeddings from 1536 to 3072 dimensions for better RAG quality

## Applying Migrations

1. Navigate to Supabase Dashboard: https://supabase.com/dashboard
2. Go to SQL Editor
3. Copy and paste the SQL file content
4. Execute

## Guidelines

- ✅ DO: Keep active scripts organized by feature
- ✅ DO: Add comments to explain what each migration does
- ✅ DO: Test migrations in staging before production
- ❌ DON'T: Mix deployment scripts with schema definitions
- ❌ DON'T: Delete old migrations (move to archive instead)
