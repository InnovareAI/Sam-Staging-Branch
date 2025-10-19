# LinkedIn Saved Search Import Guide

## Overview

SAM AI can automatically import prospects from your LinkedIn Sales Navigator saved searches. The system fetches prospects in batches and handles pagination automatically.

## Quick Start

1. **Create a saved search in LinkedIn Sales Navigator**
2. **Copy the FULL URL** from your browser address bar after the search loads
3. **Paste the URL into SAM's import feature**
4. **Wait for automatic import** (typically 30-60 seconds for 100 prospects)

## Important Limits

### System Limits
- **Default import**: 100 prospects per session
- **Maximum import**: 1,000 prospects per session
- **LinkedIn hard limit**: 2,500 results per search (Sales Navigator)
- **Batch size**: 25 prospects per batch (automatic)
- **Timeout**: 25 seconds per batch

### Practical Recommendations
- ✅ **Optimal range**: 500-1,000 prospects per search
- ✅ **Safe maximum**: Up to 1,000 prospects per import
- ⚠️ **LinkedIn limit**: Searches capped at 2,500 total results
- 💡 **Best practice**: Create multiple targeted searches rather than one broad search

## How to Use

### Step 1: Create Your Saved Search

In LinkedIn Sales Navigator, apply filters to narrow your target audience:

**Recommended filters:**
- **Location**: Specific city or region (e.g., "San Francisco Bay Area")
- **Company headcount**: Specific range (e.g., "1-10 employees")
- **Industry**: Specific industry (e.g., "Software Development")
- **Job function**: Specific function (e.g., "Sales", "Marketing")
- **Seniority level**: e.g., "Director", "VP"
- **Keywords**: Specific terms (e.g., "startup", "SaaS")

**Goal**: Aim for 500-1,000 prospects for optimal performance (LinkedIn allows up to 2,500).

### Step 2: Save and Open Your Search

1. Click "Save search" in Sales Navigator
2. Give it a descriptive name
3. Click on the saved search to open it
4. **Wait for all results to fully load** (important!)

### Step 3: Copy the Full URL

**CRITICAL**: You must copy the FULL parameterized URL, not the saved search reference URL.

✅ **CORRECT URL** (contains `query=` and `filters=`):
```
https://www.linkedin.com/sales/search/people?query=(spellCorrectionEnabled%3Atrue%2Cfilters%3AList((type%3ACOMPANY_HEADCOUNT%2Cvalues%3AList((id%3AB%2Ctext%3A1-10%2CselectionType%3AINCLUDED)))...
```

❌ **WRONG URL** (only has `savedSearchId=`):
```
https://www.linkedin.com/sales/search/people?savedSearchId=22040586
```

**How to get the correct URL:**
1. Open your saved search in Sales Navigator
2. **Wait for all search results to load completely**
3. Copy the URL from your browser's address bar
4. The URL should be very long (500+ characters)

### Step 4: Import into SAM

**In SAM AI:**
1. Navigate to the prospect import page
2. Paste your saved search URL
3. (Optional) Specify a custom campaign name
4. (Optional) Specify target count (25-1000, defaults to 100)
5. Click "Import Prospects"

**Example request body:**
```json
{
  "saved_search_url": "https://www.linkedin.com/sales/search/people?query=...",
  "campaign_name": "Q4 SF Bay Area Startups",
  "target_count": 250
}
```

### Step 5: Monitor Progress

The import runs automatically in batches:
- **Batch size**: 25 prospects per batch
- **Delay between batches**: 500ms
- **Progress updates**: Real-time logging
- **Completion time**: ~30 seconds per 100 prospects

## Understanding Results

### Success Response

```json
{
  "success": true,
  "count": 100,
  "campaign_name": "20251019-IAI-SavedSearch-22040586",
  "session_id": "uuid-here",
  "batches": 4,
  "has_more": true,
  "message": "Imported 100 prospects (target reached in 4 batches). More results available - increase target_count to import more."
}
```

**Response fields:**
- `count`: Total prospects imported
- `batches`: Number of batches fetched
- `has_more`: Whether more results are available
- `message`: Human-readable status message

### Common Messages

**"Imported X prospects (all available results from this search)"**
- Your search only had X total prospects
- All available prospects were imported
- No action needed

**"Imported X prospects (target reached in Y batches). More results available"**
- Import stopped at your target_count
- More prospects exist in the search
- Increase `target_count` to import more (max 1000)

**"Imported X prospects (target reached, no more results available)"**
- Reached your target_count exactly
- No more results available
- Perfect scenario!

## Troubleshooting

### Error: "Saved Search Reference URLs are not supported"

**Problem**: You copied a saved search reference URL instead of the full parameterized URL.

**Solution**:
1. Open the saved search in LinkedIn Sales Navigator
2. **Wait for all results to load completely**
3. Copy the FULL URL from the address bar (should contain `query=` and `filters=`)
4. Try import again

### Error: "Failed to search LinkedIn (HTTP 504)"

