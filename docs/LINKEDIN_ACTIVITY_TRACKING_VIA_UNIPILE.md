# LinkedIn Activity Tracking via Unipile API

**Date:** November 15, 2025
**Status:** Research Complete - Ready for Implementation
**Priority:** Medium (After core messaging fixes)
**Effort:** 3-5 days

---

## 🎯 Business Goal

**Filter prospects by LinkedIn activity level to improve campaign performance:**
- Only engage with active prospects (posted in last 30 days)
- Higher response rates from prospects who are actively building their brand
- Commenting Agent warm-up works better on active users
- Replicate Sales Navigator's "Posted on LinkedIn" filter

**Expected Impact:**
- 2-3x higher connection acceptance rate
- Better ROI on commenting campaigns
- Reduced wasted effort on inactive profiles

---

## 📚 Unipile API Endpoints Discovered

### User Activity Endpoints

#### 1. Get User Posts
**Endpoint:** `GET https://{subdomain}.unipile.com:{port}/api/v1/users/{identifier}/posts`

**Purpose:** List all posts written by a user

**Use Case:** Determine when someone last posted on LinkedIn

**Expected Data (needs testing):**
```json
{
  "posts": [
    {
      "id": "post_123",
      "author": {...},
      "content": "...",
      "created_at": "2025-11-10T14:30:00Z",  // ← KEY: Last post date!
      "published_at": "2025-11-10T14:30:00Z",
      "engagement": {
        "likes": 45,
        "comments": 12,
        "shares": 3
      }
    }
  ]
}
```

**Status:** ⚠️ Needs testing to confirm timestamp field names

**Documentation:** https://developer.unipile.com/reference/userscontroller_listallposts

---

#### 2. Get User Comments
**Endpoint:** `GET https://{subdomain}.unipile.com:{port}/api/v1/users/{identifier}/comments`

**Purpose:** List all comments written by a user

**Use Case:** Track comment activity (engagement indicator)

**Expected Data (needs testing):**
```json
{
  "comments": [
    {
      "id": "comment_456",
      "post_id": "post_789",
      "content": "Great insights!",
      "created_at": "2025-11-12T10:15:00Z",  // ← Comment timestamp
      "author": {...}
    }
  ]
}
```

**Status:** ⚠️ Needs testing

**Documentation:** https://developer.unipile.com/reference/userscontroller_listallcomments

---

#### 3. Get User Reactions
**Endpoint:** `GET https://{subdomain}.unipile.com:{port}/api/v1/users/{identifier}/reactions`

**Purpose:** List all reactions (likes) from a user

**Use Case:** Passive engagement indicator

**Expected Data (needs testing):**
```json
{
  "reactions": [
    {
      "id": "reaction_321",
      "post_id": "post_654",
      "reaction_type": "like",
      "created_at": "2025-11-14T09:00:00Z"  // ← Reaction timestamp
    }
  ]
}
```

**Status:** ⚠️ Needs testing

**Documentation:** https://developer.unipile.com/reference/userscontroller_listallreactions

---

#### 4. Get User Profile
**Endpoint:** `GET https://{subdomain}.unipile.com:{port}/api/v1/users/{identifier}`

**Purpose:** Retrieve full LinkedIn profile

**Use Case:** Check if profile metadata includes activity indicators

**Expected Data (needs testing):**
```json
{
  "id": "user_123",
  "name": "John Smith",
  "headline": "CEO @ HealthTech",
  "location": "San Francisco",
  "activity_status": "active",  // ← May include activity data?
  "last_activity": "2025-11-14T12:00:00Z",  // ← May exist?
  "post_count": 45,  // ← May exist?
  "engagement_score": 8.5  // ← May exist?
}
```

**Status:** ⚠️ Needs testing - may not include activity data

**Documentation:** https://developer.unipile.com/reference/userscontroller_getprofilebyidentifier

---

### Post Detail Endpoints

