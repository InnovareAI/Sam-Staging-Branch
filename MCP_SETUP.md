# MCP Server Configuration

## What Are MCP Servers?

**MCP (Model Context Protocol)** servers allow Claude to interact with external services and tools.

---

## Two Types of MCPs

### 1. **Claude Desktop MCPs** (Global)
- **Location**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Used by**: Claude Desktop app only
- **Your configured MCPs**:
  - Supabase
  - Netlify
  - GitHub
  - Filesystem
  - Airtable
  - ActiveCampaign

### 2. **Claude Code Project MCPs** (Project-specific)
- **Location**: `.mcp.json` in project root
- **Used by**: Claude Code (VS Code extension)
- **Your configured MCPs**:
  - Bright Data
  - Apify
  - Unipile (LinkedIn + messaging)
  - Postmark (email)
  - Stripe (payments)

---

## Current Setup

### Sam-New-Sep-7 Project

**File**: `.mcp.json`

```json
{
  "mcpServers": {
    "brightdata": { /* Bright Data managed MCP */ },
    "apify": { /* Apify MCP server */ },
    "unipile": { /* LinkedIn + messaging */ },
    "postmark": { /* Email via Postmark */ },
    "stripe": { /* Payment processing */ }
  }
}
```

**Configuration**: `.claude-code-settings.json`

```json
{
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": [
    "brightdata",
    "apify",
    "unipile",
    "postmark",
    "stripe"
  ]
}
```

---

## Why You Were Getting Prompted

The prompt you saw:
```
New MCP server found in .mcp.json: shadcn
```

Was caused by a `.mcp.json` file in your parent directory (`/Users/tvonlinz/Dev_Master/.mcp.json`).

**Solution**: Moved to `.mcp.json.backup` so it won't prompt anymore.

---

## How It Works Now

### Automatic Approval

With `"enableAllProjectMcpServers": true`, Claude Code will:
- ✅ Automatically use all MCP servers listed in `.mcp.json`
- ✅ No more prompts on startup
- ✅ Tools are available immediately

### Manual Approval (if you prefer)

Remove `"enableAllProjectMcpServers": true` and you'll be prompted to:
1. Use this and all future MCP servers
2. Use this MCP server only
3. Continue without this server

---

## Environment Variables

Your MCP servers use environment variables for API keys:

```bash
# Required in your environment
APIFY_API_TOKEN=your_token
UNIPILE_API_KEY=your_key
UNIPILE_DSN=your_dsn
POSTMARK_SERVER_TOKEN=your_token
STRIPE_API_KEY=your_key
```

These should be set in:
- `.env` file (project-level)
- Or system environment variables
- **Never commit API keys to git!**

---

## MCP Server Capabilities

### Bright Data
- Web scraping
- Proxy management
- Data collection

### Apify
- Web automation
- Data extraction
- Actor execution

### Unipile
- LinkedIn integration
- Multi-platform messaging
- Social media automation

### Postmark
- Transactional email
- Email templates
- Delivery tracking

### Stripe
- Payment processing
- Subscription management
- Invoice handling

---

## Troubleshooting

### Still Getting Prompts?

1. **Check for other `.mcp.json` files**:
   ```bash
   find /Users/tvonlinz/Dev_Master -name ".mcp.json"
   ```

2. **Restart VS Code**:
   Settings take effect after restart

3. **Check settings are saved**:
   ```bash
   cat .claude-code-settings.json | grep enableAllProjectMcpServers
   ```

### MCP Server Not Working?

1. **Check environment variables are set**:
   ```bash
   echo $APIFY_API_TOKEN
   ```

2. **Check the MCP server is installed**:
   ```bash
   npx @apify/mcp-server-apify@latest --version
   ```

3. **Check Claude Code logs**:
   VS Code → Output → Select "Claude Code" from dropdown

---

## Security Notes

### ⚠️ Important

- MCP servers **execute code** on your machine
- MCP servers can **access files** in allowed directories
- MCP servers can **make API calls** with your credentials

### Best Practices

1. **Only enable MCPs you trust**
2. **Review `.mcp.json` before enabling**
3. **Keep API keys in environment variables**
4. **Use `.gitignore` to exclude `.env` files**
5. **Regularly audit enabled MCPs**

---

## Comparison: Claude Desktop vs Claude Code MCPs

| Feature | Claude Desktop | Claude Code |
|---------|----------------|-------------|
| **Config File** | `claude_desktop_config.json` | `.mcp.json` |
| **Scope** | Global (all projects) | Project-specific |
| **Used By** | Claude Desktop app | VS Code extension |
| **Auto-approval** | Manual per conversation | Can be automatic |
| **Environment** | System-wide | Project-specific |

---

## Related Files

- **MCP Config**: `.mcp.json`
- **Claude Settings**: `.claude-code-settings.json`
- **Environment**: `.env` (in `.gitignore`)
- **Claude Desktop**: `~/Library/Application Support/Claude/claude_desktop_config.json`

---

**Last Updated**: October 2, 2025  
**No more prompts**: MCPs are now auto-approved in this project
