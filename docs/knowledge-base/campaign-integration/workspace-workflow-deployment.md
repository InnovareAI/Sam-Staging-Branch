# Automatic Workspace Workflow Deployment System
Version: v1.0 | Created: 2025-09-14

## Purpose
This document defines the automatic deployment system that creates a dedicated SAM campaign workflow instance for each new workspace, ensuring workspace isolation while maintaining consistency through a master workflow template.

---

## Workspace Workflow Deployment Architecture

### Deployment Trigger System

```typescript
interface WorkspaceWorkflowDeployment {
  // Deployment Triggers
  deployment_triggers: {
    new_workspace_creation: {
      trigger: 'workspace creation in SAM AI'
      hook: 'POST /api/workspace/create → deploy workflow'
      timing: 'immediately after workspace creation'
      failure_handling: 'rollback workspace creation if workflow deployment fails'
    }
    
    workspace_activation: {
      trigger: 'user completes workspace setup'
      hook: 'workspace status → active'
      timing: 'after initial configuration'
      prerequisites: ['email_configured', 'linkedin_connected', 'user_verified']
    }
    
    manual_deployment: {
      trigger: 'admin manual workflow deployment'
      hook: 'POST /api/admin/deploy-workflow'
      use_case: 'repair failed deployments or update workflows'
    }
  }
  
  // Deployment Process
  deployment_process: {
    master_template_fetch: 'Fetch master workflow from workflows.innovareai.com'
    workspace_customization: 'Customize workflow for specific workspace'
    credential_injection: 'Inject workspace-specific credentials'
    workflow_deployment: 'Deploy customized workflow to N8N'
    validation_testing: 'Test deployed workflow functionality'
    registration: 'Register workflow in SAM database'
  }
}
```

### Master Workflow Template System

```typescript
interface MasterWorkflowTemplate {
  // Template Structure
  template_definition: {
    master_workflow_id: 'SAM_MASTER_CAMPAIGN_TEMPLATE'  // Template workflow
    version: string  // Semantic versioning for template updates
    template_nodes: TemplateNode[]
    template_connections: TemplateConnection[]
    customization_points: CustomizationPoint[]
  }
  
  // Customization Points
  customization_points: {
    workspace_variables: {
      workspace_id: '{{WORKSPACE_ID}}'
      workspace_name: '{{WORKSPACE_NAME}}'
      user_id: '{{USER_ID}}'
      supabase_url: '{{SUPABASE_URL}}'
      supabase_key: '{{SUPABASE_SERVICE_KEY}}'
    }
    
    credential_placeholders: {
      email_smtp_credentials: '{{EMAIL_SMTP_CREDENTIAL_ID}}'
      unipile_api_credentials: '{{UNIPILE_CREDENTIAL_ID}}'
      openai_api_credentials: '{{OPENAI_CREDENTIAL_ID}}'
      webhook_urls: '{{SAM_WEBHOOK_URLS}}'
    }
    
    workflow_configuration: {
      workspace_preferences: '{{WORKSPACE_CONFIG}}'
      default_templates: '{{DEFAULT_EMAIL_TEMPLATES}}'
      reply_handling_rules: '{{REPLY_HANDLING_CONFIG}}'
      rate_limits: '{{RATE_LIMIT_CONFIG}}'
    }
  }
  
  // Workspace-Specific Customizations
  workspace_customizations: {
    channel_configuration: 'Enable/disable email and LinkedIn nodes'
    messaging_templates: 'Inject workspace-approved messaging'
    personalization_fields: 'Configure available personalization data'
    response_webhooks: 'Point responses back to workspace-specific endpoints'
  }
}
```

---

## Database Schema for Workflow Management

### Workspace Workflow Tracking

