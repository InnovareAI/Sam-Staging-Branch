# Background Search Jobs System

## Overview

Async prospect search system that handles large LinkedIn searches (50-2500 prospects) without timeouts. Uses Netlify Background Functions (15-minute limit) and Supabase Realtime for progress tracking.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend (Data Approval Modal)                               │
│  - User enters search criteria                               │
│  - Calls POST /api/linkedin/search/create-job               │
│  - Subscribes to Supabase Realtime on prospect_search_jobs  │
│  - Displays real-time progress bar                           │
│  - Fetches results when status = 'completed'                 │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ API: Create Job                                              │
│  POST /api/linkedin/search/create-job                        │
│  - Insert job into prospect_search_jobs (status: queued)    │
│  - Return job_id immediately (~200ms)                        │
│  - Trigger background function (fire & forget)               │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ Netlify Background Function (15 min timeout)                │
│  /.netlify/functions/process-linkedin-search-background     │
│  - Update job status to 'processing'                         │
│  - Loop through Unipile pagination (100 per page)            │
│  - Save each batch to prospect_search_results               │
│  - Update progress_current (triggers Realtime)               │
│  - Mark as 'completed' when done                             │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ Supabase Realtime                                            │
│  - Broadcasts progress updates to subscribed frontends       │
│  - Frontend shows: "Fetched 500/2500 (20%)"                 │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ API: Fetch Results                                           │
│  GET /api/linkedin/search/results?job_id=xxx&page=1         │
│  - Query prospect_search_results                             │
│  - Return paginated prospects                                │
│  - Data Approval Modal displays for review                   │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### `prospect_search_jobs`

Tracks async search job status.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to auth.users |
| workspace_id | UUID | User's workspace |
| search_criteria | JSONB | Search params (keywords, location, etc.) |
| search_type | TEXT | 'linkedin', 'brightdata', etc. |
| search_source | TEXT | 'classic', 'sales_navigator', 'recruiter' |
| status | TEXT | 'queued', 'processing', 'completed', 'failed' |
| progress_current | INTEGER | Current prospect count |
| progress_total | INTEGER | Target prospect count |
| started_at | TIMESTAMPTZ | When processing began |
| completed_at | TIMESTAMPTZ | When processing finished |
| total_results | INTEGER | Final prospect count |
| error_message | TEXT | Error if failed |
| created_at | TIMESTAMPTZ | When job was created |
| updated_at | TIMESTAMPTZ | Last update (auto-updated on change) |

**Realtime enabled** - Frontend subscribes to updates on this table.

### `prospect_search_results`

Stores prospect data from completed searches.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| job_id | UUID | Foreign key to prospect_search_jobs |
| prospect_data | JSONB | Full prospect object |
| batch_number | INTEGER | Which API page (0, 1, 2, ...) |
| created_at | TIMESTAMPTZ | When prospect was added |

## API Endpoints

### 1. Create Job

**POST** `/api/linkedin/search/create-job`

**Request:**
```json
{
  "search_criteria": {
    "category": "people",
    "keywords": "CEO tech startup",
    "location": ["103644278"],
    "title": "CEO",
    "company_headcount": ["B", "C"]
  },
  "search_type": "linkedin",
  "target_count": 1000
}
```

**Response:**
```json
{
  "success": true,
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "message": "Search queued for 1000 prospects",
  "metadata": {
    "api": "sales_navigator",
    "max_results": 2500,
    "estimated_time_seconds": 30
  }
}
```

### 2. Check Job Status

