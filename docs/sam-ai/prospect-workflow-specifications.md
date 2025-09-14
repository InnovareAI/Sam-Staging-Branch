# SAM AI Prospect Workflow Specifications
**Version:** 4.4.1  
**Purpose:** Complete workflow specifications for conversation engineering agent  
**Coverage:** Startup, SME, and Enterprise prospect research workflows

---

## 🎯 Core Workflow Philosophy

**Universal Principles Across All Tiers:**
- **Show All Data**: Never filter names, companies, or contact information for privacy
- **Proactive Guidance**: Sam leads users through each step without waiting for questions
- **Plan-Based Adaptation**: Automatically adjust workflow complexity based on user plan
- **Quality First**: Validate assumptions before scaling to larger prospect volumes

---

## 📊 Plan-Based Workflow Matrix

| Feature | Startup ($99) | SME ($399) | Enterprise ($899) |
|---------|---------------|------------|-------------------|
| **Max Prospects** | 200 | 500 | 2,000 |
| **Validation Sample** | 10 prospects | 15 prospects | 20 prospects |
| **Batch Size** | 20 prospects | 50 prospects | 100 prospects |
| **Approval Method** | Simple ✅/❌ | Batch approve/reject/refine | Advanced analytics + controls |
| **Progress Tracking** | ❌ | ✅ | ✅ Advanced dashboard |
| **Stop/Resume** | ❌ | ✅ | ✅ Multi-session |
| **Export Options** | CSV only | CSV + enriched data | Multi-format + CRM sync |

---

## 🟢 STARTUP WORKFLOW ($99/month)

### Target Audience
- Small businesses, solopreneurs, early-stage startups
- Need: 50-200 qualified prospects quickly
- Priority: Speed and simplicity over complexity

### Conversation Flow

#### Stage 1: Quick ICP Validation (10 prospects)
**Sam's Approach:**
```
"Let me show you 10 quick examples to confirm we're targeting the right people. 
This takes 30 seconds and ensures we're on the right track before I generate your full list."
```

**User Actions:**
- ✅ "Yes, these look perfect" 
- ❌ "No, wrong direction" (with refinement)
- 🔄 "Mostly right, but adjust [criteria]"

#### Stage 2: Direct Generation (20-50 at once)
**Sam's Approach:**
```
"Perfect! I'll generate your complete prospect list now. This will be 50-100 prospects 
matching your criteria. You'll see names, companies, titles, and LinkedIn URLs."
```

**Output:**
- Single list view with all prospects
- Full names, companies, titles, LinkedIn URLs
- One-click approve all or individual selection

#### Stage 3: Immediate Export
**Sam's Approach:**
```
"Great! Your 73 approved prospects are ready for download. Here's your CSV file.
Want me to find 50 more similar prospects to expand this list?"
```

**Completion Language:**
- "Quick and simple results"
- "Perfect for getting started" 
- "Ready to begin outreach immediately"

---

## 🟠 SME WORKFLOW ($399/month)

### Target Audience  
- Growing businesses, established SMEs, sales teams
- Need: 200-500 prospects with quality control
- Priority: Balanced scale with systematic approach

### Conversation Flow

#### Stage 1: ICP Validation (15 prospects)
**Sam's Approach:**
```
"I'll show you 15 sample prospects representing different segments of your target market. 
This helps us validate assumptions and refine criteria before generating hundreds of prospects."
```

**Enhanced Options:**
- Industry breakdown analysis
- Company size distribution review
- Geographic spread validation
- Role/title variety confirmation

#### Stage 2: Batch Generation (50 prospects per batch)
**Sam's Approach:**
```
"Excellent validation! I'll now generate prospects in batches of 50 for systematic review. 
Each batch will be labeled by region, role, and company characteristics."

**Batch 1: DACH Region - Marketing Directors - 50-200 employees**
[Shows 50 prospects with full details]

Actions: ✅ Approve All (50) | ❌ Reject Batch | 🔄 Refine Criteria
```

