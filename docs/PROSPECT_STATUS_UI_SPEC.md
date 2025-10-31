# Prospect Status UI Specification

**Feature:** Campaign Prospect Status Dashboard
**Priority:** High
**Status:** Specification
**Date:** October 31, 2025

---

## Overview

Add a UI component that shows detailed prospect status for each campaign, allowing users/admins to see:
- Who received connection requests (CR)
- Who is queued (waiting to send)
- Who replied
- Who connected
- Timeline of messages

---

## User Stories

### As a Campaign Manager
- I want to see which prospects have been contacted
- I want to know which prospects are still in the queue
- I want to see response rates at a glance
- I want to filter prospects by status

### As an Admin
- I want to see all campaigns' prospect statuses
- I want to monitor queue health
- I want to identify stuck prospects
- I want to manually update prospect statuses if needed

---

## Proposed UI Layout

### 1. Campaign Details Page Enhancement

**Location:** `/workspace/[workspaceId]/campaigns/[campaignId]`

**New Tab:** "Prospects" (add to existing tabs)

```
+----------------------------------------------------------+
| Campaign: 20251030-IAI-Outreach Campaign                |
| [Overview] [Messages] [Prospects] [Analytics]           |
+----------------------------------------------------------+
|                                                          |
| Prospect Status Summary                                  |
| +------------------------------------------------------+ |
| | 📊 Total: 3   ✅ Sent: 1   ⏳ Queued: 2   💬 Replied: 0| |
| +------------------------------------------------------+ |
|                                                          |
| Filters: [All ▼] [Status ▼] [Date ▼]     [🔍 Search]   |
|                                                          |
| +------------------------------------------------------+ |
| | Name              | Status          | Contacted  | CR | |
| +------------------------------------------------------+ |
| | ✅ Brian Lee      | Contacted       | Oct 30 1pm | ✓  | |
| | ⏳ Matt Zuvella   | Queued (2h)     | Pending    | ⏳ | |
| | ⏳ Aliya Jasrai   | Queued (2h 2m)  | Pending    | ⏳ | |
| +------------------------------------------------------+ |
|                                                          |
| [< Previous] [Page 1 of 1] [Next >]                     |
+----------------------------------------------------------+
```

---

## Data Structure

### Status Values to Display

```typescript
type ProspectStatus =
  | 'pending'           // ⚪ Not yet queued
  | 'approved'          // 🟡 Ready to queue
  | 'ready_to_message'  // 🟢 Ready to send
  | 'queued_in_n8n'     // ⏳ In queue (processing)
  | 'connection_requested' // ✅ CR sent
  | 'contacted'         // ✅ Legacy sent
  | 'connected'         // 🤝 Connection accepted
  | 'replied'           // 💬 Prospect replied
  | 'engaged'           // 🎯 Active conversation
  | 'not_interested'    // ❌ Declined/uninterested
  | 'bounced'           // ⚠️ Failed to send
  | 'failed';           // ❌ Error occurred
```

### Display Icons & Colors

```typescript
const statusConfig = {
  'pending': { icon: '⚪', color: 'gray', label: 'Pending' },
  'approved': { icon: '🟡', color: 'yellow', label: 'Approved' },
  'ready_to_message': { icon: '🟢', color: 'green', label: 'Ready' },
  'queued_in_n8n': { icon: '⏳', color: 'blue', label: 'Queued' },
  'connection_requested': { icon: '✅', color: 'green', label: 'CR Sent' },
  'contacted': { icon: '✅', color: 'green', label: 'Contacted' },
  'connected': { icon: '🤝', color: 'purple', label: 'Connected' },
  'replied': { icon: '💬', color: 'purple', label: 'Replied' },
  'engaged': { icon: '🎯', color: 'purple', label: 'Engaged' },
  'not_interested': { icon: '❌', color: 'red', label: 'Not Interested' },
  'bounced': { icon: '⚠️', color: 'orange', label: 'Bounced' },
  'failed': { icon: '❌', color: 'red', label: 'Failed' }
};
```

---

## Component Specification

### File: `/app/components/CampaignProspectStatus.tsx`

