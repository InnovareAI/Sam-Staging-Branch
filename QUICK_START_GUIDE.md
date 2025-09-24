# ⚡ QUICK START GUIDE - NEW ASSISTANT

**Read this in your first 5 minutes, then read everything else.**

---

## 🚨 CRITICAL FIRST ACTIONS

### **1. READ THESE FILES IMMEDIATELY (IN ORDER):**
1. **`CLAUDE.md`** ← PROJECT BIBLE - READ COMPLETELY
2. **`NEW_ASSISTANT_ONBOARDING.md`** ← DETAILED ONBOARDING  
3. **Current TODO list** ← What needs to be done next

### **2. UNDERSTAND WHERE YOU ARE:**
- **Project**: SAM AI (B2B sales automation platform)
- **Target**: $100M ARR by 2027
- **Status**: Phase 1 complete, Phase 2 in progress
- **Your role**: Continue implementation, maintain production stability

### **3. PRODUCTION CRITICAL SYSTEMS:**
- **Production**: https://app.meet-sam.com (LIVE CUSTOMERS)
- **Staging**: https://devin-next-gen-staging.netlify.app (TESTING ONLY)
- **Database**: Supabase PostgreSQL with multi-tenant isolation
- **Integrations**: Unipile MCP (LinkedIn/Email), ReachInbox (Enterprise)

---

## 🎯 CURRENT PROJECT STATUS

### **✅ COMPLETED & OPERATIONAL:**
- Multi-tenant database architecture with workspace isolation
- Dual email integration (Unipile + ReachInbox) with tier-based routing
- LinkedIn campaign system with 5 connected accounts  
- HITL approval system for AI-generated responses
- Auto-documentation system (CLAUDE.md updates automatically)

### **🔧 YOUR IMMEDIATE TASKS:**
1. **ReachInbox Testing** - Live API credentials and campaign execution
2. **LinkedIn Enterprise Scaling** - High-volume prospect testing
3. **Template System** - Pre-approved message templates

---

## 🚨 ABSOLUTE RULES - ZERO VIOLATIONS

### **DIRECTORY RESTRICTIONS:**
- **ONLY WORK IN**: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7`
- **NEVER ACCESS**: `/Users/tvonlinz/Dev_Master/3cubed/` or any other directory
- **VIOLATION = IMMEDIATE TERMINATION**

### **PRODUCTION SAFETY:**
- **ALWAYS test in staging first**: https://devin-next-gen-staging.netlify.app
- **NEVER run SQL directly** against production without validation
- **CHECK workspace_tiers** before accessing tier-specific features
- **USE MCP tools** for external service integration

### **CODE QUALITY:**
- **Follow existing patterns** - Don't reinvent the wheel
- **Maintain multi-tenant architecture** - All data must be workspace-isolated
- **Update TODO list** as you complete tasks
- **Let auto-documentation** handle CLAUDE.md updates

---

## 🔧 ESSENTIAL COMMANDS

### **Testing & Validation:**
```bash
# Test staging environment
curl https://devin-next-gen-staging.netlify.app/api/workspaces/test/tier

# Update documentation
npm run update-docs

# Deploy to staging
npm run deploy:staging

# Check production health
npm run monitoring:health
```

### **Common MCP Tools:**
```typescript
mcp__unipile__unipile_get_accounts()           // LinkedIn/Email accounts
mcp__unipile__unipile_get_recent_messages()    // Message monitoring
mcp__n8n_self_hosted__list_workflows()        // N8N workflows
```

---

## 📊 ARCHITECTURE QUICK REFERENCE

### **Tier-Based System:**
- **Startup ($99)**: Unipile email, Premium LinkedIn, 800 emails/month
- **SME ($399)**: ReachInbox + Unipile, Sales Navigator, 4,800 emails/month  
- **Enterprise ($899)**: ReachInbox Premium, Sales Nav Advanced, 16,000+ emails/month

### **Key Database Tables:**
- `workspaces` - Tenant isolation
- `workspace_members` - User access (CRITICAL: Use this, not workspace_users)
- `workspace_tiers` - Service tier management
- `campaigns` - Campaign data
- `hitl_reply_approval_sessions` - Human approval system

### **Critical APIs:**
- `/api/campaigns/email/execute` - Unipile email campaigns (Startup)
- `/api/campaigns/email/reachinbox` - ReachInbox campaigns (SME/Enterprise)
- `/api/campaigns/linkedin/execute` - LinkedIn campaigns (all tiers)
- `/api/workspaces/[id]/tier` - Tier management

---

## 🎯 SUCCESS CHECKLIST

### **First 30 Minutes:**
- [ ] Read CLAUDE.md completely
- [ ] Understand current TODO list  
- [ ] Test staging environment
- [ ] Verify database access
- [ ] Identify highest priority task

### **Ready to Work When:**
- [ ] Understand multi-tenant architecture
- [ ] Know the difference between staging and production
- [ ] Familiar with MCP integration patterns
- [ ] Can explain tier-based feature routing
- [ ] Updated TODO list with in_progress status

---

## 🚀 YOU'RE READY!

**If you understand everything above, you're ready to continue building SAM AI.**

**Next Step**: Read the detailed onboarding guide and begin with the first pending TODO item.

**Remember**: You're building the future of AI sales automation. Every decision matters.

---

**⚡ SPEED RUN**: Read CLAUDE.md → Check TODO list → Test staging → Start first pending task

**LAST UPDATED**: September 24, 2025