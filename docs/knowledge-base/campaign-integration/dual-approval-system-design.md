# Dual Approval System: Prospects + Campaign Content
Version: v1.0 | Created: 2025-09-14

## Purpose
This document defines the enhanced approval system that handles both prospect validation AND campaign content approval (messaging, sequences, templates) in a unified interface, creating a complete campaign readiness workflow.

---

## Current State Analysis

### Existing Prospect Approval System
✅ **Working Components:**
- Prospect data validation and approval interface
- Learning algorithm for ICP refinement
- Session management and batch processing
- Export functionality for approved prospects

### Missing Campaign Content Approval
❌ **Gap Identified:**
- No messaging approval workflow
- No email sequence validation
- No template approval system  
- No campaign readiness confirmation
- No unified launch approval process

---

## Dual Approval System Architecture

### Approval Page Structure

```typescript
interface DualApprovalPageStructure {
  // Tab-based Interface
  approval_tabs: {
    prospect_approval: {
      title: 'Prospect Validation'
      description: 'Review and approve target prospects for your campaign'
      status_indicators: ['pending', 'in_progress', 'completed']
      completion_criteria: 'Minimum 10 approved prospects with >70% approval rate'
    }
    
    campaign_approval: {
      title: 'Campaign Content'  
      description: 'Review and approve messaging, sequences, and templates'
      status_indicators: ['not_started', 'in_progress', 'completed']
      completion_criteria: 'All messaging components approved and personalization validated'
      prerequisites: ['prospect_approval.status = completed']
    }
    
    launch_readiness: {
      title: 'Launch Review'
      description: 'Final campaign review and launch confirmation'
      status_indicators: ['not_ready', 'ready', 'launched']
      prerequisites: ['prospect_approval.completed', 'campaign_approval.completed']
    }
  }
  
  // Progressive Workflow
  workflow_progression: {
    step_1: 'Prospect Approval (existing functionality)'
    step_2: 'Campaign Content Approval (new)'
    step_3: 'Launch Readiness Review (new)'
    completion: 'Campaign Launch or Export'
  }
}
```

### Campaign Content Approval Components

```typescript
interface CampaignContentApproval {
  // Email Messaging Approval
  email_messaging: {
    email_sequences: EmailSequence[]
    templates: EmailTemplate[]
    subject_lines: SubjectLineVariation[]
    personalization_fields: PersonalizationField[]
    approval_workflow: EmailApprovalWorkflow
  }
  
  // LinkedIn Messaging Approval
  linkedin_messaging: {
    connection_requests: ConnectionRequestTemplate[]
    follow_up_sequences: LinkedInSequence[]
    inmails: InMailTemplate[]
    personalization_strategy: LinkedInPersonalization
  }
  
  // Multi-channel Campaign Approval
  campaign_orchestration: {
    channel_sequence: ChannelSequence[]  // Email -> LinkedIn -> Email
    timing_strategy: TimingStrategy
    escalation_rules: EscalationRule[]
    response_handling: ResponseHandling
  }
  
  // Content Quality Validation
  content_validation: {
    compliance_check: ComplianceValidation
    personalization_accuracy: PersonalizationValidation
    brand_voice_consistency: BrandVoiceCheck
    spam_score_analysis: SpamScoreValidation
  }
}
```

---

## Database Schema Extensions

### Campaign Approval Tables

```sql
-- Campaign Approval Sessions (linked to prospect approval sessions)
CREATE TABLE IF NOT EXISTS campaign_approval_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_approval_session_id UUID REFERENCES prospect_approval_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    
    -- Campaign Details
    campaign_name TEXT NOT NULL,
    campaign_type TEXT DEFAULT 'email' CHECK (campaign_type IN ('email', 'linkedin', 'multi_channel')),
    target_channel_sequence TEXT[] DEFAULT '{"email"}',
    
    -- Approval Status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'content_review', 'approved', 'launched', 'archived')),
    
    -- Content Components
    email_sequences JSONB DEFAULT '[]',
    linkedin_sequences JSONB DEFAULT '[]',
    templates JSONB DEFAULT '{}',
    personalization_config JSONB DEFAULT '{}',
    
    -- Approval Tracking
    content_approved_at TIMESTAMP WITH TIME ZONE,
    approved_by TEXT,
    launch_approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign Content Items (individual messaging pieces)
CREATE TABLE IF NOT EXISTS campaign_content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_approval_session_id UUID REFERENCES campaign_approval_sessions(id) ON DELETE CASCADE,
    
    -- Content Details
    content_type TEXT NOT NULL CHECK (content_type IN ('email_template', 'subject_line', 'linkedin_message', 'connection_request', 'follow_up')),
    content_title TEXT NOT NULL,
    content_body TEXT NOT NULL,
    personalization_fields TEXT[] DEFAULT '{}',
    
    -- Approval Status
    approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'needs_revision')),
    approval_notes TEXT,
    
    -- Quality Metrics
    spam_score REAL DEFAULT 0.0,
    personalization_score REAL DEFAULT 0.0,
    brand_voice_score REAL DEFAULT 0.0,
    
    -- Usage Tracking
    usage_count INTEGER DEFAULT 0,
    performance_metrics JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE
);

-- Campaign Launch Approvals (final sign-off)
CREATE TABLE IF NOT EXISTS campaign_launch_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_approval_session_id UUID REFERENCES campaign_approval_sessions(id) ON DELETE CASCADE,
    
    -- Launch Details
    scheduled_launch_date TIMESTAMP WITH TIME ZONE,
    launch_checklist JSONB NOT NULL DEFAULT '{}',
    launch_approved BOOLEAN DEFAULT FALSE,
    
    -- Final Review
    reviewer_id TEXT NOT NULL,
    review_notes TEXT,
    risk_assessment JSONB DEFAULT '{}',
    compliance_confirmation BOOLEAN DEFAULT FALSE,
    
    -- Launch Execution
    actual_launch_date TIMESTAMP WITH TIME ZONE,
    launch_status TEXT DEFAULT 'scheduled' CHECK (launch_status IN ('scheduled', 'launched', 'paused', 'cancelled')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE
);
```

