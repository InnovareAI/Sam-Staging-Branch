# Bulk Decision-Maker Discovery Feature

## Overview

Allow users to select multiple companies from a list (imported via Sales Nav Company URL) and trigger a bulk discovery of decision-makers at each company.

## User Flow

1. **Import Companies** - User imports companies via Sales Nav Company URL
2. **View Company List** - Companies appear in a new "Companies" view or tab
3. **Select Companies** - User selects one or more companies
4. **Trigger Discovery** - Click "Find Decision-Makers" bulk action
5. **Configure Filters** - Modal asks for job title keywords (e.g., "VP Sales, Director")
6. **Processing** - System searches each company for matching profiles
7. **Results** - Prospects appear in Prospect Database for approval

## Technical Implementation

### Phase 1: Company Storage

- Create `workspace_companies` table
- Store company data from Sales Nav searches
- Link companies to workspace

### Phase 2: UI

- Add "Companies" tab or view in Prospect Database
- Checkbox selection for companies
- "Find Decision-Makers" bulk action button

### Phase 3: Backend

- Extend existing `/api/linkedin/discover-decision-makers` endpoint
- Add batch processing with rate limiting
- Progress tracking via websockets or polling

## API Design

```typescript
// POST /api/linkedin/discover-decision-makers/batch
{
  company_ids: string[],
  persona_filters: {
    title_keywords?: string,
    seniority?: string[]
  },
  prospects_per_company: number
}
```

## Priority: HIGH

This feature enables account-based marketing (ABM) workflows where users:

1. Build a target company list
2. Find relevant contacts at each company
3. Run personalized campaigns
