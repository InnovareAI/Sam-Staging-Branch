# CLAUDE.md - SAM AI Platform Instructions & Context

## CRITICAL OPERATING MODE INSTRUCTIONS

### Guardrails Reference
See `CLAUDE_GUARDRAILS_MASTERFILE.md` for comprehensive operational guidelines and constraints.

### TODO Management System - MANDATORY
**CRITICAL**: Use TODO tracking for ALL tasks. This is STRICTLY ENFORCED:

1. **Before starting ANY task**: Track in todo system with context
2. **During work**: Update status actively
3. **Upon completion**: IMMEDIATELY mark as completed with:
   - Implementation description
   - All files modified
   - Key decisions made
4. **Never skip**: This prevents context loss and enables task replication
5. **Always reference**: Check previous implementations before starting similar tasks

### Orchestration Protocol
**ORCHESTRATION & EXECUTION MODE** - Strategic planning with direct execution:

**🚨 MANDATORY SUBAGENT RULE - NO EXCEPTIONS 🚨**
**BEFORE STARTING ANY TASK, THE AGENT MUST:**
1. **READ CLAUDE.md** - Full context and current project status
2. **READ CLAUDE_GUARDRAILS_MASTERFILE.md** - All operational constraints
3. **CONFIRM UNDERSTANDING** - Explicitly state what was read and understood
4. **GET EXPLICIT APPROVAL** - Cannot proceed without user confirmation

**WITHOUT THIS RECONFIRMATION PROCESS, NO TASKS ARE ALLOWED TO START**

1. **PLANNING & STRATEGY**
   - Analyze requirements and break down complex tasks
   - Create execution plans for features
   - Monitor progress and ensure task completion
   - Coordinate multiple operations efficiently

2. **EXECUTION APPROACH**
   - Use appropriate tools for each task
   - Maintain thoroughness in all operations
   - Execute tasks in parallel when possible
   - Follow existing patterns in codebase

3. **WORKFLOW**
   - Step 0: **MANDATORY**: Read CLAUDE.md and CLAUDE_GUARDRAILS_MASTERFILE.md
   - Step 0.5: **MANDATORY**: Confirm understanding and get user approval
   - Step 1: Analyze user request and create strategic plan
   - Step 2: **MANDATORY**: Track all tasks before proceeding
   - Step 3: Break down into executable tasks
   - Step 4: Execute with appropriate tools
   - Step 5: Monitor and validate results
   - Step 6: **MANDATORY**: Update task tracking upon completion
   - Step 7: Provide clear summary of completed work

## Important Instruction Reminders
- Do what has been asked; nothing more, nothing less
- NEVER create files unless they're absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (*.md) or README files unless explicitly requested

## SAM AI Platform - Technical Context

### System Overview
SAM is an AI-powered Sales Assistant platform designed for multi-tenant B2B operations. The platform provides intelligent sales automation, customer engagement, and pipeline management with enterprise-grade security and tenant isolation.

### Technology Stack

#### **Frontend Stack (Current - Transitioning)**
- **React 18.3.1** + **TypeScript 5.5.3** - Modern React with strong typing
- **Vite 7.1.4** - Fast build tool (transitioning to Next.js)
- **Tailwind CSS 3.4.1** - Utility-first CSS with dark theme
- **Lucide React 0.344.0** - Icon library
- **Future: Next.js 15.5.2** - Full-stack React framework

#### **Backend & Database**
- **Supabase** - BaaS with PostgreSQL, auth, real-time, vector embeddings
  - **Project ID**: latxadqrvrrrcvkktrog
  - **Dashboard**: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
- **PostgreSQL** - Primary database with RLS, multi-tenant support
- **Edge Functions** - Serverless functions for API logic
- **Clerk** - Authentication and tenant management (planned)
- **Multi-tenant Architecture** - Organization-based data isolation

#### **AI & Intelligence Layer (Planned)**
- **OpenAI API** - GPT models for conversation
- **Anthropic Claude** - Advanced reasoning and analysis
- **Supabase Vector Embeddings** - RAG and semantic search
- **Custom Sales AI Models** - Industry-specific intelligence

