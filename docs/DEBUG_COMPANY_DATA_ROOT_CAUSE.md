# Root Cause Analysis: Bad Company Data

**Date:** October 31, 2025
**Issue:** LinkedIn headline stored as company_name

---

## CONFIRMED ROOT CAUSE

### The Bug

**File:** `scripts/js/enrich-prospects-final.mjs` (line 60)

```javascript
const company = profileData.company_name || profileData.company?.name || '';
const title = profileData.headline || '';
```

**What Happened:**

1. Campaign prospects were created with missing `first_name`, `last_name`, and `company_name`
2. Enrichment script (`enrich-prospects-final.mjs`) was run to fetch data from Unipile
3. **Unipile API returns:**
   - `profileData.company_name` - Often EMPTY or contains headline text
   - `profileData.headline` - Contains the LinkedIn headline
   - `profileData.company.name` - The actual current company (NOT CHECKED PROPERLY)

4. **The enrichment script has a fallback bug:**
   - When `profileData.company_name` is empty: Falls back to `''`
   - Sets company to "Unknown Company" (line 75)
   - **BUT sometimes Unipile puts headline in company_name field!**

5. Result: Headline text like "Life Sciences & Healthcare" gets stored in `company_name`

---

## Examples of Bad Data From Unipile

Based on the prospect data, Unipile likely returned:

```json
{
  "first_name": "Sidneepinho",
  "last_name": "User",
  "headline": "COO | Strategist | Growth Enabler | M&A | Life Sciences & Healthcare",
  "company_name": "Life Sciences & Healthcare",  // ← BUG: This should be actual company
  "company": {
    "name": "Actual Company Name"  // ← The real company is here!
  }
}
```

The enrichment script read `company_name` which had the headline suffix, not the actual company.

---

## Why This Happened

1. **Unipile API inconsistency:**
   - Sometimes `company_name` contains partial headline text
   - Sometimes it's empty
   - The actual company is in `company.name` or needs to be extracted from experience

2. **Enrichment script prioritization:**
   ```javascript
   // WRONG ORDER:
   const company = profileData.company_name || profileData.company?.name || '';

   // SHOULD BE:
   const company = profileData.company?.name || profileData.current_position?.company || profileData.company_name || '';
   ```

3. **No validation:**
   - Script doesn't check if company_name looks like a headline
   - No fallback to extract company from experience/positions
   - No validation that company name is reasonable

---

## The Fix

### Immediate Fix (Update Bad Data)

For the 35 affected prospects:
1. Fetch their LinkedIn profiles again via Unipile
2. Extract company from the correct field: `company.name` or `experience[0].company`
3. Update `company_name` in database
4. Regenerate personalized messages

### Long-term Fix (Prevent Future Occurrences)

**Update enrichment logic:**

```javascript
// FIXED VERSION:
function extractCompany(profileData) {
  // Priority 1: Current position company (most reliable)
  if (profileData.experience && profileData.experience[0]?.company) {
    return profileData.experience[0].company;
  }

  // Priority 2: Company object
  if (profileData.company?.name) {
    return profileData.company.name;
  }

  // Priority 3: company_name field (least reliable, often has headline)
  if (profileData.company_name) {
    // Validate it doesn't look like a headline
    if (!isHeadlineLike(profileData.company_name)) {
      return profileData.company_name;
    }
  }

  return 'Unknown Company';
}

function isHeadlineLike(text) {
  // Check for patterns that indicate headline, not company
  const headlinePatterns = [
    /\|/,  // Pipes used in headlines
    /\bCEO\b|\bCOO\b|\bVP\b|\bDirector\b/i,  // Titles
    /Strategy|Innovation|Leader|Executive/i,  // Common headline words
    /&/  // Multiple things joined with &
  ];

  return headlinePatterns.some(pattern => pattern.test(text));
}
```

**Add validation to campaign prospect creation:**

```javascript
// In add-approved-prospects route or enrichment:
if (company_name) {
  if (isHeadlineLike(company_name)) {
    console.warn(`⚠️  Headline detected in company field: "${company_name}"`);
    company_name = ''; // Force re-extraction
  }
}
```

---

## Files To Fix

1. **`scripts/js/enrich-prospects-final.mjs`**
   - Update company extraction logic (lines 60-75)
   - Add headline validation
   - Prioritize `experience[0].company` over `company_name`

2. **`lib/data-enrichment/enrichment-pipeline.ts`**
   - Update `parseLinkedInData` method (line 516)
   - Add validation for headline-like text in company field

3. **`app/api/campaigns/add-approved-prospects/route.ts`**
   - Add validation when setting `company_name` (line 152)
   - Warn if headline-like text detected

---

## Testing The Fix

**Test cases:**

```javascript
// Test 1: Normal company
extractCompany({
  company_name: "Bain & Company",
  headline: "Partner at Bain & Company | Healthcare"
})
// Expected: "Bain & Company" ✅

// Test 2: Headline in company_name
extractCompany({
  company_name: "Life Sciences & Healthcare",
  headline: "COO | Life Sciences & Healthcare",
  experience: [{ company: "Actual Corp" }]
})
// Expected: "Actual Corp" ✅

// Test 3: Empty company
extractCompany({
  company_name: "",
  headline: "Marketing Executive",
  experience: []
})
// Expected: "Unknown Company" ✅
```

---

## Recommendation

1. **Create new enrichment script** with fixed logic
2. **Re-enrich all 35 bad prospects** using fixed script
3. **Regenerate personalization messages**
4. **Update production enrichment code** to prevent future issues
5. **Add monitoring** to detect headline-in-company issues automatically

---

**Next Step:** Create fixed enrichment script to correct the 35 bad prospects.
