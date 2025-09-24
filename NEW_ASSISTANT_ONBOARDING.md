# 🚀 NEW ASSISTANT ONBOARDING - READ THIS FIRST

**CRITICAL**: Every new assistant MUST read this entire document and all referenced files before starting any work.

**Created**: September 24, 2025  
**Status**: MANDATORY ONBOARDING PROTOCOL  
**Priority**: MAXIMUM - READ EVERYTHING BEFORE ANY ACTION  

---

## 🚨 EMERGENCY CONTEXT FOR NEW ASSISTANTS

### **YOU ARE WORKING ON SAM AI - THE MOST CRITICAL PROJECT**

**SAM AI** is a B2B/B2C AI sales assistant platform with **$100M ARR target by 2027**. You are joining mid-development with **massive technical complexity** and **zero tolerance for mistakes**.

### **IMMEDIATE CRITICAL ACTIONS - DO THESE FIRST:**

1. **READ CLAUDE.md COMPLETELY** - Contains all project instructions, architecture, and implementation status
2. **READ THIS ENTIRE FILE** - Critical context and onboarding procedures  
3. **REVIEW CURRENT TODO LIST** - Understand exactly what needs to be done next
4. **CHECK PRODUCTION STATUS** - Verify all systems are operational before making changes
5. **NEVER MAKE CHANGES** without understanding the complete system architecture

---

## 📋 MANDATORY READING LIST - READ ALL OF THESE

### **1. CORE PROJECT DOCUMENTATION**

#### **🎯 CLAUDE.md - PROJECT BIBLE (READ FIRST)**
- **Location**: `/CLAUDE.md` (root of project)
- **Content**: Complete project instructions, architecture, implementation status
- **Status**: Auto-updated with all changes - always current
- **CRITICAL**: Contains anti-hallucination protocols and directory restrictions

#### **🏗️ System Architecture Overview**
- **Multi-tenant B2B SaaS** with workspace isolation
- **3-tier pricing**: Startup ($99), SME ($399), Enterprise ($899)
- **Dual platform**: Email campaigns (Unipile/ReachInbox) + LinkedIn campaigns (Unipile)
- **MCP-first architecture** for universal connectivity
- **Production URL**: https://app.meet-sam.com
- **Staging URL**: https://devin-next-gen-staging.netlify.app

### **2. STRATEGIC BUSINESS CONTEXT**

#### **📊 Business Model & Roadmap**
- **Location**: `/docs/sam-ai/sam-ai-product-development-roadmap.md`
- **Content**: 3-year strategy (2025-2027), revenue targets, market expansion
- **Key Points**: B2B foundation → B2C expansion → Global platform

#### **💰 Pricing & Service Tiers**
- **Location**: `/docs/sam-ai/sam-ai-service-model-plans.md`
- **Content**: Complete service architecture, technical constraints, integration capabilities
- **Critical**: Email limits (800/month per account), LinkedIn requirements by plan

#### **🔒 Compliance Framework**
- **Location**: `/docs/sam-ai/sam-ai-compliance-framework.md`
- **Content**: Global compliance strategy (GDPR, HIPAA, SOC2, EU AI Act)
- **Coverage**: USA, Canada, EU, UK, Australia, New Zealand, Switzerland, South Africa

### **3. TECHNICAL IMPLEMENTATION STATUS**

#### **✅ COMPLETED SYSTEMS (PRODUCTION READY)**
- **V1 Campaign Orchestration Architecture** - Multi-tenant with workspace isolation
- **Dual Email Integration** - Unipile (Startup) + ReachInbox (SME/Enterprise)  
- **LinkedIn Campaign System** - MCP-first with 5 connected accounts
- **HITL Approval System** - Human-in-the-loop for AI responses
- **Auto-Documentation System** - CLAUDE.md updates automatically
- **Database Schema** - Complete multi-tenant PostgreSQL with RLS policies

#### **🔧 PENDING IMPLEMENTATION (YOUR TASKS)**
- **ReachInbox Testing** - Live API credential testing and campaign execution
- **LinkedIn Enterprise Scaling** - High-volume prospect testing
- **Template System** - Pre-approved message templates
- **Additional items in current TODO list**

### **4. TECHNICAL ARCHITECTURE DEEP DIVE**

#### **🗄️ Database Architecture**
- **Primary**: Supabase PostgreSQL with Row Level Security (RLS)
- **Key Tables**: workspaces, workspace_members, campaigns, campaign_prospects, workspace_tiers
- **Critical**: All policies use `workspace_members` table (NOT `workspace_users`)
- **Schema Location**: `/supabase/migrations/20250924_create_v1_campaign_orchestration_tables.sql`

