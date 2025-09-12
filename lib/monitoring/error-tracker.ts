/**
 * ERROR TRACKING AND PERFORMANCE MONITORING
 * Comprehensive error tracking and performance measurement system
 */

export interface ErrorEvent {
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info';
  message: string;
  stack?: string;
  context: {
    userId?: string;
    sessionId?: string;
    endpoint?: string;
    userAgent?: string;
    ip?: string;
    referer?: string;
  };
  metadata?: Record<string, any>;
  resolved: boolean;
  resolvedAt?: string;
  count: number;
  fingerprint: string;
}

export interface PerformanceEvent {
  id: string;
  timestamp: string;
  type: 'page-load' | 'api-call' | 'database-query' | 'external-request';
  name: string;
  duration: number;
  success: boolean;
  context: {
    userId?: string;
    endpoint?: string;
    method?: string;
    statusCode?: number;
  };
  metadata?: Record<string, any>;
}

class ErrorTracker {
  private errors: Map<string, ErrorEvent> = new Map();
  private performances: PerformanceEvent[] = [];
  private maxErrors = 10000;
  private maxPerformances = 5000;

  /**
   * Track an error event
   */
  trackError(
    error: Error | string,
    level: 'error' | 'warning' | 'info' = 'error',
    context: Partial<ErrorEvent['context']> = {},
    metadata?: Record<string, any>
  ): string {
    const message = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'object' ? error.stack : undefined;
    
    // Create fingerprint for deduplication
    const fingerprint = this.generateFingerprint(message, stack, context.endpoint);
    
    const existingError = this.errors.get(fingerprint);
    
    if (existingError) {
      // Update existing error
      existingError.count++;
      existingError.timestamp = new Date().toISOString();
      existingError.resolved = false;
      existingError.resolvedAt = undefined;
    } else {
      // Create new error event
      const errorEvent: ErrorEvent = {
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        level,
        message,
        stack,
        context,
        metadata,
        resolved: false,
        count: 1,
        fingerprint
      };
      
      this.errors.set(fingerprint, errorEvent);
      
      // Cleanup old errors if we exceed the limit
      if (this.errors.size > this.maxErrors) {
        this.cleanupOldErrors();
      }
      
      // Send critical errors immediately
      if (level === 'error') {
        this.sendErrorAlert(errorEvent);
      }
    }
    
    return fingerprint;
  }

