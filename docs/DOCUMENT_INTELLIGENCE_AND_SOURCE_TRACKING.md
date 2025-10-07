# Document Intelligence & Source Tracking System

**Last Updated**: 2025-10-06
**Status**: ✅ Deployed and Active
**Version**: 1.0

## Overview

Complete system for intelligent document processing with full source traceability. When users upload documents to SAM, the system automatically:

1. **Analyzes** document type using AI (Claude 3.5 Sonnet)
2. **Extracts** structured data based on document context
3. **Generates** Q&A pairs for knowledge base
4. **Stores** in dual storage system (RAG + KB tables)
5. **Tracks** source document for full traceability

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Document Upload Flow                      │
└─────────────────────────────────────────────────────────────┘

📄 User uploads PDF/document
   ↓
💾 POST /api/sam/upload-document
   ├─ Store file in Supabase Storage (sam-attachments bucket)
   ├─ Extract text from PDF/document
   └─ Create attachment record → attachment.id
   ↓
🤖 AI Document Intelligence (/lib/document-intelligence.ts)
   ├─ Analyze with Claude 3.5 Sonnet
   ├─ Detect document type (11+ types)
   ├─ Extract structured data
   └─ Generate Q&A pairs
   ↓
💿 Dual Storage with Source Tracking (/lib/sam-kb-integration.ts)
   ├─ sam_icp_knowledge_entries (RAG with embeddings)
   │  └─ source_attachment_id: attachment.id
   └─ knowledge_base (Structured data)
      ├─ source_attachment_id: attachment.id
      ├─ source_type: 'document_upload'
      └─ source_metadata: {document_type, confidence, ...}
```

## Core Modules

### 1. Document Intelligence (`/lib/document-intelligence.ts`)

**Purpose**: AI-powered document analysis and data extraction

**Supported Document Types**:
- `linkedin_profile` - LinkedIn profile PDFs
- `pitch_deck` - Company pitch decks/presentations
- `case_study` - Case studies with results/metrics
- `icp_document` - Ideal Customer Profile definitions
- `product_sheet` - Product feature sheets
- `pricing_doc` - Pricing information
- `competitor_analysis` - Competitive intelligence
- `prospect_list` - Lists of prospects/leads
- `email_template` - Email templates/examples
- `sales_script` - Sales scripts/talk tracks
- `unknown` - Fallback for unrecognized types

**Key Functions**:

```typescript
// Main processing function
export async function processDocumentWithContext(params: {
  extractedText: string;
  fileName: string;
  fileType: string;
  workspaceId: string;
  userId: string;
  sessionId?: string;
  userProvidedType?: string;
  attachmentId?: string; // Links Q&A to source document
}): Promise<DocumentAnalysis>

// AI analysis
async function analyzeDocumentWithAI(
  extractedText: string,
  fileName: string,
  userProvidedType?: string
): Promise<DocumentAnalysis>

// Q&A generation from document type
function generateQAPairsFromAnalysis(
  analysisResult: any
): QuestionAnswer[]
```

**AI Analysis Output**:
```json
{
  "documentType": "pitch_deck",
  "confidence": 0.92,
  "summary": "Company pitch deck for AI-powered sales automation",
  "extractedData": {
    "valueProposition": "Automate B2B outreach with AI",
    "targetMarket": "B2B sales teams 10-500 employees",
    "pricing": "Starting at $99/month"
  },
  "suggestedKBSections": ["business-model", "products", "pricing"],
  "qaPairs": [
    {
      "questionId": "value_proposition",
      "questionText": "What is the company value proposition?",
      "answerText": "Automate B2B outreach with AI",
      "category": "business_model",
      "stage": "discovery"
    }
  ]
}
```

### 2. Source Tracking Schema

**Database Tables**:

#### `sam_icp_knowledge_entries`
```sql
CREATE TABLE sam_icp_knowledge_entries (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,
  discovery_session_id UUID,
  question_id TEXT NOT NULL,
  question_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  answer_structured JSONB,
  stage TEXT NOT NULL,
  category TEXT NOT NULL,
  confidence_score DECIMAL(3,2),
  embedding VECTOR(1536),
  source_attachment_id UUID, -- ✅ NEW: Links to source document
  created_at TIMESTAMPTZ,
  FOREIGN KEY (source_attachment_id)
    REFERENCES sam_conversation_attachments(id)
    ON DELETE SET NULL
);
```

#### `knowledge_base`
```sql
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  category TEXT NOT NULL,
  subcategory TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[],
  version TEXT,
  is_active BOOLEAN,
  source_attachment_id UUID, -- ✅ NEW: Links to source document
  source_type TEXT, -- ✅ NEW: Origin tracking
  source_metadata JSONB, -- ✅ NEW: Additional context
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  FOREIGN KEY (source_attachment_id)
    REFERENCES sam_conversation_attachments(id)
    ON DELETE SET NULL
);
```

**Source Types**:
- `manual` - User created in KB UI
- `document_upload` - Extracted from uploaded document
- `sam_discovery` - From SAM conversation
- `api_import` - Imported via API

### 3. Helper Functions

#### Get All KB Entries from a Document
```sql
SELECT * FROM get_kb_entries_by_source('attachment-uuid-here');