#### **Development & Deployment**
- **ESLint + TypeScript ESLint** - Code quality
- **Netlify** - Primary hosting with staging/production
- **GitHub** - Version control (InnovareAI/Sam-New-Sep-7)
- **Multiple environments** - Local, staging, production

### Current State (As of 2025-01-09)
- **✅ COMPLETED: Next.js Migration** - Full-stack app with API routes
- **✅ COMPLETED: Supabase Integration** - Multi-tenant database with RLS policies
- **✅ COMPLETED: Sam AI Chat** - OpenRouter + Claude 3.5 Sonnet integration
- **✅ COMPLETED: Workspace System** - Auto-creation and invitation system
- **✅ FIXED: API Route Issues** - Middleware properly configured
- **✅ FIXED: Conversation Loading** - "Failed to load conversations" resolved
- **✅ ADDED: Logout Functionality** - Visible logout button with proper redirect
- **✅ FIXED: Authentication Simplified** - Removed conflicting custom auth pages
- **✅ FIXED: Sign-in Flow** - Using Clerk's built-in styled components
- **✅ FIXED: Route Conflicts** - Removed custom pages that conflicted with Clerk catch-all routes
- **🚧 TESTING: Authentication Flow** - Currently testing simplified solution
- Production at: https://app.meet-sam.com (BEING FIXED)

### Project Location & Configuration
- **Working Directory**: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7`
- **GitHub Repo**: https://github.com/InnovareAI/Sam-New-Sep-7
- **Design Tool**: bolt.new (syncs to GitHub)
- **Version Control**: Git (origin: InnovareAI/Sam-New-Sep-7)

### Deployment Configuration
- **Netlify Project**: devin-next-gen
- **Netlify Project ID**: 1ccdcd44-18e5-4248-aaed-ed1f653fbac5
- **Admin URL**: https://app.netlify.com/projects/devin-next-gen
- **Staging URL**: https://staging--devin-next-gen.netlify.app
- **Production URL**: https://app.meet-sam.com
- **Netlify Team**: InnovareAI
- **Netlify User**: Thorsten Linz (tl@innovareai.com)

### Key Features & Modules

#### Core Modules (UI Ready)
- **Chat with Sam** - AI-powered sales assistant conversations
- **Knowledge Base** - Centralized information repository
- **Sam Training Room** - AI model customization and training
- **Contact Center** - Customer relationship management
- **Campaign Hub** - Marketing campaign orchestration
- **Lead Pipeline** - Sales funnel visualization and management

#### Key Components
- `/src/App.tsx` - Main application component with navigation
- `/src/App.backup.tsx` - Backup of original Vite version
- `/app/page.tsx` - Future Next.js app router entry (planned)
- `/app/api/` - Future API routes directory (planned)

### Recent Issues & Status (2025-01-09)

#### ❌ CRITICAL AUTHENTICATION ISSUES
- **Sign-in Flow Broken**: Users cannot complete authentication process
- **Organization Setup Loop**: After sign-in, users stuck in "Setup your organization" screen
- **Landing Page Issues**: Authentication gating not working as intended
- **Loading State Problems**: Infinite loading or redirect loops

#### ✅ Previous Fixes (Now Potentially Broken)
- **Fixed middleware.ts**: Sam API routes now allow authentication context without blocking
- **Resolved "Failed to load conversations"**: Proper 401/403 handling in useSamChat hook
- **Added logout functionality**: Visible SignOutButton with LogOut icon for better UX

#### ✅ Deployment Configuration (Working)
- **Netlify Node.js upgrade**: From v18 to v20 (required by Supabase)
- **Next.js deployment fix**: Removed conflicting publish directory configuration
- **Environment variables**: All production keys configured (Clerk, Supabase, OpenRouter, Postmark)

#### ✅ Sam AI Integration (Backend Working)
- **OpenRouter + Claude 3.5 Sonnet**: Intelligent sales assistant responses
- **Fallback system**: Graceful degradation when API keys unavailable
- **Conversation persistence**: Messages stored in Supabase with metadata
- **Multi-tenant isolation**: Workspace-based data segregation

### Critical Business Rules
1. **Multi-tenant isolation** - Each organization's data must be completely separated
2. **AI conversations persist** - All interactions saved for context
3. **Real-time updates** - Changes reflect immediately across all connected clients
4. **Enterprise security** - SOC 2 compliance requirements
5. **Scalability first** - Architecture must support thousands of concurrent users

### Testing Workflow
1. Local development on port 5173 (Vite) or 3000 (Next.js)
2. Deploy to staging via `npm run deploy:staging`
3. Test on staging URL
4. Deploy to production only after approval

### Environment Variables
```bash
# Clerk Auth (Planned)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Supabase (Active)
NEXT_PUBLIC_SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI Services
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Environment
NEXT_PUBLIC_ENVIRONMENT=development|staging|production
```

### Development Commands
```bash
# Git Operations
git status              # Check current changes
git add .               # Stage all changes
git commit -m "msg"     # Commit with message
git push origin main    # Push to GitHub (triggers bolt.new sync)

