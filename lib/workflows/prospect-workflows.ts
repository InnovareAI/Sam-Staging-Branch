/**
 * SAM AI Prospect Research Workflows
 * 
 * Three workflow variations based on plan tiers and business needs
 */

export interface WorkflowConfig {
  planTier: 'startup' | 'sme' | 'enterprise'
  maxProspects: number
  batchSize: number
  validationSampleSize: number
  hasAdvancedBatching: boolean
  hasProgressTracking: boolean
  hasStopResume: boolean
  approvalMethod: 'simple' | 'batch' | 'advanced'
}

export const WORKFLOW_CONFIGS: Record<string, WorkflowConfig> = {
  startup: {
    planTier: 'startup',
    maxProspects: 200,
    batchSize: 20,
    validationSampleSize: 10,
    hasAdvancedBatching: false,
    hasProgressTracking: false,
    hasStopResume: false,
    approvalMethod: 'simple'
  },
  sme: {
    planTier: 'sme', 
    maxProspects: 500,
    batchSize: 50,
    validationSampleSize: 15,
    hasAdvancedBatching: true,
    hasProgressTracking: true,
    hasStopResume: true,
    approvalMethod: 'batch'
  },
  enterprise: {
    planTier: 'enterprise',
    maxProspects: 2000,
    batchSize: 100,
    validationSampleSize: 20,
    hasAdvancedBatching: true,
    hasProgressTracking: true,
    hasStopResume: true,
    approvalMethod: 'advanced'
  }
}

/**
 * 🟢 STARTUP WORKFLOW ($99/month)
 * Target: 50-200 prospects
 * Features: Simple, fast, minimal friction
 */
export const STARTUP_WORKFLOW = `
=== STARTUP PROSPECT WORKFLOW ===

🎯 Philosophy: Quick wins, minimal complexity
• Target Volume: 50-200 prospects total
• Single-batch approach with simple approval
• Focus on speed and immediate results

🔄 Process:
1. **Quick ICP Validation** (10 samples)
   - "Let me show you 10 quick examples to confirm we're targeting the right people"
   - Simple ✅/❌ approval
   
2. **Direct Generation** (20-50 prospects at once)
   - "Perfect! I'll generate your full prospect list now"
   - Show all results in single view
   - One-click approve all or individual selection

3. **Immediate Export**
   - CSV download ready instantly
   - Optional: "Want me to find similar prospects to expand this list?"

Sam's Language:
• "Quick and simple"
• "Let's get you prospects fast"
• "No complexity, just results"
• "Perfect for getting started"
`

/**
 * 🟠 SME WORKFLOW ($399/month)  
 * Target: 200-500 prospects
 * Features: Batch approval, basic tracking, refinement
 */
export const SME_WORKFLOW = `
=== SME PROSPECT WORKFLOW ===

🎯 Philosophy: Balanced scale with quality control
• Target Volume: 200-500 prospects total
• Batch-based approval for quality control
• Progress tracking and refinement options

🔄 Process:
1. **ICP Validation** (15 samples)
   - "I'll show you 15 sample prospects to validate your target criteria"
   - Detailed review with refinement options
   
2. **Batch Generation** (50 prospects per batch)
   - "Great! I'll generate prospects in batches of 50 for easier review"
   - Each batch labeled: Region, Role, Company Size
   - Batch Actions: ✅ Approve All, ❌ Reject Batch, 🔄 Refine Criteria
   
3. **Progress Tracking**
   - "You've approved 150 prospects so far. Continue to 300?"
   - Quality summaries every 100 approved
   - Pause/resume anytime

4. **Enhanced Export**
   - Enriched data with emails, LinkedIn URLs
   - Batch metadata for campaign segmentation
   - Optional CRM integration

Sam's Language:
• "Let's build this systematically"
• "You've approved X prospects so far"
• "Want to refine the next batch?"
• "Perfect for scaling your outreach"
`

/**
 * 🔴 ENTERPRISE WORKFLOW ($899/month)
 * Target: 1000-2000 prospects  
 * Features: Advanced batching, full automation, analytics
 */
export const ENTERPRISE_WORKFLOW = `
=== ENTERPRISE PROSPECT WORKFLOW ===

🎯 Philosophy: Maximum scale with enterprise controls
• Target Volume: 1000-2000 prospects total
• Advanced batch management with automation
• Full analytics and campaign orchestration

🔄 Process:
1. **Strategic ICP Validation** (20 samples)
   - "Let me show you 20 strategic prospects representing different segments"
   - Advanced filtering: Industry, Funding Stage, Tech Stack, Geographic Region
   - A/B test different ICPs simultaneously
   
2. **Advanced Batch Generation** (100 prospects per batch)
   - Auto-labeled batches: "DACH - Series B+ - 200-500 employees - FinTech CTOs"
   - Parallel generation across multiple criteria
   - Smart deduplication across all batches
   
3. **Sophisticated Approval Workflow**
   - Batch Actions: ✅ Approve, ❌ Reject, 🔄 Refine, 📊 Deep Analyze
   - Refinement Options:
     * "Remove companies under 200 employees"
     * "Only Series C+ funded companies"
     * "Add geographic filter: exclude UK"
   
4. **Enterprise Analytics**
   - Progress Dashboard: "850/1500 approved across 12 batches"
   - Quality Metrics: Role distribution, funding stages, industry spread
   - Auto-pause at milestones for review
   
5. **Campaign-Ready Export**
   - Multi-format export (CSV, XLSX, JSON)
   - Direct CRM sync (HubSpot, Salesforce, Pipedrive)
   - Segmentation tags for personalized campaigns
   - Account-based grouping for enterprise sales

Sam's Language:
• "Let's build a comprehensive prospect database"
• "I'm generating across multiple segments simultaneously"  
• "You've approved 850 prospects across 12 industry verticals"
• "Ready to orchestrate campaigns across these segments?"
`

/**
 * Workflow Detection Logic
 */
export function detectWorkflowTier(userPlan?: string, requestedVolume?: number): WorkflowConfig {
  // Plan-based detection
  if (userPlan === 'enterprise' || (requestedVolume && requestedVolume >= 1000)) {
    return WORKFLOW_CONFIGS.enterprise
  }
  
  if (userPlan === 'sme' || (requestedVolume && requestedVolume >= 200)) {
    return WORKFLOW_CONFIGS.sme  
  }
  
  // Default to startup workflow
  return WORKFLOW_CONFIGS.startup
}

/**
 * Workflow State Management
 */
export interface WorkflowState {
  workflowType: 'startup' | 'sme' | 'enterprise'
  stage: 'validation' | 'generation' | 'complete'
  totalTarget: number
  currentApproved: number
  currentBatch: number
  lastBatchSize: number
  canResume: boolean
  metadata: {
    icpCriteria: Record<string, any>
    segmentBreakdown: Record<string, number>
    qualityMetrics: Record<string, number>
  }
}

/**
 * Get workflow-specific prompts
 */
export function getWorkflowPrompt(config: WorkflowConfig, state?: WorkflowState): string {
  switch (config.planTier) {
    case 'enterprise':
      return ENTERPRISE_WORKFLOW
    case 'sme': 
      return SME_WORKFLOW
    case 'startup':
    default:
      return STARTUP_WORKFLOW
  }
}