#### 5. Get Post Details
**Endpoint:** `GET https://{subdomain}.unipile.com:{port}/api/v1/posts/{post_id}`

**Purpose:** Retrieve details of a specific post

**Use Case:** Verify post timestamps, engagement metrics

**Documentation:** https://developer.unipile.com/reference/postscontroller_getpost

---

#### 6. Create Comment on Post
**Endpoint:** `POST https://{subdomain}.unipile.com:{port}/api/v1/posts/{post_id}/comments`

**Purpose:** Comment on a post or reply to a comment

**Use Case:** ✅ **Already used by Commenting Agent!**

**Documentation:** https://developer.unipile.com/reference/postscontroller_sendcomment

---

#### 7. List Post Comments
**Endpoint:** `GET https://{subdomain}.unipile.com:{port}/api/v1/posts/{post_id}/comments`

**Purpose:** List all comments on a post

**Use Case:** Track engagement on monitored posts

**Documentation:** https://developer.unipile.com/reference/postscontroller_listallcomments

---

#### 8. List Post Reactions
**Endpoint:** `GET https://{subdomain}.unipile.com:{port}/api/v1/posts/{post_id}/reactions`

**Purpose:** List all reactions (likes) on a post

**Use Case:** Track who engaged with a post

**Documentation:** https://developer.unipile.com/reference/postscontroller_listallreactions

---

#### 9. Add Reaction to Post
**Endpoint:** `POST https://{subdomain}.unipile.com:{port}/api/v1/posts/{post_id}/reactions`

**Purpose:** Like/react to a post

**Use Case:** Automated engagement (future feature)

**Documentation:** https://developer.unipile.com/reference/postscontroller_addpostreaction

---

### Sales Navigator Search

#### 10. LinkedIn Search (Sales Navigator)
**Endpoint:** `POST https://{subdomain}.unipile.com:{port}/api/v1/linkedin/search`

**Purpose:** Search LinkedIn using Sales Navigator

**Confirmed Filters:**
```json
{
  "api": "sales_navigator",
  "category": "people",
  "keywords": "healthcare CEO",
  "company": ["include": ["HealthTech Inc"]],
  "tenure": [{"min": 3}],
  "profile_language": ["en"],
  "location": [...],
  "industry": [...],
  "seniority": [...],
  "network_distance": [1, 2]
}
```

**UNKNOWN - Needs Testing:**
```json
{
  // Option 1: Direct filter (Sales Nav UI has this)
  "posted_on_linkedin": "past_30_days",

  // Option 2: Activity flag
  "recent_activity": true,

  // Option 3: Activity level
  "activity_level": "active",

  // Option 4: Date range
  "last_post_date": {
    "gte": "2025-10-15"
  }
}
```

**Status:** ⚠️ **CRITICAL TO TEST** - If this works, it's the best solution!

**Documentation:** https://developer.unipile.com/docs/linkedin-search

---

## 🧪 Test Scripts

### Test Script 1: Check User Posts Data Structure

**Purpose:** Verify what data `/users/{id}/posts` returns