```sql
-- Track deployed workflows per workspace
CREATE TABLE IF NOT EXISTS workspace_n8n_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL UNIQUE,
    
    -- N8N Workflow Details
    n8n_workflow_id TEXT NOT NULL UNIQUE,
    workflow_name TEXT NOT NULL,
    workflow_version TEXT DEFAULT '1.0.0',
    
    -- Template Information
    master_template_id TEXT DEFAULT 'SAM_MASTER_CAMPAIGN_TEMPLATE',
    template_version TEXT NOT NULL,
    
    -- Deployment Status
    deployment_status TEXT DEFAULT 'pending' CHECK (deployment_status IN ('pending', 'deploying', 'active', 'failed', 'updating', 'disabled')),
    deployment_error TEXT,
    
    -- Workflow Configuration
    workspace_config JSONB NOT NULL DEFAULT '{}',
    credential_mappings JSONB NOT NULL DEFAULT '{}',
    customization_applied JSONB NOT NULL DEFAULT '{}',
    
    -- Health Monitoring
    last_health_check TIMESTAMP WITH TIME ZONE,
    health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'warning', 'error', 'unknown')),
    
    -- Timestamps
    deployed_at TIMESTAMP WITH TIME ZONE,
    last_updated TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Track workflow deployment history and updates
CREATE TABLE IF NOT EXISTS workflow_deployment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_workflow_id UUID REFERENCES workspace_n8n_workflows(id) ON DELETE CASCADE,
    
    -- Deployment Details
    deployment_type TEXT NOT NULL CHECK (deployment_type IN ('initial', 'update', 'repair', 'migration')),
    template_version TEXT NOT NULL,
    
    -- Deployment Process
    deployment_steps JSONB NOT NULL DEFAULT '{}',
    deployment_duration INTERVAL,
    deployment_success BOOLEAN NOT NULL,
    deployment_error TEXT,
    
    -- Changes Made
    changes_applied JSONB DEFAULT '{}',
    rollback_data JSONB DEFAULT '{}',
    
    -- Metadata
    deployed_by TEXT NOT NULL,  -- user_id or 'system'
    deployment_reason TEXT,
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Store master workflow template versions
CREATE TABLE IF NOT EXISTS workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Template Identity
    template_id TEXT NOT NULL,
    version TEXT NOT NULL,
    template_name TEXT NOT NULL,
    
    -- Template Definition
    template_definition JSONB NOT NULL,
    customization_schema JSONB NOT NULL DEFAULT '{}',
    
    -- Template Metadata
    description TEXT,
    changelog TEXT,
    compatibility_requirements JSONB DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN DEFAULT false,
    is_deprecated BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(template_id, version)
);

-- Indexes
CREATE INDEX idx_workspace_workflows_workspace_id ON workspace_n8n_workflows(workspace_id);
CREATE INDEX idx_workspace_workflows_status ON workspace_n8n_workflows(deployment_status);
CREATE INDEX idx_deployment_history_workspace ON workflow_deployment_history(workspace_workflow_id);
CREATE INDEX idx_workflow_templates_active ON workflow_templates(template_id, is_active) WHERE is_active = true;
```

---

## API Endpoints for Workflow Deployment

### Automatic Deployment Integration

```typescript
// Integrated into existing workspace creation
// POST /api/workspace/create (ENHANCED)
interface CreateWorkspaceRequest {
  name: string
  company_id?: string
  settings?: WorkspaceSettings
  
  // NEW: Workflow deployment options
  deploy_workflow: boolean  // Default: true
  workflow_template_version?: string  // Default: latest
  workflow_customizations?: WorkflowCustomizations
}

interface CreateWorkspaceResponse {
  success: boolean
  workspace: Workspace
  
  // NEW: Workflow deployment results
  workflow_deployment: {
    status: 'pending' | 'deployed' | 'failed'
    n8n_workflow_id?: string
    deployment_error?: string
    estimated_completion_time?: string
  }
}

// POST /api/workspace/deploy-workflow
interface DeployWorkflowRequest {
  workspace_id: string
  template_version?: string  // Default: latest
  force_redeploy?: boolean  // Redeploy even if exists
  customizations?: WorkflowCustomizations
}

interface DeployWorkflowResponse {
  success: boolean
  deployment_id: string
  n8n_workflow_id: string
  deployment_status: 'deploying' | 'deployed' | 'failed'
  monitoring_url: string
}

// GET /api/workspace/:id/workflow-status
interface WorkflowStatusResponse {
  workspace_id: string
  deployment_status: 'pending' | 'deploying' | 'active' | 'failed' | 'updating' | 'disabled'
  n8n_workflow_id?: string
  health_status: 'healthy' | 'warning' | 'error' | 'unknown'
  last_execution?: string
  error_details?: string
  
  capabilities: {
    email_campaigns: boolean
    linkedin_campaigns: boolean
    multi_channel: boolean
    response_handling: boolean
  }
}
```

### Deployment Management APIs

```typescript
// POST /api/admin/workflow-template/update
interface UpdateWorkflowTemplateRequest {
  template_id: string
  version: string
  template_definition: object
  changelog: string
  auto_deploy_to_workspaces?: boolean  // Deploy to all active workspaces
}

// GET /api/admin/workflow-deployments
interface ListWorkflowDeploymentsResponse {
  deployments: {
    workspace_id: string
    workspace_name: string
    deployment_status: string
    n8n_workflow_id: string
    template_version: string
    health_status: string
    last_updated: string
  }[]
  summary: {
    total_workspaces: number
    deployed: number
    pending: number
    failed: number
    healthy: number
  }
}

// POST /api/admin/workflow-deployment/repair
interface RepairWorkflowDeploymentRequest {
  workspace_id: string
  repair_type: 'redeploy' | 'update_credentials' | 'fix_configuration'
  force_repair?: boolean
}
```

