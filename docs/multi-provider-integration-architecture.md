# Multi-Provider Integration Architecture
## Google & Microsoft Email/Calendar Integration for SAM AI

## Executive Summary

This document outlines the architecture for adding multi-provider integration to SAM AI, including Google Workspace, Microsoft 365, and messaging platforms (WhatsApp, Instagram, Telegram) via Unipile, complementing the existing LinkedIn integration. This will enable SAM AI to:

- **Email Integration**: Access Gmail/Outlook for prospect research and context
- **Calendar Integration**: Schedule meetings and track engagement
- **Contact Sync**: Enrich prospect data from email contacts and messaging platforms
- **Meeting Intelligence**: Analyze meeting patterns and outcomes
- **Multi-Channel Messaging**: WhatsApp, Instagram, Telegram, LinkedIn messaging
- **Unified Communication Hub**: All channels in one platform

## 🎯 Business Value

### Immediate Benefits
- **Enhanced Prospect Research**: Access email history with prospects
- **Intelligent Scheduling**: SAM can schedule meetings directly
- **Contact Enrichment**: Merge email contacts with LinkedIn data
- **Meeting Follow-up**: Automated post-meeting outreach

### Strategic Advantages
- **Unified Communication Hub**: All channels in one platform
- **Better Context**: SAM understands full prospect relationship
- **Automated Workflows**: Email → LinkedIn → Calendar → Follow-up
- **Enterprise Appeal**: G-Suite/O365 integration critical for B2B

## 🏗 Technical Architecture

### Provider Support Matrix
```
┌─────────────────┬──────────────┬───────────────┬─────────────────┬─────────────────┐
│ Provider        │ Email        │ Calendar      │ Contacts        │ Messaging       │
├─────────────────┼──────────────┼───────────────┼─────────────────┼─────────────────┤
│ Google          │ Gmail API    │ Calendar API  │ People API      │ N/A             │
│ Microsoft       │ Graph API    │ Graph API     │ Graph API       │ Teams API       │
│ LinkedIn        │ N/A          │ N/A           │ Unipile API     │ Unipile API     │
│ WhatsApp        │ N/A          │ N/A           │ Unipile API     │ Unipile API     │
│ Instagram       │ N/A          │ N/A           │ Unipile API     │ Unipile API     │
│ Telegram        │ N/A          │ N/A           │ Unipile API     │ Unipile API     │
│ Future: SMS     │ N/A          │ N/A           │ Twilio API      │ Twilio API      │
│ Future: Apple   │ iCloud API   │ EventKit      │ Contacts API    │ iMessage API    │
└─────────────────┴──────────────┴───────────────┴─────────────────┴─────────────────┘
```

### Integration Architecture
```
SAM AI Platform
├── Authentication Layer
│   ├── Clerk (User Auth)
│   ├── OAuth 2.0 (Google/Microsoft)
│   └── Refresh Token Management
├── Provider Abstraction Layer
│   ├── Google Provider
│   ├── Microsoft Provider
│   ├── LinkedIn Provider (Unipile)
│   └── Unified Provider Interface
├── Data Synchronization
│   ├── Email Sync Engine
│   ├── Calendar Sync Engine
│   ├── Contact Sync Engine
│   └── Incremental Updates
├── AI Integration
│   ├── Email Context Analysis
│   ├── Meeting Intelligence
│   ├── Contact Enrichment
│   └── SAM Conversation Context
└── Security & Compliance
    ├── Data Encryption
    ├── GDPR/CCPA Compliance
    ├── Enterprise Permissions
    └── Audit Logging
```

## 🔗 Database Schema Design

