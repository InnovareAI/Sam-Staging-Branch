# SAM AI Platform - Deployment Troubleshooting Guide

This guide covers common deployment issues and their solutions for the SAM AI Platform.

## 🚨 Recent Issues Fixed (January 2025)

### ✅ "Failed to load conversations" Error
**Issue**: Users reported "Ready Error: Failed to load conversations" even when authenticated.

**Root Cause**: Middleware was blocking Sam API routes and conversation loading failed due to authentication issues.

**Solution Applied**:
1. **Updated middleware.ts** - Added Sam API routes to bypass protection while maintaining auth context:
   ```typescript
   const isSamApiRoute = createRouteMatcher([
     "/api/sam/(.*)",
   ]);
   
   // Allow Sam API routes through without forcing protection
   if (!isPublicRoute(req) && !isSamApiRoute(req)) {
     await auth.protect();
   }
   ```

2. **Fixed useSamChat.ts** - Added graceful handling for 401/403 responses:
   ```typescript
   if (response.status === 401 || response.status === 403) {
     console.log('💡 User not authenticated, skipping conversation load');
     setConversations([]);
     return;
   }
   ```

3. **Fixed import paths** in API routes from `@/lib/supabase` to relative paths.

### ✅ Netlify Deployment Configuration
**Issue**: Multiple deployment failures with different error messages.

**Solutions Applied**:
1. **Node.js version upgrade**: From v18 to v20 (required by Supabase)
2. **Publish directory configuration**: Set to `.next` to match Next.js build output
3. **Removed conflicting UI settings**: Via Netlify CLI to prevent override

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] All environment variables configured
- [ ] Local build successful: `npm run build`
- [ ] Tests passing (if applicable)
- [ ] API routes tested locally
- [ ] Database migrations applied
- [ ] No secrets in committed code

### Post-Deployment
- [ ] Site loads without errors
- [ ] Authentication working (sign-in/sign-out)
- [ ] Sam chat responding
- [ ] API endpoints accessible
- [ ] Database connections active
- [ ] Email notifications working

## 🔧 Common Issues & Solutions

### 1. Netlify Build Failures

#### "publish directory not found at: /opt/build/repo/dist"
```toml
# netlify.toml - CORRECT configuration
[build]
  command = "npm run build"  
  publish = ".next"          # Next.js build output

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

#### "Node.js version too old" / Supabase compatibility
```toml
[build.environment]
  NODE_VERSION = "20"        # Required for Supabase
```

#### "webpack cache strategy warnings"
**Non-critical** - Update browserslist if needed:
```bash
npx update-browserslist-db@latest
```

### 2. Authentication Issues

#### Users can sign in but get "Unauthorized" errors
**Check:**
1. Clerk environment variables match between development and production
2. Supabase RLS policies allow workspace access
3. API routes have proper authentication middleware

#### "Failed to load conversations" after sign-in
**Already Fixed** - See recent fixes above.

### 3. Sam AI Integration Issues

#### Sam not responding to messages
**Troubleshooting:**
1. Check OpenRouter API key is set and valid
2. Verify API credits available
3. Check Netlify function logs for errors
4. Test with fallback responses

#### API route timeouts
```javascript
// Increase timeout in netlify.toml if needed
[functions]
  "*".timeout = "30s"
```

### 4. Database Connection Issues

#### "Connection refused" errors
1. Check Supabase service status
2. Verify connection strings and keys
3. Test with Supabase SQL editor
4. Check RLS policies aren't blocking access

#### Migration failures
```bash
# Reset and reapply migrations
npm run db:reset
npm run db:push
```

## 🔍 Debugging Tools

### Netlify Dashboard
- **Build logs**: https://app.netlify.com/projects/sam-new-sep-7/deploys
- **Function logs**: Check for API route errors
- **Environment variables**: Verify all keys are set

### Browser DevTools
- **Console**: Check for JavaScript errors
- **Network**: Monitor API request/response status
- **Application Storage**: Verify authentication tokens

### Local Debugging
```bash
# Test build locally
npm run build
npm run start

# Check specific API routes  
curl -X GET http://localhost:3000/api/test-simple
curl -X GET http://localhost:3000/api/test-auth

# Monitor development console
npm run dev # Watch for errors in terminal
```

## 🌐 Environment-Specific Issues

### Production (app.meet-sam.com)
- Custom domain SSL issues → Check Netlify DNS settings
- CORS errors → Verify allowed origins in Clerk/Supabase
- Performance issues → Check Netlify Analytics

### Staging
- Environment variable mismatches
- Database connection using wrong instance
- API keys pointing to wrong services

## 📞 Emergency Procedures

### Site Down - Quick Recovery
1. **Check Netlify Status**: https://netlifystatus.com/
2. **Rollback Deployment**: 
   ```bash
   netlify rollback
   ```
3. **Force Rebuild**:
   ```bash
   git commit --allow-empty -m "Force rebuild"
   git push origin main
   ```

### Database Issues
1. **Check Supabase Dashboard** for service status
2. **Verify Connection Strings** in environment variables
3. **Test with SQL Editor** in Supabase dashboard

### Authentication Down
1. **Check Clerk Status**: https://status.clerk.com/
2. **Verify Webhook Endpoints** are accessible
3. **Test with Incognito Browser** to rule out cache issues

## 🔄 Deployment History

### Recent Deployments
- **2025-01-09**: Fixed conversation loading and Netlify config
- **2025-01-08**: Added logout functionality and middleware fixes
- **2025-01-07**: Initial API route integration and authentication

### Rollback Points
```bash
# View deployment history
netlify logs:deploy

# Rollback to specific deployment
netlify rollback --site-id 1ccdcd44-18e5-4248-aaed-ed1f653fbac5
```

## 📧 Contact & Support

For deployment issues:
1. Check this guide first
2. Review Netlify build logs
3. Test locally with same environment variables
4. Document error messages and steps to reproduce

---
*Last updated: January 2025*