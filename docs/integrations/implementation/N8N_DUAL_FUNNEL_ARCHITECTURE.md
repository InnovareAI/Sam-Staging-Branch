# N8N Dual Funnel Architecture

**Implementation Date**: September 23, 2025  
**Status**: 🚧 In Development  
**Approach**: Simultaneous development of Core + Dynamic funnels  

## Architecture Overview

Sam AI will support two distinct N8N integration approaches, each optimized for different use cases while sharing common infrastructure.

```
┌─────────────────────────────────────────────────────────────┐
│                     SAM AI N8N INTEGRATION                 │
├─────────────────────────────────────────────────────────────┤
│  Shared Infrastructure                                      │
│  • N8N API Client                                         │
│  • Webhook Management                                      │
│  • Execution Monitoring                                   │
│  • Database Schema                                         │
└─────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
┌──────────────────────┐           ┌──────────────────────┐
│   SAM CORE FUNNEL    │           │  SAM DYNAMIC FUNNEL  │
│                      │           │                      │
│ 🎯 Standardized      │           │ 🌟 AI-Generated      │
│ 🔧 Pre-built         │           │ 💬 Conversational    │
│ ⚡ Fast Deploy       │           │ 🎨 Customizable      │
│ 📊 Proven ROI        │           │ 🚀 Innovative        │
└──────────────────────┘           └──────────────────────┘
```

## 1. SAM Core Funnel

### Purpose
Standardized, high-performance sales funnels with proven conversion rates.

### Characteristics
- **Pre-built Workflows**: Battle-tested N8N workflows ready for immediate use
- **Standardized Templates**: Consistent messaging optimized for different industries
- **Fixed Sequences**: Proven timing and follow-up patterns
- **One-Click Deployment**: Minimal configuration required
- **Performance Tracking**: Established KPIs and benchmarks

### Core Funnel Types

#### 1. **SAM Signature Funnel**
```
Day 1: LinkedIn Connection Request
Day 3: Thank You + Value Proposition
Day 7: Case Study Share
Day 14: Soft Pitch + Meeting Request
Day 21: Final Follow-up
```

#### 2. **Event Invitation Funnel**
```
Day 1: Event Invitation
Day 3: Event Value Reinforcement
Day 7: Last Chance Reminder
Day 10: Post-Event Follow-up (if attended)
Day 10: Alternative Offer (if not attended)
```

#### 3. **Product Launch Funnel**
```
Day 1: Launch Announcement
Day 4: Product Demo Invitation
Day 8: Customer Success Story
Day 15: Limited-Time Offer
Day 22: Final Call-to-Action
```

### Implementation

#### Database Schema
```sql
-- Core Funnel Templates
CREATE TABLE core_funnel_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_type TEXT NOT NULL, -- 'sam_signature', 'event_invitation', 'product_launch'
  name TEXT NOT NULL,
  description TEXT,
  industry TEXT, -- 'technology', 'finance', 'healthcare', 'general'
  n8n_workflow_id TEXT NOT NULL,
  conversion_rate DECIMAL,
  avg_response_rate DECIMAL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Core Funnel Executions
CREATE TABLE core_funnel_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id),
  template_id UUID REFERENCES core_funnel_templates(id),
  n8n_execution_id TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  prospects_total INTEGER,
  prospects_processed INTEGER DEFAULT 0,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### MCP Tools
```typescript
// Core Funnel MCP Tools
export async function mcp__core_funnel__list_templates(filters: {
  industry?: string;
  funnel_type?: string;
}): Promise<CoreFunnelTemplate[]>

export async function mcp__core_funnel__execute(request: {
  template_id: string;
  campaign_id: string;
  prospects: ProspectData[];
}): Promise<CoreFunnelExecution>

