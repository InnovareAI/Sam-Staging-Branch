# Unipile LinkedIn Campaign Capabilities

## 📊 Unipile Platform Feature Matrix

### Core Messaging Features

| Feature | WhatsApp | LinkedIn | Instagram | Telegram | Messenger | Twitter |
|---------|----------|----------|-----------|----------|-----------|---------|
| **Account Connection** | | | | | | |
| Hosted Auth | 🟢 | 🟢 | 🟢 | 🟢 | 🟠 | 🟠 |
| Custom Auth | 🟢 | 🟢 | 🟢 | 🟢 | 🟠 | 🟠 |
| **Messages** | | | | | | |
| Send Messages | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| Reply Messages | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| List Messages | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| List Chats | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| List Attendees | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| Sync History | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| List Reactions | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| Read Receipts | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| **Attachments** | | | | | | |
| Send File Attachments | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| Receive File Attachments | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| Send Voice Notes | 🟢 | 🟢 | 🟢 | 🟢 | ❌ | ❌ |
| Send Embed Video | 🟢 | 🟢 | ❌ | ❌ | ❌ | ❌ |
| **Profiles** | | | | | | |
| Retrieve User Profiles | 🟢 | 🟢 | 🟢 | 🟢 | 🔴 | 🟢 |
| Retrieve Own Profile | 🔴 | 🟢 | 🟢 | 🔴 | 🟢 | ❌ |
| Is Number On Platform | 🟢 | ❌ | ❌ | 🟢 | ❌ | ❌ |
| **Webhooks** | | | | | | |
| Account Status | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| New Message | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| New Reaction/Read/Event | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |

### LinkedIn-Specific Features

| Feature Category | LinkedIn | Instagram |
|------------------|----------|-----------|
| **Outreach** | | |
| Invite Users | 🟢 | ❌ |
| Send InMail | 🟢 | ❌ |
| Retrieve InMail Credits | 🟢 | ❌ |
| Create Outreach Sequence | 🟢 | ❌ |
| List Pending Invitations | 🟢 | ❌ |
| Delete Pending Invitations | 🟢 | ❌ |
| Detecting Accepted Invitations | 🟢 | ❌ |
| Following Someone | 🟢 | 🟢 |
| List/Accept/Decline Incoming Invitations | 🟢 | ❌ |
| Endorse Skills | 🟢 | ❌ |
| **Posts & Comments** | | |
| List Posts of Users and Companies | 🟢 | 🟢 |
| Add Reaction on Post or Comment | 🟢 | 🟢 |
| Send Comments | 🟢 | 🟢 |
| List Post Comments | 🟢 | 🟢 |
| List Post Reactions | 🟢 | 🟢 |
| Create a Post | 🟢 | 🟢 |
| Retrieve a Post | 🟢 | 🟢 |
| **Profiles** | | |
| Visit and Retrieve User Profiles | 🟢 | 🟢 |
| List of Contacts/Relations | 🟢 | 🟢 |
| Company Profiles | 🟢 | ❌ |
| Get Own Profile Viewers | 🟢 | ❌ |
| **Job Posting** | | |
| Create Job and Publish | 🟢 | ❌ |
| List Jobs | 🟢 | ❌ |
| Retrieve Applicants | 🟢 | ❌ |
| Get Resume of Applicants | 🟢 | ❌ |
| **Inboxes (Real-time)** | | |
| Classic | 🟢 | 🟢 |
| Sales Navigator | 🟢 | ❌ |
| Recruiter & Recruiter Lite | 🟢 | ❌ |
| Company Page | 🟢 | ❌ |
| **Search by URL or Parameters** | | |
| People (Classic/Recruiter/Sales Navigator) | 🟢 | 🟠 |
| Companies (Classic/Sales Navigator) | 🟢 | ❌ |
| Posts (Classic) | 🟢 | 🟠 |
| Jobs (Classic) | 🟢 | ❌ |

**Legend:**
- 🟢 Fully Supported
- 🟠 Partially Supported/Limited
- 🔴 Not Available
- ❌ Not Supported

## Supported Campaign Types

Based on Unipile's comprehensive feature matrix, the following campaign types can be implemented:

### ✅ **Connector Campaign** (FULLY SUPPORTED)
- **Description**: Reach out to 2nd and 3rd+ degree connections with personalized connection requests and follow-ups
- **Unipile Support**: Complete outreach API with advanced features
- **Key Features**:
  - ✅ Invite Users with personalized messages
  - ✅ List/Delete Pending Invitations
  - ✅ Detecting Accepted Invitations (webhook-based)
  - ✅ Real-time inbox monitoring (Classic/Sales Navigator/Recruiter)
  - ✅ Message attachments and voice notes
- **Limitations**: 80-100 invitations per day, 200 per week maximum
- **Implementation**: 
  - Send connection requests with personalized messages
  - Follow-up message sequences after acceptance
  - Webhook detection for accepted invitations
  - Outreach sequence automation

### ✅ **Messenger Campaign** (FULLY SUPPORTED) 
- **Description**: Send direct messages to contacts that approved your request
- **Unipile Support**: Complete messaging API with rich features
- **Key Features**:
  - ✅ Send/Reply Messages with full formatting
  - ✅ File attachments and voice notes support
  - ✅ Read receipts and message reactions
  - ✅ Chat history synchronization
  - ✅ Real-time webhook notifications
- **Implementation**: 
  - Send messages to existing 1st degree connections
  - Message sequences and follow-ups
  - Real-time message monitoring
  - Attachment and media support

### ✅ **Open InMail Campaign** (FULLY SUPPORTED)
- **Description**: Send messages to prospects without using a connection request
- **Unipile Support**: InMail API with credit management
- **Key Features**:
  - ✅ Send InMail to any LinkedIn user
  - ✅ Retrieve InMail Credits automatically
  - ✅ Sales Navigator integration
  - ✅ Recruiter platform support
- **Requirements**: LinkedIn Premium or Sales Navigator subscription
- **Implementation**: Direct messaging without connection requirement

### ✅ **Company Follow Campaign** (FULLY SUPPORTED)
- **Description**: Invite 1st degree connections to follow your company
- **Unipile Support**: Company page management API
- **Key Features**:
  - ✅ Following Someone functionality
  - ✅ Company page inbox management
  - ✅ Company profile retrieval
- **Implementation**: 
  - Batch invite connections to follow company page
  - Track follow acceptance rates
  - Company page messaging

### ✅ **Advanced Search Campaign** (FULLY SUPPORTED)
- **Description**: Target prospects through LinkedIn's advanced search capabilities
- **Unipile Support**: Comprehensive search API across all LinkedIn tiers
- **Key Features**:
  - ✅ People Search (Classic/Recruiter/Sales Navigator)
  - ✅ Company Search (Classic/Sales Navigator) 
  - ✅ Job Search (Classic)
  - ✅ URL-based and parameter-based search
  - ✅ Profile visit and retrieval
- **Implementation**:
  - Search-based prospect identification
  - Automated profile visiting for visibility
  - Search result to campaign prospect pipeline

### ✅ **Content Engagement Campaign** (FULLY SUPPORTED)
- **Description**: Engage with prospects through posts and comments
- **Unipile Support**: Full post and comment management API
- **Key Features**:
  - ✅ List Posts of Users and Companies
  - ✅ Add Reactions on Posts or Comments
  - ✅ Send Comments with engagement
  - ✅ Create and Retrieve Posts
  - ✅ List Post Comments and Reactions
- **Implementation**:
  - Automated post engagement for visibility
  - Strategic commenting for relationship building
  - Content-based prospect warming

### ✅ **Skill Endorsement Campaign** (LINKEDIN EXCLUSIVE)
- **Description**: Build relationships through skill endorsements
- **Unipile Support**: Native skill endorsement API
- **Key Features**:
  - ✅ Endorse Skills of target prospects
  - ✅ Profile analysis for relevant skills
- **Implementation**:
  - Automated skill endorsements for relationship building
  - Strategic endorsement timing

### ✅ **Multi-Platform Campaign** (CROSS-PLATFORM)
- **Description**: Coordinate campaigns across LinkedIn, WhatsApp, Instagram, and more
- **Unipile Support**: Unified API across 6+ platforms
- **Key Features**:
  - ✅ LinkedIn professional outreach
  - ✅ WhatsApp business messaging
  - ✅ Instagram social engagement
  - ✅ Telegram community outreach
  - ✅ Unified webhook system across platforms
- **Implementation**:
  - Cross-platform prospect journey
  - Platform-specific messaging strategies
  - Unified analytics and reporting

## LinkedIn Provider Limits & Restrictions

### Account Type Limitations

#### Free LinkedIn Accounts
- **Connection Invitations**: 15 per week maximum
- **Search Results**: 3 search pages (90 profiles) per day
- **Profile Views**: Limited visibility (may not see who viewed)
- **Messaging**: Basic messaging only to 1st connections

#### Paid LinkedIn Accounts (Premium/Sales Navigator)
- **Connection Invitations**: 80-100 per day (200 per week maximum)
- **Profile Views**: ~100 per day (Premium), 150-200 (Sales Navigator)
- **Search Results**: 1,000 profiles/day (Standard), 2,500 (Sales Navigator)
- **InMail Credits**: Varies by subscription tier

#### LinkedIn Recruiter Accounts
- **Session-Based Authentication**: Requires cookies/session tokens
- **Search Results**: Up to 2,500 profiles per day
- **Advanced Filtering**: Industry, company size, years of experience
- **InMail**: Higher limits based on subscription

### Rate Limiting Strategy

#### Conservative Approach (Recommended)
- **Daily Invitations**: 30-50 invitations maximum
- **Profile Views**: 50-80 profiles per day
- **Hourly Distribution**: 3-8 actions per hour during business hours
- **Random Spacing**: 5-15 minute delays between actions
- **Weekend Pause**: Reduce activity on weekends

#### Aggressive Approach (Higher Risk)
- **Daily Invitations**: 80-100 invitations
- **Profile Views**: 100-150 profiles per day
- **Requires**: Premium/Sales Navigator subscription
- **Risk**: Higher chance of temporary restrictions

### Platform-Specific Restrictions

#### Connection Request Limits
- **Free Accounts**: 15 per week total
- **Paid Accounts**: 100 per day, 200 per week maximum
- **Withdrawn Invitations**: Count against weekly limit
- **Acceptance Rate**: Low rates may trigger restrictions

#### Profile Viewing Limits
- **Standard**: ~100 profiles per day
- **Sales Navigator**: 150-200 profiles per day
- **Recruiter**: Up to 200+ profiles per day
- **Anonymous Viewing**: May have different limits

