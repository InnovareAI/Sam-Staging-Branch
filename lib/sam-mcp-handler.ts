/**
 * Sam AI MCP Handler
 * Integrates Sam conversation interface with MCP tools for campaign orchestration
 */

import { mcpRegistry } from '@/lib/mcp/mcp-registry'
import { MCPCallToolRequest } from '@/lib/mcp/types'

export interface SamMCPRequest {
  input: string
  threadId: string
  userId?: string
  workspaceId: string
  conversationContext?: any
}

export interface SamMCPResponse {
  success: boolean
  message: string
  toolsUsed: string[]
  data?: any
  error?: string
  suggestedActions?: string[]
}

/**
 * Main Sam MCP Handler - Routes conversation input to appropriate MCP tools
 */
export async function handleSamMCPRequest(request: SamMCPRequest): Promise<SamMCPResponse> {
  const { input, threadId, workspaceId, conversationContext } = request
  const lowerInput = input.toLowerCase()

  try {
    // N8N Funnel Commands - Core & Dynamic
    if (detectFunnelCommands(lowerInput)) {
      return await handleFunnelCommands(input, workspaceId, conversationContext)
    }

    // Campaign Creation Commands
    if (detectCampaignCreation(lowerInput)) {
      return await handleCampaignCreation(input, workspaceId, conversationContext)
    }

    // Campaign Execution Commands  
    if (detectCampaignExecution(lowerInput)) {
      return await handleCampaignExecution(input, workspaceId, conversationContext)
    }

    // Campaign Status/Monitoring Commands
    if (detectCampaignStatus(lowerInput)) {
      return await handleCampaignStatus(input, workspaceId, conversationContext)
    }

    // Template Management Commands
    if (detectTemplateManagement(lowerInput)) {
      return await handleTemplateManagement(input, workspaceId, conversationContext)
    }

    // Template Optimization Commands
    if (detectTemplateOptimization(lowerInput)) {
      return await handleTemplateOptimization(input, workspaceId, conversationContext)
    }

    // Performance Analysis Commands
    if (detectPerformanceAnalysis(lowerInput)) {
      return await handlePerformanceAnalysis(input, workspaceId, conversationContext)
    }

    // Not a recognized MCP command
    return {
      success: false,
      message: "I don't recognize that as a campaign management command. Try asking about creating campaigns, templates, or performance analysis.",
      toolsUsed: [],
      suggestedActions: [
        "Create a SAM Core Funnel for tech startups",
        "Build a custom funnel for healthcare CFOs",
        "Show me my top performing templates", 
        "How is my latest campaign performing?",
        "Create a proven funnel for quick results"
      ]
    }

  } catch (error) {
    return {
      success: false,
      message: `I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      toolsUsed: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Detection Functions

/**
 * Detect N8N Funnel Commands (Core & Dynamic)
 */
function detectFunnelCommands(input: string): boolean {
  return /funnel|sequence|core.*funnel|dynamic.*funnel|sam.*signature|event.*invitation|product.*launch|custom.*funnel|proven.*funnel|standardized.*funnel|ai.*generated.*funnel/i.test(input)
}

function detectCampaignCreation(input: string): boolean {
  return /create.*campaign|new.*campaign|campaign.*target|campaign.*for/i.test(input)
}

function detectCampaignExecution(input: string): boolean {
  return /execute.*campaign|launch.*campaign|start.*campaign|run.*campaign|send.*campaign/i.test(input)
}

function detectCampaignStatus(input: string): boolean {
  return /campaign.*status|campaign.*progress|how.*campaign|campaign.*performing/i.test(input)
}

function detectTemplateManagement(input: string): boolean {
  return /create.*template|new.*template|template.*for|show.*template|my.*template/i.test(input)
}

function detectTemplateOptimization(input: string): boolean {
  return /optimize.*template|improve.*template|template.*performance|better.*template/i.test(input)
}

function detectPerformanceAnalysis(input: string): boolean {
  return /performance.*analysis|analyze.*performance|template.*stats|campaign.*metrics/i.test(input)
}

// Handler Functions

/**
 * Handle N8N Funnel Commands - Routes to Core or Dynamic funnels
 */
async function handleFunnelCommands(input: string, workspaceId: string, context?: any): Promise<SamMCPResponse> {
  const funnelType = detectFunnelType(input)
  
  switch (funnelType) {
    case 'core':
      return await handleCoreFunnelCommands(input, workspaceId, context)
    
    case 'dynamic':
      return await handleDynamicFunnelCommands(input, workspaceId, context)
    
    case 'unclear':
      return await promptForFunnelTypeClarity(input, workspaceId, context)
      
    default:
      return await promptForFunnelTypeClarity(input, workspaceId, context)
  }
}

/**
 * Handle SAM Core Funnel commands
 */
async function handleCoreFunnelCommands(input: string, workspaceId: string, context?: any): Promise<SamMCPResponse> {
  const lowerInput = input.toLowerCase()
  
  try {
    // List Core Funnel Templates
    if (/list|show|available.*funnel|funnel.*template/i.test(input)) {
      const filters = parseCoreFunnelFilters(input)
      
      const mcpRequest: MCPCallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'mcp__core_funnel__list_templates',
          arguments: filters
        }
      }

      const result = await mcpRegistry.callTool(mcpRequest)
      
      if (result.isError) {
        return {
          success: false,
          message: `I couldn't list core funnel templates: ${result.content[0]?.text || 'Unknown error'}`,
          toolsUsed: ['mcp__core_funnel__list_templates'],
          error: result.content[0]?.text
        }
      }

      const templates = JSON.parse(result.content[0]?.text || '[]')
      
      return {
        success: true,
        message: formatCoreFunnelTemplatesResponse(templates),
        toolsUsed: ['mcp__core_funnel__list_templates'],
        data: templates,
        suggestedActions: [
          `Execute ${templates[0]?.name || 'top template'} with my prospects`,
          `Get details about SAM Signature Funnel`,
          `Compare template performance`,
          `Create campaign with proven funnel`
        ]
      }
    }
    
    // Execute Core Funnel
    if (/execute|run|deploy|start.*funnel/i.test(input)) {
      const executionRequest = parseCoreFunnelExecutionInput(input, workspaceId, context)
      
      const mcpRequest: MCPCallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'mcp__core_funnel__execute',
          arguments: executionRequest
        }
      }

      const result = await mcpRegistry.callTool(mcpRequest)
      
      if (result.isError) {
        return {
          success: false,
          message: `I couldn't execute the core funnel: ${result.content[0]?.text || 'Unknown error'}`,
          toolsUsed: ['mcp__core_funnel__execute'],
          error: result.content[0]?.text
        }
      }

      const execution = JSON.parse(result.content[0]?.text || '{}')
      
      return {
        success: true,
        message: formatCoreFunnelExecutionResponse(execution),
        toolsUsed: ['mcp__core_funnel__execute'],
        data: execution,
        suggestedActions: [
          `Monitor funnel progress`,
          `View real-time performance`,
          `Optimize based on results`,
          `Scale to more prospects`
        ]
      }
    }
    
    // Core Funnel Status
    if (/status|progress|how.*funnel.*doing/i.test(input)) {
      const statusRequest = parseCoreFunnelStatusInput(input, workspaceId, context)
      
      const mcpRequest: MCPCallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'mcp__core_funnel__get_status',
          arguments: statusRequest
        }
      }

      const result = await mcpRegistry.callTool(mcpRequest)
      
      if (result.isError) {
        return {
          success: false,
          message: `I couldn't get funnel status: ${result.content[0]?.text || 'Unknown error'}`,
          toolsUsed: ['mcp__core_funnel__get_status'],
          error: result.content[0]?.text
        }
      }

      const status = JSON.parse(result.content[0]?.text || '{}')
      
      return {
        success: true,
        message: formatCoreFunnelStatusResponse(status),
        toolsUsed: ['mcp__core_funnel__get_status'],
        data: status,
        suggestedActions: [
          `Optimize messaging based on results`,
          `Expand to similar prospects`,
          `Create follow-up sequence`,
          `Analyze conversion patterns`
        ]
      }
    }

    return {
      success: false,
      message: "I understand you want to work with Core Funnels, but I need more specifics. Try 'show me core funnel templates' or 'execute SAM Signature Funnel'.",
      toolsUsed: [],
      suggestedActions: [
        "Show available core funnel templates",
        "Execute SAM Signature Funnel",
        "Get core funnel performance analytics"
      ]
    }

  } catch (error) {
    return {
      success: false,
      message: `Core funnel command failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      toolsUsed: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Handle Sam Dynamic Funnel commands
 */
async function handleDynamicFunnelCommands(input: string, workspaceId: string, context?: any): Promise<SamMCPResponse> {
  const lowerInput = input.toLowerCase()
  
  try {
    // Create Dynamic Funnel from Conversation
    if (/create.*funnel|build.*funnel|custom.*funnel|generate.*funnel|funnel.*for/i.test(input)) {
      const creationRequest = parseDynamicFunnelCreationInput(input, workspaceId, context)
      
      const mcpRequest: MCPCallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'mcp__dynamic_funnel__create_from_conversation',
          arguments: creationRequest
        }
      }

      const result = await mcpRegistry.callTool(mcpRequest)
      
      if (result.isError) {
        return {
          success: false,
          message: `I couldn't create the dynamic funnel: ${result.content[0]?.text || 'Unknown error'}`,
          toolsUsed: ['mcp__dynamic_funnel__create_from_conversation'],
          error: result.content[0]?.text
        }
      }

      const funnel = JSON.parse(result.content[0]?.text || '{}')
      
      return {
        success: true,
        message: formatDynamicFunnelCreationResponse(funnel),
        toolsUsed: ['mcp__dynamic_funnel__create_from_conversation'],
        data: funnel,
        suggestedActions: [
          `Execute this custom funnel`,
          `Modify funnel messaging`,
          `Test with small prospect group`,
          `Create variations for A/B testing`
        ]
      }
    }
    
    // Execute Dynamic Funnel
    if (/execute|run|deploy|start.*funnel/i.test(input)) {
      const executionRequest = parseDynamicFunnelExecutionInput(input, workspaceId, context)
      
      const mcpRequest: MCPCallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'mcp__dynamic_funnel__execute',
          arguments: executionRequest
        }
      }

      const result = await mcpRegistry.callTool(mcpRequest)
      
      if (result.isError) {
        return {
          success: false,
          message: `I couldn't execute the dynamic funnel: ${result.content[0]?.text || 'Unknown error'}`,
          toolsUsed: ['mcp__dynamic_funnel__execute'],
          error: result.content[0]?.text
        }
      }

      const execution = JSON.parse(result.content[0]?.text || '{}')
      
      return {
        success: true,
        message: formatDynamicFunnelExecutionResponse(execution),
        toolsUsed: ['mcp__dynamic_funnel__execute'],
        data: execution,
        suggestedActions: [
          `Monitor adaptive performance`,
          `Track AI improvements`,
          `Optimize based on responses`,
          `Scale successful patterns`
        ]
      }
    }
    
    // Modify Dynamic Funnel
    if (/modify|update|change|improve.*funnel/i.test(input)) {
      const modificationRequest = parseDynamicFunnelModificationInput(input, workspaceId, context)
      
      const mcpRequest: MCPCallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'mcp__dynamic_funnel__modify',
          arguments: modificationRequest
        }
      }

      const result = await mcpRegistry.callTool(mcpRequest)
      
      if (result.isError) {
        return {
          success: false,
          message: `I couldn't modify the funnel: ${result.content[0]?.text || 'Unknown error'}`,
          toolsUsed: ['mcp__dynamic_funnel__modify'],
          error: result.content[0]?.text
        }
      }

      const modifiedFunnel = JSON.parse(result.content[0]?.text || '{}')
      
      return {
        success: true,
        message: formatDynamicFunnelModificationResponse(modifiedFunnel),
        toolsUsed: ['mcp__dynamic_funnel__modify'],
        data: modifiedFunnel,
        suggestedActions: [
          `Test modified funnel`,
          `Compare with original`,
          `Deploy improvements`,
          `Monitor performance changes`
        ]
      }
    }

    return {
      success: false,
      message: "I understand you want to work with Dynamic Funnels. Try describing what kind of custom funnel you want to create, like 'Create a funnel for healthcare CFOs about cost reduction'.",
      toolsUsed: [],
      suggestedActions: [
        "Create a funnel for tech CEOs about AI adoption",
        "Build a sequence for healthcare CFOs",
        "Generate a funnel for fintech compliance",
        "Design a custom nurture sequence"
      ]
    }

  } catch (error) {
    return {
      success: false,
      message: `Dynamic funnel command failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      toolsUsed: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Prompt user to clarify funnel type preference
 */
async function promptForFunnelTypeClarity(input: string, workspaceId: string, context?: any): Promise<SamMCPResponse> {
  return {
    success: true,
    message: `🎯 **I can help you with two types of funnels:**

**🔧 SAM Core Funnels** - Proven, standardized sequences
• Pre-built templates with proven conversion rates
• SAM Signature, Event Invitation, Product Launch funnels
• Fast deployment with immediate results
• Industry-optimized messaging

**🌟 Sam Dynamic Funnels** - AI-generated custom sequences  
• Completely personalized for your specific use case
• AI creates unique messaging and timing
• Adaptive responses based on prospect behavior
• Perfect for specialized industries or unique offerings

**Which would you prefer?**
• "Show me proven core funnels" for standardized templates
• "Create a custom funnel for [your specific need]" for AI-generated sequences

Based on your message: "${input.substring(0, 80)}${input.length > 80 ? '...' : ''}"

I'd recommend ${suggestFunnelType(input)} for your needs.`,
    toolsUsed: [],
    suggestedActions: [
      "Show me SAM Core Funnel templates",
      "Create a custom funnel for my industry",
      "Execute proven SAM Signature Funnel",
      "Build AI-generated funnel for specific prospects"
    ]
  }
}

