# Project Instructions for Claude

## Core Principles
- Do what has been asked; nothing more, nothing less
- NEVER create files unless they're absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (*.md) or README files unless explicitly requested

## CRITICAL: Anti-Hallucination Protocol

### NEVER IMPLEMENT FAKE INTEGRATIONS
- **NEVER create mock/fake implementations** of real services (APIs, databases, external services)
- **NEVER generate placeholder code** that pretends to work with real services
- **NEVER use fake data** to simulate real API responses
- **ALWAYS clearly state** when something is a design/planning document vs actual implementation
- **ALWAYS verify** that external services actually exist and work as described before implementing
- **NEVER mislead** the user into thinking a fake implementation is real

### When External Services Are Needed:
- **State clearly** what real integrations are required
- **Provide real documentation links** for actual APIs
- **Explain** what needs to be implemented vs what exists
- **Use clear placeholders** like `// TODO: Implement real [SERVICE] integration`
- **Never generate** fake API responses or mock successful calls to real services

### Examples of FORBIDDEN Practices:
❌ Creating `brave-search-mcp.ts` with fake Brave API calls
❌ Implementing mock responses that simulate real service behavior  
❌ Generating fake data that looks like real API responses
❌ Creating placeholder files that appear to be working integrations

### Required Practices:
✅ Clearly label design documents as "DESIGN ONLY"
✅ State "This requires actual [SERVICE] API integration" 
✅ Provide links to real API documentation
✅ Use obvious placeholder text like "MOCK DATA - NOT REAL"

## Restore Point System
- Use `restore-point` to create project snapshots before major changes
- Use `restore-point "description"` for custom restore point messages
- Use `list-restore-points` to view available restore points
- Restore points only work within project directories (not home directory)
- Each project maintains its own independent restore point history

## Development Workflow
- Always check for existing project structure and conventions
- Follow existing code patterns and style
- Never commit secrets or API keys
- Run lint/typecheck commands after changes when available

## 🚨 CRITICAL: ABSOLUTE DIRECTORY RESTRICTIONS 🚨

### **STRICT PROJECT BOUNDARIES - NO EXCEPTIONS**
- **MUST work ONLY in /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7**
- **ABSOLUTELY FORBIDDEN to access ANY other directory**
- **ABSOLUTELY FORBIDDEN to read from ANY other project**
- **ABSOLUTELY FORBIDDEN to write to ANY other project**
- **ABSOLUTELY FORBIDDEN to touch ANY other directory structure**
- **NO PERMISSION to access /Users/tvonlinz/Dev_Master/3cubed/ or ANY other project**
- **NO PERMISSION to navigate outside this SAM AI project directory**

### **ENFORCEMENT**
- ❌ **VIOLATION**: Accessing /Users/tvonlinz/Dev_Master/3cubed/SEO_Platform or ANY other directory
- ❌ **VIOLATION**: Reading files from other projects
- ❌ **VIOLATION**: Writing files to other projects  
- ❌ **VIOLATION**: Using cd, pwd, or any navigation outside SAM AI directory
- ❌ **VIOLATION**: Deploying from wrong directory
- ❌ **VIOLATION**: Any file operations outside /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7

### **CONSEQUENCES**
- Immediate termination of assistant session
- Complete rejection of any work performed outside boundaries
- No exceptions under any circumstances

**THIS IS ABSOLUTE - NO OTHER PROJECTS, NO OTHER DIRECTORIES, NO EXCEPTIONS**

---

# SAM AI Documentation Reference

## Strategic Planning Documents

### **Core Business Strategy**
- **`/docs/sam-ai/sam-ai-product-development-roadmap.md`** - Complete 3-year roadmap (2025-2027)
  - B2B foundation in 2025 ($10M ARR target)  
  - B2C expansion in 2026 ($25M ARR target)
  - Global platform by 2027 ($100M ARR target)
  - Technical architecture evolution
  - Team scaling from 30 to 150 people
  - Revenue projections and competitive positioning

