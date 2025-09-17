# Knowledge Base System - Technical Implementation Guide

## System Overview

The Knowledge Base system provides a comprehensive data foundation for SAM AI to deliver personalized, contextual outreach. It consists of 15 structured sections that collect and organize company-specific information through guided conversations and document uploads.

## Database Architecture

### Core Tables

#### 1. knowledge_base_sections
Defines the structure and organization of KB sections for each workspace.

```sql
CREATE TABLE knowledge_base_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL, -- 'icp', 'products', 'competition', etc.
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT, -- Icon name for UI
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, section_id)
);
```

**Default Sections Initialized**:
1. `overview` - Company Overview
2. `icp` - ICP Config  
3. `products` - Products
4. `competition` - Competition
5. `messaging` - Messaging
6. `tone` - Tone of Voice
7. `company` - Company Info
8. `stories` - Success Stories
9. `process` - Buying Process
10. `compliance` - Compliance
11. `personas` - Personas & Roles
12. `objections` - Objections
13. `pricing` - Pricing
14. `metrics` - Success Metrics
15. `documents` - Documents

#### 2. knowledge_base_content
Flexible JSONB storage for all content types.

```sql
CREATE TABLE knowledge_base_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,
    content_type TEXT NOT NULL, -- 'text', 'document', 'structured_data', 'icp', 'product'
    title TEXT,
    content JSONB NOT NULL, -- Flexible content storage
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 3. knowledge_base_documents
File uploads with extracted content for search.

```sql
CREATE TABLE knowledge_base_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    storage_path TEXT NOT NULL, -- Path in Supabase storage
    extracted_content TEXT, -- Extracted text content for search
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 4. Specialized Structured Tables

**knowledge_base_icps**: Structured ideal customer profile data
**knowledge_base_products**: Product information and positioning  
**knowledge_base_competitors**: Competitive intelligence
**knowledge_base_personas**: Buyer personas and decision-maker profiles

### Indexes for Performance

```sql
-- Section indexes
CREATE INDEX idx_kb_sections_workspace ON knowledge_base_sections(workspace_id);
CREATE INDEX idx_kb_sections_active ON knowledge_base_sections(workspace_id, is_active) WHERE is_active = true;

-- Content indexes  
CREATE INDEX idx_kb_content_workspace_section ON knowledge_base_content(workspace_id, section_id);
CREATE INDEX idx_kb_content_search ON knowledge_base_content USING gin(to_tsvector('english', title || ' ' || (content->>'text')));
CREATE INDEX idx_kb_content_tags ON knowledge_base_content USING gin(tags);

-- Document indexes
CREATE INDEX idx_kb_docs_search ON knowledge_base_documents USING gin(to_tsvector('english', filename || ' ' || COALESCE(extracted_content, '')));
```

### Row Level Security (RLS)

All tables use workspace-based RLS policies:

```sql
CREATE POLICY "KB sections are accessible by workspace members"
ON knowledge_base_sections FOR ALL TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    )
);
```

## API Endpoints

### 1. Section Management
**Endpoint**: `/api/knowledge-base/sections`

**GET** - Retrieve sections for workspace
```typescript
// Query params: workspace_id
// Returns: { sections: Section[] }
```

**POST** - Create new section
```typescript
// Body: { workspace_id, section_id, title, description, icon, sort_order }
// Returns: { section: Section }
```

**PUT** - Update section
```typescript
// Body: { id, title, description, icon, sort_order, is_active }
// Returns: { section: Section }
```

### 2. Content Management  
**Endpoint**: `/api/knowledge-base/content`

**GET** - Retrieve content
```typescript
// Query params: workspace_id, section_id?, content_type?
// Returns: { content: Content[] }
```

**POST** - Create content
```typescript
// Body: { workspace_id, section_id, content_type, title, content, metadata, tags }
// Returns: { content: Content }
```

**PUT** - Update content
```typescript
// Body: { id, title, content, metadata, tags, is_active }
// Returns: { content: Content }
```

**DELETE** - Soft delete content
```typescript
// Query params: id
// Returns: { message: string }
```