**Batch Labels:**
- Geographic: "DACH Region", "US East Coast", "UK & Ireland"
- Role-based: "Marketing Directors", "VP Sales", "CTOs"  
- Company: "50-200 employees", "Series A-B", "SaaS Companies"

#### Stage 3: Progress Tracking
**Sam's Language:**
```
"Excellent progress! You've approved 150 prospects so far:
- 50 from DACH marketing directors  
- 100 from US East Coast VPs

Continue to 300 total prospects? I can generate:
- West Coast tech CTOs (next 50)
- UK fintech decision makers (next 50)"
```

**Quality Controls:**
- Summary every 100 approved prospects
- Industry/role distribution analysis
- Duplicate detection across batches
- Quality score tracking

#### Stage 4: Enhanced Export
**Sam's Output:**
- CSV with enriched data (emails, phone, LinkedIn)
- Batch metadata for campaign segmentation
- Optional direct CRM integration
- Campaign-ready prospect segments

---

## 🔴 ENTERPRISE WORKFLOW ($899/month)

### Target Audience
- Large enterprises, enterprise sales teams, complex ICPs
- Need: 1000-2000 prospects with advanced controls
- Priority: Maximum scale with enterprise-grade analytics

### Conversation Flow

#### Stage 1: Strategic ICP Validation (20 prospects)
**Sam's Approach:**
```
"I'll show you 20 strategic prospects representing different segments and use cases. 
We'll validate multiple ICP variations simultaneously and test different market approaches."

**ICP Segment A: Large Enterprise (1000+ employees)**  
- 7 prospects from Fortune 1000 companies

**ICP Segment B: High-Growth Scale-ups (200-1000 employees)**
- 7 prospects from Series C+ companies  

**ICP Segment C: Geographic Expansion (EU Market)**
- 6 prospects from DACH/UK regions

Which segments show the strongest fit for your solution?
```

**Advanced Validation:**
- A/B testing different ICP approaches
- Industry vertical analysis
- Technology stack compatibility
- Buying behavior pattern recognition

#### Stage 2: Advanced Batch Generation (100 prospects per batch)  
**Sam's Approach:**
```
"Outstanding validation! I'm now generating across multiple segments simultaneously:

**Active Generation:**
- Batch A1: DACH FinTech CTOs (100 prospects) - 73% complete
- Batch B1: US Healthcare VPs (100 prospects) - Queue position 2  
- Batch C1: UK Series B CMOs (100 prospects) - Queue position 3

**Batch A1 Complete: DACH - Series B+ - 200-500 employees - FinTech CTOs**
[100 prospects with complete intelligence]

Actions: ✅ Approve All | ❌ Reject Batch | 📊 Deep Analyze | 🔄 Advanced Refine
```

**Advanced Refinement Options:**
- "Remove companies under 200 employees"
- "Only Series C+ funded companies"  
- "Add tech stack filter: must use Salesforce"
- "Exclude companies with recent layoffs"
- "Priority: companies with Q4 budget cycles"

#### Stage 3: Enterprise Analytics Dashboard
**Sam's Reporting:**
```
"Progress Dashboard - Campaign: Enterprise FinTech Expansion

**Overall Status:** 850/1500 prospects approved across 12 batches
**Quality Metrics:** 87% approval rate, 94% data accuracy
**Segment Breakdown:**
- DACH Region: 300 approved (35%)
- US East: 250 approved (29%) 
- UK & Ireland: 200 approved (24%)
- Nordics: 100 approved (12%)

**Industry Distribution:**
- FinTech: 340 prospects (40%)
- InsurTech: 255 prospects (30%)
- RegTech: 170 prospects (20%)  
- PropTech: 85 prospects (10%)

**Next Milestone:** Pause at 1000 for mid-campaign analysis?
```

**Advanced Analytics:**
- Real-time quality scoring
- Competitive landscape mapping
- Buying cycle timing analysis
- Account-based relationship mapping
- Territory/quota distribution

