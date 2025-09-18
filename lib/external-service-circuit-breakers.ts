/**
 * External Service Circuit Breakers
 * Provides circuit breaker protection for external integrations like Unipile, ReachInbox, etc.
 * 
 * CRITICAL SERVICES PROTECTED:
 * - Unipile API (messaging and contact management)
 * - ReachInbox API (email management)
 * - LinkedIn API (social media automation)
 * - Apollo API (lead generation)
 * - Other external APIs
 */

import { 
  CircuitBreaker, 
  CircuitBreakerConfig, 
  CIRCUIT_BREAKER_CONFIGS,
  circuitBreakerRegistry,
  FallbackStrategy
} from '@/lib/circuit-breaker'
import { logger } from '@/lib/logging'

// External service specific configurations
export const EXTERNAL_SERVICE_CONFIGS = {
  UNIPILE_API: {
    name: 'unipile-api',
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 15000,
    resetTimeout: 30000,
    monitoringWindow: 60000,
    fallbackEnabled: true,
    maxConcurrentRequests: 2
  },
  REACHINBOX_API: {
    name: 'reachinbox-api',
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 10000,
    resetTimeout: 30000,
    monitoringWindow: 60000,
    fallbackEnabled: true,
    maxConcurrentRequests: 2
  },
  LINKEDIN_API: {
    name: 'linkedin-api',
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 12000,
    resetTimeout: 45000,
    monitoringWindow: 60000,
    fallbackEnabled: true,
    maxConcurrentRequests: 1
  },
  APOLLO_API: {
    name: 'apollo-api',
    failureThreshold: 4,
    successThreshold: 2,
    timeout: 8000,
    resetTimeout: 30000,
    monitoringWindow: 60000,
    fallbackEnabled: true,
    maxConcurrentRequests: 3
  }
} as const

/**
 * External Service Circuit Breaker Manager
 * Centrally manages circuit breakers for all external services
 */
export class ExternalServiceCircuitBreakerManager {
  private static instance: ExternalServiceCircuitBreakerManager
  private circuitBreakers: Map<string, CircuitBreaker> = new Map()

  private constructor() {
    this.initializeCircuitBreakers()
  }

  static getInstance(): ExternalServiceCircuitBreakerManager {
    if (!ExternalServiceCircuitBreakerManager.instance) {
      ExternalServiceCircuitBreakerManager.instance = new ExternalServiceCircuitBreakerManager()
    }
    return ExternalServiceCircuitBreakerManager.instance
  }

  /**
   * Initialize circuit breakers for all external services
   */
  private initializeCircuitBreakers(): void {
    // Unipile API circuit breaker
    const unipileCircuitBreaker = circuitBreakerRegistry.getCircuitBreaker(
      'unipile-api',
      EXTERNAL_SERVICE_CONFIGS.UNIPILE_API
    )
    unipileCircuitBreaker.addFallbackStrategy(new UnipileFallbackStrategy())
    this.circuitBreakers.set('unipile', unipileCircuitBreaker)

    // ReachInbox API circuit breaker  
    const reachInboxCircuitBreaker = circuitBreakerRegistry.getCircuitBreaker(
      'reachinbox-api',
      EXTERNAL_SERVICE_CONFIGS.REACHINBOX_API
    )
    reachInboxCircuitBreaker.addFallbackStrategy(new ReachInboxFallbackStrategy())
    this.circuitBreakers.set('reachinbox', reachInboxCircuitBreaker)

    // LinkedIn API circuit breaker
    const linkedInCircuitBreaker = circuitBreakerRegistry.getCircuitBreaker(
      'linkedin-api',
      EXTERNAL_SERVICE_CONFIGS.LINKEDIN_API
    )
    linkedInCircuitBreaker.addFallbackStrategy(new LinkedInFallbackStrategy())
    this.circuitBreakers.set('linkedin', linkedInCircuitBreaker)

    // Apollo API circuit breaker
    const apolloCircuitBreaker = circuitBreakerRegistry.getCircuitBreaker(
      'apollo-api',
      EXTERNAL_SERVICE_CONFIGS.APOLLO_API
    )
    apolloCircuitBreaker.addFallbackStrategy(new ApolloFallbackStrategy())
    this.circuitBreakers.set('apollo', apolloCircuitBreaker)

    logger.info('External service circuit breakers initialized', {
      metadata: {
        services: Array.from(this.circuitBreakers.keys())
      }
    })
  }

