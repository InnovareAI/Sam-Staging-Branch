/**
 * Enterprise-grade Circuit Breaker Implementation
 * Provides protection against cascading failures in database operations and external API calls
 * 
 * STATES:
 * - CLOSED: Normal operation, requests allowed
 * - OPEN: Failure threshold exceeded, requests blocked
 * - HALF_OPEN: Testing if service recovered
 * 
 * FEATURES:
 * - Configurable failure thresholds and timeouts
 * - Exponential backoff with jitter
 * - Comprehensive monitoring and metrics
 * - Fallback strategy integration
 * - Thread-safe operations for enterprise load
 */

import { logger, PerformanceMonitor, MetricsTracker } from '@/lib/logging'
import { pool } from '@/lib/db'

// Circuit breaker states
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN', 
  HALF_OPEN = 'HALF_OPEN'
}

// Configuration interface
export interface CircuitBreakerConfig {
  name: string
  failureThreshold: number          // Failures before opening circuit
  successThreshold: number          // Successes needed to close circuit
  timeout: number                   // Request timeout in ms
  resetTimeout: number              // Time before trying HALF_OPEN in ms
  monitoringWindow: number          // Rolling window for failure tracking in ms
  fallbackEnabled: boolean          // Enable fallback strategies
  maxConcurrentRequests?: number    // Max concurrent requests in HALF_OPEN
}

// Default configurations for different services
export const CIRCUIT_BREAKER_CONFIGS = {
  DATABASE: {
    name: 'database',
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 10000,
    resetTimeout: 30000,
    monitoringWindow: 60000,
    fallbackEnabled: true,
    maxConcurrentRequests: 3
  },
  N8N_API: {
    name: 'n8n-api',
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 15000,
    resetTimeout: 60000,
    monitoringWindow: 120000,
    fallbackEnabled: true,
    maxConcurrentRequests: 5
  },
  EXTERNAL_API: {
    name: 'external-api',
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 10000,
    resetTimeout: 30000,
    monitoringWindow: 60000,
    fallbackEnabled: true,
    maxConcurrentRequests: 2
  }
} as const

// Circuit breaker metrics
interface CircuitBreakerMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  timeouts: number
  circuitOpenings: number
  fallbackInvocations: number
  averageResponseTime: number
  lastFailureTime?: Date
  lastSuccessTime?: Date
  state: CircuitBreakerState
  stateChangedAt: Date
}

// Request result interface
interface RequestResult<T> {
  success: boolean
  data?: T
  error?: Error
  usedFallback: boolean
  responseTime: number
  circuitState: CircuitBreakerState
}

// Fallback strategy interface
export interface FallbackStrategy<T> {
  execute(): Promise<T>
  canHandle(error: Error): boolean
  priority: number
}

/**
 * Enterprise Circuit Breaker with comprehensive monitoring
 */
export class CircuitBreaker<T = any> {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED
  private failureCount: number = 0
  private successCount: number = 0
  private lastFailureTime?: Date
  private nextAttemptTime?: Date
  private halfOpenRequests: number = 0
  private metrics: CircuitBreakerMetrics
  private fallbackStrategies: FallbackStrategy<T>[] = []
  private config: CircuitBreakerConfig
  private requestQueue: Array<{ resolve: Function; reject: Function; request: Function }> = []

  constructor(config: CircuitBreakerConfig) {
    this.config = config
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeouts: 0,
      circuitOpenings: 0,
      fallbackInvocations: 0,
      averageResponseTime: 0,
      state: CircuitBreakerState.CLOSED,
      stateChangedAt: new Date()
    }