### **Pricing & Service Models**
- **`/docs/sam-ai/sam-ai-service-model-plans.md`** - Complete service architecture
  - 3-tier pricing strategy ($99/$399/$899)
  - Technical constraints (800 emails/month per account, 5 accounts per domain)
  - LinkedIn account requirements by plan
  - Email infrastructure and domain strategies
  - Sam AI training differentiation
  - Integration capabilities and compliance frameworks

- **`/docs/sam-ai/sam-ai-complete-plans-design.md`** - Detailed plan specifications
  - Feature comparison matrix across all tiers
  - Usage allowances and overage pricing
  - Seat management and admin controls
  - Natural upgrade triggers and value progression
  - Perfect customer profiles for each plan

- **`/docs/sam-ai/sam-ai-data-packages-by-plan.md`** - Data intelligence by tier
  - Data enrichment capabilities per plan
  - Integration frameworks and technical specifications
  - Compliance packages and vertical requirements
  - Service level differentiation

### **Data & Technical Strategy**
- **`/docs/sam-ai/rag-data-storage-strategy.md`** - RAG implementation strategy
  - Maximum data retention philosophy for AI effectiveness
  - Complete data schemas for prospects, companies, websites
  - Storage architecture with cost optimization
  - Vector database implementation for semantic search
  - Tiered storage strategy (hot/warm/cold data)

### **Compliance & Legal Framework**
- **`/docs/sam-ai/sam-ai-compliance-framework.md`** - Comprehensive compliance strategy
  - **Core Regulations:** GDPR, HIPAA, SOC2, EU AI Act compliance
  - **Regional Strategies:** USA, Canada, EU, UK, Australia, New Zealand, Switzerland, South Africa
  - **Vertical Compliance:** Healthcare, Financial Services, Government, Education, Legal, Manufacturing, Pharmaceuticals
  - **Legal B2B Requirements:** Attorney-client privilege, conflict prevention, professional conduct
  - **Financial/Fintech Requirements:** FINRA, SEC, AML/KYC, MiFID II, DORA compliance
  - **B2C Privacy Framework:** CCPA, state laws, Canadian PIPEDA, international requirements
  - **B2C Social Media Opportunity:** Unipile multi-platform analysis (WhatsApp, Instagram, Twitter, Telegram, Messenger)
  - **Client domain strategy:** Legal protection through client-provided domains

## Implementation Notes

### **Key Technical Decisions**
- **MCP-based architecture** for universal connectivity
- **Unipile integration** for LinkedIn + social media platforms
- **Apify actors** for Apollo scraping (not direct API)
- **Multi-region infrastructure** for compliance (US, EU, UK, Canada, Australia)
- **Hybrid storage** (Supabase hot data + S3/R2 cold storage)

### **Critical Business Constraints**
- **Email limits:** 800 messages/month per account (weekdays only)
- **Domain limits:** 5 email accounts maximum per domain
- **LinkedIn requirements:** Premium accounts required for personalization
- **Data residency:** EU clients need EU-only infrastructure
- **HIPAA compliance:** US-only servers for healthcare PHI

### **Revenue Model Evolution**
- **2025:** B2B only - $10M ARR target
- **2026:** 50% B2B, 50% B2C - $25M ARR target  
- **2027:** 40% B2B, 35% B2C, 25% Platform/API - $100M ARR target

### **B2C Market Opportunity**
- **Creator Economy:** $104B market via Instagram, TikTok, YouTube
- **Gig Economy:** $400B+ market via cross-platform intelligence
- **Individual Professionals:** Career advancement and networking
- **Service Professionals:** Real estate, insurance, financial advisors

## File Structure

```
/docs/sam-ai/
├── sam-ai-product-development-roadmap.md    # Master 3-year strategy
├── sam-ai-compliance-framework.md           # Global compliance strategy  
├── sam-ai-service-model-plans.md            # Service architecture & pricing
├── sam-ai-complete-plans-design.md          # Detailed plan specifications
├── sam-ai-data-packages-by-plan.md          # Data intelligence tiers
└── rag-data-storage-strategy.md             # Technical data strategy
```

## Quick Reference