```typescript
'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface CampaignProspectStatusProps {
  campaignId: string;
  workspaceId: string;
}

export default function CampaignProspectStatus({
  campaignId,
  workspaceId
}: CampaignProspectStatusProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch prospects
  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ['campaign-prospects', campaignId, statusFilter],
    queryFn: async () => {
      const supabase = createClientComponentClient();

      let query = supabase
        .from('campaign_prospects')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('contacted_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    }
  });

  // Calculate summary stats
  const stats = {
    total: prospects.length,
    sent: prospects.filter(p =>
      ['connection_requested', 'contacted', 'connected', 'replied'].includes(p.status)
    ).length,
    queued: prospects.filter(p => p.status === 'queued_in_n8n').length,
    replied: prospects.filter(p => p.status === 'replied').length
  };

  // Filter by search
  const filteredProspects = prospects.filter(p =>
    searchQuery === '' ||
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.linkedin_url?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-sm text-gray-400">Total Prospects</div>
        </div>
        <div className="bg-green-900/20 p-4 rounded-lg border border-green-800">
          <div className="text-2xl font-bold text-green-400">{stats.sent}</div>
          <div className="text-sm text-gray-400">CR Sent</div>
        </div>
        <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-800">
          <div className="text-2xl font-bold text-blue-400">{stats.queued}</div>
          <div className="text-sm text-gray-400">Queued</div>
        </div>
        <div className="bg-purple-900/20 p-4 rounded-lg border border-purple-800">
          <div className="text-2xl font-bold text-purple-400">{stats.replied}</div>
          <div className="text-sm text-gray-400">Replied</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="queued_in_n8n">⏳ Queued</SelectItem>
            <SelectItem value="connection_requested">✅ CR Sent</SelectItem>
            <SelectItem value="contacted">✅ Contacted</SelectItem>
            <SelectItem value="connected">🤝 Connected</SelectItem>
            <SelectItem value="replied">💬 Replied</SelectItem>
            <SelectItem value="failed">❌ Failed</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Search by name or LinkedIn URL..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
      </div>

      {/* Prospects Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>LinkedIn</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Contacted At</TableHead>
              <TableHead>Queue Time</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProspects.map((prospect) => {
              const queuedAt = prospect.personalization_data?.queued_at;
              const delayMinutes = prospect.personalization_data?.send_delay_minutes;
              const estimatedSend = queuedAt && delayMinutes
                ? new Date(new Date(queuedAt).getTime() + delayMinutes * 60000)
                : null;

              return (
                <TableRow key={prospect.id}>
                  <TableCell className="font-medium">
                    {prospect.first_name} {prospect.last_name}
                  </TableCell>
                  <TableCell>
                    {prospect.linkedin_url ? (
                      <a
                        href={prospect.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        View Profile →
                      </a>
                    ) : (
                      <span className="text-gray-500">No URL</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        prospect.status === 'queued_in_n8n' ? 'secondary' :
                        prospect.status === 'connection_requested' || prospect.status === 'contacted' ? 'default' :
                        prospect.status === 'replied' ? 'success' :
                        'destructive'
                      }
                    >
                      {getStatusDisplay(prospect.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {prospect.contacted_at
                      ? new Date(prospect.contacted_at).toLocaleString()
                      : <span className="text-gray-500">Pending</span>
                    }
                  </TableCell>
                  <TableCell>
                    {prospect.status === 'queued_in_n8n' && estimatedSend ? (
                      <div className="text-sm">
                        <div className="text-gray-400">
                          Est: {estimatedSend.toLocaleTimeString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          ({delayMinutes}min delay)
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(`/workspace/${workspaceId}/prospects/${prospect.id}`, '_blank')}
                    >
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {filteredProspects.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No prospects found matching your filters
        </div>
      )}
    </div>
  );
}

function getStatusDisplay(status: string): string {
  const displays: Record<string, string> = {
    'pending': '⚪ Pending',
    'approved': '🟡 Approved',
    'ready_to_message': '🟢 Ready',
    'queued_in_n8n': '⏳ Queued',
    'connection_requested': '✅ CR Sent',
    'contacted': '✅ Contacted',
    'connected': '🤝 Connected',
    'replied': '💬 Replied',
    'engaged': '🎯 Engaged',
    'not_interested': '❌ Not Interested',
    'bounced': '⚠️ Bounced',
    'failed': '❌ Failed'
  };

  return displays[status] || status;
}
```

---

## API Requirements

### Endpoint: `GET /api/campaigns/[campaignId]/prospects`

**Response:**
```typescript
{
  success: true,
  prospects: [
    {
      id: 'uuid',
      campaign_id: 'uuid',
      first_name: 'Matt',
      last_name: 'Zuvella',
      linkedin_url: 'https://linkedin.com/in/mattzuvella',
      status: 'queued_in_n8n',
      contacted_at: null,
      personalization_data: {
        queued_at: '2025-10-31T04:10:43.278Z',
        send_delay_minutes: 117,
        pattern_index: 0,
        n8n_execution_id: '234710'
      },
      created_at: '2025-10-30T10:00:00Z'
    }
  ],
  stats: {
    total: 3,
    sent: 1,
    queued: 2,
    replied: 0
  }
}
```