#### Search Result Caps
- **Free**: 3 search pages (90 profiles) per day
- **Premium**: 1,000 profiles per day
- **Sales Navigator**: 2,500 profiles per day
- **Recruiter**: 2,500+ profiles per day

#### InMail & Messaging
- **InMail Credits**: Subscription-dependent (5-150 per month)
- **Regular Messages**: Unlimited to 1st connections
- **Group Messages**: Limited by group membership
- **Company Page Messaging**: Separate limits apply

### LinkedIn Recruiter Considerations

#### Authentication Requirements
- **Cookie-Based**: Requires valid session cookies
- **Short Sessions**: May expire within hours
- **Multi-Device**: Cannot be used on multiple devices simultaneously
- **Headless Detection**: Advanced bot detection systems

#### Enhanced Capabilities
- **Advanced Search**: More filter options than Sales Navigator
- **Bulk Actions**: Higher limits for profile viewing/messaging
- **Analytics**: Detailed performance tracking
- **Team Features**: Shared candidate pools and notes

### Best Practices for Unipile Integration

#### Timing Strategies
- **Business Hours**: 9 AM - 5 PM in target timezone
- **Weekday Focus**: Monday-Friday primary activity
- **Random Intervals**: Vary timing to appear human-like
- **Break Periods**: Include lunch breaks and gaps

#### Action Sequencing
- **Mixed Activities**: Combine profile views, searches, invitations
- **Natural Flow**: Profile → View → Research → Connect
- **Avoid Patterns**: Don't send invitations at exact intervals
- **Gradual Ramp**: Start slow, increase activity over days

#### Account Health Monitoring
- **Acceptance Rates**: Track invitation acceptance percentages
- **Response Rates**: Monitor message reply rates
- **Warning Signs**: Watch for restriction notifications
- **Account Rotation**: Use multiple accounts for higher volume

### Error Handling & Recovery

#### Common Restriction Scenarios
- **Weekly Limit Reached**: Pause until reset (Sunday)
- **Too Many Pending**: Wait for acceptances/withdrawals
- **Suspicious Activity**: Reduce activity for 24-48 hours
- **Account Flagged**: Manual review may be required

#### Recommended Recovery Actions
- **Gradual Resume**: Slowly increase activity after restrictions
- **Profile Optimization**: Improve acceptance rates
- **Message Quality**: Focus on personalization
- **Account Verification**: Ensure profile completeness

## Unipile API Endpoints Used

### Account Management ✅ FULLY AVAILABLE
```bash
# List all connected accounts
GET /api/v1/accounts

# Get specific account details
GET /api/v1/accounts/{id}
```

**List Accounts Query Parameters:**
- `cursor` (string): Pagination cursor for next page
- `limit` (integer): Number of items (1-250)

**Account APIs Response Types:**
```typescript
// List Accounts Response
interface AccountListResponse {
  object: "AccountList";
  items: Account[];
  cursor: string | null;
}

// Single Account Response (GET /api/v1/accounts/{id})
interface Account {
  id: string;
  type: 'LINKEDIN' | 'WHATSAPP' | 'INSTAGRAM' | 'MESSENGER' | 'TELEGRAM' | 'TWITTER' | 'GOOGLE' | 'OUTLOOK' | 'SLACK';
  status: 'connected' | 'disconnected' | 'error';
  user_id?: string;
  feature?: 'classic' | 'sales_navigator' | 'recruiter' | 'organization';
  created_at: string;
  updated_at: string;
  // Additional account-specific details returned in individual retrieval
}
```

### Search & Lead Generation ✅ FULLY AVAILABLE

#### LinkedIn Search API
```bash
POST /api/v1/linkedin/search
```
**Purpose**: Search people, companies, posts, and jobs across LinkedIn Classic, Sales Navigator, and Recruiter

**Query Parameters:**
- `cursor` (string): Pagination cursor for next page
- `limit` (integer): 0-100 results (Classic max 50, Sales Navigator/Recruiter max 100)
- `account_id` (string, required): LinkedIn account ID

**Body Parameters** (varies by search type):
- **Classic People**: `keywords`, `location`, `current_company`, `past_company`, `school`, `field_of_study`, `industry`, `profile_language`, `service_category`, `network`, `connection_of`
- **Classic Companies**: `keywords`, `location`, `industry`, `company_size`, `company_type`
- **Sales Navigator People**: Extended filters including `seniority_level`, `function`, `years_of_experience`, `company_headcount`, `geography`
- **Recruiter People**: Advanced filters for candidate search

**Response:**
```typescript
interface LinkedinSearchResponse {
  object: "LinkedinSearch";
  items: SearchResult[];
  config: {
    params: SearchConfig;
  };
  paging: {
    start: number;
    page_count: number;
    total_count: number;
    cursor: string | null;
  };
}
```

#### Search Parameters API
```bash
GET /api/v1/linkedin/search/parameters
```
**Purpose**: Get LinkedIn search parameter IDs (LinkedIn requires IDs, not raw text)

**Query Parameters:**
- `limit` (integer): 1-100, default 10
- `keywords` (string): Keywords to search for parameter IDs
- `type` (string, required): Parameter type (see Unipile docs for full list)
- `account_id` (string, required): LinkedIn account ID

**Response:**
```typescript
interface LinkedinSearchParametersResponse {
  object: "LinkedinSearchParametersList";
  items: Array<{
    id: string;
    title: string;
    additional_data: object;
  }>;
  paging: {
    page_count: number;
  };
}
```

#### Profile Retrieval API
```bash
GET /api/v1/users/{identifier}
```
**Purpose**: Retrieve detailed LinkedIn user profiles

**Path Parameters:**
- `identifier` (string, required): LinkedIn user ID or public identifier

**Query Parameters:**
- `account_id` (string, required): LinkedIn account ID
- `linkedin_sections` (array): Specific profile sections to retrieve
- `linkedin_api` (enum): API tier - `recruiter`, `sales_navigator`, or classic (default)
- `notify` (boolean): Whether to notify user of profile visit (default: false)

**Response:** Returns comprehensive LinkedIn profile data including:
- Basic info (name, headline, location)
- Experience and education
- Skills and endorsements
- Network information
- Contact details (if available)

### Connection Management ✅ FULLY AVAILABLE

#### Send Invitation API (CORE CAMPAIGN FUNCTIONALITY)
```bash
POST /api/v1/users/invite
```
**Purpose**: Send LinkedIn connection requests with personalized messages

**Body Parameters:**
- `provider_id` (string, required): LinkedIn user ID to invite
- `account_id` (string, required): Your LinkedIn account ID
- `user_email` (string): Email address (LinkedIn specific requirement)
- `message` (string): Optional personalized message (max 300 characters)

**Response:**
```typescript
interface SendInvitationResponse {
  object: "UserInvitationSent";
  invitation_id: string;
  usage?: number; // Percentage of provider usage limit (50, 75, 90, 95)
}
```

**Rate Limiting**: Monitor `usage` field for LinkedIn limits (80-100 invitations/day)

#### List Sent Invitations API
```bash
GET /api/v1/users/invite/sent
```
**Purpose**: Track all pending connection requests you've sent

**Query Parameters:**
- `account_id` (string, required): LinkedIn account ID
- `cursor` (string): Pagination cursor
- `limit` (integer): 1-100 items, default 10

**Response:**
```typescript
interface InvitationListResponse {
  object: "InvitationList";
  items: InvitationSent[];
  cursor: string | null;
}

interface InvitationSent {
  id: string;
  invited_user: string;
  invited_user_id: string;
  invited_user_public_id: string;
  invited_user_description: string;
  date: string;
  parsed_datetime: string;
  invitation_text: string;
  inviter: object;
  specifics: object;
}
```

#### List Received Invitations API
```bash
GET /api/v1/users/invite/received
```
**Purpose**: View connection requests you've received

**Query Parameters:**
- `account_id` (string, required): LinkedIn account ID
- `cursor` (string): Pagination cursor
- `limit` (integer): 1-100 items, default 10

**Response:**
```typescript
interface InvitationReceived {
  // Same structure as InvitationSent + shared_secret
  id: string;
  invited_user: string;
  invited_user_id: string;
  invited_user_public_id: string;
  invited_user_description: string;
  date: string;
  parsed_datetime: string;
  invitation_text: string;
  inviter: object;
  specifics: object;
  shared_secret: string; // Required for accept/decline actions
}
```

#### Handle Received Invitation API
```bash
POST /api/v1/users/invite/received/{invitation_id}
```
**Purpose**: Accept or decline received connection requests

**Path Parameters:**
- `invitation_id` (string, required): Invitation ID from received list

**Body Parameters:**
- `provider` (string, required): Must be "LINKEDIN"
- `shared_secret` (string, required): Token from invitation list
- `account_id` (string, required): LinkedIn account ID
- `action` (enum, required): "accept" or "decline"

**Response:**
```typescript
interface HandleInvitationResponse {
  object: "UserInvitationHandled";
  status: string;
}
```

### Company & Profile APIs ✅ FULLY AVAILABLE

#### Company Profile API
```bash
GET /api/v1/linkedin/company/{identifier}
```
**Purpose**: Get detailed LinkedIn company information

**Path Parameters:**
- `identifier` (string, required): Company public identifier, ID, or URN

**Query Parameters:**
- `account_id` (string, required): LinkedIn account ID

**Response:**
```typescript
interface CompanyProfile {
  object: "CompanyProfile";
  id: string;
  name: string;
  description: string;
  entity_urn: string;
  public_identifier: string;
  profile_url: string;
  tagline: string;
  followers_count: number;
  is_following: boolean;
  is_employee: boolean;
  hashtags: Array<{ title: string }>;
  messaging: {
    is_enabled: boolean;
    id: string;
    entity_urn: string;
  };
  claimed: boolean;
  viewer_permissions: {
    // 30+ permission flags for company page management
    canMembersInviteToFollow: boolean;
    canCreateOrganicShare: boolean;
    canManageMessagingAccess: boolean;
    // ... additional permissions
  };
  organization_type: string;
  locations: Array<{
    is_headquarter: boolean;
    country: string;
    city: string;
    postalCode: string;
    street: string[];
    description: string;
    area: string;
  }>;
  logo: string;
  industry: string[];
  activities: string[];
  employee_count: number;
  employee_count_range: {
    from: number;
    to: number;
  };
  website: string;
  foundation_date: string;
  phone: string;
  insights: {
    employeesCount: object;
  };
  acquired_by?: {
    id: string;
    name: string;
    public_identifier: string;
    profile_url: string;
  };
  crunchbase_funding: object;
  last_updated_at: string;
  company_url: string;
}
```