-- Returns:
-- entry_type | entry_id | title | category | created_at
-- icp_knowledge | ... | What is the value prop? | business_model | ...
-- knowledge_base | ... | Company Value Proposition | business-model | ...
```

#### Cleanup Orphaned Entries
```sql
SELECT cleanup_orphaned_kb_entries();

-- Deletes entries where:
-- - source_attachment_id IS NULL
-- - discovery_session_id IS NULL
-- - created_at > 30 days old
```

## Integration Points

### Upload API Endpoint (`/app/api/sam/upload-document/route.ts`)

**Flow**:
1. Validate file (type, size)
2. Upload to Supabase Storage
3. Extract text from PDF/document
4. **Create attachment record** (generates ID)
5. **Run AI analysis** with attachment.id
6. **Store Q&A pairs** with source tracking
7. Update attachment metadata with analysis results
8. Return complete response to client

**Key Code**:
```typescript
// Create attachment first to get ID
const { data: attachment } = await supabase
  .from('sam_conversation_attachments')
  .insert({...})
  .select()
  .single();

// Analyze with source tracking
const analysis = await processDocumentWithContext({
  extractedText,
  fileName: file.name,
  workspaceId: thread.workspace_id,
  userId: user.id,
  attachmentId: attachment.id // ✅ Links Q&A to source
});

// Q&A pairs automatically stored with source_attachment_id
```

### Q&A Storage (`/lib/sam-kb-integration.ts`)

**Dual Storage**:
```typescript
export async function storeQAInKnowledgeBase(
  workspaceId: string,
  userId: string,
  sessionId: string | undefined,
  qa: QuestionAnswer // ✅ Now includes sourceAttachmentId
): Promise<{ success: boolean; error?: string }> {
  // 1. Store in sam_icp_knowledge_entries (RAG)
  await storeQuestionAnswer(workspaceId, userId, sessionId, qa);

  // 2. Store in knowledge_base tables (Structured)
  await updateKnowledgeBaseFromQA(workspaceId, userId, qa);
}
```

**Source Metadata Stored**:
```typescript
{
  workspace_id: workspaceId,
  category: 'business-model',
  title: 'What is the value proposition?',
  content: 'Automate B2B outreach with AI',
  source_attachment_id: 'abc-123-def-456',
  source_type: 'document_upload',
  source_metadata: {
    question_id: 'value_proposition',
    stage: 'discovery',
    category: 'business_model',
    confidence_score: 0.92,
    document_type: 'pitch_deck',
    document_confidence: 0.92
  }
}
```

## Data Flow Examples

### Example 1: Upload Pitch Deck

**Input**:
- File: `company-pitch-deck.pdf`
- User uploads in SAM chat

**Process**:
1. **Upload**: File stored at `{user_id}/{thread_id}/1696800000-company-pitch-deck.pdf`
2. **Extract**: Text extracted via pdf-parse
3. **Analyze**:
   ```json
   {
     "documentType": "pitch_deck",
     "confidence": 0.95,
     "extractedData": {
       "valueProposition": "AI-powered outreach automation",
       "targetMarket": "B2B sales teams",
       "pricing": "$99-899/month tiered pricing"
     }
   }
   ```
4. **Store**: 3 Q&A pairs generated and stored:
   - "What is the value proposition?" → business_model
   - "Who is the target market?" → icp_definition
   - "What is the pricing?" → pricing

**Result**:
- ✅ 3 entries in `sam_icp_knowledge_entries` (with embeddings)
- ✅ 3 entries in `knowledge_base` (structured)
- ✅ All linked to source via `source_attachment_id`
- ✅ Traceability: `get_kb_entries_by_source(attachment_id)` returns all 6 entries

### Example 2: Upload LinkedIn Profile

**Input**:
- File: `prospect-john-doe-linkedin.pdf`

**Process**:
1. AI detects: `linkedin_profile` (confidence: 0.98)
2. Extracts:
   ```json
   {
     "name": "John Doe",
     "currentRole": "VP of Sales",
     "currentCompany": "Acme Corp",
     "industry": "SaaS",
     "skills": ["Sales", "B2B", "Team Management"]
   }
   ```
3. Generates Q&A pairs:
   - "What is current role?" → "VP of Sales at Acme Corp"
   - "What is the LinkedIn headline?" → "Driving revenue..."

**Result**:
- ✅ KB entries categorized as `linkedin_profile`
- ✅ Stored in `knowledge_base (linkedin-profile)` section
- ✅ Available for SAM to reference in conversations

## Query Examples

### Find All Knowledge from a Document
```typescript
const { data } = await supabase
  .rpc('get_kb_entries_by_source', {
    attachment_id: 'abc-123-def-456'
  });

// Returns all KB entries (both tables) from this document
```

### Find Documents by Type
```typescript
const { data } = await supabase
  .from('knowledge_base')
  .select('*, attachments:source_attachment_id(*)')
  .eq('source_type', 'document_upload')
  .eq('source_metadata->>document_type', 'pitch_deck');
