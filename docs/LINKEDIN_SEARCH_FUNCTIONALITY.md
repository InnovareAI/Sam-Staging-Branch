# LinkedIn Search Functionality - Complete Guide

**Last Updated:** October 11, 2025
**Status:** Production
**Version:** advanced-search-filters

---

## Table of Contents

1. [Overview](#overview)
2. [Search Architecture](#search-architecture)
3. [Search Parameters](#search-parameters)
4. [Natural Language Processing](#natural-language-processing)
5. [API Integration](#api-integration)
6. [Connection Degree Filtering](#connection-degree-filtering)
7. [Campaign Naming System](#campaign-naming-system)
8. [Troubleshooting](#troubleshooting)

---

## Overview

SAM AI's LinkedIn search functionality enables users to find and import prospects from LinkedIn using natural language queries. The system automatically extracts search criteria, sends requests to LinkedIn via Unipile API, and populates the Data Approval dashboard with results.

### Key Features

- **Natural Language Search**: Convert conversational requests into structured search queries
- **Advanced Filtering**: Location, company, industry, job title, connection degree
- **Auto-Detection**: Automatically detects LinkedIn capabilities (Classic, Sales Navigator, Recruiter)
- **Campaign Management**: Automatic campaign naming with YYYYMMDD-COMPANYCODE-Description format
- **Real-Time Results**: Prospects populate Data Approval tab in 10-15 seconds

---

## Search Architecture

### Flow Diagram

```
User Message
    ↓
SAM AI (Claude 3.5 Sonnet)
    ↓
Extract Search Criteria
    ↓
#trigger-search:{JSON}
    ↓
/api/linkedin/search/simple
    ↓
Unipile LinkedIn API
    ↓
Parse & Store Results
    ↓
Data Approval Dashboard
```

### Components

1. **Frontend**: SAM chat interface (`/components/ThreadedChatInterface.tsx`)
2. **AI Processing**: SAM system prompt (`/api/sam/threads/[threadId]/messages/route.ts`)
3. **Search Endpoint**: LinkedIn search API (`/api/linkedin/search/simple/route.ts`)
4. **Integration Layer**: Unipile API client
5. **Database**: Supabase PostgreSQL with RLS
6. **UI Display**: Data Approval Hub (`/components/DataCollectionHub.tsx`)

---

## Search Parameters

### Supported Parameters

| Parameter | Type | Description | Example | Required |
|-----------|------|-------------|---------|----------|
| `title` | string | Job title to search for | "CEO", "VP Sales", "CTO" | Yes |
| `keywords` | string | Additional search keywords | "tech startups", "SaaS" | No |
| `location` | string | City, state, or country | "San Francisco", "New York" | No |
| `company` | string | Current company filter | "Google", "Microsoft" | No |
| `industry` | string | Industry filter | "Technology", "Healthcare" | No |
| `school` | string | University/school filter | "Stanford", "MIT" | No |
| `connectionDegree` | string | Connection degree | "1st", "2nd", "3rd" | No |
| `targetCount` | number | Number of prospects | 20, 50, 100 | No (default: 50) |
| `campaignName` | string | Campaign description | "Q4 Outreach" | Yes |

### Parameter Extraction Examples

```javascript
// Example 1: Location + Keywords
User: "Find 20 CEOs at tech startups in San Francisco"
SAM extracts: {
  title: "CEO",
  keywords: "tech startups",
  location: "San Francisco",
  targetCount: 20
}

// Example 2: Company + Location
User: "Find VPs at Microsoft in Seattle"
SAM extracts: {
  title: "VP",
  company: "Microsoft",
  location: "Seattle"
}

// Example 3: Connection Degree + Industry
User: "Find 30 CTOs from my 1st degree network in fintech"
SAM extracts: {
  title: "CTO",
  keywords: "fintech",
  connectionDegree: "1st",
  targetCount: 30
}
```

---

## Natural Language Processing

### SAM's Search Extraction Rules

SAM AI uses Claude 3.5 Sonnet to extract search criteria from natural language. The system prompt includes:

#### Extraction Patterns

**Job Titles:**
- "CEOs" → `title: "CEO"`
- "VP Sales" → `title: "VP Sales"`
- "Chief Technology Officers" → `title: "CTO"`

**Location Indicators:**
- "in [CITY]" → `location: "[CITY]"`
- "at [CITY]" → `location: "[CITY]"`
- "[CITY] area" → `location: "[CITY]"`

**Company Indicators:**
- "at [COMPANY]" → `company: "[COMPANY]"`
- "working at [COMPANY]" → `company: "[COMPANY]"`
- "from [COMPANY]" → `company: "[COMPANY]"`

**Connection Degree:**
- "1st degree", "my network", "connections" → `connectionDegree: "1st"`
- "2nd degree", "connections of connections" → `connectionDegree: "2nd"`
- "3rd degree", "out of network" → `connectionDegree: "3rd"`

#### Trigger Format

```javascript
#trigger-search:{
  "title": "CEO",
  "keywords": "SaaS B2B",
  "location": "San Francisco",
  "company": "Google",
  "industry": "Technology",
  "connectionDegree": "1st",
  "targetCount": 50,
  "campaignName": "Q4 SF Tech"
}
```

---

## API Integration

### Unipile LinkedIn API

**Endpoint:** `https://api6.unipile.com:13443/api/v1/linkedin/search`

#### Request Format

```javascript
POST /api/v1/linkedin/search?account_id={ACCOUNT_ID}&limit={LIMIT}

Headers:
  X-API-KEY: {UNIPILE_API_KEY}
  Content-Type: application/json

Body:
{
  "api": "sales_navigator", // or "recruiter" or "classic"
  "category": "people",
  "title": "CEO",
  "keywords": "tech startups",
  "locations": ["San Francisco"],
  "current_company": ["Google"],
  "industries": ["Technology"],
  "schools": ["Stanford"],
  "network": ["F"] // F=1st, S=2nd, O=3rd
}
```

#### Connection Degree Mapping

LinkedIn uses letter codes for connection degrees:

| User Input | SAM Format | Unipile Format | Description |
|-----------|------------|----------------|-------------|
| "1st" or "1" | `connectionDegree: "1st"` | `network: ["F"]` | First-degree connections |
| "2nd" or "2" | `connectionDegree: "2nd"` | `network: ["S"]` | Second-degree connections |
| "3rd" or "3" | `connectionDegree: "3rd"` | `network: ["O"]` | Out of network (3rd+) |

#### Auto-Detection Logic

The system automatically detects LinkedIn account capabilities:

```javascript
// Check premium features from account info
const premiumFeatures = accountInfo.connection_params?.im?.premiumFeatures || [];

if (premiumFeatures.includes('recruiter')) {
  api = 'recruiter'; // Can search up to 100 prospects
} else if (premiumFeatures.includes('sales_navigator')) {
  api = 'sales_navigator'; // Can search up to 100 prospects
} else {
  api = 'classic'; // Limited to 50 prospects
}
```

#### Response Format

```javascript
{
  "items": [
    {
      "first_name": "John",
      "last_name": "Doe",
      "headline": "CEO at Tech Startup",
      "current_positions": [{
        "role": "CEO",
        "company": "Tech Startup Inc."
      }],
      "profile_url": "https://linkedin.com/in/johndoe",
      "network": "F" // Connection degree
    }
    // ... more items
  ]
}
```

---

## Connection Degree Filtering

### How It Works

1. **User Specifies Degree:**
   - "Find CEOs from my 1st degree network"
   - "Find VPs from 2nd degree connections"

2. **SAM Extracts:**
   ```javascript
   connectionDegree: "1st" // or "2nd" or "3rd"
   ```

3. **API Converts:**
   ```javascript
   // Convert to Unipile format
   const degreeMap = {
     '1st': ['F'],  // First
     '2nd': ['S'],  // Second
     '3rd': ['O']   // Out of network
   };
   unipilePayload.network = degreeMap[connectionDegree];
   ```

4. **Results Filtered:**
   - Unipile returns ONLY prospects matching the specified degree
   - Stored in database with numeric degree (1, 2, or 3)

### Common Issues & Fixes

**Problem:** Getting 2nd degree when asking for 1st
- **Cause:** Wrong parameter name or format
- **Fix:** Use `network: ['F']` not `network_distance: [1]`

**Problem:** All prospects show same degree
- **Cause:** Hardcoded connection degree
- **Fix:** Extract actual degree from Unipile response: `item.network`

---

## Campaign Naming System

### Format

```
YYYYMMDD-COMPANYCODE-Description
```

### Components

1. **Date (YYYYMMDD):**
   - Auto-generated from current date
   - Example: `20251011` for October 11, 2025

2. **Company Code (3 letters):**
   - Auto-generated from workspace name
   - Extraction rules:
     - Extract uppercase letters from camelCase (e.g., "InnovareAI" → "IAI")
     - If starts with number (e.g., "3Cubed" → "3CU")
     - Otherwise, first 3 letters uppercase (e.g., "SendingCell" → "SEN")

3. **Description:**
   - User-provided campaign name
   - If not provided, auto-numbered: "Search 01", "Search 02", etc.

### Examples

```javascript
// User provides name
Workspace: "InnovareAI Workspace"
User input: "Q4 Tech CEOs"
Result: "20251011-IAI-Q4 Tech CEOs"

// Auto-numbered
Workspace: "3Cubed"
No user input (2nd search)
Result: "20251011-3CU-Search 02"

// Editable in UI
User can click "Edit" in Data Approval tab to change:
"20251011-IAI-Search 03" → "20251011-IAI-Winter Campaign"
```

### Implementation

**Generation Code:**
```javascript
// Generate workspace code
const generateCompanyCode = (name: string): string => {
  if (!name) return 'CLI';
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, '');
  const capitals = cleanName.match(/[A-Z]/g);
  if (capitals && capitals.length >= 3) {
    return capitals.slice(0, 3).join('');
  }
  if (/^\d/.test(cleanName)) {
    return (cleanName.substring(0, 1) + cleanName.substring(1, 3).toUpperCase()).padEnd(3, 'X');
  }
  return cleanName.substring(0, 3).toUpperCase().padEnd(3, 'X');
};

// Generate campaign name
const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
const companyCode = generateCompanyCode(workspace.name);
let campaignName: string;

if (search_criteria.campaignName) {
  campaignName = `${today}-${companyCode}-${search_criteria.campaignName}`;
} else {
  const { count } = await supabase
    .from('prospect_approval_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);
  const searchNumber = String((count || 0) + 1).padStart(2, '0');
  campaignName = `${today}-${companyCode}-Search ${searchNumber}`;
}
```

---

## Troubleshooting

### Common Issues

#### 1. No Results Found

**Symptoms:**
- Search completes but 0 prospects
- "No prospects found" message

**Possible Causes:**
- LinkedIn account not connected
- Search criteria too restrictive
- Account doesn't have access to network degree

**Solutions:**
```bash
# Check LinkedIn connection
GET /api/linkedin/check-connection

# Verify account capabilities
GET /api/unipile/accounts

# Broaden search criteria
# Instead of: title="CEO" + location="Palo Alto" + company="Google"
# Try: title="CEO" + keywords="Google"
```

#### 2. Same Prospects Every Time

**Symptoms:**
- Different searches return identical results
- Location/company filters ignored

**Cause:**
- Search parameters not being extracted or sent to API

**Fix:**
- Check console logs for `🔵 Received search_criteria:` and `🔵 Unipile payload:`
- Verify all parameters present in payload
- Ensure SAM extracts location/company from natural language

#### 3. Wrong Connection Degree

**Symptoms:**
- Asked for 1st degree, got 2nd/3rd
- All prospects show same degree

**Cause:**
- Wrong parameter format sent to Unipile
- Using `network_distance` instead of `network`

**Fix:**
```javascript
// WRONG
unipilePayload.network_distance = [1]

// CORRECT
unipilePayload.network = ['F'] // F=1st, S=2nd, O=3rd
```

#### 4. Authentication Errors

**Symptoms:**
- "Authentication required" error
- 401 Unauthorized responses

**Cause:**
- Cookie not forwarded from SAM to search endpoint
- User session expired

**Fix:**
```javascript
// Ensure cookies forwarded
const allCookies = cookieStore.getAll();
const cookieHeader = allCookies.map(c => `${c.name}=${c.value}`).join('; ');

fetch('/api/linkedin/search/simple', {
  headers: { 'Cookie': cookieHeader }
});
```

### Debug Checklist

When search isn't working:

- [ ] Check LinkedIn account connected: `/api/linkedin/check-connection`
- [ ] Verify workspace ID exists in database
- [ ] Check console logs for search criteria extraction
- [ ] Verify Unipile payload includes all parameters
- [ ] Check network parameter format (F/S/O not 1/2/3)
- [ ] Verify RLS policies allow data access
- [ ] Check approval session created successfully
- [ ] Verify prospects inserted into database

### Logging

Enable detailed logging:

```javascript
// In /api/linkedin/search/simple/route.ts
console.log('🔵 Received search_criteria:', JSON.stringify(search_criteria));
console.log('🔵 Unipile payload:', JSON.stringify(unipilePayload));
console.log('🔵 Unipile response:', JSON.stringify(data).substring(0, 500));
console.log(`✅ Mapped ${prospects.length} prospects`);
```

View logs:
- **Local:** Check terminal running `npm run dev`
- **Production:** `netlify logs:function --name=linkedin-search-simple`

---

## Best Practices

### For Users

1. **Be Specific:** Include location, company, or industry for better results
   - Good: "Find CEOs at tech startups in San Francisco"
   - Better: "Find CEOs at B2B SaaS companies in San Francisco from my 1st degree network"

2. **Campaign Names:** Use descriptive names for easy tracking
   - Good: "Q4 Outreach"
   - Better: "Q4 2025 SF Tech CEOs"

3. **Connection Degree:** Specify when you want targeted reach
   - 1st degree: Warm outreach, higher response rates
   - 2nd degree: Mutual connections, good for introductions
   - 3rd degree: Cold outreach, larger volume

### For Developers

1. **Always Log Search Criteria:** Helps debug extraction issues
2. **Validate Unipile Response:** Check for errors before processing
3. **Handle Edge Cases:** Empty results, API timeouts, invalid parameters
4. **Test All Degrees:** Verify 1st, 2nd, 3rd degree filtering works
5. **Monitor Rate Limits:** Respect LinkedIn/Unipile API limits

---

## API Reference

### POST /api/linkedin/search/simple

**Request:**
```json
{
  "search_criteria": {
    "title": "CEO",
    "keywords": "tech startups",
    "location": "San Francisco",
    "company": "Google",
    "industry": "Technology",
    "connectionDegree": "1st",
    "campaignName": "Q4 Campaign"
  },
  "target_count": 50
}
```

**Response:**
```json
{
  "success": true,
  "prospects": [
    {
      "firstName": "John",
      "lastName": "Doe",
      "fullName": "John Doe",
      "title": "CEO",
      "company": "Tech Startup Inc.",
      "linkedinUrl": "https://linkedin.com/in/johndoe",
      "connectionDegree": 1
    }
  ],
  "count": 20,
  "total_found": 20,
  "api": "sales_navigator"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "LinkedIn not connected",
  "action": "connect_linkedin"
}
```

---

## Version History

### v2.0.0 - Advanced Search Filters (Oct 11, 2025)
- Added location, company, industry, school filters
- Fixed duplicate prospect issues
- Enhanced natural language extraction

### v1.1.0 - Connection Degree Fix (Oct 10, 2025)
- Fixed connection degree filtering
- Changed from `network_distance` to `network` parameter
- Added F/S/O notation support

### v1.0.0 - Campaign Names (Oct 9, 2025)
- Added automatic campaign naming
- Implemented YYYYMMDD-CODE-Description format
- Added editable campaign names in UI

---

## Related Documentation

- [LinkedIn Integration Setup](./LINKEDIN_OAUTH_INTEGRATION.md)
- [Data Approval System](./DATA_APPROVAL_IMPLEMENTATION_SUMMARY.md)
- [Unipile Integration](./UNIPILE_LINKEDIN_SEARCH_IMPLEMENTATION.md)
- [Multi-Tenant Architecture](./SAM_SYSTEM_TECHNICAL_OVERVIEW.md)
