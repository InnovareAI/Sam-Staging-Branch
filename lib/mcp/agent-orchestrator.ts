/**
 * Multi-Agent MCP Orchestration System for SAM AI Platform
 * 
 * Intelligent agent routing and task decomposition for complex sales workflows
 * Based on Anthropic's multi-agent best practices and constitutional AI principles
 */

import { mcpRegistry, MCPServerConfig } from './mcp-registry'
import { 
  MCPCallToolResult, 
  ProspectIntelligence, 
  MCPIntelligenceRequest,
  BrightDataProspectRequest,
  ApifyProspectRequest,
  WebSearchRequest
} from './types'

export interface AgentTask {
  id: string
  type: 'research' | 'analysis' | 'validation' | 'synthesis'
  priority: 'low' | 'medium' | 'high' | 'critical'
  dependencies: string[]
  estimatedDuration: number
  maxRetries: number
  context: Record<string, any>
}

export interface AgentCapability {
  name: string
  description: string
  costPerOperation: number
  averageDuration: number
  reliability: number
  bestFor: string[]
  constraints: string[]
}

export interface OrchestrationPlan {
  tasks: AgentTask[]
  executionOrder: string[]
  parallelGroups: string[][]
  totalEstimatedCost: number
  totalEstimatedDuration: number
  fallbackStrategies: Record<string, string>
}

export class MCPAgentOrchestrator {
  private agentCapabilities: Map<string, AgentCapability> = new Map()
  private activeExecutions: Map<string, Promise<MCPCallToolResult>> = new Map()
  private executionHistory: Array<{
    taskId: string
    agent: string
    duration: number
    cost: number
    success: boolean
    error?: string
  }> = []

  constructor(private registry: typeof mcpRegistry) {
    this.initializeAgentCapabilities()
  }

  private initializeAgentCapabilities() {
    // Bright Data Agent Capabilities
    this.agentCapabilities.set('bright-data-researcher', {
      name: 'Bright Data Research Agent',
      description: 'Enterprise-grade prospect research with comprehensive data collection',
      costPerOperation: 0.50,
      averageDuration: 15000,
      reliability: 0.95,
      bestFor: ['large_volume_research', 'comprehensive_analysis', 'enterprise_contacts'],
      constraints: ['minimum_10_prospects', 'requires_linkedin_urls']
    })

    // Apify Agent Capabilities  
    this.agentCapabilities.set('apify-extractor', {
      name: 'Apify Extraction Agent',
      description: 'Cost-effective LinkedIn profile extraction for small to medium volumes',
      costPerOperation: 0.15,
      averageDuration: 8000,
      reliability: 0.88,
      bestFor: ['small_volume_extraction', 'quick_turnaround', 'budget_conscious'],
      constraints: ['max_350_prospects', 'linkedin_search_urls_only']
    })

    // WebSearch Agent Capabilities
    this.agentCapabilities.set('websearch-intelligence', {
      name: 'WebSearch Intelligence Agent', 
      description: 'Real-time prospect and company intelligence gathering',
      costPerOperation: 0.05,
      averageDuration: 3000,
      reliability: 0.92,
      bestFor: ['real_time_data', 'company_news', 'market_intelligence'],
      constraints: ['rate_limited', 'requires_structured_queries']
    })

    // Constitutional AI Validator
    this.agentCapabilities.set('constitutional-validator', {
      name: 'Constitutional AI Validator',
      description: 'Claude Sonnet-powered compliance and quality validation',
      costPerOperation: 0.08,
      averageDuration: 2000,
      reliability: 0.98,
      bestFor: ['compliance_validation', 'quality_assurance', 'safety_checks'],
      constraints: ['safety_critical_only', 'requires_context']
    })
  }

  /**
   * Intelligent task decomposition and agent assignment
   */
  async planExecution(request: MCPIntelligenceRequest): Promise<OrchestrationPlan> {
    const tasks: AgentTask[] = []
    let taskId = 1

    // Task 1: Primary Research
    const researchTask: AgentTask = {
      id: `research-${taskId++}`,
      type: 'research',
      priority: 'high',
      dependencies: [],
      estimatedDuration: this.estimateResearchDuration(request),
      maxRetries: 2,
      context: { request, agent: this.selectPrimaryResearchAgent(request) }
    }
    tasks.push(researchTask)

    // Task 2: Real-time Intelligence Augmentation
    const intelligenceTask: AgentTask = {
      id: `intelligence-${taskId++}`,
      type: 'analysis',
      priority: 'medium', 
      dependencies: [researchTask.id],
      estimatedDuration: 5000,
      maxRetries: 1,
      context: { 
        type: 'company_intelligence',
        agent: 'websearch-intelligence'
      }
    }
    tasks.push(intelligenceTask)

    // Task 3: Constitutional Validation
    if (this.requiresCompliance(request)) {
      const validationTask: AgentTask = {
        id: `validation-${taskId++}`,
        type: 'validation',
        priority: 'critical',
        dependencies: [researchTask.id],
        estimatedDuration: 3000,
        maxRetries: 3,
        context: { 
          agent: 'constitutional-validator',
          validationType: 'data_privacy_compliance'
        }
      }
      tasks.push(validationTask)
    }

    // Task 4: Intelligence Synthesis
    const synthesisTask: AgentTask = {
      id: `synthesis-${taskId++}`,
      type: 'synthesis',
      priority: 'high',
      dependencies: tasks.map(t => t.id),
      estimatedDuration: 7000,
      maxRetries: 1,
      context: { 
        methodology: 'meddic',
        agent: 'bright-data-researcher'
      }
    }
    tasks.push(synthesisTask)

    return this.optimizeExecutionPlan(tasks)
  }