### InMail Management ✅ FULLY AVAILABLE

#### InMail Credit Balance API
```bash
GET /api/v1/linkedin/inmail_balance
```
**Purpose**: Check available InMail credits across subscription tiers

**Query Parameters:**
- `account_id` (string, required): LinkedIn account ID

**Response:**
```typescript
interface LinkedinInmailBalance {
  object: "LinkedinInmailBalance";
  premium: number;
  recruiter: number;
  sales_navigator: number;
}
```

**Usage**: Check credits before sending InMails to avoid failures
```

**Send Invitation API (CORE CAMPAIGN FUNCTIONALITY):**
```typescript
// POST /api/v1/users/invite
interface SendInvitationRequest {
  provider_id: string;        // LinkedIn user ID to invite
  account_id: string;         // Your LinkedIn account ID
  user_email?: string;        // Email (LinkedIn specific requirement)
  message?: string;           // Optional message (max 300 chars)
}

interface SendInvitationResponse {
  object: "UserInvitationSent";
  invitation_id: string;
  usage?: number;             // Percentage of provider usage limit
}
```

**Handle Received Invitation API:**
```typescript
// POST /api/v1/users/invite/received/{invitation_id}
interface HandleInvitationRequest {
  provider: "LINKEDIN";
  shared_secret: string;      // LinkedIn token from invitation list
  account_id: string;
  action: "accept" | "decline";
}

interface HandleInvitationResponse {
  object: "UserInvitationHandled";
  status: string;
}
```

**List Invitations APIs:**
```typescript
// GET /api/v1/users/invite/sent & GET /api/v1/users/invite/received
interface InvitationListResponse {
  object: "InvitationList";
  items: InvitationSent[] | InvitationReceived[];
  cursor: string | null;
}

interface InvitationSent {
  id: string;
  invited_user: string;
  invited_user_id: string;
  invited_user_public_id: string;
  invited_user_description: string;
  date: string;
  parsed_datetime: string;
  invitation_text: string;
  inviter: object;
  specifics: object;
}

interface InvitationReceived {
  // Same structure as InvitationSent + shared_secret for handling
  id: string;
  invited_user: string;
  invited_user_id: string;
  invited_user_public_id: string;
  invited_user_description: string;
  date: string;
  parsed_datetime: string;
  invitation_text: string;
  inviter: object;
  specifics: object;
  shared_secret: string;      // Required for accept/decline actions
}
```

**Common Query Parameters:**
- `account_id` (required): LinkedIn account ID
- `cursor` (optional): Pagination cursor
- `limit` (optional): 1-100 items, default 10

### Messaging System ✅ FULLY AVAILABLE

#### Chat Management APIs

##### List All Chats
```bash
GET /api/v1/chats
```
**Purpose**: Get all conversations across all platforms
**Query Parameters:**
- Standard pagination parameters
**Response**: Array of chat objects with metadata

##### Start New Chat
```bash
POST /api/v1/chats
```
**Purpose**: Create new conversation or send message to user
**Body Parameters:**
- `account_id` (string, required): Sender account ID
- `attendees_ids` (array, required): Recipient user IDs
- `text` (string): Initial message text
- `title` (string): Group chat title (optional)
- `linkedin[api]` (enum): LinkedIn API tier - `classic`, `sales_navigator`, `recruiter`
- `linkedin[inmail]` (boolean): Send as InMail (requires Premium/Sales Navigator)

**Response:**
```typescript
interface ChatStartedResponse {
  object: "ChatStarted";
  chat_id: string;
  message_id: string;
}
```

##### Retrieve Chat Details
```bash
GET /api/v1/chats/{chat_id}
```
**Purpose**: Get conversation metadata and participants

##### Update Chat
```bash
PATCH /api/v1/chats/{chat_id}
```
**Purpose**: Perform actions on chat (mute, archive, etc.)

##### Synchronize Chat History
```bash
GET /api/v1/chats/{chat_id}/sync
```
**Purpose**: Sync conversation from beginning (useful for account reconnection)

#### Message Operations APIs

##### List Chat Messages
```bash
GET /api/v1/chats/{chat_id}/messages
```
**Purpose**: Get message history from specific conversation
**Query Parameters:**
- `limit` (integer): Number of messages (default 100)
- `cursor` (string): Pagination cursor

**Response**: Array of message objects (most recent first)

##### Send Message to Chat
```bash
POST /api/v1/chats/{chat_id}/messages
```
**Purpose**: Send message to existing conversation
**Body Parameters:**
- `text` (string, required): Message content
- `attachments` (file): File attachments (max 15MB)

**Response:**
```typescript
interface MessageSentResponse {
  object: "MessageSent";
  message_id: string;
}
```

##### List All Messages (Global)
```bash
GET /api/v1/messages
```
**Purpose**: Get messages across all chats and platforms
**Query Parameters:**
- `since` (datetime): Messages after specific time
- `limit` (integer): Number of messages
- `account_id` (string): Filter by account

##### Retrieve Specific Message
```bash
GET /api/v1/messages/{message_id}
```
**Purpose**: Get detailed message information

##### Forward Message
```bash
POST /api/v1/messages/{message_id}/forward
```
**Purpose**: Forward message to other chats
**Body Parameters:**
- `chat_ids` (array): Target chat IDs

##### Get Message Attachment
```bash
GET /api/v1/messages/{message_id}/attachment
```
**Purpose**: Download message attachments

#### Attendee/Participant Management APIs

##### List Chat Attendees
```bash
GET /api/v1/chats/{chat_id}/attendees
```
**Purpose**: Get participants in specific conversation

##### List All Attendees (Global)
```bash
GET /api/v1/attendees
```
**Purpose**: Get all contacts across platforms

##### Retrieve Attendee Details
```bash
GET /api/v1/attendees/{attendee_id}
```
**Purpose**: Get detailed contact information

##### Download Attendee Picture
```bash
GET /api/v1/attendees/{attendee_id}/picture
```
**Purpose**: Get contact profile picture

##### List Attendee Chats
```bash
GET /api/v1/attendees/{attendee_id}/chats
```
**Purpose**: Get all 1-to-1 conversations with specific contact

##### List Attendee Messages
```bash
GET /api/v1/attendees/{attendee_id}/messages
```
**Purpose**: Get all messages from/to specific contact

#### Message Object Schema
```typescript
interface UnipileMessage {
  // Core Identifiers
  id: string;                    // Unipile message ID
  chat_id: string;              // Unipile chat ID
  provider_id: string;          // Platform-specific message ID
  chat_provider_id: string;     // Platform-specific chat ID
  account_id: string;           // Sender account ID
  
  // Content & Metadata
  text: string;                 // Message text (plain text)
  attachments: Attachment[];    // File attachments
  timestamp: string;            // Server acknowledge time
  
  // Sender Information
  sender_id: string;            // Platform-specific sender ID
  is_sender: boolean;           // True if sent by connected account
  
  // Message State
  seen: boolean;                // Read receipt status
  seen_by: Record<string, boolean | string>; // Per-user read receipts
  delivered: boolean;           // Delivery confirmation
  hidden: boolean;              // Should be hidden in UI
  deleted: boolean;             // Message deleted
  edited: boolean;              // Message edited
  
  // Events & Interactions
  is_event: boolean;            // System event vs user message
  event_type: number;           // Event type (1-9)
  reactions: Reaction[];        // Message reactions
  quoted: QuotedMessage;        // Replied/quoted message
}

interface Attachment {
  id: string;
  type: 'img' | 'video' | 'audio' | 'document';
  url: string;
  size: {
    width?: number;
    height?: number;
    bytes?: number;
  };
  unavailable: boolean;
  sticker: boolean;
  mimetype: string;
}