/**
 * Detect funnel type preference from user input
 */
function detectFunnelType(input: string): 'core' | 'dynamic' | 'unclear' {
  const lowerInput = input.toLowerCase()
  
  // Core funnel indicators
  if (/standard|proven|template|quick|fast|sam.*signature|event.*invitation|product.*launch|core.*funnel|pre.*built/i.test(lowerInput)) {
    return 'core'
  }
  
  // Dynamic funnel indicators  
  if (/custom|specific|unique|create.*funnel|build.*sequence|ai.*generated|dynamic.*funnel|personalized|adaptive/i.test(lowerInput)) {
    return 'dynamic'
  }
  
  return 'unclear'
}

/**
 * Suggest appropriate funnel type based on user input
 */
function suggestFunnelType(input: string): string {
  const lowerInput = input.toLowerCase()
  
  if (/quick|fast|proven|immediate|standard/i.test(lowerInput)) {
    return '**SAM Core Funnels** (proven templates for immediate results)'
  }
  
  if (/specific|unique|custom|specialized|industry|niche/i.test(lowerInput)) {
    return '**Sam Dynamic Funnels** (AI-generated for your specific needs)'
  }
  
  return '**SAM Core Funnels** (great starting point with proven results)'
}

/**
 * Handle Campaign Creation via Sam conversation
 */