```javascript
// File: scripts/test-unipile-activity.js

const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com';
const UNIPILE_PORT = process.env.UNIPILE_PORT || '13670';

async function testUserPosts() {
  // Test with your own LinkedIn profile ID first
  const TEST_USER_ID = 'YOUR_LINKEDIN_USER_ID'; // Or LinkedIn URL

  const url = `https://${UNIPILE_DSN}:${UNIPILE_PORT}/api/v1/users/${TEST_USER_ID}/posts`;

  console.log(`🔍 Testing: ${url}`);

  const response = await fetch(url, {
    headers: {
      'X-API-KEY': UNIPILE_API_KEY
    }
  });

  if (!response.ok) {
    console.error('❌ Error:', response.status, response.statusText);
    const error = await response.text();
    console.error('Error details:', error);
    return;
  }

  const data = await response.json();

  console.log('✅ Success! Response structure:');
  console.log(JSON.stringify(data, null, 2));

  // Check for timestamp fields
  if (data.posts && data.posts.length > 0) {
    const firstPost = data.posts[0];
    console.log('\n📊 First post fields:');
    console.log('Keys:', Object.keys(firstPost));

    // Look for date fields
    const dateFields = Object.keys(firstPost).filter(key =>
      key.includes('date') ||
      key.includes('time') ||
      key.includes('created') ||
      key.includes('published')
    );

    console.log('\n📅 Date-related fields found:', dateFields);

    if (dateFields.length > 0) {
      console.log('✅ GOOD NEWS: We can track post dates!');
      dateFields.forEach(field => {
        console.log(`  - ${field}: ${firstPost[field]}`);
      });
    } else {
      console.log('⚠️ WARNING: No obvious date fields found');
    }
  }

  return data;
}

// Run test
testUserPosts().catch(console.error);
```

**How to run:**
```bash
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
node scripts/test-unipile-activity.js
```

---

### Test Script 2: Check Sales Navigator Activity Filter

**Purpose:** Test if Sales Nav search supports activity filters

```javascript
// File: scripts/test-sales-nav-activity-filter.js

async function testSalesNavActivityFilter() {
  const url = `https://${UNIPILE_DSN}:${UNIPILE_PORT}/api/v1/linkedin/search`;

  // Test 1: Try "posted_on_linkedin" filter
  const test1 = {
    api: 'sales_navigator',
    category: 'people',
    keywords: 'CEO healthcare',
    posted_on_linkedin: 'past_30_days'  // ← Does this work?
  };

  console.log('🧪 Test 1: posted_on_linkedin filter');
  console.log('Request:', JSON.stringify(test1, null, 2));

  const response1 = await fetch(url, {
    method: 'POST',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(test1)
  });

  const result1 = await response1.json();

  if (response1.ok && !result1.error) {
    console.log('✅ SUCCESS! Filter worked!');
    console.log('Results:', result1.results?.length || 0, 'prospects');
    console.log('Sample result:', JSON.stringify(result1.results?.[0], null, 2));
    return true;
  } else {
    console.log('❌ Failed:', result1.error || result1.message);
    console.log('Status:', response1.status);
  }

  // Test 2: Try alternative filter names
  const alternativeFilters = [
    { recent_activity: true },
    { activity_level: 'active' },
    { last_active: 'past_30_days' },
    { posted_content: 'recent' }
  ];

  for (const filter of alternativeFilters) {
    console.log(`\n🧪 Testing alternative: ${Object.keys(filter)[0]}`);

    const testRequest = {
      api: 'sales_navigator',
      category: 'people',
      keywords: 'CEO',
      ...filter
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testRequest)
    });

    const result = await response.json();

    if (response.ok && !result.error) {
      console.log('✅ This filter worked!');
      console.log('Results:', result.results?.length || 0);
      return filter;
    } else {
      console.log('❌ Did not work');
    }
  }

  console.log('\n⚠️ CONCLUSION: No activity filter found in Sales Nav search');
  console.log('   → We\'ll need to use Option 2: Enrich via /users/{id}/posts');

  return false;
}

// Run test
testSalesNavActivityFilter().catch(console.error);
```

---

### Test Script 3: Get Available Search Parameters

**Purpose:** See all available Sales Nav search filters

```javascript
// File: scripts/test-sales-nav-parameters.js

