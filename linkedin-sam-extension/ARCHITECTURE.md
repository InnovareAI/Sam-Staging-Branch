# SAM LinkedIn Extension - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    LinkedIn.com                         │
│                                                         │
│  ┌──────────────────────────────────────────┐          │
│  │ User's Browser (Chrome)                  │          │
│  │                                          │          │
│  │  ┌────────────────────────────────────┐ │          │
│  │  │ LinkedIn Feed Page                 │ │          │
│  │  │ ┌────────────────────────────────┐ │ │          │
│  │  │ │ Post by John Doe               │ │ │          │
│  │  │ │ "What's your biggest...?"      │ │ │          │
│  │  │ ├────────────────────────────────┤ │ │          │
│  │  │ │ 💬 Generate with SAM  ← ADDED │ │ │          │
│  │  │ └────────────────────────────────┘ │ │          │
│  │  │                                    │ │          │
│  │  │ (SAM Extension Content Script)    │ │          │
│  │  └────────────────────────────────────┘ │          │
│  │            ↓ User clicks button          │          │
│  └────────────────────────────────────────────          │
└─────────────────────────────────────────────────────────┘
                     ↓
                     ↓ Extract post data
                     ↓
┌─────────────────────────────────────────────────────────┐
│              Chrome Extension                           │
│                                                         │
│  ┌────────────────┐    ┌────────────────┐             │
│  │ Content Script │ → │ Background     │             │
│  │ (content.js)   │    │ Service Worker │             │
│  │                │    │ (background.js)│             │
│  │ • Detect posts │    │ • API calls    │             │
│  │ • Add buttons  │    │ • Track stats  │             │
│  │ • Insert text  │    │ • Manage auth  │             │
│  └────────────────┘    └────────────────┘             │
│                              ↓                          │
│                              ↓ POST request             │
└─────────────────────────────────────────────────────────┘
                     ↓
                     ↓ {
                     ↓   workspace_id,
                     ↓   post_text,
                     ↓   author_name,
                     ↓   engagement
                     ↓ }
                     ↓
┌─────────────────────────────────────────────────────────┐
│              SAM API (Netlify)                          │
│  https://your-sam.netlify.app                          │
│                                                         │
│  POST /api/linkedin-commenting/generate-from-text      │
│                                                         │
│  ┌──────────────────────────────────────────┐         │
│  │ 1. Validate request                      │         │
│  │ 2. Load workspace context                │         │
│  │ 3. Load brand guidelines                 │         │
│  │ 4. Load knowledge base (if enabled)      │         │
│  │ 5. Build AI prompt                       │         │
│  │ 6. Call Claude API                       │         │
│  │ 7. Validate quality                      │         │
│  │ 8. Return comment                        │         │
│  └──────────────────────────────────────────┘         │
│                     ↓                                   │
└─────────────────────────────────────────────────────────┘
                     ↓
                     ↓ Uses
                     ↓
┌─────────────────────────────────────────────────────────┐
│              SAM Knowledge Base                         │
│                                                         │
│  ┌────────────────┐  ┌────────────────┐               │
│  │ Brand          │  │ Workspace      │               │
│  │ Guidelines     │  │ Context        │               │
│  │                │  │                │               │
│  │ • Tone         │  │ • Company name │               │
│  │ • Formality    │  │ • Expertise    │               │
│  │ • Style        │  │ • Products     │               │
│  │ • Examples     │  │ • KB content   │               │
│  └────────────────┘  └────────────────┘               │
│                                                         │
└─────────────────────────────────────────────────────────┘
                     ↓
                     ↓ Generates comment
                     ↓
┌─────────────────────────────────────────────────────────┐
│              Response to Extension                      │
│                                                         │
│  {                                                      │
│    "success": true,                                     │
│    "comment_text": "The question about...",            │
│    "confidence_score": 0.87,                           │
│    "reasoning": "Added value by...",                   │
│    "quality_indicators": { ... }                       │
│  }                                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
                     ↓
                     ↓ Returns to browser
                     ↓
┌─────────────────────────────────────────────────────────┐
│              LinkedIn Comment Box                       │
│                                                         │
│  ┌──────────────────────────────────────────┐         │
│  │ Add a comment...                         │         │
│  ├──────────────────────────────────────────┤         │
│  │ The question about features really       │  ← FILLED
│  │ resonates - we've found that intelligent │         │
│  │ lead scoring makes the biggest...        │         │
│  │                                          │         │
│  ├──────────────────────────────────────────┤         │
│  │                   [Cancel] [Post] ←─────┘         │
│  └──────────────────────────────────────────┘         │
│                                                         │
│  User reviews and clicks Post manually                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Post Detection
```javascript
// content.js scans LinkedIn DOM
const posts = document.querySelectorAll('.feed-shared-update-v2');

// Extract post data
{
  id: "post-123",
  text: "What's your biggest challenge with...?",
  author: {
    name: "John Doe",
    title: "CEO at Company"
  },
  engagement: {
    likes: 42,
    comments: 7
  }
}
```

### 2. API Request
```javascript
// background.js makes authenticated request
POST https://sam.netlify.app/api/linkedin-commenting/generate-from-text

Headers:
  Content-Type: application/json
  Authorization: Bearer <api_key>

Body:
  {
    workspace_id: "abc-123-def-456",
    post_text: "What's your biggest challenge...",
    author_name: "John Doe",
    author_title: "CEO at Company",
    engagement: { likes: 42, comments: 7 }
  }
```