### **Plan Pricing**
- **Startup:** $99/month (2K contacts, basic features)
- **SME:** $399/month (10K contacts, professional features)  
- **Enterprise:** $899/month (30K contacts, complete platform)

### **Key Markets (Priority Order)**
1. **USA** (Primary market)
2. **Canada** (English-speaking expansion)
3. **UK** (Post-Brexit separate market)
4. **Australia** (Asia-Pacific entry)
5. **Switzerland** (Premium European market)
6. **EU Core** (Germany, Netherlands, Nordic)
7. **New Zealand** (Trans-Tasman extension)
8. **South Africa** (African market entry)

### **Compliance Requirements by Market**
- **USA:** State laws (CCPA), HIPAA for healthcare, FINRA for finance
- **EU:** GDPR, EU AI Act, sector-specific (MiFID II, DORA)
- **UK:** UK GDPR, FCA for financial services
- **Canada:** PIPEDA federal, Quebec Law 25 provincial

This documentation provides the complete strategic framework for building SAM AI from B2B foundation through B2C expansion to global platform leadership.

---

# MARKET INTELLIGENCE & KNOWLEDGE BASE IMPLEMENTATION STATUS

## 🚨 CRITICAL: IMPLEMENTATION VS SPECIFICATION

**STATUS:** All documents created are SPECIFICATIONS ONLY - NO technical implementation exists yet.

### What We Have:
✅ **ICP/Prospect Approval System** - FULLY IMPLEMENTED (inline chat approval with database)
✅ **Market Intelligence Hub Architecture** - Complete design docs (specifications only)  
✅ **Website Change Detection System** - N8N workflow specifications (not implemented)  
✅ **Free Data Sources Strategy** - Cost-effective collection strategy (specifications only)  
✅ **Enhanced Knowledge Base** - Multi-ICP framework design (specifications only)  
✅ **User-Provided Website Monitoring** - Onboarding flow specifications (not implemented)  
✅ **Email Digest Templates** - HTML templates for intelligence delivery (specifications only)  
✅ **SAM AI Integration Specs** - Contextual intelligence delivery design (specifications only)  

### What We NEED TO BUILD (Technical Implementation):

## 🎯 HIGH PRIORITY TECHNICAL TASKS

### 1. Database Implementation
- [ ] **Create Supabase tables for Market Intelligence**
  - `intelligence_sources` table
  - `competitor_websites` table with user-provided URLs
  - `website_monitoring_history` table
  - `market_intelligence_alerts` table
  - `user_monitoring_preferences` table

### 2. N8N Master Workflow Integration (COMPLETED ✅)
- [x] **N8N Integration Design** - Complete integration architecture with existing workflows.innovareai.com
- [x] **Database Schema** - `workspace_n8n_workflows`, `workflow_deployment_history`, `n8n_campaign_executions` tables created
- [x] **API Endpoints** - `/api/workspace/n8n-workflow/`, `/api/campaign/execute-n8n/`, `/api/campaign/n8n-status-update/` 
- [x] **Automatic Workspace Deployment** - System for deploying master workflow template to each new workspace
- [x] **Workspace Variations** - Support for email-only, LinkedIn-only, both channels with custom messaging/reply handling
- [ ] **Deploy to Production** - Implement actual N8N API calls to workflows.innovareai.com

### 3. HITL Reply Agent System (COMPLETED ✅)
- [x] **HITL System Design** - Complete Human-In-The-Loop approval system for SAM email responses
- [x] **Database Schema** - `reply_approval_sessions`, `reply_approval_decisions`, `reply_approval_templates` tables created
- [x] **Email-Based Approval** - Simple email reply system (APPROVED, CHANGES:, DO NOT SEND commands)
- [x] **Template System** - Pre-approved response templates for common scenarios
- [x] **Learning Integration** - System to improve SAM responses based on approval patterns
- [ ] **API Implementation** - Build HITL approval endpoints
- [ ] **Email Processing** - SMTP/IMAP integration for approval email processing
- [ ] **SAM Integration** - Connect SAM AI response generation to approval system

