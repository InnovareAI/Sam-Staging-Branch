# INVITATION SYSTEM OPERATIONAL RUNBOOK

## Overview

This runbook provides comprehensive operational procedures for the SAM AI Platform invitation system in production. It covers monitoring, troubleshooting, maintenance, and emergency procedures.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Monitoring and Alerting](#monitoring-and-alerting)
3. [Common Issues and Troubleshooting](#common-issues-and-troubleshooting)
4. [Emergency Procedures](#emergency-procedures)
5. [Maintenance Tasks](#maintenance-tasks)
6. [Performance Optimization](#performance-optimization)
7. [Security Procedures](#security-procedures)

## System Architecture

### Core Components

- **Frontend**: Next.js application with invitation UI
- **Backend**: Next.js API routes for invitation logic
- **Database**: Supabase PostgreSQL with RLS policies
- **Authentication**: Supabase Auth for user management
- **Email Service**: Postmark for invitation delivery
- **Hosting**: Netlify with edge functions

### Key Database Tables

- `invitations`: Core invitation records
- `organizations`: Organization management
- `workspaces`: Workspace associations
- `profiles`: User profiles and status

## Monitoring and Alerting

### Health Check Endpoints

```bash
# System health check
curl https://app.meet-sam.com/api/monitoring/health

# System metrics
curl https://app.meet-sam.com/api/monitoring/metrics

# Active alerts
curl https://app.meet-sam.com/api/monitoring/alerts
```

### Key Metrics to Monitor

1. **Invitation Success Rate**: Should be > 95%
2. **Email Delivery Rate**: Should be > 98%
3. **Database Response Time**: Should be < 500ms
4. **API Response Time**: Should be < 2000ms
5. **Error Rate**: Should be < 1%

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Invitation Success Rate | < 98% | < 95% |
| Email Delivery Failures | > 5/hour | > 20/hour |
| Database Response Time | > 1000ms | > 2000ms |
| API Error Rate | > 2% | > 5% |
| System Memory Usage | > 80% | > 90% |

## Common Issues and Troubleshooting

### 1. Invitation Emails Not Sending

**Symptoms:**
- Users report not receiving invitation emails
- High failure rate in email metrics

**Diagnosis:**
```bash
# Check Postmark status
curl -X GET "https://api.postmarkapp.com/servers" \
  -H "X-Postmark-Server-Token: YOUR_TOKEN"

# Check recent email attempts
curl https://app.meet-sam.com/api/admin/stats
```

**Resolution Steps:**
1. Verify Postmark API key is valid
2. Check Postmark account limits and reputation
3. Verify DNS records for email domain
4. Check spam filtering and deliverability

**Prevention:**
- Monitor Postmark account health daily
- Maintain good sender reputation
- Regular DNS record validation

### 2. Database Connection Issues

**Symptoms:**
- Database connection timeouts
- Invitation creation failures
- User profile sync issues

**Diagnosis:**
```bash
# Check database connectivity
curl https://app.meet-sam.com/api/check-tables

# Monitor connection pool
curl https://app.meet-sam.com/api/monitoring/metrics | jq '.database'
```

**Resolution Steps:**
1. Check Supabase dashboard for issues
2. Verify connection string and credentials
3. Review connection pool settings
4. Check for long-running queries

### 3. High Response Times

**Symptoms:**
- Slow invitation page loads
- API timeouts
- User complaints about performance

**Diagnosis:**
```bash
# Check performance metrics
curl https://app.meet-sam.com/api/monitoring/metrics | jq '.performance'

# Monitor specific endpoints
curl -w "@curl-format.txt" -s -o /dev/null https://app.meet-sam.com/api/admin/invite-user
```

**Resolution Steps:**
1. Identify slow database queries
2. Check for memory leaks
3. Review and optimize API endpoints
4. Consider database indexing

### 4. Authentication Issues

**Symptoms:**
- Users cannot access invitation system
- Login failures
- Session timeouts

**Diagnosis:**
```bash
# Check Supabase Auth status
curl https://app.meet-sam.com/api/monitoring/health | jq '.checks.auth'
```

**Resolution Steps:**
1. Verify Supabase Auth configuration
2. Check service role/anon key validity
3. Review redirect URLs in Supabase dashboard
4. Confirm session cookie settings

## Emergency Procedures

### 1. System Down - Critical Outage

**Immediate Actions (0-5 minutes):**
1. Verify the outage scope
2. Check Netlify deployment status
3. Review recent deployments
4. Notify stakeholders

**Short-term Actions (5-30 minutes):**
1. Rollback to last known good deployment
2. Check database connectivity
3. Verify third-party service status
4. Enable maintenance mode if needed

**Rollback Procedure:**
```bash
# Create emergency backup
node scripts/deployment/backup-rollback.js backup emergency

# List available backups
node scripts/deployment/backup-rollback.js list

# Rollback to previous stable version
node scripts/deployment/backup-rollback.js rollback backup-YYYY-MM-DD-HH-mm-ss
```

### 2. Database Issues

**Critical Database Failure:**
1. Check Supabase status page
2. Review connection limits
3. Contact Supabase support if needed
4. Implement read-only mode

**Data Corruption:**
1. Immediately create database backup
2. Identify scope of corruption
3. Restore from last known good backup
4. Verify data integrity

### 3. Security Incident

**Suspected Breach:**
1. Immediately disable affected accounts
2. Change all API keys and secrets
3. Review access logs
4. Notify security team

**Procedure:**
```bash
# Disable invitation system temporarily
# Update environment variables to disable endpoints
# Review recent invitation activity
curl https://app.meet-sam.com/api/admin/stats
```

## Maintenance Tasks

### Daily Tasks

1. **Monitor System Health**
   - Check dashboard metrics
   - Review error logs
   - Verify backup completion

2. **Review Invitation Activity**
   ```bash
   # Check daily invitation stats
   curl https://app.meet-sam.com/api/admin/stats
   ```

### Weekly Tasks

1. **Performance Review**
   - Analyze response times
   - Review error patterns
   - Check resource utilization

2. **Security Review**
   - Review access logs
   - Check for unusual activity
   - Verify certificate expiry

3. **Database Maintenance**
   ```bash
   # Check table statistics
   curl https://app.meet-sam.com/api/admin/check-schema
   ```

### Monthly Tasks

1. **Backup Management**
   ```bash
   # Cleanup old backups (keep last 30)
   node scripts/deployment/backup-rollback.js cleanup 30
   ```

2. **Performance Optimization**
   - Review slow queries
   - Update database indexes
   - Optimize API endpoints

3. **Security Updates**
   - Update dependencies
   - Rotate API keys
   - Review access permissions

## Performance Optimization

### Database Optimization

1. **Query Optimization**
   - Add indexes for frequently queried columns
   - Optimize complex joins
   - Use connection pooling

2. **RLS Policy Review**
   ```sql
   -- Check policy performance
   SELECT * FROM pg_stat_user_tables WHERE relname IN ('invitations', 'workspaces');
   ```

### API Optimization

1. **Caching Strategy**
   - Implement Redis for session data
   - Cache frequently accessed data
   - Use CDN for static assets

2. **Response Time Targets**
   - Invitation creation: < 2000ms
   - User lookup: < 500ms
   - Dashboard load: < 3000ms

### Email Optimization

1. **Delivery Optimization**
   - Monitor bounce rates
   - Implement retry logic
   - Use email templates

2. **Performance Metrics**
   - Track delivery times
   - Monitor spam rates
   - Optimize sending frequency

## Security Procedures

### Access Management

1. **API Key Rotation**
   ```bash
   # Generate new keys monthly
   # Update environment variables
   # Test all integrations
   ```

2. **User Access Review**
   - Review admin permissions
   - Audit invitation activity
   - Check for suspicious patterns

### Data Protection

1. **Encryption Verification**
   - Verify HTTPS everywhere
   - Check database encryption
   - Validate API communications

2. **Backup Security**
   - Encrypt backup files
   - Secure backup storage
   - Test restore procedures

### Incident Response

1. **Detection**
   - Monitor for unusual activity
   - Set up automated alerts
   - Review logs regularly

2. **Response Procedures**
   - Document all incidents
   - Follow escalation procedures
   - Conduct post-incident reviews

## Escalation Procedures

### Level 1 - Minor Issues
- Response time: 4 hours
- Contact: Operations team
- Examples: Minor performance issues, single user problems

### Level 2 - Major Issues
- Response time: 1 hour
- Contact: Development team + Operations
- Examples: System degradation, multiple user impacts

### Level 3 - Critical Issues
- Response time: 15 minutes
- Contact: All teams + Management
- Examples: System outage, security breach, data loss

## Contact Information

### Emergency Contacts
- Operations Team: ops@innovareai.com
- Development Team: dev@innovareai.com
- Security Team: security@innovareai.com

### Third-Party Support
- Netlify Support: https://support.netlify.com
- Supabase Support: https://supabase.com/support
- Postmark Support: https://postmarkapp.com/support

## Useful Commands

### System Status
```bash
# Quick health check
curl -s https://app.meet-sam.com/api/monitoring/health | jq '.status'

# Get current metrics
curl -s https://app.meet-sam.com/api/monitoring/metrics | jq '.invitation'

# Check alerts
curl -s https://app.meet-sam.com/api/monitoring/alerts | jq '.criticalCount'
```

### Deployment
```bash
# Deploy to staging
npm run deploy:staging

# Create backup before deployment
node scripts/deployment/backup-rollback.js backup pre-deployment

# Validate staging environment
node scripts/deployment/staging-validation.js
```

### Troubleshooting
```bash
# Check database tables
curl https://app.meet-sam.com/api/check-tables

# Test invitation system
curl -X POST https://app.meet-sam.com/api/admin/invite-user \
  -H "Content-Type: application/json" \
  -d '{"email":"test@innovareai.com","organization":"InnovareAI","test":true}'

# Check email system
node test-complete-flow.js
```

This runbook should be reviewed and updated monthly to ensure accuracy and completeness.
