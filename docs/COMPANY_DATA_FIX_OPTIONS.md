# Company Data Fix - Your Options

**Date:** October 31, 2025
**Issue:** 35 prospects (71%) have bad company data
**Root Cause:** Scraped with LinkedIn Premium (not Sales Navigator) → Classic API used → Only headline returned

---

## ✅ THE REAL ISSUE (Clarified)

**You're correct - Unipile is FREE because people own their own accounts.**

The problem isn't Unipile's cost - it's which LinkedIn API endpoint gets used:

### LinkedIn Account Types in Your System:

| Account | Type Detected | API Used | Company Data? |
|---------|---------------|----------|---------------|
| Michelle | `premium` | Classic | ❌ Headline only |
| Charissa | `premium` | Classic | ❌ Headline only |
| Irish | `premium` | Classic | ❌ Headline only |
| Noriko | `premium` | Classic | ❌ Headline only |
| **Thorsten** | `sales_navigator` | **Sales Nav** | ✅ `current_positions[0].company` |

### Why This Matters:

**Premium Career/Business** → Unipile uses "Classic LinkedIn API"
- Returns: `name`, `headline`, `location`
- Company in headline: "COO | Healthcare & Life Sciences" ❌
- Must parse company from text (error-prone)

**Sales Navigator** → Unipile uses "Sales Navigator API"
- Returns: `current_positions` array with companies ✅
- Structured data: `{ company: "Bain & Company", title: "Partner" }`
- No parsing needed

---

## 🎯 YOUR THREE OPTIONS

### Option 1: Use BrightData MCP (BEST FOR ONE-TIME FIX)

**What it is:**
- Use BrightData's web scraping to get complete LinkedIn profiles
- Already integrated via MCP
- Returns full profile data with company, title, experience

**How to run:**
```bash
# Start dev server (if not running)
npm run dev

# In another terminal
node scripts/js/rescrape-with-brightdata-mcp.mjs
```

**Pros:**
- ✅ Complete data guaranteed (company, title, experience)
- ✅ Already integrated and ready to use
- ✅ Can get emails too (if needed for future)
- ✅ Works immediately (no account changes needed)

**Cons:**
- ⚠️ Costs ~$0.20 per prospect
- ⚠️ Total: 35 × $0.20 = **~$7**
- ⚠️ Requires dev server running
- ⚠️ Takes 2-3 minutes (rate limited)

**Best for:**
- Quick one-time fix
- When you need complete data NOW
- When $7 is acceptable to fix the issue

---

### Option 2: Use Thorsten's Sales Navigator (FREE, MANUAL)

**What it is:**
- Re-run the LinkedIn search using Thorsten's account
- Sales Navigator API returns complete data
- Updates all 35 prospects

**How to run:**
1. Manually modify search script to force Thorsten's account
2. Re-run search for same criteria
3. Match new results to old prospects
4. Update database

**Pros:**
- ✅ FREE (using existing Sales Nav account)
- ✅ Complete structured data
- ✅ No additional subscriptions needed

**Cons:**
- ⚠️ Requires manual matching of prospects
- ⚠️ Need to recreate original search criteria
- ⚠️ Time-consuming (1-2 hours)
- ⚠️ Single point of failure (only Thorsten has Sales Nav)

**Best for:**
- When you want to avoid costs
- When you have time to manually match prospects
- Testing before deciding on long-term solution

---

### Option 3: Upgrade Premium Accounts to Sales Navigator (LONG-TERM)

**What it is:**
- Upgrade Michelle and/or Charissa to Sales Navigator
- Future searches automatically use Sales Navigator API
- Prevents this issue from happening again

**Cost:**
- Sales Navigator Professional: **~$100/month per account**
- Recommended: Upgrade 1-2 accounts

**How to upgrade:**
1. Go to LinkedIn Settings → Subscriptions
2. Upgrade from Premium to Sales Navigator
3. Reconnect account in SAM (Settings → Integrations)
4. Unipile will detect Sales Navigator features
5. Future searches automatically use correct API

**Pros:**
- ✅ Prevents future issues (permanent fix)
- ✅ Multiple accounts for volume/redundancy
- ✅ Better search filters and features
- ✅ Lead recommendations and insights
- ✅ FREE per-search (just monthly subscription)

**Cons:**
- ⚠️ Monthly cost: $100 per account
- ⚠️ Requires LinkedIn subscription change
- ⚠️ Doesn't fix current 35 prospects (need Option 1 or 2)

**Best for:**
- Running 3+ campaigns per month
- Long-term solution
- When data quality is critical

**ROI Calculation:**
```
Scenario: 3 campaigns/month, 100 prospects each

Option A: Premium + Manual Fixes
- Monthly subscription: $50 (Premium)
- Data fixes: 3 campaigns × 2 hours × $50/hr = $300
- Total: $350/month

Option B: Sales Navigator
- Monthly subscription: $100 (Sales Nav)
- Data fixes: $0 (automatic)
- Total: $100/month

Savings: $250/month with Sales Navigator
```

---

## 📊 RECOMMENDED STRATEGY

### Immediate Fix (This Week):

**Use BrightData MCP** ($7, 10 minutes)
```bash
npm run dev  # In one terminal
node scripts/js/rescrape-with-brightdata-mcp.mjs  # In another
```

