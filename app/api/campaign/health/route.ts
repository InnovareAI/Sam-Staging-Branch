/**
 * Campaign API Health Check with Circuit Breaker Integration
 * Comprehensive health monitoring for all campaign-related services
 * 
 * CHECKS:
 * - Database circuit breaker status
 * - N8N API circuit breaker status  
 * - External service circuit breakers (Unipile, ReachInbox, etc.)
 * - Overall system resilience score
 * - Rate limiting status
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger, PerformanceMonitor } from '@/lib/logging'
import { circuitBreakerRegistry } from '@/lib/circuit-breaker'
import { externalServiceManager } from '@/lib/external-service-circuit-breakers'
import { createTransactionManager } from '@/lib/database-transaction'
import { n8nClient } from '@/lib/n8n-client'
import { pool } from '@/lib/db'
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limit'

// GET - Comprehensive campaign system health check
export async function GET(request: NextRequest) {
  const monitor = new PerformanceMonitor()
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const includeMetrics = searchParams.get('metrics') === 'true'
    const includeRateLimit = searchParams.get('rate_limit') === 'true'

    // Track health check request
    logger.info('Campaign health check requested', {
      metadata: {
        include_metrics: includeMetrics,
        include_rate_limit: includeRateLimit,
        request_id: `health_${Date.now()}`
      }
    })

    // Parallel health checks for performance
    monitor.mark('health_checks_start')
    
    const [
      databaseHealth,
      n8nHealth,
      externalServicesHealth,
      circuitBreakerHealth
    ] = await Promise.allSettled([
      checkDatabaseHealth(),
      checkN8NHealth(),
      checkExternalServicesHealth(),
      checkCircuitBreakerHealth()
    ])

    monitor.mark('health_checks_complete')

    // Rate limiting health check (if requested)
    let rateLimitHealth = null
    if (includeRateLimit) {
      monitor.mark('rate_limit_check_start')
      rateLimitHealth = await checkRateLimitHealth()
      monitor.mark('rate_limit_check_complete')
    }

    // Calculate overall system health
    const healthResults = {
      database: getSettledResult(databaseHealth),
      n8n: getSettledResult(n8nHealth),
      external_services: getSettledResult(externalServicesHealth),
      circuit_breakers: getSettledResult(circuitBreakerHealth),
      rate_limiting: rateLimitHealth
    }

    const resilienceScore = calculateResilienceScore(healthResults)
    const overallStatus = determineOverallStatus(healthResults, resilienceScore)

    const healthResponse = {
      success: true,
      status: overallStatus,
      resilience_score: resilienceScore,
      timestamp: new Date().toISOString(),
      response_time_ms: Date.now() - startTime,
      components: healthResults,
      summary: {
        healthy_components: Object.values(healthResults).filter(h => h?.status === 'healthy').length,
        degraded_components: Object.values(healthResults).filter(h => h?.status === 'degraded').length,
        unhealthy_components: Object.values(healthResults).filter(h => h?.status === 'unhealthy' || h?.status === 'error').length,
        total_components: Object.values(healthResults).filter(h => h !== null).length
      }
    }

    // Add detailed metrics if requested
    if (includeMetrics) {
      healthResponse['performance_metrics'] = {
        total_duration_ms: monitor.getTotalDuration(),
        check_durations: {
          database_ms: monitor.measure('health_checks_start') - monitor.measure('health_checks_complete'),
          rate_limit_ms: includeRateLimit ? monitor.measure('rate_limit_check_complete') - monitor.measure('rate_limit_check_start') : null
        }
      }
    }

    // Log health check completion
    logger.info('Campaign health check completed', {
      metadata: {
        status: overallStatus,
        resilience_score: resilienceScore,
        duration_ms: Date.now() - startTime,
        healthy_components: healthResponse.summary.healthy_components,
        total_components: healthResponse.summary.total_components
      }
    })

    // Return appropriate HTTP status based on health
    const httpStatus = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503

    return NextResponse.json(healthResponse, { status: httpStatus })

  } catch (error) {
    const duration = Date.now() - startTime
    
    logger.error('Campaign health check failed', error as Error, {
      metadata: {
        duration_ms: duration
      }
    })

    return NextResponse.json({
      success: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString(),
      response_time_ms: duration
    }, { status: 500 })
  }
}

/**
 * Check database health including circuit breaker status
 */
async function checkDatabaseHealth(): Promise<any> {
  try {
    const transactionManager = createTransactionManager(pool)
    const health = await transactionManager.healthCheck()
    
    return {
      status: health.status,
      latency_ms: health.latency_ms,
      circuit_breaker: health.circuit_breaker_status,
      connection_pool: health.connection_pool_status,
      last_error: health.last_error
    }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Database health check failed'
    }
  }
}

