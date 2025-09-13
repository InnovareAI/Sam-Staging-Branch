# Error Tracking & Alerting System Documentation
**SAM AI Platform - Advanced Error Management & Performance Monitoring**

**Created**: 2025-09-12  
**Version**: 1.0  
**Status**: Production Ready  
**Classification**: Enterprise-Grade Error Intelligence

---

## 🎯 Overview

The SAM AI Error Tracking System provides **intelligent error management**, **performance monitoring**, and **automated alerting** across the entire platform. This system features **error deduplication**, **context-aware logging**, and **real-time alert generation** comparable to Sentry, Rollbar, or DataDog APM.

### **Key Capabilities**
- ✅ **Intelligent error deduplication** using fingerprinting algorithms
- ✅ **Context-aware error logging** with user, session, and request context
- ✅ **Performance event tracking** for API calls and database queries
- ✅ **Critical error alerting** with immediate notification system
- ✅ **Error frequency analysis** with automatic counting and trending
- ✅ **Resolution workflow management** with timestamp tracking
- ✅ **Multi-dimensional error context** capture and analysis

---

## 🏗️ System Architecture

### **Error Tracking Stack**
```
┌─────────────────────────────────────────────────────────┐
│                  ERROR CAPTURE LAYER                   │
│         Application Code → Error Events                │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│               ERROR TRACKER ENGINE                     │
│            lib/monitoring/error-tracker.ts             │
│                                                         │
│  ┌─────────────────┬─────────────────┬───────────────┐  │
│  │  DEDUPLICATION  │   CONTEXTUAL    │  PERFORMANCE  │  │
│  │   FINGERPRINT   │    LOGGING      │   TRACKING    │  │
│  └─────────────────┴─────────────────┴───────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                  ALERT DISPATCH SYSTEM                 │
│              Critical Error Notifications              │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                   MONITORING DASHBOARD                 │
│              /admin/monitoring → Alerts                │
└─────────────────────────────────────────────────────────┘
```

### **Core Components**

#### **1. Error Event Schema**
```typescript
interface ErrorEvent {
  id: string;                    // Unique error identifier
  timestamp: string;             // ISO 8601 timestamp
  level: 'error' | 'warning' | 'info';
  message: string;               // Error message
  stack?: string;                // Stack trace (if available)
  context: {                     // Request/user context
    userId?: string;             // User identifier
    sessionId?: string;          // Session identifier
    endpoint?: string;           // API endpoint
    userAgent?: string;          // Browser/client info
    ip?: string;                 // Client IP address
    referer?: string;            // HTTP referer
  };
  metadata?: Record<string, any>; // Additional context data
  resolved: boolean;             // Resolution status
  resolvedAt?: string;           // Resolution timestamp
  count: number;                 // Occurrence frequency
  fingerprint: string;           // Deduplication key
}
```

#### **2. Performance Event Schema**
```typescript
interface PerformanceEvent {
  id: string;                    // Unique performance identifier
  timestamp: string;             // Event timestamp
  type: 'page-load' | 'api-call' | 'database-query' | 'external-request';
  name: string;                  // Performance event name
  duration: number;              // Event duration (ms)
  success: boolean;              // Success/failure status
  context: {                     // Performance context
    userId?: string;             // User identifier
    endpoint?: string;           // API endpoint
    method?: string;             // HTTP method
    statusCode?: number;         // HTTP status code
  };
  metadata?: Record<string, any>; // Additional performance data
}
```

---

## 🚀 Implementation Guide

### **Error Tracker Class Usage**

#### **Initialization**
```typescript
import { ErrorTracker } from '@/lib/monitoring/error-tracker';

// Initialize error tracker (singleton)
const errorTracker = ErrorTracker.getInstance();
```

#### **Basic Error Tracking**
```typescript
// Track a simple error
try {
  // Risky operation
  await riskyDatabaseOperation();
} catch (error) {
  const errorId = errorTracker.trackError(
    error,
    'error',
    {
      userId: user.id,
      endpoint: '/api/database-operation',
      sessionId: session.id
    }
  );
  console.error(`Error tracked: ${errorId}`);
}
```

#### **Advanced Error Tracking with Context**
```typescript
// Track error with comprehensive context
const errorId = errorTracker.trackError(
  'Payment processing failed',
  'error',
  {
    userId: req.user?.id,
    sessionId: req.session?.id,
    endpoint: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    referer: req.headers.referer
  },
  {
    paymentId: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    provider: 'stripe',
    errorCode: 'card_declined'
  }
);
```