### 3. Search
**Endpoint**: `/api/knowledge-base/search`

**GET** - Search across all content
```typescript
// Query params: workspace_id, q (query), section? (filter)
// Returns: { results: SearchResult[] }
```

### 4. Structured Data
**Endpoint**: `/api/knowledge-base/icps`

Standard CRUD operations for structured ICP data.

## Content Structure Standards

### Section-Specific JSON Schemas

#### 1. Overview (Company Foundation)
```json
{
  "company_name": "string",
  "industry": "string", 
  "company_size": "string",
  "founding_date": "string",
  "mission_statement": "string",
  "elevator_pitch": "string",
  "core_value_props": ["string"],
  "market_position": "string",
  "revenue_stage": "string"
}
```

#### 2. ICP Config
```json
{
  "icp_name": "string",
  "company_size_min": "number",
  "company_size_max": "number",
  "industries": ["string"],
  "job_titles": ["string"],
  "departments": ["string"],
  "seniority_levels": ["string"],
  "locations": ["string"],
  "technologies": ["string"],
  "pain_points": ["string"],
  "buying_triggers": ["string"],
  "disqualifiers": ["string"],
  "deal_size_range": "string",
  "close_rate": "string"
}
```

#### 3. Products
```json
{
  "product_name": "string",
  "category": "string",
  "description": "string", 
  "key_features": ["string"],
  "benefits": ["string"],
  "use_cases": ["string"],
  "competitive_advantages": ["string"],
  "integrations": ["string"],
  "technical_requirements": ["string"],
  "implementation_time": "string",
  "pricing_model": "string",
  "target_segments": ["string"]
}
```

#### 4. Competition
```json
{
  "competitor_name": "string",
  "category": "string",
  "website": "string",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "pricing_model": "string",
  "key_features": ["string"],
  "target_market": "string",
  "positioning_against": "string",
  "common_objections": ["string"],
  "win_strategies": ["string"]
}
```

#### 5. Messaging
```json
{
  "message_type": "string",
  "audience": "string",
  "key_message": "string",
  "value_props": ["string"],
  "proof_points": ["string"],
  "call_to_action": "string",
  "tone": "string",
  "variations": {}
}
```

#### 6. Success Stories  
```json
{
  "story_title": "string",
  "customer_industry": "string",
  "customer_size": "string",
  "challenge": "string",
  "solution": "string",
  "results": ["string"],
  "metrics": {},
  "quote": "string",
  "use_case": "string"
}
```

#### 7. Objections
```json
{
  "objection": "string",
  "category": "string",
  "frequency": "string",
  "typical_responses": ["string"],
  "proof_points": ["string"],
  "prevention_strategy": "string",
  "timing": "string"
}
```

#### 8. Personas
```json
{
  "persona_name": "string",
  "job_title": "string",
  "department": "string",
  "seniority_level": "string",
  "decision_role": "string",
  "primary_goals": ["string"],
  "pain_points": ["string"],
  "communication_preferences": {},
  "common_objections": ["string"],
  "key_messages": ["string"]
}
```

## Database Functions

### 1. Section Initialization
```sql
CREATE FUNCTION initialize_knowledge_base_sections(p_workspace_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO knowledge_base_sections (workspace_id, section_id, title, description, icon, sort_order) VALUES
    (p_workspace_id, 'overview', 'Overview', 'Company overview, mission, and core value propositions', 'Building2', 1),
    (p_workspace_id, 'icp', 'ICP Config', 'Define your ideal customer profiles with detailed targeting criteria', 'Target', 2),
    -- ... other sections
    ON CONFLICT (workspace_id, section_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;
```

### 2. Full-Text Search
```sql
CREATE FUNCTION search_knowledge_base_sections(
    p_workspace_id UUID,
    p_search_query TEXT,
    p_section_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    section_id TEXT,
    content_type TEXT,
    title TEXT,
    content_snippet TEXT,
    rank REAL
) AS $$
-- Implementation includes search across content and documents
-- with ranking and snippet extraction
$$ LANGUAGE plpgsql;
```

