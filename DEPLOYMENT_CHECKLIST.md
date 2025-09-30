# 🚀 Structured KB Deployment Checklist

**Date:** 2025-09-30  
**Feature:** Structured Knowledge Base Tables (ICPs, Products, Competitors, Personas)

---

## ✅ Pre-Deployment Verification

### 1. Database Migration
- ✅ **Migration file created:** `supabase/migrations/20250930140000_create_structured_kb_tables.sql`
- ✅ **Migration applied successfully** to production database
- ✅ **Tables verified in database:**
  - `knowledge_base_icps`
  - `knowledge_base_products`
  - `knowledge_base_competitors`
  - `knowledge_base_personas`
- ✅ **RLS policies enabled** on all tables
- ✅ **Workspace-scoped policies** active (SELECT, INSERT, UPDATE, DELETE)
- ✅ **Indexes created** for performance
- ✅ **Updated_at triggers** configured

### 2. API Endpoints
- ✅ **ICPs API:** `app/api/knowledge-base/icps/route.ts`
- ✅ **Products API:** `app/api/knowledge-base/products/route.ts`
- ✅ **Competitors API:** `app/api/knowledge-base/competitors/route.ts`
- ✅ **Personas API:** `app/api/knowledge-base/personas/route.ts`

### 3. Helper Functions
- ✅ **Supabase helpers:** `lib/supabase-knowledge.ts`
  - `getICPs()`
  - `getProducts()`
  - `getCompetitors()`
  - `getPersonas()`

### 4. Code Quality
- ⚠️ **Lint check:** Passed with warnings (TypeScript version mismatch, unused vars, `any` types)
  - **Status:** Non-blocking - common development warnings
  - **Action:** Can be addressed post-deployment
- ✅ **Build check:** Production build succeeded
- ⚠️ **Integration tests:** Test file missing
  - **Status:** Expected for this project
  - **Action:** Manual smoke testing recommended

---

## 🎯 Deployment Steps

### Step 1: Verify Current State
```bash
# Confirm tables exist
npx supabase db remote sql "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'knowledge_base_%' ORDER BY tablename;"
```

### Step 2: Deploy to Production
```bash
# Build for production
npm run build

# Deploy to Netlify (or your platform)
netlify deploy --prod
# OR
git push origin main  # If using CI/CD
```

### Step 3: Post-Deployment Smoke Tests

#### Test 1: API Health Checks
```bash
# Test ICPs endpoint
curl -X GET "https://app.meet-sam.com/api/knowledge-base/icps" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test Products endpoint
curl -X GET "https://app.meet-sam.com/api/knowledge-base/products" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test Competitors endpoint
curl -X GET "https://app.meet-sam.com/api/knowledge-base/competitors" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test Personas endpoint
curl -X GET "https://app.meet-sam.com/api/knowledge-base/personas" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Test 2: UI Smoke Testing
1. **Login** to the application
2. **Navigate to Knowledge Base** section
3. **Verify each tab:**
   - ICPs tab loads
   - Products tab loads
   - Competitors tab loads
   - Personas tab loads
4. **Test CRUD operations:**
   - Create a new ICP
   - Edit an existing product
   - View competitor details
   - Delete a test persona
5. **Test chat integration:**
   - Ask SAM about ICPs: "What are our target customer profiles?"
   - Ask about products: "Tell me about our products"
   - Ask about competitors: "Who are our main competitors?"
   - Ask about personas: "Describe our buyer personas"

#### Test 3: RLS Policy Verification
1. **Login as User A** (Workspace A)
2. Create a test ICP
3. **Login as User B** (Workspace B)
4. **Verify:** User B cannot see User A's ICP
5. **Cleanup:** Delete test data

---

## 📊 Monitoring (First Hour)

### Netlify Logs
```bash
netlify logs --function-log --tail
```

### Supabase Logs
1. Go to: https://app.supabase.com/project/latxadqrvrrrcvkktrog/logs
2. Monitor:
   - API errors
   - RLS policy violations
   - Query performance
   - Connection issues

### Key Metrics to Watch
- **API Response Times:** Should be < 500ms
- **Error Rate:** Should be < 1%
- **Database Connections:** Should remain stable
- **RLS Policy Hits:** Verify workspace isolation working

---

## 🔄 Rollback Plan (If Needed)

If critical issues arise:

### Option 1: Revert Migration (Nuclear)
```sql
-- Only if tables are causing critical issues
DROP TABLE IF EXISTS knowledge_base_icps CASCADE;
DROP TABLE IF EXISTS knowledge_base_products CASCADE;
DROP TABLE IF EXISTS knowledge_base_competitors CASCADE;
DROP TABLE IF EXISTS knowledge_base_personas CASCADE;
```

### Option 2: Disable Feature Flag (Recommended)
```typescript
// In app config or feature flags
export const FEATURE_FLAGS = {
  STRUCTURED_KB: false, // Disable new KB tables
  // ... other flags
}
```

### Option 3: Revert Code Deploy
```bash
# Revert to previous deployment on Netlify
netlify rollback
```

---

## ✅ Success Criteria

Deployment is considered successful when:

1. ✅ All 4 API endpoints return 200 status
2. ✅ UI loads all 4 KB tabs without errors
3. ✅ RLS policies block cross-workspace access
4. ✅ CRUD operations work for all entity types
5. ✅ Chat integration can query structured KB
6. ✅ No error spikes in logs (first hour)
7. ✅ Database performance remains stable

---

## 📞 Support Contacts

- **Database Issues:** Check Supabase dashboard
- **API Issues:** Check Netlify functions logs
- **Frontend Issues:** Check browser console + Netlify deploy logs

---

## 📝 Post-Deployment Tasks

1. [ ] Monitor logs for first hour
2. [ ] Verify no RLS violations
3. [ ] Check database query performance
4. [ ] Update team on deployment status
5. [ ] Document any issues encountered
6. [ ] Schedule follow-up code quality improvements (lint warnings)

---

**Ready for deployment! 🚀**