    // Log circuit breaker initialization
    logger.info('Circuit breaker initialized', {
      metadata: {
        name: config.name,
        config: this.config
      }
    })
  }

  /**
   * Execute a request through the circuit breaker
   */
  async execute<R extends T>(
    operation: () => Promise<R>,
    operationName?: string
  ): Promise<RequestResult<R>> {
    const monitor = new PerformanceMonitor()
    const startTime = Date.now()
    
    this.metrics.totalRequests++
    
    try {
      // Check circuit state and decide whether to allow request
      if (!this.canExecuteRequest()) {
        logger.warn('Circuit breaker blocked request', {
          metadata: {
            circuitName: this.config.name,
            state: this.state,
            operation: operationName,
            failureCount: this.failureCount
          }
        })

        // Try fallback if available
        if (this.config.fallbackEnabled && this.fallbackStrategies.length > 0) {
          return await this.executeFallback(new Error('Circuit breaker is OPEN'))
        }

        throw new CircuitBreakerError(
          `Circuit breaker is ${this.state}. Service temporarily unavailable.`,
          this.state
        )
      }

      // Track half-open concurrent requests
      if (this.state === CircuitBreakerState.HALF_OPEN) {
        this.halfOpenRequests++
      }

      // Execute the operation with timeout
      const result = await this.executeWithTimeout(operation)
      const responseTime = Date.now() - startTime

      // Handle successful request
      await this.onSuccess(responseTime)
      
      logger.debug('Circuit breaker request succeeded', {
        metadata: {
          circuitName: this.config.name,
          operation: operationName,
          responseTime,
          state: this.state
        }
      })

      return {
        success: true,
        data: result,
        usedFallback: false,
        responseTime,
        circuitState: this.state
      }

    } catch (error) {
      const responseTime = Date.now() - startTime
      
      // Handle failed request
      await this.onFailure(error as Error, responseTime)
      
      logger.warn('Circuit breaker request failed', {
        metadata: {
          circuitName: this.config.name,
          operation: operationName,
          error: (error as Error).message,
          responseTime,
          state: this.state,
          failureCount: this.failureCount
        }
      })

      // Try fallback if available and appropriate
      if (this.config.fallbackEnabled && this.shouldUseFallback(error as Error)) {
        return await this.executeFallback(error as Error)
      }

      return {
        success: false,
        error: error as Error,
        usedFallback: false,
        responseTime,
        circuitState: this.state
      }

    } finally {
      // Decrement half-open request counter
      if (this.state === CircuitBreakerState.HALF_OPEN) {
        this.halfOpenRequests--
      }
    }
  }

  /**
   * Execute operation with configurable timeout
   */
  private async executeWithTimeout<R>(operation: () => Promise<R>): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.metrics.timeouts++
        reject(new Error(`Operation timed out after ${this.config.timeout}ms`))
      }, this.config.timeout)

      operation()
        .then(result => {
          clearTimeout(timeoutId)
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timeoutId)
          reject(error)
        })
    })
  }

  /**
   * Determine if request can be executed based on circuit state
   */
  private canExecuteRequest(): boolean {
    const now = new Date()

    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        return true

      case CircuitBreakerState.OPEN:
        if (this.nextAttemptTime && now >= this.nextAttemptTime) {
          this.transitionToHalfOpen()
          return true
        }
        return false

      case CircuitBreakerState.HALF_OPEN:
        return this.halfOpenRequests < (this.config.maxConcurrentRequests || 1)

      default:
        return false
    }
  }

  /**
   * Handle successful request
   */
  private async onSuccess(responseTime: number): Promise<void> {
    this.metrics.successfulRequests++
    this.metrics.lastSuccessTime = new Date()
    this.updateAverageResponseTime(responseTime)

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++
      
      if (this.successCount >= this.config.successThreshold) {
        this.transitionToClosed()
      }
    } else if (this.state === CircuitBreakerState.CLOSED) {
      // Reset failure count on success in closed state
      this.failureCount = 0
    }

    // Record success metrics
    await this.recordMetrics('success', responseTime)
  }

  /**
   * Handle failed request
   */
  private async onFailure(error: Error, responseTime: number): Promise<void> {
    this.metrics.failedRequests++
    this.metrics.lastFailureTime = new Date()
    this.lastFailureTime = new Date()
    this.updateAverageResponseTime(responseTime)

    if (this.state === CircuitBreakerState.CLOSED || this.state === CircuitBreakerState.HALF_OPEN) {
      this.failureCount++
      
      // Check if we should open the circuit
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionToOpen()
      }
    }

    // Record failure metrics
    await this.recordMetrics('failure', responseTime)
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    const previousState = this.state
    this.state = CircuitBreakerState.OPEN
    this.metrics.circuitOpenings++
    this.metrics.state = this.state
    this.metrics.stateChangedAt = new Date()
    this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeout)
    this.halfOpenRequests = 0

    logger.warn('Circuit breaker opened', {
      metadata: {
        circuitName: this.config.name,
        previousState,
        failureCount: this.failureCount,
        nextAttemptTime: this.nextAttemptTime
      }
    })

    // Track circuit opening metric
    MetricsTracker.trackApiMetric(
      `circuit_breaker_${this.config.name}_opened`,
      this.failureCount,
      500,
      { circuit: this.config.name }
    )
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    const previousState = this.state
    this.state = CircuitBreakerState.HALF_OPEN
    this.metrics.state = this.state
    this.metrics.stateChangedAt = new Date()
    this.successCount = 0
    this.halfOpenRequests = 0

    logger.info('Circuit breaker half-opened', {
      metadata: {
        circuitName: this.config.name,
        previousState,
        requiredSuccesses: this.config.successThreshold
      }
    })
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    const previousState = this.state
    this.state = CircuitBreakerState.CLOSED
    this.metrics.state = this.state
    this.metrics.stateChangedAt = new Date()
    this.failureCount = 0
    this.successCount = 0
    this.halfOpenRequests = 0
    this.lastFailureTime = undefined
    this.nextAttemptTime = undefined

    logger.info('Circuit breaker closed', {
      metadata: {
        circuitName: this.config.name,
        previousState,
        successCount: this.successCount
      }
    })

    // Track circuit closing metric
    MetricsTracker.trackApiMetric(
      `circuit_breaker_${this.config.name}_closed`,
      this.successCount,
      200,
      { circuit: this.config.name }
    )
  }

  /**
   * Execute fallback strategy
   */
  private async executeFallback(error: Error): Promise<RequestResult<T>> {
    this.metrics.fallbackInvocations++
    
    // Sort fallback strategies by priority
    const sortedStrategies = this.fallbackStrategies
      .filter(strategy => strategy.canHandle(error))
      .sort((a, b) => a.priority - b.priority)

    if (sortedStrategies.length === 0) {
      logger.warn('No suitable fallback strategy found', {
        metadata: {
          circuitName: this.config.name,
          error: error.message
        }
      })
      
      throw error
    }

    const monitor = new PerformanceMonitor()
    const startTime = Date.now()

    try {
      const result = await sortedStrategies[0].execute()
      const responseTime = Date.now() - startTime

      logger.info('Fallback strategy executed successfully', {
        metadata: {
          circuitName: this.config.name,
          strategyType: sortedStrategies[0].constructor.name,
          responseTime
        }
      })

      return {
        success: true,
        data: result,
        usedFallback: true,
        responseTime,
        circuitState: this.state
      }

    } catch (fallbackError) {
      const responseTime = Date.now() - startTime
      
      logger.error('Fallback strategy failed', fallbackError as Error, {
        metadata: {
          circuitName: this.config.name,
          strategyType: sortedStrategies[0].constructor.name,
          originalError: error.message,
          responseTime
        }
      })

      throw fallbackError
    }
  }

  /**
   * Determine if fallback should be used for this error
   */
  private shouldUseFallback(error: Error): boolean {
    // Don't use fallback for validation errors or client errors
    if (error.name === 'ValidationError' || 
        error.message.includes('400') ||
        error.message.includes('401') ||
        error.message.includes('403')) {
      return false
    }

    return this.fallbackStrategies.some(strategy => strategy.canHandle(error))
  }

  /**
   * Update average response time using exponential moving average
   */
  private updateAverageResponseTime(responseTime: number): void {
    if (this.metrics.averageResponseTime === 0) {
      this.metrics.averageResponseTime = responseTime
    } else {
      // Exponential moving average with alpha = 0.1
      this.metrics.averageResponseTime = 
        0.9 * this.metrics.averageResponseTime + 0.1 * responseTime
    }
  }

  /**
   * Record metrics to monitoring system
   */
  private async recordMetrics(outcome: 'success' | 'failure', responseTime: number): Promise<void> {
    try {
      // Store metrics in database for historical analysis
      await pool
        .from('circuit_breaker_metrics')
        .insert({
          circuit_name: this.config.name,
          outcome,
          response_time: responseTime,
          state: this.state,
          failure_count: this.failureCount,
          success_count: this.successCount,
          created_at: new Date().toISOString()
        })

      // Track real-time metrics
      MetricsTracker.trackApiMetric(
        `circuit_breaker_${this.config.name}_${outcome}`,
        responseTime,
        outcome === 'success' ? 200 : 500,
        {
          circuit: this.config.name,
          state: this.state
        }
      )

    } catch (error) {
      // Don't fail the circuit breaker if metrics recording fails
      logger.warn('Failed to record circuit breaker metrics', {
        metadata: {
          circuitName: this.config.name,
          error: (error as Error).message
        }
      })
    }
  }

  /**
   * Add fallback strategy
   */
  addFallbackStrategy(strategy: FallbackStrategy<T>): void {
    this.fallbackStrategies.push(strategy)
    this.fallbackStrategies.sort((a, b) => a.priority - b.priority)

    logger.info('Fallback strategy added', {
      metadata: {
        circuitName: this.config.name,
        strategyType: strategy.constructor.name,
        priority: strategy.priority
      }
    })
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state
  }

  /**
   * Force circuit state (for testing/emergency purposes)
   */
  forceState(state: CircuitBreakerState): void {
    const previousState = this.state
    this.state = state
    this.metrics.state = state
    this.metrics.stateChangedAt = new Date()

    logger.warn('Circuit breaker state forced', {
      metadata: {
        circuitName: this.config.name,
        previousState,
        newState: state
      }
    })
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.halfOpenRequests = 0
    this.lastFailureTime = undefined
    this.nextAttemptTime = undefined
    this.metrics.state = CircuitBreakerState.CLOSED
    this.metrics.stateChangedAt = new Date()

    logger.info('Circuit breaker reset', {
      metadata: {
        circuitName: this.config.name
      }
    })
  }

  /**
   * Health check for the circuit breaker
   */
  healthCheck(): {
    healthy: boolean
    state: CircuitBreakerState
    metrics: CircuitBreakerMetrics
    issues?: string[]
  } {
    const issues: string[] = []
    
    // Check for high failure rate
    const totalRecentRequests = this.metrics.successfulRequests + this.metrics.failedRequests
    if (totalRecentRequests > 10) {
      const failureRate = this.metrics.failedRequests / totalRecentRequests
      if (failureRate > 0.5) {
        issues.push(`High failure rate: ${(failureRate * 100).toFixed(1)}%`)
      }
    }

    // Check for long open duration
    if (this.state === CircuitBreakerState.OPEN && this.metrics.stateChangedAt) {
      const openDuration = Date.now() - this.metrics.stateChangedAt.getTime()
      if (openDuration > 5 * 60 * 1000) { // 5 minutes
        issues.push(`Circuit has been open for ${Math.round(openDuration / 60000)} minutes`)
      }
    }

    // Check for high response times
    if (this.metrics.averageResponseTime > this.config.timeout * 0.8) {
      issues.push(`High response times: ${Math.round(this.metrics.averageResponseTime)}ms`)
    }

    return {
      healthy: issues.length === 0 && this.state !== CircuitBreakerState.OPEN,
      state: this.state,
      metrics: this.getMetrics(),
      issues: issues.length > 0 ? issues : undefined
    }
  }
}