/**
 * Check N8N API health and circuit breaker status
 */
async function checkN8NHealth(): Promise<any> {
  try {
    const health = await n8nClient.healthCheck()
    const n8nCircuitBreaker = circuitBreakerRegistry.getAllCircuitBreakers().get('n8n-api')
    
    return {
      status: health.status === 'healthy' ? 'healthy' : 
              health.status === 'simulation' ? 'degraded' : 'unhealthy',
      n8n_status: health.status,
      message: health.message || health.error,
      circuit_breaker: n8nCircuitBreaker ? n8nCircuitBreaker.healthCheck() : null,
      timestamp: health.timestamp
    }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'N8N health check failed'
    }
  }
}

/**
 * Check external services health
 */
async function checkExternalServicesHealth(): Promise<any> {
  try {
    const statusReport = externalServiceManager.getStatusReport()
    
    return {
      status: statusReport.healthy ? 'healthy' : 'degraded',
      services: statusReport.services,
      summary: statusReport.summary
    }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'External services health check failed'
    }
  }
}

/**
 * Check circuit breaker system health
 */
async function checkCircuitBreakerHealth(): Promise<any> {
  try {
    const allCircuitBreakers = circuitBreakerRegistry.getAllCircuitBreakers()
    const healthStatus = circuitBreakerRegistry.getHealthStatus()
    
    let healthyCount = 0
    let degradedCount = 0
    let unhealthyCount = 0
    
    for (const status of Object.values(healthStatus)) {
      if (status.healthy) {
        healthyCount++
      } else if (status.issues?.length > 0) {
        degradedCount++
      } else {
        unhealthyCount++
      }
    }
    
    const overallHealthy = unhealthyCount === 0
    const overallDegraded = degradedCount > 0 && unhealthyCount === 0
    
    return {
      status: overallHealthy ? 'healthy' : (overallDegraded ? 'degraded' : 'unhealthy'),
      total_circuit_breakers: allCircuitBreakers.size,
      healthy: healthyCount,
      degraded: degradedCount,
      unhealthy: unhealthyCount,
      detailed_status: healthStatus
    }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Circuit breaker health check failed'
    }
  }
}

/**
 * Check rate limiting system health
 */
async function checkRateLimitHealth(): Promise<any> {
  try {
    // Test rate limiting functionality
    const testResult = await rateLimiter.checkRateLimit({
      key: 'health_check',
      limit: 100,
      window: 60,
      identifier: 'system'
    })
    
    return {
      status: 'healthy',
      functional: testResult.success !== undefined,
      test_remaining: testResult.remaining,
      test_reset_time: testResult.resetTime
    }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Rate limiting health check failed'
    }
  }
}

/**
 * Calculate system resilience score (0-100)
 */
function calculateResilienceScore(healthResults: Record<string, any>): number {
  let totalScore = 0
  let componentCount = 0
  
  const weights = {
    database: 30,        // Critical
    n8n: 25,            // Critical
    external_services: 20, // Important
    circuit_breakers: 20,  // Important
    rate_limiting: 5     // Nice to have
  }
  
  for (const [component, result] of Object.entries(healthResults)) {
    if (result === null) continue
    
    const weight = weights[component as keyof typeof weights] || 10
    let score = 0
    
    switch (result.status) {
      case 'healthy':
        score = 100
        break
      case 'degraded':
        score = 60
        break
      case 'unhealthy':
        score = 20
        break
      case 'error':
        score = 0
        break
    }
    
    totalScore += (score * weight)
    componentCount += weight
  }
  
  return componentCount > 0 ? Math.round(totalScore / componentCount) : 0
}

/**
 * Determine overall system status
 */
function determineOverallStatus(
  healthResults: Record<string, any>, 
  resilienceScore: number
): 'healthy' | 'degraded' | 'unhealthy' {
  // Critical components must be healthy
  const criticalComponents = ['database', 'n8n']
  const criticalUnhealthy = criticalComponents.some(
    component => healthResults[component]?.status === 'unhealthy' || 
                healthResults[component]?.status === 'error'
  )
  
  if (criticalUnhealthy || resilienceScore < 30) {
    return 'unhealthy'
  }
  
  if (resilienceScore < 70) {
    return 'degraded'
  }
  
  return 'healthy'
}

/**
 * Helper to extract result from Promise.allSettled
 */
function getSettledResult(settledResult: PromiseSettledResult<any>): any {
  if (settledResult.status === 'fulfilled') {
    return settledResult.value
  } else {
    return {
      status: 'error',
      error: settledResult.reason instanceof Error ? settledResult.reason.message : 'Unknown error'
    }
  }
}