**Why:**
- Fastest solution (10 minutes vs 1-2 hours)
- Most reliable (structured data guaranteed)
- Minimal cost ($7 to fix critical client campaign)
- Already integrated and tested

---

### Long-Term (Next Month):

**Upgrade 1-2 accounts to Sales Navigator** ($100-200/month)

**Upgrade Michelle first:**
- She's the primary account for campaigns
- Most active user
- ROI: Pays for itself if >1 campaign/month

**Upgrade Charissa second (optional):**
- Redundancy if Michelle's account unavailable
- Handle higher volume
- Multiple campaigns in parallel

**Keep as Premium:**
- Irish, Noriko: Can still use for messaging
- Premium is fine for sending messages
- Only scraping needs Sales Navigator

---

## 🚀 IMMEDIATE ACTION PLAN

### Step 1: Fix Current Campaign (NOW)

Run BrightData MCP re-scrape:
```bash
# Terminal 1
npm run dev

# Terminal 2
node scripts/js/rescrape-with-brightdata-mcp.mjs
```

Expected output:
```
✅ Fixed: 35
📊 Total cost: ~$7.00
```

---

### Step 2: Verify Data Quality

Check a few prospects manually:
```sql
SELECT
  first_name,
  last_name,
  company_name,
  title
FROM campaign_prospects
WHERE id IN (
  'a1d5037b-cc6d-4e6d-90f7-56181d4b7c44',  -- Sidnee Pinho
  '43ae126d-8e01-40b5-8da0-b009193286d2',  -- Danni L
  '0291f8d4-d9ad-4fa4-9e34-646b2114ad66'   -- Darrick Chan
);
```

Expected:
- ✅ Real company names (not headlines)
- ✅ Proper titles
- ✅ No "Unknown Company"

---

### Step 3: Regenerate Personalized Messages

Once company data is correct:
```bash
node scripts/js/regenerate-personalization.mjs
```

This will update all messages with correct company names.

---

### Step 4: Resume Campaign

1. Verify messages look correct (sample 3-5)
2. Update campaign status to 'active'
3. Monitor first 5 sends
4. Get client confirmation

---

### Step 5: Decide on Long-Term Solution

**Ask yourself:**
- Do we run 3+ campaigns per month? → Upgrade to Sales Nav
- Do we run 1-2 campaigns per month? → Keep using BrightData as needed
- Do we need emails regularly? → BrightData has better email coverage

**My recommendation:**
- Immediate: BrightData MCP ($7 to fix now)
- Long-term: Upgrade Michelle to Sales Nav ($100/month)
- Reason: Prevents future issues, pays for itself with >1 campaign/month

---

## 💡 BONUS: Hybrid Approach (BEST OF BOTH WORLDS)

**For maximum quality at minimum cost:**

1. **Scraping:**
   - Use Thorsten's Sales Navigator for FREE scraping
   - Or use Michelle once upgraded
   - Get complete company/title data

2. **Email Enrichment:**
   - Use BrightData MCP only for prospects needing emails
   - Cost: $0.20 per prospect with email
   - Only run when needed (not every campaign)

3. **Messaging:**
   - Use ANY LinkedIn account (Premium is fine)
   - Messaging doesn't need Sales Navigator
   - Keep using Michelle, Charissa, Irish, Noriko

**Example Cost:**
```
Campaign: 100 prospects

Scraping: FREE (Thorsten's Sales Nav)
Email enrichment: 50 prospects × $0.20 = $10
Messaging: FREE (Michelle's Premium)

Total: $10 for 100 fully-enriched prospects with emails
```

---

## ❓ FAQ

**Q: Why not just use Thorsten for everything?**
A: Single point of failure. If his account is disconnected or rate-limited, you're stuck. Better to have 2-3 Sales Nav accounts.

**Q: Do Premium accounts provide ANY value?**
A: Yes! Premium is perfect for:
- Sending LinkedIn messages (InMail)
- Seeing who viewed your profile
- Messaging prospects
- Just not good for initial scraping

**Q: Can't we force Premium accounts to use Sales Nav API?**
A: No. The API endpoint is determined by LinkedIn subscription type. Premium → Classic API, Sales Nav → Sales Nav API.

**Q: Is BrightData legal?**
A: Yes. BrightData is a legitimate web scraping service used by Fortune 500 companies. It uses proper proxies and respects robots.txt.

**Q: What about the cost?**
A: Compare $7 to fix 35 prospects vs $150+ in manual labor + client complaints. BrightData is cost-effective for critical fixes and email enrichment.

---

## 📞 NEXT STEPS

**Ready to fix the campaign?**

1. Decide which option to use:
   - [ ] Option 1: BrightData MCP ($7, 10 min) ← **Recommended**
   - [ ] Option 2: Thorsten's Sales Nav (FREE, 1-2 hrs)
   - [ ] Option 3: Upgrade to Sales Nav ($100/mo, long-term)

2. Let me know and I'll guide you through the execution

3. Once fixed, we'll regenerate messages and resume campaign

**Current Status:**
- ✅ Campaign paused (no more bad messages sent)
- ✅ 35 bad prospects identified
- ✅ Scripts ready to run
- ⏳ Awaiting your decision on which option to use

---

**Recommendation:** Run Option 1 (BrightData MCP) NOW to fix the campaign, then decide on long-term solution next week.

Cost: $7 to make client happy and get campaign back online today.

Would you like me to walk you through running the BrightData re-scrape script?