export async function mcp__core_funnel__get_status(execution_id: string): Promise<CoreFunnelStatus>
```

## 2. Sam Dynamic Flexible Funnels

### Purpose
AI-generated, conversational funnel creation for unique business needs and experimental approaches.

### Characteristics
- **AI-Generated Workflows**: Sam creates custom N8N workflows from conversation
- **Dynamic Templates**: Personalized messaging for specific use cases
- **Adaptive Sequences**: Workflows that adjust based on prospect behavior
- **Conversational Interface**: "Create a funnel targeting fintech CEOs about compliance"
- **Unlimited Customization**: No constraints on funnel structure or messaging

### Dynamic Funnel Capabilities

#### 1. **Conversational Funnel Design**
```
User: "Create a funnel for SaaS CTOs about security concerns"
Sam: Creates custom workflow with:
  - Security-focused messaging
  - Technical case studies
  - Compliance documentation
  - CTO-specific pain points
  - Custom timing based on buying cycle
```

#### 2. **AI-Powered Personalization**
```
User: "Make this funnel more aggressive for enterprise prospects"
Sam: Adjusts workflow to:
  - Shorter time intervals
  - More direct messaging
  - Executive-level value props
  - Competitive urgency
  - High-value offers
```

#### 3. **Adaptive Response Handling**
```
Prospect responds positively → Accelerate to meeting booking
Prospect shows objections → Route to objection-handling sequence
Prospect goes silent → Switch to re-engagement pattern
```

### Implementation

#### Database Schema
```sql
-- Dynamic Funnel Definitions
CREATE TABLE dynamic_funnel_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id),
  name TEXT NOT NULL,
  description TEXT,
  ai_prompt TEXT, -- Original conversation prompt
  target_persona JSONB, -- Detailed prospect profile
  funnel_logic JSONB, -- Custom workflow logic
  n8n_workflow_json JSONB, -- Generated N8N workflow
  n8n_workflow_id TEXT,
  created_by_sam BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Dynamic Funnel Steps
CREATE TABLE dynamic_funnel_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID REFERENCES dynamic_funnel_definitions(id),
  step_order INTEGER,
  step_type TEXT, -- 'message', 'wait', 'condition', 'webhook'
  trigger_condition JSONB,
  message_template TEXT,
  wait_duration INTERVAL,
  success_action JSONB,
  failure_action JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Dynamic Funnel Executions
CREATE TABLE dynamic_funnel_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID REFERENCES dynamic_funnel_definitions(id),
  campaign_id UUID REFERENCES campaigns(id),
  n8n_execution_id TEXT,
  status TEXT DEFAULT 'pending',
  current_step INTEGER DEFAULT 1,
  prospects_total INTEGER,
  prospects_in_step JSONB, -- Track prospects at each step
  adaptation_history JSONB, -- Track AI adaptations
  performance_metrics JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### MCP Tools
```typescript
// Dynamic Funnel MCP Tools
export async function mcp__dynamic_funnel__create_from_conversation(request: {
  conversation_context: string;
  target_persona: ProspectPersona;
  business_objective: string;
  constraints?: FunnelConstraints;
}): Promise<DynamicFunnelDefinition>

export async function mcp__dynamic_funnel__modify(request: {
  funnel_id: string;
  modification_request: string;
  context?: string;
}): Promise<DynamicFunnelDefinition>

export async function mcp__dynamic_funnel__execute(request: {
  funnel_id: string;
  campaign_id: string;
  prospects: ProspectData[];
}): Promise<DynamicFunnelExecution>

export async function mcp__dynamic_funnel__adapt(request: {
  execution_id: string;
  response_data: ResponseData;
  adaptation_trigger: string;
}): Promise<FunnelAdaptation>
```

## Shared Infrastructure

### N8N API Client
```typescript
// lib/n8n/n8n-client.ts
export class N8NClient {
  private baseUrl: string;
  private apiKey: string;

  // Core Funnel Operations
  async deployCoreFunnel(templateId: string, variables: Record<string, any>): Promise<string>
  async executeCoreFunnel(workflowId: string, prospects: ProspectData[]): Promise<string>
  
  // Dynamic Funnel Operations
  async createDynamicWorkflow(definition: WorkflowDefinition): Promise<string>
  async updateDynamicWorkflow(workflowId: string, changes: WorkflowChanges): Promise<boolean>
  async executeDynamicFunnel(workflowId: string, data: any): Promise<string>
  
  // Shared Operations
  async getExecutionStatus(executionId: string): Promise<ExecutionStatus>
  async stopExecution(executionId: string): Promise<boolean>
  async getExecutionLogs(executionId: string): Promise<ExecutionLog[]>
}
```