interface Reaction {
  value: string;        // Emoji (👍, ❤️, etc.)
  sender_id: string;    // Who reacted
  is_sender: boolean;   // Reaction from connected account
}
```

### Company Actions ✅ FULLY AVAILABLE
- `GET /api/v1/companies/{company_id}` - Company profile retrieval
- `POST /api/v1/linkedin/search` - Company search functionality
- `GET /api/v1/users/{user_id}/company` - User's company information

### Webhooks & Monitoring ✅ FULLY AVAILABLE
- `POST /api/v1/webhooks` - Create webhook for real-time events
- **Webhook Events**: `new_relation`, `new_message`, `message_reaction`, `message_read`, `message_edited`, `message_deleted`
- **Webhook Delay**: Up to 8 hours for `new_relation` events (LinkedIn polling limitation)
- **Real-time Events**: `new_message` and reactions are near real-time

---

## 🎯 API Coverage Summary

### ✅ FULLY IMPLEMENTED APIs (19 endpoints)

#### Core Campaign Operations
1. **Send Invitation API** - `POST /api/v1/users/invite` ✅
2. **List Invitations API** - `GET /api/v1/users/invitations` ✅  
3. **Invitation Details API** - `GET /api/v1/users/invitations/{id}` ✅
4. **Handle Invitations API** - `POST /api/v1/users/invitations/{id}` ✅

#### Profile & Search Operations
5. **Profile Retrieval API** - `GET /api/v1/users/{user_id}` ✅
6. **Company Profiles API** - `GET /api/v1/companies/{company_id}` ✅
7. **LinkedIn Search API** - `POST /api/v1/linkedin/search` ✅ (Enterprise plans)
8. **InMail Credits API** - `GET /api/v1/users/credits` ✅

#### Messaging Operations  
9. **Send Message API** - `POST /api/v1/chats/{chat_id}/messages` ✅
10. **List Messages API** - `GET /api/v1/chats/{chat_id}/messages` ✅
11. **Chat Management API** - `GET /api/v1/chats` ✅
12. **Message Attachments API** - `POST /api/v1/chats/{chat_id}/attachments` ✅

#### Account & Authentication
13. **List Accounts API** - `GET /api/v1/accounts` ✅
14. **Account Details API** - `GET /api/v1/accounts/{account_id}` ✅
15. **Connect LinkedIn API** - `POST /api/v1/accounts/linkedin` ✅
16. **Account Management APIs** - `PATCH/DELETE /api/v1/accounts/{account_id}` ✅

#### Webhook & Real-time Events
17. **Webhook Setup API** - `POST /api/v1/webhooks` ✅
18. **Event Processing** - 6 webhook event types ✅
19. **Real-time Monitoring** - Live campaign tracking ✅

### 📊 Campaign Readiness Status

#### **READY FOR PRODUCTION** ✅
- **Connector Campaigns**: Send invitations with rate limiting
- **Messenger Campaigns**: Direct messaging to connections  
- **Follow-up Sequences**: Automated multi-step campaigns
- **Webhook Tracking**: Real-time invitation acceptance
- **Analytics & Monitoring**: Complete performance tracking

#### **ENTERPRISE FEATURES** 💼
- **LinkedIn Search**: Requires Enterprise Unipile plan
- **Advanced Targeting**: Sales Navigator integration
- **InMail Campaigns**: Premium account dependent
- **Bulk Operations**: High-volume campaign management

#### **INTEGRATION COMPLETE** 🚀
- **Database Schema**: Campaigns, prospects, actions, messages
- **API Implementation**: Full CRUD operations
- **Rate Limiting**: LinkedIn compliance built-in
- **Error Handling**: Robust retry logic and monitoring
- **Security**: Webhook signature verification ready

## Message Personalization

### Available Placeholders
- `{first_name}` - Contact's first name
- `{last_name}` - Contact's last name  
- `{job_title}` - Current job title
- `{company_name}` - Current company name
- `{industry}` - Industry information
- `{location}` - Geographic location
- `{mutual_connections}` - Shared connections count

### Character Limits
- **Connection Request Message**: 275 characters maximum
- **Alternative Message**: 115 characters maximum
- **Regular Messages**: No strict limit
- **InMail**: Typically 2,000 characters

## Implementation Priority

### Phase 1: Connector Campaign (IMMEDIATE)
1. Connection request message template builder
2. Follow-up sequence designer
3. Personalization placeholder system
4. CSV prospect upload integration

### Phase 2: Messenger Campaign
1. Direct message template builder
2. Existing connection targeting
3. Message sequence automation

### Phase 3: InMail Campaign
1. Premium account detection
2. InMail template builder
3. Non-connection targeting

### Phase 4: Company & Group
1. Company follow campaigns
2. Group member campaigns (limited)

## Technical Requirements

### Account Requirements
- **Basic LinkedIn**: Connection requests, basic messaging
- **Premium**: Enhanced search, InMail credits
- **Sales Navigator**: Advanced search, unlimited InMail
- **Recruiter**: Candidate search, advanced filtering

### Integration Architecture
- Unipile API integration for all LinkedIn actions
- Webhook system for real-time event processing
- Rate limiting and queue management
- Error handling and retry logic
- Campaign analytics and reporting

## Campaign Workflow

### Connector Campaign Flow
1. **Setup**: Define target criteria and search parameters
2. **Search**: Use Unipile search API to find prospects
3. **Upload**: CSV upload or search result import
4. **Templates**: Create connection request and follow-up messages
5. **Schedule**: Distribute sending across time to respect limits
6. **Execute**: Send connection requests with personalized messages
7. **Monitor**: Track acceptances via webhooks
8. **Follow-up**: Send follow-up messages to accepted connections
9. **Analytics**: Track conversion rates and campaign performance

## Detecting Accepted Invitations

### Three Detection Methods Available

#### 1. Webhook: "New Relation" (Primary Method)
- **Event Type**: `new_relation` in USERS webhook
- **Delay**: Up to 8 hours (not real-time due to LinkedIn polling)
- **Reliability**: Most comprehensive method

**Webhook Creation:**
```bash
curl --request POST \
  --url https://api6.unipile.com:13670/api/v1/webhooks \
  --header 'Content-Type: application/json' \
  --header 'X-API-KEY: YOUR_API_KEY' \
  --data '{
    "source": "users",
    "request_url": "https://yourendpoint.com/webhook",
    "name": "New relation",
    "headers": [
      {
        "key": "Content-Type",
        "value": "application/json"
      }
    ]
  }'
```

**Webhook Payload:**
```json
{
  "event": "new_relation",
  "account_id": "SDF4tGaPSPSzNe1D1xsOs",
  "account_type": "LINKEDIN",
  "webhook_name": "",
  "user_full_name": "Julien Crépieux",
  "user_provider_id": "ACoAAAh_Ffqss54sqAGQOD8u7sl5of04y9_3AwyM",
  "user_public_identifier": "julien-crepieux",
  "user_profile_url": "https://www.linkedin.com/in/julien-crepieux/",
  "user_picture_url": "https://media.licdn.com/dms/image/..."
}
```

#### 2. Real-Time Method (For Invitations with Messages)
- **Trigger**: New chat creation with invitation message
- **Webhook Event**: `new_message` 
- **Detection**: Message sender is you AND first message in chat
- **Limitation**: Only works for invitations that include personalized messages

#### 3. Periodic Check Method (Fallback/Alternative)
- **Relations List**: Check recently added connections
- **Sent Invitations**: Monitor pending invitation list changes
- **Profile Verification**: Use retrieve profile route to confirm relationship
- **Frequency**: Few times per day with random delays
- **Caution**: High API usage if many pending invitations

### Implementation Strategy
1. **Primary**: Use `new_relation` webhook for comprehensive tracking
2. **Secondary**: Use `new_message` webhook for immediate detection (message-based invitations)
3. **Backup**: Periodic checks for edge cases and validation

## Node.js SDK Integration

### Installation & Setup
```bash
npm install unipile-node-sdk
```

### Basic Implementation
```typescript
import { UnipileClient } from 'unipile-node-sdk';

const client = new UnipileClient(
  'https://api6.unipile.com:13670', 
  process.env.UNIPILE_API_KEY
);

// Connect LinkedIn account
await client.account.connectLinkedin({
  username: 'your-linkedin-username',
  password: 'your-linkedin-password',
});

// Get all chats and messages
const chats = await client.messaging.getAllChats();
const messages = await client.messaging.getAllMessages();
const attendees = await client.messaging.getAllAttendees();
```

### Multi-Platform Support
```typescript
// Instagram connection
await client.account.connectInstagram({
  username: 'instagram-username',
  password: 'instagram-password',
});

// WhatsApp QR code connection
const { qrCodeString: whatsappQrCode } = await client.account.connectWhatsapp();
console.log(whatsappQrCode); // Display QR code for scanning

// Telegram QR code connection  
const { qrCodeString: telegramQrCode } = await client.account.connectTelegram();
console.log(telegramQrCode); // Display QR code for scanning

// Messenger connection
await client.account.connectMessenger({
  username: 'messenger-username',
  password: 'messenger-password',
});
```

## N8N Integration Architecture

### Webhook Configuration for Real-Time Events

#### Step 1: N8N Webhook Setup
1. Create new workflow in N8N dashboard
2. Add Webhook node as first step
3. Use **Test URL** initially for configuration
4. Configure webhook to receive Unipile events

#### Step 2: Unipile Webhook Registration
1. Register webhook in Unipile dashboard
2. Use N8N Test URL for initial setup
3. Test with actual message/invitation events
4. Switch to Production URL when workflow is complete

#### Step 3: Event Processing Workflow
```yaml
N8N Workflow Structure:
1. Webhook Node (receives Unipile events)
2. Switch Node (route by event type)
   - new_relation → Follow-up sequence trigger
   - new_message → Response processing
   - message_read → Analytics update
3. HTTP Request Node (API calls to SAM AI)
4. Database Node (update campaign status)
5. Email/Notification Node (alert campaign manager)
```

### N8N HTTP Request Examples

#### Retrieve LinkedIn Post
```yaml
Method: GET
URL: https://api6.unipile.com:13670/api/v1/posts/{post_id}
Headers:
  X-API-KEY: YOUR_API_KEY
  accept: application/json
```

#### Create LinkedIn Post with Attachment
```yaml
Method: POST
URL: https://api6.unipile.com:13670/api/v1/posts
Headers:
  X-API-KEY: YOUR_API_KEY
  Content-Type: application/json
Body:
  account_id: "your_account_id"
  text: "Your post content"
  attachments: [file_data_from_previous_node]
```

#### Retrieve User Profile
```yaml
Method: GET
URL: https://api6.unipile.com:13670/api/v1/users/{user_id}/profile
Headers:
  X-API-KEY: YOUR_API_KEY
  accept: application/json
```

#### Comment on Post
```yaml
Method: POST
URL: https://api6.unipile.com:13670/api/v1/posts/{post_id}/comments
Headers:
  X-API-KEY: YOUR_API_KEY
  Content-Type: application/json
Body:
  account_id: "your_account_id"
  text: "Your comment"
```

#### Start New Chat
```yaml
Method: POST
URL: https://api6.unipile.com:13670/api/v1/chats
Headers:
  X-API-KEY: YOUR_API_KEY
  Content-Type: application/json
Body:
  account_id: "your_account_id"
  attendees: ["user_provider_id"]
  text: "Your message"
```

### Advanced N8N Workflow Examples

#### 1. LinkedIn Post Comment Automation
```yaml
Workflow: Comment on LinkedIn Post
1. HTTP Request Node → Retrieve post details
2. HTTP Request Node → Post comment
3. Database Node → Log interaction
```

#### 2. WhatsApp AI Response System
```yaml
Workflow: AI-Powered WhatsApp Responses
1. Webhook Node → Receive WhatsApp message
2. AI Node (OpenAI/Claude) → Generate response
3. HTTP Request Node → Send reply via Unipile
4. Database Node → Store conversation
```

### Use Cases for N8N + Unipile
- **LinkedIn → WhatsApp**: Forward LinkedIn messages to WhatsApp
- **AI Response Generation**: Analyze messages with AI, generate responses
- **CRM Integration**: Save LinkedIn conversations to Google Sheets/CRM
- **Multi-Channel Campaigns**: Coordinate campaigns across platforms
- **Automated Follow-ups**: Trigger sequences based on invitation acceptance
- **Content Engagement**: Auto-comment and react to prospect posts
- **Lead Scoring**: Track engagement across multiple platforms

### Updated Campaign Workflow

#### Enhanced Connector Campaign Flow
1. **Setup**: Define target criteria and search parameters
2. **Search**: Use Unipile search API to find prospects
3. **Upload**: CSV upload or search result import
4. **Templates**: Create connection request and follow-up messages
5. **Schedule**: Distribute sending across time to respect limits
6. **Execute**: Send connection requests with personalized messages
7. **Monitor**: Track acceptances via webhooks (up to 8-hour delay)
8. **Follow-up**: Trigger automated follow-up sequences via N8N webhook
9. **AI Response**: Use SAM AI for contextual message responses
10. **Analytics**: Track conversion rates and campaign performance

#### Real-Time Response Handling
1. **Webhook Reception**: Receive `new_message` events in real-time
2. **SAM AI Analysis**: Process incoming messages for intent/sentiment
3. **Response Generation**: Create contextual responses via SAM AI
4. **Human Approval**: HITL approval system for response quality
5. **Automated Sending**: Send approved responses via Unipile API

## Message Object Schema

### Core Message Fields

```typescript
interface UnipileMessage {
  // Identifiers
  id: string;                    // Unique Unipile message ID
  chat_id: string;              // Unique Unipile chat ID
  provider_id: string;          // Provider-specific message ID
  chat_provider_id: string;     // Provider-specific chat ID
  account_id: string;           // Connected account ID
  
