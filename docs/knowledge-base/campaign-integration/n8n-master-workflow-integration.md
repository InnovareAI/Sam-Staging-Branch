# N8N Master Workflow Integration - SAM Campaign Execution
Version: v1.0 | Created: 2025-09-14

## Purpose
This document defines the integration between SAM AI's campaign approval system and the existing N8N master workflow at workflows.innovareai.com, ensuring consistent campaign execution across all workspaces with configurable variations for messaging, CTAs, channel preferences, and reply handling.

---

## Integration Architecture

### Master Workflow Connection Strategy

```typescript
interface N8NMasterWorkflowIntegration {
  // Connection Configuration
  connection_config: {
    n8n_instance: 'workflows.innovareai.com'
    master_workflow_id: 'SAM_MASTER_CAMPAIGN_WORKFLOW'  // To be identified
    authentication: {
      api_key: 'N8N_API_KEY'  // From environment
      workspace_authentication: 'per_workspace_tokens'
    }
  }
  
  // Workspace Variation System
  workspace_variations: {
    campaign_configuration: WorkspaceCampaignConfig
    messaging_customization: MessagingCustomization
    channel_preferences: ChannelPreferences
    reply_handling_rules: ReplyHandlingRules
  }
  
  // Campaign Execution Flow
  execution_flow: {
    approval_completion_trigger: 'Campaign approved in SAM → Execute N8N workflow'
    dynamic_configuration_injection: 'Workspace-specific config passed to master workflow'
    execution_monitoring: 'Real-time status updates back to SAM'
    result_processing: 'Campaign results integrated into SAM knowledge base'
  }
}
```

### Workspace Configuration Schema

```typescript
interface WorkspaceCampaignConfig {
  // Basic Workspace Info
  workspace_id: string
  workspace_name: string
  user_id: string
  campaign_approval_session_id: string
  
  // Channel Configuration
  channel_preferences: {
    email_enabled: boolean
    linkedin_enabled: boolean
    execution_sequence: 'email_only' | 'linkedin_only' | 'email_first' | 'linkedin_first' | 'simultaneous'
    delay_between_channels: number  // hours
  }
  
  // Email Configuration
  email_config: {
    enabled: boolean
    from_email: string
    from_name: string
    reply_to: string
    email_sequences: EmailSequence[]
    subject_line_variations: string[]
    personalization_fields: PersonalizationField[]
    unsubscribe_handling: UnsubscribeConfig
  }
  
  // LinkedIn Configuration
  linkedin_config: {
    enabled: boolean
    linkedin_account_id: string  // From Unipile
    connection_request_template: string
    follow_up_sequences: LinkedInSequence[]
    inmails_enabled: boolean
    response_handling: LinkedInResponseHandling
  }
  
  // Reply Handling Configuration
  reply_handling: {
    auto_response_enabled: boolean
    response_classification: 'positive' | 'negative' | 'neutral' | 'out_of_office'
    positive_reply_actions: string[]  // ['schedule_meeting', 'send_proposal', 'notify_sales_rep']
    negative_reply_actions: string[]  // ['remove_from_sequence', 'add_to_suppression']
    human_handoff_triggers: string[]
  }
  
  // Personalization Configuration
  personalization: {
    approved_prospects: ApprovedProspect[]
    personalization_data: PersonalizationData[]
    dynamic_field_mapping: FieldMapping[]
    fallback_values: Record<string, string>
  }
}
```

---

## N8N Workflow Integration Points

### Master Workflow Execution Trigger

```typescript
interface MasterWorkflowTrigger {
  // Trigger from SAM Campaign Approval
  trigger_endpoint: '/api/n8n/execute-campaign'
  trigger_method: 'POST'
  
  trigger_payload: {
    workflow_id: 'SAM_MASTER_CAMPAIGN_WORKFLOW'
    execution_data: {
      workspace_config: WorkspaceCampaignConfig
      approved_prospects: ApprovedProspect[]
      campaign_content: ApprovedCampaignContent
      execution_preferences: ExecutionPreferences
    }
  }
  
  // Dynamic Configuration Injection
  configuration_nodes: {
    workspace_config_node: 'Receives workspace-specific configuration'
    prospect_data_node: 'Receives approved prospect list'
    messaging_config_node: 'Receives approved messaging content'
    channel_router_node: 'Routes to email/LinkedIn/both based on preferences'
  }
}
```

### Master Workflow Structure (Expected)