### Core Tables
```sql
-- Multi-provider account management
CREATE TABLE user_provider_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'GOOGLE', 'MICROSOFT', 'LINKEDIN'
  provider_account_id TEXT NOT NULL,
  account_email TEXT,
  account_name TEXT,
  connection_status TEXT NOT NULL DEFAULT 'active',
  
  -- OAuth tokens (encrypted)
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Provider-specific data
  provider_metadata JSONB DEFAULT '{}',
  
  -- Permissions granted
  scopes_granted TEXT[],
  email_permission BOOLEAN DEFAULT false,
  calendar_permission BOOLEAN DEFAULT false,
  contacts_permission BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(provider, provider_account_id)
);

-- Email synchronization
CREATE TABLE synchronized_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_account_id UUID NOT NULL REFERENCES user_provider_accounts(id) ON DELETE CASCADE,
  
  -- Email identifiers
  provider_message_id TEXT NOT NULL,
  thread_id TEXT,
  
  -- Email metadata
  subject TEXT,
  sender_email TEXT,
  sender_name TEXT,
  recipient_emails TEXT[],
  cc_emails TEXT[],
  bcc_emails TEXT[],
  
  -- Content (encrypted)
  body_text_encrypted TEXT,
  body_html_encrypted TEXT,
  
  -- Analysis
  is_prospect_related BOOLEAN DEFAULT false,
  prospect_emails TEXT[], -- Extracted prospect emails
  sentiment_score FLOAT,
  important_score FLOAT,
  
  -- Timestamps
  email_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(provider_account_id, provider_message_id)
);

-- Calendar synchronization
CREATE TABLE synchronized_calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_account_id UUID NOT NULL REFERENCES user_provider_accounts(id) ON DELETE CASCADE,
  
  -- Event identifiers
  provider_event_id TEXT NOT NULL,
  calendar_id TEXT,
  
  -- Event details
  title TEXT,
  description TEXT,
  location TEXT,
  
  -- Attendees
  organizer_email TEXT,
  attendee_emails TEXT[],
  
  -- Timing
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  timezone TEXT,
  is_all_day BOOLEAN DEFAULT false,
  
  -- Status
  event_status TEXT, -- 'confirmed', 'tentative', 'cancelled'
  response_status TEXT, -- 'accepted', 'declined', 'tentative', 'needsAction'
  
  -- Analysis
  is_prospect_meeting BOOLEAN DEFAULT false,
  prospect_emails TEXT[],
  meeting_outcome TEXT, -- 'scheduled', 'completed', 'no_show', 'rescheduled'
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(provider_account_id, provider_event_id)
);

-- Contact synchronization
CREATE TABLE synchronized_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_account_id UUID NOT NULL REFERENCES user_provider_accounts(id) ON DELETE CASCADE,
  
  -- Contact identifiers
  provider_contact_id TEXT NOT NULL,
  
  -- Contact details
  email_addresses TEXT[],
  phone_numbers TEXT[],
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  company TEXT,
  job_title TEXT,
  
  -- Additional data
  provider_metadata JSONB DEFAULT '{}',
  
  -- Prospect matching
  is_prospect BOOLEAN DEFAULT false,
  linked_prospect_id UUID, -- Link to prospects table when created
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(provider_account_id, provider_contact_id)
);
```

## 🚀 Implementation Plan

### Phase 1: Foundation (Week 1-2)
1. **Database Schema**
   - Create multi-provider tables
   - Migrate existing LinkedIn data
   - Add encryption functions

2. **OAuth Authentication**
   - Google OAuth 2.0 setup
   - Microsoft Graph OAuth setup
   - Token refresh automation

3. **Provider Abstraction Layer**
   - Unified interface for all providers
   - Error handling and retry logic
   - Rate limiting compliance

### Phase 2: Google Integration (Week 2-3)
1. **Gmail API Integration**
   - Email fetching and parsing
   - Thread grouping
   - Incremental sync

2. **Google Calendar API**
   - Event retrieval
   - Meeting creation
   - Attendee management

3. **Google Contacts API**
   - Contact synchronization
   - Prospect matching

### Phase 3: Microsoft Integration (Week 3-4)
1. **Microsoft Graph API - Email**
   - Outlook email access
   - Exchange compatibility
   - Shared mailbox support

2. **Microsoft Graph API - Calendar**
   - Calendar event management
   - Teams meeting integration
   - Resource booking

3. **Microsoft Graph API - Contacts**
   - Contact synchronization
   - Distribution list access

### Phase 4: AI Integration (Week 4-5)
1. **Email Intelligence**
   - Prospect email identification
   - Sentiment analysis
   - Response suggestions

2. **Meeting Intelligence**
   - Meeting outcome tracking
   - Follow-up recommendations
   - Calendar availability

3. **SAM AI Context**
   - Inject email/calendar context
   - Meeting scheduling capabilities
   - Intelligent follow-up

## 🔐 Security Considerations

### Data Protection
- **Encryption at Rest**: All email content encrypted in database
- **Encryption in Transit**: TLS 1.3 for all API communications
- **Token Security**: OAuth tokens encrypted with rotation
- **Access Control**: Granular permissions per provider

### Compliance
- **GDPR**: Data portability, right to erasure, consent management
- **CCPA**: California privacy compliance
- **SOC 2**: Security controls for enterprise customers
- **HIPAA**: Healthcare data protection (for medical prospects)

### Enterprise Features
- **Admin Controls**: IT admin can manage integrations
- **Audit Logging**: Complete access trail
- **Data Residency**: Regional data storage options
- **SSO Integration**: SAML/OIDC for enterprise auth

## 🎨 User Experience Design

### Integration Flow
```
1. User visits "Integrations" page
2. Sees provider options: LinkedIn ✅ | Google ⚪ | Microsoft ⚪
3. Clicks "Connect Google" → OAuth flow
4. Grants permissions (email ✓, calendar ✓, contacts ✓)
5. Returns to SAM AI with "Google ✅" status
6. SAM AI begins syncing data in background
7. User sees "Syncing emails..." progress
8. SAM AI gains email/calendar context
```