  // Content
  text: string;                 // Plain text message body
  attachments: Attachment[];    // List of file attachments
  
  // Sender Information
  sender_id: string;            // Provider-specific sender ID
  is_sender: boolean;           // True if sent by connected account
  
  // Timestamps & Status
  timestamp: string;            // Provider server acknowledgment time
  seen: boolean;                // Read receipt status
  seen_by: Record<string, boolean | string>; // Per-user read receipts
  delivered: boolean;           // Delivery confirmation
  
  // Message State
  hidden: boolean;              // Should be hidden in conversation view
  deleted: boolean;             // Message has been deleted
  edited: boolean;              // Message has been edited
  
  // Events & Reactions
  is_event: boolean;            // System event vs user message
  event_type: number;           // Event type (1-9, see below)
  reactions: Reaction[];        // Message reactions
  quoted: QuotedMessage;        // Quoted/replied message details
}
```

### Event Types
- **1**: User reacted to a message
- **2**: User reacted to owner message  
- **3**: Group was created
- **4**: Group title changed
- **5**: Participant added to group
- **6**: Participant removed from group
- **7**: Participant left group
- **8**: Missed voice call
- **9**: Missed audio call
- **0**: Unsupported event type

### Attachment Schema
```typescript
interface Attachment {
  id: string;
  type: 'img' | 'video' | 'audio' | 'document';
  url: string;
  size: {
    width?: number;
    height?: number;
    bytes?: number;
  };
  unavailable: boolean;
  sticker: boolean;
}
```

### Reaction Schema
```typescript
interface Reaction {
  value: string;        // Emoji reaction (👍, ❤️, etc.)
  sender_id: string;    // Provider user ID who reacted
  is_sender: boolean;   // True if reaction from connected account
}
```

## Messaging API Operations

### Send Message in Existing Chat
```bash
# Send to existing chat by chat_id
curl --request POST \
  --url https://api6.unipile.com:13670/api/v1/chats/{chat_id}/messages \
  --header 'X-API-KEY: YOUR_API_KEY' \
  --header 'accept: application/json' \
  --header 'content-type: multipart/form-data' \
  --form 'text=Hello world!'
```

### Start New Chat / Send to User
```bash
# Create new chat or send to existing relationship
curl --request POST \
  --url https://api6.unipile.com:13670/api/v1/chats \
  --header 'X-API-KEY: YOUR_API_KEY' \
  --header 'accept: application/json' \
  --header 'content-type: multipart/form-data' \
  --form account_id=YOUR_ACCOUNT_ID \
  --form 'text=Hello world!' \
  --form attendees_ids=LINKEDIN_USER_ID
```

### LinkedIn InMail Messaging
```bash
# Send InMail (requires Premium/Sales Navigator)
curl --request POST \
  --url https://api6.unipile.com:13670/api/v1/chats \
  --header 'X-API-KEY: YOUR_API_KEY' \
  --header 'accept: application/json' \
  --header 'content-type: multipart/form-data' \
  --form account_id=YOUR_ACCOUNT_ID \
  --form 'text=Hello world!' \
  --form attendees_ids=LINKEDIN_USER_ID \
  --form linkedin[api]=classic \
  --form linkedin[inmail]=true
```

### Send Message with Attachments
```bash
# Send message with file attachment (15MB max)
curl --request POST \
  --url https://api6.unipile.com:13670/api/v1/chats \
  --header 'X-API-KEY: YOUR_API_KEY' \
  --header 'accept: application/json' \
  --header 'content-type: multipart/form-data' \
  --form account_id=YOUR_ACCOUNT_ID \
  --form 'text=Hello world!' \
  --form attendees_ids=LINKEDIN_USER_ID \
  --form 'attachments=@/path/to/file.pdf'
```

### Create Group Chat
```bash
# Create WhatsApp group chat
curl --request POST \
  --url https://api6.unipile.com:13670/api/v1/chats \
  --header 'X-API-KEY: YOUR_API_KEY' \
  --header 'accept: application/json' \
  --header 'content-type: multipart/form-data' \
  --form account_id=YOUR_ACCOUNT_ID \
  --form 'text=Welcome to the group!' \
  --form attendees_ids=33600000000@s.whatsapp.net \
  --form attendees_ids=33600000001@s.whatsapp.net \
  --form title=ProjectGroup
```

## Campaign Implementation Strategy

### Message Processing for SAM AI
```typescript
// Process incoming messages for AI analysis
const processIncomingMessage = (message: UnipileMessage) => {
  // Skip system events and reactions
  if (message.is_event || message.hidden) return;
  
  // Only process messages from prospects (not sent by us)
  if (message.is_sender) return;
  
  // Extract context for SAM AI
  const context = {
    sender_id: message.sender_id,
    chat_id: message.chat_id,
    message_text: message.text,
    quoted_message: message.quoted?.text,
    attachments: message.attachments.map(a => ({
      type: a.type,
      url: a.url
    })),
    timestamp: message.timestamp
  };
  
  // Send to SAM AI for response generation
  generateSAMResponse(context);
};
```

### Follow-up Message Automation
```typescript
// Trigger follow-up sequences on invitation acceptance
const handleNewRelation = (webhook: NewRelationWebhook) => {
  const { user_provider_id, account_id } = webhook;
  
  // Find corresponding campaign prospect
  const prospect = findProspectByLinkedInId(user_provider_id);
  
  if (prospect?.campaign?.follow_up_sequence) {
    // Schedule follow-up message
    scheduleFollowUpMessage({
      account_id,
      attendees_ids: [user_provider_id],
      text: personalizeMessage(
        prospect.campaign.follow_up_sequence.messages[0],
        prospect
      ),
      delay: prospect.campaign.follow_up_sequence.delay
    });
  }
};
```

### Message Personalization System
```typescript
// Personalize messages with prospect data
const personalizeMessage = (template: string, prospect: Prospect): string => {
  return template
    .replace(/{first_name}/g, prospect.first_name)
    .replace(/{last_name}/g, prospect.last_name)
    .replace(/{company_name}/g, prospect.company_name)
    .replace(/{job_title}/g, prospect.job_title)
    .replace(/{industry}/g, prospect.industry)
    .replace(/{location}/g, prospect.location)
    .replace(/{mutual_connections}/g, prospect.mutual_connections?.toString() || '');
};
```

## Real-Time Response Handling

### SAM AI Integration Workflow
1. **Message Reception**: Receive `new_message` webhook from Unipile
2. **Context Analysis**: Extract conversation context and sender information
3. **Intent Detection**: Analyze message for intent (question, objection, interest)
4. **Response Generation**: Generate contextual response via SAM AI
5. **Human Approval**: Send draft to user for approval via HITL system
6. **Message Sending**: Send approved response via Unipile API
7. **Analytics Tracking**: Log interaction for campaign performance

### Implementation Architecture
```typescript
// Complete message handling pipeline
const messageHandlerPipeline = async (webhook: MessageWebhook) => {
  // 1. Validate and parse message
  const message = validateMessage(webhook);
  if (!message || message.is_sender) return;
  
  // 2. Get conversation context
  const context = await getConversationContext(message.chat_id);
  
  // 3. Generate SAM AI response
  const response = await generateSAMResponse(message.text, context);
  
  // 4. Submit for human approval
  const approvalId = await submitForApproval({
    chat_id: message.chat_id,
    original_message: message.text,
    proposed_response: response,
    sender_info: await getUserProfile(message.sender_id)
  });
  
  // 5. Wait for approval (webhook or polling)
  const approval = await waitForApproval(approvalId);
  
  // 6. Send approved response
  if (approval.status === 'approved') {
    await sendMessage({
      chat_id: message.chat_id,
      text: approval.final_message,
      account_id: message.account_id
    });
  }
  
  // 7. Log interaction
  await logCampaignInteraction({
    chat_id: message.chat_id,
    message_type: 'response',
    status: approval.status,
    response_time: Date.now() - message.timestamp
  });
};
```

## Message Retrieval API

### Get Chat Message History
```bash
# Retrieve messages from specific chat (100 messages by default)
curl --request GET \
  --url https://api6.unipile.com:13670/api/v1/chats/{CHAT_ID}/messages \
  --header 'X-API-KEY: YOUR_API_KEY' \
  --header 'accept: application/json'
```

**Response Features:**
- Messages ordered by date (most recent first)
- Default limit: 100 messages per request
- Pagination support for larger conversations
- Includes full message objects with all metadata

### Real-Time Message Updates

#### Webhook Payload for New Messages
```typescript
interface MessageWebhook {
  // Account Information
  account_id: string;
  account_type: 'LINKEDIN' | 'INSTAGRAM' | 'WHATSAPP' | 'TELEGRAM' | 'MESSENGER';
  account_info: {
    type: 'LINKEDIN' | 'INSTAGRAM';
    feature: 'organization' | 'sales_navigator' | 'recruiter' | 'classic';
    user_id: string;
  };
  
  // Event Details
  event: 'message_received' | 'message_reaction' | 'message_read' | 'message_edited' | 'message_deleted';
  chat_id: string;
  message_id: string;
  timestamp: string;
  webhook_name: string;
  
  // Message Content
  message: string;
  attachments?: {
    id: string;
    size: { height: string; width: string };
    sticker: boolean;
    unavailable: boolean;
    mimetype: string;
    type: 'img' | 'video' | 'audio' | 'document';
    url: string;
  };
  
  // Sender Information
  sender: {
    attendee_id: string;
    attendee_name: string;
    attendee_provider_id: string;
    attendee_profile_url: string;
  };
  
  // Chat Participants
  attendees: Array<{
    attendee_id: string;
    attendee_name: string;
    attendee_provider_id: string;
    attendee_profile_url: string;
  }>;
  