```typescript
interface ExpectedMasterWorkflowStructure {
  // Input Processing
  input_processing: {
    workspace_config_parser: 'Parse workspace-specific configuration'
    prospect_list_validator: 'Validate prospect data completeness'
    messaging_content_loader: 'Load approved messaging templates'
    channel_preference_router: 'Route based on email/LinkedIn/both preference'
  }
  
  // Email Channel Branch
  email_workflow_branch: {
    email_sequence_executor: 'Execute approved email sequences'
    personalization_engine: 'Apply dynamic personalization'
    deliverability_optimizer: 'Optimize send times and batching'
    response_monitor: 'Monitor email responses and track engagement'
    unsubscribe_handler: 'Process unsubscribe requests'
  }
  
  // LinkedIn Channel Branch
  linkedin_workflow_branch: {
    connection_request_sender: 'Send connection requests via Unipile'
    connection_acceptance_monitor: 'Monitor connection acceptances'
    follow_up_message_sender: 'Send follow-up messages to connections'
    inmail_sender: 'Send InMails for non-connections (if enabled)'
    response_processor: 'Process LinkedIn message responses'
  }
  
  // Multi-Channel Coordination
  channel_coordination: {
    sequence_coordinator: 'Coordinate timing between email and LinkedIn'
    duplicate_prevention: 'Prevent duplicate outreach to same prospect'
    response_correlation: 'Correlate responses across channels'
    engagement_scoring: 'Score prospect engagement across channels'
  }
  
  // Response Processing
  response_processing: {
    response_classifier: 'Classify responses (positive/negative/neutral/OOO)'
    positive_response_handler: 'Route positive responses to CRM/scheduling'
    negative_response_handler: 'Remove from sequence, add to suppression'
    human_handoff_processor: 'Escalate complex responses to human'
    meeting_scheduler: 'Integrate with Calendly/calendar systems'
  }
  
  // Results & Reporting
  results_reporting: {
    campaign_metrics_collector: 'Collect performance metrics'
    sam_ai_feedback_loop: 'Send results back to SAM for learning'
    workspace_dashboard_updater: 'Update workspace campaign dashboard'
    knowledge_base_updater: 'Update ICP performance data'
  }
}
```

---

## API Integration Layer

### Campaign Execution API

```typescript
// POST /api/campaign/execute-n8n
interface ExecuteN8NCampaignRequest {
  campaign_approval_session_id: string
  execution_preferences: {
    immediate_execution: boolean
    scheduled_execution_time?: string
    batch_size: number  // prospects per batch
    execution_pace: 'aggressive' | 'moderate' | 'conservative'
  }
  notification_preferences: {
    real_time_updates: boolean
    daily_summary: boolean
    completion_notification: boolean
  }
}

interface ExecuteN8NCampaignResponse {
  success: boolean
  n8n_execution_id: string
  estimated_completion_time: string
  monitoring_dashboard_url: string
  webhook_url: string  // For receiving status updates
}

// Webhook endpoint for N8N status updates
// POST /api/campaign/n8n-status-update
interface N8NStatusUpdatePayload {
  execution_id: string
  campaign_approval_session_id: string
  status: 'started' | 'in_progress' | 'paused' | 'completed' | 'failed'
  progress: {
    total_prospects: number
    processed_prospects: number
    successful_outreach: number
    failed_outreach: number
    responses_received: number
  }
  current_step: string
  estimated_time_remaining?: string
  error_details?: string
}
```

### Workspace Configuration Management

```typescript
// GET /api/workspace/n8n-config
interface GetWorkspaceN8NConfigResponse {
  workspace_config: WorkspaceCampaignConfig
  available_email_accounts: EmailAccount[]
  available_linkedin_accounts: LinkedInAccount[]
  default_templates: DefaultTemplates
  reply_handling_rules: ReplyHandlingRule[]
}

// PUT /api/workspace/n8n-config
interface UpdateWorkspaceN8NConfigRequest {
  channel_preferences: ChannelPreferences
  email_config: EmailConfig
  linkedin_config: LinkedInConfig
  reply_handling: ReplyHandlingConfig
  personalization_settings: PersonalizationSettings
}

// POST /api/workspace/test-n8n-connection
interface TestN8NConnectionRequest {
  test_type: 'email_only' | 'linkedin_only' | 'both'
  test_prospect: {
    name: string
    email?: string
    linkedin_url?: string
  }
}
```

---

## Campaign Approval to N8N Integration Flow

### Step 1: Campaign Approval Completion

```typescript
interface CampaignApprovalToN8NFlow {
  // Approval Completion Trigger
  approval_completion: {
    trigger: 'User clicks "Launch Campaign" in approval interface'
    validation: 'All approval tabs completed (Prospects ✅, Content ✅, Launch ✅)'
    data_preparation: 'Compile workspace config, prospects, content for N8N'
  }
  
  // Pre-execution Validation
  pre_execution_validation: {
    n8n_connectivity_check: 'Verify connection to workflows.innovareai.com'
    workspace_config_validation: 'Validate channel configurations'
    prospect_data_completeness: 'Ensure all required personalization data available'
    content_approval_status: 'Confirm all messaging content approved'
    rate_limit_checks: 'Verify within email/LinkedIn sending limits'
  }
  
  // Master Workflow Execution
  workflow_execution: {
    master_workflow_trigger: 'Call N8N master workflow with workspace config'
    dynamic_configuration: 'Inject workspace-specific settings into workflow'
    execution_monitoring: 'Track workflow progress in real-time'
    error_handling: 'Handle workflow errors and retry logic'
  }
  
  // Status Updates to SAM
  status_integration: {
    real_time_updates: 'Receive webhooks from N8N workflow'
    progress_dashboard: 'Update campaign progress in SAM interface'
    completion_handling: 'Process campaign completion and results'
    error_notifications: 'Alert users of execution issues'
  }
}
```