#### **Performance Event Tracking**
```typescript
// Track API call performance
const startTime = Date.now();
try {
  const result = await apiCall();
  
  errorTracker.trackPerformance({
    type: 'api-call',
    name: 'user-registration',
    duration: Date.now() - startTime,
    success: true,
    context: {
      userId: user.id,
      endpoint: '/api/auth/register',
      method: 'POST',
      statusCode: 200
    }
  });
} catch (error) {
  errorTracker.trackPerformance({
    type: 'api-call',
    name: 'user-registration',
    duration: Date.now() - startTime,
    success: false,
    context: {
      endpoint: '/api/auth/register',
      method: 'POST',
      statusCode: 500
    }
  });
}
```

---

## 🔍 Error Deduplication System

### **Fingerprinting Algorithm**
```typescript
generateFingerprint(
  message: string, 
  stack?: string, 
  endpoint?: string
): string {
  // Normalize error message
  const normalizedMessage = message
    .replace(/\d+/g, 'X')           // Replace numbers
    .replace(/['"]/g, '')           // Remove quotes
    .toLowerCase()
    .trim();

  // Extract meaningful stack frames
  const relevantStack = stack
    ?.split('\n')
    .slice(0, 3)                    // Top 3 frames
    .map(frame => frame
      .replace(/:\d+:\d+/g, '')     // Remove line numbers
      .trim()
    )
    .join('|') || '';

  // Create composite fingerprint
  const composite = `${normalizedMessage}|${relevantStack}|${endpoint || ''}`;
  
  return crypto
    .createHash('sha256')
    .update(composite)
    .digest('hex')
    .substring(0, 16);
}
```

### **Deduplication Benefits**
- ✅ **Reduced noise**: Same errors grouped together
- ✅ **Frequency tracking**: Automatic error counting
- ✅ **Pattern recognition**: Identify recurring issues
- ✅ **Resource efficiency**: Minimal storage overhead
- ✅ **Alert reduction**: Prevent notification spam

---

## 🚨 Alert System

### **Alert Trigger Conditions**

#### **Critical Alerts** (Immediate Notification)
```typescript
const CRITICAL_CONDITIONS = {
  errorRate: {
    threshold: 10,              // > 10 errors per minute
    window: 60000,              // 1-minute window
    action: 'immediate_alert'
  },
  databaseErrors: {
    threshold: 5,               // > 5 DB errors per minute
    window: 60000,
    action: 'immediate_alert'
  },
  authenticationFailures: {
    threshold: 20,              // > 20 auth failures per minute
    window: 60000,
    action: 'immediate_alert'
  },
  systemErrors: {
    level: 'error',
    categories: ['system', 'security', 'data-loss'],
    action: 'immediate_alert'
  }
};
```

#### **Warning Alerts** (Monitor Closely)
```typescript
const WARNING_CONDITIONS = {
  elevatedErrorRate: {
    threshold: 5,               // 5-10 errors per minute
    window: 60000,
    action: 'warning_alert'
  },
  performanceDegradation: {
    responseTime: 1000,         // > 1 second response
    threshold: 10,              // 10+ slow requests
    window: 300000,             // 5-minute window
    action: 'warning_alert'
  },
  unusualActivity: {
    patterns: ['spike', 'anomaly', 'deviation'],
    action: 'warning_alert'
  }
};
```

### **Alert Dispatch Mechanisms**

#### **Internal Notifications**
```typescript
// Dashboard alerts (real-time)
interface DashboardAlert {
  id: string;
  level: 'critical' | 'warning' | 'info';
  category: string;             // 'database', 'api', 'auth', etc.
  message: string;              // Human-readable alert
  timestamp: string;            // Alert creation time
  resolved: boolean;            // Resolution status
  count: number;                // Alert frequency
}
```

#### **External Integrations** (Future Enhancement)
```typescript
// Slack integration (planned)
interface SlackAlert {
  channel: string;              // #alerts, #critical
  message: string;              // Alert content
  severity: 'critical' | 'warning';
  attachments: AlertDetails[];  // Error context
}

// Email notifications (planned)
interface EmailAlert {
  recipients: string[];         // Admin email list
  subject: string;              // Alert subject
  body: string;                 // Alert details
  priority: 'high' | 'normal';  // Email priority
}
```

---

## 📊 Analytics & Reporting

### **Error Analytics Dashboard**