  // Reaction Events (only for message_reaction event)
  reaction?: string;
  reaction_sender?: {
    attendee_id: string;
    attendee_name: string;
    attendee_provider_id: string;
    attendee_profile_url: string;
  };
}
```

### Webhook Event Types
- **`message_received`**: New message received or sent
- **`message_reaction`**: Reaction added to message
- **`message_read`**: Message read receipt
- **`message_edited`**: Message content modified
- **`message_deleted`**: Message removed

### Alternative: Polling with Cron Jobs
```typescript
// Poll for new messages every 5 minutes
const pollForNewMessages = async () => {
  const since = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
  
  try {
    const response = await fetch(`https://api6.unipile.com:13670/api/v1/messages?since=${since.toISOString()}`, {
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY,
        'accept': 'application/json'
      }
    });
    
    const messages = await response.json();
    
    // Process new messages with duplicate prevention
    for (const message of messages) {
      if (!await messageExists(message.id)) {
        await processNewMessage(message);
        await storeMessage(message);
      }
    }
  } catch (error) {
    console.error('Failed to poll messages:', error);
  }
};

// Run every 5 minutes
setInterval(pollForNewMessages, 5 * 60 * 1000);
```

## Complete Campaign Automation System

### End-to-End Implementation Architecture
```typescript
// Complete campaign system with all components
class UnipileCampaignSystem {
  private unipileClient: UnipileClient;
  private samAI: SAMAIClient;
  private database: DatabaseClient;
  private hitlApproval: HITLApprovalSystem;
  
  constructor() {
    this.unipileClient = new UnipileClient(
      process.env.UNIPILE_DSN,
      process.env.UNIPILE_API_KEY
    );
  }
  
  // 1. Campaign Execution
  async executeCampaign(campaign: Campaign) {
    for (const prospect of campaign.prospects) {
      try {
        // Send connection request with personalization
        const message = this.personalizeMessage(
          campaign.templates.connection_request,
          prospect
        );
        
        await this.unipileClient.sendConnectionRequest({
          account_id: campaign.linkedin_account_id,
          attendees_ids: [prospect.linkedin_user_id],
          text: message
        });
        
        // Log campaign action
        await this.database.logCampaignAction({
          campaign_id: campaign.id,
          prospect_id: prospect.id,
          action: 'connection_request_sent',
          message,
          timestamp: new Date()
        });
        
        // Respect rate limits
        await this.delay(this.getRandomDelay());
        
      } catch (error) {
        await this.handleCampaignError(campaign, prospect, error);
      }
    }
  }
  
  // 2. Webhook Message Handler
  async handleIncomingMessage(webhook: MessageWebhook) {
    // Skip if message sent by us
    if (webhook.sender.attendee_provider_id === webhook.account_info.user_id) {
      return;
    }
    
    // Get conversation context
    const context = await this.getConversationContext(webhook.chat_id);
    
    // Generate SAM AI response
    const response = await this.samAI.generateResponse({
      message: webhook.message,
      context,
      sender_profile: webhook.sender
    });
    
    // Submit for human approval
    const approval = await this.hitlApproval.submitForApproval({
      chat_id: webhook.chat_id,
      original_message: webhook.message,
      proposed_response: response,
      deadline: Date.now() + (2 * 60 * 60 * 1000) // 2 hours
    });
    
    // Wait for approval and send
    approval.onApproved(async (finalMessage) => {
      await this.unipileClient.sendMessage({
        chat_id: webhook.chat_id,
        text: finalMessage,
        account_id: webhook.account_id
      });
    });
  }
  
  // 3. Invitation Acceptance Handler
  async handleNewRelation(webhook: NewRelationWebhook) {
    // Find related campaign
    const prospect = await this.database.findProspectByLinkedInId(
      webhook.user_provider_id
    );
    
    if (!prospect?.campaign) return;
    
    // Schedule follow-up sequence
    const followUpMessages = prospect.campaign.follow_up_sequence;
    
    for (let i = 0; i < followUpMessages.length; i++) {
      const delay = followUpMessages[i].delay_days * 24 * 60 * 60 * 1000;
      
      setTimeout(async () => {
        const message = this.personalizeMessage(
          followUpMessages[i].template,
          prospect
        );
        
        await this.unipileClient.sendMessage({
          account_id: webhook.account_id,
          attendees_ids: [webhook.user_provider_id],
          text: message
        });
        
        await this.database.logCampaignAction({
          campaign_id: prospect.campaign.id,
          prospect_id: prospect.id,
          action: `follow_up_${i + 1}_sent`,
          message,
          timestamp: new Date()
        });
      }, delay);
    }
  }
  
  // 4. Campaign Analytics
  async getCampaignAnalytics(campaignId: string) {
    const analytics = await this.database.getCampaignStats(campaignId);
    
    return {
      // Connection Metrics
      connection_requests_sent: analytics.connection_requests_sent,
      connections_accepted: analytics.connections_accepted,
      acceptance_rate: analytics.connections_accepted / analytics.connection_requests_sent,
      
      // Message Metrics
      messages_sent: analytics.messages_sent,
      messages_received: analytics.messages_received,
      response_rate: analytics.messages_received / analytics.messages_sent,
      
      // Engagement Metrics
      positive_responses: analytics.positive_responses,
      meeting_requests: analytics.meeting_requests,
      conversion_rate: analytics.meeting_requests / analytics.connections_accepted,
      
      // Timing Analytics
      avg_response_time: analytics.avg_response_time,
      best_sending_times: analytics.best_sending_times
    };
  }
  
  // Helper Methods
  private personalizeMessage(template: string, prospect: Prospect): string {
    return template
      .replace(/{first_name}/g, prospect.first_name)
      .replace(/{last_name}/g, prospect.last_name)
      .replace(/{company_name}/g, prospect.company_name)
      .replace(/{job_title}/g, prospect.job_title)
      .replace(/{industry}/g, prospect.industry)
      .replace(/{location}/g, prospect.location);
  }
  
  private getRandomDelay(): number {
    // Random delay between 5-15 minutes
    return (5 + Math.random() * 10) * 60 * 1000;
  }
}
```

---

## 🔗 Webhook System APIs

### Event Types
**Available webhook events:**
- `new_relation` - New LinkedIn connection acceptance
- `new_message` - Incoming LinkedIn message
- `message_reaction` - Message reactions/likes
- `message_read` - Message read receipts
- `message_edited` - Message edits
- `message_deleted` - Message deletions

### Webhook Configuration
```typescript
// Webhook endpoint setup
POST /api/v1/webhooks
{
  "source": "users",
  "request_url": "https://your-app.com/api/webhooks/unipile",
  "name": "New relation",
  "headers": [
    {
      "key": "Content-Type",
      "value": "application/json"
    }
  ]
}
```

### Webhook Payload Structure
```typescript
interface UnipileWebhook {
  event: 'new_relation' | 'new_message' | 'message_reaction' | 'message_read' | 'message_edited' | 'message_deleted';
  account_id: string;
  account_type: 'LINKEDIN' | 'WHATSAPP' | 'INSTAGRAM' | 'MESSENGER' | 'TELEGRAM' | 'TWITTER';
  account_info: {
    type: string;
    feature: 'classic' | 'sales_navigator' | 'recruiter' | 'organization';
    user_id: string;
  };
  timestamp: string;
  webhook_name: string;
  user_full_name: string;
  user_provider_id: string;
  user_public_identifier: string;
  user_profile_url: string;
  user_picture_url?: string;
}
```

---

## 🔐 Authentication & Account APIs

### Account Connection Flow
```typescript
// Account authentication and management
POST /api/v1/accounts/linkedin
{
  "username": "linkedin-email@example.com",
  "password": "linkedin-password"
}

Response:
{
  "account_id": "linkedin-account-123",
  "status": "connected",
  "features": ["classic", "premium", "sales_navigator"]
}
```

### Account Management
```typescript
// List all connected accounts
GET /api/v1/accounts

// Get specific account details
GET /api/v1/accounts/{account_id}

// Disconnect account
DELETE /api/v1/accounts/{account_id}

// Update account settings
PATCH /api/v1/accounts/{account_id}
{
  "name": "Updated Account Name",
  "webhook_url": "https://new-webhook.com/endpoint"
}
```

---

## 📋 Complete API Reference Summary

### Core Campaign APIs ⚡
1. **Send Invitation** - `POST /api/v1/users/invite` - Send LinkedIn connection requests
2. **List Invitations** - `GET /api/v1/users/invitations` - Track invitation status  
3. **Invitation Details** - `GET /api/v1/users/invitations/{id}` - Get specific invitation
4. **Handle Invitations** - `POST /api/v1/users/invitations/{id}` - Accept/decline invitations

### Profile & Search APIs 🔍
5. **Profile Retrieval** - `GET /api/v1/users/{user_id}` - Get user profiles
6. **Company Profiles** - `GET /api/v1/companies/{company_id}` - Get company data
7. **LinkedIn Search** - `POST /api/v1/users/search` - Search for prospects (Enterprise only)
8. **InMail Credits** - `GET /api/v1/users/credits` - Check InMail balance

### Messaging APIs 💬
9. **Send Message** - `POST /api/v1/chats/{chat_id}/messages` - Send messages
10. **List Messages** - `GET /api/v1/chats/{chat_id}/messages` - Get conversation history
11. **Chat Management** - `GET /api/v1/chats` - Manage conversations
12. **Message Attachments** - `POST /api/v1/chats/{chat_id}/attachments` - File uploads (15MB max)

### Account & Auth APIs 🔐
13. **List Accounts** - `GET /api/v1/accounts` - Get connected accounts
14. **Account Details** - `GET /api/v1/accounts/{account_id}` - Account information
15. **Connect LinkedIn** - `POST /api/v1/accounts/linkedin` - Authentication
16. **Account Management** - `PATCH/DELETE /api/v1/accounts/{account_id}` - Update/remove

### Webhook APIs 🔔
17. **Webhook Setup** - `POST /api/v1/webhooks` - Configure webhooks
18. **Event Types** - Multiple events (new_relation, new_message, etc.)
19. **Real-time Updates** - Live campaign event tracking (up to 8-hour delay)

---

## 💡 Implementation Examples

### Complete Campaign Setup
```typescript
// 1. Send invitation with personalized message
const invitation = await fetch('https://api6.unipile.com:13670/api/v1/users/invite', {
  method: 'POST',
  headers: {
    'X-API-KEY': process.env.UNIPILE_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    provider_id: 'linkedin-user-456',
    account_id: 'linkedin-account-123',
    user_email: 'prospect@company.com',
    message: 'Hi John, I noticed we both work in fintech...'
  })
});

// 2. Track invitation status
const status = await fetch(`https://api6.unipile.com:13670/api/v1/users/invitations/${invitationId}`, {
  headers: { 'X-API-KEY': process.env.UNIPILE_API_KEY }
});

