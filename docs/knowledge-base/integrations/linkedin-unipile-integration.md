# LinkedIn Integration via Unipile - SAM AI Knowledge Base

> **📋 Project Guidelines:** See [CLAUDE.md](/CLAUDE.md) for project instructions, implementation status, and anti-hallucination protocols.

## Overview
This document outlines the complete LinkedIn integration architecture for SAM AI using Unipile's API. This replaces the previous implementation that had issues with double logins, async cookies compatibility, and null organization references.

## Core Architecture

### Authentication Strategy
**Recommended Approach: Hosted Auth Wizard**
- Use Unipile's hosted authentication wizard for seamless user experience
- Eliminates double login issues reported by Unipile support
- Supports multiple platforms (LinkedIn, WhatsApp, Instagram, Email)
- Automatically handles OAuth flows and token management

### Preventing Multiple Logins (Critical Implementation Detail)
**Direct guidance from Unipile Support (Arnaud Hartmann):**

> "you can't with a parameter, the ways are to use 'reconnect' if you user have already connected an account on your side instead of reconnect. And additionnal on account creation success, you can compare it to existing account and then use DELETE account route if needed, its noted invoiced if deleted directly"

**Implementation Strategy:**
1. **Check existing connections first** - Query your database for existing LinkedIn associations
2. **Use 'reconnect' for existing accounts** - If user already has a LinkedIn connection, use reconnect flow instead of create
3. **Post-creation duplicate detection** - After successful account creation, compare with existing accounts
4. **Clean up duplicates immediately** - Use DELETE account route for duplicates (note: deletion is still invoiced)

```typescript
// Before initiating connection
const existingConnection = await checkExistingLinkedInConnection(userId)
const authAction = existingConnection ? 'reconnect' : 'create'

const authUrl = `https://${UNIPILE_DSN}/api/v1/users/${userId}/accounts/${authAction}`
```

### Integration Flow
```
1. User clicks "Connect LinkedIn" in SAM AI
2. Redirect to Unipile Hosted Auth with return URL
3. User completes LinkedIn OAuth via Unipile
4. Unipile redirects back to SAM AI with connection details
5. SAM AI stores association in user_unipile_accounts table
6. System begins monitoring LinkedIn messages via webhooks
```

## Database Schema

### Current Implementation
The existing `user_unipile_accounts` table structure:
```sql
CREATE TABLE user_unipile_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unipile_account_id TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('LINKEDIN', 'EMAIL', 'WHATSAPP')),
  account_name TEXT,
  account_email TEXT,
  linkedin_public_identifier TEXT,
  linkedin_profile_url TEXT,
  connection_status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Required Enhancements
Add columns for improved tracking:
```sql
ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS:
- unipile_proxy_id TEXT -- For proxy management
- connection_method TEXT -- 'hosted_auth' or 'custom_auth'
- last_sync_at TIMESTAMP WITH TIME ZONE
- message_count INTEGER DEFAULT 0
- webhook_url TEXT -- For account-specific webhooks
```

## API Implementation

