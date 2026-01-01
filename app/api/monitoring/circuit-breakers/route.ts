/**
 * Circuit Breaker Monitoring API
 * Provides comprehensive observability for circuit breaker status and metrics
 * 
 * ENDPOINTS:
 * GET /api/monitoring/circuit-breakers - Overall health status
 * GET /api/monitoring/circuit-breakers/detailed - Detailed metrics
 * POST /api/monitoring/circuit-breakers/reset - Reset specific circuit breaker
 * POST /api/monitoring/circuit-breakers/reset-all - Reset all circuit breakers
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, PERMISSIONS } from '@/lib/auth'
import { logger } from '@/lib/logging'
import { circuitBreakerRegistry } from '@/lib/circuit-breaker'
import { externalServiceManager } from '@/lib/external-service-circuit-breakers'
import { createTransactionManager } from '@/lib/database-transaction'
import { pool } from '@/lib/db'

// GET - Circuit breaker health overview
export async function GET(request: NextRequest) {
  try {
    // Authentication for monitoring endpoints
    const authContext = await verifyAuth(request)
    
    if (!authContext.permissions.includes(PERMISSIONS.MONITORING_READ)) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions for monitoring access',
        code: 'MISSING_PERMISSIONS'
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const detailed = searchParams.get('detailed') === 'true'

    // Get overall circuit breaker health
    const allCircuitBreakers = circuitBreakerRegistry.getAllCircuitBreakers()
    const externalServicesStatus = externalServiceManager.getStatusReport()
    
    // Get database circuit breaker status
    const dbTransactionManager = createTransactionManager(pool)
    const dbHealthCheck = await dbTransactionManager.healthCheck()

    const circuitBreakerStatuses: Record<string, any> = {}
    let totalHealthy = 0
    let totalDegraded = 0
    let totalUnhealthy = 0

    // Collect status from all circuit breakers
    for (const [name, circuitBreaker] of allCircuitBreakers) {
      const health = circuitBreaker.healthCheck()
      circuitBreakerStatuses[name] = detailed ? {
        ...health,
        metrics: circuitBreaker.getMetrics(),
        state: circuitBreaker.getState()
      } : {
        healthy: health.healthy,
        state: health.state,
        issues: health.issues
      }

      if (health.healthy) {
        totalHealthy++
      } else if (health.issues?.length) {
        totalDegraded++
      } else {
        totalUnhealthy++
      }
    }

    // Add external services to the status
    for (const [serviceName, status] of Object.entries(externalServicesStatus.services)) {
      circuitBreakerStatuses[`external_${serviceName}`] = status
    }

    // Add database status
    circuitBreakerStatuses['database'] = {
      healthy: dbHealthCheck.status === 'healthy',
      status: dbHealthCheck.status,
      latency_ms: dbHealthCheck.latency_ms,
      circuit_breaker_status: dbHealthCheck.circuit_breaker_status
    }

    const overallHealthy = totalUnhealthy === 0 && 
                          externalServicesStatus.healthy && 
                          dbHealthCheck.status !== 'unhealthy'

    const response = {
      success: true,
      overall_status: overallHealthy ? 'healthy' : (totalUnhealthy > 0 ? 'unhealthy' : 'degraded'),
      timestamp: new Date().toISOString(),
      summary: {
        total_circuit_breakers: allCircuitBreakers.size + Object.keys(externalServicesStatus.services).length + 1,
        healthy: totalHealthy + externalServicesStatus.summary.healthy + (dbHealthCheck.status === 'healthy' ? 1 : 0),
        degraded: totalDegraded + externalServicesStatus.summary.degraded + (dbHealthCheck.status === 'degraded' ? 1 : 0),
        unhealthy: totalUnhealthy + externalServicesStatus.summary.unhealthy + (dbHealthCheck.status === 'unhealthy' ? 1 : 0)
      },
      circuit_breakers: circuitBreakerStatuses,
      external_services: {
        healthy: externalServicesStatus.healthy,
        summary: externalServicesStatus.summary
      },
      database: dbHealthCheck
    }

    // Log monitoring access
    logger.info('Circuit breaker monitoring accessed', {
      user: authContext,
      metadata: {
        overall_status: response.overall_status,
        detailed,
        total_circuit_breakers: response.summary.total_circuit_breakers
      }
    })

    return NextResponse.json(response)

  } catch (error) {
    logger.error('Circuit breaker monitoring error', error as Error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'MONITORING_ERROR'
    }, { status: 500 })
  }
}

// POST - Reset circuit breakers
export async function POST(request: NextRequest) {
  try {
    // Authentication for monitoring write operations
    const authContext = await verifyAuth(request)
    
    if (!authContext.permissions.includes(PERMISSIONS.MONITORING_WRITE)) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions for monitoring write operations',
        code: 'MISSING_PERMISSIONS'
      }, { status: 403 })
    }

    const body = await request.json()
    const { action, circuit_breaker_name } = body

    if (action === 'reset_all') {
      // Reset all circuit breakers (emergency function)
      circuitBreakerRegistry.resetAll()
      externalServiceManager.resetAllCircuitBreakers()
      
      logger.warn('All circuit breakers reset by user', {
        user: authContext,
        metadata: { action: 'reset_all' }
      })

      return NextResponse.json({
        success: true,
        message: 'All circuit breakers have been reset',
        timestamp: new Date().toISOString()
      })

    } else if (action === 'reset' && circuit_breaker_name) {
      // Reset specific circuit breaker
      const allCircuitBreakers = circuitBreakerRegistry.getAllCircuitBreakers()
      const circuitBreaker = allCircuitBreakers.get(circuit_breaker_name)
      
      if (circuitBreaker) {
        circuitBreaker.reset()
        
        logger.warn('Circuit breaker reset by user', {
          user: authContext,
          metadata: { 
            action: 'reset',
            circuit_breaker_name 
          }
        })

        return NextResponse.json({
          success: true,
          message: `Circuit breaker '${circuit_breaker_name}' has been reset`,
          timestamp: new Date().toISOString()
        })
      } else {
        return NextResponse.json({
          success: false,
          error: `Circuit breaker '${circuit_breaker_name}' not found`,
          code: 'CIRCUIT_BREAKER_NOT_FOUND'
        }, { status: 404 })
      }

    } else if (action === 'force_state' && circuit_breaker_name) {
      // Force circuit breaker state (emergency function)
      const { state } = body
      const allCircuitBreakers = circuitBreakerRegistry.getAllCircuitBreakers()
      const circuitBreaker = allCircuitBreakers.get(circuit_breaker_name)
      
      if (circuitBreaker && ['CLOSED', 'OPEN', 'HALF_OPEN'].includes(state)) {
        circuitBreaker.forceState(state)
        
        logger.warn('Circuit breaker state forced by user', {
          user: authContext,
          metadata: { 
            action: 'force_state',
            circuit_breaker_name,
            forced_state: state
          }
        })

        return NextResponse.json({
          success: true,
          message: `Circuit breaker '${circuit_breaker_name}' state forced to ${state}`,
          timestamp: new Date().toISOString()
        })
      } else {
        return NextResponse.json({
          success: false,
          error: 'Invalid circuit breaker name or state',
          code: 'INVALID_REQUEST'
        }, { status: 400 })
      }

    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Supported: reset, reset_all, force_state',
        code: 'INVALID_ACTION'
      }, { status: 400 })
    }

  } catch (error) {
    logger.error('Circuit breaker reset error', error as Error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'RESET_ERROR'
    }, { status: 500 })
  }
}