```

### Audit Trail
```typescript
const { data } = await supabase
  .from('sam_conversation_attachments')
  .select(`
    *,
    knowledge_entries:sam_icp_knowledge_entries(count),
    knowledge_base_entries:knowledge_base(count)
  `)
  .eq('workspace_id', workspaceId);

// Shows how many KB entries each document created
```

## Benefits

### 1. **Full Traceability**
- Know exactly which document created each KB entry
- Audit trail for compliance and data governance
- Re-trace extracted knowledge to original source

### 2. **Data Provenance**
- `source_type` distinguishes manual vs automated vs uploaded
- `source_metadata` provides context (confidence, document type, etc.)
- Timestamp tracking for data freshness

### 3. **Lifecycle Management**
- Delete document → KB entries set `source_attachment_id = NULL`
- Entries persist (knowledge retained) but lose source link
- Optional cleanup of orphaned entries via `cleanup_orphaned_kb_entries()`

### 4. **Quality Assurance**
- Track confidence scores for AI-extracted data
- Identify low-confidence entries for manual review
- Compare manual vs AI-extracted knowledge quality

### 5. **Smart Document Understanding**
- No manual categorization needed
- AI detects 11+ document types automatically
- Structured extraction based on document context

## Maintenance

### Cleanup Orphaned Entries
Run periodically (monthly):
```sql
SELECT cleanup_orphaned_kb_entries();
```

### Monitor Extraction Quality
```sql
SELECT
  source_metadata->>'document_type' as doc_type,
  AVG((source_metadata->>'document_confidence')::float) as avg_confidence,
  COUNT(*) as total_entries
FROM knowledge_base
WHERE source_type = 'document_upload'
GROUP BY doc_type
ORDER BY avg_confidence DESC;
```

### View Recent Documents
```sql
SELECT
  a.file_name,
  a.created_at,
  COUNT(DISTINCT k.id) as kb_entries,
  COUNT(DISTINCT s.id) as sam_entries
FROM sam_conversation_attachments a
LEFT JOIN knowledge_base k ON k.source_attachment_id = a.id
LEFT JOIN sam_icp_knowledge_entries s ON s.source_attachment_id = a.id
WHERE a.created_at > NOW() - INTERVAL '7 days'
GROUP BY a.id, a.file_name, a.created_at
ORDER BY a.created_at DESC;
```

## Migration Details

**File**: `supabase/migrations/20251006000002_add_source_tracking_to_knowledge.sql`

**Changes**:
1. Creates `knowledge_base` table if not exists (with source tracking)
2. Adds `source_attachment_id` to both tables
3. Adds `source_type` and `source_metadata` to `knowledge_base`
4. Creates helper functions
5. Adds indexes for performance
6. Sets up foreign key constraints with `ON DELETE SET NULL`

**Status**: ✅ Deployed successfully

## API Response Format

### Upload Response
```json
{
  "success": true,
  "attachment": {
    "id": "abc-123-def-456",
    "file_name": "company-pitch.pdf",
    "file_type": "application/pdf",
    "file_size": 245678,
    "processing_status": "completed",
    "extracted_text": "...",
    "extracted_metadata": {
      "pageCount": 12,
      "documentAnalysis": {
        "documentType": "pitch_deck",
        "confidence": 0.92,
        "summary": "...",
        "extractedData": {...},
        "suggestedKBSections": ["business-model", "pricing"],
        "qaPairsCount": 3
      }
    },
    "url": "https://...signed-url..."
  },
  "documentAnalysis": {
    "documentType": "pitch_deck",
    "confidence": 0.92,
    "summary": "Company pitch deck for AI sales automation",
    "extractedData": {...},
    "suggestedKBSections": ["business-model", "pricing"],
    "qaPairsStored": 3
  }
}
```

## Related Documentation

- [`/docs/SAM_QA_STORAGE_SYSTEM.md`](./SAM_QA_STORAGE_SYSTEM.md) - Q&A storage and RAG system
- [`/docs/SAM_DISCOVERY_TO_KB_MAPPING.md`](./SAM_DISCOVERY_TO_KB_MAPPING.md) - Discovery question mapping
- [`/docs/QA_STORAGE_COMPLETION_STATUS.md`](./QA_STORAGE_COMPLETION_STATUS.md) - Implementation status
- [`/lib/document-intelligence.ts`](../lib/document-intelligence.ts) - Source code
- [`/lib/sam-kb-integration.ts`](../lib/sam-kb-integration.ts) - Integration layer
- [`/app/api/sam/upload-document/route.ts`](../app/api/sam/upload-document/route.ts) - Upload endpoint

## Version History

### v1.0 (2025-10-06)
- ✅ Initial implementation
- ✅ AI document analysis with Claude 3.5 Sonnet
- ✅ 11+ document type detection
- ✅ Source tracking in both KB tables
- ✅ Helper functions for querying
- ✅ Full integration with upload endpoint
- ✅ Deployed to production

---

**System Status**: 🟢 Active
**Last Tested**: 2025-10-06
**Next Review**: Q1 2026