---

## Campaign Content Approval UI

### Tab 2: Campaign Content Interface

```typescript
interface CampaignContentApprovalInterface {
  // Content Review Section
  content_review_panel: {
    email_sequences: {
      display: 'Expandable cards showing email sequence flow'
      actions: ['Edit', 'Approve', 'Request Revision', 'Reject']
      validation: ['Spam Score', 'Personalization Check', 'Brand Voice']
      preview: 'Real-time email preview with prospect personalization'
    }
    
    linkedin_sequences: {
      display: 'LinkedIn message flow with connection request and follow-ups'
      actions: ['Edit', 'Approve', 'Request Revision', 'Reject'] 
      validation: ['LinkedIn Policy Check', 'Character Limits', 'Personalization']
      preview: 'LinkedIn message preview with prospect context'
    }
    
    subject_lines: {
      display: 'Grid of subject line variations with A/B test recommendations'
      actions: ['Approve', 'Reject', 'Generate More Variations']
      validation: ['Spam Score', 'Open Rate Prediction', 'Personalization Check']
    }
  }
  
  // Quality Validation Dashboard
  quality_dashboard: {
    overall_score: 'Aggregate campaign quality score (0-100)'
    spam_risk_analysis: 'Email deliverability assessment'
    personalization_coverage: 'Percentage of messages with personalization'
    brand_voice_consistency: 'Brand voice alignment score'
    compliance_status: 'Regulatory compliance check (CAN-SPAM, GDPR)'
  }
  
  // Approval Actions
  approval_controls: {
    approve_all: 'Approve all content items meeting quality thresholds'
    approve_selected: 'Approve only selected content items'
    request_revisions: 'Request specific changes with detailed feedback'
    generate_alternatives: 'Generate alternative versions using AI'
  }
}
```

### Tab 3: Launch Readiness Interface

```typescript
interface LaunchReadinessInterface {
  // Pre-launch Checklist
  launch_checklist: {
    prospect_validation: {
      status: 'completed' | 'pending'
      details: '47 prospects approved (78% approval rate)'
      action: 'View Approved Prospects'
    }
    
    content_approval: {
      status: 'completed' | 'pending' | 'needs_revision'
      details: 'Email sequence: Approved | LinkedIn: Needs revision'
      action: 'Review Content'
    }
    
    personalization_setup: {
      status: 'completed' | 'pending'
      details: 'Personalization fields mapped for 94% of prospects'
      action: 'Configure Personalization'
    }
    
    compliance_verification: {
      status: 'completed' | 'pending'
      details: 'CAN-SPAM compliant, GDPR consent verified'
      action: 'Review Compliance'
    }
    
    delivery_configuration: {
      status: 'completed' | 'pending'
      details: 'Email domain configured, LinkedIn account connected'
      action: 'Test Delivery'
    }
  }
  
  // Launch Configuration
  launch_configuration: {
    schedule_settings: {
      launch_date: 'datetime picker'
      time_zone: 'user timezone with prospect timezone awareness'
      batch_size: 'prospects per day/hour'
      delivery_window: 'business hours configuration'
    }
    
    monitoring_setup: {
      response_tracking: 'Email opens, clicks, LinkedIn responses'
      escalation_rules: 'Automatic follow-up sequence triggers'
      pause_conditions: 'Auto-pause on high bounce rates or spam reports'
    }
  }
  
  // Final Launch Button
  launch_controls: {
    launch_button: 'Big green "Launch Campaign" button'
    prerequisites: 'All checklist items must be completed'
    confirmation_modal: 'Final confirmation with campaign summary'
    post_launch_redirect: 'Campaign monitoring dashboard'
  }
}
```

