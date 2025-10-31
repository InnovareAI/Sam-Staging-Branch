# LinkedIn Account Types - Complete Reference

**Date:** October 31, 2025
**Purpose:** Document all LinkedIn account types and their API capabilities via Unipile

---

## LinkedIn Account Hierarchy

### Tier 1: Enterprise Accounts (Structured Data API)

**✅ Best for Prospect Scraping**

#### 1. Sales Navigator
- **Unipile Feature Flag:** `sales_navigator`
- **API Type:** Sales Navigator API (structured data)
- **Data Quality:** ⭐⭐⭐⭐⭐ Excellent
- **Cost:** ~$100/month (Professional) or $150/month (Team/Enterprise)

**Available Fields:**
- ✅ First Name (`first_name`)
- ✅ Last Name (`last_name`)
- ✅ Company Name (`current_positions[0].company`)
- ✅ Job Title (`current_positions[0].role`)
- ✅ Industry (`current_positions[0].industry`)
- ✅ Location (`location`)
- ✅ LinkedIn URL (`profile_url`)
- ✅ Connection Degree (`network_distance`)
- ✅ Work History (`experience`)
- ✅ Education (`education`)
- ✅ Skills (`skills`)

**Search Capabilities:**
- ✅ Advanced filters (company size, seniority, years at company)
- ✅ Boolean search operators
- ✅ Saved searches
- ✅ Lead recommendations
- ✅ InMail credits included

**Recommended Use:** Primary account for prospect scraping

---

#### 2. Recruiter Lite / Recruiter
- **Unipile Feature Flag:** `recruiter`
- **API Type:** Recruiter API (structured data)
- **Data Quality:** ⭐⭐⭐⭐⭐ Excellent
- **Cost:** ~$140/month (Lite) or $800+/month (Full Recruiter)

**Available Fields:**
- ✅ Same as Sales Navigator (structured data)
- ✅ Additional candidate insights
- ✅ Applicant tracking integration

**Search Capabilities:**
- ✅ Advanced filters (similar to Sales Navigator)
- ✅ Talent pools
- ✅ Pipeline management
- ✅ InMail credits included

**Recommended Use:** Alternative to Sales Navigator (great for recruitment-focused searches)

---

### Tier 2: Premium Accounts (Classic API - Limited Data)

**⚠️ Limited Data Quality**

All Premium accounts use the **Classic LinkedIn API** which only returns:
- ✅ Name (sometimes split into first/last, sometimes combined)
- ✅ Headline (descriptive text like "COO | Strategist | Healthcare")
- ✅ LinkedIn URL
- ✅ Location
- ⚠️ Industry (sometimes provided, not guaranteed)
- ❌ NO structured company data
- ❌ NO current_positions array
- ❌ NO work history
- ❌ NO education
- ❌ NO skills

#### 3. Premium Career
- **Unipile Feature Flag:** `premium_career` or `premium`
- **API Type:** Classic API
- **Data Quality:** ⭐⭐ Limited
- **Cost:** ~$30/month

**Features:**
- Job seeker tools
- Profile insights (who viewed your profile)
- Extended network visibility
- Resume building tools
- Learning courses (limited)