async function handleCampaignCreation(input: string, workspaceId: string, context?: any): Promise<SamMCPResponse> {
  const campaignRequest = parseCampaignCreationInput(input, workspaceId, context)
  
  const mcpRequest: MCPCallToolRequest = {
    method: 'tools/call',
    params: {
      name: 'mcp__sam__create_campaign',
      arguments: campaignRequest
    }
  }

  const result = await mcpRegistry.callTool(mcpRequest)
  
  if (result.isError) {
    return {
      success: false,
      message: `I couldn't create the campaign: ${result.content[0]?.text || 'Unknown error'}`,
      toolsUsed: ['mcp__sam__create_campaign'],
      error: result.content[0]?.text
    }
  }

  const campaignData = JSON.parse(result.content[0]?.text || '{}')
  
  if (campaignData.success) {
    return {
      success: true,
      message: formatCampaignCreationResponse(campaignData),
      toolsUsed: ['mcp__sam__create_campaign'],
      data: campaignData,
      suggestedActions: [
        `Execute this campaign now`,
        `Preview the execution plan`,
        `Modify campaign settings`,
        `Add more prospects to this campaign`
      ]
    }
  } else {
    return {
      success: false,
      message: `Campaign creation failed: ${campaignData.error || 'Unknown error'}`,
      toolsUsed: ['mcp__sam__create_campaign'],
      error: campaignData.error
    }
  }
}

/**
 * Handle Campaign Execution via Sam conversation
 */
async function handleCampaignExecution(input: string, workspaceId: string, context?: any): Promise<SamMCPResponse> {
  const executionRequest = parseCampaignExecutionInput(input, workspaceId, context)
  
  const mcpRequest: MCPCallToolRequest = {
    method: 'tools/call',
    params: {
      name: 'mcp__sam__execute_campaign',
      arguments: executionRequest
    }
  }

  const result = await mcpRegistry.callTool(mcpRequest)
  
  if (result.isError) {
    return {
      success: false,
      message: `I couldn't execute the campaign: ${result.content[0]?.text || 'Unknown error'}`,
      toolsUsed: ['mcp__sam__execute_campaign'],
      error: result.content[0]?.text
    }
  }

  const executionData = JSON.parse(result.content[0]?.text || '{}')
  
  if (executionData.success) {
    return {
      success: true,
      message: formatCampaignExecutionResponse(executionData),
      toolsUsed: ['mcp__sam__execute_campaign'],
      data: executionData,
      suggestedActions: [
        `Monitor campaign progress`,
        `View real-time statistics`,
        `Pause campaign if needed`,
        `Optimize based on early results`
      ]
    }
  } else {
    return {
      success: false,
      message: `Campaign execution failed: ${executionData.error || 'Unknown error'}`,
      toolsUsed: ['mcp__sam__execute_campaign'],
      error: executionData.error
    }
  }
}

/**
 * Handle Campaign Status via Sam conversation
 */
async function handleCampaignStatus(input: string, workspaceId: string, context?: any): Promise<SamMCPResponse> {
  const statusRequest = parseCampaignStatusInput(input, workspaceId, context)
  
  const mcpRequest: MCPCallToolRequest = {
    method: 'tools/call',
    params: {
      name: 'mcp__sam__get_campaign_status',
      arguments: statusRequest
    }
  }

  const result = await mcpRegistry.callTool(mcpRequest)
  
  if (result.isError) {
    return {
      success: false,
      message: `I couldn't get the campaign status: ${result.content[0]?.text || 'Unknown error'}`,
      toolsUsed: ['mcp__sam__get_campaign_status'],
      error: result.content[0]?.text
    }
  }

  const statusData = JSON.parse(result.content[0]?.text || '{}')
  
  if (statusData.success) {
    return {
      success: true,
      message: formatCampaignStatusResponse(statusData),
      toolsUsed: ['mcp__sam__get_campaign_status'],
      data: statusData,
      suggestedActions: [
        `Optimize messaging based on results`,
        `Adjust daily sending limits`,
        `Export performance data`,
        `Create follow-up campaigns`
      ]
    }
  } else {
    return {
      success: false,
      message: `Couldn't retrieve campaign status: ${statusData.error || 'Unknown error'}`,
      toolsUsed: ['mcp__sam__get_campaign_status'],
      error: statusData.error
    }
  }
}

/**
 * Handle Template Management via Sam conversation
 */
async function handleTemplateManagement(input: string, workspaceId: string, context?: any): Promise<SamMCPResponse> {
  const toolsUsed: string[] = []
  
  // Determine template action
  if (/create.*template|new.*template/i.test(input)) {
    // Create new template
    const templateRequest = parseTemplateCreationInput(input, workspaceId, context)
    const mcpRequest: MCPCallToolRequest = {
      method: 'tools/call',
      params: {
        name: 'mcp__template__create',
        arguments: templateRequest
      }
    }
    
    const result = await mcpRegistry.callTool(mcpRequest)
    toolsUsed.push('mcp__template__create')
    
    if (result.isError) {
      return {
        success: false,
        message: `I couldn't create the template: ${result.content[0]?.text || 'Unknown error'}`,
        toolsUsed,
        error: result.content[0]?.text
      }
    }

    const templateData = JSON.parse(result.content[0]?.text || '{}')
    
    if (templateData.success) {
      return {
        success: true,
        message: `✅ **Template Created Successfully!**\n\nYour new template "${templateRequest.template_name}" has been saved and is ready to use.\n\n**Template Details:**\n• Type: ${templateRequest.campaign_type}\n• Industry: ${templateRequest.industry || 'General'}\n• Target: ${templateRequest.target_role || 'General'}\n• Language: ${templateRequest.language}\n\n**Next Steps:**\n• Use this template in new campaigns\n• Test with A/B variations\n• Track performance over time`,
        toolsUsed,
        data: templateData,
        suggestedActions: [
          `Create a campaign using this template`,
          `Generate A/B test variations`,
          `Optimize this template with AI`,
          `Share template with team`
        ]
      }
    }
  } else if (/show.*template|my.*template|list.*template/i.test(input)) {
    // List templates
    const searchRequest = parseTemplateSearchInput(input, workspaceId, context)
    const mcpRequest: MCPCallToolRequest = {
      method: 'tools/call',
      params: {
        name: 'mcp__template__get_by_criteria',
        arguments: searchRequest
      }
    }
    
    const result = await mcpRegistry.callTool(mcpRequest)
    toolsUsed.push('mcp__template__get_by_criteria')
    
    if (result.isError) {
      return {
        success: false,
        message: `I couldn't retrieve your templates: ${result.content[0]?.text || 'Unknown error'}`,
        toolsUsed,
        error: result.content[0]?.text
      }
    }

    const templatesData = JSON.parse(result.content[0]?.text || '{}')
    
    if (templatesData.success) {
      return {
        success: true,
        message: formatTemplateListResponse(templatesData),
        toolsUsed,
        data: templatesData,
        suggestedActions: [
          `Create campaign with top template`,
          `Optimize best performing template`,
          `Clone template for new industry`,
          `Analyze template performance`
        ]
      }
    }
  }

  return {
    success: false,
    message: "I couldn't understand what you want to do with templates. Try 'create a new template' or 'show my templates'.",
    toolsUsed,
    suggestedActions: [
      "Create a new LinkedIn template",
      "Show my top performing templates",
      "List templates for tech industry"
    ]
  }
}