### 1. Connection Initiation (Prevents Double Login)
**Endpoint:** `POST /api/linkedin/connect`
```typescript
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  
  // CRITICAL: Check for existing LinkedIn connections first
  const { data: existingConnections } = await supabase
    .from('user_unipile_accounts')
    .select('unipile_account_id, connection_status')
    .eq('user_id', user.id)
    .eq('platform', 'LINKEDIN')
  
  // Determine action: 'reconnect' for existing, 'create' for new
  const hasExistingConnection = existingConnections && existingConnections.length > 0
  const authAction = hasExistingConnection ? 'reconnect' : 'create'
  
  // Generate Unipile hosted auth URL with correct action
  const authUrl = `https://${UNIPILE_DSN}/api/v1/users/${user.id}/accounts/${authAction}`
  const params = new URLSearchParams({
    providers: 'LINKEDIN',
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/linkedin/callback`,
    user_id: user.id
  })
  
  console.log(`🔗 LinkedIn ${authAction} initiated for user ${user.email}`)
  
  return NextResponse.json({
    auth_url: `${authUrl}?${params.toString()}`,
    action: authAction,
    existing_connections: existingConnections?.length || 0
  })
}
```

### 2. Connection Callback (with Duplicate Detection)
**Endpoint:** `POST /api/linkedin/callback`
```typescript
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const body = await request.json()
  
  const { account_id, user_id, provider, status } = body
  
  if (status === 'connected' && provider === 'LINKEDIN') {
    // Fetch account details from Unipile
    const accountDetails = await fetch(`https://${UNIPILE_DSN}/api/v1/accounts/${account_id}`, {
      headers: { 'X-API-KEY': UNIPILE_API_KEY }
    }).then(r => r.json())
    
    // Check for existing associations for this user
    const { data: existingAssociations } = await supabase
      .from('user_unipile_accounts')
      .select('unipile_account_id')
      .eq('user_id', user_id)
      .eq('platform', 'LINKEDIN')
    
    // Store new association
    const { data: newAssociation, error } = await supabase.rpc('create_user_association', {
      p_user_id: user_id,
      p_unipile_account_id: account_id,
      p_platform: 'LINKEDIN',
      p_account_name: accountDetails.name || accountDetails.connection_params?.im?.username,
      p_connection_method: 'hosted_auth'
    })
    
    if (error) {
      console.error('❌ Failed to store association:', error)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?linkedin=error`)
    }
    
    // CRITICAL: Duplicate detection and cleanup
    if (existingAssociations && existingAssociations.length > 0) {
      console.log(`🔍 Found ${existingAssociations.length} existing associations, checking for duplicates`)
      
      // Get all LinkedIn accounts from Unipile for this user
      const allUnipileAccounts = await fetch(`https://${UNIPILE_DSN}/api/v1/accounts`, {
        headers: { 'X-API-KEY': UNIPILE_API_KEY }
      }).then(r => r.json()).catch(() => [])
      
      const userLinkedInAccounts = allUnipileAccounts.filter(acc => 
        acc.type === 'LINKEDIN' && 
        existingAssociations.some(ea => ea.unipile_account_id === acc.id)
      )
      
      // If we have more than one account, delete duplicates (keeping the newest)
      if (userLinkedInAccounts.length > 1) {
        const accountsToDelete = userLinkedInAccounts
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(1) // Keep the first (newest), delete the rest
        
        for (const accountToDelete of accountsToDelete) {
          console.log(`🗑️ Deleting duplicate account: ${accountToDelete.id}`)
          
          // Delete from Unipile (note: this is still invoiced)
          await fetch(`https://${UNIPILE_DSN}/api/v1/accounts/${accountToDelete.id}`, {
            method: 'DELETE',
            headers: { 'X-API-KEY': UNIPILE_API_KEY }
          })
          
          // Remove from local database
          await supabase
            .from('user_unipile_accounts')
            .delete()
            .eq('unipile_account_id', accountToDelete.id)
        }
      }
    }
    
    console.log(`✅ LinkedIn connection successful for user ${user_id}`)
  }
  
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?linkedin=connected`)
}
```

