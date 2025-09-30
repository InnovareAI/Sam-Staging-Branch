# 🚨 NEW ASSISTANT? READ THIS FIRST! 🚨

## **FOR NEW CLAUDE ASSISTANTS - MANDATORY ONBOARDING**

**STOP! READ THESE FILES BEFORE DOING ANYTHING:**

1. **`QUICK_START_GUIDE.md`** ← Read this first (5 minutes)
2. **`NEW_ASSISTANT_ONBOARDING.md`** ← Complete onboarding guide (30 minutes)
3. **`CLAUDE.md`** ← Project bible with all instructions and architecture

**🎯 You are working on SAM AI - $100M ARR target by 2027. Every decision matters.**

---

# SAM AI Platform

SAM is an intelligent AI-powered Sales Assistant platform built for multi-tenant B2B operations. It provides intelligent sales automation, customer engagement, and pipeline management with enterprise-grade security.

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ (required by Supabase)
- npm or yarn
- Git

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/InnovareAI/Sam-New-Sep-7.git
   cd Sam-New-Sep-7
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Copy `.env.local.example` to `.env.local` and configure:
   ```bash
   # Supabase Authentication
   NEXT_PUBLIC_SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   
   # OpenRouter AI Integration
   OPENROUTER_API_KEY=your_openrouter_api_key
   
   # Postmark Email Service
   POSTMARK_SERVER_TOKEN=your_postmark_token
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```
   Access at: http://localhost:3000

## 🏗️ Tech Stack

- **Frontend**: Next.js 15.5.2, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase PostgreSQL
- **Authentication**: Supabase Auth with multi-tenant workspaces
- **AI Integration**: OpenRouter + Claude 4.5 Sonnet
- **Email**: Postmark for invitations and notifications
- **Deployment**: Netlify with custom domain
- **Database**: Supabase with Row Level Security (RLS)

## 📦 Deployment

### Netlify Deployment

**Production URL**: https://app.meet-sam.com

#### Deploy to Netlify:
```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production (use with caution)
netlify deploy --prod
```

#### Environment Variables
Configure these in Netlify dashboard or via CLI:
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENROUTER_API_KEY`
- `POSTMARK_SERVER_TOKEN`
- `NODE_VERSION=20`

### Build Configuration

The project uses the following Netlify configuration (`netlify.toml`):
```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

## 🔧 Troubleshooting

### Common Deployment Issues

#### 1. "Failed to load conversations" Error
**Solution**: Fixed in recent deployment
- ✅ Updated middleware.ts to allow Sam API routes with auth context
- ✅ Added proper 401/403 handling in useSamChat hook
- ✅ Fixed import paths in API routes

#### 2. Netlify Build Errors
**Common errors and solutions:**

- **"publish directory not found"**: Ensure `publish = ".next"` in netlify.toml
- **"Node.js version too old"**: Set `NODE_VERSION = "20"` for Supabase compatibility  
- **"Next.js plugin failed"**: Verify @netlify/plugin-nextjs is configured

#### 3. Authentication Issues
**Signs in successfully but no data loads:**
- Check environment variables are set correctly
- Verify Supabase Auth callback URLs are configured
- Ensure Supabase RLS policies allow workspace access

#### 4. Sam AI Not Responding
**Troubleshooting steps:**
1. Check OPENROUTER_API_KEY is set
2. Verify OpenRouter account has credits
3. Check API route logs in Netlify dashboard
4. Fallback responses should appear if API fails

### Development Troubleshooting

#### Port Conflicts
If you see port 3000 in use:
```bash
# Kill processes on port 3000
pkill -f "node.*3000"

# Or run on different port
PORT=3002 npm run dev
```

#### Database Connection Issues
```bash
# Test Supabase connection
npm run test:db
```

#### Build Issues
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## 🔒 Security

- Multi-tenant data isolation via Supabase RLS
- Supabase authentication with workspace-based access control  
- API routes protected by middleware
- Environment variables for sensitive data
- HTTPS enforced on production

## 📊 Features

### Core Modules
- **Chat with Sam** - AI-powered sales conversations with Claude 4.5 Sonnet
- **Workspace Management** - Multi-tenant organization system
- **Contact Center** - CRM and customer relationship management
- **Campaign Hub** - Marketing campaign orchestration
- **Lead Pipeline** - Sales funnel visualization
- **Training Room** - AI model customization

### Recent Updates (Jan 2025)
- ✅ Fixed conversation loading errors
- ✅ Added visible logout functionality
- ✅ Improved API route authentication handling
- ✅ Resolved Netlify deployment configuration
- ✅ Upgraded to Node.js 20 for Supabase compatibility

## 🛠️ Development Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run start           # Start production server
npm run lint            # Run ESLint

# Deployment
npm run deploy:staging  # Deploy to staging
netlify deploy --prod   # Deploy to production

# Database
npm run db:push         # Push schema changes
npm run db:pull         # Pull remote changes
npm run db:generate     # Generate types

# Git Operations
git status              # Check changes
git add .              # Stage all changes  
git commit -m "msg"    # Commit with message
git push origin main   # Push to GitHub (triggers deployment)
```

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/awesome-feature`
2. Make changes and test thoroughly
3. Commit: `git commit -m 'Add awesome feature'`
4. Push: `git push origin feature/awesome-feature`
5. Open Pull Request

## 📄 License

Private - InnovareAI proprietary software

## 🔗 Links

- **Production**: https://app.meet-sam.com
- **GitHub**: https://github.com/InnovareAI/Sam-New-Sep-7
- **Netlify Dashboard**: https://app.netlify.com/projects/sam-new-sep-7
- **Supabase Dashboard**: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog

---
*Last updated: January 2025 - SAM AI Platform v2.0*# Email routing fix - added missing Postmark API keys Fri Sep 12 10:51:34 CEST 2025
# Updated 3CubedAI Postmark token Fri Sep 12 10:56:09 CEST 2025
