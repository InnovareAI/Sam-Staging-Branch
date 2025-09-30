# Post-Migration Checklist & Action Items

**Migration Completed:** 2025-09-30 02:27 UTC  
**Status:** Database migration successful, application work in progress

---

## 🚨 CRITICAL - Do Before Production

### 1. Enable RLS Policies ⚠️ HIGH PRIORITY
**Status:** ❌ NOT IMPLEMENTED  
**Risk:** Without RLS, all workspaces can see each other's data

```sql
-- Enable RLS on tables
ALTER TABLE knowledge_base_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_sections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see content from their workspace
CREATE POLICY "Users can view own workspace KB content"
ON knowledge_base_content
FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id 
    FROM workspace_accounts 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Users can only insert content to their workspace
CREATE POLICY "Users can insert own workspace KB content"
ON knowledge_base_content
FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id 
    FROM workspace_accounts 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Users can update content in their workspace
CREATE POLICY "Users can update own workspace KB content"
ON knowledge_base_content
FOR UPDATE
USING (
  workspace_id IN (
    SELECT workspace_id 
    FROM workspace_accounts 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id 
    FROM workspace_accounts 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Users can delete content from their workspace
CREATE POLICY "Users can delete own workspace KB content"
ON knowledge_base_content
FOR DELETE
USING (
  workspace_id IN (
    SELECT workspace_id 
    FROM workspace_accounts 
    WHERE user_id = auth.uid()
  )
);

-- Similar policies for knowledge_base_sections
CREATE POLICY "Users can view own workspace sections"
ON knowledge_base_sections
FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id 
    FROM workspace_accounts 
    WHERE user_id = auth.uid()
  )
);
```

**Test:** After implementing, verify users can only see their workspace data.

---

## 📋 Application Code Updates

### 2. Update KB Write Paths
**Status:** 🔄 IN PROGRESS  

**Files to Update:**
- [ ] `app/api/knowledge-base/route.ts` - Add workspace_id to all writes
- [ ] `lib/services/knowledge-base.ts` - Pass workspace context
- [ ] `components/kb/CreateKBEntry.tsx` - Include workspace_id in form
- [ ] `hooks/useKnowledgeBase.ts` - Filter by workspace_id

**Pattern to follow:**
```typescript
// Before
const { data } = await supabase
  .from('knowledge_base_content')
  .insert({ title, content })

// After
const { data } = await supabase
  .from('knowledge_base_content')
  .insert({ 
    title, 
    content,
    workspace_id: currentWorkspace.id 
  })
```

### 3. Update KB Read Paths
**Status:** 🔄 IN PROGRESS

**Files to Update:**
- [ ] `app/api/knowledge-base/route.ts` - Filter by workspace_id
- [ ] `lib/services/knowledge-base.ts` - Add workspace filter
- [ ] `components/kb/KBList.tsx` - Show only workspace KB

**Pattern to follow:**
```typescript
// Before
const { data } = await supabase
  .from('knowledge_base_content')
  .select('*')

// After
const { data } = await supabase
  .from('knowledge_base_content')
  .select('*')
  .eq('workspace_id', currentWorkspace.id)
```

---

## 🗄️ New Structured Tables

### 4. Wire Up Structured Tables
**Status:** ⏳ TODO

Tables to implement:
- [ ] `knowledge_base_products` - Rich product data
- [ ] `knowledge_base_competitors` - Competitor analysis
- [ ] `knowledge_base_personas` - User personas
- [ ] `knowledge_base_icps` - ICP definitions
- [ ] `knowledge_base_documents` - Document attachments