**Data Returned:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "headline": "Senior Product Manager | SaaS | B2B",
  "profile_url": "https://linkedin.com/in/johndoe",
  "location": "San Francisco, CA",
  "industry": "Technology" // Sometimes missing
}
```

**Recommended Use:** Messaging only, NOT scraping

---

#### 4. Premium Business
- **Unipile Feature Flag:** `premium_business` or `premium`
- **API Type:** Classic API
- **Data Quality:** ⭐⭐ Limited
- **Cost:** ~$60/month

**Features:**
- Business insights
- Extended network visibility
- InMail credits (15/month)
- Competitor research
- Learning courses (full library)

**Data Returned:** Same as Premium Career (Classic API)

**Recommended Use:** Messaging and networking, NOT scraping

---

#### 5. LinkedIn Learning (Premium)
- **Unipile Feature Flag:** `learning` or `premium`
- **API Type:** Classic API
- **Data Quality:** ⭐⭐ Limited
- **Cost:** ~$30/month (bundled with some Premium plans)

**Features:**
- Full access to LinkedIn Learning courses
- Certificates
- Profile insights
- Same networking features as Premium Career

**Data Returned:** Same as Premium Career (Classic API)

**Recommended Use:** NOT for prospect scraping

---

#### 6. Job Seeker (Premium Career variant)
- **Unipile Feature Flag:** `job_seeker` or `premium_career`
- **API Type:** Classic API
- **Data Quality:** ⭐⭐ Limited
- **Cost:** ~$30/month

**Features:**
- Job application tools
- Interview preparation
- Resume building
- Profile visibility boost for recruiters

**Data Returned:** Same as Premium Career (Classic API)

**Recommended Use:** NOT for prospect scraping

---

### Tier 3: Free Account

#### 7. LinkedIn Free
- **Unipile Feature Flag:** `[]` (empty array)
- **API Type:** Classic API
- **Data Quality:** ⭐ Very Limited
- **Cost:** Free

**Features:**
- Basic profile
- Limited network visibility (2nd degree only)
- Limited search results
- No InMail
- No advanced filters

**Data Returned:** Same as Premium accounts (Classic API), but with:
- Fewer search results
- Limited profile visibility
- No extended network access

**Recommended Use:** NOT for prospect scraping

---

## Data Comparison Matrix

| Field | Sales Nav / Recruiter | Premium Accounts | Free Account |
|-------|----------------------|------------------|--------------|
| **First Name** | ✅ Structured | ✅ Parsed from name | ✅ Parsed from name |
| **Last Name** | ✅ Structured | ✅ Parsed from name | ✅ Parsed from name |
| **Company Name** | ✅ `current_positions[0].company` | ❌ → 'unavailable' | ❌ → 'unavailable' |
| **Job Title** | ✅ `current_positions[0].role` | ⚠️ Headline only | ⚠️ Headline only |
| **Industry** | ✅ `current_positions[0].industry` | ⚠️ Sometimes → 'unavailable' | ⚠️ Sometimes → 'unavailable' |
| **Location** | ✅ Structured | ✅ Available | ✅ Available |
| **LinkedIn URL** | ✅ Available | ✅ Available | ✅ Available |
| **Work History** | ✅ Full array | ❌ Not available | ❌ Not available |
| **Education** | ✅ Full array | ❌ Not available | ❌ Not available |
| **Skills** | ✅ Full array | ❌ Not available | ❌ Not available |
| **Connection Degree** | ✅ Accurate | ✅ Accurate | ✅ Accurate |

---

## SAM AI Account Prioritization

**Current Implementation:**

```typescript
// Priority order (best to worst):
1. Sales Navigator     → ⭐ BEST (structured data)
2. Recruiter          → ⭐ GOOD (structured data)
3. Premium Business   → ⚠️  LIMITED (Classic API)
4. Premium Career     → ⚠️  LIMITED (Classic API)
5. Learning           → ⚠️  LIMITED (Classic API)
6. Job Seeker         → ⚠️  LIMITED (Classic API)
7. Free               → ⚠️  VERY LIMITED (Classic API)
```

**When user has multiple accounts:**
- System automatically selects highest tier available
- User is NOT blocked from using lower-tier accounts
- Clear warnings shown when Classic API is used

---

## How Unipile Detects Account Types

**Via `premiumFeatures` array in account response:**

```javascript
// Sales Navigator
connection_params.im.premiumFeatures = ['sales_navigator']

// Recruiter
connection_params.im.premiumFeatures = ['recruiter']

// Premium Business
connection_params.im.premiumFeatures = ['premium', 'premium_business']

// Premium Career
connection_params.im.premiumFeatures = ['premium', 'premium_career']

// Learning
connection_params.im.premiumFeatures = ['premium', 'learning']

// Job Seeker
connection_params.im.premiumFeatures = ['premium', 'job_seeker']

// Free
connection_params.im.premiumFeatures = [] // Empty array
```

---

## Recommendations by Use Case

### Use Case 1: B2B Prospecting (SAM AI)
**Recommended Account:** Sales Navigator Professional ($100/mo)

**Why:**
- ✅ Structured company data (no 'unavailable' fields)
- ✅ Industry information always included
- ✅ Advanced search filters (company size, seniority)
- ✅ 100% data quality for personalization
- ✅ No enrichment needed

**ROI:** Pays for itself with accurate prospecting

---

### Use Case 2: Recruitment
**Recommended Account:** Recruiter Lite ($140/mo) or Sales Navigator

**Why:**
- ✅ Same data quality as Sales Navigator
- ✅ Additional candidate insights
- ✅ Applicant tracking features
- ✅ Talent pool management

---

### Use Case 3: Personal Networking
**Recommended Account:** Premium Business ($60/mo) or Premium Career ($30/mo)

**Why:**
- ✅ InMail credits for direct messaging
- ✅ Extended network visibility
- ⚠️ NOT recommended for automated scraping
- ⚠️ Limited data quality (Classic API)

**Note:** Can use for messaging, but pair with Sales Navigator account for scraping

---

### Use Case 4: Budget-Constrained Teams
**Option 1:** Mix account types
- 1-2 Sales Navigator accounts for scraping
- Premium accounts for team members (messaging only)

**Option 2:** Use BrightData enrichment
- Use Premium accounts for search (free or $30/mo)
- Enrich missing data with BrightData (~$0.01 per prospect)
- Cost: ~$30/mo + $0.50 per 50 prospects

**Break-even:** If scraping >150 prospects/month, Sales Navigator is cheaper

---

## Account Type Detection in Code

**Current Implementation:**

```typescript
// app/api/linkedin/search/simple/route.ts (lines 260-276)

