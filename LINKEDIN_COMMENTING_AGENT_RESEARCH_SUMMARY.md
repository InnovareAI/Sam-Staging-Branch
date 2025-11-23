# LinkedIn Commenting Agent - Research Summary

**Date:** November 23, 2025
**Status:** ⚠️ BLOCKED - No viable hashtag search API exists

---

## Original Feature Design

**Goal:** Automatically discover and comment on LinkedIn posts containing specific hashtags (#GenAI, #AI, etc.)

**Workflow:**
1. Monitor hashtags user cares about
2. Discover new posts every 10-30 minutes
3. AI generates comment suggestions
4. Post comments via Unipile API ✅ (THIS WORKS)

**Blocker:** Steps 1-2 (discovering posts by hashtag) - NO API SOLUTION EXISTS

---

## APIs Tested

### 1. Unipile API ❌
**Tested Endpoints:**
- `POST /api/v1/posts/search` - Does not exist (404)
- `POST /api/v1/linkedin/search` - Only searches people/companies, not posts (400 - invalid parameters)
- `GET /api/v1/users/{user_id}/posts` - Endpoint exists but returns 422 "invalid recipient"

**Conclusion:** No hashtag search, user posts endpoint not working

### 2. Bright Data ❌
**Capabilities:**
- Can scrape posts from profile URLs
- Can scrape posts from company URLs
- **Cannot** search by hashtag/keyword

**Conclusion:** URL-based only, no feed search

### 3. LinkedIn Official API ❌
**Capabilities:**
- Create posts ✅
- Get posts by author URN (requires `r_member_social` - restricted, approved users only)
- Update/delete your own posts ✅
- **Cannot** search by hashtag
- **Cannot** access LinkedIn feed
- **Cannot** read other users' posts (without approval)

**Why:** "If people are reading LinkedIn posts on YOUR website, they are not trapped in LinkedIn's walled-in ad garden" - LinkedIn blocks this to protect ad revenue

---

## Competitor Analysis

### PowerIn.io ⚠️
**How They Work:**
- Chrome extension (browser automation)
- Monitors up to 3 keywords with Boolean search
- Comments within 15 minutes of new post
- 200 comments/day

**Method:** Likely uses headless browser to:
1. Log into LinkedIn with user's account
2. Search LinkedIn web UI (which DOES support hashtag search when logged in)
3. Scrape results in real-time
4. Auto-comment via LinkedIn web interface

**Why We Can't Copy:**
- Violates LinkedIn Terms of Service
- Risk of account bans
- Not scalable for B2B SaaS
- Requires user LinkedIn credentials

---

## Viable Alternatives

### Option A: Profile-Based Monitoring (RECOMMENDED)
Instead of monitoring hashtags, monitor specific LinkedIn profiles who post about those topics.

**How It Works:**
1. User identifies 10-50 LinkedIn thought leaders (Andrew Ng, Sam Altman, AI companies, etc.)
2. Use Bright Data to fetch posts from profile URLs every 30 min
3. Filter posts by keywords client-side
4. Save matching posts to database
5. Generate & post AI comments

**Pros:**
- ✅ Compliant with all ToS
- ✅ Uses existing APIs (Bright Data + Unipile)
- ✅ Achievable with current tools
- ✅ Still provides value (monitoring thought leaders)

**Cons:**
- ❌ More manual setup (user must identify profiles)
- ❌ Less comprehensive than hashtag search
- ❌ Additional cost (Bright Data: $1.50 per 1K posts)

**Implementation:**
- Update database schema: `hashtags` → `profile_urls` array
- Use Bright Data Posts API with profile URLs
- N8N workflow: Loop through profiles, fetch posts, filter keywords

### Option B: Manual Post URL Input (SIMPLEST)
User manually pastes LinkedIn post URLs they want to comment on.

**How It Works:**
1. User browses LinkedIn manually
2. Copies post URLs they want to engage with
3. Pastes into SAM
4. AI generates comment suggestions
5. User approves & posts via Unipile

**Pros:**
- ✅ 100% compliant
- ✅ No additional APIs needed
- ✅ Simple to implement
- ✅ Still provides value (AI comment generation)

**Cons:**
- ❌ Manual post discovery (not automated)
- ❌ Less scalable
- ❌ Reduced value proposition

**Implementation:**
- Add text input for post URLs
- Validate LinkedIn URL format
- Fetch post data via Unipile (if possible)
- Generate AI comments
- Post via existing Unipile integration

### Option C: Disable Feature
Remove from UI until a compliant solution exists.

---

## Recommendation

**Implement Option A: Profile-Based Monitoring**

**Why:**
1. Actually achievable with existing APIs
2. Compliant with LinkedIn ToS
3. Still provides significant value
4. Differentiates from PowerIn (they use browser automation, we use legitimate APIs)

**Next Steps:**
1. Update database schema to support `profile_urls` array
2. Sign up for Bright Data trial
3. Build N8N workflow for profile monitoring
4. Update UI to accept profile URLs instead of hashtags
5. Test end-to-end flow

**Estimated Effort:** 16-24 hours
**Monthly Cost:** ~$150-300 for Bright Data (monitoring 50 profiles, 10K posts/month)

---

## Key Learnings

1. **LinkedIn intentionally blocks hashtag search APIs** to protect their ad revenue
2. **PowerIn and similar tools violate LinkedIn ToS** via browser automation
3. **Profile-based monitoring is the only compliant approach** that works with current APIs
4. **Unipile is great for posting/commenting** but not for content discovery
5. **Bright Data can scrape profiles** but not search the feed

---

## Files Created

- `/Users/tvonlinz/Desktop/linkedin-commenting-workflow-FIXED.json` - N8N workflow (outdated - uses non-existent endpoint)
- `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/scripts/js/test-linkedin-search-api.mjs` - Test script
- `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/scripts/js/test-unipile-user-posts.mjs` - Test script
- `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/RESEARCH_PROMPT_LINKEDIN_HASHTAG_SEARCH.md` - Research prompt for external agents

---

## ✅ BREAKTHROUGH: Unipile Profile-Based Monitoring WORKS! (Nov 23, 2025)

### Test Results

**Endpoint discovered:** `GET /api/v1/users/{vanity}?account_id=...` (legacy endpoint)

**Successfully tested:**
- ✅ Profile lookup: `GET /api/v1/users/tvonlinz?account_id=...` → Returns correct profile with `provider_id`
- ✅ Posts retrieval: `GET /api/v1/users/{provider_id}/posts?account_id=...` → Returns 100 posts
- ✅ End-to-end workflow verified with real LinkedIn profiles

**Working Code:**
```javascript
// Step 1: Look up LinkedIn profile by vanity name
const profileResponse = await fetch(
  `https://api6.unipile.com:13670/api/v1/users/tvonlinz?account_id=mERQmojtSZq5GeomZZazlw`,
  { headers: { 'X-API-KEY': '...' } }
);
const profile = await profileResponse.json();
// Returns: { provider_id: "ACoAAACYv0MB5sgfg5P09EbKyGzp2OH-qwKEmgc", ... }