/**
 * Handle Template Optimization via Sam conversation
 */
async function handleTemplateOptimization(input: string, workspaceId: string, context?: any): Promise<SamMCPResponse> {
  const optimizationRequest = parseTemplateOptimizationInput(input, workspaceId, context)
  
  const mcpRequest: MCPCallToolRequest = {
    method: 'tools/call',
    params: {
      name: 'mcp__mistral__optimize_template',
      arguments: optimizationRequest
    }
  }

  const result = await mcpRegistry.callTool(mcpRequest)
  
  if (result.isError) {
    return {
      success: false,
      message: `I couldn't optimize the template: ${result.content[0]?.text || 'Unknown error'}`,
      toolsUsed: ['mcp__mistral__optimize_template'],
      error: result.content[0]?.text
    }
  }

  const optimizationData = JSON.parse(result.content[0]?.text || '{}')
  
  if (optimizationData.success) {
    return {
      success: true,
      message: formatTemplateOptimizationResponse(optimizationData),
      toolsUsed: ['mcp__mistral__optimize_template'],
      data: optimizationData,
      suggestedActions: [
        `Save optimized template`,
        `A/B test against original`,
        `Apply to current campaigns`,
        `Generate more variations`
      ]
    }
  } else {
    return {
      success: false,
      message: `Template optimization failed: ${optimizationData.error || 'Unknown error'}`,
      toolsUsed: ['mcp__mistral__optimize_template'],
      error: optimizationData.error
    }
  }
}

/**
 * Handle Performance Analysis via Sam conversation
 */
async function handlePerformanceAnalysis(input: string, workspaceId: string, context?: any): Promise<SamMCPResponse> {
  // First get performance data, then analyze with Mistral
  const performanceRequest = parsePerformanceAnalysisInput(input, workspaceId, context)
  const toolsUsed: string[] = []
  
  // Get template performance
  const perfMcpRequest: MCPCallToolRequest = {
    method: 'tools/call',
    params: {
      name: 'mcp__template__get_performance',
      arguments: performanceRequest
    }
  }

  const perfResult = await mcpRegistry.callTool(perfMcpRequest)
  toolsUsed.push('mcp__template__get_performance')
  
  if (perfResult.isError) {
    return {
      success: false,
      message: `I couldn't get performance data: ${perfResult.content[0]?.text || 'Unknown error'}`,
      toolsUsed,
      error: perfResult.content[0]?.text
    }
  }

  const perfData = JSON.parse(perfResult.content[0]?.text || '{}')
  
  if (perfData.success && perfData.performance && perfData.performance.length > 0) {
    // Analyze performance with Mistral
    const analysisRequest = {
      template: context?.template || { connection_message: "Sample template", follow_up_messages: [] },
      performance_data: {
        total_sent: perfData.performance[0].total_sent,
        response_rate: perfData.avg_response_rate,
        connection_rate: perfData.performance[0].connection_rate,
        meeting_rate: perfData.performance[0].meeting_rate
      },
      context: {
        industry: context?.industry || 'technology',
        target_role: context?.target_role || 'executive',
        language: 'en'
      }
    }

    const analysisMcpRequest: MCPCallToolRequest = {
      method: 'tools/call',
      params: {
        name: 'mcp__mistral__analyze_performance',
        arguments: analysisRequest
      }
    }

    const analysisResult = await mcpRegistry.callTool(analysisMcpRequest)
    toolsUsed.push('mcp__mistral__analyze_performance')
    
    if (analysisResult.isError) {
      return {
        success: true,
        message: formatBasicPerformanceResponse(perfData),
        toolsUsed,
        data: perfData
      }
    }

    const analysisData = JSON.parse(analysisResult.content[0]?.text || '{}')
    
    if (analysisData.success) {
      return {
        success: true,
        message: formatAdvancedPerformanceResponse(perfData, analysisData),
        toolsUsed,
        data: { performance: perfData, analysis: analysisData },
        suggestedActions: [
          `Implement suggested improvements`,
          `Create optimized template version`,
          `A/B test recommendations`,
          `Monitor improved performance`
        ]
      }
    }
  }

  return {
    success: true,
    message: formatBasicPerformanceResponse(perfData),
    toolsUsed,
    data: perfData,
    suggestedActions: [
      `Run more campaigns for better data`,
      `Optimize existing templates`,
      `Create performance benchmarks`
    ]
  }
}

// Input Parsing Functions
function parseCampaignCreationInput(input: string, workspaceId: string, context?: any): any {
  return {
    workspace_id: workspaceId,
    campaign_name: extractCampaignName(input) || `Campaign ${new Date().toISOString().split('T')[0]}`,
    campaign_type: extractCampaignType(input),
    target_criteria: extractTargetCriteria(input),
    execution_preferences: extractExecutionPreferences(input),
    template_preference: extractTemplatePreference(input, context)
  }
}

function parseCampaignExecutionInput(input: string, workspaceId: string, context?: any): any {
  return {
    campaign_id: context?.campaign_id || extractCampaignId(input),
    workspace_id: workspaceId,
    execution_mode: extractExecutionMode(input),
    batch_size: extractBatchSize(input)
  }
}

function parseCampaignStatusInput(input: string, workspaceId: string, context?: any): any {
  return {
    campaign_id: context?.campaign_id || extractCampaignId(input),
    workspace_id: workspaceId
  }
}

function parseTemplateCreationInput(input: string, workspaceId: string, context?: any): any {
  return {
    workspace_id: workspaceId,
    template_name: extractTemplateName(input) || `Template ${new Date().toISOString().split('T')[0]}`,
    campaign_type: extractCampaignType(input),
    industry: extractIndustry(input),
    target_role: extractTargetRole(input),
    connection_message: extractConnectionMessage(input) || 'Hi {first_name}, I\'d love to connect and discuss {company_name}\'s growth.',
    follow_up_messages: extractFollowUpMessages(input),
    language: 'en',
    tone: extractTone(input) || 'professional',
    is_active: true
  }
}

function parseTemplateSearchInput(input: string, workspaceId: string, context?: any): any {
  return {
    workspace_id: workspaceId,
    industry: extractIndustry(input),
    target_role: extractTargetRole(input),
    campaign_type: extractCampaignType(input),
    limit: 10
  }
}