### 3. Status Check (Fixed Implementation)
**Endpoint:** `GET /api/linkedin/status`
```typescript
export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json({ has_linkedin: false, error: 'Authentication required' }, { status: 401 })
  }
  
  // Check database associations
  const { data: associations } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('platform', 'LINKEDIN')
    .eq('connection_status', 'active')
  
  // Also verify with Unipile API
  const unipileAccounts = await fetch(`https://${UNIPILE_DSN}/api/v1/accounts`, {
    headers: { 'X-API-KEY': UNIPILE_API_KEY }
  }).then(r => r.json()).catch(() => [])
  
  const linkedinAccounts = unipileAccounts.filter(acc => 
    acc.type === 'LINKEDIN' && acc.status === 'OK'
  )
  
  return NextResponse.json({
    has_linkedin: associations?.length > 0 && linkedinAccounts.length > 0,
    local_count: associations?.length || 0,
    unipile_count: linkedinAccounts.length,
    accounts: linkedinAccounts.map(acc => ({
      id: acc.id,
      name: acc.connection_params?.im?.username || 'LinkedIn Account',
      status: acc.status
    }))
  })
}
```

## Message Handling

### Webhook Configuration
Set up webhooks to receive LinkedIn messages in real-time:
```typescript
// Webhook endpoint: POST /api/linkedin/webhook
export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-unipile-signature')
  const body = await request.text()
  
  // Verify webhook signature
  if (!verifyUnipileSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }
  
  const event = JSON.parse(body)
  
  if (event.object === 'message' && event.type === 'message.received') {
    // Process LinkedIn message
    await processLinkedInMessage(event.data)
  }
  
  return NextResponse.json({ success: true })
}
```

### Message Processing
```typescript
async function processLinkedInMessage(messageData: any) {
  const { account_id, chat_id, text, sender } = messageData
  
  // Find user association
  const { data: association } = await supabase
    .from('user_unipile_accounts')
    .select('user_id')
    .eq('unipile_account_id', account_id)
    .single()
  
  if (!association) return
  
  // Store message in conversations table
  await supabase.from('conversations').insert({
    user_id: association.user_id,
    platform: 'LINKEDIN',
    external_chat_id: chat_id,
    message_text: text,
    sender_name: sender.name,
    direction: 'inbound',
    unipile_message_id: messageData.id
  })
  
  // Trigger SAM AI response if needed
  await triggerSamResponse(association.user_id, messageData)
}
```

## SAM AI Integration

### Context Enhancement
Inject LinkedIn context into SAM conversations:
```typescript
function enhancePromptWithLinkedInContext(userPrompt: string, linkedinData: any) {
  const context = `
LinkedIn Profile Context:
- Connected account: ${linkedinData.account_name}
- Profile: ${linkedinData.linkedin_profile_url}
- Recent conversations: ${linkedinData.recent_message_count}
- Last activity: ${linkedinData.last_sync_at}

User Query: ${userPrompt}
`
  return context
}
```

### Response Routing
```typescript
async function sendLinkedInResponse(accountId: string, chatId: string, message: string) {
  const response = await fetch(`https://${UNIPILE_DSN}/api/v1/accounts/${accountId}/chats/${chatId}/messages`, {
    method: 'POST',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: message,
      type: 'text'
    })
  })
  
  return response.json()
}
```

## Rate Limits & Best Practices

### LinkedIn Provider Limits (from Unipile docs)
- **Message Rate Limit:** 100 messages per day per LinkedIn account
- **Connection Requests:** 25 per week per account
- **Profile Views:** Unlimited but monitored
- **Search Limits:** Based on LinkedIn subscription level

### Implementation Best Practices

1. **Rate Limiting**
   - Implement exponential backoff for API calls
   - Queue messages to respect LinkedIn's daily limits
   - Monitor response times and adjust accordingly

2. **Error Handling**
   - Handle account disconnections gracefully
   - Retry failed messages with exponential backoff
   - Log all API errors for debugging

3. **Data Privacy**
   - Store minimal LinkedIn data required for functionality
   - Implement data retention policies
   - Respect user privacy settings and GDPR requirements

4. **Connection Management**
   - Use 'reconnect' instead of 'create' for existing accounts
   - Handle proxy disconnections and reconnections
   - Monitor connection health via regular status checks

## Migration from Current Implementation

### Phase 1: Database Updates
1. Add new columns to `user_unipile_accounts` table
2. Update RPC functions to handle new fields
3. Migrate existing associations to new structure

### Phase 2: API Replacement
1. Replace current `/api/linkedin/associate` with new hosted auth flow
2. Update `/api/linkedin/status` with dual verification
3. Implement webhook endpoints for real-time messaging

### Phase 3: Frontend Updates
1. Update LinkedIn connection UI to use hosted auth
2. Add connection status indicators
3. Implement message history display

### Phase 4: SAM Integration
1. Connect LinkedIn context to SAM AI prompts
2. Implement response routing through Unipile
3. Add conversation management features

## Error Handling & Troubleshooting

### Common Issues
1. **Double Login:** Use hosted auth instead of custom implementation
2. **Async Cookies:** Always `await cookies()` in Next.js 15
3. **Null Organization:** Add null checks before accessing organization properties
4. **Rate Limits:** Implement queue system with rate limiting
5. **Webhook Failures:** Add retry mechanism with exponential backoff

### Monitoring
- Track connection success rates
- Monitor message delivery rates
- Log API response times and errors
- Alert on webhook failures

## Unipile API Integration Patterns

### Core Concepts (from Unipile Quickstart)

**Two-Component Architecture:**
1. **Methods** - RESTful API endpoints for read/write/update operations
2. **Realtime** - Webhooks for real-time event notifications (messages, read receipts, etc.)

**Universal Integration Principle:**
- Learn once, integrate with every provider
- Same methods work across LinkedIn, WhatsApp, Telegram, etc.
- Consistent API patterns across all messaging platforms

### Required Setup Elements

**1. DSN (Data Source Name)**
```typescript
// Environment variable
const UNIPILE_DSN = process.env.UNIPILE_DSN // e.g., 'your-subdomain.unipile.com'

