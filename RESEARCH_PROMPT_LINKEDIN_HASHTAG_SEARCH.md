# Research Prompt: LinkedIn Hashtag Post Discovery API

## Objective
Find a working API or service that can search/discover LinkedIn posts by hashtag or keyword in real-time.

## Requirements

### Must Have:
1. **Hashtag/Keyword Search** - Ability to search LinkedIn feed for posts containing specific hashtags (e.g., "#GenAI", "#AI", "#Marketing")
2. **API Access** - Programmatic REST API or SDK (not manual scraping)
3. **Real-time or Near Real-time** - Posts discovered within 24 hours of publication
4. **Post Metadata** - Returns post content, author info, post URL, engagement metrics
5. **Legal/Compliant** - Does not violate LinkedIn Terms of Service or require user account credentials
6. **Commercial Use** - Can be used in a B2B SaaS product

### Nice to Have:
- Webhook/streaming support for new posts
- Filtering by date, engagement level, author type (person vs company)
- Rate limits suitable for monitoring 10-50 hashtags simultaneously
- Reasonable pricing (< $500/month for 100K posts discovered)

## Already Investigated (NOT Solutions)

### ❌ Unipile API
- **Tested:** `POST /api/v1/linkedin/search`
- **Result:** Only searches people/companies, NOT posts
- **Tested:** `POST /api/v1/posts/search`
- **Result:** Endpoint does not exist (404)
- **Documentation:** https://developer.unipile.com/docs/linkedin-search

### ❌ Bright Data LinkedIn Scraper
- **Tested:** Posts API endpoints
- **Result:** Only supports URL-based discovery (profile URL, company URL, specific post URL)
- **Limitation:** Cannot search by hashtag/keyword across LinkedIn feed
- **Documentation:** https://docs.brightdata.com/api-reference/web-scraper-api/social-media-apis/linkedin

### ❌ LinkedIn Official API
- **Known Limitation:** No public API for feed search or hashtag discovery
- **Access:** Only available through enterprise partnerships
- **Posts API:** Only allows posting, not searching/reading others' posts

## What We're Looking For

### Ideal Solution Examples:
1. **API Service** - "HashtagAPI.com/linkedin?hashtag=GenAI" returns 20 recent posts
2. **Scraping Service** - Bright Data-like service with actual hashtag search endpoint
3. **Chrome Extension API** - Headless browser automation with structured data output
4. **Alternative Platform** - Service that mirrors LinkedIn hashtag data via legal means

### Research Questions:
1. Are there any unofficial/third-party LinkedIn feed APIs that support hashtag search?
2. Does PhantomBuster, Apify, or similar automation platforms offer this capability?
3. Are there browser automation tools (Puppeteer/Playwright) with maintained LinkedIn hashtag scrapers?
4. Do any data broker/enrichment services (ZoomInfo, Apollo, etc.) offer LinkedIn hashtag monitoring?
5. Are there RSS feeds, Chrome extensions, or other mechanisms to monitor LinkedIn hashtags?
6. Has anyone built a working solution for this use case that we can license/integrate?

## Use Case Context

We're building a **LinkedIn Commenting Agent** that:
1. Monitors hashtags user cares about (#GenAI, #SaaS, etc.)
2. Discovers new posts with those hashtags every 10-30 minutes
3. Uses AI to generate relevant comment suggestions
4. Posts comments via Unipile API (this part works)

**Current Blocker:** Step 1-2 (discovering posts) has no API solution.

## Research Deliverables

Please provide:

1. **List of viable services/APIs** with:
   - Name and URL
   - Pricing
   - API documentation link
   - Confirmation it supports hashtag search
   - Rate limits and restrictions

2. **Proof of concept** for top 3 candidates:
   - Example API call
   - Sample response JSON
   - Code snippet showing how to search "#GenAI" posts

3. **Recommendation** with:
   - Best option for production use
   - Cost analysis for 50 hashtags monitored
   - Integration complexity estimate
   - Legal/compliance risks

4. **Alternative approaches** if no API exists:
   - Manual post URL input from user
   - Profile-based monitoring (track specific accounts)
   - Browser extension approach
   - Partnership opportunities

## Budget Constraints

- **Setup/Integration:** < 40 hours dev time
- **Monthly Cost:** < $500 for 100K posts/month
- **Per-request Cost:** < $0.01 per post discovered

## Timeline

- **Research:** 4-8 hours
- **POC Testing:** 4-8 hours
- **Decision:** Within 24 hours of research completion

## Success Criteria

A solution is successful if:
1. ✅ Can search LinkedIn for posts with "#GenAI" hashtag
2. ✅ Returns at least 10-20 recent posts (published within 7 days)
3. ✅ Provides post URL, content, author name, publish date
4. ✅ Can be called via REST API or SDK
5. ✅ Works reliably (95%+ uptime)
6. ✅ Does not require end-user LinkedIn credentials
7. ✅ Legally compliant for commercial use

---

## Contact for Questions

If you need clarification on any requirements, technical constraints, or use case details, please ask before starting research.

**Priority:** HIGH - This is blocking a key product feature
**Status:** Research needed ASAP
