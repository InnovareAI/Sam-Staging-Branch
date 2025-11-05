# LinkedIn Search Import - Technical Flow

## Overview

The LinkedIn import system uses a **hybrid streaming + background save architecture** to provide instant feedback while reliably persisting data.

---

## Architecture Diagram

```
User → SAM/UI → Streaming API → Unipile API
                      ↓
                [SSE Stream to Frontend]
                      ↓
                Background Queue → Supabase
                      ↓
                prospect_approval_data table
```

---

## Step-by-Step Technical Flow

### 1. **Initiation** (User/SAM)

**Entry Point:** User pastes LinkedIn URL to SAM or navigates to import page

**Code:** `app/api/sam/threads/[threadId]/messages/route.ts:2036`

```typescript
const streamUrl = `/workspace/${workspaceId}/data-approval/import?url=${encodeURIComponent(savedSearchUrl)}&target=2500`
```

**Query Parameters:**
- `url` - LinkedIn saved search URL
- `target` - Number of prospects to fetch (default: 2500, max: 2500)
- `campaign` - Optional campaign name

---

### 2. **Import Page Loads** (Frontend)

**File:** `app/(dashboard)/workspace/[workspaceId]/data-approval/import/page.tsx`

**Actions:**
1. Authenticates user
2. Verifies workspace access
3. Parses query parameters
4. Renders `LinkedInImportStream` component

**Component Props:**
```typescript
<LinkedInImportStream
  savedSearchUrl={savedSearchUrl}
  targetCount={2500}
  userId={userId}
  workspaceId={workspaceId}
  onComplete={(sessionId) => redirect to approval page}
  onError={(error) => show error}
/>
```

---

### 3. **Streaming API Request** (Frontend → Backend)

**File:** `app/components/LinkedInImportStream.tsx:66-78`

**HTTP Request:**
```typescript
POST /api/linkedin/import-saved-search-stream
Content-Type: application/json

{
  saved_search_url: "https://www.linkedin.com/sales/search/people?savedSearchId=123",
  campaign_name: "20251105-BLL-CISO US 2025",
  target_count: 2500,
  user_id: "6a927440-ebe1-49b4-ae5e-fbee5d27944d",
  workspace_id: "014509ba-226e-43ee-ba58-ab5f20d2ed08"
}
```

**Connection:** Opens EventSource for Server-Sent Events (SSE)

---

### 4. **Backend: Session Creation** (Before fetching data)

**File:** `app/api/linkedin/import-saved-search-stream/route.ts:83-126`

**Database Operations:**

**A. Create Session Record**
```sql
INSERT INTO prospect_approval_sessions (
  id,                    -- UUID v4 generated
  batch_number,          -- Auto-incremented (e.g., 5)
  user_id,              -- From request
  workspace_id,         -- From request
  campaign_name,        -- Generated: "20251105-BLL-CISO US 2025"
  campaign_tag,         -- "saved_search_123"
  total_prospects,      -- 0 (will increment)
  approved_count,       -- 0
  rejected_count,       -- 0
  pending_count,        -- 0
  status,              -- 'active'
  created_at           -- NOW()
)
```

**B. Send Session Event to Frontend**
```typescript
event: session
data: {
  session_id: "51b7df55-6ef0-4f0c-8ad9-73ba1b7ab96c",
  campaign_name: "20251105-BLL-CISO US 2025"
}
```

---

### 5. **Backend: Fetch from LinkedIn** (Pagination Loop)

**File:** `app/api/linkedin/import-saved-search-stream/route.ts:162-257`

**API Configuration:**
```typescript
const UNIPILE_DSN = "api6"
const searchUrl = "https://api6.unipile.com:13443/api/v1/linkedin/search"
const batchSize = 50  // LinkedIn returns max 50 per request
```

**Pagination Loop:**

```typescript
while (allProspects.length < 2500 && batchCount < maxBatches) {
  // Step 1: Fetch batch from Unipile
  const response = await fetch(`${searchUrl}?account_id=${unipileAccountId}&limit=50&cursor=${cursor}`, {
    method: 'POST',
    headers: { 'X-API-KEY': UNIPILE_API_KEY },
    body: JSON.stringify({ url: savedSearchUrl })
  })

  // Step 2: Parse response
  const { items, cursor } = await response.json()

  // Step 3: Stream to frontend IMMEDIATELY (non-blocking)
  controller.enqueue(encoder.encode(
    `event: batch\ndata: ${JSON.stringify({
      batch: batchCount,
      prospects: items,
      total: allProspects.length,
      has_more: !!cursor
    })}\n\n`
  ))

  // Step 4: Queue for background save (non-blocking)
  await importQueue.add(sessionId, items, batchCount)

  // Step 5: Continue if more results available
  if (!cursor) break

  // Small delay to avoid rate limiting
  await sleep(500)
}
```

**Key Points:**
- **Streaming happens FIRST** (instant UI update)
- **Database save happens in BACKGROUND** (queued)
- **No blocking** - each batch streams immediately

---