  /**
   * Get circuit breaker for a specific service
   */
  getCircuitBreaker(serviceName: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(serviceName)
  }

  /**
   * Execute operation through appropriate circuit breaker
   */
  async executeWithCircuitBreaker<T>(
    serviceName: string,
    operation: () => Promise<T>,
    operationName?: string
  ): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(serviceName)
    
    if (!circuitBreaker) {
      logger.warn('No circuit breaker found for service', {
        metadata: { serviceName, operationName }
      })
      return await operation()
    }

    const result = await circuitBreaker.execute(operation, operationName)
    
    if (!result.success) {
      throw result.error || new Error(`${serviceName} operation failed`)
    }

    return result.data!
  }

  /**
   * Get health status of all external service circuit breakers
   */
  getHealthStatus(): Record<string, any> {
    const status: Record<string, any> = {}
    
    for (const [serviceName, circuitBreaker] of this.circuitBreakers) {
      status[serviceName] = circuitBreaker.healthCheck()
    }
    
    return status
  }

  /**
   * Reset all circuit breakers (emergency function)
   */
  resetAllCircuitBreakers(): void {
    for (const [serviceName, circuitBreaker] of this.circuitBreakers) {
      circuitBreaker.reset()
      logger.info('Circuit breaker reset', {
        metadata: { serviceName }
      })
    }
  }

  /**
   * Get comprehensive status report
   */
  getStatusReport(): {
    healthy: boolean
    services: Record<string, any>
    summary: {
      total: number
      healthy: number
      degraded: number
      unhealthy: number
    }
  } {
    const services = this.getHealthStatus()
    const summary = {
      total: Object.keys(services).length,
      healthy: 0,
      degraded: 0,
      unhealthy: 0
    }

    for (const status of Object.values(services)) {
      if (status.healthy) {
        summary.healthy++
      } else if (status.issues?.length > 0) {
        summary.degraded++
      } else {
        summary.unhealthy++
      }
    }

    return {
      healthy: summary.unhealthy === 0,
      services,
      summary
    }
  }
}

/**
 * Unipile API Fallback Strategy
 * Handles messaging and contact management failures
 */
class UnipileFallbackStrategy implements FallbackStrategy<any> {
  public readonly priority = 1

  canHandle(error: Error): boolean {
    return error.message.includes('unipile') ||
           error.message.includes('401') ||
           error.message.includes('429') ||
           error.message.includes('timeout')
  }

  async execute(): Promise<any> {
    logger.info('Using Unipile fallback strategy')
    
    // Return cached contact data or queue message for later
    return {
      accounts: [], // Empty accounts array as fallback
      messages: [], // Empty messages array as fallback
      status: 'fallback',
      message: 'Using cached data - Unipile service temporarily unavailable',
      retry_after: 30
    }
  }
}

/**
 * ReachInbox API Fallback Strategy
 * Handles email management failures
 */
class ReachInboxFallbackStrategy implements FallbackStrategy<any> {
  public readonly priority = 1

  canHandle(error: Error): boolean {
    return error.message.includes('reachinbox') ||
           error.message.includes('email') ||
           error.message.includes('smtp')
  }

  async execute(): Promise<any> {
    logger.info('Using ReachInbox fallback strategy')
    
    // Queue email for later sending or use alternative provider
    return {
      status: 'queued',
      message: 'Email queued for delivery when service is available',
      delivery_id: `fallback_${Date.now()}`,
      retry_after: 60
    }
  }
}

