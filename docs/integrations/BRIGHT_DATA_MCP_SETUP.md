# Bright Data MCP Setup (Managed Service)

SAM AI now uses Bright Data's managed MCP endpoint instead of the legacy in-repo connector.

## Managed MCP Endpoint
```
https://mcp.brightdata.com/sse?token=e8*****************************************42
```

## Configure Clients
1. Update `.mcp.json` (or the relevant MCP client config) to include:
   ```json
   {
     "mcpServers": {
       "brightdata": {
         "command": "curl",
         "args": ["https://mcp.brightdata.com/sse?token=e8*****************************************42"],
         "description": "Bright Data managed MCP"
       }
     }
   }
   ```
2. Remove local Bright Data environment variables (`BRIGHT_DATA_API_TOKEN`, etc.) so the in-repo server stays disabled.
3. For n8n, import Bright Data's official MCP workflow and paste the same SSE token.

## Notes
- Managed service handles authentication, scaling, and updates automatically.
- If a local fallback is ever needed, reintroduce `BRIGHT_DATA_API_TOKEN` and collector defaults; the registry will re-enable the in-repo server.