### 6. **Background Save Queue** (Non-blocking Persistence)

**File:** `lib/import-queue.ts`

**Queue Architecture:**

```typescript
class ImportQueue {
  private queue: QueueItem[] = []
  private processing = false

  async add(sessionId, prospects, batchNumber) {
    // Add to in-memory queue
    this.queue.push({ sessionId, prospects, batchNumber, retries: 0 })

    // Start background processor (if not running)
    if (!this.processing) {
      this.processQueue()  // Runs async in background
    }
  }
}
```

**Processing Flow:**

```
Queue: [Batch1, Batch2, Batch3]
         ↓
    processQueue() - async loop
         ↓
    saveBatch(Batch1) → Database
         ↓
    saveBatch(Batch2) → Database
         ↓
    saveBatch(Batch3) → Database
```

**Retry Logic:**
- Max 3 retries per batch
- 2-second delay between retries
- After 3 failures, logs error and continues

---

### 7. **Database Persistence** (Background)

**File:** `lib/import-queue.ts:89-151`

**A. Transform Prospect Data**

```typescript
const approvalProspects = prospects.map(prospect => ({
  id: uuidv4(),                    // Generate unique ID
  session_id: sessionId,           // Link to session
  prospect_id: extractLinkedInId(prospect.profile_url),
  name: prospect.name,
  title: prospect.headline,
  location: prospect.location,
  profile_image: prospect.profile_picture_url,
  company: {
    name: prospect.current_positions[0].company,
    industry: null,
    size: null
  },
  contact: {
    linkedin_url: prospect.profile_url,
    email: prospect.email || null,
    phone: prospect.phone || null
  },
  connection_degree: prospect.connection_degree || 0,
  enrichment_score: 0,
  source: 'unipile_linkedin_search',
  created_at: NOW()
}))
```

**B. Insert Prospects**

```sql
INSERT INTO prospect_approval_data (
  id,
  session_id,
  prospect_id,
  name,
  title,
  location,
  profile_image,
  recent_activity,
  company,           -- JSONB
  contact,           -- JSONB
  connection_degree,
  enrichment_score,
  source,
  created_at,
  approval_status    -- defaults to 'pending'
) VALUES (...)
```

**C. Update Session Totals**

```sql
-- Read current totals
SELECT total_prospects, pending_count
FROM prospect_approval_sessions
WHERE id = '51b7df55-6ef0-4f0c-8ad9-73ba1b7ab96c'

-- Update with new batch count
UPDATE prospect_approval_sessions
SET
  total_prospects = total_prospects + 50,
  pending_count = pending_count + 50
WHERE id = '51b7df55-6ef0-4f0c-8ad9-73ba1b7ab96c'
```

**Result:**
```
Batch 1: total_prospects = 50,  pending_count = 50
Batch 2: total_prospects = 100, pending_count = 100
Batch 3: total_prospects = 150, pending_count = 150
...
```

---

### 8. **Frontend Display** (Real-time Updates)

**File:** `app/components/LinkedInImportStream.tsx:80-145`

**Event Handling:**

```typescript
const eventSource = new EventSource('/api/linkedin/import-saved-search-stream')

eventSource.addEventListener('session', (e) => {
  const { session_id } = JSON.parse(e.data)
  setSessionId(session_id)
})

eventSource.addEventListener('batch', (e) => {
  const { prospects, total, has_more } = JSON.parse(e.data)

  // Add to displayed list immediately
  setProspects(prev => [...prev, ...prospects])

  // Update progress bar
  setProgress({ current: total, target: 2500, percentage: (total/2500)*100 })
})

eventSource.addEventListener('complete', (e) => {
  const { total } = JSON.parse(e.data)
  setStatus('complete')
  onComplete(sessionId, total)
})
```

**UI Updates:**
- Progress bar: "Importing 150 / 358 prospects (41%)"
- Live prospect cards appear in real-time
- Can start reviewing while import continues

---

## Data Flow Summary

### Timeline (for 358 prospects):

```
T+0s    : User pastes URL
T+1s    : Session created in DB
T+2s    : First batch requested from Unipile
T+3s    : Batch 1 (50 prospects) streamed to frontend
T+3.1s  : Batch 1 queued for DB save (background)
T+4s    : Batch 1 saved to DB
T+5s    : Batch 2 requested from Unipile
T+6s    : Batch 2 (50 prospects) streamed to frontend
T+6.1s  : Batch 2 queued for DB save (background)
...
T+30s   : Batch 7 (58 prospects) streamed (total: 358)
T+30s   : "Complete" event sent
T+31s   : Final batches finish saving to DB
```