**Check if tables exist:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'knowledge_base_%';
```

**Next steps:**
1. Create migration files if tables don't exist
2. Add TypeScript types for each table
3. Create API endpoints for CRUD operations
4. Build UI components for each data type

---

## 🧪 Testing & Validation

### 5. Update Tests
**Status:** ⏳ TODO

- [ ] Update seed scripts to include workspace_id
- [ ] Add tests for workspace isolation
- [ ] Test RLS policy enforcement
- [ ] Add E2E tests for each workspace

**Test files to update:**
```
tests/
├── kb/workspace-isolation.test.ts (NEW)
├── kb/sections.test.ts (UPDATE)
├── kb/content.test.ts (UPDATE)
└── e2e/kb-flows.spec.ts (UPDATE)
```

### 6. End-to-End Testing Plan
**Status:** ⏳ TODO

For each workspace:
- [ ] 3cubed Workspace
- [ ] ChillMine Workspace  
- [ ] InnovareAI Workspace
- [ ] Sendingcell Workspace
- [ ] WT Matchmaker Workspace

**Test scenarios:**
1. Login as user in workspace
2. Navigate to Knowledge Base
3. Verify sections are visible (9 for most, 20 for InnovareAI)
4. Create new KB entry
5. Edit existing entry
6. Verify cannot see other workspace's entries
7. Test search within KB
8. Test section filtering

---

## 📊 Monitoring (24-Hour Window)

### 7. Application Monitoring
**Status:** 🔄 ACTIVE

**What to monitor:**
- [ ] Error logs in Next.js console
- [ ] Supabase logs for failed queries
- [ ] API response times
- [ ] Failed authentication attempts
- [ ] Database connection errors

**Commands:**
```bash
# Check Next.js logs
npm run build && npm start 2>&1 | tee logs/app_$(date +%Y%m%d).log

# Monitor Supabase logs
supabase logs --tail

# Check for errors
grep -i "error\|fail\|exception" logs/app_*.log
```

### 8. Database Monitoring
**Status:** 🔄 ACTIVE

**Queries to run periodically:**
```sql
-- Check for new orphaned records
SELECT 'Orphaned KB Content' as type, COUNT(*) 
FROM knowledge_base_content kb
LEFT JOIN workspaces w ON w.id = kb.workspace_id
WHERE kb.workspace_id IS NOT NULL AND w.id IS NULL;

-- Monitor KB growth
SELECT 
    w.name,
    COUNT(kbc.id) as content_count
FROM workspaces w
LEFT JOIN knowledge_base_content kbc ON kbc.workspace_id = w.id
GROUP BY w.id, w.name;

-- Check for slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE query LIKE '%knowledge_base%'
ORDER BY mean_time DESC
LIMIT 10;
```

---

## 🔍 RLS Behavior Checks

### 9. Verify RLS Enforcement
**Status:** ⏳ TODO (AFTER RLS ENABLED)

**Test cases:**
```sql
-- Set user context (replace with actual user ID)
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "user-uuid-here"}';

-- Should only see their workspace's content
SELECT COUNT(*) FROM knowledge_base_content;

-- Reset
RESET role;
```

**Application-level tests:**
- [ ] User A cannot see User B's workspace KB
- [ ] User A cannot create KB in User B's workspace
- [ ] User A cannot update/delete User B's KB entries
- [ ] Service role (admin) can see all workspaces

---

## 📈 Performance Optimization

### 10. Index Verification
**Status:** ✅ COMPLETE (indexes exist)

Existing indexes:
- ✅ `idx_kb_content_workspace_section` on (workspace_id, section_id)
- ✅ `idx_kb_sections_workspace` on workspace_id

**Monitor index usage:**
```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename LIKE 'knowledge_base%'
ORDER BY idx_scan DESC;
```

---

## 🎯 Priority Order

1. **CRITICAL - Enable RLS policies** (30 min)
2. **HIGH - Update write paths with workspace_id** (2-3 hours)
3. **HIGH - Update read paths with workspace filter** (2-3 hours)
4. **MEDIUM - Run E2E tests across all workspaces** (1-2 hours)
5. **MEDIUM - Update test suites** (2-3 hours)
6. **LOW - Wire up structured tables** (ongoing, as needed)
7. **LOW - Performance monitoring & optimization** (ongoing)

---

## 📝 Notes & Observations

### Current State (Post-Migration)
- ✅ 5 workspaces with proper sections
- ✅ All KB content has workspace_id
- ✅ Backup created and stored
- ⚠️ RLS not enabled yet
- ⚠️ Application code may not be enforcing workspace isolation

### Risks to Address
1. **No RLS = data leakage risk** - Fix immediately
2. Application may allow cross-workspace access
3. Need to verify all API routes enforce workspace context

### Questions for Later
- Do we need a "shared/global" KB category?
- Should admins have cross-workspace access?
- How to handle workspace transfers/migrations?

---

## 📞 Escalation

If you encounter:
- **Data leakage** between workspaces → Stop, enable RLS immediately
- **Performance degradation** → Check slow query log
- **Failed writes** after RLS → Review policy WITH CHECK conditions
- **Auth errors** → Verify workspace_accounts relationships

---

**Last Updated:** 2025-09-30 02:30 UTC  
**Next Review:** After RLS implementation and initial testing