#### **Error Frequency Analysis**
```typescript
// Top errors by frequency
interface ErrorFrequency {
  fingerprint: string;          // Error fingerprint
  message: string;              // Error message
  count: number;                // Total occurrences
  lastOccurrence: string;       // Most recent occurrence
  trend: 'increasing' | 'stable' | 'decreasing';
  affectedUsers: number;        // Unique users impacted
}
```

#### **Performance Metrics**
```typescript
// System performance overview
interface PerformanceMetrics {
  averageResponseTime: number;  // Mean API response time
  p95ResponseTime: number;      // 95th percentile response
  errorRate: number;            // Error percentage
  requestCount: number;         // Total requests
  slowestEndpoints: Array<{     // Performance bottlenecks
    endpoint: string;
    averageTime: number;
    requestCount: number;
  }>;
}
```

#### **User Impact Analysis**
```typescript
// User-centric error analysis
interface UserImpactMetrics {
  totalUsersAffected: number;   // Users experiencing errors
  errorsByUserSegment: Array<{  // Segment-based analysis
    segment: string;            // User category
    errorCount: number;         // Errors in segment
    userCount: number;          // Users in segment
  }>;
  criticalUserErrors: Array<{   // High-value user errors
    userId: string;
    errorCount: number;
    lastError: string;
  }>;
}
```

---

## 🛠️ Configuration & Setup

### **Environment Configuration**
```typescript
// Error tracking configuration
const ERROR_TRACKER_CONFIG = {
  maxErrors: 10000,             // Maximum stored errors
  maxPerformances: 5000,        // Maximum stored performance events
  cleanupInterval: 3600000,     // Cleanup every hour (ms)
  alertThresholds: {
    critical: 10,               // Critical alert threshold
    warning: 5,                 // Warning alert threshold
    info: 1                     // Info alert threshold
  },
  retentionPeriod: 2592000000,  // 30 days retention (ms)
  enableAlerts: true,           // Enable alert system
  enablePerformanceTracking: true // Enable performance tracking
};
```

### **API Integration**

#### **Error Tracking API Endpoints**
```typescript
// Get error summary
GET /api/monitoring/errors/summary
Response: {
  totalErrors: number;
  criticalErrors: number;
  last24hErrors: number;
  topErrors: ErrorFrequency[];
}

// Get error details
GET /api/monitoring/errors/{fingerprint}
Response: ErrorEvent

// Mark error as resolved
POST /api/monitoring/errors/{fingerprint}/resolve
Body: { resolvedBy: string; notes?: string; }
Response: { success: boolean; }
```

#### **Performance Tracking API Endpoints**
```typescript
// Get performance metrics
GET /api/monitoring/performance/summary
Response: PerformanceMetrics

// Get slow queries
GET /api/monitoring/performance/slow-queries
Response: Array<PerformanceEvent>

// Get endpoint performance
GET /api/monitoring/performance/endpoints
Response: Array<EndpointPerformance>
```

---

## 🔧 Advanced Features

### **Custom Error Categories**
```typescript
// Define custom error categories
enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  DATABASE = 'database',
  EXTERNAL_API = 'external_api',
  VALIDATION = 'validation',
  BUSINESS_LOGIC = 'business_logic',
  SECURITY = 'security',
  PERFORMANCE = 'performance'
}

// Track categorized errors
errorTracker.trackError(
  error,
  'error',
  context,
  { category: ErrorCategory.AUTHENTICATION }
);
```

### **Error Resolution Workflows**
```typescript
// Mark error as resolved
errorTracker.resolveError(
  fingerprint,
  {
    resolvedBy: 'admin@company.com',
    resolutionNotes: 'Fixed database connection pool',
    resolutionType: 'code_fix',
    deploymentVersion: '1.2.3'
  }
);

// Check if error is resolved
const isResolved = errorTracker.isErrorResolved(fingerprint);
```

### **Custom Alert Rules**
```typescript
// Define custom alert rules
interface CustomAlertRule {
  name: string;                 // Rule name
  condition: string;            // JavaScript condition
  threshold: number;            // Trigger threshold
  window: number;               // Time window (ms)
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;             // Rule status
}

// Example custom rule
const customRule: CustomAlertRule = {
  name: 'High Payment Failures',
  condition: 'category === "payment" && level === "error"',
  threshold: 5,
  window: 300000,               // 5 minutes
  severity: 'critical',
  enabled: true
};
```

---

## 📋 Best Practices

### **Error Handling Guidelines**

