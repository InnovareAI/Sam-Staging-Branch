/**
 * Enterprise-grade rate limiting and security middleware
 * Provides DDoS protection, abuse prevention, and usage quota management
 */

import { supabaseAdmin } from '../app/lib/supabase'
import { logger } from './logging'

// Use admin client for rate limit storage
const supabase = supabaseAdmin()

interface RateLimitConfig {
  key: string                 // Unique identifier for the rate limit
  limit: number              // Maximum requests allowed
  window: number             // Time window in seconds
  identifier?: string        // Additional identifier (e.g., user ID)
  skipIfHeaderPresent?: string // Skip rate limiting if header present
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
  totalHits: number
  errorMessage?: string
}

interface RateLimitEntry {
  key: string
  hits: number
  reset_time: number
  created_at: string
  updated_at: string
}

/**
 * Advanced rate limiting with multiple strategies
 */
export class RateLimiter {
  private cache: Map<string, RateLimitEntry> = new Map()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries()
    }, 5 * 60 * 1000)
  }

  /**
   * Check and update rate limit for a given key
   */
  async checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    const { key, limit, window, identifier } = config
    const fullKey = identifier ? `${key}:${identifier}` : key
    const now = Date.now()
    const windowStart = now - (window * 1000)

    try {
      // Try cache first for performance
      let entry = this.cache.get(fullKey)
      
      // If not in cache or expired, fetch from database
      if (!entry || now > entry.reset_time) {
        const { data: dbEntry } = await supabase
          .from('rate_limits')
          .select('*')
          .eq('key', fullKey)
          .gte('reset_time', now)
          .single()

        if (dbEntry) {
          entry = dbEntry
          this.cache.set(fullKey, entry)
        }
      }

      // Calculate current window
      const resetTime = entry?.reset_time || (now + (window * 1000))
      const currentHits = (entry?.hits || 0) + 1

      // Check if limit exceeded
      if (currentHits > limit && now < resetTime) {
        logger.warn('Rate limit exceeded', {
          metadata: {
            key: fullKey,
            hits: currentHits,
            limit,
            window,
            resetTime: new Date(resetTime).toISOString()
          }
        })

        return {
          success: false,
          remaining: 0,
          resetTime,
          totalHits: currentHits,
          errorMessage: `Rate limit exceeded. Limit: ${limit} requests per ${window} seconds`
        }
      }

      // Update rate limit entry
      const newEntry: RateLimitEntry = {
        key: fullKey,
        hits: now < resetTime ? currentHits : 1, // Reset if window expired
        reset_time: now < resetTime ? resetTime : (now + (window * 1000)),
        created_at: entry?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Update database
      await supabase
        .from('rate_limits')
        .upsert(newEntry, {
          onConflict: 'key'
        })

      // Update cache
      this.cache.set(fullKey, newEntry)

      return {
        success: true,
        remaining: Math.max(0, limit - newEntry.hits),
        resetTime: newEntry.reset_time,
        totalHits: newEntry.hits
      }

    } catch (error) {
      logger.error('Rate limiting error', error as Error, {
        metadata: { key: fullKey, limit, window }
      })

      // Fail open - allow request if rate limiting system is down
      return {
        success: true,
        remaining: limit,
        resetTime: now + (window * 1000),
        totalHits: 1,
        errorMessage: 'Rate limiting temporarily unavailable'
      }
    }
  }

  /**
   * Clean up expired entries from cache
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.reset_time) {
        this.cache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} expired rate limit entries`)
    }
  }

  /**
   * Reset rate limit for a specific key (admin function)
   */
  async resetRateLimit(key: string): Promise<void> {
    try {
      await supabase
        .from('rate_limits')
        .delete()
        .eq('key', key)

      this.cache.delete(key)
      
      logger.info('Rate limit reset', { metadata: { key } })
    } catch (error) {
      logger.error('Error resetting rate limit', error as Error, { metadata: { key } })
    }
  }

  /**
   * Get current rate limit status
   */
  async getRateLimitStatus(key: string): Promise<RateLimitEntry | null> {
    try {
      const { data } = await supabase
        .from('rate_limits')
        .select('*')
        .eq('key', key)
        .single()

      return data
    } catch (error) {
      return null
    }
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    clearInterval(this.cleanupInterval)
  }
}

// Singleton instance
const rateLimiter = new RateLimiter()

/**
 * Common rate limiting configurations
 */