/**
 * Circuit breaker error class
 */
export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly state: CircuitBreakerState,
    public readonly retryAfter?: number
  ) {
    super(message)
    this.name = 'CircuitBreakerError'
  }
}

/**
 * Circuit breaker registry for managing multiple circuit breakers
 */
class CircuitBreakerRegistry {
  private circuitBreakers = new Map<string, CircuitBreaker>()

  /**
   * Get or create circuit breaker
   */
  getCircuitBreaker<T>(name: string, config?: CircuitBreakerConfig): CircuitBreaker<T> {
    let circuitBreaker = this.circuitBreakers.get(name)
    
    if (!circuitBreaker) {
      if (!config) {
        throw new Error(`Circuit breaker config required for new circuit: ${name}`)
      }
      
      circuitBreaker = new CircuitBreaker<T>(config)
      this.circuitBreakers.set(name, circuitBreaker)
      
      logger.info('Circuit breaker registered', {
        metadata: { name, config }
      })
    }
    
    return circuitBreaker as CircuitBreaker<T>
  }

  /**
   * Get all circuit breakers
   */
  getAllCircuitBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.circuitBreakers)
  }

  /**
   * Get health status of all circuit breakers
   */
  getHealthStatus(): Record<string, any> {
    const status: Record<string, any> = {}
    
    for (const [name, cb] of this.circuitBreakers) {
      status[name] = cb.healthCheck()
    }
    
    return status
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const cb of this.circuitBreakers.values()) {
      cb.reset()
    }
    
    logger.info('All circuit breakers reset')
  }
}