---

## Deployment Process Implementation

### Step 1: Master Template Retrieval

```typescript
class WorkflowDeploymentService {
  async fetchMasterTemplate(templateVersion?: string): Promise<WorkflowTemplate> {
    try {
      // Get latest template version if not specified
      const version = templateVersion || await this.getLatestTemplateVersion()
      
      // Fetch template from N8N master instance
      const template = await this.n8nClient.getWorkflow('SAM_MASTER_CAMPAIGN_TEMPLATE')
      
      // Store template in our database for versioning
      await this.storeTemplateVersion(template, version)
      
      return template
    } catch (error) {
      throw new Error(`Failed to fetch master template: ${error.message}`)
    }
  }
  
  private async getLatestTemplateVersion(): Promise<string> {
    const latestTemplate = await supabase
      .from('workflow_templates')
      .select('version')
      .eq('template_id', 'SAM_MASTER_CAMPAIGN_TEMPLATE')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    return latestTemplate?.data?.version || '1.0.0'
  }
}
```

### Step 2: Workspace Customization

```typescript
interface WorkspaceCustomizationService {
  async customizeWorkflowForWorkspace(
    masterTemplate: WorkflowTemplate, 
    workspaceConfig: WorkspaceConfig
  ): Promise<CustomizedWorkflow> {
    
    const customizedWorkflow = { ...masterTemplate }
    
    // 1. Replace workspace variables
    customizedWorkflow.name = `SAM Campaign - ${workspaceConfig.workspace_name}`
    
    // 2. Configure workspace-specific nodes
    customizedWorkflow.nodes = await this.customizeNodes(
      masterTemplate.nodes, 
      workspaceConfig
    )
    
    // 3. Inject workspace credentials
    customizedWorkflow.credentials = await this.injectCredentials(
      masterTemplate.credentials,
      workspaceConfig
    )
    
    // 4. Configure webhook URLs
    customizedWorkflow.webhooks = this.configureWebhooks(workspaceConfig)
    
    // 5. Apply channel preferences (enable/disable nodes)
    if (!workspaceConfig.email_enabled) {
      customizedWorkflow.nodes = this.disableEmailNodes(customizedWorkflow.nodes)
    }
    
    if (!workspaceConfig.linkedin_enabled) {
      customizedWorkflow.nodes = this.disableLinkedInNodes(customizedWorkflow.nodes)
    }
    
    return customizedWorkflow
  }
  
  private async customizeNodes(nodes: WorkflowNode[], config: WorkspaceConfig): Promise<WorkflowNode[]> {
    return nodes.map(node => {
      // Replace placeholder variables
      node.parameters = this.replacePlaceholders(node.parameters, {
        WORKSPACE_ID: config.workspace_id,
        WORKSPACE_NAME: config.workspace_name,
        USER_ID: config.user_id,
        SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
      })
      
      // Configure workspace-specific settings
      if (node.type === 'webhook') {
        node.parameters.path = `/webhook/${config.workspace_id}/${node.parameters.path}`
      }
      
      if (node.type === 'supabase') {
        node.parameters.workspace_filter = config.workspace_id
      }
      
      return node
    })
  }
}
```

### Step 3: Credential Management

```typescript
interface CredentialManagementService {
  async setupWorkspaceCredentials(workspaceId: string): Promise<CredentialMappings> {
    const credentials: CredentialMappings = {}
    
    // 1. Email credentials (from workspace email configuration)
    const emailConfig = await this.getWorkspaceEmailConfig(workspaceId)
    if (emailConfig) {
      credentials.email_smtp = await this.createN8NCredential({
        name: `Email SMTP - ${workspaceId}`,
        type: 'smtp',
        data: {
          host: emailConfig.smtp_host,
          port: emailConfig.smtp_port,
          user: emailConfig.smtp_user,
          password: emailConfig.smtp_password
        }
      })
    }
    
    // 2. Unipile credentials (LinkedIn integration)
    const unipileConfig = await this.getWorkspaceUnipileConfig(workspaceId)
    if (unipileConfig) {
      credentials.unipile_api = await this.createN8NCredential({
        name: `Unipile - ${workspaceId}`,
        type: 'httpHeaderAuth',
        data: {
          name: 'Authorization',
          value: `Bearer ${unipileConfig.api_key}`
        }
      })
    }
    
    // 3. OpenAI credentials (for AI-powered features)
    credentials.openai_api = await this.createN8NCredential({
      name: `OpenAI - ${workspaceId}`,
      type: 'openAiApi',
      data: {
        apiKey: process.env.OPENAI_API_KEY
      }
    })
    
    return credentials
  }
}
```

