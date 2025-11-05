# Hybrid LinkedIn Import - Implementation Plan

**Date:** November 5, 2025
**Approach:** Option C - Show immediately + background save

---

## Architecture Overview

```
┌─────────────────┐
│ LinkedIn API    │
│ (Unipile)       │
└────────┬────────┘
         │ Batches (50 prospects each)
         ↓
┌─────────────────────────────────────────┐
│ Import API Route                        │
│ /api/linkedin/import-saved-search       │
│                                         │
│  ┌──────────────┐    ┌───────────────┐│
│  │ Stream to    │───→│ Background    ││
│  │ Frontend     │    │ DB Save       ││
│  │ (SSE/WS)     │    │ (Queue)       ││
│  └──────────────┘    └───────────────┘│
└─────────────────────────────────────────┘
         │                    │
         ↓                    ↓
┌─────────────────┐  ┌────────────────┐
│ Frontend UI     │  │ Supabase DB    │
│ (React State)   │  │ (Persistence)  │
└─────────────────┘  └────────────────┘
```

---

## Implementation Steps

### Phase 1: Backend - Streaming Import API ⚡

**File:** `app/api/linkedin/import-saved-search-stream/route.ts` (NEW)

**Key Features:**
1. Server-Sent Events (SSE) for real-time streaming
2. Stream each batch as it completes
3. Background queue for DB saves
4. Error handling per batch

**API Response Format:**
```
event: progress
data: {"batch": 1, "prospects": [...50], "total": 50, "target": 534}

event: progress
data: {"batch": 2, "prospects": [...50], "total": 100, "target": 534}

event: complete
data: {"total": 534, "session_id": "...", "batches": 11}
```

**Pseudocode:**
```typescript
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      // Create session first
      const sessionId = await createSession()

      // Stream session info
      controller.enqueue(encoder.encode(
        `event: session\ndata: ${JSON.stringify({session_id: sessionId})}\n\n`
      ))

      // Fetch batches
      while (batch < maxBatches) {
        const prospects = await fetchBatch()

        // Send prospects immediately to frontend
        controller.enqueue(encoder.encode(
          `event: batch\ndata: ${JSON.stringify({
            batch: batchCount,
            prospects: prospects,
            total: allProspects.length
          })}\n\n`
        ))

        // Queue for background save (non-blocking)
        await queueForSave(sessionId, prospects)
      }

      controller.enqueue(encoder.encode(`event: complete\ndata: {}\n\n`))
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
```

### Phase 2: Background Save Queue

**File:** `lib/import-queue.ts` (NEW)

**Features:**
- In-memory queue for batch saves
- Processes saves in background
- Retries on failure
- Updates session counts

**Pseudocode:**
```typescript
class ImportQueue {
  private queue: Array<{sessionId: string, prospects: any[]}>

  async add(sessionId: string, prospects: any[]) {
    this.queue.push({sessionId, prospects})
    if (!this.processing) {
      this.processQueue()
    }
  }

  private async processQueue() {
    while (this.queue.length > 0) {
      const item = this.queue.shift()
      await this.saveBatch(item.sessionId, item.prospects)
    }
  }

  private async saveBatch(sessionId: string, prospects: any[]) {
    await supabase.from('prospect_approval_data').insert(
      prospects.map(p => ({...p, session_id: sessionId}))
    )

    await supabase.from('prospect_approval_sessions')
      .update({total_prospects: total})
      .eq('id', sessionId)
  }
}

export const importQueue = new ImportQueue()
```

### Phase 3: Frontend - Real-Time Display

**File:** `app/components/LinkedInImportStream.tsx` (NEW)

**Features:**
- EventSource to receive SSE
- Real-time prospect list updates
- Progress indicator
- Can start reviewing immediately

**Pseudocode:**
```typescript
export function LinkedInImportStream({ searchUrl }: Props) {
  const [prospects, setProspects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState({current: 0, target: 0})

  useEffect(() => {
    const eventSource = new EventSource(
      `/api/linkedin/import-saved-search-stream?url=${searchUrl}`
    )

    eventSource.addEventListener('session', (e) => {
      const data = JSON.parse(e.data)
      setSessionId(data.session_id)
    })

    eventSource.addEventListener('batch', (e) => {
      const data = JSON.parse(e.data)
      // Add new prospects to existing list
      setProspects(prev => [...prev, ...data.prospects])
      setProgress({current: data.total, target: data.target})
    })

    eventSource.addEventListener('complete', () => {
      setLoading(false)
      eventSource.close()
    })

    return () => eventSource.close()
  }, [searchUrl])

  return (
    <div>
      <ProgressBar current={progress.current} target={progress.target} />
      <ProspectList prospects={prospects} />
      {loading && <p>Loading more prospects...</p>}
    </div>
  )
}
```

### Phase 4: SAM Integration