function parseTemplateOptimizationInput(input: string, workspaceId: string, context?: any): any {
  return {
    original_template: context?.template || {
      connection_message: "Hi {first_name}, I noticed {company_name} is in the {industry} space...",
      follow_up_messages: ["Thanks for connecting!", "Following up on my previous message..."]
    },
    target_context: {
      industry: extractIndustry(input) || 'technology',
      role: extractTargetRole(input) || 'executive',
      company_size: extractCompanySize(input) || 'startup',
      language: 'en',
      tone: extractTone(input) || 'professional',
      campaign_type: extractCampaignType(input)
    },
    optimization_goals: extractOptimizationGoals(input)
  }
}

function parsePerformanceAnalysisInput(input: string, workspaceId: string, context?: any): any {
  return {
    template_id: context?.template_id || extractTemplateId(input),
    workspace_id: workspaceId
  }
}

// Response Formatting Functions
function formatCampaignCreationResponse(data: any): string {
  const campaign = data.execution_plan
  return `🎯 **Campaign Created Successfully!**

**Campaign Overview:**
• Name: ${campaign?.campaign_id || 'New Campaign'}
• Template: ${campaign?.template?.connection_message ? 'Custom template selected' : 'Default template'}
• Prospects: ${campaign?.prospects?.length || 0} targets identified
• Schedule: ${campaign?.execution_schedule?.daily_batches?.length || 0} days planned

**Execution Plan:**
• Start Date: ${campaign?.execution_schedule?.start_date || 'Today'}
• Daily Limit: ${campaign?.execution_schedule?.daily_batches?.[0]?.prospect_count || 50} prospects/day
• Estimated Completion: ${campaign?.execution_schedule?.daily_batches?.[campaign?.execution_schedule?.daily_batches?.length - 1]?.estimated_completion || 'Unknown'}

**Sample Message Preview:**
"${campaign?.template?.connection_message?.substring(0, 100) || 'Template preview not available'}..."

Your campaign is ready! Would you like me to execute it now or make any adjustments?`
}

function formatCampaignExecutionResponse(data: any): string {
  const summary = data.summary
  return `🚀 **Campaign Execution Started!**

**Execution Status:** ${data.status || 'Started'}
**Execution ID:** ${data.execution_id}

**Current Progress:**
• Total Prospects: ${summary?.total_prospects || 0}
• Messages Sent: ${summary?.messages_sent || 0}
• Estimated Completion: ${summary?.estimated_completion || 'Unknown'}

**Real-time Monitoring:**
Your campaign is now running automatically. I'll track responses and provide updates as they come in.

**What's Happening Next:**
• Personalized messages being sent to prospects
• Response tracking and analytics collection
• Automatic follow-up sequence management
• Compliance and safety monitoring

I'll notify you of any responses or important updates!`
}

function formatCampaignStatusResponse(data: any): string {
  const status = data.status
  const responseRate = status?.response_rate || 0
  const responseRateEmoji = responseRate > 15 ? '🟢' : responseRate > 8 ? '🟡' : '🔴'
  
  return `📊 **Campaign Status: ${status?.campaign_name || 'Unknown Campaign'}**

**Current Status:** ${status?.current_status || 'Unknown'} ${responseRateEmoji}

**Performance Metrics:**
• Total Prospects: ${status?.prospects_total || 0}
• Processed: ${status?.prospects_processed || 0}
• Responses: ${status?.prospects_responded || 0}
• Response Rate: ${responseRate.toFixed(1)}% ${responseRateEmoji}

**Timeline:**
• Last Activity: ${status?.last_activity ? new Date(status.last_activity).toLocaleDateString() : 'Unknown'}
• Next Action: ${status?.next_action || 'Monitor progress'}

**Performance Analysis:**
${responseRate > 15 ? '🎉 Excellent performance! This campaign is exceeding benchmarks.' : 
  responseRate > 8 ? '👍 Good performance. Consider optimizing for even better results.' : 
  '⚠️ Performance below average. I recommend reviewing and optimizing the messaging.'}

${status?.next_action ? `**Recommended Next Step:** ${status.next_action}` : ''}`
}

function formatTemplateListResponse(data: any): string {
  const templates = data.templates || []
  
  if (templates.length === 0) {
    return `📝 **Your Template Library**

No templates found matching your criteria. 

**Get Started:**
• Create a new template with specific targeting
• Import templates from successful campaigns  
• Browse template suggestions by industry

Would you like me to help you create your first template?`
  }

  let response = `📝 **Your Template Library** (${templates.length} templates found)\n\n`
  
  templates.slice(0, 5).forEach((template: any, index: number) => {
    response += `**${index + 1}. ${template.template_name}**\n`
    response += `• Type: ${template.campaign_type}\n`
    response += `• Target: ${template.target_role || 'General'} in ${template.industry || 'General'}\n`
    response += `• Language: ${template.language}, Tone: ${template.tone}\n`
    response += `• Preview: "${template.connection_message?.substring(0, 80) || 'No preview'}..."\n\n`
  })

  if (templates.length > 5) {
    response += `... and ${templates.length - 5} more templates.\n\n`
  }

  response += `**Quick Actions:**\n• Use template for new campaign\n• Optimize with AI\n• Clone and modify\n• View performance analytics`

  return response
}

function formatTemplateOptimizationResponse(data: any): string {
  const result = data.result
  const improvements = result?.improvements || []
  const score = result?.confidence_score || 0
  
  return `🧠 **Template Optimization Complete!** (Confidence: ${Math.round(score * 100)}%)

**Optimized Template:**
"${result?.optimized_template?.connection_message || 'Optimization failed'}"

**Key Improvements Made:**
${improvements.map((imp: string, i: number) => `${i + 1}. ${imp}`).join('\n')}

**AI Reasoning:**
${result?.reasoning || 'Optimization analysis not available'}

**Alternative Message:**
${result?.optimized_template?.alternative_message ? `"${result.optimized_template.alternative_message}"` : 'None provided'}

**Follow-up Sequence:**
${result?.optimized_template?.follow_up_messages?.map((msg: string, i: number) => `${i + 1}. "${msg}"`).join('\n') || 'No follow-ups optimized'}

This optimized template should improve engagement and response rates. Would you like me to save it or create A/B test variations?`
}

function formatBasicPerformanceResponse(data: any): string {
  const avgRate = data.avg_response_rate || 0
  const performance = data.performance?.[0]
  
  return `📈 **Template Performance Analysis**

**Overall Response Rate:** ${avgRate.toFixed(1)}%
**Total Campaigns:** ${data.performance?.length || 0}

${performance ? `**Latest Campaign Metrics:**
• Messages Sent: ${performance.total_sent}
• Responses: ${performance.total_responses}
• Connection Rate: ${performance.connection_rate}%
• Meeting Rate: ${performance.meeting_rate}%` : ''}

**Performance Rating:** ${avgRate > 15 ? '🟢 Excellent' : avgRate > 8 ? '🟡 Good' : '🔴 Needs Improvement'}

${avgRate < 8 ? 'Consider optimizing this template for better results.' : 'This template is performing well!'}

Would you like me to analyze these results with AI and suggest improvements?`
}

