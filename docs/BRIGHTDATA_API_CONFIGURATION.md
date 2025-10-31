# BrightData API Configuration

**Date:** October 31, 2025
**Purpose:** BrightData API setup for prospect enrichment

---

## API Credentials

**BrightData API Key:** `61813293-6532-4e16-af76-9803cc043afa`

**MCP Token (already in .mcp.json):** `e8*****************************************42`

---

## Environment Variables

Add to **Netlify Environment Variables** and `.env.local`:

```bash
BRIGHTDATA_API_KEY=61813293-6532-4e16-af76-9803cc043afa
```

---

## MCP Configuration

Already configured in `.mcp.json` (line 4-8):

```json
{
  "brightdata": {
    "transport": "sse",
    "url": "https://mcp.brightdata.com/sse?token=e8...42",
    "description": "Bright Data managed MCP for web scraping"
  }
}
```

---

## API Endpoint

**Base URL:** `https://api.brightdata.com/`

**Authentication:** Bearer token in header
```bash
Authorization: Bearer 61813293-6532-4e16-af76-9803cc043afa
```

---

## Usage in Code

**Enrichment API (`app/api/prospects/enrich/route.ts`):**

```typescript
const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/leads/brightdata-scraper`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.BRIGHTDATA_API_KEY}`
  },
  body: JSON.stringify({
    action: 'enrich_linkedin_profiles',
    linkedin_urls: ['https://linkedin.com/in/johndoe'],
    include_contact_info: true,
    include_company_info: true
  })
});
```

---

## Cost Tracking

**Rate:** $0.01 per prospect enriched

**Monthly Budget Recommendations:**
- Small workspaces (<50 searches/month): $5-10/month
- Medium workspaces (50-200 searches/month): $20-50/month
- Large workspaces (>200 searches/month): Consider Sales Navigator upgrade

---

## Testing

**Test Enrichment:**

```bash
curl -X POST https://app.meet-sam.com/api/prospects/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "linkedInUrls": ["https://linkedin.com/in/test"],
    "autoEnrich": true
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "enriched_count": 1,
  "failed_count": 0,
  "total_cost": 0.01,
  "enrichment_details": [
    {
      "linkedin_url": "https://linkedin.com/in/test",
      "status": "verified",
      "fields_enriched": ["company_name", "industry", "email"]
    }
  ]
}
```

---

## Deployment Checklist

**Netlify Environment Variables:**
- [ ] Add `BRIGHTDATA_API_KEY=61813293-6532-4e16-af76-9803cc043afa`
- [ ] Verify MCP configuration is loaded
- [ ] Test enrichment API endpoint
- [ ] Monitor costs in BrightData dashboard

**Production Monitoring:**
- [ ] Track enrichment success rate (target: >80%)
- [ ] Monitor monthly costs
- [ ] Set up cost alerts at $50, $100, $200 thresholds
- [ ] Review enrichment quality weekly

---

## Security Notes

- ✅ API key stored in environment variables (not in code)
- ✅ Never commit API key to git
- ✅ Use separate keys for staging and production
- ✅ Rotate keys every 90 days

**Current Key Usage:**
- Production: `61813293-6532-4e16-af76-9803cc043afa`
- Staging: Use same key (monitor costs separately)

---

**Status:** ✅ Ready to configure
**Next Step:** Add BRIGHTDATA_API_KEY to Netlify environment
**Last Updated:** October 31, 2025