### 4. N8N Data Collection Workflows 
- [ ] **Build actual N8N workflows** (specs exist in `/docs/knowledge-base/live-monitoring/n8n-data-collection-workflows.md`)
  - Google News RSS collection workflow
  - Competitor website monitoring workflow
  - Website change detection workflow
  - Email digest generation workflow

### 3. API Endpoints Development
- [ ] **Create API routes** for intelligence system:
  - `/api/monitoring/setup` - User monitoring configuration
  - `/api/monitoring/websites/add` - Add competitor websites
  - `/api/monitoring/alerts` - Get user alerts  
  - `/api/monitoring/digest` - Generate email digests
  - `/api/intelligence/feed` - Dashboard intelligence feed

### 4. Dashboard UI Components
- [ ] **Build actual React components**:
  - Market Intelligence dashboard widget
  - Website monitoring configuration interface
  - Competitor website URL input forms
  - Intelligence alerts feed component
  - Email preference settings

### 5. Email System Implementation
- [ ] **Build email delivery system**:
  - Daily digest email generation
  - Weekly summary compilation
  - Critical alert notifications
  - Email template rendering engine
  - Unsubscribe/preference management

### 6. Website Change Detection Engine
- [ ] **Build change detection system**:
  - Content hashing algorithms
  - Website scraping with rate limiting
  - Change categorization (pricing, products, news)
  - Alert priority classification
  - User notification triggers

### 7. SAM AI Integration
- [ ] **Integrate intelligence into SAM conversations**:
  - Real-time intelligence context injection
  - Competitive intelligence prompts
  - Market opportunity suggestions
  - Update SAM's knowledge base with intelligence

---

## 📋 IMPLEMENTATION TODO TRACKING

### Database Schema Implementation
- [ ] Create `intelligence_sources` table
- [ ] Create `competitor_websites` table  
- [ ] Create `website_monitoring_history` table
- [ ] Create `market_intelligence_alerts` table
- [ ] Create `user_monitoring_preferences` table
- [ ] Add RLS policies for all intelligence tables
- [ ] Create database indexes for performance

### API Development
- [ ] Build monitoring setup API (`/api/monitoring/setup`)
- [ ] Build website addition API (`/api/monitoring/websites/add`)
- [ ] Build alerts retrieval API (`/api/monitoring/alerts`)
- [ ] Build digest generation API (`/api/monitoring/digest`)
- [ ] Build intelligence feed API (`/api/intelligence/feed`)
- [ ] Add authentication to all monitoring APIs
- [ ] Add rate limiting to prevent abuse

### Frontend Components
- [ ] Market Intelligence dashboard widget component
- [ ] Competitor website URL configuration form
- [ ] Website monitoring preferences interface  
- [ ] Intelligence alerts feed component
- [ ] Email notification preferences panel
- [ ] Mobile-responsive intelligence dashboard

### N8N Workflow Implementation
- [ ] Deploy Google News RSS workflow to N8N
- [ ] Deploy competitor website monitoring workflow
- [ ] Deploy website change detection workflow  
- [ ] Deploy email digest generation workflow
- [ ] Test all workflows with real data
- [ ] Set up workflow error handling and monitoring

### Email System
- [ ] Build email template rendering system
- [ ] Implement daily digest email generation
- [ ] Implement weekly summary compilation
- [ ] Build critical alert email notifications
- [ ] Add email preference management
- [ ] Implement unsubscribe functionality
- [ ] Test email delivery across different clients

### Testing & Quality Assurance
- [ ] Unit tests for all intelligence APIs
- [ ] Integration tests for N8N workflows
- [ ] End-to-end testing of monitoring setup flow
- [ ] Performance testing of website change detection
- [ ] Email delivery testing across providers
- [ ] Load testing for intelligence dashboard

---

## 🔧 TECHNICAL DEBT & MAINTENANCE

### Current Technical Issues
- ✅ **ICP approval system working** - Full inline chat approval with database tables
- [ ] No actual intelligence collection happening (Market Intelligence)
- [ ] No database tables for intelligence storage (Market Intelligence)
- [ ] No API endpoints for monitoring system (Market Intelligence)  
- [ ] No UI components for intelligence features (Market Intelligence dashboard)
- [ ] SAM AI has no access to competitive intelligence yet

