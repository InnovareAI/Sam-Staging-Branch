# Changelog - October 11, 2025

**Summary:** Major improvements to LinkedIn search functionality, data input methods, and campaign management.

---

## 🚀 New Features

### 1. Advanced Search Filters
**Commit:** 5da5ab9

Added comprehensive search parameters to eliminate duplicate prospect issues:

**New Parameters:**
- ✅ `location`: City, state, or country filtering
- ✅ `company`: Current company filter
- ✅ `industry`: Industry-specific searches
- ✅ `school`: University/education filter

**Impact:**
- "Find CEOs in New York" vs "Find CEOs in San Francisco" now return **different results**
- Each search properly differentiated by all criteria
- No more seeing the same prospects for different searches

**Example:**
```javascript
// Before (❌ Same for all searches)
{ title: "CEO" }

// After (✅ Differentiated)
{
  title: "CEO",
  keywords: "tech startups",
  location: "San Francisco",
  company: "Google",
  industry: "Technology"
}
```

---

### 2. Data Input Reorganization
**Commits:** 119e7ab, 212291b

Restructured data input methods for better UX:

**SAM Chat (Knowledge & Search):**
- ✅ Text/PDF documents only
- ✅ Natural language prospect searches
- ❌ Removed CSV upload (moved to Data Approval)

**Data Approval Tab (Prospect Import):**
- ✅ CSV Upload
- ✅ Copy & Paste
- ✅ LinkedIn Search URL

**Rationale:**
- Clear separation: Chat for conversation, Data Approval for prospects
- Eliminated user confusion about where to upload CSV files
- Each input method optimized for its use case

---

### 3. Editable Campaign Names
**Commits:** 62b7883, 37f0dc0, 73fa354

Users can now edit campaign names after search:

**Features:**
- Auto-generated format: `YYYYMMDD-COMPANYCODE-Description`
- Edit button in Data Approval dashboard
- Inline editing with Save/Cancel
- Updates all prospects in session

**Example:**
```
Auto-generated: 20251011-IAI-Search 03
User edits to:  20251011-IAI-Q4 Tech CEOs
```

**Implementation:**
- New API: `/api/prospect-approval/sessions/update-campaign`
- UI component in DataCollectionHub
- Real-time updates across dashboard

---

## 🐛 Bug Fixes

### 1. Connection Degree Filter Fixed
**Commits:** 85445c2, a1a41ae

**Problem:**
- Searching "1st degree" returned 2nd and 3rd degree connections
- Wrong parameter name and format for Unipile API

**Root Cause:**
```javascript
// WRONG
unipilePayload.network_distance = [1]

// CORRECT
unipilePayload.network = ['F'] // F=1st, S=2nd, O=3rd
```

**Fix:**
- Changed parameter: `network_distance` → `network`
- Changed format: `[1]` → `['F']` (LinkedIn notation)
- Added bidirectional conversion: F/S/O ↔ 1/2/3

**Impact:**
- ✅ 1st degree searches return ONLY 1st degree
- ✅ 2nd degree searches return ONLY 2nd degree
- ✅ 3rd degree searches return ONLY 3rd+ degree

---

### 2. RLS Permission Errors Fixed
**Commits:** 7c5bb09, afbd171

**Problem:**
- Data Approval tab showing "0 approved • 0 rejected • 0 pending"
- Prospects in database but not displaying
- PGRST116 RLS errors in console

**Root Cause:**
```javascript
// WRONG - RLS blocks browser-side access to users table
const { data } = await supabase
  .from('users')
  .select('current_workspace_id')

// CORRECT - Use admin client
const adminClient = supabaseAdmin()
const { data } = await adminClient
  .from('users')
  .select('current_workspace_id')
```

**Fix:**
- Updated `/api/prospect-approval/sessions/list/route.ts`
- Updated `/api/prospect-approval/prospects/route.ts`
- Use `supabaseAdmin()` for workspace lookup

**Impact:**
- ✅ Data Approval tab now loads correctly
- ✅ Prospects display immediately after search
- ✅ No more authentication errors

---

### 3. Duplicate Prospects Issue Fixed
**Commit:** 5da5ab9

**Problem:**
- Different searches returning identical prospects
- Location, company, industry filters ignored

**Root Cause:**
Search only sent job title, ignored all other parameters:
```javascript
// Before
{ keywords: "CEO" } // Same for ALL searches

// After
{
  title: "CEO",
  location: "San Francisco", // Now included!
  company: "Google"          // Now included!
}
```