async function getSalesNavParameters() {
  const url = `https://${UNIPILE_DSN}:${UNIPILE_PORT}/api/v1/linkedin/search/parameters`;

  console.log('🔍 Fetching available Sales Navigator search parameters...');

  const response = await fetch(url, {
    headers: {
      'X-API-KEY': UNIPILE_API_KEY
    }
  });

  const parameters = await response.json();

  console.log('📋 Available parameters:');
  console.log(JSON.stringify(parameters, null, 2));

  // Look for activity-related parameters
  const activityParams = Object.keys(parameters).filter(key =>
    key.includes('activity') ||
    key.includes('post') ||
    key.includes('recent') ||
    key.includes('active')
  );

  if (activityParams.length > 0) {
    console.log('\n✅ Activity-related parameters found:');
    activityParams.forEach(param => {
      console.log(`  - ${param}:`, parameters[param]);
    });
  } else {
    console.log('\n⚠️ No obvious activity-related parameters found');
  }

  return parameters;
}

// Run test
getSalesNavParameters().catch(console.error);
```

---

## 💡 Implementation Options

### Option 1: Sales Navigator Filter (Best - IF it exists)

**If Unipile supports `posted_on_linkedin` filter:**

**Effort:** 1-2 days
**Pros:**
- ✅ No extra API calls
- ✅ Native filtering
- ✅ Fast, scalable
- ✅ Works with existing search flow

**Cons:**
- ❓ Unknown if it exists

**Implementation:**

```typescript
// Add to: app/api/search/linkedin-unipile/route.ts

export async function POST(request: NextRequest) {
  const {
    search_query,
    filters = {},
    activity_filter = 'all'  // ← NEW: 'all', 'active_30_days', 'very_active'
  } = await request.json();

  const searchParams = {
    api: 'sales_navigator',
    category: 'people',
    keywords: search_query,
    ...filters
  };

  // Add activity filter if requested
  if (activity_filter === 'active_30_days') {
    searchParams.posted_on_linkedin = 'past_30_days';
  } else if (activity_filter === 'very_active') {
    searchParams.posted_on_linkedin = 'past_week';
  }

  const results = await unipileSearch(searchParams);
  return NextResponse.json({ success: true, results });
}
```

**UI Addition:**

```typescript
// Add to prospect import modal
<Select
  label="Activity Level"
  onChange={(e) => setActivityFilter(e.target.value)}
>
  <option value="all">All Prospects</option>
  <option value="active_30_days">Active (posted in last 30 days)</option>
  <option value="very_active">Very Active (posted this week)</option>
</Select>
```

---

### Option 2: Post-Search Enrichment (Fallback)

**If Sales Nav filter doesn't exist:**

**Effort:** 3-4 days
**Pros:**
- ✅ Guaranteed to work
- ✅ Detailed activity data
- ✅ Can track multiple metrics

**Cons:**
- ❌ Extra API calls (rate limits)
- ❌ Slower enrichment
- ❌ More complex

**Database Schema:**

```sql
-- Migration: Add activity tracking columns
ALTER TABLE prospect_approval_data
ADD COLUMN last_post_date TIMESTAMP,
ADD COLUMN last_comment_date TIMESTAMP,
ADD COLUMN last_reaction_date TIMESTAMP,
ADD COLUMN posts_last_30_days INTEGER DEFAULT 0,
ADD COLUMN comments_last_30_days INTEGER DEFAULT 0,
ADD COLUMN activity_level TEXT CHECK (activity_level IN ('very_active', 'active', 'inactive', 'unknown')),
ADD COLUMN activity_enriched_at TIMESTAMP;

-- Index for filtering
CREATE INDEX idx_prospect_activity_level
ON prospect_approval_data(activity_level);

CREATE INDEX idx_prospect_last_post
ON prospect_approval_data(last_post_date DESC);

-- View for active prospects
CREATE VIEW active_prospects AS
SELECT *
FROM prospect_approval_data
WHERE activity_level IN ('active', 'very_active')
  AND last_post_date > NOW() - INTERVAL '30 days';
```

**Enrichment Function:**

```typescript
// File: app/lib/prospect-activity-enrichment.ts

interface ActivityData {
  last_post_date: Date | null;
  last_comment_date: Date | null;
  last_reaction_date: Date | null;
  posts_last_30_days: number;
  comments_last_30_days: number;
  activity_level: 'very_active' | 'active' | 'inactive' | 'unknown';
}

