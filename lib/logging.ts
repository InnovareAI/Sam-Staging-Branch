/**
 * Enterprise-grade structured logging and monitoring system
 * Provides comprehensive observability for production debugging and metrics
 */

import { AuthContext } from './auth'

// Log levels
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

// Base log entry structure
interface BaseLogEntry {
  timestamp: string
  level: LogLevel
  message: string
  service: string
  version: string
  environment: string
}

// Request context for API logs
interface RequestContext {
  requestId: string
  method: string
  url: string
  userAgent?: string
  ip?: string
  duration?: number
  statusCode?: number
}

// User context for authenticated requests
interface UserContext {
  userId: string
  workspaceId: string
  userEmail: string
  userRole: string
  workspaceRole: string
}

// Campaign-specific context
interface CampaignContext {
  campaignId?: string
  campaignType?: string
  prospectCount?: number
  templateId?: string
  executionId?: string
}

// Error context for debugging
interface ErrorContext {
  errorCode?: string
  errorType?: string
  stackTrace?: string
  cause?: string
}

// Performance metrics
interface PerformanceMetrics {
  duration: number
  memoryUsage?: number
  cpuUsage?: number
  dbQueries?: number
  apiCalls?: number
}

// Complete log entry interface
interface LogEntry extends BaseLogEntry {
  request?: RequestContext
  user?: UserContext
  campaign?: CampaignContext
  error?: ErrorContext
  performance?: PerformanceMetrics
  metadata?: Record<string, any>
}

class Logger {
  private serviceName: string
  private version: string
  private environment: string

  constructor() {
    this.serviceName = 'sam-ai-platform'
    this.version = process.env.npm_package_version || '1.0.0'
    this.environment = process.env.NODE_ENV || 'development'
  }

  /**
   * Create base log entry with common fields
   */
  private createBaseEntry(level: LogLevel, message: string): BaseLogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      version: this.version,
      environment: this.environment
    }
  }

  /**
   * Output log entry (JSON in production, formatted in development)
   */
  private output(entry: LogEntry): void {
    if (this.environment === 'production') {
      // Structured JSON logging for production (for log aggregation)
      console.log(JSON.stringify(entry))
    } else {
      // Human-readable logging for development
      const timestamp = new Date(entry.timestamp).toLocaleTimeString()
      const level = entry.level.toUpperCase().padEnd(5)
      const context = entry.user ? `[${entry.user.userId}:${entry.user.workspaceId}]` : ''
      const request = entry.request ? `${entry.request.method} ${entry.request.url}` : ''
      const performance = entry.performance ? `(${entry.performance.duration}ms)` : ''
      
      console.log(`${timestamp} ${level} ${context} ${request} ${entry.message} ${performance}`)
      
      // Log error details separately for readability
      if (entry.error && entry.level === LogLevel.ERROR) {
        console.error('Error Details:', {
          code: entry.error.errorCode,
          type: entry.error.errorType,
          cause: entry.error.cause
        })
        if (entry.error.stackTrace && this.environment === 'development') {
          console.error(entry.error.stackTrace)
        }
      }
    }
  }

  /**
   * Log debug information
   */
  debug(message: string, context?: Partial<LogEntry>): void {
    if (this.environment === 'development' || process.env.LOG_LEVEL === 'debug') {
      const entry: LogEntry = {
        ...this.createBaseEntry(LogLevel.DEBUG, message),
        ...context
      }
      this.output(entry)
    }
  }

  /**
   * Log general information
   */
  info(message: string, context?: Partial<LogEntry>): void {
    const entry: LogEntry = {
      ...this.createBaseEntry(LogLevel.INFO, message),
      ...context
    }
    this.output(entry)
  }

  /**
   * Log warnings
   */
  warn(message: string, context?: Partial<LogEntry>): void {
    const entry: LogEntry = {
      ...this.createBaseEntry(LogLevel.WARN, message),
      ...context
    }
    this.output(entry)
  }

  /**
   * Log errors with full context
   */
  error(message: string, error?: Error, context?: Partial<LogEntry>): void {
    const entry: LogEntry = {
      ...this.createBaseEntry(LogLevel.ERROR, message),
      error: {
        errorCode: error?.name,
        errorType: error?.constructor.name,
        cause: error?.message,
        stackTrace: error?.stack
      },
      ...context
    }
    this.output(entry)
  }

  /**
   * Log fatal errors (application-breaking)
   */
  fatal(message: string, error?: Error, context?: Partial<LogEntry>): void {
    const entry: LogEntry = {
      ...this.createBaseEntry(LogLevel.FATAL, message),
      error: {
        errorCode: error?.name,
        errorType: error?.constructor.name,
        cause: error?.message,
        stackTrace: error?.stack
      },
      ...context
    }
    this.output(entry)
  }

  /**
   * Log API request start
   */
  requestStart(method: string, url: string, context?: { 
    user?: AuthContext
    requestId?: string
    userAgent?: string
    ip?: string
  }): string {
    const requestId = context?.requestId || generateRequestId()
    
    this.info('Request started', {
      request: {
        requestId,
        method,
        url,
        userAgent: context?.userAgent,
        ip: context?.ip
      },
      user: context?.user ? {
        userId: context.user.userId,
        workspaceId: context.user.workspaceId,
        userEmail: context.user.userEmail,
        userRole: context.user.userRole,
        workspaceRole: context.user.workspaceRole
      } : undefined
    })
    
    return requestId
  }

  /**
   * Log API request completion
   */
  requestEnd(requestId: string, statusCode: number, duration: number, context?: {
    user?: AuthContext
    campaign?: CampaignContext
    performance?: Partial<PerformanceMetrics>
  }): void {
    this.info('Request completed', {
      request: {
        requestId,
        method: '',
        url: '',
        statusCode,
        duration
      },
      user: context?.user ? {
        userId: context.user.userId,
        workspaceId: context.user.workspaceId,
        userEmail: context.user.userEmail,
        userRole: context.user.userRole,
        workspaceRole: context.user.workspaceRole
      } : undefined,
      campaign: context?.campaign,
      performance: {
        duration,
        ...context?.performance
      }
    })
  }

  /**
   * Log campaign events
   */
  campaignEvent(event: string, context: {
    campaignId: string
    campaignType?: string
    prospectCount?: number
    user?: AuthContext
    metadata?: Record<string, any>
  }): void {
    this.info(`Campaign ${event}`, {
      campaign: {
        campaignId: context.campaignId,
        campaignType: context.campaignType,
        prospectCount: context.prospectCount
      },
      user: context.user ? {
        userId: context.user.userId,
        workspaceId: context.user.workspaceId,
        userEmail: context.user.userEmail,
        userRole: context.user.userRole,
        workspaceRole: context.user.workspaceRole
      } : undefined,
      metadata: context.metadata
    })
  }

  /**
   * Log database operations
   */
  databaseOperation(operation: string, table: string, context?: {
    duration?: number
    recordCount?: number
    user?: AuthContext
    error?: Error
  }): void {
    const level = context?.error ? LogLevel.ERROR : LogLevel.DEBUG
    
    this[level](`Database ${operation} on ${table}`, {
      metadata: {
        operation,
        table,
        recordCount: context?.recordCount
      },
      performance: context?.duration ? {
        duration: context.duration
      } : undefined,
      user: context?.user ? {
        userId: context.user.userId,
        workspaceId: context.user.workspaceId,
        userEmail: context.user.userEmail,
        userRole: context.user.userRole,
        workspaceRole: context.user.workspaceRole
      } : undefined,
      error: context?.error ? {
        errorCode: context.error.name,
        errorType: context.error.constructor.name,
        cause: context.error.message,
        stackTrace: context.error.stack
      } : undefined
    })
  }
}