  /**
   * Track a performance event
   */
  trackPerformance(
    type: PerformanceEvent['type'],
    name: string,
    duration: number,
    success: boolean,
    context: Partial<PerformanceEvent['context']> = {},
    metadata?: Record<string, any>
  ): string {
    const performanceEvent: PerformanceEvent = {
      id: `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type,
      name,
      duration,
      success,
      context,
      metadata
    };
    
    this.performances.push(performanceEvent);
    
    // Cleanup old performance events if we exceed the limit
    if (this.performances.length > this.maxPerformances) {
      this.performances = this.performances.slice(-this.maxPerformances);
    }
    
    // Alert on slow performance
    if (duration > this.getPerformanceThreshold(type)) {
      this.sendPerformanceAlert(performanceEvent);
    }
    
    return performanceEvent.id;
  }

  /**
   * Get error statistics
   */
  getErrorStats(timeframe: '1h' | '24h' | '7d' = '24h') {
    const now = Date.now();
    const timeframes = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
    
    const since = now - timeframes[timeframe];
    const recentErrors = Array.from(this.errors.values()).filter(
      error => new Date(error.timestamp).getTime() > since
    );
    
    const totalErrors = recentErrors.reduce((sum, error) => sum + error.count, 0);
    const errorsByLevel = recentErrors.reduce((acc, error) => {
      acc[error.level] = (acc[error.level] || 0) + error.count;
      return acc;
    }, {} as Record<string, number>);
    
    const topErrors = recentErrors
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return {
      totalErrors,
      uniqueErrors: recentErrors.length,
      errorsByLevel,
      topErrors,
      timeframe
    };
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(timeframe: '1h' | '24h' | '7d' = '24h') {
    const now = Date.now();
    const timeframes = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
    
    const since = now - timeframes[timeframe];
    const recentPerformances = this.performances.filter(
      perf => new Date(perf.timestamp).getTime() > since
    );
    
    const byType = recentPerformances.reduce((acc, perf) => {
      if (!acc[perf.type]) {
        acc[perf.type] = {
          count: 0,
          totalDuration: 0,
          successCount: 0,
          failureCount: 0
        };
      }
      
      acc[perf.type].count++;
      acc[perf.type].totalDuration += perf.duration;
      if (perf.success) {
        acc[perf.type].successCount++;
      } else {
        acc[perf.type].failureCount++;
      }
      
      return acc;
    }, {} as Record<string, any>);
    
    // Calculate averages and success rates
    for (const type in byType) {
      const stats = byType[type];
      stats.averageDuration = Math.round(stats.totalDuration / stats.count);
      stats.successRate = Math.round((stats.successCount / stats.count) * 100);
    }
    
    const slowestOperations = recentPerformances
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
    
    return {
      totalOperations: recentPerformances.length,
      operationsByType: byType,
      slowestOperations,
      timeframe
    };
  }

  /**
   * Resolve an error by fingerprint
   */
  resolveError(fingerprint: string): boolean {
    const error = this.errors.get(fingerprint);
    if (error) {
      error.resolved = true;
      error.resolvedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Get all errors with optional filtering
   */
  getErrors(options: {
    level?: 'error' | 'warning' | 'info';
    resolved?: boolean;
    limit?: number;
  } = {}) {
    let errors = Array.from(this.errors.values());
    
    if (options.level) {
      errors = errors.filter(error => error.level === options.level);
    }
    
    if (options.resolved !== undefined) {
      errors = errors.filter(error => error.resolved === options.resolved);
    }
    
    // Sort by timestamp (newest first)
    errors.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    if (options.limit) {
      errors = errors.slice(0, options.limit);
    }
    
    return errors;
  }

  /**
   * Generate fingerprint for error deduplication
   */
  private generateFingerprint(message: string, stack?: string, endpoint?: string): string {
    const stackLine = stack ? stack.split('\n')[1] || '' : '';
    const combined = `${message}:${stackLine}:${endpoint || ''}`;
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(36);
  }

  /**
   * Clean up old errors
   */
  private cleanupOldErrors(): void {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    for (const [fingerprint, error] of this.errors.entries()) {
      if (error.resolved && error.resolvedAt && 
          new Date(error.resolvedAt).getTime() < oneDayAgo) {
        this.errors.delete(fingerprint);
      }
    }
    
    // If still too many, remove oldest errors
    if (this.errors.size > this.maxErrors) {
      const sortedErrors = Array.from(this.errors.entries())
        .sort(([,a], [,b]) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      const toRemove = sortedErrors.slice(0, this.errors.size - this.maxErrors + 100);
      toRemove.forEach(([fingerprint]) => this.errors.delete(fingerprint));
    }
  }

  /**
   * Get performance threshold for alerting
   */
  private getPerformanceThreshold(type: PerformanceEvent['type']): number {
    const thresholds = {
      'page-load': 5000,     // 5 seconds
      'api-call': 3000,      // 3 seconds
      'database-query': 1000, // 1 second
      'external-request': 5000 // 5 seconds
    };
    
    return thresholds[type] || 3000;
  }

  /**
   * Send error alert
   */
  private async sendErrorAlert(error: ErrorEvent): Promise<void> {
    try {
      // In production, this would send to your alerting system
      console.error('🚨 Critical Error Alert:', {
        message: error.message,
        endpoint: error.context.endpoint,
        count: error.count,
        timestamp: error.timestamp
      });
      
      // Example: Send to monitoring endpoint
      if (process.env.NODE_ENV === 'production') {
        await fetch('/api/monitoring/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            alert: {
              level: 'critical',
              category: 'api',
              message: `Critical error: ${error.message}`,
              details: error
            }
          })
        });
      }
    } catch (alertError) {
      console.error('Failed to send error alert:', alertError);
    }
  }

  /**
   * Send performance alert
   */
  private async sendPerformanceAlert(performance: PerformanceEvent): Promise<void> {
    try {
      console.warn('⚠️  Performance Alert:', {
        name: performance.name,
        duration: performance.duration,
        threshold: this.getPerformanceThreshold(performance.type),
        endpoint: performance.context.endpoint
      });
      
      // Example: Send to monitoring endpoint
      if (process.env.NODE_ENV === 'production') {
        await fetch('/api/monitoring/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            alert: {
              level: 'warning',
              category: 'performance',
              message: `Slow operation: ${performance.name} took ${performance.duration}ms`,
              details: performance
            }
          })
        });
      }
    } catch (alertError) {
      console.error('Failed to send performance alert:', alertError);
    }
  }
}

// Global error tracker instance
export const errorTracker = new ErrorTracker();

/**
 * Performance timing utility
 */
export class PerformanceTimer {
  private start: number;
  private name: string;
  private type: PerformanceEvent['type'];
  private context: Partial<PerformanceEvent['context']>;

  constructor(
    name: string, 
    type: PerformanceEvent['type'] = 'api-call',
    context: Partial<PerformanceEvent['context']> = {}
  ) {
    this.start = Date.now();
    this.name = name;
    this.type = type;
    this.context = context;
  }

  /**
   * End timing and track performance
   */
  end(success: boolean = true, metadata?: Record<string, any>): number {
    const duration = Date.now() - this.start;
    errorTracker.trackPerformance(this.type, this.name, duration, success, this.context, metadata);
    return duration;
  }
}

/**
 * Middleware helper for automatic error tracking
 */
export function withErrorTracking<T extends (...args: any[]) => any>(
  fn: T,
  context?: Partial<ErrorEvent['context']>
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      errorTracker.trackError(error as Error, 'error', context);
      throw error;
    }
  }) as T;
}