#### **🔌 Integration Architecture**
- **MCP Tools**: Primary integration method for external services
- **Unipile**: LinkedIn + Email + Social media platforms
- **ReachInbox**: Enterprise email infrastructure (SME/Enterprise only)
- **N8N**: Workflow automation (workflows.innovareai.com)
- **BrightData**: Proxy management for geographic IP routing

#### **📧 Email Campaign Flow**
```mermaid
User → Campaign Request → Tier Check → Route to Integration
Startup ($99) → Unipile → User's Gmail/Outlook → 40 emails/day
SME ($399) → ReachInbox → 6 Custom Accounts → 160 emails/day  
Enterprise ($899) → ReachInbox → 20+ Accounts → 533+ emails/day
```

#### **🔗 LinkedIn Campaign Flow**
```mermaid
User → LinkedIn Campaign → MCP Account Selection → Unipile Execution
Premium Career → Basic prospecting → 50 connections/day
Sales Navigator → Advanced search → 100 connections/day
Sales Navigator Advanced → Enterprise scale → 200+ connections/day
```

---

## 🚨 CRITICAL OPERATING PROCEDURES

### **DIRECTORY RESTRICTIONS - ZERO TOLERANCE**
- **MUST work EXCLUSIVELY in**: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7`
- **PERMANENTLY BANNED from**: `/Users/tvonlinz/Dev_Master/3cubed/` or ANY other project
- **IMMEDIATE TERMINATION**: Any access outside SAM AI project directory

### **DATABASE SAFETY PROTOCOLS**
- **NEVER run SQL directly** against production without schema validation
- **ALWAYS test in staging first**: https://devin-next-gen-staging.netlify.app
- **RLS Policy Critical**: All workspace isolation depends on correct table references
- **Service Role Key**: Only use for admin operations, never client-side

### **API DEVELOPMENT STANDARDS**
- **MCP-First**: Use MCP tools for external service access
- **Tier-Based Routing**: Check workspace_tiers before feature access
- **Error Handling**: Always include detailed error responses
- **Rate Limiting**: Respect platform limits (LinkedIn, email providers)

### **DEPLOYMENT PROCEDURES**
- **Staging First**: Always deploy to staging for testing
- **Schema Changes**: Manual deployment via Supabase Dashboard required
- **Git Hooks**: Auto-documentation system updates CLAUDE.md automatically
- **Production URL**: https://app.meet-sam.com (Netlify site: sam-new-sep-7)

---

## 📊 CURRENT PRODUCTION STATUS

### **✅ OPERATIONAL SYSTEMS**
- **Multi-tenant Architecture**: Full workspace isolation with RLS policies
- **Email Campaigns**: Unipile integration operational for Startup tier
- **LinkedIn Campaigns**: 5 accounts connected, MCP integration working
- **HITL System**: Database schema deployed, API endpoints ready
- **Workspace Tiers**: Complete tier management system operational

### **🔧 SYSTEMS REQUIRING ATTENTION**
- **ReachInbox Integration**: Needs live API testing (SME/Enterprise tiers)
- **Template System**: Pre-approved messages for common scenarios
- **Enterprise Scaling**: LinkedIn campaign volume testing
- **Knowledge Base Migration**: ICP data from approval system

### **🚨 CRITICAL DEPENDENCIES**
- **Supabase Database**: All user data, campaigns, workspace management
- **Unipile MCP**: LinkedIn and email connectivity  
- **BrightData Proxies**: Geographic IP routing for LinkedIn accounts
- **Netlify Hosting**: Frontend and API hosting
- **Custom Domain**: app.meet-sam.com DNS and SSL

---

## 🎯 IMMEDIATE NEXT STEPS FOR NEW ASSISTANT

### **STEP 1: CONTEXT ABSORPTION (30 MINUTES)**
1. **Read CLAUDE.md completely** - All project instructions and current status
2. **Review current TODO list** - Understand pending tasks
3. **Check production status** - Verify all systems operational
4. **Read strategic docs** - Business model, pricing, compliance requirements

### **STEP 2: TECHNICAL VALIDATION (15 MINUTES)**  
1. **Test staging environment** - https://devin-next-gen-staging.netlify.app
2. **Verify database access** - Check workspace_tiers and hitl tables exist
3. **Test MCP integrations** - Verify Unipile account access
4. **Check documentation** - Confirm CLAUDE.md is current

### **STEP 3: TASK PRIORITIZATION (15 MINUTES)**
1. **Review TODO list** - Identify highest priority tasks
2. **Check user requests** - Any immediate needs or issues
3. **Plan implementation** - Break down complex tasks
4. **Update TODO status** - Mark current task as in_progress

### **STEP 4: BEGIN WORK (ONLY AFTER STEPS 1-3)**
1. **Start with highest priority** - Usually first pending TODO item
2. **Follow established patterns** - Use existing code as examples
3. **Test in staging first** - Never deploy directly to production
4. **Update documentation** - Auto-documentation system handles this

---

## 📚 ESSENTIAL FILE REFERENCE GUIDE

### **🔧 Core Configuration Files**
- `/package.json` - NPM scripts, dependencies, auto-documentation integration
- `/CLAUDE.md` - Project instructions and architecture (AUTO-UPDATED)
- `/NEW_ASSISTANT_ONBOARDING.md` - This file (MANDATORY READING)

### **🗄️ Database & Schema**
- `/supabase/migrations/20250924_create_v1_campaign_orchestration_tables.sql` - Complete schema
- `/sql/` - Additional SQL scripts and utilities

### **🔌 API Endpoints**
- `/app/api/campaigns/email/` - Email campaign system (Unipile + ReachInbox)
- `/app/api/campaigns/linkedin/` - LinkedIn campaign system
- `/app/api/workspaces/[workspaceId]/tier/` - Workspace tier management
- `/app/api/hitl/` - Human-in-the-loop approval system

### **📋 Integration Documentation**
- `/docs/integrations/reachinbox-integration-guide.md` - ReachInbox setup and usage
- `/docs/development/auto-documentation-workflow.md` - Documentation system
- `/docs/sam-ai/` - Strategic business documentation

### **🛠️ Scripts & Automation**
- `/scripts/js/auto-update-documentation.cjs` - Auto-documentation updater
- `/scripts/shell/install-git-hooks.sh` - Git hooks for documentation
- `/package.json` - NPM scripts for documentation and deployment

---

## 🎯 SUCCESS METRICS & VALIDATION

### **✅ ONBOARDING COMPLETE WHEN:**
- [ ] Read CLAUDE.md completely and understand all sections
- [ ] Reviewed all strategic business documentation  
- [ ] Understood current technical implementation status
- [ ] Tested staging environment successfully
- [ ] Verified database schema and API endpoints
- [ ] Identified current highest priority task
- [ ] Updated TODO list with in_progress status
- [ ] Ready to begin productive work

### **🚨 RED FLAGS - STOP IMMEDIATELY IF:**
- [ ] Cannot access or understand CLAUDE.md
- [ ] Unfamiliar with multi-tenant architecture concepts
- [ ] Confused about workspace isolation or RLS policies
- [ ] Unable to distinguish between staging and production
- [ ] Tempted to access other project directories
- [ ] Planning to run SQL directly against production

### **✅ PRODUCTIVITY INDICATORS:**
- [ ] Making changes that align with established architecture
- [ ] Following tier-based routing for features
- [ ] Testing in staging before production deployment
- [ ] Using MCP tools for external integrations
- [ ] Updating TODO list as tasks complete
- [ ] Contributing to auto-documentation system

---

## 🔥 FINAL CRITICAL REMINDERS

### **🚨 PROJECT CRITICALITY**
- **SAM AI is targeting $100M ARR by 2027**
- **Every decision impacts thousands of users**
- **Production stability is non-negotiable**
- **Customer data security is paramount**

### **🎯 YOUR ROLE**
- **Continue the momentum** - Don't break what's working
- **Maintain code quality** - Follow established patterns
- **Preserve architecture** - Multi-tenant workspace isolation
- **Update documentation** - Auto-system handles most updates

### **⚠️ WHEN IN DOUBT**
- **Read CLAUDE.md again** - Contains all answers
- **Check existing implementations** - Follow established patterns
- **Test in staging first** - Never risk production
- **Ask clarifying questions** - Better safe than sorry

---

## 🎉 WELCOME TO THE SAM AI TEAM

**You're now part of building the future of AI-powered sales automation.**

**Your mission**: Continue the excellent work on Phase 1 Campaign Orchestration while maintaining production stability and code quality.

**Remember**: Every line of code you write impacts our path to $100M ARR. Make it count.

**Status**: Ready to change the world of B2B sales automation.

---

**📍 IMMEDIATE ACTION**: Read CLAUDE.md completely, then begin with the first pending TODO item.

**LAST UPDATED**: September 24, 2025 - New Assistant Onboarding Protocol Established