// Base URL for all requests
const baseUrl = `https://${UNIPILE_DSN}/api/v1`
```

**2. Access Token with Scopes**
```typescript
// Environment variable
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY

// Header for all requests
const headers = {
  'X-API-KEY': UNIPILE_API_KEY,
  'Content-Type': 'application/json'
}
```

**3. Account Connection Flow**
```typescript
// Step 1: Connect account (via hosted auth or programmatic)
POST /accounts/connect
// Step 2: Account appears as "Running" status
GET /accounts
// Step 3: Use account_id for all subsequent operations
```

### LinkedIn-Specific Implementation Patterns

**1. Chat Management**
```typescript
// List all LinkedIn chats
async function getLinkedInChats(accountId: string) {
  const response = await fetch(`${baseUrl}/accounts/${accountId}/chats`, {
    headers: { 'X-API-KEY': UNIPILE_API_KEY }
  })
  return response.json()
}

// Get specific chat details
async function getChat(accountId: string, chatId: string) {
  const response = await fetch(`${baseUrl}/accounts/${accountId}/chats/${chatId}`, {
    headers: { 'X-API-KEY': UNIPILE_API_KEY }
  })
  return response.json()
}
```

**2. Message Operations**
```typescript
// Send message to LinkedIn chat
async function sendLinkedInMessage(accountId: string, chatId: string, text: string) {
  const response = await fetch(`${baseUrl}/accounts/${accountId}/chats/${chatId}/messages`, {
    method: 'POST',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      type: 'text'
    })
  })
  return response.json()
}

// List messages in chat
async function getChatMessages(accountId: string, chatId: string, limit = 50) {
  const response = await fetch(
    `${baseUrl}/accounts/${accountId}/chats/${chatId}/messages?limit=${limit}`,
    { headers: { 'X-API-KEY': UNIPILE_API_KEY } }
  )
  return response.json()
}
```

**3. Real-time Message Handling**
```typescript
// Webhook payload structure for new LinkedIn messages
interface UnipileMessageWebhook {
  object: 'message'
  type: 'message.received' | 'message.sent' | 'message.updated'
  data: {
    id: string
    account_id: string
    chat_id: string
    text: string
    type: 'text' | 'image' | 'file'
    sender: {
      id: string
      name: string
      type: 'contact' | 'user'
    }
    created_at: string
    updated_at: string
  }
}