export async function enrichProspectActivity(
  linkedinUrl: string
): Promise<ActivityData> {
  const userId = extractLinkedInIdentifier(linkedinUrl);

  if (!userId) {
    return {
      last_post_date: null,
      last_comment_date: null,
      last_reaction_date: null,
      posts_last_30_days: 0,
      comments_last_30_days: 0,
      activity_level: 'unknown'
    };
  }

  try {
    // Fetch user's posts
    const posts = await unipileAPI.get(`/users/${userId}/posts`);

    // Fetch user's comments
    const comments = await unipileAPI.get(`/users/${userId}/comments`);

    // Calculate activity metrics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Sort posts by date
    const sortedPosts = posts.sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    );

    const sortedComments = comments.sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    );

    // Count recent activity
    const postsLast30Days = sortedPosts.filter(p =>
      new Date(p.created_at) > thirtyDaysAgo
    ).length;

    const commentsLast30Days = sortedComments.filter(c =>
      new Date(c.created_at) > thirtyDaysAgo
    ).length;

    // Determine activity level
    const totalActivity = postsLast30Days + commentsLast30Days;

    let activityLevel: ActivityData['activity_level'];
    if (totalActivity >= 5) {
      activityLevel = 'very_active';  // 5+ posts/comments in 30 days
    } else if (totalActivity >= 1) {
      activityLevel = 'active';  // At least 1 post/comment in 30 days
    } else {
      activityLevel = 'inactive';  // No activity in 30 days
    }

    return {
      last_post_date: sortedPosts[0]?.created_at || null,
      last_comment_date: sortedComments[0]?.created_at || null,
      last_reaction_date: null,  // Optional: fetch reactions too
      posts_last_30_days: postsLast30Days,
      comments_last_30_days: commentsLast30Days,
      activity_level: activityLevel
    };

  } catch (error) {
    console.error('Error enriching prospect activity:', error);
    return {
      last_post_date: null,
      last_comment_date: null,
      last_reaction_date: null,
      posts_last_30_days: 0,
      comments_last_30_days: 0,
      activity_level: 'unknown'
    };
  }
}

// Helper function
function extractLinkedInIdentifier(url: string): string | null {
  // linkedin.com/in/john-smith → john-smith
  const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
  return match ? match[1] : null;
}
```

**API Endpoint:**

```typescript
// File: app/api/prospects/enrich-activity/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { enrichProspectActivity } from '@/lib/prospect-activity-enrichment';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

export async function POST(request: NextRequest) {
  const { prospect_ids, workspace_id } = await request.json();

  const supabase = await createSupabaseRouteClient();

  // Get prospects to enrich
  const { data: prospects, error } = await supabase
    .from('prospect_approval_data')
    .select('id, contact')
    .in('id', prospect_ids);

  if (error || !prospects) {
    return NextResponse.json({ error: 'Failed to fetch prospects' }, { status: 500 });
  }

  // Enrich each prospect
  const enrichmentResults = [];

  for (const prospect of prospects) {
    const linkedinUrl = prospect.contact?.linkedin_url;

    if (!linkedinUrl) {
      enrichmentResults.push({
        prospect_id: prospect.id,
        success: false,
        reason: 'No LinkedIn URL'
      });
      continue;
    }

    try {
      const activityData = await enrichProspectActivity(linkedinUrl);

      // Update prospect in database
      await supabase
        .from('prospect_approval_data')
        .update({
          last_post_date: activityData.last_post_date,
          last_comment_date: activityData.last_comment_date,
          posts_last_30_days: activityData.posts_last_30_days,
          comments_last_30_days: activityData.comments_last_30_days,
          activity_level: activityData.activity_level,
          activity_enriched_at: new Date().toISOString()
        })
        .eq('id', prospect.id);

      enrichmentResults.push({
        prospect_id: prospect.id,
        success: true,
        activity_data: activityData
      });

    } catch (error) {
      enrichmentResults.push({
        prospect_id: prospect.id,
        success: false,
        reason: error.message
      });
    }
  }

  return NextResponse.json({
    success: true,
    enriched: enrichmentResults.filter(r => r.success).length,
    failed: enrichmentResults.filter(r => !r.success).length,
    results: enrichmentResults
  });
}
```

**UI Integration:**

```typescript
// File: app/components/ProspectImportModal.tsx