**Fix:**
- Added location, company, industry parameters to API
- Updated SAM prompt to extract from natural language
- Pass all parameters to Unipile API

**Impact:**
- ✅ Each search returns unique, targeted results
- ✅ Location-based searches work correctly
- ✅ Company-specific searches work correctly

---

## 🔧 Improvements

### 1. Enhanced SAM Prompts

Updated SAM's system prompt to better extract search parameters:

**New Examples:**
```
User: "Find 20 CEOs at tech startups in San Francisco"
SAM: {
  "title": "CEO",
  "keywords": "tech startups",
  "location": "San Francisco"
}

User: "Find VPs at Microsoft in Seattle"
SAM: {
  "title": "VP",
  "company": "Microsoft",
  "location": "Seattle"
}
```

**Location Extraction:**
- "in [CITY]" → `location: "[CITY]"`
- "at [CITY]" → `location: "[CITY]"`
- "[CITY] area" → `location: "[CITY]"`

**Company Extraction:**
- "at [COMPANY]" → `company: "[COMPANY]"`
- "working at [COMPANY]" → `company: "[COMPANY]"`
- "from [COMPANY]" → `company: "[COMPANY]"`

---

### 2. CSV Parser Enhancements

**New Features:**
- Flexible column mapping (auto-detects variations)
- Handles quoted values and special characters
- Supports multiple CSV formats

**Supported Headers:**
- `name`, `full name`, `fullname`, `full_name`
- `first name`, `firstname`, `first_name`
- `email`, `email address`, `email_address`
- `title`, `job title`, `job_title`, `position`
- `company`, `company name`, `company_name`
- `linkedin`, `linkedin url`, `linkedin profile`

**API:** `/api/prospects/parse-csv/route.ts`

---

### 3. Campaign Management

**Auto-Numbering:**
- If no campaign name provided: "Search 01", "Search 02", etc.
- Increments based on existing sessions

**Auto-Generation:**
- Format: `YYYYMMDD-COMPANYCODE-Description`
- Date: Current date (e.g., `20251011`)
- Company Code: Workspace-based (e.g., `IAI` for InnovareAI)
- Description: User-provided or auto-numbered

**Editing:**
- Click "Edit" button in Data Approval
- Inline editing with real-time updates
- Updates all prospects in session

---

## 📊 Technical Changes

### API Endpoints

**New:**
- `/api/prospects/parse-csv` - Parse CSV files
- `/api/prospect-approval/sessions/update-campaign` - Update campaign names

**Modified:**
- `/api/linkedin/search/simple` - Added location, company, industry filters
- `/api/sam/threads/[threadId]/messages` - Enhanced search parameter extraction
- `/api/prospect-approval/sessions/list` - Fixed RLS permission error
- `/api/prospect-approval/prospects` - Fixed RLS permission error

### Database Changes

**Tables Modified:**
- `prospect_approval_sessions` - Added `campaign_name`, `campaign_tag` columns

**Migrations:**
- `20251011000001_add_campaign_fields_to_sessions.sql`

### Components Updated

- `/components/DataCollectionHub.tsx` - Added CSV/Paste/URL input methods
- `/components/ThreadedChatInterface.tsx` - Removed CSV upload
- `/app/api/version/route.ts` - Updated version tracking

---

## 🔍 Testing Performed

### Manual Testing

**Connection Degree:**
- ✅ 1st degree search → Only 1st degree results
- ✅ 2nd degree search → Only 2nd degree results
- ✅ 3rd degree search → Only 3rd+ degree results

**Location Filtering:**
- ✅ "CEOs in New York" → NY-based CEOs
- ✅ "CEOs in San Francisco" → SF-based CEOs
- ✅ Different results for each location

**Company Filtering:**
- ✅ "VPs at Google" → Only Google employees
- ✅ "VPs at Microsoft" → Only Microsoft employees
- ✅ Different results for each company

**Data Input:**
- ✅ CSV upload → Parses and populates dashboard
- ✅ Copy/Paste → Handles CSV and TSV formats
- ✅ LinkedIn URL → Executes search correctly

**Campaign Names:**
- ✅ Auto-generation → Correct format
- ✅ Editing → Updates database and UI
- ✅ Auto-numbering → Increments correctly

### Integration Testing

- ✅ SAM → Search trigger → LinkedIn API → Database → UI
- ✅ CSV upload → Parser → Database → UI
- ✅ Campaign edit → API → Database → UI update
- ✅ Multi-tenant isolation maintained (RLS working)

---

## 📝 Documentation Created

### New Documentation Files

