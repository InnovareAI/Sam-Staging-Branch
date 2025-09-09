# Unipile MCP Integration Guide for SAM AI

## 🌟 Overview

Unipile MCP provides unified access to multiple communication platforms through a single API, enabling SAM AI to manage conversations across LinkedIn, WhatsApp, Instagram, Email, Slack, and more.

## 📱 Supported Platforms

- **LinkedIn**: Professional messaging and connection requests
- **WhatsApp**: Business messaging and customer support
- **Instagram**: Direct messages and social engagement
- **Messenger**: Facebook messaging integration
- **Telegram**: Channel and group messaging
- **Twitter/X**: Direct messages and mentions
- **Slack**: Team communication integration
- **Email**: Gmail and Outlook integration
- **Mobile**: SMS integration

## 🔧 Installation & Configuration

### 1. MCP Server Setup

The Unipile MCP server is already installed at:
```bash
/Users/tvonlinz/mcp-servers/mcp-unipile/
```

### 2. Environment Configuration

Add to your `.env.local` file:
```env
# Unipile MCP Configuration
UNIPILE_DSN=api8.unipile.com:13851
UNIPILE_API_KEY=your-actual-api-key
UNIPILE_CLIENT_ID=your-client-id
UNIPILE_CLIENT_SECRET=your-client-secret
UNIPILE_WEBHOOK_SECRET=your-webhook-secret
```

### 3. Claude Desktop Configuration

Add to `~/.claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "unipile": {
      "command": "/Users/tvonlinz/mcp-servers/mcp-unipile/venv/bin/python",
      "args": ["-m", "mcp_server_unipile"],
      "env": {
        "UNIPILE_DSN": "api8.unipile.com:13851",
        "UNIPILE_API_KEY": "your-actual-api-key"
      }
    }
  }
}
```

## 🚀 SAM AI Integration

### 1. API Routes Integration

Create `/app/api/integrations/unipile/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { action, platform, data } = await req.json();
    
    // Route to appropriate Unipile service
    switch (action) {
      case 'send_message':
        return await handleSendMessage(platform, data);
      case 'get_messages':
        return await handleGetMessages(platform, data);
      case 'connect_account':
        return await handleConnectAccount(platform, data);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### 2. React Components

Create `/components/integrations/UnipileConnector.tsx`:
```typescript
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

const SUPPORTED_PLATFORMS = [
  { id: 'linkedin', name: 'LinkedIn', icon: '💼' },
  { id: 'whatsapp', name: 'WhatsApp', icon: '💬' },
  { id: 'instagram', name: 'Instagram', icon: '📷' },
  { id: 'email', name: 'Email', icon: '📧' },
];

export function UnipileConnector() {
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  
  const connectPlatform = async (platformId: string) => {
    try {
      const response = await fetch('/api/integrations/unipile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'connect_account',
          platform: platformId
        })
      });
      
      if (response.ok) {
        setConnectedPlatforms(prev => [...prev, platformId]);
      }
    } catch (error) {
      console.error('Failed to connect platform:', error);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Connect Your Accounts</h3>
      <div className="grid grid-cols-2 gap-4">
        {SUPPORTED_PLATFORMS.map(platform => (
          <div key={platform.id} className="p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{platform.icon}</span>
                <span className="font-medium">{platform.name}</span>
              </div>
              <Button
                onClick={() => connectPlatform(platform.id)}
                disabled={connectedPlatforms.includes(platform.id)}
                variant={connectedPlatforms.includes(platform.id) ? "default" : "outline"}
              >
                {connectedPlatforms.includes(platform.id) ? 'Connected' : 'Connect'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 3. Database Schema

Add to your Supabase migrations:
```sql
-- Unipile account connections
CREATE TABLE IF NOT EXISTS unipile_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    account_id TEXT NOT NULL,
    account_name TEXT,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, platform, account_id)
);

-- Message tracking
CREATE TABLE IF NOT EXISTS unipile_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES unipile_accounts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    message_id TEXT NOT NULL,
    conversation_id TEXT,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    content TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(platform, message_id)
);

-- Enable RLS
ALTER TABLE unipile_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE unipile_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their workspace Unipile accounts" ON unipile_accounts
    FOR ALL USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can access their workspace messages" ON unipile_messages
    FOR ALL USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    ));
```

## 🛠️ Available MCP Tools

### Message Management
- `unipile_get_accounts` - List connected accounts
- `unipile_get_recent_messages` - Retrieve recent messages from all platforms
- `unipile_get_emails` - Get email messages from connected accounts

### Usage Examples
```typescript
// Get all connected accounts
const accounts = await mcp.call('unipile_get_accounts');

// Get recent messages from a specific account
const messages = await mcp.call('unipile_get_recent_messages', {
  account_id: 'linkedin-account-123',
  batch_size: 50
});

// Get emails
const emails = await mcp.call('unipile_get_emails', {
  account_id: 'email-account-456',
  limit: 20
});
```

## 💰 Pricing & Limits

- **Cost**: $5 per connected account per month
- **Rate Limits**: Platform-specific (LinkedIn: 100 messages/hour, Email: unlimited)
- **Message Storage**: 30 days retention included

## 🔒 Security & Compliance

### OAuth Flow Security
```typescript
// Secure token storage
const storeTokens = async (tokens: UnipileTokens) => {
  const { data, error } = await supabase
    .from('unipile_accounts')
    .upsert({
      workspace_id: user.workspace_id,
      platform: tokens.platform,
      access_token: encrypt(tokens.access_token),
      refresh_token: encrypt(tokens.refresh_token),
      expires_at: tokens.expires_at
    });
};
```

### Webhook Security
```typescript
// Verify webhook signatures
const verifyWebhook = (payload: string, signature: string) => {
  const expected = crypto
    .createHmac('sha256', process.env.UNIPILE_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};
```

## 🔧 Troubleshooting

### Common Issues

1. **Authentication Errors**
   ```bash
   # Check MCP server status
   cd ~/mcp-servers/mcp-unipile
   source venv/bin/activate
   python -m mcp_server_unipile
   ```

2. **Missing Messages**
   - Verify webhook URLs in Unipile dashboard
   - Check database RLS policies
   - Confirm account is active

3. **Rate Limiting**
   - Implement exponential backoff
   - Monitor per-platform limits
   - Use message queuing for high volume

### Debug Commands
```bash
# Test MCP connection
curl -X POST http://localhost:3000/api/integrations/unipile \
  -H "Content-Type: application/json" \
  -d '{"action": "get_accounts"}'

# Check logs
tail -f ~/.logs/unipile-mcp.log
```

## 🚀 Next Steps

1. **Get Unipile API credentials** from https://unipile.com
2. **Configure environment variables** in your deployment
3. **Test account connections** for each platform
4. **Set up webhooks** for real-time message sync
5. **Implement platform-specific features** (LinkedIn outreach, WhatsApp support, etc.)

## 📚 Resources

- [Unipile API Documentation](https://developer.unipile.com)
- [MCP Server Repository](https://github.com/unipile/mcp-server)
- [SAM AI Integration Examples](./examples/unipile-examples.ts)

---

**The Unipile MCP integration enables SAM AI to become a truly multi-channel sales and communication platform!** 🚀