**Problem**: Your search has too many results and timed out.

**Solution**:
1. Add more specific filters to narrow results:
   - Add location filter
   - Add company size filter
   - Add job function filter
   - Add seniority level filter
2. Aim for 500-1,000 total results (LinkedIn max: 2,500)
3. You can create multiple narrower searches instead of one broad search
4. If search has 2,000+ results, import in multiple sessions (1,000 at a time)

### Error: "No LinkedIn account connected"

**Problem**: You haven't connected a LinkedIn account to SAM.

**Solution**:
1. Go to Settings → Integrations
2. Connect your LinkedIn account via Unipile
3. Ensure account status shows "Connected"
4. Try import again

### Error: "Failed to create approval session" or "Failed to save prospects"

**Problem**: Database error (rare).

**Solution**:
1. Try import again
2. If persists, contact support with:
   - Error message
   - Timestamp
   - Saved search URL (redacted if sensitive)

### Only importing 25 prospects instead of 100

**Problem**: You're using an old version of the app that doesn't have automatic batching.

**Solution**:
1. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache
3. Try import again

## Best Practices

### 1. Create Focused Searches

**Instead of one broad search:**
- "All Sales professionals in USA" (1,000,000+ results) ❌

**Create multiple focused searches:**
- "Sales Directors at 1-10 employee SaaS companies in San Francisco" (200 results) ✅
- "Sales VPs at 11-50 employee SaaS companies in San Francisco" (150 results) ✅
- "Sales Managers at 1-10 employee SaaS companies in New York" (180 results) ✅

### 2. Use Descriptive Campaign Names

**Good campaign names:**
- "Q4-2024-SF-Bay-Area-Sales-Directors"
- "20251019-SaaS-Founders-NYC"
- "Enterprise-CTOs-Boston-Nov2024"

**Poor campaign names:**
- "Test"
- "Search 1"
- "Prospects"

### 3. Monitor Import Limits

- Default: 100 prospects per import
- Maximum: 1,000 prospects per import
- LinkedIn limit: 2,500 results per search
- For larger campaigns: Import multiple times or create multiple searches

### 4. Verify Account Features

**Sales Navigator required for:**
- Advanced filters (company size, revenue, etc.)
- Larger search result sets
- InMail credits

**Regular LinkedIn limitations:**
- Fewer filters available
- Smaller result sets
- May not work with some saved searches

## API Reference

### Endpoint
```
POST /api/linkedin/import-saved-search
```

### Request Headers
```
Content-Type: application/json
Authorization: Bearer <your-token>
```

### Request Body
```json
{
  "saved_search_url": "string (required)",
  "campaign_name": "string (optional)",
  "target_count": "number (optional, 25-1000, default: 100)"
}
```

### Response Codes

- **200 OK**: Import successful
- **400 Bad Request**: Invalid URL or parameters
- **401 Unauthorized**: Not authenticated
- **403 Forbidden**: No LinkedIn account connected
- **500 Internal Server Error**: Server error
- **504 Gateway Timeout**: Search too large, timed out

## FAQ

### Q: How many prospects can I import at once?
**A**: Maximum 1,000 per import. LinkedIn's hard limit is 2,500 results per search. For searches with 2,000+ results, import in multiple sessions or create multiple focused searches.

### Q: How long does import take?
**A**: ~30 seconds per 100 prospects (batches of 25, 500ms delay between batches).

### Q: What happens if my search has 1000 results but I set target_count to 100?
**A**: System imports first 100 prospects and stops. Response includes `has_more: true` to indicate more results available.

### Q: Can I import from the same saved search multiple times?
**A**: Yes, but you'll get the same prospects each time. LinkedIn returns results in consistent order.

### Q: Does this count against LinkedIn's connection request limits?
**A**: No, importing prospects does NOT send connection requests. It only adds them to your SAM prospect list for later outreach.

### Q: What LinkedIn account types are supported?
**A**:
- ✅ LinkedIn Sales Navigator (recommended)
- ✅ LinkedIn Recruiter
- ⚠️ LinkedIn Premium (limited features)
- ❌ Free LinkedIn (not supported)

### Q: Can I import from regular LinkedIn searches (not Sales Navigator)?
**A**: Limited support. Sales Navigator provides better results and more filter options.

## Support

**Need help?**
- Check this guide first
- Review error messages carefully
- Contact support: support@meet-sam.com
- Include: error message, timestamp, and redacted search URL

## Changelog

### 2025-10-19
- ✅ Automatic batch processing (fetches all results up to target)
- ✅ Configurable target_count (25-1000 prospects)
- ✅ Enhanced error messages with guidance
- ✅ Partial success handling (returns what was collected before errors)
- ✅ Cursor-based pagination support
- ✅ 25-second timeout per batch with retry logic
- ✅ Support for LinkedIn's full 2,500 result limit (import in multiple sessions)

### Earlier
- Initial manual import (single batch of 25)
- Basic saved search URL validation