### Webhook Management
```typescript
// lib/n8n/webhook-manager.ts
export class WebhookManager {
  // Handle incoming webhooks from N8N workflows
  async handleWorkflowWebhook(payload: WebhookPayload): Promise<void>
  
  // Route to appropriate handler based on funnel type
  async routeCoreFunnelWebhook(payload: CoreFunnelWebhook): Promise<void>
  async routeDynamicFunnelWebhook(payload: DynamicFunnelWebhook): Promise<void>
  
  // Update prospect status and trigger next actions
  async updateProspectProgress(prospectId: string, stepData: StepData): Promise<void>
}
```

## Conversational Interface Integration

### Sam's Funnel Selection Logic
```typescript
// In sam-mcp-handler.ts
function detectFunnelType(userInput: string): 'core' | 'dynamic' | 'unclear' {
  // Core funnel indicators
  if (/standard|proven|template|quick|fast/.test(userInput.toLowerCase())) {
    return 'core';
  }
  
  // Dynamic funnel indicators  
  if (/custom|specific|unique|create.*funnel|build.*sequence/.test(userInput.toLowerCase())) {
    return 'dynamic';
  }
  
  return 'unclear';
}

async function handleFunnelCreation(input: string, context: ConversationContext): Promise<SamMCPResponse> {
  const funnelType = detectFunnelType(input);
  
  switch (funnelType) {
    case 'core':
      return await handleCoreFunnelSelection(input, context);
    
    case 'dynamic':
      return await handleDynamicFunnelCreation(input, context);
    
    case 'unclear':
      return await promptForFunnelTypeClarity(input, context);
  }
}
```

### Sam's Response Examples

#### Core Funnel Selection
```
User: "I need a proven funnel for tech startups"
Sam: "Perfect! I'll set up our SAM Signature Funnel optimized for technology startups. This is our highest-converting sequence with a 23% response rate for tech prospects.

✅ **SAM Signature Funnel - Tech Startup Edition**
• Day 1: LinkedIn connection with startup-specific value prop
• Day 3: Thank you + relevant tech case study
• Day 7: ROI-focused case study from similar startup
• Day 14: Demo invitation with competitive advantage angle
• Day 21: Final follow-up with risk-reversal offer

This funnel typically generates 15-25% response rates for tech startups. Ready to execute with your prospect list?"
```

#### Dynamic Funnel Creation
```
User: "Create a funnel targeting healthcare CFOs about cost reduction during budget season"
Sam: "Excellent! I'll create a custom funnel specifically for healthcare CFOs focused on budget-season cost reduction. This is highly specialized, so I'll build a dynamic sequence.

🎯 **Custom Healthcare CFO Budget-Season Funnel**

Let me design this with:
• Healthcare industry compliance considerations
• CFO-specific financial language and metrics
• Budget season urgency and timing
• Cost reduction case studies from healthcare clients
• Healthcare-specific ROI calculations

I'll create a 6-touch sequence over 18 days, timed for maximum budget-season impact. The messaging will focus on immediate cost savings and quick implementation.

Should I proceed with this custom funnel design?"
```

## Database Integration

### Unified Campaign Management
```sql
-- Enhanced campaigns table to support both funnel types
ALTER TABLE campaigns ADD COLUMN funnel_type TEXT CHECK (funnel_type IN ('core', 'dynamic'));
ALTER TABLE campaigns ADD COLUMN core_template_id UUID REFERENCES core_funnel_templates(id);
ALTER TABLE campaigns ADD COLUMN dynamic_definition_id UUID REFERENCES dynamic_funnel_definitions(id);
ALTER TABLE campaigns ADD COLUMN n8n_workflow_id TEXT;
ALTER TABLE campaigns ADD COLUMN n8n_execution_id TEXT;
```

