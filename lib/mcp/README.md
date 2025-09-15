MCP Registry Overview

This folder contains the MCP servers and a central `mcp-registry` that routes tool calls to the right server.

Servers and IDs
- bright-data: Enterprise prospect research and insights
- apify: Cost‑effective LinkedIn profile/search mocks
- google-search: Real Google CSE/SerpAPI searches (needs keys)
- websearch: Mock/fallback search + helpers (always available)
- unipile: Multi‑channel messaging and LinkedIn actions
- n8n: Workflow automation
- reply-agent: Sales reply generation helpers

Auto‑Detection Mapping
- Bright Data: research_prospect, analyze_company, generate_strategic_insights, check_system_health
- Apify: research_linkedin_prospect, search_linkedin_prospects, check_apify_status
- Google Search: boolean_linkedin_search, company_research_search, icp_prospect_discovery, verify_search_quota
- WebSearch (mock): validate_linkedin_url, boolean_linkedin_search, company_intelligence_search, icp_research_search, validate_search_syntax
- Unipile: any tool starting with unipile_
- N8N: any tool starting with n8n_
- Reply Agent: any tool starting with reply_agent_

Config and Fallbacks
- `createMCPConfig()` initializes servers from environment variables.
- If `GOOGLE_API_KEY` and `GOOGLE_CSE_ID` are missing, `websearch` is still initialized as a safe fallback.
- `listAllTools()` aggregates all tool definitions from initialized servers.
- `getServerStatus()` reports availability and tool counts per server.

Routing Behavior
- `callTool()` will auto‑detect `server` based on tool name when not provided.
- You can override by passing `server` explicitly in the request.
- `researchProspectWithBestSource()` now routes:
  - profileUrls → Apify `research_linkedin_prospect` (fallback: Bright Data `research_prospect`)
  - searchCriteria → Apify `search_linkedin_prospects` for small/low‑budget; else Google `icp_prospect_discovery`; fallback to WebSearch `icp_research_search`.

Usage Examples
1) Auto‑detect server
```
await mcpRegistry.callTool({
  method: 'tools/call',
  params: { name: 'validate_linkedin_url', arguments: { url: 'https://linkedin.com/in/example' } }
})
```

2) Explicit server
```
await mcpRegistry.callTool({
  method: 'tools/call',
  params: { name: 'company_research_search', arguments: { companyName: 'Acme', searchType: 'news' } },
  server: 'google-search'
})
```

3) Prospect research helper
```
await mcpRegistry.researchProspectWithBestSource({
  profileUrls: ['https://linkedin.com/in/prospect'],
  urgency: 'medium',
  maxResults: 1
})
```

Notes
- WebSearch is a mock for offline development. For production search, set Google CSE and/or SerpAPI keys.
- Bright Data and Unipile integrate with external systems; ensure credentials and service availability before enabling in prod.