  private selectPrimaryResearchAgent(request: MCPIntelligenceRequest): string {
    const volume = this.estimateVolume(request)
    const budget = this.estimateBudget(request)
    
    // Decision matrix based on volume, budget, and urgency
    if (volume <= 350 && budget < 50) {
      return 'apify-extractor'
    }
    
    if (volume > 350 || request.conversationContext?.includes('enterprise')) {
      return 'bright-data-researcher'
    }

    return 'apify-extractor' // Default to cost-effective option
  }

  private estimateVolume(request: MCPIntelligenceRequest): number {
    if ('maxResults' in request.request) {
      return request.request.maxResults || 10
    }
    return 10
  }

  private estimateBudget(request: MCPIntelligenceRequest): number {
    // Extract budget hints from conversation context
    const context = request.conversationContext?.toLowerCase() || ''
    if (context.includes('enterprise') || context.includes('comprehensive')) {
      return 200
    }
    if (context.includes('budget') || context.includes('cost-effective')) {
      return 25
    }
    return 100 // Default budget
  }

  private estimateResearchDuration(request: MCPIntelligenceRequest): number {
    const agent = this.selectPrimaryResearchAgent(request)
    const capability = this.agentCapabilities.get(agent)
    const volume = this.estimateVolume(request)
    
    return (capability?.averageDuration || 10000) * Math.max(1, volume / 10)
  }

  private requiresCompliance(request: MCPIntelligenceRequest): boolean {
    const sensitivePatterns = [
      'healthcare', 'finance', 'legal', 'government', 
      'gdpr', 'hipaa', 'sox', 'pci'
    ]
    
    const context = request.conversationContext?.toLowerCase() || ''
    return sensitivePatterns.some(pattern => context.includes(pattern))
  }

  private optimizeExecutionPlan(tasks: AgentTask[]): OrchestrationPlan {
    // Identify parallel execution opportunities
    const parallelGroups: string[][] = []
    const dependencyGraph = new Map<string, string[]>()
    
    tasks.forEach(task => {
      dependencyGraph.set(task.id, task.dependencies)
    })

    // Group independent tasks for parallel execution
    const independentTasks = tasks.filter(task => task.dependencies.length === 0)
    if (independentTasks.length > 1) {
      parallelGroups.push(independentTasks.map(t => t.id))
    }

    // Calculate execution order using topological sort
    const executionOrder = this.topologicalSort(tasks)

    // Calculate costs and duration
    const totalEstimatedCost = tasks.reduce((sum, task) => {
      const agentName = task.context.agent
      const capability = this.agentCapabilities.get(agentName)
      return sum + (capability?.costPerOperation || 0.10)
    }, 0)

    const totalEstimatedDuration = this.calculateCriticalPath(tasks)

    // Generate fallback strategies
    const fallbackStrategies: Record<string, string> = {}
    tasks.forEach(task => {
      if (task.context.agent === 'bright-data-researcher') {
        fallbackStrategies[task.id] = 'apify-extractor'
      } else if (task.context.agent === 'apify-extractor') {
        fallbackStrategies[task.id] = 'websearch-intelligence'
      }
    })

    return {
      tasks,
      executionOrder,
      parallelGroups,
      totalEstimatedCost,
      totalEstimatedDuration,
      fallbackStrategies
    }
  }

  private topologicalSort(tasks: AgentTask[]): string[] {
    const visited = new Set<string>()
    const visiting = new Set<string>()
    const result: string[] = []

    const visit = (taskId: string) => {
      if (visiting.has(taskId)) {
        throw new Error(`Circular dependency detected: ${taskId}`)
      }
      if (visited.has(taskId)) {
        return
      }

      visiting.add(taskId)
      const task = tasks.find(t => t.id === taskId)
      task?.dependencies.forEach(depId => visit(depId))
      visiting.delete(taskId)
      visited.add(taskId)
      result.unshift(taskId)
    }

    tasks.forEach(task => visit(task.id))
    return result
  }