if (premiumFeatures.includes('sales_navigator')) {
  salesNavAccount = unipileAccount;
  console.log('⭐ SALES NAVIGATOR account found');
} else if (premiumFeatures.includes('recruiter')) {
  recruiterAccount = unipileAccount;
  console.log('⭐ RECRUITER account found');
} else if (
  premiumFeatures.includes('premium') ||
  premiumFeatures.includes('premium_career') ||
  premiumFeatures.includes('premium_business') ||
  premiumFeatures.includes('learning') ||
  premiumFeatures.includes('job_seeker')
) {
  premiumAccount = unipileAccount;
  const accountType = premiumFeatures.find(f =>
    ['premium', 'premium_career', 'premium_business', 'learning', 'job_seeker'].includes(f)
  ) || 'premium';
  console.log(`⚠️ ${accountType.toUpperCase()} account (Classic API - limited data)`);
} else {
  // Free account
  premiumAccount = unipileAccount;
  console.log('⚠️ Free account (Classic API - limited data)');
}
```

---

## User Messaging by Account Type

### When Sales Navigator is selected:
```
✅ Using Sales Navigator account
📊 Full data quality - all fields available
🎯 No enrichment needed
```

### When Premium Business/Career/Learning/JobSeeker is selected:
```
⚠️ Using [ACCOUNT TYPE] account (Classic API)
⚠️ Limited data: Company and Industry may show 'unavailable'
💡 Recommendation: Upgrade to Sales Navigator for better data quality
```

### When Free account is selected:
```
⚠️ Using Free account (Classic API)
⚠️ Very limited data: Company and Industry will show 'unavailable'
⚠️ Limited search results
💡 Recommendation: Upgrade to Sales Navigator or Premium Business
```

---

## Testing Each Account Type

### Test Checklist

**Sales Navigator:**
- [ ] All fields populated (no 'unavailable')
- [ ] `apiType: 'sales_navigator'`
- [ ] `needsEnrichment: false`
- [ ] Company data accurate

**Recruiter:**
- [ ] All fields populated (no 'unavailable')
- [ ] `apiType: 'recruiter'`
- [ ] `needsEnrichment: false`
- [ ] Company data accurate

**Premium Business:**
- [ ] First/Last name available
- [ ] Company shows 'unavailable'
- [ ] Industry shows 'unavailable' OR actual value
- [ ] `apiType: 'classic'`
- [ ] `needsEnrichment: true`

**Premium Career / Learning / Job Seeker:**
- [ ] Same as Premium Business
- [ ] Correct account type logged in console

**Free:**
- [ ] Same as Premium accounts
- [ ] Fewer search results
- [ ] Correct account type logged

---

## FAQ

### Q: Can I use a Premium Business account for scraping?
**A:** Yes, but with limitations. Company names and industries will show 'unavailable' and need enrichment. Sales Navigator provides much better data quality.

### Q: What's the difference between Premium Career and Premium Business?
**A:** Both use Classic API with same data limitations. Premium Business includes InMail credits and business insights. For scraping purposes, they're equivalent.

### Q: Can I mix account types in my workspace?
**A:** Yes! System automatically selects the best account (Sales Navigator > Recruiter > Premium). You can have team members with different account types for different purposes.

### Q: Does Learning account work for scraping?
**A:** Technically yes, but with severe limitations. LinkedIn Learning is designed for education, not prospecting. You'll get 'unavailable' for most business fields.

### Q: Should I use a Job Seeker account for B2B sales?
**A:** No. Job Seeker accounts are designed for job hunting, not B2B prospecting. Limited data quality makes it unsuitable for sales use cases.

---

## Migration Path

### Current State: Premium Account
**Options:**

1. **Upgrade to Sales Navigator** ($100/mo)
   - Immediate full data quality
   - No enrichment costs
   - Best long-term value

2. **Use BrightData Enrichment** ($0.01/prospect)
   - Keep Premium account ($30-60/mo)
   - Pay per prospect for missing data
   - Good for <150 prospects/month

3. **Hybrid Approach**
   - 1 Sales Navigator for scraping
   - Keep Premium for messaging
   - Best for teams

---

**Status:** ✅ Complete Account Type Reference
**Last Updated:** October 31, 2025
