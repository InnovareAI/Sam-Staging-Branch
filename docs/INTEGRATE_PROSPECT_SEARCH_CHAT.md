# Integrating ProspectSearchChat into DataCollectionHub

## Component Overview

**ProspectSearchChat** is a lightweight chat interface specifically for prospect searches in the Data Approval modal.

### Features:
- ✅ Conversational search interface
- ✅ Triggers background search jobs
- ✅ Real-time progress updates via Supabase Realtime
- ✅ Auto-fetches results when complete
- ✅ Simple intent parsing (can be enhanced with LLM later)

## Integration Steps

### 1. Add to DataCollectionHub

**File:** `components/DataCollectionHub.tsx`

```typescript
import ProspectSearchChat from '@/components/ProspectSearchChat';

// Inside DataCollectionHub component:
const [searchJobId, setSearchJobId] = useState<string | null>(null);
const [searchProspects, setSearchProspects] = useState<any[]>([]);

// Add handlers
const handleSearchTriggered = (jobId: string, criteria: any) => {
  console.log('Search job started:', jobId, criteria);
  setSearchJobId(jobId);
};

const handleProspectsReceived = (prospects: any[]) => {
  console.log('Prospects received:', prospects.length);
  setSearchProspects(prospects);
  setProspectData(prospects); // Populate existing approval UI
  setShowApprovalPanel(true);
  setActiveTab('approve');
};

// In the render:
<div className="grid grid-cols-12 gap-4 h-full">
  {/* Left: Chat Interface (4 columns) */}
  <div className="col-span-4 h-full">
    <ProspectSearchChat
      onSearchTriggered={handleSearchTriggered}
      onProspectsReceived={handleProspectsReceived}
    />
  </div>

  {/* Right: Results & Approval (8 columns) */}
  <div className="col-span-8 h-full">
    {/* Your existing prospect display/approval UI */}
    {searchProspects.length > 0 ? (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">
          Found {searchProspects.length} Prospects
        </h3>
        {/* Render prospects */}
      </div>
    ) : (
      <div className="flex items-center justify-center h-full text-gray-400">
        Start a search using the chat →
      </div>
    )}
  </div>
</div>
```

### 2. Update Layout for Split View

```typescript
// In DataCollectionHub, modify the container:
<div className="h-[calc(100vh-200px)] overflow-hidden">
  <div className="grid grid-cols-12 gap-4 h-full">
    {/* Chat */}
    <div className="col-span-4">
      <ProspectSearchChat ... />
    </div>

    {/* Results */}
    <div className="col-span-8 overflow-y-auto">
      {/* Existing approval UI */}
    </div>
  </div>
</div>
```

## Example Usage Flow

```
User in chat: "Find 500 CEOs at tech startups in California"
               ↓
Chat parses intent → {
  category: 'people',
  title: 'CEO',
  keywords: 'tech startups',
  location: ['103644278'], // California
  targetCount: 500
}
               ↓
Creates background job via /api/linkedin/search/create-job
               ↓
Shows progress: "⏳ Searching... 125/500 (25%)"
               ↓
When complete: Fetches results → Populates right panel
               ↓
User reviews/approves prospects
```

## Future Enhancements

- [ ] LLM-powered intent parsing
- [ ] Search history
- [ ] Saved search templates
- [ ] Multi-criteria refinement
- [ ] Export results to CSV
