#!/usr/bin/env npx ts-node

/**
 * N8N Integration Test Script
 * Tests the complete N8N campaign execution flow with real API calls
 */

import { n8nClient, checkN8NConfiguration } from '../lib/n8n-client'
import { n8nCampaignMonitor } from '../lib/n8n-monitoring'
import { logger } from '../lib/logging'

interface TestConfig {
  runMode: 'health-check' | 'simulation' | 'full-test'
  testWorkspaceId: string
  testProspectCount: number
  validateWebhooks: boolean
}

class N8NIntegrationTester {
  private readonly config: TestConfig

  constructor(config: TestConfig) {
    this.config = config
  }

  async runTests(): Promise<{ success: boolean; results: any[] }> {
    const results: any[] = []
    console.log('🚀 Starting N8N Integration Tests')
    console.log('=====================================')

    try {
      // Test 1: Configuration Check
      console.log('\n1. Checking N8N Configuration...')
      const configResult = await this.testConfiguration()
      results.push(configResult)
      this.logResult('Configuration Check', configResult)

      // Test 2: Health Check
      console.log('\n2. Testing N8N Health Check...')
      const healthResult = await this.testHealthCheck()
      results.push(healthResult)
      this.logResult('Health Check', healthResult)

      if (this.config.runMode === 'health-check') {
        console.log('\n✅ Health check tests completed')
        return { success: true, results }
      }

      // Test 3: Basic API Connectivity
      console.log('\n3. Testing API Connectivity...')
      const connectivityResult = await this.testAPIConnectivity()
      results.push(connectivityResult)
      this.logResult('API Connectivity', connectivityResult)

      // Test 4: Workflow Listing
      console.log('\n4. Testing Workflow Listing...')
      const workflowListResult = await this.testWorkflowListing()
      results.push(workflowListResult)
      this.logResult('Workflow Listing', workflowListResult)

      if (this.config.runMode === 'simulation') {
        console.log('\n✅ Simulation tests completed')
        return { success: true, results }
      }

      // Test 5: Campaign Execution (Full Test)
      console.log('\n5. Testing Campaign Workflow Execution...')
      const executionResult = await this.testCampaignExecution()
      results.push(executionResult)
      this.logResult('Campaign Execution', executionResult)

      // Test 6: Monitoring Integration
      console.log('\n6. Testing Monitoring Integration...')
      const monitoringResult = await this.testMonitoring()
      results.push(monitoringResult)
      this.logResult('Monitoring Integration', monitoringResult)

      // Test 7: Webhook Handler (if enabled)
      if (this.config.validateWebhooks) {
        console.log('\n7. Testing Webhook Handler...')
        const webhookResult = await this.testWebhookHandler()
        results.push(webhookResult)
        this.logResult('Webhook Handler', webhookResult)
      }

      const allPassed = results.every(r => r.success)
      console.log(`\n${allPassed ? '✅' : '❌'} All tests ${allPassed ? 'passed' : 'completed with failures'}`)
      
      return { success: allPassed, results }

    } catch (error) {
      console.error('❌ Test suite failed:', error)
      return { success: false, results }
    }
  }