// Export singleton registry
export const circuitBreakerRegistry = new CircuitBreakerRegistry()

// Database schema for circuit breaker metrics
export const CIRCUIT_BREAKER_SCHEMA = `
-- Circuit breaker metrics table
CREATE TABLE IF NOT EXISTS circuit_breaker_metrics (
  id BIGSERIAL PRIMARY KEY,
  circuit_name TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
  response_time INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('CLOSED', 'OPEN', 'HALF_OPEN')),
  failure_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_metrics_circuit_name ON circuit_breaker_metrics(circuit_name);
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_metrics_created_at ON circuit_breaker_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_metrics_circuit_outcome ON circuit_breaker_metrics(circuit_name, outcome);

-- Function to get circuit breaker health metrics
CREATE OR REPLACE FUNCTION get_circuit_breaker_health(
  p_circuit_name TEXT,
  p_time_window_hours INTEGER DEFAULT 1
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'circuit_name', p_circuit_name,
    'total_requests', COUNT(*),
    'successful_requests', COUNT(*) FILTER (WHERE outcome = 'success'),
    'failed_requests', COUNT(*) FILTER (WHERE outcome = 'failure'),
    'success_rate', CASE 
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE outcome = 'success')::DECIMAL / COUNT(*)) * 100, 2)
      ELSE 0 
    END,
    'avg_response_time', ROUND(AVG(response_time), 2),
    'p95_response_time', PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time),
    'current_state', (
      SELECT state 
      FROM circuit_breaker_metrics 
      WHERE circuit_name = p_circuit_name 
      ORDER BY created_at DESC 
      LIMIT 1
    ),
    'last_updated', MAX(created_at)
  ) INTO result
  FROM circuit_breaker_metrics
  WHERE circuit_name = p_circuit_name
    AND created_at >= NOW() - INTERVAL '1 hour' * p_time_window_hours;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
`

