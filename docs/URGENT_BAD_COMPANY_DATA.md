# 🚨 URGENT: Client Campaign - Bad Company Data

**Date:** October 31, 2025
**Campaign:** 20251028-3AI-SEO search 3
**Client:** 3AI (3 Cubed AI)
**Severity:** CRITICAL - Client complaints received

---

## ⚠️ ISSUE SUMMARY

**71% of prospects (35 out of 49) have incorrect company data**

LinkedIn **headlines** are being stored as **company names**, resulting in personalized messages like:

> "Hi there, I noticed your work in healthcare tech at **Life Sciences & Healthcare**..."

Instead of actual company names like "Bain & Company" or "Capvision".

---

## 📊 DAMAGE ASSESSMENT

### Breakdown of Bad Data

| Category | Count | Percentage |
|----------|-------|------------|
| **Headline in company field** | 14 | 29% |
| **"Unknown Company"** | 15 | 31% |
| **Empty/blank company** | 6 | 12% |
| **Correct company data** | 14 | 29% |

### Examples of Bad Data

1. **Sidneepinho** - Company shows: "Life Sciences & Healthcare"
   Real headline: "COO | Strategist | Growth Enabler | M&A | Life Sciences & Healthcare"

2. **Danni L** - Company shows: "Life Sciences & Healthcare Strategy in Americas & EMEA"
   Real company: Capvision

3. **Darrick Chan** - Company shows: "Bain & Company | Healthcare & Life Sciences"
   Real company: Bain & Company (but formatted wrong)

4. **Jessica Profetta** - Company shows: "Healthcare and Life Sciences Marketing Specialist"
   This is her job title, not a company!

---

## 🛑 IMMEDIATE ACTION TAKEN

✅ **Campaign PAUSED** (status changed to 'paused')
   - No more messages will be sent
   - Prevents further client complaints

---

## 🔍 ROOT CAUSE

The data scraper/import process is:
1. Extracting LinkedIn **headline** text
2. Mistakenly storing it in the **company_name** field
3. Instead of extracting the actual company from LinkedIn profile

**Where this happens:**
- Prospect approval/import process
- LinkedIn data enrichment
- Possibly in SAM's prospect finding feature

---

## 📋 FIX REQUIRED (4 Steps)

### Step 1: Extract Real Company Names ⏱️ 2-3 hours

**Method A:** Use LinkedIn profile scraping
- For each of 35 prospects
- Fetch their LinkedIn profile via Unipile or LinkedIn API
- Extract actual company name from "Experience" section
- Update `campaign_prospects.company_name`

**Method B:** Manual correction by client
- Export 35 prospects to CSV
- Client provides correct company names
- Import and update database

### Step 2: Regenerate Personalized Messages ⏱️ 30 minutes

- For all 35 prospects with bad data
- Re-run personalization with correct company names
- Update `personalization_data.message` field
- Preserve other personalization data

### Step 3: Fix Root Cause ⏱️ 1-2 hours

Find and fix the code that's storing headlines as company names:
- Check `app/api/sam/find-prospects/route.ts`
- Check `app/api/leads/brightdata-scraper/route.ts`
- Check prospect approval data import
- Update to extract company from correct LinkedIn field

### Step 4: Re-launch Campaign ⏱️ 10 minutes

- Verify all 35 prospects have correct company names
- Verify messages look correct
- Change campaign status back to 'active'
- Monitor first few sends

---

## 📂 FILES CREATED

1. **`scripts/js/pause-campaign-urgent.mjs`**
   - Pauses the campaign immediately
   - ✅ Already executed

2. **`scripts/js/analyze-bad-company-data.mjs`**
   - Analyzes extent of bad data
   - Generates report with all bad prospects
   - ✅ Already executed
   - Output saved to: `/tmp/bad-company-prospect-ids.json`

3. **`docs/URGENT_BAD_COMPANY_DATA.md`** (this file)
   - Summary of issue and fix plan

---

## 🔑 PROSPECT IDS TO FIX

**Total:** 35 prospects
**Saved to:** `/tmp/bad-company-prospect-ids.json`

Sample IDs:
- a1d5037b-cc6d-4e6d-90f7-56181d4b7c44 (Sidneepinho)
- 43ae126d-8e01-40b5-8da0-b009193286d2 (Danni L)
- 43fa5156-d4ca-4acf-be15-214ccf39a670 (Pratik Maroo)
- ... (32 more)

---

## ⏰ TIME ESTIMATE

| Task | Time | Priority |
|------|------|----------|
| Extract real company names | 2-3 hours | HIGH |
| Regenerate messages | 30 min | HIGH |
| Fix root cause | 1-2 hours | MEDIUM |
| Re-launch campaign | 10 min | HIGH |
| **TOTAL** | **4-6 hours** | **URGENT** |

---

## 🚀 RECOMMENDED APPROACH

### Option 1: Automated Fix (Faster, but requires API access)

```bash
# 1. Use Unipile to fetch real company data from LinkedIn
node scripts/js/fix-company-data-from-linkedin.mjs

# 2. Regenerate personalized messages
node scripts/js/regenerate-personalization.mjs --campaign-id 51803ded-bbc9-4564-aefb-c6d11d69f17c

# 3. Verify and re-activate
node scripts/js/verify-and-reactivate-campaign.mjs
```

### Option 2: Manual Fix (Slower, but more accurate)

1. Export prospect list to CSV
2. Client reviews and provides correct company names
3. Import corrected data
4. Regenerate messages
5. Re-activate campaign

---

## 🔍 VERIFICATION CHECKLIST

Before re-activating campaign:

- [ ] All 35 prospects have real company names (not headlines)
- [ ] No prospect has "Unknown Company" or blank company
- [ ] Personalized messages reference correct companies
- [ ] Root cause fixed in import code
- [ ] Test send to 1-2 prospects first
- [ ] Client approves message samples

---

## 📧 CLIENT COMMUNICATION

**Recommended message:**

> "We identified an issue with the LinkedIn data extraction that affected 35 of 49 prospects in your campaign. Instead of actual company names, our system was pulling LinkedIn headline text.
>
> We've **paused the campaign** to prevent any more incorrect messages from being sent. We're now:
> 1. Correcting all company data
> 2. Regenerating personalized messages
> 3. Fixing the root cause
>
> Expected fix time: 4-6 hours. We'll notify you once the campaign is ready to resume with correct data."

---

## 🛠️ NEXT STEPS

**Priority 1 (URGENT):**
1. Create LinkedIn company extraction script
2. Run on all 35 bad prospects
3. Update database with correct companies
4. Regenerate messages

**Priority 2 (Important):**
1. Find root cause in data import
2. Fix the scraper/import logic
3. Add validation to prevent this in future
4. Add company name quality check

**Priority 3 (Follow-up):**
1. Re-launch campaign
2. Monitor first 5 sends
3. Get client confirmation
4. Document fix for future reference

---

## 📞 ESCALATION

If you need help:
- **Dev Team:** Slack #dev-urgent
- **Client Success:** Notify about campaign pause
- **Data Team:** Help with LinkedIn API extraction

---

**Status:** Campaign paused, analysis complete, awaiting fix implementation
**Last Updated:** 2025-10-31, 1:15 PM
**Next Review:** After company data correction complete
