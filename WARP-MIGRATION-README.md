# Production Migration Package for WARP

This package contains everything needed to safely migrate the knowledge base system to a workspace-scoped architecture in production.

## 📦 Package Contents

```
.
├── WARP-MIGRATION-README.md              # This file
├── warp-production-migration-runbook.md  # Detailed step-by-step runbook
├── execute-production-migration.sh       # Automated execution script
└── migrations/
    ├── 03_backfill_workspace_ids.sql     # Assigns workspace IDs to existing KB entries
    ├── 04_seed_kb_sections.sql           # Creates default sections per workspace
    ├── 05_import_legacy_data.sql         # Imports legacy ICP/product/competitor/persona data
    └── 06_smoke_tests.sql                # Comprehensive test suite
```

## 🚀 Quick Start

### Option 1: Automated Execution (Recommended)

Run the automated script that guides you through the entire process:

```bash
./execute-production-migration.sh
```

This script will:
1. Verify prerequisites
2. Create a database backup
3. Run all migrations
4. Execute smoke tests
5. Guide you through manual verification

### Option 2: Manual Execution

If you prefer manual control, follow the detailed runbook:

1. Read `warp-production-migration-runbook.md`
2. Execute each SQL script in order
3. Verify results after each step

## ⚠️ Pre-requisites

Before starting the migration, ensure you have:

- [ ] Direct access to production PostgreSQL/Supabase database
- [ ] Supabase CLI installed (`npm install -g supabase`)
- [ ] PostgreSQL client tools installed (`psql`)
- [ ] Production database credentials
- [ ] At least 30 minutes of maintenance window
- [ ] Backup storage space available
- [ ] Team notification sent about maintenance window

## 📋 Migration Steps Overview

### Step 1: Backup (CRITICAL)
- Creates a full PostgreSQL dump
- Stores backup with timestamp
- Verifies backup size and integrity

### Step 2: Run Structural Migrations
- Applies schema changes via Supabase CLI or psql
- Adds workspace_id columns
- Updates foreign key constraints
- Enables RLS policies

### Step 3: Backfill Workspace IDs
- Assigns workspace_id to existing KB entries based on user associations
- Marks shared/global content appropriately
- Handles orphaned records

### Step 4: Seed KB Sections
- Creates 9 default sections for each workspace:
  - ICP (Ideal Customer Profile)
  - Products
  - Competitors
  - Personas
  - Value Props
  - Use Cases
  - Objections
  - Resources
  - General

### Step 5: Import Legacy Data (Optional)
- Migrates existing ICP data
- Imports product information
- Transfers competitor analysis
- Moves persona data
- Template-based (requires customization for your schema)

### Step 6: Smoke Tests
- Verifies table structure
- Checks data integrity
- Tests RLS policies
- Validates workspace distribution
- Confirms foreign key constraints
- Measures performance

## 🔍 What Each Script Does

### `03_backfill_workspace_ids.sql`
- **Purpose**: Assigns workspace context to existing knowledge base entries
- **Strategy**: Maps KB entries to workspaces via user associations
- **Safety**: Includes pre/post verification queries
- **Rollback**: Maintains NULL for shared content

### `04_seed_kb_sections.sql`
- **Purpose**: Creates organizational structure within each workspace
- **Sections**: 9 predefined categories with icons and descriptions
- **Idempotent**: Won't duplicate sections if re-run
- **Includes**: Performance indexes and helper views

### `05_import_legacy_data.sql`
- **Purpose**: Migrates data from legacy table structures
- **Flexible**: Template-based, adjust to your schema
- **Safe**: Includes error handling for missing tables
- **Tracked**: Metadata tags for imported records
- **Reversible**: Includes rollback function

### `06_smoke_tests.sql`
- **Purpose**: Comprehensive post-migration validation
- **Coverage**: 8 different test categories
- **Output**: Detailed results with warnings and errors
- **Performance**: Includes query performance analysis

## 🎯 Success Criteria

The migration is considered successful when:

- ✅ All database backups are created and verified
- ✅ All SQL scripts execute without errors
- ✅ Smoke tests pass with no critical failures
- ✅ Users can see only their workspace's KB entries
- ✅ New KB entries can be created and edited
- ✅ RLS policies prevent cross-workspace access
- ✅ All sections are visible and functional
- ✅ Application logs show no errors
- ✅ Performance metrics are normal

## 🚨 Rollback Plan

If anything goes wrong during migration:

### Immediate Rollback
```bash
# Restore from backup
psql $PROD_DB_URL < backups/backup_TIMESTAMP.sql
```

### Partial Rollback
If only the data imports failed:
```sql
-- Rollback specific import
SELECT rollback_legacy_import('legacy_icp_data');

-- Or rollback all imports
SELECT rollback_legacy_import();
```

## 📊 Expected Timeline

- **Backup**: 5-10 minutes (depends on database size)
- **Schema Migration**: 2-5 minutes
- **Workspace ID Backfill**: 5-10 minutes
- **Section Seeding**: 1-2 minutes
- **Legacy Import**: 5-15 minutes (if applicable)
- **Smoke Tests**: 2-3 minutes
- **Manual Verification**: 10-15 minutes

**Total**: ~30-60 minutes

## 🔐 Security Notes

- Database credentials are never logged
- Backup files contain sensitive data - store securely
- RLS policies enforce workspace isolation
- Test RLS thoroughly before declaring success

## 📞 Support

If you encounter issues during migration:

1. **Check the runbook** - Detailed troubleshooting steps included
2. **Review smoke test output** - Identifies specific problems
3. **Check application logs** - May reveal additional issues
4. **Database query logs** - Can show performance bottlenecks

## 📝 Post-Migration Checklist

After successful migration:

- [ ] Backup file stored securely
- [ ] Smoke test results reviewed
- [ ] Manual testing completed
- [ ] Application logs monitored for 24 hours
- [ ] Performance metrics checked
- [ ] Team notified of completion
- [ ] Documentation updated
- [ ] Migration marked complete in project management tool

## 🔄 Maintenance

After migration:

- Keep backup files for at least 7 days
- Monitor database size (new indexes increase storage)
- Watch for slow queries (run ANALYZE if needed)
- Check RLS policy performance after production load

## 📖 Additional Resources

- **Runbook**: `warp-production-migration-runbook.md` - Full detailed instructions
- **Supabase Docs**: https://supabase.com/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/

---

## 🎉 Ready to Migrate?

Run the automated script:
```bash
./execute-production-migration.sh
```

Or follow the manual runbook for step-by-step control.

**Good luck! 🚀**