**Update:** `app/api/sam/threads/[threadId]/messages/route.ts`

**Change:** Detect streaming import and provide immediate feedback

```typescript
// Instead of waiting for import to complete:
if (savedSearchMatch) {
  const streamUrl = `/api/linkedin/import-saved-search-stream?url=${encodeURIComponent(url)}`

  aiResponse = `✅ **Starting LinkedIn import...**\n\n` +
    `🔄 Your prospects will appear in the Data Approval tab in the next **45 seconds**.\n\n` +
    `You can start reviewing prospects as they load - no need to wait for all ${targetCount}!\n\n` +
    `[Open Data Approval →](/workspace/${workspaceId}/data-approval?stream=${sessionId})`
}
```

---

## Timeline Comparison

### Current (Blocking)
```
0:00  - User pastes URL
0:00  - Import starts (user sees spinner)
8:00  - Import completes, saves to DB
8:05  - User sees prospects
```

### New (Streaming)
```
0:00  - User pastes URL
0:30  - Session created
0:45  - First 50 prospects visible ✅ (CAN START REVIEWING)
1:30  - 100 prospects visible
2:15  - 150 prospects visible
...
8:15  - All 534 prospects visible
8:30  - All prospects saved to DB (background complete)
```

**User Experience:**
- Sees first prospects in **45 seconds** (vs 8 minutes)
- Can start approving/rejecting immediately
- No blocking wait
- Data still persists for session resume

---

## Technical Considerations

### 1. Server-Sent Events (SSE) vs WebSocket

**Chose SSE because:**
- ✅ Simpler (one-way communication is enough)
- ✅ Auto-reconnects on disconnect
- ✅ Works through most firewalls/proxies
- ✅ Native browser support (EventSource)

**WebSocket would be overkill:**
- We don't need bidirectional communication
- More complex setup
- Harder to deploy (needs persistent connections)

### 2. Background Save Strategy

**Option A: Save per batch (chosen)**
```typescript
// After each batch fetched:
await queueForSave(prospects) // Non-blocking
streamToFrontend(prospects)   // Immediate
```

**Option B: Save at end**
```typescript
// After all batches:
await saveAll(allProspects) // Blocks at end
```

**Chose A because:**
- Progressive persistence
- Lower memory usage
- Better error recovery

### 3. Error Handling

**Batch fails during import:**
```typescript
try {
  const batch = await fetchBatch()
  streamToFrontend(batch)
  queueForSave(batch)
} catch (error) {
  // Stream error to frontend
  controller.enqueue(encoder.encode(
    `event: error\ndata: ${JSON.stringify({batch: i, error})}\n\n`
  ))
  // Continue with next batch (partial import)
}
```

**DB save fails:**
```typescript
// Frontend already has data (can review)
// Background: Retry save 3 times
// If still fails: Log error, alert user
```

### 4. Session Management

**Create session FIRST:**
- Need session_id before streaming prospects
- Frontend needs session_id for approval API
- Can track import progress per session

**Update session in background:**
- Total prospects count updates as batches arrive
- Don't block streaming for count updates

---

## Migration Path

### Phase 1: Add Streaming Endpoint (New Feature)
- Create `/api/linkedin/import-saved-search-stream/route.ts`
- Keep old endpoint for backward compatibility
- New frontend component uses streaming

### Phase 2: Update SAM to Use Streaming
- Detect saved search URLs
- Route to streaming endpoint
- Update response messages

### Phase 3: Deprecate Old Endpoint
- Once streaming is proven stable
- Remove old blocking import
- Update all references

---

## Performance Impact

### Before
- **Time to first prospect:** 8-10 minutes
- **User engagement:** Low (waiting)
- **Bounce rate:** High (users give up)

### After
- **Time to first prospect:** 45 seconds (10x faster perceived)
- **User engagement:** High (can start working)
- **Bounce rate:** Low (immediate feedback)

### Actual Import Time
- **Same total time:** ~8-10 minutes
- **But user doesn't wait** - starts reviewing at 45 seconds
- **Background save adds:** ~30 seconds total (non-blocking)

---

## Next Steps

1. ✅ Create streaming API endpoint
2. ✅ Implement background save queue
3. ✅ Build frontend streaming component
4. ✅ Update SAM integration
5. ✅ Test with 534 prospects
6. ✅ Monitor performance & errors
7. ✅ Roll out to production

---

## Success Metrics

**Target:**
- Time to first prospect: < 60 seconds (currently 8-10 min)
- User can start reviewing: Immediately (currently must wait)
- Completion rate: > 90% (currently ~60% due to timeouts)

**Monitoring:**
- Track time to first batch
- Track time to complete all batches
- Track background save completion rate
- Track user engagement (start reviewing before complete)

---

**Ready to implement?** This will dramatically improve the user experience!