/**
 * Generate unique request ID for tracing
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private startTime: number
  private markers: Map<string, number> = new Map()

  constructor() {
    this.startTime = performance.now()
  }

  mark(name: string): void {
    this.markers.set(name, performance.now())
  }

  measure(name: string): number {
    const endTime = performance.now()
    const startTime = this.markers.get(name) || this.startTime
    return Math.round(endTime - startTime)
  }

  getTotalDuration(): number {
    return Math.round(performance.now() - this.startTime)
  }

  getMetrics(): PerformanceMetrics {
    return {
      duration: this.getTotalDuration(),
      memoryUsage: process.memoryUsage().heapUsed,
      cpuUsage: process.cpuUsage().user
    }
  }
}

/**
 * Metrics tracking for business intelligence
 */
export class MetricsTracker {
  /**
   * Track campaign metrics
   */
  static trackCampaignMetric(metric: string, value: number, tags: {
    workspace_id: string
    campaign_type?: string
    channel?: string
  }): void {
    logger.info('Metric tracked', {
      metadata: {
        metric_name: metric,
        metric_value: value,
        metric_type: 'campaign',
        tags
      }
    })
  }

  /**
   * Track API performance metrics
   */
  static trackApiMetric(endpoint: string, duration: number, statusCode: number, tags?: Record<string, string>): void {
    logger.info('API metric tracked', {
      metadata: {
        metric_name: 'api_request_duration',
        metric_value: duration,
        metric_type: 'performance',
        endpoint,
        status_code: statusCode,
        tags
      }
    })
  }

  /**
   * Track user engagement metrics
   */
  static trackUserMetric(metric: string, userId: string, workspaceId: string, value?: number): void {
    logger.info('User metric tracked', {
      metadata: {
        metric_name: metric,
        metric_value: value || 1,
        metric_type: 'engagement',
        user_id: userId,
        workspace_id: workspaceId
      }
    })
  }
}

// Export singleton logger instance
export const logger = new Logger()

// Export types for external use
export type { LogEntry, RequestContext, UserContext, CampaignContext, ErrorContext, PerformanceMetrics }