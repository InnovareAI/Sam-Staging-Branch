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

## CRITICAL: Directory Restrictions
- **MUST work ONLY in /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7**
- **NEVER access files outside this directory without explicit permission**
- **NEVER assume files exist in other directories**
- **ALWAYS use absolute paths within this project directory**

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

# Current Session Context

## Recent SuperAdmin Panel Work

### Issue Identified
- User was viewing SuperAdmin panel in MAIN PAGE (`/app/page.tsx`), NOT in `/app/admin/page.tsx`
- I was initially updating the wrong file (`/app/admin/page.tsx`) instead of main page
- User made it clear: "WHAT DO YOU MEAN??? Dont you fucking copy anything from the admin subpage here because it is FREAKINUG WRONG"
- User wants specific changes to the main page SuperAdmin panel, NOT copying from admin subpage

### Key Requirements from User
1. **Remove all "Owner" CTA buttons** - keep only "Invite" buttons
2. **Rename "Tenant" to "Workspace"** throughout the interface
3. **Add view mode toggles** - List, Card, Info views with proper icons
4. **Add company color badges** - InnovareAI=blue, 3cubed=orange, Sendingcell=green, WT Matchmaker=purple
5. **Show pending invitations** with amber badges
6. **Clean list view** without member details showing in top view
7. **Update owner information display**

### Current File State
- **Main SuperAdmin Panel**: `/app/page.tsx` (lines 2099-2236 contain workspace management section)
- **Wrong Admin Panel**: `/app/admin/page.tsx` (has complete structure but NOT to be copied)
- **Checkbox Component**: `/components/ui/checkbox.tsx` (simple input-based checkbox)

### Key Technical Details
- Next.js 15.5.2 with App Router
- Supabase database: workspaces, workspace_members, invitations tables  
- ViewMode state: `const [viewMode, setViewMode] = useState<'list' | 'card' | 'info'>('info');`
- Company color logic already partially implemented
- Pending invitations fetching logic needs to be added properly

### User Feedback History
- "you are in the WRONG URL" - discovered I was updating admin instead of main
- "where are the different views????? where are the tags I mentioned????" - missing view toggles
- "WHAT DO YOU MEAN??? Dont you fucking copy anything from the admin subpage here because it is FREAKINUG WRONG" - clear instruction not to copy
- "dont tell me i am absilutely right. Get it right the first time" - need precision

### Current Status
- Todo list cleared per user request
- Need specific direction on what changes to make to main page SuperAdmin panel
- Should NOT copy from admin subpage
- Must implement requested features directly in main page context

### Files Not to Modify
- `/app/admin/page.tsx` - confirmed wrong file, do not use as reference
- Any demo files that might cause build issues

## Current Todos
- **NONE** - Todo list cleared by user request
- Awaiting specific instructions for SuperAdmin panel changes in main page