### SAM AI Conversation Enhancement
```
User: "Schedule a meeting with John Smith"
SAM: "I found John Smith in your Gmail contacts. He's at Acme Corp. 
      Looking at your calendar, you're free tomorrow at 2 PM or 
      Thursday at 10 AM. Which works better?"

User: "Tell me about my recent emails with prospects"
SAM: "You have 3 important prospect emails from this week:
      • Sarah from TechCorp replied to your proposal
      • Mike from StartupX wants to schedule a demo  
      • Lisa from Enterprise LLC needs pricing info
      Should I help you respond to any of these?"
```

## 📊 API Endpoints Design

### Provider Management
```typescript
// List all connected providers
GET /api/integrations/providers
Response: {
  linkedin: { connected: true, accounts: 1 },
  google: { connected: true, accounts: 2 },
  microsoft: { connected: false, accounts: 0 }
}

// Connect new provider
POST /api/integrations/providers/google/connect
Body: { scopes: ['email', 'calendar', 'contacts'] }
Response: { auth_url: "https://accounts.google.com/oauth/..." }

// Handle OAuth callback
POST /api/integrations/providers/google/callback
Body: { code: "auth_code", state: "csrf_token" }
Response: { success: true, account_id: "xyz" }

// Disconnect provider
DELETE /api/integrations/providers/google/accounts/{account_id}
```

### Data Access
```typescript
// Get synchronized emails
GET /api/integrations/emails
Query: { prospect_related: true, limit: 20, after: "cursor" }
Response: { emails: [...], has_more: true, next_cursor: "abc" }

// Get calendar events
GET /api/integrations/calendar/events
Query: { start: "2024-01-01", end: "2024-01-31" }
Response: { events: [...] }

// Get contacts
GET /api/integrations/contacts
Query: { is_prospect: true }
Response: { contacts: [...] }
```

## 🔧 Technical Requirements

### OAuth Configuration
```bash
# Google OAuth Setup
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://app.meet-sam.com/api/integrations/providers/google/callback

# Microsoft Graph Setup  
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
MICROSOFT_REDIRECT_URI=https://app.meet-sam.com/api/integrations/providers/microsoft/callback

# Encryption keys
PROVIDER_TOKEN_ENCRYPTION_KEY=your_32_byte_key
EMAIL_CONTENT_ENCRYPTION_KEY=your_32_byte_key
```

### Required Scopes
```typescript
// Google Scopes
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/contacts.readonly'
];

// Microsoft Scopes
const MICROSOFT_SCOPES = [
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/Calendars.ReadWrite',
  'https://graph.microsoft.com/Contacts.Read'
];
```

## 📈 Performance Considerations

### Sync Strategy
- **Initial Sync**: Last 30 days of data
- **Incremental Sync**: Every 5 minutes for new items
- **Background Jobs**: Queue-based processing
- **Rate Limiting**: Respect API limits (Gmail: 1B requests/day)

### Caching Strategy
- **Redis Cache**: Recent emails and events
- **Database Indexes**: Optimized queries
- **CDN**: Static assets
- **Edge Functions**: Real-time updates

## 🚦 Risk Mitigation

### Technical Risks
- **API Rate Limits**: Implement exponential backoff
- **Token Expiration**: Automatic refresh with fallback
- **Data Volume**: Pagination and selective sync
- **Provider Changes**: Abstraction layer protects against API changes

### Business Risks
- **Privacy Concerns**: Clear consent and data usage
- **Compliance**: Legal review for each market
- **Competition**: Focus on AI differentiation
- **Vendor Lock-in**: Multi-provider strategy

## 🎯 Success Metrics

### Adoption Metrics
- **Integration Rate**: % users connecting each provider
- **Sync Success**: % successful data synchronizations
- **User Retention**: Increased retention with integrations
- **Feature Usage**: Email/calendar features in SAM conversations

### Business Metrics
- **Prospect Quality**: Better prospect data from email/calendar
- **Meeting Conversion**: Scheduled → held meeting rate
- **Response Rates**: Email response improvements
- **Customer Satisfaction**: NPS impact of integrations

## 🗺 Roadmap

### Q1 2025: Foundation
- Google Gmail integration
- Microsoft Outlook integration
- Basic calendar sync
- Security framework

### Q2 2025: Intelligence
- AI email analysis
- Meeting intelligence
- Smart scheduling
- Contact enrichment

### Q3 2025: Enterprise
- Admin controls
- Advanced security
- Compliance certifications
- Multi-tenant support

### Q4 2025: Advanced Features
- Email templates
- Automated sequences
- CRM integration
- Advanced analytics

This architecture provides a solid foundation for multi-provider integration while maintaining security, scalability, and user experience standards.