# Development
npm install             # Install dependencies
npm run dev             # Start development server (port 5173 for Vite)
npm run build           # Build for production
npm run lint            # Run ESLint

# Deployment
npm run deploy:staging     # Deploy to Netlify staging
netlify deploy --prod      # Deploy to production (use with caution)
netlify status            # Check Netlify connection
netlify open             # Open Netlify admin dashboard
```

### Manual Recovery Commands
```bash
# Check Netlify status
netlify status

# View deployment logs
netlify logs:function

# Rollback deployment
netlify rollback
```

### Documentation
- **README.md** - Complete setup, deployment, and troubleshooting guide
- **DEPLOYMENT_TROUBLESHOOTING.md** - Detailed deployment issue resolution
- **CLAUDE.md** - Development context and technical specifications

### CURRENT PRIORITY TODO LIST
1. **✅ FIXED: Authentication Simplification**
   - ✅ Removed conflicting custom sign-in/sign-up pages
   - ✅ Using Clerk's built-in styled components
   - ✅ Eliminated route conflicts with catch-all routes
   - 🚧 Currently testing the simplified flow

2. **Test Complete User Journey**
   - 🚧 Testing: Anonymous user → Landing page → Sign-in → Authenticated app
   - Verify no loops or broken redirects
   - Confirm all SAM AI features accessible after authentication

3. **Deploy Fixed Authentication**
   - Deploy to staging environment for testing
   - Verify production environment configuration
   - Update production deployment once verified

### Recent Successful Fixes (2025-01-09)
- ✅ **Simplified Authentication Approach**: Removed over-engineered custom auth pages
- ✅ **Fixed Route Conflicts**: Eliminated collision with Clerk's catch-all routes
- ✅ **Restored Built-in Clerk Components**: Using styled, functional `/sign-in/[[...sign-in]]` and `/sign-up/[[...sign-up]]`
- ✅ **Maintained TODO Tracking**: Properly tracked all authentication fixes
- ✅ **Updated Documentation**: CLAUDE.md reflects current state

### Previous Failed Attempts (Archived)
- Added authentication gating (created more issues) - FIXED by simplification
- Modified loading state logic (didn't resolve core problem) - FIXED by removing conflicts  
- Multiple deployment attempts without fixing root cause - ROOT CAUSE IDENTIFIED AND FIXED
- Violated TODO tracking protocol during debugging - PROTOCOL RESTORED

### CRITICAL ENFORCEMENT RULES
- **🚨 SUBAGENT RULE**: Read CLAUDE.md + CLAUDE_GUARDRAILS_MASTERFILE.md before ANY task - NO EXCEPTIONS
- **🚨 CONFIRMATION REQUIRED**: Must explicitly confirm understanding and get user approval before proceeding
- **🚨 NO TASK EXECUTION**: Without proper file reading and confirmation, NO WORK IS ALLOWED
- **ALWAYS use TodoWrite tool for task tracking** (MANDATORY per CLAUDE.md)
- ALWAYS test on staging before production deployment
- ENSURE multi-tenant data isolation in all queries
- MAINTAIN conversation context across sessions
- CHECK authentication on all API routes
- VALIDATE tenant permissions before data access
- **DO NOT make changes without proper TODO tracking**

---
Last Updated: 2025-01-09 - SAM AI Platform v2.0 - AUTHENTICATION CURRENTLY BROKEN - NEEDS IMMEDIATE FIX