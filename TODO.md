# Rolling TODO List - Sam AI Project

**Last Updated**: October 11, 2025

---

## 🔥 URGENT - Do Today

- [ ] Review ESLint warnings and clean up unused imports
- [ ] Test all LinkedIn search scenarios in production (1st/2nd/3rd degree, location filters)

---

## 📋 This Week

- [ ] **SAM UX Improvement**: Update SAM's prompt to suggest filter options for general searches
  - When user requests broad search (e.g., "Find CEOs"), SAM should ask clarifying questions
  - Suggest: location, company, industry, connection degree, etc.
  - Make searches more targeted and reduce irrelevant results
- [ ] Clean up ESLint warnings (50+ unused imports/variables across codebase)
- [ ] Fix TypeScript configuration warnings (4 tsconfig composite settings)
- [ ] Review and consolidate duplicate documentation files (120+ recent docs)

---

## 💡 Next Sprint

- [ ] Create safer version of toast replacement script (with proper validation)
- [ ] Implement automated tests for critical user flows
- [ ] Set up monitoring/alerting for production errors

---

## 🐛 Bugs to Fix

- [ ] ESLint: Unused imports in admin pages (deploy-unipile, sam-analytics, settings, superadmin)
- [ ] TypeScript: tsconfig.json composite settings warnings

---

## ✨ Feature Requests

### LinkedIn Search - Foundational Filters (High Priority)

**✅ Currently Implemented (7 filters):**
1. Connection degree (1st, 2nd, 3rd) - `network: ['F', 'S', 'O']`
2. Location (city, state, country) - `locations: [ids]`
3. Company (current company) - `current_company: [names]`
4. Industry - `industries: {include: [], exclude: []}`
5. School/University - `schools: [names]`
6. Job title - `title: string`
7. Keywords - `keywords: string`

**⬜ Ready to Implement - Prioritized:**

**Phase 1 - Quick Wins (This Week):**
- [ ] **SAM UX: Suggest filters for broad searches** - When user says "Find CEOs", SAM asks about location, company, industry
- [ ] **Profile Language** - `profile_language: ["en"]` (simple string array)
- [ ] **Tenure** (Years of Experience) - `tenure: [{min: 3, max: 10}]` (min/max object)

**Phase 2 - Medium Complexity (Next Sprint):**
- [ ] **Company Size** (Sales Navigator) - `headcount: [codes]` (requires Sales Nav account)
- [ ] **Role/Function with Scope** - `role: [{keywords: "...", priority: "MUST_HAVE", scope: "CURRENT_OR_PAST"}]`
- [ ] **Skills Filter** - `skills: [{id: "50517", priority: "MUST_HAVE"}]` (requires skill ID lookup service)
- [ ] **Build Parameter ID Lookup Service** - `/api/linkedin/search/parameters` wrapper for location/industry/skill IDs

**Phase 3 - Advanced (Future):**
- [ ] **Better Location/Industry** - Use IDs instead of names for more accurate filtering
- [ ] **Seniority Keywords** - Auto-detect "C-level OR VP OR Director" from natural language
- [ ] **Past Company Search** - Use `role.scope: "CURRENT_OR_PAST"` + keywords
- [ ] **Has Job Offers** - `has_job_offers: true` (companies actively hiring signal)

**🚫 Dropped (Not Available in Unipile):**
- ~~LinkedIn Group membership~~ - Not supported by Unipile API
- ~~Event participation~~ - Not supported by Unipile API

**Implementation Files:**
- API: `/app/api/linkedin/search/simple/route.ts`
- SAM Prompt: `/app/api/sam/threads/[threadId]/messages/route.ts`
- TypeScript: Update `search_criteria` interface
- Documentation: Update `LINKEDIN_SEARCH_FUNCTIONALITY.md`

**Testing:**
- Verify each new filter with test searches
- Update integration tests
- Test SAM's natural language extraction

---

## 📝 Documentation Needed

- [x] ~~Consolidate Oct 7 handover docs into single comprehensive guide~~ (superseded by Oct 11 docs)
- [x] Document LinkedIn search functionality - **COMPLETED** (LINKEDIN_SEARCH_FUNCTIONALITY.md)
- [x] Document data input methods - **COMPLETED** (DATA_INPUT_METHODS.md)
- [x] Create changelog for Oct 11 improvements - **COMPLETED** (CHANGELOG_OCT11_2025.md)
- [ ] Archive old implementation summaries to /docs/archive/
- [ ] Document production build fix process for future reference (Oct 8 toast script issue)

---

## 🔄 Refactoring / Tech Debt

- [ ] Remove unused toast imports from files that don't call toast functions
- [ ] Standardize error handling patterns across API routes
- [ ] Review and optimize component re-renders (React DevTools profiling)

---

## ✅ Recently Completed