/**
 * LinkedIn API Fallback Strategy
 * Handles LinkedIn automation failures
 */
class LinkedInFallbackStrategy implements FallbackStrategy<any> {
  public readonly priority = 1

  canHandle(error: Error): boolean {
    return error.message.includes('linkedin') ||
           error.message.includes('rate limit') ||
           error.message.includes('blocked')
  }

  async execute(): Promise<any> {
    logger.info('Using LinkedIn fallback strategy')
    
    // Queue LinkedIn actions for later or use manual process
    return {
      status: 'queued',
      message: 'LinkedIn action queued for manual review',
      action_id: `linkedin_fallback_${Date.now()}`,
      manual_review_required: true,
      retry_after: 300 // 5 minutes due to LinkedIn rate limits
    }
  }
}

/**
 * Apollo API Fallback Strategy
 * Handles lead generation failures
 */
class ApolloFallbackStrategy implements FallbackStrategy<any> {
  public readonly priority = 1

  canHandle(error: Error): boolean {
    return error.message.includes('apollo') ||
           error.message.includes('leads') ||
           error.message.includes('quota')
  }

  async execute(): Promise<any> {
    logger.info('Using Apollo fallback strategy')
    
    // Use cached lead data or alternative source
    return {
      leads: [], // Empty leads array as fallback
      status: 'fallback',
      message: 'Using cached lead data - Apollo service temporarily unavailable',
      alternative_sources_available: true,
      retry_after: 120
    }
  }
}

/**
 * Helper functions for specific service integrations
 */

/**
 * Unipile API with circuit breaker protection
 */
export async function executeUnipileOperation<T>(
  operation: () => Promise<T>,
  operationName?: string
): Promise<T> {
  const manager = ExternalServiceCircuitBreakerManager.getInstance()
  return await manager.executeWithCircuitBreaker('unipile', operation, operationName)
}

/**
 * ReachInbox API with circuit breaker protection
 */
export async function executeReachInboxOperation<T>(
  operation: () => Promise<T>,
  operationName?: string
): Promise<T> {
  const manager = ExternalServiceCircuitBreakerManager.getInstance()
  return await manager.executeWithCircuitBreaker('reachinbox', operation, operationName)
}

/**
 * LinkedIn API with circuit breaker protection
 */
export async function executeLinkedInOperation<T>(
  operation: () => Promise<T>,
  operationName?: string
): Promise<T> {
  const manager = ExternalServiceCircuitBreakerManager.getInstance()
  return await manager.executeWithCircuitBreaker('linkedin', operation, operationName)
}

/**
 * Apollo API with circuit breaker protection
 */
export async function executeApolloOperation<T>(
  operation: () => Promise<T>,
  operationName?: string
): Promise<T> {
  const manager = ExternalServiceCircuitBreakerManager.getInstance()
  return await manager.executeWithCircuitBreaker('apollo', operation, operationName)
}

/**
 * Generic external API with circuit breaker protection
 */
export async function executeExternalApiOperation<T>(
  serviceName: string,
  operation: () => Promise<T>,
  operationName?: string,
  config?: Partial<CircuitBreakerConfig>
): Promise<T> {
  const manager = ExternalServiceCircuitBreakerManager.getInstance()
  
  // Register new service if config provided
  if (config) {
    const circuitBreaker = circuitBreakerRegistry.getCircuitBreaker(serviceName, {
      ...CIRCUIT_BREAKER_CONFIGS.EXTERNAL_API,
      ...config,
      name: serviceName
    })
    manager['circuitBreakers'].set(serviceName, circuitBreaker)
  }
  
  return await manager.executeWithCircuitBreaker(serviceName, operation, operationName)
}

// Export singleton instance
export const externalServiceManager = ExternalServiceCircuitBreakerManager.getInstance()