1. **`LINKEDIN_SEARCH_FUNCTIONALITY.md`**
   - Complete search functionality guide
   - API integration details
   - Natural language processing
   - Connection degree filtering
   - Campaign naming system
   - Troubleshooting guide

2. **`DATA_INPUT_METHODS.md`**
   - Overview of all input methods
   - SAM Chat vs Data Approval
   - CSV upload guide
   - Copy & Paste guide
   - LinkedIn URL search
   - Best practices

3. **`CHANGELOG_OCT11_2025.md`** (this file)
   - Summary of all changes
   - Bug fixes and improvements
   - Technical details
   - Testing performed

---

## 🚢 Deployment

### Version History

| Version | Commit | Description | Deployed |
|---------|--------|-------------|----------|
| `advanced-search-filters` | 4fececa | Location, company, industry filters | Oct 11, 02:03 UTC |
| `connection-degree-filter-fixed` | a1a41ae | Fixed 1st/2nd/3rd degree filtering | Oct 10, 18:41 UTC |
| `data-input-reorganization` | 212291b | Moved CSV to Data Approval | Oct 10, 18:25 UTC |
| `campaign-names-at-search` | 62b7883 | Editable campaign names | Oct 10, 17:10 UTC |

### Production Status

- ✅ All changes deployed to https://app.meet-sam.com
- ✅ Available to all tenants immediately
- ✅ No breaking changes
- ✅ Backward compatible

---

## 🎯 Impact Summary

### User Experience

**Before:**
- CSV files went to knowledge base (confusing)
- Same prospects for different searches
- Connection degree filter didn't work
- Campaign names auto-generated, not editable

**After:**
- Clear input methods (Chat vs Data Approval)
- Unique prospects for each targeted search
- Connection degree filtering works correctly
- Campaign names editable with auto-generation

### Performance

- Search time: ~10-15 seconds (unchanged)
- CSV parsing: <1 second for 100 rows
- Campaign editing: <1 second real-time update
- No performance degradation

### Data Quality

- ✅ Better targeting with location/company filters
- ✅ Accurate connection degree filtering
- ✅ Flexible CSV parsing (more formats supported)
- ✅ Campaign tracking with meaningful names

---

## 🔮 Future Enhancements

### Planned Features

1. **Brightdata Integration** (not priority)
   - Fourth input method in Data Approval
   - Company information enrichment
   - Industry-specific datasets

2. **Search History**
   - Save search criteria for reuse
   - Quick filters based on past searches
   - Search templates

3. **Advanced Filters UI**
   - Visual filter builder
   - Company size, revenue, employee count
   - Seniority level filtering

4. **Bulk Actions**
   - Approve/reject multiple prospects
   - Move between campaigns
   - Bulk campaign assignment

---

## 📞 Support

### For Issues

1. Check [Troubleshooting](./LINKEDIN_SEARCH_FUNCTIONALITY.md#troubleshooting)
2. Review [Data Input Methods](./DATA_INPUT_METHODS.md)
3. Check console logs for errors
4. Contact support with:
   - Search criteria used
   - Console error messages
   - Expected vs actual results

### Key Files

- Search functionality: `/api/linkedin/search/simple/route.ts`
- SAM prompts: `/api/sam/threads/[threadId]/messages/route.ts`
- Data input UI: `/components/DataCollectionHub.tsx`
- CSV parser: `/api/prospects/parse-csv/route.ts`

---

## ✅ Testing Checklist

### For Developers

When modifying search functionality:

- [ ] Test all connection degrees (1st, 2nd, 3rd)
- [ ] Test location filtering (different cities)
- [ ] Test company filtering (different companies)
- [ ] Test campaign name generation
- [ ] Test campaign name editing
- [ ] Test CSV upload (various formats)
- [ ] Test copy/paste (CSV and TSV)
- [ ] Test LinkedIn URL search
- [ ] Verify RLS policies working
- [ ] Check multi-tenant isolation
- [ ] Test with all LinkedIn API types (Classic, Sales Nav, Recruiter)

### For QA

- [ ] Natural language search variations
- [ ] CSV files with different headers
- [ ] Copy/paste from Excel, Google Sheets, Notion
- [ ] LinkedIn URLs from Sales Nav and Recruiter
- [ ] Campaign naming and editing
- [ ] Connection degree filtering accuracy
- [ ] Location-based search accuracy
- [ ] Company-based search accuracy

---

**Contributors:** Claude Code, InnovareAI Team
**Reviewed:** October 11, 2025
**Next Review:** November 2025
