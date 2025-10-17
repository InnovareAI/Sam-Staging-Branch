# SAM System Prompt Update - Multi-Source Search Support ✅

**Date**: October 17, 2025
**Status**: Complete - Requires Server Restart

---

## 🎯 Problem Solved

SAM's system prompt was forcing him to:
1. ❌ Only search LinkedIn
2. ❌ Always require "connection degree" (1st/2nd/3rd - LinkedIn-specific)
3. ❌ Refuse searches that didn't include LinkedIn network filters
4. ❌ Say things like "I focus specifically on LinkedIn and email outreach"

This conflicted with our BrightData integration that can search **multiple sources** (LinkedIn, company websites, public databases).

---

## ✅ What Changed

### Updated: `app/api/sam/threads/[threadId]/messages/route.ts`

### 1. Main Introduction (Line 1064)

**Before:**
```typescript
You are Sam, the user's trusted sales AI partner. You handle LinkedIn and email outreach end-to-end...
```

**After:**
```typescript
You are Sam, the user's trusted sales AI partner. You handle lead research, LinkedIn outreach, and email campaigns end-to-end...
```

---

### 2. Section Header (Lines 1098-1113)

**Before:**
```
LINKEDIN INTEGRATION & PROSPECT SEARCH
```

**After:**
```
LEAD SEARCH & INTEGRATION
- **Search Capabilities:** You can search for leads using multiple sources:
  - General web search (BrightData) - searches LinkedIn, company websites, and public sources
  - LinkedIn network search (requires connection degree: 1st/2nd/3rd)
  - Sales Navigator search (for premium LinkedIn users)
```

---

### 3. Connection Degree - Now Optional (Lines 1140, 1177-1181)

**Before:**
```
3️⃣ **Connection Degree** - Which level? (1st, 2nd, or 3rd degree)

**MINIMUM REQUIRED:**
3. **Connection degree (1st/2nd/3rd) - ABSOLUTELY MANDATORY - NEVER skip this**
```

**After:**
```
3️⃣ **Connection Degree** (Optional for LinkedIn searches) - Which level? (1st, 2nd, or 3rd degree)

**MINIMUM REQUIRED:**
3. **Connection degree (1st/2nd/3rd) - OPTIONAL** (only needed for LinkedIn network searches; skip for general web searches)
```

---

### 4. Quick Mode Flow (Line 1136)

**Before:**
```
You: "I can search for CEOs on LinkedIn! To get you the best matches..."
```

**After:**
```
You: "I can search for CEOs! To get you the best matches..."
```

---

### 5. Collect Criteria Instructions (Lines 1158-1163)

**Before:**
```
- THEN ask for connection degree (required)
```

**After:**
```
- Optionally ask for connection degree (only if doing LinkedIn network search)
```

---

### 6. Specific Search Indicators (Lines 1171-1175)

**Before:**
```
- Includes location: "CEOs in New York" → Still ask for: connection degree, campaign name
- Includes company: "VPs at Google" → Still ask for: connection degree, campaign name
```

**After:**
```
- Includes location: "CEOs in New York" → Still ask for: campaign name (connection degree optional)
- Includes company: "VPs at Google" → Still ask for: campaign name (connection degree optional)
```

---

### 7. Added New Example - General Web Search (Lines 1211-1233)

**New Example WITHOUT Connection Degree:**
```
Example 2 - Broad Request (General Web Search - No Connection Degree):
User: "Find me some VPs of Sales"
You: "I can search for VPs of Sales! To get you targeted results, I need a few details:

1️⃣ **Location** - Where should they be based?
2️⃣ **Industry** - Which sector are you targeting?

Let's start - what location?"

User: "New York"
You: "Great! And which industry or company type? (e.g., SaaS, tech startups, healthcare)"

User: "SaaS companies"
You: "Perfect! Last thing - what would you like to name this search?"

User: "NYC SaaS VPs Q1"
You: "Starting your search now!

#trigger-search:{"title":"VP Sales","location":"New York","keywords":"SaaS","targetCount":50,"campaignName":"NYC SaaS VPs Q1"}

Campaign: 20251014-IAI-NYC SaaS VPs Q1

Head to **Data Approval** to see the results!"
```

**Note**: No `connectionDegree` field in the trigger!

---

### 8. Guide Me Flow Updated (Lines 1444, 1453)

**Before:**
```
You: "I can help you find prospects on LinkedIn! Choose how you'd like to proceed:
...
You: "🎯 **LinkedIn Search - All Available Filters**
```

**After:**
```
You: "I can help you find prospects! Choose how you'd like to proceed:
...
You: "🎯 **Lead Search - All Available Filters**
```

---

## 🔧 How This Works Now

