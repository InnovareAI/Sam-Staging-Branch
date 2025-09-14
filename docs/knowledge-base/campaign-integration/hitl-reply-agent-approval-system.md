# HITL Reply Agent Approval System - Human-In-The-Loop Email Response Management
Version: v1.0 | Created: 2025-09-14

## Purpose
Design a Human-In-The-Loop (HITL) system for approving SAM-generated email responses before they are sent to prospects, ensuring quality control and maintaining professional communication standards.

---

## System Overview

### Core Concept: Email-Based Approval Workflow

```typescript
interface HITLReplyApprovalFlow {
  // Response Generation
  response_generation: {
    trigger: 'Prospect replies to campaign email'
    sam_analysis: 'SAM analyzes reply and generates response'
    approval_required: 'Response queued for human approval before sending'
  }
  
  // Email-Based Approval
  email_approval: {
    approval_email_sent: 'SAM sends approval request to user email'
    user_actions: ['approve', 'modify', 'reject', 'do_not_send']
    response_method: 'Reply directly to approval email with decision'
    simple_commands: ['APPROVED', 'CHANGES: [modifications]', 'DO NOT SEND']
  }
  
  // Response Processing
  response_processing: {
    approved: 'Send SAM response immediately'
    modifications: 'Apply changes and send modified response'
    rejected: 'Do not send, mark for manual handling'
    timeout_handling: 'Auto-escalate after 2 hours without approval'
  }
}
```

---

## Database Schema for HITL System

### Core Tables