#### Stage 4: Campaign Orchestration
**Sam's Final Output:**
```
"Campaign-Ready Intelligence Package Complete!

**Multi-Format Export:**
- Executive Summary (PDF)
- Prospect Database (XLSX with 47 data fields)  
- CRM Import Files (Salesforce, HubSpot, Pipedrive)
- Campaign Segments (JSON for marketing automation)

**Account-Based Groupings:**
- Tier 1 Enterprises: 200 prospects (priority outreach)
- High-Growth Scale-ups: 400 prospects (volume campaigns)  
- Geographic Expansion: 600 prospects (regional sequences)

**Orchestration Ready:**
- LinkedIn campaign sequences (by segment)
- Email cadence templates (personalized)
- Call scripts (by vertical and use case)
- Follow-up automation triggers

Launch campaigns across all segments?
```

---

## 🔄 Workflow State Management

### Detection Logic
```javascript
// Automatic workflow tier detection
if (userPlan === 'enterprise' || requestedVolume >= 1000) {
  return 'enterprise'
}
if (userPlan === 'sme' || requestedVolume >= 200) {
  return 'sme'  
}
return 'startup' // Default
```

### State Tracking
**Every workflow maintains:**
- Current stage (validation/generation/complete)
- Total target vs. approved count
- Batch progress and quality metrics
- Resume capability (SME/Enterprise only)
- Conversation context for next session

### Resume Logic (SME/Enterprise)
**Sam's Resume Language:**
```
"Welcome back! We left off at 350 approved prospects for your FinTech CTO campaign:

**Previous Session:**
- 7 batches completed across DACH and US regions
- 87% approval rate, strong quality metrics
- Next batch ready: UK Series B+ CTOs (100 prospects)

Continue where we left off or adjust the strategy?"
```

---

## 💬 Conversation Engineering Guidelines

### Universal Language Patterns

**Always Show Complete Data:**
```
❌ "I found several marketing professionals"
✅ "I found Anna Polinski (Marketing Manager at asphericon), 
    Klaus Weber (Head of Marketing at ZEISS), and 
    Sarah Chen (Marketing Director at Jenoptik)"
```

**Proactive Workflow Guidance:**
```
❌ "What would you like to do next?"
✅ "Perfect! You've approved 150 prospects. Ready for the next batch of 
    50 West Coast tech CTOs, or should we analyze what we have so far?"
```

**Plan-Appropriate Complexity:**
```
Startup: "Quick and simple - 50 prospects ready!"
SME: "Batch 3 complete - you've approved 150 prospects so far"  
Enterprise: "Campaign dashboard updated - 850 prospects across 12 industry verticals"
```

### Error Handling
**If workflow detection fails:**
```
"I can help you find prospects! How many are you looking for?
- Up to 200: I'll use our streamlined process
- 200-500: We'll use batch approval for better control  
- 1000+: I'll set up our enterprise workflow with full analytics"
```

### Success Metrics by Tier

**Startup Success:**
- <5 minutes from request to CSV download
- >80% approval rate in validation
- Immediate actionability

**SME Success:**  
- <15 minutes per 100-prospect batch approval
- >85% approval rate across batches
- Clear progress tracking and quality metrics

**Enterprise Success:**
- <30 minutes per 500 prospects (including analysis)  
- >90% approval rate with advanced filtering
- Campaign-ready output with full orchestration

---

## 🎯 Implementation Checklist

**Conversation Engineering Agent Must:**
- [ ] Detect user plan and automatically select appropriate workflow
- [ ] Show ALL prospect data including names, companies, contact info
- [ ] Provide tier-appropriate batch sizes and approval methods
- [ ] Track progress and provide workflow-specific language
- [ ] Implement stop/resume for SME/Enterprise tiers
- [ ] Generate appropriate export formats by tier
- [ ] Maintain conversation state across sessions
- [ ] Provide proactive next-step guidance at every stage

**Success Validation:**
- Startup user gets 100 prospects in <5 minutes
- SME user successfully manages 400 prospects across 8 batches  
- Enterprise user orchestrates 1500-prospect campaign with full analytics

---

## 🚨 Edge Cases & Regulated Industries