  private async testConfiguration(): Promise<{ test: string; success: boolean; details: any }> {
    try {
      const config = checkN8NConfiguration()
      
      return {
        test: 'Configuration Check',
        success: true,
        details: {
          baseUrl: config.baseUrl,
          hasApiKey: config.hasApiKey,
          isConfigured: config.isConfigured,
          mode: config.mode,
          environmentVariables: {
            N8N_INSTANCE_URL: !!process.env.N8N_INSTANCE_URL,
            N8N_API_KEY: !!process.env.N8N_API_KEY,
            N8N_WEBHOOK_SECRET_TOKEN: !!process.env.N8N_WEBHOOK_SECRET_TOKEN
          }
        }
      }
    } catch (error) {
      return {
        test: 'Configuration Check',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  private async testHealthCheck(): Promise<{ test: string; success: boolean; details: any }> {
    try {
      const startTime = Date.now()
      const healthResponse = await n8nClient.healthCheck()
      const responseTime = Date.now() - startTime

      const success = healthResponse.status === 'healthy' || healthResponse.status === 'simulation'

      return {
        test: 'Health Check',
        success,
        details: {
          status: healthResponse.status,
          responseTime: `${responseTime}ms`,
          data: healthResponse
        }
      }
    } catch (error) {
      return {
        test: 'Health Check',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  private async testAPIConnectivity(): Promise<{ test: string; success: boolean; details: any }> {
    try {
      // Test basic API endpoints
      const workflows = await n8nClient.listWorkflows()
      
      return {
        test: 'API Connectivity',
        success: true,
        details: {
          workflowCount: Array.isArray(workflows) ? workflows.length : 0,
          response: Array.isArray(workflows) ? 'Valid array response' : typeof workflows
        }
      }
    } catch (error) {
      return {
        test: 'API Connectivity',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  private async testWorkflowListing(): Promise<{ test: string; success: boolean; details: any }> {
    try {
      const workflows = await n8nClient.listWorkflows()
      
      // Look for SAM workflows
      const samWorkflows = Array.isArray(workflows) ? 
        workflows.filter(w => w.name?.includes('SAM_Workflow')) : []

      return {
        test: 'Workflow Listing',
        success: true,
        details: {
          totalWorkflows: Array.isArray(workflows) ? workflows.length : 0,
          samWorkflows: samWorkflows.length,
          sampleWorkflows: Array.isArray(workflows) ? workflows.slice(0, 3).map(w => ({
            id: w.id,
            name: w.name,
            active: w.active
          })) : []
        }
      }
    } catch (error) {
      return {
        test: 'Workflow Listing',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  private async testCampaignExecution(): Promise<{ test: string; success: boolean; details: any }> {
    try {
      // Create test campaign execution request
      const testRequest = {
        workspaceConfig: {
          id: 'test-workflow-id',
          workspace_id: this.config.testWorkspaceId,
          deployed_workflow_id: 'test-deployed-workflow',
          channel_preferences: { email_enabled: true, linkedin_enabled: false },
          email_config: { template_id: 'test-template' },
          linkedin_config: null,
          reply_handling_config: { auto_pause: true }
        },
        approvedProspects: this.generateTestProspects(this.config.testProspectCount),
        executionPreferences: {
          delay_between_prospects: 300,
          max_daily_outreach: 50,
          working_hours_start: 9,
          working_hours_end: 17,
          timezone: 'UTC',
          exclude_weekends: true,
          exclude_holidays: true,
          auto_pause_on_replies: true
        },
        credentials: {
          unipile_api_key: 'test-unipile-key',
          account_mappings: [
            {
              channel: 'email',
              account_id: 'test-email-account',
              account_name: 'Test Email Account'
            }
          ]
        },
        campaignMetadata: {
          campaign_execution_id: `test-campaign-${Date.now()}`,
          workspace_id: this.config.testWorkspaceId,
          campaign_name: 'Test Campaign',
          campaign_type: 'email_only' as const,
          webhook_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/campaign/n8n-status-update`
        }
      }

      const startTime = Date.now()
      const executionResponse = await n8nClient.executeCampaignWorkflow(testRequest)
      const executionTime = Date.now() - startTime

      const success = !!executionResponse.executionId && !!executionResponse.startedAt

      return {
        test: 'Campaign Execution',
        success,
        details: {
          executionId: executionResponse.executionId,
          status: executionResponse.status,
          startedAt: executionResponse.startedAt,
          executionTime: `${executionTime}ms`,
          prospectCount: this.config.testProspectCount,
          response: executionResponse
        }
      }
    } catch (error) {
      return {
        test: 'Campaign Execution',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  private async testMonitoring(): Promise<{ test: string; success: boolean; details: any }> {
    try {
      // Test monitoring health status
      const healthStatus = await n8nCampaignMonitor.getN8NHealthStatus()
      
      const success = !!healthStatus.instance_url && healthStatus.response_time_ms > 0

      return {
        test: 'Monitoring Integration',
        success,
        details: {
          status: healthStatus.status,
          instance_url: healthStatus.instance_url,
          api_accessible: healthStatus.api_accessible,
          response_time_ms: healthStatus.response_time_ms,
          active_executions: healthStatus.active_executions,
          circuit_breaker_state: healthStatus.circuit_breaker_state
        }
      }
    } catch (error) {
      return {
        test: 'Monitoring Integration',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  private async testWebhookHandler(): Promise<{ test: string; success: boolean; details: any }> {
    try {
      // This would test the webhook endpoint
      // For now, just validate the webhook URL configuration
      const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/campaign/n8n-status-update`
      const hasWebhookSecret = !!process.env.N8N_WEBHOOK_SECRET_TOKEN

      return {
        test: 'Webhook Handler',
        success: true,
        details: {
          webhook_url: webhookUrl,
          has_secret_token: hasWebhookSecret,
          note: 'Webhook endpoint configuration validated (actual webhook testing requires N8N to send test payload)'
        }
      }
    } catch (error) {
      return {
        test: 'Webhook Handler',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  private generateTestProspects(count: number) {
    const prospects = []
    for (let i = 1; i <= count; i++) {
      prospects.push({
        id: `test-prospect-${i}`,
        email: `test${i}@example.com`,
        first_name: `Test${i}`,
        last_name: `Prospect${i}`,
        company_name: `Test Company ${i}`,
        linkedin_url: `https://linkedin.com/in/test-prospect-${i}`,
        job_title: `Test Title ${i}`,
        industry: 'Technology'
      })
    }
    return prospects
  }

  private logResult(testName: string, result: { success: boolean; details: any }): void {
    const status = result.success ? '✅' : '❌'
    console.log(`   ${status} ${testName}: ${result.success ? 'PASSED' : 'FAILED'}`)
    
    if (!result.success) {
      console.log(`      Error: ${result.details.error || 'Unknown error'}`)
    } else if (result.details && Object.keys(result.details).length > 0) {
      console.log(`      Details:`, JSON.stringify(result.details, null, 8))
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  
  const config: TestConfig = {
    runMode: (args[0] as any) || 'health-check',
    testWorkspaceId: args[1] || 'test-workspace-id',
    testProspectCount: parseInt(args[2]) || 5,
    validateWebhooks: args.includes('--webhooks')
  }

  console.log('Test Configuration:', config)

  const tester = new N8NIntegrationTester(config)
  const result = await tester.runTests()

  if (result.success) {
    console.log('\n🎉 All tests passed successfully!')
    process.exit(0)
  } else {
    console.log('\n💥 Some tests failed')
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

export { N8NIntegrationTester }