export const RATE_LIMITS = {
  // API endpoint limits
  CAMPAIGN_EXECUTION: {
    limit: 5,
    window: 3600,        // 5 executions per hour
    key: 'campaign:execute'
  },
  PROSPECT_UPLOAD: {
    limit: 10,
    window: 3600,        // 10 uploads per hour
    key: 'prospect:upload'
  },
  TEMPLATE_CREATION: {
    limit: 20,
    window: 3600,        // 20 templates per hour
    key: 'template:create'
  },
  
  // User action limits
  LOGIN_ATTEMPTS: {
    limit: 5,
    window: 900,         // 5 attempts per 15 minutes
    key: 'auth:login'
  },
  PASSWORD_RESET: {
    limit: 3,
    window: 3600,        // 3 resets per hour
    key: 'auth:password-reset'
  },
  
  // Integration limits
  N8N_WEBHOOK: {
    limit: 1000,
    window: 3600,        // 1000 webhooks per hour
    key: 'n8n:webhook'
  },
  UNIPILE_API: {
    limit: 500,
    window: 3600,        // 500 API calls per hour
    key: 'unipile:api'
  },
  
  // Global limits
  GLOBAL_API: {
    limit: 1000,
    window: 3600,        // 1000 requests per hour per IP
    key: 'global:api'
  }
} as const

/**
 * Apply rate limiting to a function
 */
export async function withRateLimit<T>(
  config: RateLimitConfig,
  fn: () => Promise<T>
): Promise<T> {
  const result = await rateLimiter.checkRateLimit(config)
  
  if (!result.success) {
    const error = new Error(result.errorMessage || 'Rate limit exceeded')
    error.name = 'RateLimitError'
    throw error
  }
  
  return await fn()
}

/**
 * Express/Next.js middleware for rate limiting
 */
export async function rateLimitMiddleware(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  return await rateLimiter.checkRateLimit({
    ...config,
    identifier
  })
}

/**
 * IP-based rate limiting
 */
export async function ipRateLimit(
  ip: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  return await rateLimiter.checkRateLimit({
    ...config,
    identifier: ip
  })
}

/**
 * User-based rate limiting
 */
export async function userRateLimit(
  userId: string,
  workspaceId: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  return await rateLimiter.checkRateLimit({
    ...config,
    identifier: `${userId}:${workspaceId}`
  })
}

/**
 * Workspace-based rate limiting
 */
export async function workspaceRateLimit(
  workspaceId: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  return await rateLimiter.checkRateLimit({
    ...config,
    identifier: workspaceId
  })
}

/**
 * Anti-abuse detection
 */
export class AbuseDetector {
  /**
   * Detect suspicious patterns in API usage
   */
  static async detectSuspiciousActivity(
    identifier: string,
    activityType: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      // Check for rapid-fire requests
      const rapidFireCheck = await rateLimiter.checkRateLimit({
        key: `abuse:rapid-fire:${activityType}`,
        identifier,
        limit: 50,
        window: 60 // 50 requests per minute
      })

      if (!rapidFireCheck.success) {
        logger.warn('Rapid-fire abuse detected', {
          metadata: {
            identifier,
            activityType,
            ...metadata
          }
        })
        return true
      }

      // Check for distributed attacks (same action from multiple IPs)
      if (activityType === 'login' || activityType === 'registration') {
        const distributedCheck = await rateLimiter.checkRateLimit({
          key: `abuse:distributed:${activityType}`,
          identifier: 'global',
          limit: 200,
          window: 300 // 200 attempts per 5 minutes globally
        })

        if (!distributedCheck.success) {
          logger.warn('Distributed abuse detected', {
            metadata: {
              identifier,
              activityType,
              ...metadata
            }
          })
          return true
        }
      }

      return false
    } catch (error) {
      logger.error('Abuse detection error', error as Error)
      return false // Fail open
    }
  }

  /**
   * Block abusive IPs temporarily
   */
  static async blockIP(ip: string, duration: number = 3600): Promise<void> {
    try {
      await supabase
        .from('blocked_ips')
        .upsert({
          ip_address: ip,
          blocked_until: new Date(Date.now() + (duration * 1000)).toISOString(),
          reason: 'Automated abuse detection',
          created_at: new Date().toISOString()
        })

      logger.warn('IP blocked for abuse', {
        metadata: { ip, duration }
      })
    } catch (error) {
      logger.error('Error blocking IP', error as Error, {
        metadata: { ip }
      })
    }
  }

  /**
   * Check if IP is currently blocked
   */
  static async isIPBlocked(ip: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('blocked_ips')
        .select('blocked_until')
        .eq('ip_address', ip)
        .gte('blocked_until', new Date().toISOString())
        .single()

      return !!data
    } catch (error) {
      return false // Fail open
    }
  }
}

// Export singleton instance
export { rateLimiter }

// Database migration for rate limiting tables
export const RATE_LIMIT_SCHEMA = `
-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 0,
  reset_time BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for cleanup operations
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_time ON rate_limits(reset_time);

-- Blocked IPs table
CREATE TABLE IF NOT EXISTS blocked_ips (
  ip_address INET PRIMARY KEY,
  blocked_until TIMESTAMP WITH TIME ZONE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for blocked IP lookups
CREATE INDEX IF NOT EXISTS idx_blocked_ips_until ON blocked_ips(blocked_until);

-- Function to cleanup expired entries
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS INTEGER AS $$
BEGIN
  DELETE FROM rate_limits WHERE reset_time < EXTRACT(EPOCH FROM NOW()) * 1000;
  DELETE FROM blocked_ips WHERE blocked_until < NOW();
  RETURN 1;
END;
$$ LANGUAGE plpgsql;
`