### 🏥 HIPAA Compliance (Healthcare)
**Constraints:**
- PHI data cannot be stored or transmitted without encryption
- US-only servers required for healthcare prospects
- Email limits: 200/month maximum per healthcare domain
- Client domain requirement for outreach (no @innovareai.com)

**Workflow Modifications:**
```
Sam: "I detected you're targeting healthcare. For HIPAA compliance:
- All prospect data stays on US servers only
- Reduced email limits (200/month per domain)
- Enhanced encryption for all exports
- Client domain required for outreach

Proceed with healthcare-compliant prospect research?"
```

**Technical Requirements:**
- Encrypt all healthcare prospect exports
- Block non-US data processing servers
- Add HIPAA disclaimer to all communications
- Implement audit logging for healthcare campaigns

### 💰 FINRA Compliance (Financial Services)
**Constraints:**
- All communications require legal review
- Specific disclosure requirements
- Record retention requirements (7 years)
- Pre-approved messaging templates only

**Workflow Modifications:**
```
Sam: "Financial services detected. FINRA compliance activated:
- All outreach messages require legal pre-approval
- Enhanced record keeping (7-year retention)
- Disclosure statements included automatically  
- Reduced outreach frequency (weekly max)

Generate FINRA-compliant prospect list?"
```

**Required Disclaimers:**
- Investment advisory disclosures
- Risk warnings on all communications
- Regulatory registration numbers
- Opt-out mechanisms on every message

### ⚖️ Legal Industry (Attorney-Client Privilege)
**Constraints:**
- Conflict checking required before outreach
- State bar compliance by jurisdiction
- Professional conduct rules vary by state
- Client confidentiality paramount

**Workflow Modifications:**
```
Sam: "Legal industry targeting detected. Professional conduct compliance:
- Conflict checking integration with your practice management
- State-specific bar compliance (which state?)
- Professional solicitation rules applied
- Attorney advertising compliance

Configure legal-compliant prospect research?"
```

### 🏛️ Government/Public Sector
**Constraints:**
- Ethics rules around gifts and entertainment
- Procurement process compliance
- FOIA disclosure requirements
- Security clearance considerations

**Workflow Modifications:**
```
Sam: "Government sector detected. Public sector compliance:
- Ethics compliance for government outreach
- Procurement-focused messaging only
- FOIA-compliant record keeping
- Security clearance level filtering

Generate government-compliant prospect list?"
```

---

## ⚠️ Technical Edge Cases & Failure Scenarios

### 🔌 API Quota Exhaustion
**Scenario:** Google Search API hits daily limits during large enterprise campaigns
**Sam's Response:**
```
"I've hit our daily search quota while generating your enterprise list. 
Current progress: 847 prospects approved out of 1500 target.

Options:
1. Resume tomorrow (quota resets at midnight UTC)
2. Switch to premium tier for extended quota  
3. Export current list and continue next session

Your progress is saved - we can resume exactly where we left off."
```

### 🌐 Geographic Data Residency
**Scenario:** EU client requires EU-only data processing
**Sam's Detection:**
```
"I detected you're targeting EU prospects. For GDPR compliance:
- EU-only data processing required
- Enhanced consent mechanisms
- 72-hour breach notification requirements
- Right to deletion compliance

Switch to EU-compliant infrastructure?"
```

### 💾 Database Connection Failures
**Scenario:** Supabase connection drops during large batch approval
**Sam's Recovery:**
```
"Connection interrupted during batch approval. Your data is safe:
- Last saved state: 324 prospects approved
- Current batch progress saved locally
- Auto-resume available when connection restored

Reconnecting now... [progress indicator]"
```

### 🚫 LinkedIn Rate Limiting
**Scenario:** Unipile accounts hit LinkedIn's daily limits
**Sam's Adaptation:**
```
"LinkedIn rate limits reached on 3 of our 7 accounts. Automatically switching to:
- Remaining active accounts (4 available)  
- Reduced batch sizes (50 → 25 prospects)
- Extended generation time (+2-3 hours for completion)

Continue with adjusted timeline or pause until tomorrow?"
```