// Process incoming webhook
export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-unipile-signature')
  const body = await request.text()
  
  // Verify signature for security
  if (!verifyUnipileSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }
  
  const webhook: UnipileMessageWebhook = JSON.parse(body)
  
  if (webhook.type === 'message.received') {
    // Process new LinkedIn message
    await processIncomingLinkedInMessage(webhook.data)
  }
  
  return NextResponse.json({ success: true })
}
```

### SAM AI Integration Patterns

**1. Context-Aware Responses**
```typescript
async function generateSamResponseWithLinkedInContext(
  messageData: any,
  userContext: any
) {
  const context = `
LinkedIn Conversation Context:
- Account: ${messageData.account_name}
- Chat with: ${messageData.sender.name}
- Recent messages: ${messageData.recent_messages?.length || 0}
- Conversation topic: ${inferTopicFromMessages(messageData.recent_messages)}

User Query: ${messageData.text}
SAM AI, respond appropriately considering this is a LinkedIn professional conversation.
`
  
  // Send to SAM AI with enhanced context
  return await generateSamResponse(context, userContext)
}
```

**2. Multi-Platform Message Routing**
```typescript
async function routeMessageToPlatform(
  platform: 'LINKEDIN' | 'WHATSAPP' | 'EMAIL',
  accountId: string,
  chatId: string,
  message: string
) {
  switch (platform) {
    case 'LINKEDIN':
      return sendLinkedInMessage(accountId, chatId, message)
    case 'WHATSAPP':
      return sendWhatsAppMessage(accountId, chatId, message)
    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }
}
```

**3. Conversation State Management**
```typescript
// Store conversation state for SAM AI context
async function updateConversationState(
  userId: string,
  platform: string,
  chatId: string,
  messageData: any
) {
  await supabase.from('conversation_states').upsert({
    user_id: userId,
    platform: platform,
    external_chat_id: chatId,
    last_message_at: new Date().toISOString(),
    context_summary: await generateContextSummary(messageData),
    participant_count: messageData.participants?.length || 2,
    conversation_topic: inferTopicFromMessages([messageData])
  })
}
```

### Error Handling Patterns

**1. Rate Limit Handling**
```typescript
async function makeUnipileRequest(url: string, options: RequestInit, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options)
    
    if (response.status === 429) {
      // Rate limited - exponential backoff
      const delay = Math.pow(2, i) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
      continue
    }
    
    if (response.ok) {
      return response.json()
    }
    
    throw new Error(`Unipile API error: ${response.status} ${response.statusText}`)
  }
  
  throw new Error('Max retries exceeded')
}
```

**2. Account Disconnection Handling**
```typescript
async function handleAccountDisconnection(accountId: string, userId: string) {
  // Update local database
  await supabase
    .from('user_unipile_accounts')
    .update({ connection_status: 'disconnected' })
    .eq('unipile_account_id', accountId)
  
  // Notify user
  await sendNotification(userId, {
    type: 'account_disconnected',
    platform: 'LINKEDIN',
    message: 'Your LinkedIn account has been disconnected. Please reconnect to continue messaging.'
  })
  
  // Trigger reconnection flow
  await triggerReconnectionFlow(userId, 'LINKEDIN')
}
```

## Security Considerations

### API Keys
- Store Unipile credentials in environment variables
- Use different keys for development/production
- Rotate keys regularly
- Scope tokens appropriately (messaging, contacts, etc.)

### Webhook Security
- Verify webhook signatures using Unipile's signature verification
- Use HTTPS for all webhook endpoints
- Implement IP whitelisting if available
- Rate limit webhook endpoints to prevent abuse

### Data Protection
- Encrypt sensitive LinkedIn data at rest
- Implement proper access controls with RLS
- Audit data access patterns
- Respect LinkedIn's data usage policies
- Implement data retention policies for messages

## Implementation Guide for SAM AI

### Phase 1: Basic LinkedIn Integration (Week 1)

**Goal:** Replace current problematic implementation with robust Unipile-based solution

**Tasks:**
1. **Setup Unipile Account & Configuration**
   ```bash
   # Environment variables needed
   UNIPILE_DSN=your-subdomain.unipile.com
   UNIPILE_API_KEY=your-api-key
   NEXT_PUBLIC_APP_URL=https://app.meet-sam.com
   ```

2. **Database Migration**
   ```sql
   -- Add new columns to existing table
   ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS
     connection_method TEXT DEFAULT 'hosted_auth',
     last_sync_at TIMESTAMP WITH TIME ZONE,
     linkedin_experience TEXT CHECK (linkedin_experience IN ('classic', 'sales_navigator', 'recruiter')),
     webhook_url TEXT;
   ```

3. **Replace API Endpoints**
   - Delete existing `/api/linkedin/associate/route.ts`
   - Create new `/api/linkedin/connect/route.ts` (reconnect vs create logic)
   - Update `/api/linkedin/status/route.ts` (already fixed)
   - Create `/api/linkedin/callback/route.ts` (duplicate cleanup)

### Phase 2: Advanced LinkedIn Features (Week 2)

**LinkedIn Experience Support:**
```typescript
// Support for LinkedIn Classic, Sales Navigator, and Recruiter
async function getLinkedInInbox(accountId: string, experience: 'classic' | 'sales_navigator' | 'recruiter') {
  const chats = await fetch(`${baseUrl}/accounts/${accountId}/chats`, {
    headers: { 'X-API-KEY': UNIPILE_API_KEY }
  }).then(r => r.json())
  
  // Filter based on LinkedIn experience
  return chats.filter(chat => chat.source_experience === experience)
}
```

**Profile Data Enrichment:**
```typescript
// Get enriched LinkedIn profile data
async function getLinkedInProfile(accountId: string, profileUrl: string) {
  const response = await fetch(`${baseUrl}/accounts/${accountId}/users/profile`, {
    method: 'POST',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      profile_url: profileUrl
    })
  })
  return response.json()
}

