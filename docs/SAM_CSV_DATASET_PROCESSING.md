# Sam's CSV Dataset Processing & Campaign Assignment

## Overview
Sam can now process uploaded CSV datasets, validate LinkedIn prospects, and assign them to campaigns through conversational commands.

## User Workflow

### 1. Upload CSV via Chat Window
Users can upload CSV files in two ways:
- **Click** the Paperclip icon (📎) next to the chat input
- **Drag & Drop** CSV files directly into the chat input area

### 2. Sam Validates the Dataset
After upload, Sam automatically:
- Opens the Data Approval dashboard
- Validates each prospect's LinkedIn profile
- Checks for required fields (name, LinkedIn URL, company, title)
- Calculates quality scores
- Provides a detailed summary in chat

### 3. User Reviews in Data Approval Dashboard
The uploaded prospects appear in the Data Approval section where users can:
- Review individual prospects
- See validation issues
- Approve or reject prospects
- Assign campaign tags

### 4. Sam Assigns to Campaign
Sam can assign approved prospects to campaigns via conversational commands.

## Sam's Capabilities

### 1. Validate Dataset
Sam can validate LinkedIn prospects in an uploaded CSV:

**API Endpoint:** `POST /api/sam/process-dataset`

**Request:**
```json
{
  "session_id": "csv_1234567890_abc123",
  "action": "validate"
}
```

**Response:**
```json
{
  "success": true,
  "action": "validate",
  "session_id": "csv_1234567890_abc123",
  "validation_summary": {
    "total": 100,
    "valid": 85,
    "warnings": 10,
    "invalid": 5,
    "ready_for_campaign": 90,
    "linkedin_profiles": 95
  },
  "validated_prospects": [...],
  "recommendations": [
    "5 prospects have critical issues and should be reviewed or removed",
    "Many prospects are missing job titles - consider enriching this data for better targeting"
  ]
}
```

### 2. Auto-Approve Prospects
Sam can automatically approve prospects above a quality threshold:

**Request:**
```json
{
  "session_id": "csv_1234567890_abc123",
  "action": "auto_approve",
  "approval_threshold": 0.8
}
```

**Response:**
```json
{
  "success": true,
  "action": "auto_approve",
  "session_id": "csv_1234567890_abc123",
  "approved_count": 72,
  "rejected_count": 28,
  "approved_prospects": [...],
  "message": "Auto-approved 72 prospects with 80%+ quality scores"
}
```

### 3. Assign to Campaign
Sam can assign validated prospects to a campaign:

**Option A: Assign to Existing Campaign**
```json
{
  "session_id": "csv_1234567890_abc123",
  "action": "assign_to_campaign",
  "campaign_id": "campaign_uuid_here"
}
```

**Option B: Create New Campaign and Assign**
```json
{
  "session_id": "csv_1234567890_abc123",
  "action": "assign_to_campaign",
  "campaign_name": "Q1 LinkedIn Outreach - Tech Founders"
}
```

**Response:**
```json
{
  "success": true,
  "action": "assign_to_campaign",
  "campaign_id": "campaign_uuid",
  "campaign_name": "Q1 LinkedIn Outreach - Tech Founders",
  "assigned_count": 85,
  "skipped_count": 15,
  "message": "Successfully assigned 85 LinkedIn prospects to campaign"
}
```

## LinkedIn Prospect Validation Rules

Sam validates each prospect using these criteria:

### Required Fields (Critical)
- **LinkedIn URL**: Must include `linkedin.com/in/`
  - Missing: -50% quality score, NOT ready for campaign
  - Invalid format: -30% quality score, NOT ready for campaign

- **Name**: Must be at least 2 characters
  - Missing/invalid: -30% quality score

### Recommended Fields (Important)
- **Company Name**: Used for personalization
  - Missing: -10% quality score

- **Job Title**: Used for targeting
  - Missing: -10% quality score

### Optional Fields
- **Email**: Optional for LinkedIn-only campaigns

### Quality Score Tiers
- **Valid** (≥70%): Ready for campaign, all critical fields present
- **Warning** (50-69%): Has LinkedIn URL but missing recommended fields
- **Invalid** (<50%): Missing critical fields, NOT ready for campaign

## Example Conversational Commands