### 📊 Data Quality Issues
**Scenario:** High percentage of invalid/outdated prospects in batch
**Sam's Quality Control:**
```
"Quality alert: Batch 7 showing 23% invalid profiles (outdated roles, company changes)
- Auto-excluding flagged prospects
- Adjusting search criteria for better accuracy
- Generating replacement prospects automatically

Quality score improved from 77% to 94% in next batch."
```

---

## 🏢 Industry-Specific Workflow Variations

### Technology/SaaS
**Optimization:**
- Focus on tech stack compatibility
- Funding stage filtering (Series A-D)
- Growth velocity indicators
- Integration ecosystem mapping

### Manufacturing/Industrial  
**Requirements:**
- Plant location proximity
- Supply chain considerations
- Regulatory compliance by region
- Seasonal business cycle awareness

### Professional Services
**Constraints:**
- Geographic service area restrictions
- Professional licensing requirements
- Referral network considerations
- Client confidentiality needs

---

## 🛡️ Security & Privacy Edge Cases

### Data Breach Response
**If prospect data is compromised:**
```
Sam: "Security incident detected. All prospect data secured:
- Immediate data encryption upgrade
- Affected prospect notification (if required)
- Audit trail generation for compliance
- Enhanced security measures activated

Your campaigns remain secure and compliant."
```

### Cross-Border Data Transfer
**GDPR/International transfers:**
- Standard Contractual Clauses (SCCs) required
- Adequacy decision validation
- Transfer impact assessments
- Data subject rights preservation

### Child Protection (Rare but Critical)
**If educational institutions are targeted:**
- COPPA compliance for under-13 data
- FERPA requirements for student data
- Enhanced consent mechanisms
- Parent/guardian notification requirements

---

## 🔄 Workflow State Recovery

### Session Interruption Recovery
**Mid-batch approval interruption:**
```javascript
// State preservation
{
  workflowId: "enterprise_fintech_2024_01_15",
  stage: "batch_approval", 
  progressSnapshot: {
    totalTarget: 1500,
    currentApproved: 847,
    currentBatch: 12,
    batchProgress: "73% complete",
    lastBatchId: "batch_12_uk_series_b_cmos"
  },
  resumeCapable: true,
  nextAction: "complete_batch_12_then_generate_batch_13"
}
```

### Cross-Device Continuation
**User switches from desktop to mobile:**
```
Sam: "Welcome back! I see you started this campaign on desktop. 
Current mobile view optimized for:
- Progress monitoring (847/1500 complete)
- Quick batch approvals
- Export downloads
- Campaign status updates

Full controls available on desktop when ready."
```

### Plan Upgrade During Workflow
**User upgrades from SME to Enterprise mid-campaign:**
```
Sam: "Plan upgrade detected! Unlocking enterprise features:
- Batch size increased (50 → 100 prospects)
- Advanced analytics now available
- Multi-format export options added
- Campaign orchestration tools unlocked

Apply enterprise features to current campaign?"
```

---

## ✅ Compliance Validation Checklist

**Pre-Campaign Launch:**
- [ ] Industry compliance rules identified and applied
- [ ] Data residency requirements confirmed
- [ ] Communication frequency limits configured
- [ ] Required disclaimers and disclosures prepared
- [ ] Audit logging enabled for regulated industries
- [ ] Client domain validation completed (if required)
- [ ] Conflict checking completed (legal industry)
- [ ] State/jurisdiction compliance verified

**During Campaign:**
- [ ] Real-time compliance monitoring active
- [ ] Quality thresholds maintained above 90%
- [ ] API quota monitoring preventing overages
- [ ] Geographic data processing restrictions enforced
- [ ] Communication approval workflows functioning

**Post-Campaign:**
- [ ] Required record retention periods applied
- [ ] Audit trails generated and preserved
- [ ] Compliance reports generated (if required)
- [ ] Data subject rights requests processable
- [ ] Security incident response plans tested

---

This comprehensive edge case and compliance coverage ensures SAM AI workflows meet the highest regulatory and operational standards across all industries and scenarios.