**GET** `/api/linkedin/search/create-job?job_id={jobId}`

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "processing",
    "progress": {
      "current": 250,
      "total": 1000,
      "percentage": 25
    },
    "results_count": 250,
    "started_at": "2025-10-10T12:00:00Z",
    "completed_at": null,
    "error_message": null
  }
}
```

### 3. Fetch Results

**GET** `/api/linkedin/search/results?job_id={jobId}&page=1&per_page=50`

**Response:**
```json
{
  "success": true,
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "job_status": "completed",
  "prospects": [
    {
      "id": "linkedin_abc123",
      "name": "John Doe",
      "title": "CEO",
      "company": "Tech Startup Inc",
      "linkedinUrl": "https://linkedin.com/in/johndoe",
      "location": "San Francisco, CA",
      "connectionDegree": 2
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total": 1000,
    "total_pages": 20,
    "has_more": true
  }
}
```

## Testing

### Setup

1. **Create tables:**
   ```bash
   curl -X POST http://localhost:3000/api/admin/setup-search-jobs-tables
   ```

2. **Verify Netlify Dev running:**
   ```bash
   netlify dev
   # Or ensure dev server includes Netlify functions
   ```

### Run Test Script

```bash
node scripts/test-background-search.js
```

**What it tests:**
1. ✅ Database table creation
2. ✅ Job creation via API
3. ✅ Progress monitoring (polls every 5 sec)
4. ✅ Results fetching
5. ✅ Sample prospect display

**Expected output:**
```
🧪 Testing Background LinkedIn Search System
==========================================

📊 Step 1: Setting up database tables...
✅ Tables created successfully
   - prospect_search_jobs: ✅
   - prospect_search_results: ✅

🚀 Step 2: Creating search job...
✅ Job created: 550e8400-e29b-41d4-a716-446655440000
   API: sales_navigator
   Max results: 2500
   Est. time: ~15s

⏳ Step 3: Monitoring job progress...
   [████████████████████] 100% (50/50) - completed
✅ Job completed successfully
   Total results: 50
   Duration: 12s

📥 Step 4: Fetching results...
✅ Fetched 10 prospects
   Total available: 50
   Pages: 5

📋 Sample prospects:

   1. John Doe
      Title: CEO
      Company: Tech Startup Inc
      Location: San Francisco, CA
      LinkedIn: https://linkedin.com/in/johndoe

🎉 All tests passed!
==========================================
```

### Manual Testing

1. **Create job:**
   ```bash
   curl -X POST http://localhost:3000/api/linkedin/search/create-job \
     -H "Content-Type: application/json" \
     -d '{
       "search_criteria": {
         "category": "people",
         "keywords": "CEO tech",
         "location": ["103644278"],
         "title": "CEO"
       },
       "target_count": 50
     }'
   ```

2. **Monitor progress:**
   ```bash
   curl "http://localhost:3000/api/linkedin/search/create-job?job_id=YOUR_JOB_ID"
   ```

3. **Fetch results:**
   ```bash
   curl "http://localhost:3000/api/linkedin/search/results?job_id=YOUR_JOB_ID&page=1"
   ```

## Frontend Integration

### Subscribe to Realtime Updates

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Subscribe to job updates
const subscription = supabase
  .channel('prospect-search-updates')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'prospect_search_jobs',
      filter: `id=eq.${jobId}`
    },
    (payload) => {
      const { progress_current, progress_total, status } = payload.new;

      // Update UI
      setProgress({
        current: progress_current,
        total: progress_total,
        percentage: Math.round((progress_current / progress_total) * 100)
      });

      if (status === 'completed') {
        // Fetch results
        fetchResults(jobId);
      }
    }
  )
  .subscribe();
```

### Create Job + Monitor

```typescript
async function startSearch(criteria: any) {
  // Create job
  const response = await fetch('/api/linkedin/search/create-job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      search_criteria: criteria,
      target_count: 1000
    })
  });

  const { job_id } = await response.json();

  // Subscribe to updates
  subscribeToJob(job_id);
}
```

## Performance Characteristics

| Prospect Count | Pages | Est. Time | API Used |
|----------------|-------|-----------|----------|
| 50 | 1 | 3-5s | Classic/Sales Nav |
| 100 | 1-2 | 5-10s | Sales Nav |
| 500 | 5 | 25-40s | Sales Nav |
| 1000 | 10 | 50-80s | Sales Nav |
| 2500 | 25 | 2-3 min | Recruiter/Sales Nav |

**Notes:**
- Classic LinkedIn: Max 1,000 results (50 per page)
- Sales Navigator: Max 2,500 results (100 per page)
- Recruiter: Max 2,500 results (100 per page)
- Rate limiting: 2-second delay between pages

## Error Handling

### Job Statuses

- **queued**: Job created, waiting for background function
- **processing**: Background function executing
- **completed**: All prospects fetched successfully
- **failed**: Error occurred, check `error_message`

### Common Errors

1. **"No active LinkedIn account found"**
   - User needs to connect LinkedIn in Settings
   - Check `user_unipile_accounts` table

2. **"Unipile API error: 401"**
   - Invalid API key or DSN
   - Check environment variables

3. **"Job timeout"**
   - Background function exceeded 15 minutes
   - Reduce target_count or split into multiple jobs

## Next Steps

1. ✅ Database schema created
2. ✅ Background function implemented
3. ✅ API routes created
4. ✅ Test script working
5. ⏳ Frontend integration with DataCollectionHub
6. ⏳ Supabase Realtime progress bar
7. ⏳ Results display in approval modal
8. ⏳ Production deployment

## Files Created

```
/supabase/migrations/20251010000001_create_prospect_search_jobs.sql
/netlify/functions/process-linkedin-search-background.ts
/app/api/linkedin/search/create-job/route.ts
/app/api/linkedin/search/results/route.ts
/app/api/admin/setup-search-jobs-tables/route.ts
/scripts/test-background-search.js
/docs/BACKGROUND_SEARCH_JOBS_SYSTEM.md
```