---

## API Endpoints for Campaign Approval

### Campaign Content Management

```typescript
// POST /api/campaign-approval/session
interface CreateCampaignApprovalRequest {
  prospect_approval_session_id: string
  campaign_name: string
  campaign_type: 'email' | 'linkedin' | 'multi_channel'
  initial_content?: CampaignContent
}

// GET /api/campaign-approval/session/:id
interface CampaignApprovalSessionResponse {
  session: CampaignApprovalSession
  content_items: CampaignContentItem[]
  approval_status: ApprovalStatusSummary
  quality_metrics: QualityMetrics
}

// POST /api/campaign-approval/content/validate
interface ValidateContentRequest {
  content_items: CampaignContentItem[]
  validation_types: ['spam_check', 'personalization', 'brand_voice', 'compliance']
}

interface ValidateContentResponse {
  validation_results: {
    content_item_id: string
    spam_score: number
    personalization_score: number
    brand_voice_score: number
    compliance_issues: string[]
    recommendations: string[]
  }[]
  overall_score: number
}

// POST /api/campaign-approval/content/approve
interface ApproveContentRequest {
  content_item_ids: string[]
  approval_notes?: string
  request_revisions?: {
    content_item_id: string
    revision_notes: string
  }[]
}
```

### Launch Readiness Management

```typescript
// GET /api/campaign-approval/launch-checklist/:session_id
interface LaunchChecklistResponse {
  checklist_items: {
    item_name: string
    status: 'completed' | 'pending' | 'failed'
    details: string
    action_required?: string
  }[]
  overall_readiness: number  // 0-100%
  blocking_issues: string[]
}

// POST /api/campaign-approval/launch
interface LaunchCampaignRequest {
  campaign_approval_session_id: string
  launch_configuration: {
    scheduled_launch_date: string
    batch_size: number
    delivery_window: {
      start_time: string
      end_time: string
      timezone: string
    }
  }
  final_confirmation: boolean
}

interface LaunchCampaignResponse {
  success: boolean
  campaign_launch_id: string
  launch_status: 'scheduled' | 'launched'
  monitoring_dashboard_url: string
}
```

---

## SAM AI Integration for Campaign Approval

### Content Generation and Review

```typescript
interface SAMCampaignContentAssistance {
  // Content Generation
  content_generation: {
    trigger: 'user completes prospect approval'
    sam_offer: 'Great! I can now generate personalized email sequences based on your approved prospects. Should I create the initial campaign content?'
    generation_process: {
      prospect_analysis: 'Analyze approved prospect patterns'
      personalization_mapping: 'Map personalization fields to prospect data'
      content_creation: 'Generate email sequences, subject lines, LinkedIn messages'
      quality_optimization: 'Optimize for deliverability and engagement'
    }
  }
  
  // Content Review Assistance
  content_review: {
    spam_score_alerts: 'This email has a high spam score (7.2/10). I recommend these changes: [specific suggestions]'
    personalization_gaps: 'I noticed 23% of your prospects are missing company size data. Should I enrich this information?'
    brand_voice_feedback: 'This message sounds more formal than your usual style. Want me to adjust the tone?'
    performance_predictions: 'Based on similar campaigns, this sequence should achieve 18-24% open rates.'
  }
  
  // Launch Readiness Guidance
  launch_guidance: {
    checklist_completion: 'You\'re 87% ready to launch. Just need to configure your LinkedIn delivery settings.'
    timing_optimization: 'Your prospects are primarily on the West Coast. I recommend launching at 9 AM PST for maximum engagement.'
    risk_mitigation: 'I detected 3 prospects at the same company. Should we space out their outreach to avoid appearing spammy?'
  }
}
```

---

## Implementation Priority

### Phase 1: Core Campaign Approval (Week 2)
- [ ] **Create campaign approval database tables**
- [ ] **Build campaign content approval UI tab**
- [ ] **Basic content validation API endpoints**
- [ ] **Integration with existing prospect approval system**

### Phase 2: Quality Validation (Week 2-3)  
- [ ] **Spam score analysis integration**
- [ ] **Personalization validation system**
- [ ] **Brand voice consistency checking**
- [ ] **Compliance verification (CAN-SPAM, GDPR)**

### Phase 3: Launch Readiness (Week 3)
- [ ] **Launch checklist system**
- [ ] **Campaign scheduling and configuration**
- [ ] **Final approval workflow**
- [ ] **Launch execution and monitoring integration**

### Phase 4: SAM AI Integration (Week 3-4)
- [ ] **SAM AI content generation** for approved prospects
- [ ] **Quality feedback and optimization suggestions**
- [ ] **Launch timing and strategy recommendations**
- [ ] **Campaign performance prediction**

This dual approval system ensures both prospect quality AND campaign content quality before launch, creating a comprehensive campaign readiness workflow that reduces risk and improves success rates.