function formatAdvancedPerformanceResponse(perfData: any, analysisData: any): string {
  const analysis = analysisData.analysis
  const avgRate = perfData.avg_response_rate || 0
  
  return `🎯 **AI-Powered Performance Analysis**

**Overall Response Rate:** ${avgRate.toFixed(1)}% ${avgRate > 15 ? '🟢' : avgRate > 8 ? '🟡' : '🔴'}

**✅ Template Strengths:**
${analysis?.strengths?.map((s: string, i: number) => `• ${s}`).join('\n') || '• Analysis not available'}

**⚠️ Areas for Improvement:**
${analysis?.weaknesses?.map((w: string, i: number) => `• ${w}`).join('\n') || '• Analysis not available'}

**🚀 Specific Recommendations:**
${analysis?.specific_improvements?.map((imp: string, i: number) => `${i + 1}. ${imp}`).join('\n') || '• Analysis not available'}

**📊 Predicted Improvement:** ${analysis?.predicted_improvement ? `+${analysis.predicted_improvement}%` : 'Unknown'} response rate increase

**Next Steps:**
• Implement the suggested improvements
• A/B test against current version
• Monitor performance changes
• Scale successful optimizations

Would you like me to create an optimized version based on these insights?`
}

// Extraction Helper Functions
function extractCampaignName(input: string): string | null {
  const matches = input.match(/campaign.*?["']([^"']+)["']|["']([^"']+)["'].*campaign|campaign.*for\s+([^"'\n,]+)/i)
  return matches?.[1] || matches?.[2] || matches?.[3]?.trim() || null
}

function extractCampaignType(input: string): string {
  if (/signature|sam/i.test(input)) return 'sam_signature'
  if (/event|invitation/i.test(input)) return 'event_invitation'  
  if (/product|launch/i.test(input)) return 'product_launch'
  if (/partnership|partner/i.test(input)) return 'partnership'
  return 'sam_signature'
}

function extractTargetCriteria(input: string): any {
  return {
    industry: extractIndustry(input),
    role: extractTargetRole(input),
    company_size: extractCompanySize(input),
    location: extractLocation(input)
  }
}

function extractExecutionPreferences(input: string): any {
  return {
    daily_limit: extractDailyLimit(input) || 50,
    personalization_level: extractPersonalizationLevel(input),
    channels: extractChannels(input),
    start_date: extractStartDate(input)
  }
}

function extractIndustry(input: string): string | undefined {
  const matches = input.match(/(?:industry|sector)\s+(\w+)|(\w+)\s+industry|targeting\s+(\w+)/i)
  return matches?.[1] || matches?.[2] || matches?.[3] || undefined
}

function extractTargetRole(input: string): string | undefined {
  const matches = input.match(/(?:role|title|position)\s+([^,\n]+)|targeting\s+([^,\n]+)|reach\s+([^,\n]+)/i)
  return matches?.[1]?.trim() || matches?.[2]?.trim() || matches?.[3]?.trim() || undefined
}

function extractCompanySize(input: string): string | undefined {
  if (/startup|early.stage/i.test(input)) return 'startup'
  if (/small|smb/i.test(input)) return 'smb'
  if (/medium|mid.market/i.test(input)) return 'mid_market'
  if (/large|enterprise/i.test(input)) return 'enterprise'
  return undefined
}

function extractLocation(input: string): string | undefined {
  const matches = input.match(/(?:location|region|country)\s+([^,\n]+)|in\s+([^,\n]+)/i)
  return matches?.[1]?.trim() || matches?.[2]?.trim() || undefined
}

function extractDailyLimit(input: string): number | undefined {
  const matches = input.match(/(\d+)\s*(?:per\s+day|daily|\/day)/i)
  return matches ? parseInt(matches[1]) : undefined
}

function extractPersonalizationLevel(input: string): string {
  if (/deep|advanced|high/i.test(input)) return 'advanced'
  if (/basic|simple|low/i.test(input)) return 'basic'
  return 'advanced'
}

function extractChannels(input: string): string[] {
  const channels = []
  if (/linkedin/i.test(input)) channels.push('linkedin')
  if (/email/i.test(input)) channels.push('email')
  return channels.length > 0 ? channels : ['linkedin']
}

function extractStartDate(input: string): string | undefined {
  const matches = input.match(/(?:start|begin)\s+([^,\n]+)|on\s+([^,\n]+)/i)
  return matches?.[1]?.trim() || matches?.[2]?.trim() || undefined
}

function extractTemplatePreference(input: string, context?: any): any {
  return {
    use_top_performer: /best|top|highest/i.test(input)
  }
}

function extractExecutionMode(input: string): string {
  if (/test|preview|demo/i.test(input)) return 'test'
  if (/schedule|later/i.test(input)) return 'scheduled'
  return 'immediate'
}

function extractBatchSize(input: string): number | undefined {
  const matches = input.match(/(\d+)\s*(?:prospect|contact|batch)/i)
  return matches ? parseInt(matches[1]) : undefined
}

function extractCampaignId(input: string): string | undefined {
  const matches = input.match(/campaign[:\s]+([a-f0-9\-]+)/i)
  return matches?.[1] || undefined
}

function extractTemplateName(input: string): string | null {
  const matches = input.match(/template.*?["']([^"']+)["']|["']([^"']+)["'].*template/i)
  return matches?.[1] || matches?.[2] || null
}

function extractConnectionMessage(input: string): string | null {
  const matches = input.match(/message.*?["']([^"']+)["']|["']([^"']+)["']/i)
  return matches?.[1] || matches?.[2] || null
}

function extractFollowUpMessages(input: string): string[] {
  // Extract follow-up messages from input
  const matches = input.match(/follow.?up.*?["']([^"']+)["']/gi)
  return matches?.map(m => m.replace(/follow.?up.*?["']/i, '').replace(/["']$/, '')) || []
}

function extractTone(input: string): string | undefined {
  if (/professional|formal/i.test(input)) return 'professional'
  if (/casual|friendly/i.test(input)) return 'casual'
  if (/direct|brief/i.test(input)) return 'direct'
  return undefined
}

function extractOptimizationGoals(input: string): string[] {
  const goals = []
  if (/response.*rate|more.*response/i.test(input)) goals.push('increase_response_rate')
  if (/connection.*rate|more.*connection/i.test(input)) goals.push('increase_connection_rate')
  if (/meeting|call/i.test(input)) goals.push('increase_meeting_rate')
  if (/engagement/i.test(input)) goals.push('increase_engagement')
  return goals.length > 0 ? goals : ['increase_response_rate']
}

function extractTemplateId(input: string): string | undefined {
  const matches = input.match(/template[:\s]+([a-f0-9\-]+)/i)
  return matches?.[1] || undefined
}

// ============================================================================
// FUNNEL PARSING & FORMATTING FUNCTIONS
// ============================================================================

// Core Funnel Parsing Functions
function parseCoreFunnelFilters(input: string): any {
  return {
    industry: extractIndustry(input),
    funnel_type: extractFunnelTypeFromInput(input),
    min_conversion_rate: extractMinConversionRate(input)
  }
}

function parseCoreFunnelExecutionInput(input: string, workspaceId: string, context?: any): any {
  return {
    template_id: context?.template_id || extractTemplateId(input) || 'sam_signature_tech',
    campaign_id: context?.campaign_id || extractCampaignId(input) || 'new_campaign',
    prospects: context?.prospects || [],
    variables: extractFunnelVariables(input)
  }
}

function parseCoreFunnelStatusInput(input: string, workspaceId: string, context?: any): any {
  return {
    execution_id: context?.execution_id || extractExecutionId(input)
  }
}

// Dynamic Funnel Parsing Functions
function parseDynamicFunnelCreationInput(input: string, workspaceId: string, context?: any): any {
  return {
    conversation_context: input,
    target_persona: extractTargetPersona(input),
    business_objective: extractBusinessObjective(input),
    constraints: extractFunnelConstraints(input)
  }
}

function parseDynamicFunnelExecutionInput(input: string, workspaceId: string, context?: any): any {
  return {
    funnel_id: context?.funnel_id || extractFunnelId(input),
    campaign_id: context?.campaign_id || extractCampaignId(input) || 'new_campaign',
    prospects: context?.prospects || []
  }
}

function parseDynamicFunnelModificationInput(input: string, workspaceId: string, context?: any): any {
  return {
    funnel_id: context?.funnel_id || extractFunnelId(input),
    modification_request: input,
    context: context?.modification_context
  }
}

// Core Funnel Formatting Functions
function formatCoreFunnelTemplatesResponse(templates: any[]): string {
  if (!templates || templates.length === 0) {
    return `🎯 **SAM Core Funnel Templates**

No core funnel templates found. 

**Available Core Funnel Types:**
• **SAM Signature Funnel** - Our highest converting sequence
• **Event Invitation Funnel** - Perfect for webinars and events  
• **Product Launch Funnel** - Ideal for new product announcements

Would you like me to set up the default SAM Signature Funnel for you?`
  }

  let response = `🎯 **SAM Core Funnel Templates** (${templates.length} available)\n\n`
  
  templates.slice(0, 5).forEach((template: any, index: number) => {
    response += `**${index + 1}. ${template.name}** 🔧\n`
    response += `• Type: ${template.funnel_type.replace('_', ' ').toUpperCase()}\n`
    response += `• Industry: ${template.industry || 'General'}\n`
    response += `• Conversion Rate: ${template.conversion_rate || 0}% | Response Rate: ${template.avg_response_rate || 0}%\n`
    response += `• Status: ${template.is_active ? '✅ Active' : '❌ Inactive'}\n\n`
  })

  if (templates.length > 5) {
    response += `... and ${templates.length - 5} more templates.\n\n`
  }

  const topTemplate = templates[0]
  response += `🚀 **Recommended:** ${topTemplate?.name || 'SAM Signature Funnel'} with ${topTemplate?.conversion_rate || 23}% conversion rate\n\n`
  response += `**Quick Actions:**\n• Execute top template immediately\n• View template sequence details\n• Customize for your industry\n• Compare template performance`

  return response
}

function formatCoreFunnelExecutionResponse(execution: any): string {
  return `🚀 **SAM Core Funnel Execution Started!**

**Execution Details:**
• Execution ID: ${execution.id}
• Template: ${execution.template_id}
• Campaign: ${execution.campaign_id}
• Status: ${execution.status.toUpperCase()} ⚡

**Prospects:**
• Total Prospects: ${execution.prospects_total}
• Currently Processing: ${execution.prospects_processed}/${execution.prospects_total}

**N8N Workflow:**
• Workflow ID: ${execution.n8n_execution_id || 'Deploying...'}
• Started: ${execution.started_at ? new Date(execution.started_at).toLocaleString() : 'Just now'}

**What's Happening:**
✅ Prospects loaded into proven funnel sequence
⚡ N8N workflow automation initiated  
📊 Real-time tracking and analytics enabled
🎯 Standardized messaging optimized for conversions

Your core funnel is now running with our battle-tested sequence. I'll monitor progress and notify you of responses!`
}

function formatCoreFunnelStatusResponse(status: any): string {
  if (!status) {
    return `❌ **Core Funnel Status Not Found**

The execution ID might be invalid or the funnel may not be running. 

Try:
• Check your recent funnel executions
• Verify the execution ID is correct
• Start a new core funnel if needed`
  }

  const progressPercentage = status.progress?.completion_percentage || 0
  const progressEmoji = progressPercentage >= 75 ? '🟢' : progressPercentage >= 25 ? '🟡' : '🔴'

  return `📊 **SAM Core Funnel Status** ${progressEmoji}

**Execution Overview:**
• Status: ${status.status.toUpperCase()} ${progressEmoji}
• Progress: ${status.progress?.prospects_processed || 0}/${status.progress?.prospects_total || 0} prospects (${progressPercentage}%)
• Current Step: Step ${status.progress?.current_step || 1}

**Performance Metrics:**
• Connections Sent: ${status.performance?.connections_sent || 0}
• Connections Accepted: ${status.performance?.connections_accepted || 0} (${status.performance?.connection_rate || 0}%)
• Responses Received: ${status.performance?.responses_received || 0} (${status.performance?.response_rate || 0}%)
• Meetings Booked: ${status.performance?.meetings_booked || 0}

**Timeline:**
• Estimated Completion: ${status.estimated_completion ? new Date(status.estimated_completion).toLocaleDateString() : 'Calculating...'}

**Next Actions:**
${status.next_actions?.map((action: string) => `• ${action}`).join('\n') || '• Monitor funnel progress'}

${status.performance?.response_rate > 15 ? '🎉 **Outstanding Performance!** This funnel is exceeding benchmarks.' : 
  status.performance?.response_rate > 8 ? '👍 **Good Performance** - Core funnel performing as expected.' : 
  '⚠️ **Performance Alert** - Consider switching to a different core template.'}`
}

// Dynamic Funnel Formatting Functions
function formatDynamicFunnelCreationResponse(funnel: any): string {
  return `🌟 **Custom Dynamic Funnel Created!**

**Funnel Details:**
• Name: ${funnel.name}
• Type: AI-Generated Dynamic Sequence
• Target: ${funnel.target_persona?.role || 'Custom Persona'} in ${funnel.target_persona?.industry || 'Various Industries'}

**AI-Generated Sequence:**
• Total Steps: ${funnel.steps?.length || 0}
• Funnel Logic: ${Object.keys(funnel.funnel_logic?.triggers || {}).length} adaptive triggers
• Personalization: Advanced AI-powered messaging

**Sequence Overview:**
${funnel.steps?.slice(0, 3).map((step: any, i: number) => 
  `**Step ${i + 1}:** ${step.step_type} - "${step.message_template?.substring(0, 60) || 'Custom message'}..."`
).join('\n') || 'Sequence steps being finalized...'}

**N8N Workflow:**
• Workflow Status: ${funnel.n8n_workflow_id ? '✅ Deployed' : '⚠️ Deploying...'}
• Workflow ID: ${funnel.n8n_workflow_id || 'Pending deployment'}

**AI Reasoning:**
"${funnel.description}"

This custom funnel is specifically designed for your target persona and will adapt based on prospect responses. Ready to execute with your prospects!`
}

function formatDynamicFunnelExecutionResponse(execution: any): string {
  return `🌟 **Dynamic Funnel Execution Started!**

**Execution Details:**
• Execution ID: ${execution.id}
• Funnel: ${execution.funnel_id}
• Status: ${execution.status.toUpperCase()} 🚀

**AI-Powered Features:**
• Total Prospects: ${execution.prospects_total}
• Current Step: ${execution.current_step}
• Adaptive Logic: ✅ Enabled
• Response Analysis: ✅ Active

**Dynamic Capabilities:**
✨ **Real-time Adaptation** - Funnel adjusts based on prospect responses
🧠 **AI Message Optimization** - Messages improve with each interaction  
📊 **Behavioral Tracking** - Advanced engagement scoring
🎯 **Personalized Paths** - Each prospect gets customized journey

**Prospects Distribution:**
${Object.entries(execution.prospects_in_step || {}).map(([step, prospects]: [string, any]) => 
  `• Step ${step}: ${Array.isArray(prospects) ? prospects.length : 0} prospects`
).join('\n') || '• All prospects starting at Step 1'}

**Adaptation History:**
${execution.adaptation_history?.length || 0} AI adaptations made

Your dynamic funnel is now learning and adapting! I'll track AI improvements and notify you of optimization opportunities.`
}

function formatDynamicFunnelModificationResponse(modifiedFunnel: any): string {
  return `🔄 **Dynamic Funnel Modified Successfully!**

**Updated Funnel:**
• Name: ${modifiedFunnel.name}
• Modification: Applied based on your feedback
• AI Confidence: High

**Changes Made:**
• Sequence Updated: ${modifiedFunnel.steps?.length || 0} steps optimized
• Logic Enhanced: Triggers and conditions refined
• Messaging Improved: AI-generated improvements applied

**N8N Workflow:**
• Status: ${modifiedFunnel.n8n_workflow_id ? '✅ Updated and deployed' : '⚠️ Updating...'}
• Version: Latest with modifications

**Next Steps:**
Your modified funnel is ready for execution. The changes have been applied and the workflow updated automatically.

**AI Improvement Summary:**
"${modifiedFunnel.description}"

Ready to execute the improved funnel with your prospects!`
}

// Helper extraction functions for funnels
function extractFunnelTypeFromInput(input: string): string | undefined {
  if (/sam.*signature/i.test(input)) return 'sam_signature'
  if (/event.*invitation/i.test(input)) return 'event_invitation'
  if (/product.*launch/i.test(input)) return 'product_launch'
  return undefined
}

function extractMinConversionRate(input: string): number | undefined {
  const matches = input.match(/(?:conversion|convert).*?(\d+)%?/i)
  return matches ? parseInt(matches[1]) : undefined
}

function extractFunnelVariables(input: string): Record<string, any> {
  // Extract variables for funnel customization
  return {
    company_focus: extractIndustry(input),
    target_role: extractTargetRole(input),
    urgency_level: /urgent|asap|immediate/i.test(input) ? 'high' : 'medium'
  }
}

function extractExecutionId(input: string): string | undefined {
  const matches = input.match(/execution[:\s]+([a-f0-9\-]+)/i)
  return matches?.[1] || undefined
}

function extractFunnelId(input: string): string | undefined {
  const matches = input.match(/funnel[:\s]+([a-f0-9\-]+)/i)
  return matches?.[1] || undefined
}

function extractTargetPersona(input: string): any {
  return {
    role: extractTargetRole(input) || 'executive',
    industry: extractIndustry(input) || 'technology',
    company_size: extractCompanySize(input) || 'startup',
    seniority_level: extractSeniorityLevel(input),
    pain_points: extractPainPoints(input),
    goals: extractGoals(input),
    preferred_communication_style: extractCommunicationStyle(input),
    decision_making_process: extractDecisionMakingProcess(input)
  }
}

function extractBusinessObjective(input: string): string {
  if (/meeting|demo|call/i.test(input)) return 'book_meetings'
  if (/partnership|partner/i.test(input)) return 'establish_partnerships'
  if (/sale|revenue|purchase/i.test(input)) return 'generate_sales'
  if (/lead|interest|engagement/i.test(input)) return 'generate_leads'
  return 'generate_interest'
}

function extractFunnelConstraints(input: string): any {
  return {
    max_touches: extractMaxTouches(input),
    time_span_days: extractTimeSpan(input),
    channels: extractChannels(input),
    tone: extractTone(input) || 'professional',
    aggressiveness: extractAggressiveness(input),
    compliance_requirements: extractComplianceRequirements(input)
  }
}

function extractSeniorityLevel(input: string): string {
  if (/c-level|ceo|cto|cfo|coo|chief/i.test(input)) return 'c_level'
  if (/director|vp|vice.*president/i.test(input)) return 'director'
  if (/manager|lead/i.test(input)) return 'manager'
  if (/senior/i.test(input)) return 'senior'
  return 'mid_level'
}

function extractPainPoints(input: string): string[] {
  const painPoints = []
  if (/cost|expense|budget/i.test(input)) painPoints.push('cost_reduction')
  if (/efficiency|productivity/i.test(input)) painPoints.push('operational_efficiency')
  if (/compliance|regulation/i.test(input)) painPoints.push('compliance_challenges')
  if (/growth|scale/i.test(input)) painPoints.push('scaling_challenges')
  if (/security|risk/i.test(input)) painPoints.push('security_concerns')
  return painPoints.length > 0 ? painPoints : ['operational_efficiency']
}

function extractGoals(input: string): string[] {
  const goals = []
  if (/revenue|profit|income/i.test(input)) goals.push('increase_revenue')
  if (/efficiency|optimize/i.test(input)) goals.push('improve_efficiency')
  if (/growth|expand/i.test(input)) goals.push('business_growth')
  if (/innovation|modernize/i.test(input)) goals.push('innovation')
  return goals.length > 0 ? goals : ['business_growth']
}

function extractCommunicationStyle(input: string): string {
  if (/formal|professional/i.test(input)) return 'formal'
  if (/casual|friendly/i.test(input)) return 'casual'
  if (/direct|brief/i.test(input)) return 'direct'
  return 'professional'
}

function extractDecisionMakingProcess(input: string): string {
  if (/committee|team.*decision/i.test(input)) return 'committee'
  if (/individual|solo/i.test(input)) return 'individual'
  if (/consensus/i.test(input)) return 'consensus'
  return 'individual'
}

function extractMaxTouches(input: string): number | undefined {
  const matches = input.match(/(\d+)\s*(?:touch|contact|message)/i)
  return matches ? parseInt(matches[1]) : undefined
}

function extractTimeSpan(input: string): number | undefined {
  const matches = input.match(/(\d+)\s*(?:day|week)/i)
  const multiplier = /week/i.test(input) ? 7 : 1
  return matches ? parseInt(matches[1]) * multiplier : undefined
}

function extractAggressiveness(input: string): string {
  if (/aggressive|pushy|direct/i.test(input)) return 'aggressive'
  if (/soft|gentle|nurture/i.test(input)) return 'soft'
  return 'medium'
}

function extractComplianceRequirements(input: string): string[] {
  const requirements = []
  if (/gdpr/i.test(input)) requirements.push('GDPR')
  if (/hipaa/i.test(input)) requirements.push('HIPAA')
  if (/sox|sarbanes/i.test(input)) requirements.push('SOX')
  if (/finra/i.test(input)) requirements.push('FINRA')
  return requirements
}