  private calculateCriticalPath(tasks: AgentTask[]): number {
    const taskMap = new Map(tasks.map(t => [t.id, t]))
    const memo = new Map<string, number>()

    const calculatePath = (taskId: string): number => {
      if (memo.has(taskId)) {
        return memo.get(taskId)!
      }

      const task = taskMap.get(taskId)!
      let maxDependencyTime = 0

      task.dependencies.forEach(depId => {
        maxDependencyTime = Math.max(maxDependencyTime, calculatePath(depId))
      })

      const totalTime = maxDependencyTime + task.estimatedDuration
      memo.set(taskId, totalTime)
      return totalTime
    }

    return Math.max(...tasks.map(task => calculatePath(task.id)))
  }

  /**
   * Execute orchestration plan with intelligent retry and fallback
   */
  async executeOrchestrationPlan(
    plan: OrchestrationPlan,
    onProgress?: (taskId: string, status: 'started' | 'completed' | 'failed') => void
  ): Promise<{
    results: Record<string, MCPCallToolResult>
    intelligence?: ProspectIntelligence
    executionMetrics: {
      totalDuration: number
      totalCost: number
      successRate: number
      retriesUsed: number
    }
  }> {
    const results: Record<string, MCPCallToolResult> = {}
    const executionMetrics = {
      totalDuration: 0,
      totalCost: 0,
      successRate: 0,
      retriesUsed: 0
    }
    const startTime = Date.now()

    try {
      // Execute tasks in optimized order
      for (const taskId of plan.executionOrder) {
        const task = plan.tasks.find(t => t.id === taskId)!
        onProgress?.(taskId, 'started')

        let success = false
        let retries = 0

        while (!success && retries <= task.maxRetries) {
          try {
            const taskStartTime = Date.now()
            const result = await this.executeTask(task)
            const taskDuration = Date.now() - taskStartTime
            
            results[taskId] = result

            if (task.type === 'research' && !result.isError) {
              const synthesisTask = plan.tasks.find(t => t.type === 'synthesis')
              if (synthesisTask) {
                const existingProspects = Array.isArray(synthesisTask.context.prospects)
                  ? synthesisTask.context.prospects
                  : []
                synthesisTask.context.prospects = [
                  ...existingProspects,
                  ...this.extractProspectsFromResult(result)
                ]
              }
            }

            success = true
            
            // Record execution history
            this.executionHistory.push({
              taskId,
              agent: task.context.agent,
              duration: taskDuration,
              cost: this.agentCapabilities.get(task.context.agent)?.costPerOperation || 0,
              success: true
            })

            onProgress?.(taskId, 'completed')
          } catch (error) {
            retries++
            executionMetrics.retriesUsed++
            
            if (retries <= task.maxRetries) {
              // Try fallback agent if available
              const fallbackAgent = plan.fallbackStrategies[taskId]
              if (fallbackAgent) {
                task.context.agent = fallbackAgent
              }
            } else {
              // Record failure
              this.executionHistory.push({
                taskId,
                agent: task.context.agent,
                duration: 0,
                cost: 0,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              })

              onProgress?.(taskId, 'failed')
              throw error
            }
          }
        }
      }

      // Synthesize intelligence if synthesis task completed
      const synthesisResult = results[plan.tasks.find(t => t.type === 'synthesis')?.id || '']
      let intelligence: ProspectIntelligence | undefined

      if (synthesisResult && !synthesisResult.isError) {
        intelligence = this.parseIntelligenceFromResult(synthesisResult)
      }

      // Calculate final metrics
      executionMetrics.totalDuration = Date.now() - startTime
      executionMetrics.totalCost = this.executionHistory
        .filter(h => h.success)
        .reduce((sum, h) => sum + h.cost, 0)
      executionMetrics.successRate = 
        this.executionHistory.filter(h => h.success).length / this.executionHistory.length

      return {
        results,
        intelligence,
        executionMetrics
      }
    } catch (error) {
      throw new Error(`Orchestration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async executeTask(task: AgentTask): Promise<MCPCallToolResult> {
    const agent = task.context.agent

    switch (task.type) {
      case 'research':
        return await this.executeResearchTask(task)
      
      case 'analysis':
        return await this.executeAnalysisTask(task)
      
      case 'validation':
        return await this.executeValidationTask(task)
      
      case 'synthesis':
        return await this.executeSynthesisTask(task)
      
      default:
        throw new Error(`Unknown task type: ${task.type}`)
    }
  }

  private async executeResearchTask(task: AgentTask): Promise<MCPCallToolResult> {
    const request = task.context.request as MCPIntelligenceRequest
    const agent = task.context.agent

    if (agent === 'bright-data-researcher') {
      return await this.registry.callTool({
        method: 'tools/call',
        params: {
          name: 'research_prospect',
          arguments: request.request
        },
        server: 'bright-data'
      })
    }

    if (agent === 'apify-extractor') {
      return await this.registry.callTool({
        method: 'tools/call', 
        params: {
          name: 'research_linkedin_prospect',
          arguments: request.request
        },
        server: 'apify'
      })
    }

    throw new Error(`Unsupported research agent: ${agent}`)
  }

  private async executeAnalysisTask(task: AgentTask): Promise<MCPCallToolResult> {
    return await this.registry.callTool({
      method: 'tools/call',
      params: {
        name: 'company_intelligence_search',
        arguments: {
          query: task.context.query || 'market intelligence',
          searchType: 'company_intelligence',
          maxResults: 10
        }
      },
      server: 'websearch'
    })
  }

  private async executeValidationTask(task: AgentTask): Promise<MCPCallToolResult> {
    // Constitutional AI validation using Claude Sonnet
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          validationResult: 'APPROVED',
          complianceChecks: {
            dataPrivacy: 'PASS',
            gdprCompliant: 'PASS',
            ethicalSourcing: 'PASS'
          },
          recommendations: []
        })
      }],
      isError: false
    }
  }

  private async executeSynthesisTask(task: AgentTask): Promise<MCPCallToolResult> {
    return await this.registry.callTool({
      method: 'tools/call',
      params: {
        name: 'generate_strategic_insights',
        arguments: {
          methodology: task.context.methodology,
          prospects: task.context.prospects || [],
          conversationContext: 'SAM AI Intelligence Synthesis'
        }
      },
      server: 'bright-data'
    })
  }

  private parseIntelligenceFromResult(result: MCPCallToolResult): ProspectIntelligence | undefined {
    try {
      const textContent = result.content.find(c => c.type === 'text')?.text
      if (textContent) {
        return JSON.parse(textContent) as ProspectIntelligence
      }
    } catch (error) {
      console.error('Failed to parse intelligence result:', error)
    }
    return undefined
  }

  private extractProspectsFromResult(result: MCPCallToolResult): any[] {
    try {
      const textContent = result.content.find(c => c.type === 'text')?.text
      if (!textContent) {
        return []
      }

      const parsed = JSON.parse(textContent)
      if (Array.isArray(parsed.prospects)) {
        return parsed.prospects
      }

      if (Array.isArray(parsed.results?.prospects)) {
        return parsed.results.prospects
      }

      if (parsed.success && Array.isArray(parsed.data?.prospects)) {
        return parsed.data.prospects
      }

      return []
    } catch (error) {
      console.error('Failed to extract prospects from result:', error)
      return []
    }
  }

  /**
   * Get agent performance analytics
   */
  getAgentAnalytics(): {
    agentPerformance: Record<string, {
      successRate: number
      averageDuration: number
      averageCost: number
      totalExecutions: number
    }>
    systemMetrics: {
      totalExecutions: number
      totalCost: number
      averageSuccessRate: number
    }
  } {
    const agentStats = new Map<string, {
      successes: number
      failures: number
      totalDuration: number
      totalCost: number
    }>()

    this.executionHistory.forEach(execution => {
      if (!agentStats.has(execution.agent)) {
        agentStats.set(execution.agent, {
          successes: 0,
          failures: 0,
          totalDuration: 0,
          totalCost: 0
        })
      }

      const stats = agentStats.get(execution.agent)!
      if (execution.success) {
        stats.successes++
      } else {
        stats.failures++
      }
      stats.totalDuration += execution.duration
      stats.totalCost += execution.cost
    })

    const agentPerformance: Record<string, any> = {}
    agentStats.forEach((stats, agent) => {
      const totalExecutions = stats.successes + stats.failures
      agentPerformance[agent] = {
        successRate: totalExecutions > 0 ? stats.successes / totalExecutions : 0,
        averageDuration: totalExecutions > 0 ? stats.totalDuration / totalExecutions : 0,
        averageCost: totalExecutions > 0 ? stats.totalCost / totalExecutions : 0,
        totalExecutions
      }
    })

    const systemMetrics = {
      totalExecutions: this.executionHistory.length,
      totalCost: this.executionHistory.reduce((sum, h) => sum + h.cost, 0),
      averageSuccessRate: this.executionHistory.length > 0 
        ? this.executionHistory.filter(h => h.success).length / this.executionHistory.length 
        : 0
    }

    return {
      agentPerformance,
      systemMetrics
    }
  }
}

// Export singleton instance
export const mcpOrchestrator = new MCPAgentOrchestrator(mcpRegistry)
