# SAM AI Knowledge Classification System

## Overview
Implement a classification system to separate personal vs team knowledge in conversations for better RAG performance and privacy compliance.

## Enhanced Conversation Metadata Structure

```json
{
  "conversation_id": "uuid",
  "user_id": "user_123",
  "organization_id": "org_456", 
  "knowledge_classification": {
    "personal_data": {
      "communication_style": {
        "tone": "formal|casual|direct|consultative",
        "preferred_format": "bullet_points|paragraphs|visual",
        "response_length": "brief|detailed|comprehensive",
        "extracted_from": ["message_id_1", "message_id_2"]
      },
      "professional_context": {
        "role": "VP Sales|Director Marketing|CEO",
        "industry_experience": "5+ years SaaS",
        "team_size": "10-50 people",
        "previous_tools": ["Salesforce", "HubSpot"],
        "extracted_from": ["message_id_3"]
      },
      "working_preferences": {
        "meeting_availability": "EST 9-5",
        "preferred_channels": ["email", "slack"],
        "decision_speed": "fast|deliberate|collaborative",
        "extracted_from": ["message_id_4"]
      }
    },
    "team_shareable": {
      "customer_intelligence": {
        "pain_points": ["lead generation", "pipeline visibility"],
        "buying_triggers": ["growth stage", "team scaling"],
        "objections": ["budget concerns", "implementation time"],
        "success_metrics": ["MQL increase", "pipeline velocity"],
        "extracted_from": ["message_id_5", "message_id_6"]
      },
      "market_insights": {
        "industry": "SaaS",
        "company_size": "100-500 employees",
        "competitive_mentions": ["Outreach", "Sales Loft"],
        "tech_stack": ["Salesforce", "Slack", "Zoom"],
        "extracted_from": ["message_id_7"]
      },
      "product_feedback": {
        "desired_features": ["LinkedIn integration", "email templates"],
        "use_cases": ["outbound prospecting", "lead nurturing"],
        "integration_needs": ["CRM sync", "calendar booking"],
        "extracted_from": ["message_id_8"]
      }
    }
  },
  "privacy_tags": {
    "contains_pii": false,
    "data_sensitivity": "low|medium|high", 
    "retention_policy": "standard|extended|minimal",
    "sharing_scope": "personal|team|organization|cross_tenant"
  },
  "knowledge_extraction": {
    "auto_classified": true,
    "confidence_score": 0.85,
    "review_required": false,
    "extraction_version": "1.0"
  }
}
```

## Knowledge Classification Rules

### Personal Data (User-Specific)
- ❌ **Not shared** across team members
- ✅ **Used for** personalizing SAM's responses to that specific user
- 🔒 **Privacy**: Highest protection level
- 📊 **RAG Usage**: User-specific context only

### Team Shareable Data
- ✅ **Shared** across organization members
- ✅ **Used for** improving SAM's knowledge for the entire team
- 🔓 **Privacy**: Anonymized and aggregated
- 📊 **RAG Usage**: Organization-wide context enhancement

## Implementation Strategy

### Phase 1: Classification Engine
- Build ML classifier to automatically categorize conversation content
- Train on conversation patterns to identify personal vs business information
- Implement confidence scoring for manual review flagging

### Phase 2: Enhanced Storage
- Add knowledge_classification JSONB field to sam_conversations
- Create separate tables for classified knowledge extraction
- Implement automated extraction pipelines

### Phase 3: RAG Enhancement
- Modify knowledge retrieval to respect privacy boundaries
- Separate vector embeddings for personal vs team knowledge
- Implement smart context mixing for optimal responses

### Phase 4: Privacy Controls
- User consent mechanisms for data sharing
- Granular privacy controls per data type
- Audit trails for knowledge access and usage

## Database Schema Changes

```sql
-- Add classification metadata to conversations
ALTER TABLE sam_conversations 
ADD COLUMN knowledge_classification JSONB DEFAULT '{}',
ADD COLUMN privacy_tags JSONB DEFAULT '{}';

-- Create extracted knowledge table
CREATE TABLE sam_extracted_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES sam_conversations(id),
  user_id TEXT NOT NULL,
  organization_id TEXT,
  knowledge_type TEXT NOT NULL, -- 'personal' or 'team_shareable'
  category TEXT NOT NULL, -- 'communication_style', 'customer_intelligence', etc.
  subcategory TEXT,
  content JSONB NOT NULL,
  confidence_score DECIMAL(3,2),
  sharing_scope TEXT NOT NULL CHECK (sharing_scope IN ('user', 'team', 'organization')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- For data retention compliance
);

-- Indexes for efficient knowledge retrieval
CREATE INDEX idx_extracted_knowledge_user ON sam_extracted_knowledge(user_id, knowledge_type);
CREATE INDEX idx_extracted_knowledge_org ON sam_extracted_knowledge(organization_id, knowledge_type);
CREATE INDEX idx_extracted_knowledge_category ON sam_extracted_knowledge(category, subcategory);
```

## Benefits

### For Users
- Personalized SAM responses based on their communication style
- Privacy protection for sensitive personal information
- Consistent experience across conversations

### For Teams  
- Shared organizational knowledge improves SAM for everyone
- Better customer intelligence across team members
- Collective learning from all team interactions

### For SAM AI
- More targeted and relevant responses
- Better understanding of individual vs organizational context
- Improved learning from conversation patterns

## Privacy Compliance
- GDPR compliant with explicit consent mechanisms
- User control over what gets shared with team
- Automatic data expiration for sensitive information
- Clear audit trails for all data access