```sql
-- Reply Approval Sessions
-- Tracks each prospect reply requiring approval
CREATE TABLE IF NOT EXISTS reply_approval_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Campaign Context
    campaign_execution_id UUID REFERENCES n8n_campaign_executions(id),
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    
    -- Original Prospect Email
    prospect_name TEXT NOT NULL,
    prospect_email TEXT NOT NULL,
    prospect_company TEXT,
    original_campaign_message_id TEXT, -- Reference to original outbound message
    
    -- Prospect Reply Details
    prospect_reply_subject TEXT NOT NULL,
    prospect_reply_body TEXT NOT NULL,
    prospect_reply_received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    prospect_reply_sentiment TEXT CHECK (prospect_reply_sentiment IN ('positive', 'negative', 'neutral', 'objection', 'question', 'out_of_office')),
    
    -- SAM Generated Response
    sam_generated_response_subject TEXT,
    sam_generated_response_body TEXT NOT NULL,
    sam_confidence_score REAL DEFAULT 0.0, -- 0.0 to 1.0
    sam_response_type TEXT CHECK (sam_response_type IN ('answer_question', 'handle_objection', 'schedule_meeting', 'provide_info', 'follow_up')),
    
    -- Approval Status
    approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'modified', 'rejected', 'timeout', 'sent')),
    approval_decision_received_at TIMESTAMP WITH TIME ZONE,
    approval_timeout_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '2 hours'),
    
    -- Final Response
    final_response_subject TEXT,
    final_response_body TEXT,
    response_sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reply Approval Decisions
-- Tracks human decisions and modifications
CREATE TABLE IF NOT EXISTS reply_approval_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reply_approval_session_id UUID NOT NULL REFERENCES reply_approval_sessions(id) ON DELETE CASCADE,
    
    -- Approval Details
    decision TEXT NOT NULL CHECK (decision IN ('approved', 'modified', 'rejected', 'do_not_send')),
    decision_method TEXT DEFAULT 'email_reply' CHECK (decision_method IN ('email_reply', 'dashboard', 'api')),
    
    -- Modifications (if any)
    original_response TEXT,
    modified_response TEXT,
    modification_notes TEXT,
    
    -- User Feedback
    user_feedback TEXT, -- Free-form feedback about SAM's response quality
    response_quality_rating INTEGER CHECK (response_quality_rating BETWEEN 1 AND 5),
    
    -- Approval Context
    approved_by TEXT NOT NULL, -- user_id
    approved_via_email TEXT, -- Email address used for approval
    approval_email_message_id TEXT, -- Email message ID for tracking
    
    -- Timestamps
    decided_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reply Approval Templates
-- Reusable response templates for common scenarios
CREATE TABLE IF NOT EXISTS reply_approval_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL,
    
    -- Template Details
    template_name TEXT NOT NULL,
    template_category TEXT CHECK (template_category IN ('question_answer', 'objection_handling', 'meeting_scheduling', 'information_request', 'follow_up')),
    
    -- Template Content
    subject_template TEXT,
    body_template TEXT NOT NULL,
    personalization_fields TEXT[] DEFAULT '{}', -- Variables like {prospect_name}, {company_name}
    
    -- Usage Statistics
    times_used INTEGER DEFAULT 0,
    approval_rate REAL DEFAULT 0.0, -- Percentage of times approved when suggested
    
    -- Template Status
    is_active BOOLEAN DEFAULT true,
    created_by TEXT NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reply Learning Data
-- Tracks patterns for improving SAM's responses
CREATE TABLE IF NOT EXISTS reply_learning_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reply_approval_session_id UUID NOT NULL REFERENCES reply_approval_sessions(id) ON DELETE CASCADE,
    
    -- Learning Context
    prospect_reply_keywords TEXT[],
    prospect_intent_classification TEXT,
    industry_context TEXT,
    company_size_context TEXT,
    
    -- SAM Performance
    initial_response_quality INTEGER CHECK (initial_response_quality BETWEEN 1 AND 5),
    required_modifications BOOLEAN DEFAULT false,
    modification_type TEXT[], -- ['tone_adjustment', 'factual_correction', 'personalization_improvement']
    
    -- Human Preferences
    preferred_tone TEXT, -- 'formal', 'casual', 'friendly', 'professional'
    preferred_length TEXT, -- 'brief', 'medium', 'detailed'
    preferred_approach TEXT, -- 'direct', 'consultative', 'educational'
    
    -- Learning Features
    learning_features JSONB DEFAULT '{}', -- Extensible learning data
    
    -- Timestamps
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Email-Based Approval System

### Approval Email Template

```html
<!DOCTYPE html>
<html>
<head>
    <title>SAM Reply Approval Required</title>
    <style>
        .approval-container { max-width: 600px; font-family: Arial, sans-serif; }
        .prospect-reply { background: #f5f5f5; padding: 15px; margin: 10px 0; border-left: 4px solid #ccc; }
        .sam-response { background: #e8f4f8; padding: 15px; margin: 10px 0; border-left: 4px solid #2196F3; }
        .approval-actions { background: #fff3cd; padding: 15px; margin: 20px 0; border: 1px solid #ffeaa7; }
        .action-button { display: inline-block; padding: 10px 20px; margin: 5px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="approval-container">
        <h2>🤖 SAM Reply Approval Required</h2>
        
        <p><strong>Prospect:</strong> {prospect_name} ({prospect_email})</p>
        <p><strong>Company:</strong> {prospect_company}</p>
        <p><strong>Received:</strong> {reply_received_time}</p>
        
        <h3>📬 Prospect's Reply:</h3>
        <div class="prospect-reply">
            <strong>Subject:</strong> {prospect_reply_subject}<br><br>
            {prospect_reply_body}
        </div>
        
        <h3>🤖 SAM's Suggested Response:</h3>
        <div class="sam-response">
            <strong>Subject:</strong> {sam_response_subject}<br><br>
            {sam_response_body}
        </div>
        
        <p><strong>SAM's Confidence:</strong> {confidence_score}% | <strong>Response Type:</strong> {response_type}</p>
        
        <div class="approval-actions">
            <h3>📝 How to Approve:</h3>
            <p><strong>Reply to this email with one of these commands:</strong></p>
            <ul>
                <li><strong>APPROVED</strong> - Send SAM's response as-is</li>
                <li><strong>CHANGES: [your modifications]</strong> - Send with your changes</li>
                <li><strong>DO NOT SEND</strong> - Don't send any response</li>
            </ul>
            
            <p><em>⏰ This approval will timeout in 2 hours and escalate for manual handling.</em></p>
        </div>
        
        <p style="font-size: 12px; color: #666;">
            Session ID: {approval_session_id}<br>
            Campaign: {campaign_name}<br>
            Workspace: {workspace_name}
        </p>
    </div>
</body>
</html>
```

### Approval Email Processing Logic

```typescript
interface EmailApprovalProcessor {
  // Email Parsing
  email_parsing: {
    extract_command: 'Parse APPROVED, CHANGES:, or DO NOT SEND from email body'
    extract_modifications: 'Extract modification text after CHANGES:'
    validate_session_id: 'Match approval session from email subject/body'
    verify_sender: 'Confirm email from authorized user'
  }
  
  // Decision Processing
  decision_processing: {
    approved: {
      action: 'Send SAM response immediately'
      notification: 'Confirm response sent to user'
      learning: 'Record approval for SAM improvement'
    }
    
    changes_requested: {
      action: 'Apply user modifications to SAM response'
      validation: 'Validate modified response for completeness'
      send: 'Send modified response to prospect'
      learning: 'Record modifications for SAM learning'
    }
    
    do_not_send: {
      action: 'Mark session as rejected, do not send'
      escalation: 'Flag for manual follow-up if needed'
      learning: 'Record rejection reasons for SAM improvement'
    }
  }
  
  // Error Handling
  error_handling: {
    invalid_command: 'Request clarification from user'
    timeout_handling: 'Escalate to manual queue after 2 hours'
    multiple_responses: 'Use first valid response, ignore duplicates'
  }
}
```

---

## API Integration Points

### Core API Endpoints

```typescript
// POST /api/hitl/reply-approval/session
interface CreateReplyApprovalRequest {
  prospect_email: string
  prospect_reply_subject: string
  prospect_reply_body: string
  prospect_reply_received_at: string
  campaign_execution_id?: string
  sam_generated_response: {
    subject: string
    body: string
    confidence_score: number
    response_type: string
  }
}

// POST /api/hitl/reply-approval/process-decision
interface ProcessApprovalDecisionRequest {
  approval_session_id: string
  decision: 'approved' | 'modified' | 'rejected'
  decision_method: 'email_reply' | 'dashboard' | 'api'
  modifications?: string
  user_feedback?: string
  response_quality_rating?: number
}

// POST /api/hitl/reply-approval/send-response
interface SendApprovedResponseRequest {
  approval_session_id: string
  final_response_subject: string
  final_response_body: string
}

// GET /api/hitl/reply-approval/pending
interface GetPendingApprovalsResponse {
  pending_approvals: ReplyApprovalSession[]
  timeout_warnings: ReplyApprovalSession[]
  overdue_approvals: ReplyApprovalSession[]
}
```

---

## Integration with Existing Systems

### SAM AI Conversation Integration

```typescript
interface SAMReplyGenerationFlow {
  // Reply Detection
  reply_detection: {
    email_monitoring: 'Monitor campaign email responses via SMTP/IMAP'
    reply_classification: 'Classify reply type and sentiment'
    context_retrieval: 'Get original campaign context and prospect data'
  }
  
  // Response Generation
  response_generation: {
    sam_analysis: 'Analyze prospect reply for intent and requirements'
    response_crafting: 'Generate appropriate response using SAM AI'
    confidence_scoring: 'Score SAM confidence in response quality'
    template_matching: 'Match against approved response templates'
  }
  
  // Approval Queue
  approval_queue: {
    hitl_required: 'Queue for human approval if confidence < threshold'
    auto_send: 'Send directly if confidence > 90% and matches approved template'
    escalation: 'Route complex responses to manual handling'
  }
}
```

### N8N Workflow Integration

```typescript
interface N8NHITLIntegration {
  // Workflow Modification
  n8n_workflow_nodes: {
    reply_monitor: 'Monitor email replies to campaign messages'
    sam_response_generator: 'Call SAM API to generate response'
    hitl_approval_router: 'Route to approval system based on confidence'
    email_approval_sender: 'Send approval email to user'
    approval_processor: 'Process user approval decision'
    response_sender: 'Send final approved response to prospect'
  }
  
  // Configuration Options
  workspace_config: {
    hitl_enabled: boolean
    auto_send_threshold: number // Confidence score threshold
    approval_timeout_hours: number
    escalation_email: string
    approved_templates_only: boolean
  }
}
```

---

## Implementation Phases

### Phase 1: Core HITL System (Week 2-3)
- [ ] **Database schema implementation** - Create HITL tables
- [ ] **Email approval system** - Template and processing logic
- [ ] **Basic API endpoints** - Create, process, and send approvals
- [ ] **Email integration** - SMTP/IMAP monitoring for replies

### Phase 2: SAM AI Integration (Week 3-4)
- [ ] **Response generation integration** - Connect SAM to HITL system
- [ ] **Confidence scoring** - Implement response quality assessment
- [ ] **Template system** - Pre-approved response templates
- [ ] **Dashboard interface** - Web-based approval alternative

### Phase 3: N8N Workflow Integration (Week 4-5)
- [ ] **N8N workflow modification** - Add HITL nodes to existing workflows
- [ ] **Timeout handling** - Auto-escalation for overdue approvals
- [ ] **Performance tracking** - Approval rates and response times
- [ ] **Learning system** - Improve SAM based on approval patterns

### Phase 4: Advanced Features (Week 5-6)
- [ ] **Bulk approval tools** - Approve multiple similar responses
- [ ] **Mobile notifications** - Push notifications for urgent approvals
- [ ] **Team collaboration** - Multiple approvers for large teams
- [ ] **Analytics dashboard** - HITL performance metrics

---

## Quality Control & Learning

### SAM Learning Integration

```typescript
interface SAMLearningFromHITL {
  // Pattern Recognition
  pattern_learning: {
    approved_responses: 'Learn from consistently approved response patterns'
    common_modifications: 'Identify frequent user modifications'
    rejection_reasons: 'Understand why responses are rejected'
    industry_preferences: 'Learn industry-specific communication styles'
  }
  
  // Confidence Improvement
  confidence_tuning: {
    accuracy_tracking: 'Track approval rates vs confidence scores'
    threshold_optimization: 'Adjust auto-send thresholds based on performance'
    template_effectiveness: 'Measure template match accuracy'
  }
  
  // Response Quality Enhancement
  quality_improvement: {
    tone_adjustments: 'Learn preferred communication tone per workspace'
    length_optimization: 'Optimize response length based on approval patterns'
    personalization_improvement: 'Enhance personalization based on feedback'
  }
}
```

This HITL system ensures that every SAM-generated response maintains the quality and professionalism your clients expect, while continuously improving SAM's response generation capabilities through human feedback.