### Week of Oct 11, 2025 (Today)
- [x] **LinkedIn Search Improvements**: Fixed connection degree filtering (1st/2nd/3rd now works correctly)
- [x] **Advanced Search Filters**: Added location, company, industry, school parameters
- [x] **Data Input Reorganization**: Removed CSV from SAM chat, added CSV/Paste/URL to Data Approval
- [x] **Fixed Duplicate Prospects**: Different searches now return unique results based on all criteria
- [x] **Campaign Management**: Added editable campaign names with auto-generation (YYYYMMDD-CODE-Description)
- [x] **RLS Fix**: Fixed permission errors in Data Approval using supabaseAdmin() for workspace lookups
- [x] **CSV Parser**: Created flexible CSV parser with multi-format column mapping
- [x] **Documentation**: Created 3 comprehensive docs (LINKEDIN_SEARCH_FUNCTIONALITY.md, DATA_INPUT_METHODS.md, CHANGELOG_OCT11_2025.md)
- [x] **Deployment**: Deployed all changes to production (commits: 5da5ab9, a1a41ae, 212291b, 62b7883, 4fececa)
- [x] Verified production site functional after all deployments

### Week of Oct 8, 2025
- [x] **CRITICAL**: Fixed production build failure caused by toast replacement script
- [x] Fixed 21 files with malformed imports (missing 'use client', missing React hooks)
- [x] Fixed ContactCenter.tsx malformed imports (commit 1e20cd1)
- [x] Added missing component imports (DemoModeToggle, ConnectionStatusBar, InviteUserPopup, etc.)
- [x] Fixed named vs default export issues (DemoModeToggle, UnipileModal, ChannelSelectionModal)
- [x] Added useSamThreadedChat and ThreadTagger imports to conversation history
- [x] Forced Netlify CDN cache clear (commit af7ef89)
- [x] **SECURITY**: Disabled dangerous toast replacement script (renamed to .DANGEROUS-DO-NOT-USE)
- [x] Verified LinkedIn integration intact (22KB file, last modified Oct 1)
- [x] Verified SAM conversation history functional
- [x] Ran TypeScript type checking (only tsconfig warnings, no code errors)
- [x] Ran ESLint audit (50+ warnings identified, non-critical)

### Week of Oct 2, 2025
- [x] Cleaned CLAUDE.md (924KB → 19KB, 98% reduction)
- [x] Set up .claude-code-settings.json with directory restrictions
- [x] Created .claudeignore to reduce context consumption

---

## 📦 Archived Completed Items

When a section gets too long (>20 items), move completed items to:
`/docs/archive/TODO_ARCHIVE_YYYY_MM.md`

---

## 🚨 Production Status

**Site**: https://app.meet-sam.com
**Status**: ✅ FULLY OPERATIONAL
**Latest Deploy**: commit 4fececa (Oct 11, 2025 - advanced-search-filters)
**Build Status**: Passing
**Critical Features**:
- ✅ Authentication working
- ✅ Workspace loading (8 workspaces)
- ✅ LinkedIn search with advanced filters (location, company, industry)
- ✅ Connection degree filtering (1st/2nd/3rd) working correctly
- ✅ Data Approval with CSV/Paste/URL input methods
- ✅ Editable campaign names with auto-generation
- ✅ SAM conversation history functional
- ✅ All modals and components rendering

**Recent Deployments**:
- Oct 11: Advanced search filters (location, company, industry) - **LIVE**
- Oct 11: Connection degree filter fix (F/S/O notation) - **LIVE**
- Oct 11: Data input reorganization (CSV to Data Approval) - **LIVE**
- Oct 11: Editable campaign names - **LIVE**

**Recent Issues**:
- Oct 11: Duplicate prospects from different searches - **RESOLVED**
- Oct 11: Connection degree filter not working - **RESOLVED**
- Oct 11: RLS permission errors in Data Approval - **RESOLVED**
- Oct 8: Toast replacement script broke 21 files - **RESOLVED**
- Oct 8: CDN caching prevented latest deploy - **RESOLVED**

---

## Usage Guidelines

### For Claude Code:
1. **Start of session**: Claude reads this file to understand current priorities
2. **During session**: Update this file as tasks are completed or added
3. **End of session**: Move completed items to "Recently Completed"

### For You:
- Keep "URGENT" section small (3-5 items max)
- Archive completed items monthly
- Be specific with task descriptions

### What NOT to Put Here:
- Detailed implementation notes (use separate design docs)
- Long code snippets (reference files instead)
- Historical context (use archive files)

---

## Related Files

- **Active Tasks**: This file (`TODO.md`)
- **Setup Guide**: `CLAUDE_CODE_SETUP.md`
- **Project Instructions**: `CLAUDE.md`
- **Archive**: `/docs/archive/TODO_ARCHIVE_*.md`