**Key Characteristics:**
- **User sees data in ~3 seconds** (first batch)
- **Can start reviewing at T+3s** (don't need to wait)
- **All data saved by T+31s** (background)
- **No blocking** - streaming and saving are parallel

---

## Database Schema

### Table: `prospect_approval_sessions`

```sql
CREATE TABLE prospect_approval_sessions (
  id UUID PRIMARY KEY,
  batch_number INTEGER,
  user_id UUID REFERENCES users(id),
  workspace_id UUID REFERENCES workspaces(id),
  campaign_name TEXT,
  campaign_tag TEXT,
  total_prospects INTEGER DEFAULT 0,    -- Increments with each batch
  approved_count INTEGER DEFAULT 0,
  rejected_count INTEGER DEFAULT 0,
  pending_count INTEGER DEFAULT 0,      -- Increments with each batch
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP
)
```

### Table: `prospect_approval_data`

```sql
CREATE TABLE prospect_approval_data (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES prospect_approval_sessions(id),
  prospect_id TEXT,                     -- LinkedIn profile ID
  name TEXT,
  title TEXT,
  location TEXT,
  profile_image TEXT,
  recent_activity TEXT,
  company JSONB,                        -- { name, industry, size }
  contact JSONB,                        -- { linkedin_url, email, phone }
  connection_degree INTEGER,
  enrichment_score INTEGER,
  source TEXT,                          -- 'unipile_linkedin_search'
  enriched_at TIMESTAMP,
  created_at TIMESTAMP,
  approval_status TEXT DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
  workspace_id UUID REFERENCES workspaces(id)
)
```

---

## Error Handling

### 1. **Network Failures** (Unipile API down)

```typescript
try {
  const response = await fetch(unipileUrl)
} catch (error) {
  // Stream error event to frontend
  controller.enqueue(`event: batch_error\ndata: {...}\n\n`)

  // If first batch fails → abort
  // If later batch fails → continue with what we have
}
```

### 2. **Database Save Failures**

```typescript
// Queue retries up to 3 times
if (item.retries < 3) {
  item.retries++
  this.queue.push(item)  // Re-add to queue
  await sleep(2000)      // Wait 2s before retry
} else {
  console.error(`Max retries reached. Data may be lost.`)
  // TODO: Alert admin
}
```

### 3. **Stream Connection Lost**

```typescript
eventSource.onerror = () => {
  console.error('Stream connection lost')

  // Frontend shows: "Connection interrupted. Check Data Approval tab for imported prospects."
  // Session ID is already known, so user can navigate manually
}
```

---

## Performance Characteristics

### Throughput

- **Batch Size:** 50 prospects per request
- **Batch Interval:** ~3 seconds (Unipile response time + 500ms delay)
- **Rate:** ~16 prospects/second
- **358 prospects:** ~22 seconds total

### Memory Usage

- **In-memory queue:** Holds batches temporarily (~50 prospects × 2KB = 100KB per batch)
- **Max queue size:** ~10 batches max (500KB peak memory)

### Database Load

- **Inserts:** 50 prospects per batch → ~1 INSERT per second
- **Updates:** 1 session UPDATE per batch → ~1 UPDATE per 3 seconds
- **Indexes:** Auto-indexed on session_id, workspace_id, prospect_id

---

## Advantages of This Architecture

### 1. **Instant Feedback**
- User sees first 50 prospects in **3 seconds**
- No 8-10 minute wait for full import

### 2. **Non-blocking**
- Frontend doesn't wait for database saves
- Streaming continues even if DB temporarily slow

### 3. **Resilient**
- Network failures don't lose streamed data
- Retry logic handles temporary DB issues
- Session ID allows manual recovery

### 4. **Scalable**
- Background queue prevents overwhelming database
- Can handle multiple concurrent imports
- Rate limiting built-in (500ms delays)

---

## Future Optimizations

### 1. **Batch Insert Optimization**
Currently: 50 individual INSERT statements
Future: Single bulk INSERT with UNNEST

```sql
INSERT INTO prospect_approval_data
SELECT * FROM UNNEST($1::uuid[], $2::text[], ...)
```

### 2. **WebSocket Instead of SSE**
- Bidirectional communication
- Pause/resume capability
- Better error recovery

### 3. **Redis Queue**
- Persistent queue (survives server restarts)
- Distributed processing (multiple workers)
- Better monitoring/metrics

---

## Debugging

### Check Queue Status

```typescript
import { importQueue } from '@/lib/import-queue'

const status = importQueue.getStatus()
console.log('Queue length:', status.queueLength)
console.log('Processing:', status.processing)
```

### Verify Database Saves

```sql
-- Check session totals
SELECT
  id,
  campaign_name,
  total_prospects,
  pending_count,
  created_at
FROM prospect_approval_sessions
ORDER BY created_at DESC
LIMIT 5;

-- Count actual prospects
SELECT
  session_id,
  COUNT(*) as actual_count
FROM prospect_approval_data
WHERE session_id = '51b7df55-6ef0-4f0c-8ad9-73ba1b7ab96c'
GROUP BY session_id;
```

### Monitor Streaming

```typescript
// Browser console
const es = new EventSource('/api/linkedin/import-saved-search-stream')
es.addEventListener('batch', e => console.log('Batch:', JSON.parse(e.data)))
es.addEventListener('complete', e => console.log('Done:', JSON.parse(e.data)))
```

---

**Last Updated:** 2025-11-05
**System Version:** Streaming Import v2.0