// Step 2: Fetch posts using provider_id
const postsResponse = await fetch(
  `https://api6.unipile.com:13670/api/v1/users/${profile.provider_id}/posts?account_id=mERQmojtSZq5GeomZZazlw`,
  { headers: { 'X-API-KEY': '...' } }
);
const posts = await postsResponse.json();
// Returns: { items: [100 posts with text, social_id, engagement metrics, etc.] }
```

**Test Scripts Created:**
- `/scripts/js/test-legacy-profile-lookup.mjs` - Full working workflow
- `/scripts/js/test-unipile-user-posts.mjs` - Posts endpoint testing
- `/scripts/js/test-unipile-list-accounts.mjs` - Account details

### Critical Bug Avoided

⚠️ **DO NOT USE:** `GET /api/v1/users/profile?identifier=...`
- This endpoint returns WRONG profiles (always returns same person regardless of identifier)
- Bug documented in CLAUDE.md (discovered Nov 22 during CR debugging)

✅ **USE INSTEAD:** `GET /api/v1/users/{vanity}?account_id=...` (legacy endpoint)
- Correctly resolves different LinkedIn vanity names
- Returns proper `provider_id` for posts retrieval

## Decision Required

Which option should we implement?

- [x] **Option A:** Profile-based monitoring (**UNIPILE ONLY - NO BRIGHT DATA NEEDED**)
- [ ] **Option B:** Manual post URL input (simple, no discovery)
- [ ] **Option C:** Disable feature entirely

**Recommendation:** Option A - Unipile-only solution

**Implementation:** Update N8N workflow to:
1. Use `profile_urls` array instead of `hashtags`
2. Loop through profile vanity names
3. Look up `provider_id` via legacy endpoint
4. Fetch posts via `/users/{provider_id}/posts`
5. Filter posts client-side for keywords
6. Generate and post AI comments