### Performance Considerations
- [ ] Website scraping rate limits to avoid blocking
- [ ] Database query optimization for intelligence feeds
- [ ] Caching strategy for frequently accessed intelligence
- [ ] Email delivery rate limits and queuing
- [ ] N8N workflow resource management

### Security & Compliance
- [ ] Data encryption for collected intelligence
- [ ] User permission system for intelligence access
- [ ] Rate limiting on intelligence APIs
- [ ] GDPR compliance for intelligence data
- [ ] Secure storage of competitor website URLs

---

## 💡 NEXT STEPS PRIORITY ORDER

### Phase 1: Core Infrastructure (Week 1-2)
1. **URGENT: Dual Approval System** - Add Campaign Content approval to existing Prospect approval
2. **CRITICAL: N8N Master Workflow Integration** - Connect to workflows.innovareai.com SAM master workflow
3. **URGENT: ICP Migration to Knowledge Base** - Move approved ICPs from approval system to KB
4. Create Market Intelligence database tables
5. Build campaign approval, N8N integration, ICP migration, and monitoring API endpoints

### Phase 2: Data Collection (Week 2-3) 
1. Implement Google News RSS workflow
2. Build website change detection engine
3. Create competitor website monitoring

### Phase 3: User Interface (Week 3-4)
1. Build monitoring setup flow
2. Create intelligence dashboard components
3. Implement email preferences

### Phase 4: Integration & Testing (Week 4-5)
1. Integrate with SAM AI conversations
2. Build email delivery system
3. End-to-end testing and optimization

---

**⚠️ REMEMBER:** All documentation exists - now we need to BUILD the actual technical implementation. Track progress using TodoWrite tool and update this section regularly.

**📍 CURRENT FOCUS:** Database schema and API endpoints should be the immediate priority before building UI components.

---

## 🚀 RECENT IMPLEMENTATION PROGRESS (2025-09-14)

### ✅ COMPLETED: N8N Master Workflow Integration
**Files Created:**
- `/docs/knowledge-base/campaign-integration/n8n-master-workflow-integration.md` - Complete integration architecture
- `/docs/knowledge-base/campaign-integration/workspace-workflow-deployment.md` - Automatic deployment system
- `/sql/workspace-n8n-workflow-deployment-schema.sql` - Database schema (5 tables)
- `/app/api/workspace/n8n-workflow/route.ts` - Workspace workflow management API
- `/app/api/campaign/execute-n8n/route.ts` - Campaign execution API  
- `/app/api/campaign/n8n-status-update/route.ts` - Status update webhook

**Key Features Implemented:**
- ✅ Integration with existing workflows.innovareai.com N8N instance
- ✅ Per-workspace workflow deployment (not shared single workflow)
- ✅ Workspace variation support (email-only/LinkedIn-only/both)
- ✅ Dynamic configuration injection for messaging and reply handling
- ✅ Real-time campaign execution monitoring
- ✅ Complete audit trail of deployments and executions

### ✅ COMPLETED: HITL Reply Agent Approval System  
**Files Created:**
- `/docs/knowledge-base/campaign-integration/hitl-reply-agent-approval-system.md` - Complete system design
- `/sql/hitl-reply-approval-schema.sql` - Database schema (6 tables)

**Key Features Designed:**
- ✅ Email-based approval system (APPROVED, CHANGES:, DO NOT SEND commands)
- ✅ Human-in-the-loop quality control for SAM responses
- ✅ Template system for pre-approved responses
- ✅ Learning integration to improve SAM based on approval patterns
- ✅ Timeout handling and escalation workflows
- ✅ Performance tracking and analytics

**Next Steps:**
- [ ] Create HITL API endpoints (`/api/hitl/reply-approval/*`)
- [ ] Implement email processing (SMTP/IMAP integration)
- [ ] Connect SAM AI response generation to approval system
- [ ] Deploy N8N API integration to workflows.innovareai.com

---

**📍 CURRENT FOCUS:** Database schema and API endpoints should be the immediate priority before building UI components.