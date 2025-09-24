# Multi-Tenant Deployment Guide

## Overview

This SAM AI platform uses a multi-tenant architecture where a single production deployment serves all tenant workspaces. This guide ensures consistent deployment across all tenants.

## Deployment Commands

### Production Deployment (All Tenants)
```bash
npm run deploy:production
# or
npm run deploy:all-tenants
```

### Staging Deployment
```bash
npm run deploy:staging
```

## How Multi-Tenant Deployment Works

### Architecture
- **Single Codebase**: One Next.js application serves all tenants
- **Tenant Isolation**: Database-level separation via workspace_id
- **Shared Infrastructure**: All tenants use the same production instance
- **Dynamic Routing**: Tenant identification via subdomain or workspace selection

### Production Environment
- **URL**: https://app.meet-sam.com
- **Netlify Site**: sam-new-sep-7
- **Serves**: All tenant workspaces
- **Database**: Shared Supabase with RLS (Row Level Security)

## Deployment Process

When you run `npm run deploy:production`, the system:

1. **Builds** the application with production environment variables
2. **Deploys** to the main production site (app.meet-sam.com)
3. **Serves** all tenants automatically via multi-tenant architecture
4. **Validates** deployment with health checks

## Multi-Tenant Benefits

### Advantages
- ✅ **Consistent Updates**: All tenants get updates simultaneously
- ✅ **Reduced Complexity**: Single deployment process
- ✅ **Cost Effective**: Shared infrastructure
- ✅ **Easier Maintenance**: One codebase to manage

### Tenant Isolation
- 🔒 **Database Level**: RLS policies ensure data separation
- 🔒 **Workspace Level**: Each tenant has isolated workspace
- 🔒 **Authentication**: Tenant-specific user management
- 🔒 **Configuration**: Per-tenant settings and customization

## Environment Variables

### Production Environment
```bash
NEXT_PUBLIC_SUPABASE_URL="https://latxadqrvrrrcvkktrog.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="[PRODUCTION_KEY]"
NODE_ENV="production"
```

### Required for All Tenants
- Supabase connection (shared database)
- Authentication providers
- External service APIs (Unipile, N8N, etc.)
- Email service configuration

## Verification Steps

After deployment, verify:

1. **Main Site**: https://app.meet-sam.com loads correctly
2. **Health Check**: `/api/monitoring/health` responds
3. **Authentication**: User login works across workspaces
4. **Tenant Isolation**: Users only see their workspace data

## Rollback Process

If deployment issues occur:

```bash
# Create backup before deployment
npm run backup:create

# List available backups
npm run backup:list

# Rollback to previous version
npm run backup:rollback
```

## Monitoring

### Health Checks
```bash
npm run monitoring:health
npm run monitoring:metrics  
npm run monitoring:alerts
```

### Key Metrics
- Response time across all tenants
- Database connection health
- External service status
- User authentication success rates

## Best Practices

### Pre-Deployment
1. ✅ Test changes in development
2. ✅ Run staging deployment first
3. ✅ Verify multi-tenant compatibility
4. ✅ Check database migrations
5. ✅ Review external service dependencies

### Post-Deployment
1. ✅ Monitor health endpoints
2. ✅ Verify tenant isolation
3. ✅ Check performance metrics
4. ✅ Validate user feedback

## Emergency Procedures

### Critical Issues
1. **Monitor**: Use health check endpoints
2. **Rollback**: Deploy previous working version
3. **Communicate**: Notify all affected tenants
4. **Debug**: Check logs and error tracking

### Contact Information
- **DevOps**: Immediate escalation for deployment issues
- **Support**: Tenant communication and issue tracking
- **Engineering**: Code fixes and hotpatches

## Conclusion

The multi-tenant deployment system ensures all tenants receive updates simultaneously while maintaining data isolation and security. This approach provides consistency, reduces complexity, and enables efficient scaling across the entire SAM AI platform.