### Performance Tracking
```sql
-- Unified performance metrics for both funnel types
CREATE TABLE funnel_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id),
  funnel_type TEXT NOT NULL, -- 'core' or 'dynamic'
  template_or_definition_id UUID, -- References either core template or dynamic definition
  
  -- Standard metrics
  prospects_total INTEGER,
  prospects_contacted INTEGER DEFAULT 0,
  prospects_responded INTEGER DEFAULT 0,
  prospects_converted INTEGER DEFAULT 0,
  response_rate DECIMAL GENERATED ALWAYS AS (
    CASE WHEN prospects_contacted > 0 
    THEN (prospects_responded::DECIMAL / prospects_contacted::DECIMAL) * 100 
    ELSE 0 END
  ) STORED,
  conversion_rate DECIMAL GENERATED ALWAYS AS (
    CASE WHEN prospects_responded > 0 
    THEN (prospects_converted::DECIMAL / prospects_responded::DECIMAL) * 100 
    ELSE 0 END
  ) STORED,
  
  -- Step-by-step performance
  step_performance JSONB, -- Detailed metrics per funnel step
  
  -- Timing metrics
  avg_response_time INTERVAL,
  funnel_completion_rate DECIMAL,
  
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Implementation Phases

### Phase 1: Shared Infrastructure (Week 1)
- [ ] N8N API client development
- [ ] Database schema creation
- [ ] Webhook management system
- [ ] Basic monitoring and logging

### Phase 2: Core Funnel System (Week 2)
- [ ] Core funnel templates design
- [ ] Pre-built N8N workflows
- [ ] Core funnel MCP tools
- [ ] Performance tracking for core funnels

### Phase 3: Dynamic Funnel System (Week 3)
- [ ] AI-powered workflow generation
- [ ] Dynamic funnel MCP tools
- [ ] Conversational funnel creation
- [ ] Adaptive response handling

### Phase 4: Integration & Testing (Week 4)
- [ ] Sam conversation interface integration
- [ ] Unified performance analytics
- [ ] A/B testing between funnel types
- [ ] Production deployment and monitoring

## Key Differentiators

### SAM Core Funnel Advantages
- **Immediate Value**: Deploy proven funnels in minutes
- **Predictable ROI**: Established performance benchmarks
- **Minimal Risk**: Battle-tested sequences with known outcomes
- **Easy Scale**: One-click deployment for multiple campaigns

### Sam Dynamic Funnel Advantages
- **Unlimited Creativity**: No constraints on funnel design
- **Perfect Personalization**: AI-generated messaging for any use case
- **Competitive Edge**: Unique approaches competitors can't replicate
- **Learning System**: Continuously improving based on results

### Combined Power
- **Best of Both**: Use core funnels for volume, dynamic for specialization
- **Seamless Switching**: Convert core to dynamic or vice versa
- **Unified Analytics**: Compare performance across both approaches
- **Progressive Enhancement**: Start with core, evolve to dynamic

## Success Metrics

### Core Funnel KPIs
- Deployment speed (target: < 5 minutes)
- Template performance consistency (target: ±5% from benchmark)
- Scaling efficiency (prospects per hour processed)

### Dynamic Funnel KPIs  
- Creation speed (target: < 15 minutes for complex funnels)
- Personalization accuracy (AI-generated relevance score)
- Adaptation effectiveness (performance improvement after changes)

### Combined KPIs
- Overall campaign success rate
- User preference distribution (core vs dynamic)
- Revenue attribution per funnel type
- Customer satisfaction and Net Promoter Score

This dual architecture provides immediate value through proven core funnels while enabling unlimited innovation through AI-powered dynamic funnels, giving Sam AI the most comprehensive and flexible funnel system in the market.

---

**Next Steps**: Implement shared infrastructure first, then develop both funnel types in parallel with continuous integration and testing.