### Step 4: Deployment Execution

```typescript
interface DeploymentExecutionService {
  async deployWorkflowToWorkspace(
    workspaceId: string, 
    customizedWorkflow: CustomizedWorkflow
  ): Promise<DeploymentResult> {
    
    const deploymentId = generateId()
    
    try {
      // 1. Create deployment record
      await this.createDeploymentRecord(deploymentId, workspaceId, 'initial')
      
      // 2. Deploy workflow to N8N
      const deployedWorkflow = await this.n8nClient.createWorkflow(customizedWorkflow)
      
      // 3. Activate workflow
      await this.n8nClient.activateWorkflow(deployedWorkflow.id)
      
      // 4. Test workflow functionality
      const testResult = await this.testWorkflowFunctionality(deployedWorkflow.id)
      
      // 5. Register successful deployment
      await this.registerWorkflowDeployment(workspaceId, deployedWorkflow.id, testResult)
      
      // 6. Update deployment record
      await this.completeDeploymentRecord(deploymentId, true)
      
      return {
        success: true,
        n8n_workflow_id: deployedWorkflow.id,
        deployment_id: deploymentId,
        test_results: testResult
      }
      
    } catch (error) {
      // Handle deployment failure
      await this.completeDeploymentRecord(deploymentId, false, error.message)
      throw error
    }
  }
  
  private async testWorkflowFunctionality(workflowId: string): Promise<TestResult> {
    // Test basic workflow functionality
    const testExecution = await this.n8nClient.executeWorkflow(workflowId, {
      test: true,
      workspace_id: 'test',
      prospects: [{ name: 'Test Prospect', email: 'test@example.com' }]
    })
    
    return {
      execution_successful: testExecution.status === 'success',
      nodes_executed: testExecution.data?.executedNodes || 0,
      execution_time: testExecution.finishedAt - testExecution.startedAt,
      errors: testExecution.error ? [testExecution.error] : []
    }
  }
}
```

---

## Integration with Workspace Creation

### Enhanced Workspace Creation Hook

```typescript
// Update existing workspace creation process
export async function createWorkspace(req: CreateWorkspaceRequest): Promise<CreateWorkspaceResponse> {
  const transaction = await supabase.rpc('begin_transaction')
  
  try {
    // 1. Create workspace (existing logic)
    const workspace = await createWorkspaceRecord(req)
    
    // 2. Deploy N8N workflow (NEW)
    const workflowDeployment = req.deploy_workflow ? 
      await deployWorkflowForWorkspace(workspace.id, req.workflow_customizations) :
      null
    
    // 3. Complete workspace setup
    await completeWorkspaceSetup(workspace.id)
    
    await supabase.rpc('commit_transaction')
    
    return {
      success: true,
      workspace,
      workflow_deployment: workflowDeployment ? {
        status: workflowDeployment.status,
        n8n_workflow_id: workflowDeployment.n8n_workflow_id,
        deployment_error: workflowDeployment.error
      } : null
    }
    
  } catch (error) {
    await supabase.rpc('rollback_transaction')
    throw error
  }
}

async function deployWorkflowForWorkspace(
  workspaceId: string, 
  customizations?: WorkflowCustomizations
): Promise<DeploymentResult> {
  
  const deploymentService = new WorkflowDeploymentService()
  
  // Get workspace configuration
  const workspaceConfig = await getWorkspaceConfig(workspaceId)
  
  // Deploy workflow
  return await deploymentService.deployWorkflow(workspaceId, workspaceConfig, customizations)
}
```

---

## Implementation Priority

### Phase 1: Core Deployment System (Week 2)
- [ ] **Create database tables** for workflow tracking
- [ ] **Build basic deployment service** - Template fetch and customization
- [ ] **Integrate with workspace creation** - Auto-deploy on new workspace
- [ ] **Create deployment status API** - Monitor deployment progress

### Phase 2: Advanced Features (Week 3)
- [ ] **Credential management system** - Workspace-specific credential injection
- [ ] **Deployment testing and validation** - Ensure workflows work after deployment
- [ ] **Workflow health monitoring** - Ongoing health checks and alerts
- [ ] **Deployment repair system** - Fix failed or broken deployments

### Phase 3: Management Tools (Week 3-4)
- [ ] **Admin deployment dashboard** - Manage all workspace deployments
- [ ] **Template versioning system** - Manage workflow template updates
- [ ] **Bulk deployment updates** - Update all workspace workflows
- [ ] **Deployment analytics** - Track deployment success rates and issues

This system ensures every workspace gets its own properly configured workflow instance while maintaining consistency through the master template, providing workspace isolation and customization capabilities.