## Frontend Integration

### React Hook for Knowledge Base
```typescript
// Custom hook for KB operations
export const useKnowledgeBase = (workspaceId: string) => {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const fetchSections = async () => {
    const response = await fetch(`/api/knowledge-base/sections?workspace_id=${workspaceId}`);
    const data = await response.json();
    setSections(data.sections);
    setLoading(false);
  };
  
  const updateContent = async (sectionId: string, content: any) => {
    // Implementation for content updates
  };
  
  const searchContent = async (query: string) => {
    // Implementation for search
  };
  
  return { sections, loading, updateContent, searchContent };
};
```

### Section Component Template
```typescript
interface KBSectionProps {
  section: KBSection;
  workspace_id: string;
  onUpdate: (content: any) => void;
}

const KBSectionComponent: React.FC<KBSectionProps> = ({ section, workspace_id, onUpdate }) => {
  // Section-specific UI components
  // Form handling for content updates
  // File upload integration
  // Search functionality within section
};
```

## SAM AI Integration

### Knowledge Retrieval for Conversations
```typescript
// Service for SAM to access KB data
export class KnowledgeBaseService {
  async getRelevantContent(workspaceId: string, context: string): Promise<any> {
    // Search KB for relevant content based on conversation context
    // Return structured data for SAM to use in responses
  }
  
  async getICPCriteria(workspaceId: string): Promise<ICP[]> {
    // Get ICP definitions for prospect qualification
  }
  
  async getCompetitorInfo(workspaceId: string, competitor: string): Promise<any> {
    // Get competitive positioning for objection handling
  }
  
  async getSuccessStories(workspaceId: string, industry?: string): Promise<any> {
    // Get relevant success stories for social proof
  }
}
```

### Content-Aware Message Generation
```typescript
// Integration with message generation
interface MessageContext {
  prospect: Prospect;
  workspace_id: string;
  conversation_history: Message[];
}

export const generateContextualMessage = async (context: MessageContext): Promise<string> => {
  // 1. Analyze prospect against ICP criteria
  // 2. Retrieve relevant product information
  // 3. Get appropriate success stories
  // 4. Apply messaging framework and tone
  // 5. Generate personalized message
};
```

## Security & Privacy

### Data Encryption
- All content encrypted at rest in database
- File uploads encrypted in Supabase storage
- API communications over HTTPS/TLS

### Access Control
- Workspace-based isolation via RLS
- User authentication required for all operations
- Role-based permissions within workspaces

### Audit Trail
- All content changes logged with user and timestamp
- Search queries logged for analytics
- File access tracked

### GDPR Compliance
- User data export functionality
- Right to deletion (hard delete option)
- Data retention policies configurable
- Consent tracking for data collection

## Performance Optimizations

### Caching Strategy
- Redis cache for frequently accessed content
- Client-side caching of section metadata
- Search result caching with TTL

### Database Optimization
- Proper indexing for all query patterns
- JSONB indexes for structured content search
- Connection pooling for API endpoints

### File Handling
- Async file processing for large documents
- Text extraction using background jobs
- CDN delivery for static assets

## Monitoring & Analytics

### System Metrics
- KB completion rates by section
- Search query performance and results
- Content update frequency
- User engagement with different sections

### Business Metrics  
- Correlation between KB completeness and outreach success
- Most valuable content types for conversion
- Section usage patterns by industry/company size

## Future Enhancements

### AI-Powered Features
- Auto-categorization of uploaded content
- Content suggestions based on industry patterns
- Automated extraction of key information from documents
- Smart tagging and metadata generation

### Advanced Search
- Semantic search using vector embeddings
- Cross-section relationship mapping
- Intelligent content recommendations
- Query auto-completion

### Collaboration Features
- Team commenting and review workflows
- Content approval processes
- Version control and change tracking
- Template sharing across workspaces

---

This technical implementation provides a robust, scalable foundation for SAM AI's knowledge management system, enabling sophisticated personalization and contextual intelligence in all outreach activities.