#### **1. Contextual Error Tracking**
```typescript
// ✅ GOOD: Rich context
errorTracker.trackError(error, 'error', {
  userId: req.user?.id,
  endpoint: req.originalUrl,
  method: req.method,
  sessionId: req.sessionID,
  userAgent: req.get('User-Agent')
}, {
  requestId: req.id,
  operationType: 'database_insert',
  affectedTable: 'users'
});

// ❌ BAD: No context
errorTracker.trackError(error);
```

#### **2. Appropriate Error Levels**
```typescript
// ✅ GOOD: Appropriate levels
errorTracker.trackError(validationError, 'warning', context);
errorTracker.trackError(databaseError, 'error', context);
errorTracker.trackError(securityBreach, 'error', context);

// ❌ BAD: All errors as 'error' level
errorTracker.trackError(validationError, 'error', context);
```

#### **3. Performance Monitoring**
```typescript
// ✅ GOOD: Comprehensive performance tracking
const timer = performance.now();
try {
  const result = await operation();
  errorTracker.trackPerformance({
    type: 'api-call',
    name: 'user-operation',
    duration: performance.now() - timer,
    success: true,
    context: { userId: user.id, endpoint: '/api/users' }
  });
  return result;
} catch (error) {
  errorTracker.trackPerformance({
    type: 'api-call',
    name: 'user-operation',
    duration: performance.now() - timer,
    success: false,
    context: { endpoint: '/api/users' }
  });
  throw error;
}
```

### **Security Considerations**

#### **PII Data Protection**
```typescript
// ✅ GOOD: Sanitize sensitive data
const sanitizedContext = {
  userId: user.id,              // Keep user ID
  email: maskEmail(user.email), // Mask email: u****@domain.com
  ip: maskIP(req.ip),           // Mask IP: 192.168.*.* 
  sessionId: req.sessionID      // Keep session ID
};

// ❌ BAD: Include raw PII
const unsafeContext = {
  userId: user.id,
  email: user.email,            // Raw email address
  ssn: user.ssn,                // Sensitive data
  creditCard: user.card         // Financial data
};
```

---

## 🚨 Troubleshooting

### **Common Issues**

#### **1. High Memory Usage**
```typescript
// Check error tracker memory usage
const memoryUsage = errorTracker.getMemoryUsage();
console.log(`Errors stored: ${memoryUsage.errorCount}`);
console.log(`Performance events: ${memoryUsage.performanceCount}`);

// Manual cleanup if needed
errorTracker.cleanup();
```

#### **2. Missing Error Context**
```typescript
// Verify context capture
errorTracker.trackError(error, 'error', {
  // Ensure all required context is present
  userId: req.user?.id || 'anonymous',
  endpoint: req.originalUrl || req.url,
  method: req.method,
  timestamp: new Date().toISOString()
});
```

#### **3. Alert Spam**
```typescript
// Configure alert thresholds to reduce noise
const alertConfig = {
  critical: {
    threshold: 10,              // Increase threshold
    window: 60000,              // 1-minute window
    cooldown: 300000            // 5-minute cooldown
  }
};
```

---

## 🔮 Future Enhancements

### **Planned Features**
- [ ] **Machine Learning Integration**: AI-powered error pattern recognition
- [ ] **Slack/Teams Integration**: Real-time alert notifications
- [ ] **Advanced Analytics**: Predictive error analysis
- [ ] **Custom Dashboards**: User-defined monitoring views
- [ ] **API Rate Limiting**: Built-in protection mechanisms
- [ ] **Distributed Tracing**: Cross-service error tracking

### **Integration Roadmap**
- [ ] **Sentry Integration**: Professional error monitoring service
- [ ] **DataDog APM**: Application performance monitoring
- [ ] **New Relic**: Full-stack observability platform
- [ ] **Prometheus/Grafana**: Open-source monitoring stack

---

## 📚 Related Documentation

### **Internal References**
- [Enterprise Monitoring System](./ENTERPRISE_MONITORING_SYSTEM.md)
- [Alert Management Guide](./ALERT_MANAGEMENT_GUIDE.md)
- [Performance Optimization](./PERFORMANCE_OPTIMIZATION.md)
- [Database Monitoring](../database/DATABASE_HEALTH_MONITORING_SYSTEM.md)

### **External Resources**
- [Error Tracking Best Practices](https://docs.sentry.io/product/best-practices/)
- [Performance Monitoring Guide](https://web.dev/vitals/)
- [JavaScript Error Handling](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling)

---

**Last Updated**: September 12, 2025  
**Next Review**: October 12, 2025  
**Document Version**: 1.0.0  
**Status**: Production Ready ✅