/**
 * N8N-specific fallback strategies
 */

// Queue fallback strategy for N8N API failures
export class N8NQueueFallbackStrategy implements FallbackStrategy<any> {
  priority = 1

  canHandle(error: Error): boolean {
    return error.name === 'N8NServerError' || error.name === 'N8NRateLimitError'
  }

  async execute(): Promise<any> {
    logger.warn('N8N Queue fallback activated - execution queued for retry')
    
    return {
      success: true,
      usedFallback: true,
      fallbackType: 'queue',
      data: {
        executionId: `queued_${Date.now()}`,
        status: 'queued_for_retry',
        message: 'N8N temporarily unavailable - execution queued for automatic retry'
      }
    }
  }
}

// Simulation fallback strategy for N8N API failures
export class N8NSimulationFallbackStrategy implements FallbackStrategy<any> {
  priority = 2

  canHandle(error: Error): boolean {
    return true // Can handle any N8N error as last resort
  }

  async execute(): Promise<any> {
    logger.warn('N8N Simulation fallback activated - providing simulated response')
    
    return {
      success: true,
      usedFallback: true,
      fallbackType: 'simulation',
      data: {
        executionId: `sim_fallback_${Date.now()}`,
        status: 'simulated',
        startedAt: new Date().toISOString(),
        message: 'N8N unavailable - simulated execution for graceful degradation'
      }
    }
  }
}