// 3. Handle webhook for acceptance
app.post('/webhook/unipile', (req, res) => {
  if (req.body.event === 'new_relation') {
    // Update database: prospect status = 'connected'
    updateProspectStatus(req.body.user_provider_id, 'connected');
    
    // Schedule follow-up sequence
    scheduleFollowUp(req.body.user_provider_id);
  }
});

// 4. Send follow-up message after connection
const followUpMessage = await fetch(`https://api6.unipile.com:13670/api/v1/chats/${chatId}/messages`, {
  method: 'POST',
  headers: {
    'X-API-KEY': process.env.UNIPILE_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    text: 'Thanks for connecting! Would you like to learn about...',
    account_id: 'linkedin-account-123'
  })
});
```

### Rate Limiting Best Practices
```typescript
const RATE_LIMITS = {
  invitations_per_day: 80,     // Paid accounts
  invitations_per_week: 200,   // Weekly maximum
  messages_per_hour: 100,      // Message limit
  min_delay_minutes: 5,        // Minimum delay
  max_delay_minutes: 15        // Maximum delay
};

async function sendWithRateLimit(apiCall: () => Promise<any>) {
  // Execute API call
  const result = await apiCall();
  
  // Random delay between sends
  const delayMinutes = Math.random() * 
    (RATE_LIMITS.max_delay_minutes - RATE_LIMITS.min_delay_minutes) + 
    RATE_LIMITS.min_delay_minutes;
  
  await new Promise(resolve => 
    setTimeout(resolve, delayMinutes * 60 * 1000)
  );
  
  return result;
}

// Track daily usage
let dailyInvitationCount = 0;

async function sendInvitationWithLimits(invitationData: any) {
  if (dailyInvitationCount >= RATE_LIMITS.invitations_per_day) {
    throw new Error('Daily invitation limit reached');
  }
  
  const result = await sendWithRateLimit(() => 
    sendLinkedInInvitation(invitationData)
  );
  
  dailyInvitationCount++;
  return result;
}
```

### Error Handling & Retry Logic
```typescript
async function robustApiCall(apiCall: () => Promise<any>, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error: any) {
      console.error(`API call failed (attempt ${attempt}):`, error.message);
      
      // Handle rate limiting
      if (error.status === 429) {
        const retryAfter = error.headers['retry-after'] || (attempt * 60);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      
      // Handle temporary errors
      if (error.status >= 500 && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, attempt * 5000));
        continue;
      }
      
      // Permanent errors or max retries reached
      throw error;
    }
  }
}
```

---

## 📊 Campaign Analytics & Monitoring

### Real-time Metrics via APIs
```typescript
// Track campaign performance
const campaignMetrics = {
  // From invitation API responses
  invitations_sent: await getInvitationCount(campaignId),
  usage_percentage: await getAccountUsage(accountId),
  
  // From webhook tracking
  connections_accepted: await getWebhookEvents('new_relation', campaignId),
  messages_received: await getWebhookEvents('new_message', campaignId),
  
  // Calculated metrics
  acceptance_rate: connections_accepted / invitations_sent,
  response_rate: messages_received / connections_accepted,
  
  // From messaging APIs
  conversations_active: await getActiveChatCount(accountId),
  follow_ups_sent: await getFollowUpCount(campaignId)
};
```

### Performance Optimization Strategies
```typescript
// A/B testing message templates
const templates = [
  "Hi {first_name}, I noticed we both work in {industry}...",
  "Hello {first_name}, I saw your recent post about {topic}...",
  "Hi {first_name}, fellow {job_title} here. Would love to connect..."
];

// Timing optimization based on webhook delays
const optimalSendingTimes = {
  weekdays: ['09:00', '13:00', '17:00'],
  avoid: ['22:00-06:00', 'weekends'],
  timezone: 'prospect_timezone' // Personalize by location
};

// Usage percentage monitoring
async function checkAccountLimits(accountId: string) {
  const account = await getAccountDetails(accountId);
  
  if (account.usage_percentage > 80) {
    console.warn('Account usage high:', account.usage_percentage);
    // Implement throttling or account switching
  }
  
  return account.usage_percentage;
}
```

---

## 🛠️ Step-by-Step Implementation Guides

### Guide 1: Setting Up Your First LinkedIn Campaign

#### Step 1: Account Authentication
```typescript
// 1. Connect LinkedIn account
const accountResponse = await fetch('https://api6.unipile.com:13670/api/v1/accounts/linkedin', {
  method: 'POST',
  headers: {
    'X-API-KEY': process.env.UNIPILE_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: 'your-linkedin-email@company.com',
    password: 'your-linkedin-password'
  })
});

const account = await accountResponse.json();
console.log('Account connected:', account.account_id);
```

#### Step 2: Webhook Setup
```typescript
// 2. Configure webhooks for real-time tracking
const webhookResponse = await fetch('https://api6.unipile.com:13670/api/v1/webhooks', {
  method: 'POST',
  headers: {
    'X-API-KEY': process.env.UNIPILE_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    source: 'users',
    request_url: 'https://your-app.com/api/campaigns/linkedin/webhook',
    name: 'LinkedIn Campaign Webhook',
    headers: [
      { key: 'Content-Type', value: 'application/json' }
    ]
  })
});
```

#### Step 3: Campaign Execution
```typescript
// 3. Send personalized invitations
async function sendCampaignInvitations(campaign: Campaign) {
  for (const prospect of campaign.prospects) {
    try {
      // Personalize message
      const message = personalizeMessage(campaign.template, prospect);
      
      // Send invitation
      const invitation = await fetch('https://api6.unipile.com:13670/api/v1/users/invite', {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.UNIPILE_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider_id: prospect.linkedin_user_id,
          account_id: campaign.linkedin_account_id,
          user_email: prospect.email,
          message: message
        })
      });
      
      // Track in database
      await database.updateProspectStatus(prospect.id, 'invitation_sent');
      
      // Rate limiting delay
      await delay(getRandomDelay());
      
    } catch (error) {
      console.error(`Failed to send invitation to ${prospect.name}:`, error);
    }
  }
}
```

### Guide 2: Real-time Event Processing

#### Webhook Handler Implementation
```typescript
// /app/api/campaigns/linkedin/webhook/route.ts
export async function POST(req: NextRequest) {
  const webhook: UnipileWebhook = await req.json();
  
  switch (webhook.event) {
    case 'new_relation':
      await handleConnectionAcceptance(webhook);
      break;
      
    case 'new_message':
      await handleIncomingMessage(webhook);
      break;
  }
  
  return NextResponse.json({ status: 'processed' });
}

async function handleConnectionAcceptance(webhook: NewRelationWebhook) {
  // 1. Find the campaign prospect
  const prospect = await findProspectByLinkedInId(webhook.user_provider_id);
  
  if (prospect) {
    // 2. Update status
    await updateProspectStatus(prospect.id, 'connected');
    
    // 3. Schedule follow-up sequence
    await scheduleFollowUpMessages(prospect, webhook.account_id);
    
    // 4. Update campaign analytics
    await incrementCampaignConnections(prospect.campaign_id);
  }
}
```

### Guide 3: Message Automation & Follow-ups

#### Follow-up Sequence Implementation
```typescript
async function scheduleFollowUpMessages(prospect: Prospect, accountId: string) {
  const followUpTemplates = prospect.campaign.follow_up_templates;
  
  for (let i = 0; i < followUpTemplates.length; i++) {
    const template = followUpTemplates[i];
    const delayHours = template.delay_hours || (24 * (i + 1));
    
    // Schedule message in database
    await database.scheduleMessage({
      prospect_id: prospect.id,
      campaign_id: prospect.campaign_id,
      template_index: i,
      message_template: template.message,
      scheduled_for: new Date(Date.now() + delayHours * 60 * 60 * 1000),
      account_id: accountId
    });
  }
}