### 3. SAM Processing
```typescript
// Sam API endpoint
async function POST(request) {
  // Load workspace
  const workspace = await getWorkspace(workspace_id);

  // Load brand guidelines
  const guidelines = await getBrandGuidelines(workspace_id);

  // Load KB if enabled
  const kb = guidelines.use_workspace_knowledge
    ? await getKnowledgeBase(workspace_id)
    : null;

  // Build context
  const context = {
    post: { text, author, engagement },
    workspace: { name, expertise, kb, guidelines }
  };

  // Generate comment
  const comment = await generateLinkedInComment(context);

  return comment;
}
```

### 4. Comment Insertion
```javascript
// content.js inserts into LinkedIn
const commentBox = document.querySelector('.ql-editor');
commentBox.innerHTML = `<p>${commentText}</p>`;
commentBox.dispatchEvent(new Event('input', { bubbles: true }));

// Highlight for user
commentBox.style.backgroundColor = '#fffbea';
commentBox.scrollIntoView({ behavior: 'smooth' });
```

## Component Breakdown

### Content Script (content.js)
**Purpose**: Interact with LinkedIn page
**Responsibilities**:
- Scan page for posts (MutationObserver)
- Extract post data from DOM
- Create and inject SAM buttons
- Handle button clicks
- Insert generated comments
- Show notifications

**Key Functions**:
- `scanForPosts()` - Find LinkedIn posts
- `extractPostData()` - Parse post content
- `createSamButton()` - Create UI button
- `generateComment()` - Trigger generation
- `insertCommentIntoLinkedIn()` - Fill comment box

### Background Worker (background.js)
**Purpose**: Handle API communication
**Responsibilities**:
- Make authenticated API requests to Sam
- Manage credentials from storage
- Track session statistics
- Update extension badge

**Key Functions**:
- `handleCommentGeneration()` - API call logic
- Update stats on success
- Badge counter updates

### Popup (popup.html/js)
**Purpose**: Configuration UI
**Responsibilities**:
- Store/retrieve settings
- Test Sam connection
- Display stats
- Reset counters

**Settings**:
- Sam API URL
- Workspace ID
- API Key (optional)

### Sam API Endpoint
**Purpose**: Generate comments from raw text
**Responsibilities**:
- Validate requests
- Load workspace context
- Load brand guidelines & KB
- Call LinkedIn commenting agent
- Return formatted response

**Endpoint**: `/api/linkedin-commenting/generate-from-text`

## Security & Privacy

### Data Storage
```javascript
// Chrome sync storage (encrypted)
chrome.storage.sync: {
  samApiUrl: "https://...",
  workspaceId: "uuid",
  apiKey: "secret" // Optional
}

// Local storage (session data)
chrome.storage.local: {
  commentsGenerated: 12,
  postsProcessed: 8
}
```

### Authentication Flow
```
1. User enters credentials in popup
2. Stored in Chrome sync storage (encrypted)
3. Background worker retrieves on API call
4. Sent in Authorization header
5. Sam validates against workspace
```

### No Data Leakage
- ❌ No LinkedIn data stored
- ❌ No tracking/analytics
- ❌ No third-party services
- ✅ Direct connection to your Sam only
- ✅ Open source for inspection

## Performance

### Optimization Strategies

**Lazy Loading**:
- Only process visible posts
- MutationObserver for new posts
- Throttled scanning (every 2 seconds)

**Caching**:
- Config cached in memory
- No repeated API calls for same post

**Async Operations**:
- Non-blocking UI updates
- Background API calls
- Progressive enhancement

### Metrics

| Operation | Time |
|-----------|------|
| Detect post | <10ms |
| Add button | <5ms |
| API call | 2-5s |
| Insert comment | <100ms |
| Total UX | 2-5s |

## Error Handling

### Error Types

1. **Configuration Error**
   - Missing API URL
   - Invalid Workspace ID
   - Shows: "SAM not configured"

2. **Network Error**
   - Sam unreachable
   - Timeout
   - Shows: "Failed to connect"

3. **API Error**
   - Invalid response
   - Rate limit
   - Shows: Specific error message

4. **DOM Error**
   - Comment box not found
   - LinkedIn UI changed
   - Shows: "Could not find comment box"

### Recovery
- Clear error messages
- Retry button
- Fallback to manual input
- Console logging for debugging

## Testing

### Unit Tests (Future)
- Post detection accuracy
- Data extraction correctness
- Comment insertion reliability

### Integration Tests
- Sam API connectivity
- Auth validation
- Comment generation quality

### Manual Testing
- Multiple post types
- Different engagement levels
- Various LinkedIn layouts
- Edge cases (short posts, etc.)

## Future Enhancements

### Planned Features
- [ ] Reply to comments
- [ ] Bulk generation
- [ ] A/B testing
- [ ] Analytics dashboard
- [ ] Firefox support
- [ ] Edge support

### API Extensions
- Multiple comment variations
- Sentiment analysis
- Engagement prediction
- Post quality scoring

---

**Architecture Summary**: Browser extension → Sam API → Claude AI → LinkedIn comment box