import { useState } from 'react';

export function ProspectImportModal({ workspaceId, onImport, onClose }) {
  const [activityFilter, setActivityFilter] = useState<'all' | 'active' | 'very_active'>('all');
  const [enriching, setEnriching] = useState(false);

  // Fetch prospects
  const { data: prospects } = useQuery({
    queryKey: ['approved-prospects', workspaceId, activityFilter],
    queryFn: async () => {
      let query = supabase
        .from('prospect_approval_data')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('approval_status', 'approved');

      // Filter by activity level
      if (activityFilter !== 'all') {
        query = query.eq('activity_level', activityFilter);
      }

      const { data } = await query;
      return data || [];
    }
  });

  // Enrich activity data
  const handleEnrichActivity = async () => {
    setEnriching(true);

    const prospectIds = prospects.map(p => p.id);

    const response = await fetch('/api/prospects/enrich-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prospect_ids: prospectIds,
        workspace_id: workspaceId
      })
    });

    const result = await response.json();

    toast.success(`Enriched ${result.enriched} prospects!`);
    setEnriching(false);

    // Refetch with updated data
    queryClient.invalidateQueries(['approved-prospects']);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Prospects for Commenting</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Activity Filter */}
          <div className="flex items-center gap-4">
            <Select value={activityFilter} onValueChange={setActivityFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Prospects</SelectItem>
                <SelectItem value="active">
                  Active (posted in last 30 days)
                </SelectItem>
                <SelectItem value="very_active">
                  Very Active (5+ posts/month)
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={handleEnrichActivity}
              disabled={enriching}
            >
              {enriching ? 'Enriching...' : 'Update Activity Data'}
            </Button>
          </div>

          {/* Prospect List */}
          <div className="max-h-96 overflow-y-auto">
            {prospects?.map(prospect => (
              <div key={prospect.id} className="flex items-center gap-4 p-3 border rounded">
                <input
                  type="checkbox"
                  checked={selected.has(prospect.id)}
                  onChange={() => toggleSelect(prospect.id)}
                />

                <div className="flex-1">
                  <div className="font-medium">{prospect.name}</div>
                  <div className="text-sm text-gray-500">
                    {prospect.title} @ {prospect.company?.name}
                  </div>
                </div>

                {/* Activity Indicator */}
                {prospect.activity_level && (
                  <div className="flex items-center gap-2">
                    {prospect.activity_level === 'very_active' && (
                      <Badge className="bg-green-500">
                        🟢 Very Active ({prospect.posts_last_30_days} posts)
                      </Badge>
                    )}
                    {prospect.activity_level === 'active' && (
                      <Badge className="bg-blue-500">
                        🔵 Active
                      </Badge>
                    )}
                    {prospect.activity_level === 'inactive' && (
                      <Badge className="bg-gray-500">
                        ⚫ Inactive
                      </Badge>
                    )}
                    {prospect.last_post_date && (
                      <span className="text-xs text-gray-400">
                        Last post: {formatDistanceToNow(new Date(prospect.last_post_date))} ago
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleImport}>
            Import {selected.size} Prospects
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

### Option 3: Commenting Agent Auto-Tracking (Future)

**Leverage Commenting Agent to auto-update activity:**

**How it works:**
1. Commenting Agent discovers post
2. N8N webhook receives post data
3. Auto-update prospect activity in database
4. No extra API calls needed

**Effort:** 2-3 days (after Commenting Agent is working)

**Pros:**
- ✅ Free activity tracking
- ✅ Real-time updates
- ✅ No extra API calls

**Cons:**
- ❌ Only works for monitored profiles
- ❌ Requires active Commenting campaigns

---

## 🎯 Recommended Approach

### Phase 1: Test (This week - 2 hours)
1. Run Test Script 1 → Check if `/users/{id}/posts` returns timestamps
2. Run Test Script 2 → Check if Sales Nav has activity filter
3. Run Test Script 3 → See all available parameters

### Phase 2: Quick Win (Next week - 1-2 days)
**If Sales Nav filter exists:**
- Implement Option 1 (Sales Nav filter)
- Add UI filter dropdown
- Ship it!

**If Sales Nav filter doesn't exist:**
- Implement manual activity flag
- Add "Enrich Activity" button
- Show activity indicators

### Phase 3: Full Solution (Week 2-3 - 3-4 days)
- Implement Option 2 (Post-search enrichment)
- Database schema updates
- Background enrichment jobs
- Activity-based filtering

### Phase 4: Automation (Month 2 - 2-3 days)
- Integrate with Commenting Agent
- Auto-update activity on post discovery
- Remove manual enrichment need

---

## 📋 Next Steps (When Ready to Implement)

### Immediate:
- [ ] Run Test Script 1: Check post data structure
- [ ] Run Test Script 2: Test Sales Nav activity filter
- [ ] Run Test Script 3: Get available parameters
- [ ] Document findings in this file

### Week 1:
- [ ] Decide: Option 1 or Option 2 based on test results
- [ ] Create database migration (if Option 2)
- [ ] Build enrichment function (if Option 2)
- [ ] Add UI filters to prospect import modal

### Week 2:
- [ ] Add "Update Activity" button
- [ ] Test with 10-20 prospects
- [ ] Measure impact on campaign performance
- [ ] Document best practices

### Future:
- [ ] Integrate with Commenting Agent (auto-tracking)
- [ ] Analytics: Compare active vs inactive prospect performance
- [ ] Smart recommendations: "10 prospects posted this week - great time to engage!"

---

## 🔑 Environment Variables Needed

```bash
# .env.local
UNIPILE_API_KEY=your_api_key_here
UNIPILE_DSN=api6.unipile.com
UNIPILE_PORT=13670
```

---

## 📊 Success Metrics

**Short-term (Week 1-2):**
- Successfully retrieve post timestamps via API
- Filter prospects by activity level
- 50%+ of imported prospects are "active"

**Medium-term (Month 1):**
- 2x higher connection acceptance from active prospects
- Users regularly use activity filter
- Reduced wasted effort on inactive profiles

**Long-term (Month 2-3):**
- Automated activity tracking via Commenting Agent
- Clear ROI data: Active vs Inactive prospect performance
- Feature becomes core part of warm-up strategy

---

## ⚠️ Important Notes

1. **Rate Limits:** Unipile API has rate limits - enriching 100s of prospects may take time
2. **Data Freshness:** Activity data gets stale - re-enrich periodically
3. **Privacy:** Only enrich prospects who have public profiles
4. **Sales Nav Required:** Some features may require Sales Navigator subscription
5. **Testing Required:** All timestamp field names need verification

---

## 📚 Related Documentation

- **Commenting Agent Integration:** `docs/COMMENTING_AGENT_INTEGRATION.md`
- **Campaign Consolidation:** `docs/CAMPAIGN_UX_CONSOLIDATION_PROPOSAL.md`
- **Unipile LinkedIn Search:** https://developer.unipile.com/docs/linkedin-search
- **Sales Navigator Filters:** Check your Sales Nav UI for available filters

---

**Status:** Documented - Ready to implement after core messaging fixes complete
**Priority:** Medium (High value but not blocking)
**Owner:** To be assigned
**Last Updated:** November 15, 2025