### General Web Search (Default)
```
User: "Find me 5 CTOs in San Francisco"
SAM: "I can search for CTOs! To get you the best matches, I need:
      1️⃣ Location - Where? → You said San Francisco ✅
      2️⃣ Industry - Which sector? (e.g., tech, SaaS)"

User: "Tech startups"
SAM: "Perfect! What would you like to name this search?"

User: "SF Tech CTOs"
SAM: "Starting your search!
      #trigger-search:{"title":"CTO","location":"San Francisco","keywords":"tech startups","targetCount":5,"campaignName":"SF Tech CTOs"}"
```

**Result**: BrightData searches LinkedIn profiles, company websites, and public sources.

---

### LinkedIn Network Search (Optional - Connection Degree Required)
```
User: "Find CEOs in my 1st degree network"
SAM: "Perfect! I can see you want:
      - CEOs
      - 1st degree connections (direct network)

      What location?"

User: "New York"
SAM: "And which industry?"

User: "SaaS"
SAM: "Great! Campaign name?"

User: "NY SaaS CEOs Direct"
SAM: "#trigger-search:{"title":"CEO","location":"New York","keywords":"SaaS","connectionDegree":"1st","campaignName":"NY SaaS CEOs Direct"}"
```

**Result**: Searches user's LinkedIn network (1st degree connections).

---

## 🚀 Testing Instructions

### 1. Restart Dev Server

**CRITICAL**: System prompt is cached in memory. You MUST restart:

```bash
# Stop current server (Ctrl+C)
npm run dev
```

### 2. Test General Search (No LinkedIn Mention)

Open SAM chat and ask:
```
Find me 5 CTOs in San Francisco
```

**Expected SAM Response:**
- ✅ "I can search for CTOs!" (NOT "on LinkedIn")
- ✅ Asks for industry/keywords
- ✅ Asks for campaign name
- ✅ Does NOT ask for connection degree
- ✅ Triggers search immediately

**SAM Should NOT Say:**
- ❌ "I focus specifically on LinkedIn and email outreach"
- ❌ "For website research, that's outside my current scope"
- ❌ "Is there a LinkedIn search I can help you with instead?"

---

### 3. Test Company-Specific Search

Ask:
```
Find contacts at Anthropic
```

**Expected:**
- ✅ SAM asks for job titles/roles
- ✅ Executes search across multiple sources
- ✅ Does NOT restrict to LinkedIn only

---

### 4. Test LinkedIn Network Search (With Connection Degree)

Ask:
```
Find CEOs in my 1st degree network in San Francisco
```

**Expected:**
- ✅ SAM recognizes "1st degree" = LinkedIn network search
- ✅ Includes `connectionDegree: "1st"` in trigger
- ✅ Executes LinkedIn-specific search

---

## 📋 Build Status

```
✅ ✓ Compiled successfully in 6.9s
✅ ✓ Generating static pages (326/326)
✅ No errors or warnings
```

---

## 🎉 What Users Now Experience

### Before This Update:
```
User: "Find me CTOs in San Francisco"
SAM: "I focus specifically on LinkedIn and email outreach.
      For website research, that's outside my current scope."
```

### After This Update:
```
User: "Find me CTOs in San Francisco"
SAM: "I can search for CTOs! To get you the best matches:
      1️⃣ Industry - Which sector? (e.g., tech, SaaS)"

User: "Tech"
SAM: "Perfect! Campaign name?"

User: "SF Tech CTOs"
SAM: "Starting search!
      #trigger-search:{"title":"CTO","location":"San Francisco","keywords":"tech","targetCount":10,"campaignName":"SF Tech CTOs"}

      Head to Data Approval to see results!"
```

---

## 📊 Summary

| Feature | Before | After |
|---------|--------|-------|
| **Search Sources** | LinkedIn only | LinkedIn + websites + public sources |
| **Connection Degree** | Always required | Optional (LinkedIn searches only) |
| **SAM's Response** | "I search LinkedIn" | "I can search for leads" |
| **Use Case** | LinkedIn network searches | General lead research + LinkedIn |
| **Flexibility** | Low (forced LinkedIn filters) | High (adapts to search type) |

---

## ⚠️ IMPORTANT: Restart Required

The system prompt is loaded when the API route starts. Changes will NOT take effect until you:

1. **Stop the dev server** (Ctrl+C)
2. **Restart it** (`npm run dev`)
3. **Start a new SAM conversation** (old conversations use old prompt)

---

## 🔗 Related Files

- ✅ `app/api/sam/threads/[threadId]/messages/route.ts` - System prompt updated
- ✅ `knowledge-base/capabilities/lead-search.md` - Knowledge base updated
- ✅ `app/api/leads/brightdata-scraper/route.ts` - BrightData integration ready
- ✅ `app/api/search/google-cse/route.ts` - Google Custom Search ready

---

**Result**: SAM now understands he can search **multiple sources**, not just LinkedIn. The LinkedIn workflow still works perfectly when users mention their network or connection degree, but general searches now use BrightData's multi-source capabilities! 🎉
