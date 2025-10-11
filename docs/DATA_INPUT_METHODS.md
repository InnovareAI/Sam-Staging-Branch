# Data Input Methods - Complete Guide

**Last Updated:** October 11, 2025
**Status:** Production
**Version:** data-input-reorganization

---

## Table of Contents

1. [Overview](#overview)
2. [Input Methods](#input-methods)
3. [SAM Chat Input](#sam-chat-input)
4. [Data Approval Input](#data-approval-input)
5. [CSV Upload](#csv-upload)
6. [Copy & Paste](#copy--paste)
7. [LinkedIn URL Search](#linkedin-url-search)
8. [Best Practices](#best-practices)

---

## Overview

SAM AI provides multiple ways to input prospect data, each optimized for different use cases:

### Input Method Summary

| Method | Location | Best For | Supports | Max Records |
|--------|----------|----------|----------|-------------|
| **Natural Language** | SAM Chat | Conversational search | LinkedIn only | 100 |
| **CSV Upload** | Data Approval | Bulk import from files | Any source | Unlimited |
| **Copy & Paste** | Data Approval | Quick data transfer | Spreadsheets, lists | 1000+ |
| **LinkedIn URL** | Data Approval | Direct Sales Nav searches | LinkedIn only | 100 |
| **PDF/Document** | SAM Chat | Knowledge base | Any documents | N/A |

---

## Input Methods

### Architecture Decision

**October 2025 Update:** Data input methods were reorganized for better UX:

```
BEFORE:
┌─────────────────┐
│  SAM Chat       │
│  - CSV Upload   │  ❌ Confusing
│  - PDF Upload   │  ✓ Good for knowledge
│  - Text Input   │  ✓ Good for search
└─────────────────┘

AFTER:
┌─────────────────┐
│  SAM Chat       │
│  - PDF Upload   │  ✓ Knowledge base only
│  - Text Input   │  ✓ Natural language search
└─────────────────┘

┌─────────────────┐
│ Data Approval   │
│  - CSV Upload   │  ✓ Prospect import
│  - Copy/Paste   │  ✓ Quick add
│  - LinkedIn URL │  ✓ Direct search
└─────────────────┘
```

**Rationale:**
- SAM Chat focuses on **conversation** and **knowledge**
- Data Approval focuses on **prospect data** and **campaigns**
- Clear separation of concerns

---

## SAM Chat Input

### Purpose

SAM Chat is designed for:
1. **Natural Language Searches:** "Find 20 CEOs in New York"
2. **Knowledge Base:** Upload PDFs, documents for SAM to learn from
3. **Conversational Assistance:** Ask SAM to help with campaigns, outreach

### Supported File Types

```javascript
// Allowed in SAM Chat
accept=".pdf,.doc,.docx,.txt,.json,.md,.ppt,.pptx"

// NOT allowed
❌ .csv, .xls, .xlsx (use Data Approval instead)
```

### How It Works

**1. Text Input (Natural Language Search):**
```
User: "Find 20 CEOs at tech startups in San Francisco"
SAM: Extracts criteria → Triggers search → Populates Data Approval
```

**2. Document Upload (Knowledge Base):**
```
User: Uploads "company_pitch.pdf"
SAM: Stores in knowledge base → Uses for context in future conversations
```

### File Upload Implementation

**Location:** `/components/ThreadedChatInterface.tsx:1755`

```typescript
<input
  ref={fileInputRef}
  type="file"
  onChange={handleFileSelect}
  accept=".pdf,.doc,.docx,.txt,.json,.md,.ppt,.pptx"
  className="hidden"
/>
```

**Why Not CSV?**
- CSV files are prospect data, not conversational content
- Users expect CSV to import prospects, not add to knowledge
- Caused confusion when CSV went to knowledge base instead of prospects

---

## Data Approval Input

### Purpose

Data Approval tab provides three methods to add prospects:

1. **CSV Upload**: Bulk import from existing files
2. **Copy & Paste**: Quick transfer from spreadsheets/tools
3. **LinkedIn URL**: Direct Sales Navigator/Recruiter searches

### UI Location

**Component:** `/components/DataCollectionHub.tsx:748-820`

```jsx
<div className="border-b border-gray-700 px-6 py-4 bg-gray-850">
  <h3>Add Prospects</h3>
  <div className="grid grid-cols-3 gap-4">
    {/* CSV Upload */}
    {/* Copy/Paste */}
    {/* LinkedIn URL */}
  </div>
</div>
```

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  Add Prospects                                          │
├──────────────┬───────────────────┬──────────────────────┤
│  CSV Upload  │   Copy & Paste    │   LinkedIn URL       │
│  📄          │   📋             │   🔗                 │
│  Choose File │   [Textarea]      │   [URL Input]        │
│  Upload CSV  │   Paste data here │   Paste LinkedIn URL │
│              │   Add Prospects   │   Search LinkedIn    │
└──────────────┴───────────────────┴──────────────────────┘
```

---

## CSV Upload

### Overview

Upload CSV files containing prospect data directly to Data Approval tab.

### Features

- Flexible column mapping (auto-detects common header names)
- Handles quoted values and special characters
- Auto-generates campaign names
- Supports various CSV formats

### Supported Column Headers

The system recognizes multiple variations of column names:

| Data Field | Recognized Headers |
|-----------|-------------------|
| **Name** | name, full name, fullname, full_name |
| **First Name** | first name, firstname, first_name, fname |
| **Last Name** | last name, lastname, last_name, lname |
| **Email** | email, email address, email_address |
| **Job Title** | title, job title, job_title, position |
| **Company** | company, company name, company_name, organization |
| **LinkedIn** | linkedin, linkedin url, linkedin_url, linkedin profile, profile url |
| **Location** | location, city, region, country |

### Example CSV Formats

**Format 1: Full Name**
```csv
Name,Title,Company,Email,LinkedIn
John Doe,CEO,Tech Startup,john@tech.com,linkedin.com/in/johndoe
Jane Smith,CTO,SaaS Co,jane@saas.com,linkedin.com/in/janesmith
```

**Format 2: First/Last Name**
```csv
First Name,Last Name,Job Title,Company Name,Email Address,LinkedIn Profile
John,Doe,CEO,Tech Startup,john@tech.com,linkedin.com/in/johndoe
Jane,Smith,CTO,SaaS Co,jane@saas.com,linkedin.com/in/janesmith
```

**Format 3: Minimal**
```csv
name,title,company
John Doe,CEO,Tech Startup
Jane Smith,CTO,SaaS Co
```

### Implementation

**API Endpoint:** `/api/prospects/parse-csv/route.ts`

**Parse Logic:**
```javascript
// Find column index with flexible matching
const getColumnIndex = (field: string): number => {
  const variations = fieldMap[field] || [field];
  for (const variation of variations) {
    const index = headers.findIndex(h => h.includes(variation));
    if (index !== -1) return index;
  }
  return -1;
};

// Handle quoted CSV values
let currentValue = '';
let inQuotes = false;

for (let j = 0; j < line.length; j++) {
  const char = line[j];
  if (char === '"') {
    inQuotes = !inQuotes;
  } else if (char === ',' && !inQuotes) {
    values.push(currentValue.trim());
    currentValue = '';
  } else {
    currentValue += char;
  }
}
```

### How to Use

1. **Prepare CSV File:**
   - Include at least: Name (or First/Last), Title, Company
   - Optional: Email, LinkedIn URL, Location
   - Save with .csv extension

2. **Upload in Data Approval:**
   - Click "Choose CSV File" button
   - Select your CSV file
   - System auto-parses and displays prospects

3. **Campaign Name:**
   - Auto-generated: `YYYYMMDD-COMPANYCODE-CSV Upload`
   - Example: `20251011-IAI-CSV Upload`
   - Can edit after upload

4. **Review & Approve:**
   - Prospects appear in approval dashboard
   - Review data quality
   - Approve/reject individual prospects
   - Proceed to Campaign Hub

### Error Handling

**Common Issues:**

1. **Empty File**
   ```json
   {
     "success": false,
     "error": "Empty CSV file"
   }
   ```

2. **No Valid Rows**
   ```json
   {
     "success": false,
     "error": "No valid prospect data found"
   }
   ```

3. **Parse Error**
   ```json
   {
     "success": false,
     "error": "Failed to parse CSV: [error details]"
   }
   ```

---

## Copy & Paste

### Overview

Quickly add prospects by pasting data from spreadsheets, Notion, Airtable, or any tabular source.

### Supported Formats

- **Comma-Separated (CSV):** `Name, Title, Company, Email, LinkedIn`
- **Tab-Separated (TSV):** `Name	Title	Company	Email	LinkedIn`
- **Multi-line:** Each line = one prospect

### Example Input

**From Excel/Google Sheets:**
```
John Doe, CEO, Tech Startup, john@tech.com, linkedin.com/in/johndoe
Jane Smith, CTO, SaaS Co, jane@saas.com, linkedin.com/in/janesmith
Bob Johnson, VP Sales, Enterprise Inc, bob@enterprise.com, linkedin.com/in/bobjohnson
```

**From Notion/Airtable (Tab-separated):**
```
John Doe	CEO	Tech Startup	john@tech.com	linkedin.com/in/johndoe
Jane Smith	CTO	SaaS Co	jane@saas.com	linkedin.com/in/janesmith
```

### Field Mapping

Paste data is parsed in order:
1. **Field 1:** Name (required)
2. **Field 2:** Title
3. **Field 3:** Company
4. **Field 4:** Email
5. **Field 5:** LinkedIn URL

**Minimum:** Name + Title (fields 1-2)

### Implementation

**Location:** `/components/DataCollectionHub.tsx:195-248`

```javascript
const handlePasteData = async () => {
  const lines = pasteText.trim().split('\n');
  const newProspects: ProspectData[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    // Try comma-separated first, then tab-separated
    const parts = line.includes('\t')
      ? line.split('\t')
      : line.split(',');
    const cleanParts = parts.map(p => p.trim());

    if (cleanParts.length >= 2) {
      newProspects.push({
        name: cleanParts[0] || 'Unknown',
        title: cleanParts[1] || '',
        company: cleanParts[2] || '',
        contact: {
          email: cleanParts[3] || '',
          linkedin_url: cleanParts[4] || ''
        },
        campaignName: `${today}-${workspaceCode}-Pasted Data`,
        campaignTag: 'paste-import'
      });
    }
  }

  setProspectData(prev => [...newProspects, ...prev]);
  setPasteText(''); // Clear textarea
};
```

### How to Use

1. **Copy Data:**
   - Select rows in Excel/Google Sheets
   - Copy (Cmd+C or Ctrl+C)

2. **Paste in SAM:**
   - Go to Data Approval tab
   - Find "Copy & Paste" section
   - Paste data in textarea (Cmd+V or Ctrl+V)

3. **Add Prospects:**
   - Click "Add Prospects" button
   - System parses and adds to dashboard

4. **Campaign:**
   - Auto-named: `YYYYMMDD-COMPANYCODE-Pasted Data`
   - Tag: `paste-import`

### Tips

- **Include Headers:** First line can be headers (will be skipped if no valid name)
- **Empty Lines:** Automatically skipped
- **Special Characters:** Properly handled (quotes, commas in names)
- **Large Datasets:** Tested with 1000+ rows

---

## LinkedIn URL Search

### Overview

Paste a LinkedIn Sales Navigator or Recruiter search URL to import prospects directly.

### Supported URLs

1. **Sales Navigator People Search:**
   ```
   https://www.linkedin.com/sales/search/people?query=(...)
   ```

2. **Recruiter Search:**
   ```
   https://www.linkedin.com/talent/search?query=(...)
   ```

3. **Classic Search (with filters):**
   ```
   https://www.linkedin.com/search/results/people/?keywords=CEO&location=...
   ```

### How It Works

1. **User Pastes URL:**
   ```
   https://www.linkedin.com/sales/search/people?query=(title:CEO)(location:San%20Francisco)
   ```

2. **System Extracts Parameters:**
   ```javascript
   {
     url: "https://www.linkedin.com/sales/search/people?query=(...)"
   }
   ```

3. **Calls LinkedIn API:**
   ```
   POST /api/linkedin/search/simple
   {
     search_criteria: { url: "..." },
     target_count: 50
   }
   ```

4. **Returns Prospects:**
   - Parses LinkedIn URL
   - Executes search via Unipile
   - Populates Data Approval

### Implementation

**Location:** `/components/DataCollectionHub.tsx:250-301`

```javascript
const handleLinkedInUrl = async () => {
  const response = await fetch('/api/linkedin/search/simple', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      search_criteria: {
        url: linkedinSearchUrl
      },
      target_count: 50
    })
  });

  const data = await response.json();
  if (data.success) {
    const newProspects = data.prospects.map(p => ({
      name: p.fullName,
      title: p.title,
      company: p.company,
      contact: { linkedin_url: p.linkedinUrl },
      campaignName: `${today}-${workspaceCode}-LinkedIn Search`,
      campaignTag: 'linkedin-url'
    }));

    setProspectData(prev => [...newProspects, ...prev]);
    setLinkedinSearchUrl(''); // Clear input
  }
};
```

### How to Use

1. **Create Search in LinkedIn:**
   - Open LinkedIn Sales Navigator or Recruiter
   - Apply filters (title, location, company, etc.)
   - Copy URL from browser address bar

2. **Paste in SAM:**
   - Go to Data Approval tab
   - Find "LinkedIn URL" section
   - Paste URL in input field

3. **Search:**
   - Click "Search LinkedIn" button
   - Wait 10-15 seconds for results
   - Prospects populate dashboard

4. **Campaign:**
   - Auto-named: `YYYYMMDD-COMPANYCODE-LinkedIn Search`
   - Tag: `linkedin-url`

### Limitations

- **Authentication Required:** Must have LinkedIn account connected
- **Max Results:** 50 prospects (Sales Nav: 100, Recruiter: 100)
- **URL Parsing:** Complex URLs may not parse all filters

---

## Best Practices

### Choosing the Right Method

**Use SAM Chat When:**
- You want natural language: "Find 20 CTOs in New York"
- You're uploading knowledge documents (PDFs, docs)
- You want SAM to help refine search criteria

**Use CSV Upload When:**
- You have existing prospect lists
- You're importing from CRM/other tools
- You have 100+ prospects to add
- Data is already formatted

**Use Copy & Paste When:**
- Quick transfer from spreadsheet
- Adding a few prospects manually
- Testing/demo purposes
- Data is in tabular format

**Use LinkedIn URL When:**
- You've already built complex filters in Sales Nav
- You want exact LinkedIn search results
- You're familiar with Sales Navigator
- You need precise targeting

### Data Quality Tips

1. **Always Include:**
   - Name (or First + Last)
   - Job Title
   - Company (recommended)

2. **Optional but Recommended:**
   - Email address
   - LinkedIn URL
   - Location

3. **Validation:**
   - Remove duplicate entries before upload
   - Verify email formats
   - Check LinkedIn URLs are valid

4. **Campaign Naming:**
   - Use descriptive names: "Q4 2025 Tech CEOs"
   - Include targeting info: "SF SaaS Founders"
   - Avoid generic: "List 1", "Test"

### Performance Guidelines

| Method | Recommended Size | Max Size | Processing Time |
|--------|-----------------|----------|-----------------|
| CSV Upload | 100-500 | Unlimited | 1-5 seconds |
| Copy & Paste | 10-100 | 1000+ | <1 second |
| LinkedIn URL | 20-50 | 100 | 10-15 seconds |
| Natural Language | 20-50 | 100 | 10-15 seconds |

---

## Troubleshooting

### CSV Upload Issues

**Problem:** "Failed to parse CSV"
- **Fix:** Ensure proper CSV format, no special encoding
- **Fix:** Open in Excel → Save As → CSV UTF-8

**Problem:** "No valid prospect data found"
- **Fix:** Verify at least Name + Title columns exist
- **Fix:** Check headers match supported variations

**Problem:** Some fields not importing
- **Fix:** Check column header names
- **Fix:** Use supported header variations (see table above)

### Copy & Paste Issues

**Problem:** Only first line imported
- **Fix:** Ensure each line has data
- **Fix:** Check for line breaks within fields

**Problem:** Fields in wrong order
- **Fix:** Rearrange columns: Name, Title, Company, Email, LinkedIn
- **Fix:** Use CSV upload for complex mappings

### LinkedIn URL Issues

**Problem:** "LinkedIn not connected"
- **Fix:** Go to Settings → Integrations → Connect LinkedIn
- **Fix:** Verify Unipile account active

**Problem:** "Search failed"
- **Fix:** Simplify URL (remove complex filters)
- **Fix:** Try natural language search instead

**Problem:** No prospects returned
- **Fix:** Check filters not too restrictive
- **Fix:** Verify account has access to network degree

---

## Related Documentation

- [LinkedIn Search Functionality](./LINKEDIN_SEARCH_FUNCTIONALITY.md)
- [Data Approval System](./DATA_APPROVAL_IMPLEMENTATION_SUMMARY.md)
- [Campaign Hub](./CAMPAIGN_HUB_GUIDE.md)
- [Multi-Tenant Architecture](./SAM_SYSTEM_TECHNICAL_OVERVIEW.md)