### User says: "Upload the prospects from my CSV"
1. User clicks Paperclip or drags CSV file
2. Sam processes and validates
3. Sam responds: "I've uploaded 100 prospects. 85 are valid LinkedIn profiles ready for campaigns. 10 have warnings (missing job titles), and 5 need review. Would you like me to auto-approve the 80%+ quality prospects?"

### User says: "Yes, auto-approve them"
Sam calls: `POST /api/sam/process-dataset` with `action: "auto_approve"`, `threshold: 0.8`

### User says: "Assign them to my Q1 Outreach campaign"
Sam calls: `POST /api/sam/process-dataset` with `action: "assign_to_campaign"`, `campaign_name: "Q1 Outreach"`

### User says: "Create a new campaign called 'Tech Founders - March' and add them"
Sam calls: `POST /api/sam/process-dataset` with `action: "assign_to_campaign"`, `campaign_name: "Tech Founders - March"`
- If campaign doesn't exist, Sam creates it automatically
- Prospects are assigned to the new campaign

## Data Flow

```
1. User uploads CSV
   ↓
2. File sent to /api/prospects/csv-upload
   ↓
3. Creates data_approval_session record
   ↓
4. Session ID stored in sessionStorage
   ↓
5. User reviews in Data Approval dashboard
   ↓
6. User commands Sam to assign to campaign
   ↓
7. Sam calls /api/sam/process-dataset
   ↓
8. Sam validates LinkedIn prospects
   ↓
9. Sam inserts into workspace_prospects
   ↓
10. Sam associates with campaign
    ↓
11. Campaign ready for execution
```

## CSV Format Requirements

### Minimum Required Columns
- `name` OR (`first_name` + `last_name`)
- `linkedin_url` OR `linkedin_profile_url` OR `linkedinUrl`

### Recommended Columns
- `company` OR `company_name`
- `title` OR `job_title`

### Optional Columns
- `email` OR `email_address`
- `location`
- `industry`
- `phone`

### Example CSV
```csv
name,linkedin_url,company,title,email
John Smith,https://linkedin.com/in/johnsmith,TechCorp,VP Sales,john@techcorp.com
Jane Doe,https://linkedin.com/in/janedoe,InnovateLabs,CEO,jane@innovatelabs.com
Mike Johnson,https://linkedin.com/in/mikejohnson,DataSystems,CTO,mike@datasystems.com
```

## Session Storage

Sam stores the latest CSV upload session for quick reference:

```javascript
sessionStorage.getItem('latest_csv_upload_session')
// Returns:
{
  "session_id": "csv_1234567890_abc123",
  "filename": "prospects.csv",
  "valid_count": 85,
  "uploaded_at": "2025-01-10T17:52:00.000Z"
}
```

## Error Handling

### Common Errors

1. **No LinkedIn URLs**
```json
{
  "success": false,
  "error": "No prospects are ready for campaign assignment",
  "validation_summary": {
    "total": 100,
    "ready": 0,
    "requires_review": 100
  }
}
```

2. **Campaign Not Found**
```json
{
  "error": "Campaign not found"
}
```

3. **Session Expired**
```json
{
  "error": "Data approval session not found"
}
```

## Best Practices

### For Users
1. Always include LinkedIn URLs in CSV uploads
2. Include company and title for better personalization
3. Review validation issues before approving
4. Use meaningful campaign names
5. Check duplicate prospects before uploading

### For Sam
1. Always validate before assigning to campaigns
2. Provide clear feedback on validation issues
3. Suggest data enrichment when quality is low
4. Confirm campaign assignments with user
5. Track which prospects were skipped and why

## Future Enhancements

1. **Duplicate Detection**: Check for duplicates across campaigns
2. **Data Enrichment**: Auto-enrich missing fields via APIs
3. **LinkedIn ID Resolution**: Match prospects with existing connections
4. **Bulk Campaign Management**: Assign to multiple campaigns
5. **Smart Segmentation**: Auto-segment by industry/title
6. **Quality Scoring ML**: Learn from campaign performance

## Technical Notes

- Session IDs are temporary and stored in `data_approval_sessions` table
- Prospects are duplicated between `workspace_prospects` and `campaign_prospects`
- Campaign associations use the `campaign_prospects` join table
- Validation happens server-side for security
- All LinkedIn URLs are normalized to `linkedin.com/in/` format