// List connections and followers
async function getLinkedInConnections(accountId: string, limit = 100) {
  const response = await fetch(`${baseUrl}/accounts/${accountId}/relations?limit=${limit}`, {
    headers: { 'X-API-KEY': UNIPILE_API_KEY }
  })
  return response.json()
}
```

**Connection Management:**
```typescript
// Send LinkedIn invitation
async function sendLinkedInInvitation(accountId: string, profileUrl: string, message?: string) {
  const response = await fetch(`${baseUrl}/accounts/${accountId}/invitations`, {
    method: 'POST',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      profile_url: profileUrl,
      message: message
    })
  })
  return response.json()
}
```

### Phase 3: Multi-Channel Integration (Week 3)

**Combine LinkedIn + Email + Calendar:**
```typescript
// Multi-channel sequence implementation
interface ChannelSequence {
  linkedin_message?: {
    account_id: string
    chat_id: string
    text: string
  }
  email?: {
    to: string
    subject: string
    body: string
  }
  calendar?: {
    title: string
    attendees: string[]
    date: Date
  }
}

async function executeMultiChannelSequence(sequence: ChannelSequence) {
  const results = []
  
  if (sequence.linkedin_message) {
    const linkedinResult = await sendLinkedInMessage(
      sequence.linkedin_message.account_id,
      sequence.linkedin_message.chat_id,
      sequence.linkedin_message.text
    )
    results.push({ channel: 'linkedin', result: linkedinResult })
  }
  
  if (sequence.email) {
    const emailResult = await sendEmail(sequence.email)
    results.push({ channel: 'email', result: emailResult })
  }
  
  if (sequence.calendar) {
    const calendarResult = await createCalendarEvent(sequence.calendar)
    results.push({ channel: 'calendar', result: calendarResult })
  }
  
  return results
}
```

### Phase 4: SAM AI Deep Integration (Week 4)

**Context-Aware LinkedIn Intelligence:**
```typescript
async function enhanceSamWithLinkedInData(userId: string, prompt: string) {
  // Get user's LinkedIn connections
  const { data: accounts } = await supabase
    .from('user_unipile_accounts')
    .select('unipile_account_id')
    .eq('user_id', userId)
    .eq('platform', 'LINKEDIN')
    .eq('connection_status', 'active')
  
  if (accounts.length === 0) {
    return prompt // No LinkedIn context available
  }
  
  // Gather LinkedIn context
  const linkedinContext = []
  for (const account of accounts) {
    const connections = await getLinkedInConnections(account.unipile_account_id, 50)
    const recentChats = await getLinkedInChats(account.unipile_account_id)
    
    linkedinContext.push({
      account_id: account.unipile_account_id,
      connection_count: connections.length,
      active_conversations: recentChats.filter(chat => 
        new Date(chat.last_message_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length
    })
  }
  
  const enhancedPrompt = `
LinkedIn Professional Context:
- Connected LinkedIn accounts: ${linkedinContext.length}
- Total connections: ${linkedinContext.reduce((sum, ctx) => sum + ctx.connection_count, 0)}
- Active conversations this week: ${linkedinContext.reduce((sum, ctx) => sum + ctx.active_conversations, 0)}

User Request: ${prompt}

SAM AI, consider this LinkedIn professional context when responding. Focus on networking, relationship building, and professional communication strategies.
`
  
  return enhancedPrompt
}
```

**Automated Response Generation:**
```typescript
async function generateLinkedInResponse(messageData: any, userProfile: any) {
  const context = `
LinkedIn Message Context:
- From: ${messageData.sender.name}
- Message: ${messageData.text}
- Conversation history: ${messageData.recent_messages?.length || 0} messages
- User's industry: ${userProfile.industry}
- User's role: ${userProfile.job_title}

Generate a professional LinkedIn response that:
1. Maintains professional tone
2. Adds value to the conversation
3. Builds the professional relationship
4. Aligns with user's business goals
`
  
  const samResponse = await generateSamResponse(context, userProfile)
  
  // Apply LinkedIn-specific formatting
  return formatLinkedInMessage(samResponse)
}
```

### Phase 5: Production Optimization (Week 5)

**Rate Limit Management:**
```typescript
class LinkedInRateLimiter {
  private queues = new Map<string, any[]>()
  private timers = new Map<string, NodeJS.Timeout>()
  
  async queueMessage(accountId: string, action: () => Promise<any>) {
    if (!this.queues.has(accountId)) {
      this.queues.set(accountId, [])
    }
    
    const queue = this.queues.get(accountId)!
    queue.push(action)
    
    if (!this.timers.has(accountId)) {
      this.processQueue(accountId)
    }
  }
  
  private async processQueue(accountId: string) {
    const queue = this.queues.get(accountId)!
    
    if (queue.length === 0) {
      this.timers.delete(accountId)
      return
    }
    
    const action = queue.shift()!
    
    try {
      await action()
    } catch (error) {
      console.error('LinkedIn action failed:', error)
    }
    
    // LinkedIn rate limit: ~100 messages/day, ~25 invitations/week
    const delay = 900000 // 15 minutes between actions
    
    this.timers.set(accountId, setTimeout(() => {
      this.processQueue(accountId)
    }, delay))
  }
}
```

**Monitoring & Analytics:**
```typescript
async function trackLinkedInEngagement(userId: string, accountId: string) {
  const metrics = {
    messages_sent: 0,
    messages_received: 0,
    connections_made: 0,
    profile_views: 0,
    response_rate: 0
  }
  
  // Calculate metrics from recent activity
  const recentActivity = await getRecentLinkedInActivity(accountId)
  
  // Store in analytics table
  await supabase.from('linkedin_analytics').upsert({
    user_id: userId,
    account_id: accountId,
    period: 'weekly',
    metrics: metrics,
    calculated_at: new Date().toISOString()
  })
  
  return metrics
}
```

### Deployment Checklist

**Environment Setup:**
- [ ] Unipile DSN configured
- [ ] API keys secured in environment variables
- [ ] Webhook endpoints configured with HTTPS
- [ ] Database migrations applied

**Security:**
- [ ] Webhook signature verification implemented
- [ ] Rate limiting enabled
- [ ] Data encryption at rest
- [ ] Access logging enabled

**Testing:**
- [ ] Account connection flow tested
- [ ] Message sending/receiving verified
- [ ] Duplicate account cleanup working
- [ ] Webhook processing functional
- [ ] SAM AI integration working

**Monitoring:**
- [ ] Error tracking configured
- [ ] Performance monitoring enabled
- [ ] User engagement analytics implemented
- [ ] LinkedIn rate limit monitoring active

This comprehensive implementation guide provides a complete roadmap for rebuilding the LinkedIn integration with Unipile, addressing all the issues encountered in the previous implementation while adding advanced features and following best practices.