---

## Implementation Steps

### Phase 1: Basic UI (1-2 hours)
1. ✅ Create `CampaignProspectStatus.tsx` component
2. ✅ Add to CampaignHub as new tab
3. ✅ Implement basic table view
4. ✅ Add status badges with icons
5. ✅ Show contacted_at timestamps

### Phase 2: Filtering & Search (1 hour)
6. ✅ Add status filter dropdown
7. ✅ Add search by name/URL
8. ✅ Implement pagination (if >50 prospects)

### Phase 3: Queue Details (1 hour)
9. ✅ Show estimated send time for queued prospects
10. ✅ Show delay minutes and pattern position
11. ✅ Add "Time until send" countdown

### Phase 4: Admin Features (2 hours)
12. ⏭️ Add manual status update (admin only)
13. ⏭️ Add "Re-queue" button for failed prospects
14. ⏭️ Add bulk actions (select multiple, update status)

### Phase 5: Analytics (1 hour)
15. ⏭️ Add timeline view (visual timeline of messages)
16. ⏭️ Add response rate chart
17. ⏭️ Export to CSV functionality

---

## SQL View (Optional Performance Optimization)

```sql
-- Materialized view for faster queries on large campaigns
CREATE MATERIALIZED VIEW campaign_prospects_summary AS
SELECT
  cp.campaign_id,
  cp.status,
  COUNT(*) as count,
  AVG(
    CASE WHEN cp.contacted_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (cp.contacted_at - cp.created_at)) / 3600
    END
  ) as avg_hours_to_contact
FROM campaign_prospects cp
GROUP BY cp.campaign_id, cp.status;

-- Refresh every hour
CREATE OR REPLACE FUNCTION refresh_campaign_prospects_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY campaign_prospects_summary;
END;
$$ LANGUAGE plpgsql;
```

---

## User Permission Requirements

### Campaign Managers (Team Members)
- ✅ View prospects in their campaigns
- ✅ See status and contacted_at
- ❌ Cannot manually update status
- ❌ Cannot re-queue prospects

### Workspace Admins
- ✅ View all campaigns' prospects
- ✅ Manually update prospect status
- ✅ Re-queue failed prospects
- ✅ Export prospect data

### Workspace Owners
- ✅ All admin permissions
- ✅ Delete prospects
- ✅ Bulk operations

---

## Testing Checklist

- [ ] Shows correct count for each status
- [ ] Queue time displays correctly
- [ ] Estimated send time is accurate
- [ ] Status filter works
- [ ] Search works for names and URLs
- [ ] Pagination works (if >50 prospects)
- [ ] LinkedIn URLs open in new tab
- [ ] Real-time updates when status changes
- [ ] Works on mobile (responsive)
- [ ] Performance with 1000+ prospects

---

## Screenshots (Mockup)

```
Campaign: 20251030-IAI-Outreach Campaign
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Status Summary
┌────────────────────────────────────────┐
│ Total: 3  ✅ Sent: 1  ⏳ Queued: 2    │
│ 🤝 Connected: 0  💬 Replied: 0        │
└────────────────────────────────────────┘

Filters: [All Statuses ▼]  [🔍 Search...]

┌──────────────────────────────────────────────────────────┐
│ Name           Status        Contacted    Queue          │
├──────────────────────────────────────────────────────────┤
│ Brian Lee      ✅ Contacted   Oct 30 1pm   -              │
│ Matt Zuvella   ⏳ Queued      Pending     Est: 2:07pm     │
│                                           (117min delay)   │
│ Aliya Jasrai   ⏳ Queued      Pending     Est: 2:09pm     │
│                                           (119min delay)   │
└──────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Approve specification** (review with team)
2. **Assign developer** (estimated 5-6 hours)
3. **Create component** (`CampaignProspectStatus.tsx`)
4. **Add to CampaignHub** (new tab)
5. **Test with real data**
6. **Deploy to staging**
7. **User acceptance testing**
8. **Deploy to production**

---

## Related Documentation

- `docs/CAMPAIGN_QUEUE_MONITORING.md` - Queue monitoring guide
- `docs/LINKEDIN_HUMANIZATION_SUMMARY.md` - Status lifecycle
- `app/components/CampaignHub.tsx` - Existing campaign UI

---

**Estimated Effort:** 5-6 hours
**Priority:** High
**Assigned To:** TBD
**Target Date:** TBD