### Step 2: Dynamic Workspace Configuration

```typescript
interface DynamicWorkspaceConfiguration {
  // Configuration Generation
  config_generation: {
    workspace_profile: 'Generate workspace-specific configuration profile'
    channel_routing: 'Configure email-only/LinkedIn-only/both routing'
    messaging_injection: 'Inject approved messaging templates'
    personalization_mapping: 'Map prospect data to personalization fields'
  }
  
  // Master Workflow Adaptation
  workflow_adaptation: {
    conditional_nodes: 'Enable/disable nodes based on channel preferences'
    template_injection: 'Inject workspace messaging templates into workflow'
    timing_configuration: 'Configure delays and batching based on preferences'
    response_routing: 'Configure response handling rules'
  }
  
  // Execution Monitoring
  monitoring_setup: {
    webhook_configuration: 'Configure webhooks for status updates'
    error_handling: 'Set up error notification and escalation'
    progress_tracking: 'Track execution progress per workspace'
    result_collection: 'Collect campaign results for analysis'
  }
}
```

---

## Implementation Requirements

### Database Schema Extensions

```sql
-- N8N Campaign Executions tracking
CREATE TABLE IF NOT EXISTS n8n_campaign_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_approval_session_id UUID REFERENCES campaign_approval_sessions(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    
    -- N8N Integration Details
    n8n_execution_id TEXT NOT NULL,
    n8n_workflow_id TEXT DEFAULT 'SAM_MASTER_CAMPAIGN_WORKFLOW',
    
    -- Execution Configuration
    workspace_config JSONB NOT NULL DEFAULT '{}',
    channel_preferences JSONB NOT NULL DEFAULT '{}',
    execution_preferences JSONB NOT NULL DEFAULT '{}',
    
    -- Status Tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'started', 'in_progress', 'paused', 'completed', 'failed')),
    progress JSONB DEFAULT '{}',  -- Progress metrics from N8N
    
    -- Results
    campaign_results JSONB DEFAULT '{}',
    error_details TEXT,
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workspace N8N Configuration
CREATE TABLE IF NOT EXISTS workspace_n8n_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL UNIQUE,
    
    -- Channel Configuration
    email_enabled BOOLEAN DEFAULT true,
    linkedin_enabled BOOLEAN DEFAULT true,
    execution_sequence TEXT DEFAULT 'email_first' CHECK (execution_sequence IN ('email_only', 'linkedin_only', 'email_first', 'linkedin_first', 'simultaneous')),
    
    -- Email Settings
    email_config JSONB DEFAULT '{}',
    
    -- LinkedIn Settings
    linkedin_config JSONB DEFAULT '{}',
    
    -- Reply Handling
    reply_handling_config JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### API Endpoints Implementation

```typescript
// Priority Implementation Order
const implementationPriority = [
  {
    endpoint: '/api/campaign/execute-n8n',
    description: 'Execute campaign via N8N master workflow',
    priority: 'HIGH',
    estimated_effort: '3 days'
  },
  {
    endpoint: '/api/campaign/n8n-status-update',
    description: 'Receive status updates from N8N workflow',
    priority: 'HIGH', 
    estimated_effort: '2 days'
  },
  {
    endpoint: '/api/workspace/n8n-config',
    description: 'Manage workspace N8N configuration',
    priority: 'MEDIUM',
    estimated_effort: '2 days'
  },
  {
    endpoint: '/api/workspace/test-n8n-connection',
    description: 'Test N8N connectivity and configuration',
    priority: 'MEDIUM',
    estimated_effort: '1 day'
  }
]
```

---

## Implementation Phase Plan

### Phase 1: Basic N8N Integration (Week 2)
- [ ] **Connect to workflows.innovareai.com** - Establish API connection
- [ ] **Identify SAM master workflow ID** - Find existing master workflow
- [ ] **Build campaign execution API** - `/api/campaign/execute-n8n`
- [ ] **Create basic workspace configuration** - Channel preferences setup
- [ ] **Test workflow execution** - End-to-end test with sample data

### Phase 2: Advanced Configuration (Week 3)
- [ ] **Implement workspace configuration management** - Full config API
- [ ] **Build status update webhook handler** - Real-time progress tracking  
- [ ] **Add execution monitoring dashboard** - Campaign progress visualization
- [ ] **Implement error handling and retry logic** - Robust execution handling

### Phase 3: Production Readiness (Week 3-4)
- [ ] **Add comprehensive testing suite** - Unit and integration tests
- [ ] **Implement rate limiting and quota management** - Prevent overuse
- [ ] **Add execution analytics and reporting** - Campaign performance metrics
- [ ] **Create troubleshooting tools** - Debug and monitoring capabilities

This integration ensures that every workspace uses the same proven N8N master workflow while allowing for the necessary customizations in messaging, channels, and response handling, maintaining consistency and reducing maintenance overhead.