// Cron job or queue processor for scheduled messages
async function processPendingMessages() {
  const pendingMessages = await database.getPendingScheduledMessages();
  
  for (const scheduledMessage of pendingMessages) {
    try {
      // Get chat ID for the prospect
      const chatId = await findOrCreateChat(
        scheduledMessage.prospect.linkedin_user_id,
        scheduledMessage.account_id
      );
      
      // Send follow-up message
      const response = await fetch(`https://api6.unipile.com:13670/api/v1/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.UNIPILE_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: personalizeMessage(scheduledMessage.message_template, scheduledMessage.prospect),
          account_id: scheduledMessage.account_id
        })
      });
      
      // Mark as sent
      await database.markMessageAsSent(scheduledMessage.id);
      
    } catch (error) {
      console.error('Failed to send scheduled message:', error);
      await database.markMessageAsFailed(scheduledMessage.id, error.message);
    }
  }
}
```

### Guide 4: Campaign Analytics & Performance Tracking

#### Analytics Dashboard Implementation
```typescript
async function getCampaignAnalytics(campaignId: string) {
  // 1. Get invitation metrics
  const invitations = await database.query(`
    SELECT 
      COUNT(*) as total_sent,
      COUNT(CASE WHEN status = 'invitation_sent' THEN 1 END) as pending,
      COUNT(CASE WHEN status = 'connected' THEN 1 END) as accepted,
      COUNT(CASE WHEN status = 'responded' THEN 1 END) as responded
    FROM campaign_prospects 
    WHERE campaign_id = $1
  `, [campaignId]);
  
  // 2. Get message metrics
  const messages = await database.query(`
    SELECT 
      COUNT(*) as total_messages,
      COUNT(CASE WHEN action_type = 'message_sent' THEN 1 END) as sent,
      COUNT(CASE WHEN action_type = 'message_received' THEN 1 END) as received
    FROM campaign_actions 
    WHERE campaign_id = $1
  `, [campaignId]);
  
  // 3. Calculate rates
  const analytics = {
    invitations: {
      sent: invitations.total_sent,
      pending: invitations.pending,
      accepted: invitations.accepted,
      acceptance_rate: invitations.accepted / invitations.total_sent
    },
    messages: {
      sent: messages.sent,
      received: messages.received,
      response_rate: messages.received / messages.sent
    },
    conversion: {
      responded: invitations.responded,
      conversion_rate: invitations.responded / invitations.accepted
    }
  };
  
  return analytics;
}
```

### Guide 5: Rate Limiting & Compliance

#### LinkedIn Rate Limit Management
```typescript
class LinkedInRateLimiter {
  private dailyInvitations = 0;
  private hourlyMessages = 0;
  private lastReset = new Date();
  
  async sendInvitation(invitationData: any) {
    // Check daily limits
    if (this.dailyInvitations >= 80) {
      throw new Error('Daily invitation limit reached');
    }
    
    // Send invitation
    const result = await this.sendLinkedInInvitation(invitationData);
    
    // Update counters
    this.dailyInvitations++;
    
    // Random delay (5-15 minutes)
    await this.randomDelay();
    
    return result;
  }
  
  async sendMessage(messageData: any) {
    // Check hourly limits
    if (this.hourlyMessages >= 100) {
      throw new Error('Hourly message limit reached');
    }
    
    // Send message
    const result = await this.sendLinkedInMessage(messageData);
    
    // Update counters
    this.hourlyMessages++;
    
    return result;
  }
  
  private async randomDelay() {
    const minDelay = 5 * 60 * 1000;  // 5 minutes
    const maxDelay = 15 * 60 * 1000; // 15 minutes
    const delay = Math.random() * (maxDelay - minDelay) + minDelay;
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
```

### Guide 6: Error Handling & Recovery

#### Robust Error Handling Implementation
```typescript
async function robustCampaignExecution(campaign: Campaign) {
  const results = {
    successful: 0,
    failed: 0,
    errors: [] as string[]
  };
  
  for (const prospect of campaign.prospects) {
    try {
      await withRetry(async () => {
        await sendInvitationToProspect(prospect, campaign);
        results.successful++;
      }, 3);
      
    } catch (error: any) {
      results.failed++;
      results.errors.push(`${prospect.name}: ${error.message}`);
      
      // Log detailed error for debugging
      await database.logCampaignError({
        campaign_id: campaign.id,
        prospect_id: prospect.id,
        error: error.message,
        stack: error.stack,
        timestamp: new Date()
      });
    }
  }
  
  return results;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  backoffMs: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      // Don't retry on certain errors
      if (error.status === 401 || error.status === 403) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, backoffMs * Math.pow(2, attempt - 1))
      );
    }
  }
  
  throw new Error('Max retries exceeded');
}
```

---

## 🔌 MCP (Model Context Protocol) Integration

### **Why MCP for LinkedIn Campaigns?**

**🎯 Primary Advantage**: MCP enables structured, rate-optimized messaging for multi-channel automation

**🛡️ Rate Limit Protection**: MCP dynamically queues and schedules requests, ensuring LinkedIn's limits are never exceeded

**🚀 Multi-Variant Support**: MCP supports all LinkedIn API variants, including Sales Navigator, Recruiter, and Classic LinkedIn

**📦 Ready-to-Use Integration**: Unipile offers a scalable API that simplifies LinkedIn automation using MCP principles

### **MCP Advantages Over REST API**

| Feature | MCP Approach | REST API Approach |
|---------|--------------|-------------------|
| **Rate Limiting** | Automatic queue management | Manual rate limit tracking |
| **Authentication** | Built-in token management | Manual API key handling |
| **Error Handling** | Automatic retries & recovery | Custom error logic required |
| **Data Structure** | Unified object format | Platform-specific responses |
| **Multi-Platform** | Single interface for all channels | Separate integrations per platform |
| **Context Awareness** | Conversation history included | Manual message correlation |
| **Account Selection** | Smart account routing | Manual account management |

### Available MCP Tools ✅ ACTIVE
The Unipile MCP server provides direct tool access without REST API calls:

```typescript
// Available MCP Tools for Campaign Implementation
mcp__unipile__unipile_get_accounts         // ✅ WORKING - Get all connected accounts
mcp__unipile__unipile_get_recent_messages  // ✅ WORKING - Get recent messages by account
mcp__unipile__unipile_get_emails           // ✅ WORKING - Get email messages
```

### MCP vs REST API Comparison

| Feature | MCP Tools | REST API |
|---------|-----------|----------|
| **Setup** | Configured in Claude Desktop | Requires API key management |
| **Authentication** | Handled automatically | Manual token management |
| **Usage** | Direct function calls | HTTP requests with headers |
| **Rate Limiting** | Managed by MCP server | Manual implementation needed |
| **Error Handling** | Built-in retry logic | Custom error handling required |

### MCP Integration Example
```typescript
// Using MCP tools directly in campaign code
async function getCampaignAccountInfo() {
  // Direct MCP tool call - no HTTP request needed
  const accounts = await mcp__unipile__unipile_get_accounts();
  
  // Filter LinkedIn accounts with premium features
  const linkedinAccounts = accounts.filter(account => 
    account.type === 'LINKEDIN' && 
    account.connection_params?.im?.premiumFeatures?.length > 0
  );
  
  return linkedinAccounts;
}

// Get recent messages for campaign monitoring
async function monitorCampaignResponses(accountId: string) {
  const messages = await mcp__unipile__unipile_get_recent_messages({
    account_id: accountId,
    batch_size: 50
  });
  
  // Process new responses for campaign analytics
  return messages.filter(msg => 
    msg.direction === 'inbound' && 
    new Date(msg.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  );
}
```

### **MCP-First Implementation Strategy** 🚀
**RECOMMENDED**: Use MCP for all data operations, REST API only for campaign execution

```typescript
class UnipileCampaignManager {
  // Read operations via MCP (simpler, more reliable)
  async getAccountInfo() {
    return await mcp__unipile__unipile_get_accounts();
  }
  
  async getRecentMessages(accountId: string) {
    return await mcp__unipile__unipile_get_recent_messages({ account_id: accountId });
  }
  
  // Write operations via REST API (full control, error handling)
  async sendInvitation(invitationData: SendInvitationRequest) {
    return await fetch(`${UNIPILE_BASE_URL}/api/v1/users/invite`, {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invitationData)
    });
  }
  
  async sendMessage(messageData: any) {
    return await fetch(`${UNIPILE_BASE_URL}/api/v1/chats/${messageData.chat_id}/messages`, {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messageData)
    });
  }
}
```

### MCP Server Configuration Status ✅ ACTIVE
Based on the working MCP tools, the server is properly configured at:
- **Location**: `/Users/tvonlinz/mcp-servers/mcp-unipile/`
- **DSN**: `api8.unipile.com:13851` (different from REST API DSN)
- **Status**: Active with 5 LinkedIn accounts connected
- **Features**: Premium accounts with Sales Navigator access available

### Connected LinkedIn Accounts Summary
```
Account 1: Irish Cita De Ade (Premium) - InnovareAI Services
Account 2: Thorsten Linz (Premium + Sales Navigator) - Multiple organizations  
Account 3: Martin Schechtner (Basic) - Energiekreislauf GmbH, DIGGERS GmbH
Account 4: Peter Noble (Premium) - red-dragonfly.vc
Account 5: Charissa Caniel (Premium) - No organizations
```

**Campaign Ready**: Accounts 1, 2, and 4 have premium features suitable for advanced campaigns.

### **🏆 FINAL RECOMMENDATION: MCP-First Architecture**

```typescript
// ✅ PRODUCTION-READY MCP-FIRST IMPLEMENTATION
class ProductionLinkedInCampaigns {
  
  // 1. MCP for ALL data operations (account selection, monitoring, analytics)
  async getOptimalAccount() {
    const accounts = await mcp__unipile__unipile_get_accounts();
    
    // Smart account selection: Sales Navigator > Premium > Classic
    return accounts
      .filter(acc => acc.type === 'LINKEDIN' && acc.sources?.[0]?.status === 'OK')
      .sort((a, b) => {
        const aFeatures = a.connection_params?.im?.premiumFeatures || [];
        const bFeatures = b.connection_params?.im?.premiumFeatures || [];
        
        if (aFeatures.includes('sales_navigator')) return -1;
        if (bFeatures.includes('sales_navigator')) return 1;
        if (aFeatures.includes('premium')) return -1;
        if (bFeatures.includes('premium')) return 1;
        return 0;
      })[0];
  }
  
  // 2. MCP for real-time campaign monitoring
  async monitorCampaignActivity(accountId: string) {
    const messages = await mcp__unipile__unipile_get_recent_messages({
      account_id: accountId,
      batch_size: 100
    });
    
    return {
      new_responses: messages.filter(msg => 
        new Date(msg.timestamp) > new Date(Date.now() - 60 * 60 * 1000)
      ),
      conversation_contexts: this.buildConversationContexts(messages),
      engagement_metrics: this.calculateEngagementMetrics(messages)
    };
  }
  
  // 3. REST API ONLY for campaign execution (precise control needed)
  async executeCampaign(prospects: Prospect[]) {
    const account = await this.getOptimalAccount();
    
    for (const prospect of prospects) {
      await this.sendInvitationViaREST(prospect, account.id);
      await this.randomDelay(); // MCP handles this internally for reads
    }
  }
}
```

**Why This Works**:
- **MCP handles complexity** - Account routing, rate limiting, data structure consistency
- **REST handles precision** - Exact campaign timing, custom error handling, invitation control
- **Best of both worlds** - Simplified data access + precise campaign execution

---

## Production Deployment Checklist

### Infrastructure Requirements
- [ ] **Webhook Endpoints**: Secure HTTPS endpoints for Unipile webhooks
- [ ] **Rate Limiting**: Implement LinkedIn rate limit compliance
- [ ] **Queue System**: Message queue for campaign execution
- [ ] **Database Schema**: Tables for campaigns, prospects, messages, analytics
- [ ] **Error Handling**: Comprehensive error logging and recovery
- [ ] **Monitoring**: Campaign performance and system health monitoring

### Unipile Integration Setup
- [ ] **API Keys**: Production Unipile API credentials
- [ ] **Account Connections**: LinkedIn account authentication
- [ ] **Webhook Registration**: Register all required webhook endpoints
- [ ] **Rate Limit Monitoring**: Track API usage and limits
- [ ] **Message Storage**: Database design for message history

### SAM AI Integration
- [ ] **Response Generation**: Connect SAM AI for contextual responses
- [ ] **Context Management**: Conversation history for better responses
- [ ] **HITL Approval**: Human approval system for quality control
- [ ] **Template Management**: Pre-approved response templates
- [ ] **Learning System**: Improve responses based on approval patterns

### Campaign Management
- [ ] **Template Builder**: UI for creating message templates
- [ ] **Prospect Upload**: CSV import and validation system
- [ ] **Campaign Scheduling**: Respect rate limits and timing
- [ ] **Follow-up Sequences**: Automated multi-step campaigns
- [ ] **Analytics Dashboard**: Real-time campaign performance metrics

This comprehensive analysis shows that Unipile provides excellent support for LinkedIn campaigns, with Connector Campaigns being the strongest starting point for implementation. The webhook system enables real-time campaign monitoring, automated follow-up sequences, and AI-powered response handling through N8N integration. The detailed message object schema, API operations, and complete implementation architecture provide the foundation for building sophisticated conversational AI systems with human oversight and comprehensive campaign management capabilities.