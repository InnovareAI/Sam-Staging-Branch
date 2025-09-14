---
card_type: "ui_specification"
layout: "component_library"
category: "card_layouts"
priority: "critical"
version: "1.0"
last_updated: "2025-09-14"
author: "sam_ai_team"
tags: ["ui", "cards", "icp", "multi_icp", "design_system"]
related_documents: ["icp-management-dashboard.md", "icp-data-structures.md"]
---

# ICP Card Design System
**Component Library for Multi-ICP Management Interface**

## Overview
This document defines the card-based visual system for displaying and managing multiple ICPs within SAM's interface. All ICP cards follow consistent design patterns while adapting content based on ICP status, performance, and user context.

---

## 1. Primary ICP Definition Card

### Compact Layout
```markdown
---
card_type: "icp_definition"
layout: "compact"
priority: "primary"
---

# 🎯 North America SaaS ICP
**Status:** 🟢 Active | **Market Size:** ~12,000 companies | **Performance:** ⭐⭐⭐⭐⭐

## Quick Stats
📈 **Response Rate:** 8.5% ↗️ | 🤝 **Meeting Rate:** 3.2% ↗️ | 💰 **Conversion:** 12% ↗️

## Key Criteria
**Industries:** SaaS, FinTech | **Size:** 100-500 employees | **Geography:** US, Canada

**Actions:** [Edit] [Clone] [Archive] [📊 View Campaigns]
```

### Detailed Layout
```markdown
---
card_type: "icp_definition"
layout: "detailed"
priority: "primary"
---

# 🎯 North America SaaS ICP
**Created:** Dec 1, 2024 | **Last Updated:** Dec 10, 2024 | **Version:** 2.1

## Status & Performance
- **Status:** 🟢 Active (3 campaigns running)
- **Market Size:** ~12,000 companies (95% confidence)
- **Overall Score:** ⭐⭐⭐⭐⭐ (4.8/5)

## Performance Metrics (30 days)
| Metric | Current | Benchmark | Trend |
|--------|---------|-----------|--------|
| Response Rate | 8.5% | 6.2% | ↗️ +37% |
| Meeting Rate | 3.2% | 2.1% | ↗️ +52% |
| Conversion Rate | 12% | 9% | ↗️ +33% |
| Avg Deal Size | $18K | $15K | ↗️ +20% |

## ICP Criteria
### Firmographics
- **Industries:** SaaS (primary), FinTech (secondary), MarTech (tertiary)
- **Company Size:** 100-500 employees, $10M-$50M revenue
- **Geography:** United States, Canada (English-speaking)
- **Stage:** Series A through Growth stage

### Technographics
- **Required:** Salesforce, HubSpot, or similar CRM
- **Preferred:** AWS/Azure cloud infrastructure
- **Tech Team:** 10+ engineers, dedicated DevOps

### Behavioral Indicators
- **Buying Signals:** Recent funding, rapid hiring, expansion announcements
- **Pain Points:** Lead generation, sales process automation, data integration
- **Decision Process:** Technical evaluation + business case, 30-60 day cycles

## Market Intelligence
- **TAM:** 45,000 companies globally
- **SAM:** 12,000 companies in target regions
- **Competition Level:** Medium (3-5 vendors typically evaluated)
- **Market Trends:** ↗️ AI adoption, ↗️ Revenue operations focus

**Actions:** [✏️ Edit Criteria] [📋 Clone ICP] [📊 Deep Analytics] [🚀 Create Campaign] [📁 Archive]
```

### Comparison Layout
```markdown
---
card_type: "icp_definition"
layout: "comparison"
comparison_context: "a_b_test"
---

# 🎯 ICP Comparison: North America vs Europe

| Criteria | 🇺🇸 North America ICP | 🇪🇺 Europe ICP |
|----------|----------------------|-----------------|
| **Status** | 🟢 Active | 🟡 Testing |
| **Market Size** | ~12K companies | ~8K companies |
| **Response Rate** | 8.5% ↗️ | 6.2% ↘️ |
| **Meeting Rate** | 3.2% | 2.8% |
| **Conversion** | 12% | 15% ↗️ |

## Key Differences
| Factor | North America | Europe |
|--------|---------------|---------|
| **Languages** | English only | Multi-language required |
| **Compliance** | CAN-SPAM, CCPA | GDPR, stricter privacy |
| **Business Culture** | Direct, fast-paced | Relationship-focused, longer cycles |
| **Competition** | High saturation | Emerging market opportunity |

**Recommendation:** 📈 Scale North America, 🧪 Optimize Europe messaging

**Actions:** [📊 Detailed Analysis] [🚀 Run A/B Test] [📋 Merge Best Practices]
```

---

## 2. Secondary ICP Cards

### Secondary ICP Compact
```markdown
---
card_type: "icp_definition"  
layout: "compact"
priority: "secondary"
---

# 🎯 Mid-Market Healthcare ICP
**Status:** 🟡 Testing | **Relationship:** Secondary to Primary SaaS ICP | **Performance:** ⭐⭐⭐⭐☆

## Quick Stats  
📈 **Response Rate:** 5.8% | 🤝 **Meeting Rate:** 2.1% | 💰 **Conversion:** 18% ↗️

## Key Criteria
**Industries:** HealthTech, MedTech | **Size:** 200-1000 employees | **Geography:** US

**Actions:** [Promote to Primary] [Refine Criteria] [Pause Testing]
```

---

## 3. Experimental ICP Cards

### Experimental ICP Testing
```markdown
---
card_type: "icp_definition"
layout: "experimental"
priority: "experimental" 
test_status: "active"
---

# 🧪 AI/ML Startups ICP (Experiment)
**Test Started:** Dec 5, 2024 | **Duration:** 30 days | **Sample Size:** 150 prospects

## Hypothesis
Early-stage AI companies need sales automation more urgently due to rapid scaling requirements.

## Test Progress
**Progress:** ████████░░ 80% complete (24/30 days)
**Prospects Contacted:** 120/150
**Statistical Significance:** 🟡 Approaching (need 20 more responses)

## Early Results vs Control (Primary SaaS ICP)
| Metric | 🧪 AI Startups | 🎯 Primary SaaS | Difference |
|--------|-----------------|------------------|------------|
| Response Rate | 12.5% | 8.5% | +47% 📈 |
| Meeting Rate | 4.8% | 3.2% | +50% 📈 |
| Deal Size | $8K | $18K | -56% 📉 |

## Key Insights
✅ **Higher engagement** - AI companies more responsive to sales automation messaging  
⚠️ **Smaller budgets** - Early stage = limited spending capacity  
✅ **Faster decisions** - Technical founders understand value proposition quickly

**Actions:** [📊 View Detailed Results] [⚡ Promote to Secondary] [❌ End Experiment] [🔄 Extend Test]
```

---

## 4. Performance Dashboard Cards

### ICP Performance Summary
```markdown
---
card_type: "icp_performance"
layout: "dashboard_summary"
time_period: "30_days"
---

# 📊 Multi-ICP Performance Dashboard
**Period:** Last 30 Days | **Updated:** 5 minutes ago

## ICP Performance Rankings
| Rank | ICP Name | Response Rate | Meeting Rate | Conversion | ROI Score |
|------|----------|---------------|--------------|-------------|-----------|
| 🥇 | North America SaaS | 8.5% | 3.2% | 12% | 4.8 ⭐ |
| 🥈 | Europe SaaS | 6.2% | 2.8% | 15% | 4.2 ⭐ |
| 🥉 | Mid-Market Healthcare | 5.8% | 2.1% | 18% | 3.9 ⭐ |
| 🧪 | AI/ML Startups | 12.5% | 4.8% | 8% | Testing... |

## Resource Allocation Recommendations
**🎯 Double Down:** North America SaaS (highest volume + performance)  
**📈 Scale Up:** AI/ML Startups (promote from experiment to secondary)  
**🔧 Optimize:** Europe SaaS (improve messaging for better response rates)  
**⏸️ Pause:** Mid-Market Healthcare (low volume, high effort)

**Actions:** [📊 Detailed Analytics] [💰 Budget Reallocation] [🎯 Campaign Optimization]
```

---

## 5. ICP Creation/Editing Cards

### ICP Creation Wizard Card
```markdown
---
card_type: "icp_creation"
layout: "wizard"
step: "1_of_5"
---

# 🎯 Create New ICP
**Step 1 of 5:** Choose Creation Method

## Creation Options

### 🆕 Fresh ICP (Full Discovery)
**Time:** 45-60 minutes | **Effort:** High | **Accuracy:** Highest
Start from scratch with complete onboarding process and company research.
[▶️ Start Fresh Discovery]

### 📋 Clone Existing ICP
**Time:** 15-20 minutes | **Effort:** Medium | **Accuracy:** High  
Copy successful ICP and modify for new market/segment.
**Available to Clone:**
- 🎯 North America SaaS ICP (4.8⭐ performance)
- 🎯 Europe SaaS ICP (4.2⭐ performance)
[📋 Select ICP to Clone]

### 🧪 Campaign-Specific Test ICP  
**Time:** 10-15 minutes | **Effort:** Low | **Accuracy:** Medium
Create focused ICP variation for A/B testing specific hypothesis.
[🧪 Create Test ICP]

**Navigation:** [◀️ Cancel] [▶️ Next: Choose Parent ICP]
```

### ICP Criteria Editing Card
```markdown
---
card_type: "icp_editing"
layout: "criteria_editor"
section: "firmographics"
---

# ✏️ Edit ICP Criteria: North America SaaS ICP

## Firmographics
### Industries *(Required)*
**Primary:** SaaS ✅  
**Secondary:** FinTech ✅, MarTech ✅  
**Tertiary:** [+ Add Industry]

**Market Size Impact:** ~12,000 companies (-15% if FinTech removed)

### Company Size *(Required)*  
**Employees:** 100-500 ✅ (Current: ~8,400 companies)
- [ ] 50-100 (+2,100 companies)
- [ ] 500-1000 (+1,800 companies)  

**Revenue:** $10M-$50M ✅
- [ ] $5M-$10M (+1,200 companies)
- [ ] $50M-$100M (+900 companies)

### Geography *(Required)*
**Primary:** United States ✅, Canada ✅  
**Excluded:** [+ Add Exclusions]

## Preview Changes
**Current Market Size:** 12,000 companies  
**With Changes:** 14,300 companies (+19%)  
**Confidence Level:** 92% → 88% (slightly lower due to broader criteria)

**Actions:** [💾 Save Changes] [🔍 Preview Prospects] [↩️ Revert] [❌ Cancel]
```

---

## 6. Prospect Validation Cards

### Prospect Validation Flow Card
```markdown
---
card_type: "prospect_validation"
layout: "validation_flow"  
validation_status: "pending"
batch_number: "2_of_5"
---

# 👤 Prospect Validation: Batch 2 of 5
**ICP:** North America SaaS ICP | **Progress:** ████████░░ 8/10 validated

## Current Prospect: Sarah Chen
**Title:** VP of Sales | **Company:** CloudTech Solutions  
**LinkedIn:** [View Profile] | **Company Size:** 280 employees

### ICP Criteria Match
| Criteria | Match | Details |
|----------|--------|---------|
| Industry | ✅ **Match** | SaaS - CRM platform |
| Size | ✅ **Match** | 280 employees, ~$25M revenue |
| Geography | ✅ **Match** | San Francisco, CA |
| Title | ✅ **Match** | VP Sales (decision maker) |
| Tech Stack | ⚠️ **Partial** | Uses Pipedrive (not Salesforce) |

**Overall Match Score:** 92/100

### Company Intelligence
- **Recent Funding:** Series B, $12M (March 2024)
- **Growth Signals:** 40% YoY growth, hiring 15 sales reps
- **Tech Hiring:** Posted 5 engineering roles this month
- **Competitive Intel:** Currently uses Outreach.io for sequences

### Recent Activity & Personalization Data
- Posted on LinkedIn about sales team scaling challenges (2 days ago)
- Company announced expansion to EU market (1 week ago)
- Attended SaaStr conference (1 month ago)

## Validation Decision
**Recommend:** ✅ **APPROVE** - Strong ICP match with clear buying signals

**Actions:** [✅ Approve] [❌ Reject] [📝 Add Notes] [🔍 Deep Research] [➡️ Next Prospect]

**Batch Progress:** [◀️ Previous] [2/5] [▶️ Next] | [📊 Batch Summary] [💾 Save & Continue Later]
```

---

## 7. Campaign Integration Cards

### Campaign Creation ICP Selection Card
```markdown
---
card_type: "campaign_icp_selection"
layout: "selection_wizard"
selection_mode: "single"
---

# 🚀 Create Campaign: Select ICP
**Step 2 of 6:** Choose Target ICP

## Available ICPs

### 🎯 Primary ICPs
**🇺🇸 North America SaaS ICP** - *Recommended*  
Performance: ⭐⭐⭐⭐⭐ | Market: ~12K companies | Response: 8.5%  
**Estimated Results:** 850 prospects → 72 responses → 27 meetings  
**Cost Estimate:** $420 research + $127 outreach = **$547 total**
[📊 Preview List] [✅ Select]

**🇪🇺 Europe SaaS ICP**  
Performance: ⭐⭐⭐⭐☆ | Market: ~8K companies | Response: 6.2%  
**Estimated Results:** 850 prospects → 53 responses → 24 meetings  
**Cost Estimate:** $420 research + $127 outreach = **$547 total**
[📊 Preview List] [✅ Select]

### 🎯 Secondary ICPs  
**🏥 Mid-Market Healthcare ICP**
Performance: ⭐⭐⭐⭐☆ | Market: ~3K companies | Response: 5.8%  
**Estimated Results:** 850 prospects → 49 responses → 18 meetings  
**Cost Estimate:** $420 research + $127 outreach = **$547 total**
[📊 Preview List] [✅ Select]

## Advanced Options

### 🧪 A/B Test Multiple ICPs
Compare 2-3 ICPs in same campaign with statistical significance tracking.
**Minimum:** 100 prospects per ICP | **Duration:** 2+ weeks
[⚗️ Setup A/B Test]

### 🔀 Hybrid ICP Campaign  
Combine criteria from multiple ICPs for broader reach.
**Methods:** Union (broader) | Intersection (narrower) | Weighted (scored)
[🔀 Create Hybrid]

**Navigation:** [◀️ Back: Campaign Goals] [▶️ Next: List Generation] [💾 Save Progress]
```

---

## 8. Performance Analytics Cards

### ICP Analytics Deep Dive Card
```markdown
---
card_type: "icp_analytics"
layout: "performance_analysis"
time_period: "90_days"
---

# 📊 Deep Analytics: North America SaaS ICP
**Period:** Last 90 Days | **Campaigns:** 8 campaigns | **Total Prospects:** 2,847

## Performance Trends
```
Response Rate Trend (90 days)
     10%│    ╭─╮
      8%│   ╱   ╰╮
      6%│  ╱     ╰╮    ╭─
      4%│ ╱       ╰╮  ╱
      2%│╱         ╰─╱
       └──────────────────
        Nov   Dec   Jan
```

## Segment Performance Analysis

### Top Performing Segments
| Segment | Response Rate | Meeting Rate | Conversion | Sample Size |
|---------|---------------|--------------|-------------|-------------|
| Boston SaaS CTOs | 12.3% | 4.8% | 18% | 247 prospects |
| Series B FinTech | 10.8% | 4.2% | 22% | 156 prospects |  
| 200-300 employee cos | 9.7% | 3.9% | 15% | 891 prospects |

### Underperforming Segments
| Segment | Response Rate | Meeting Rate | Issue | Recommendation |
|---------|---------------|--------------|--------|----------------|
| West Coast startups | 4.2% | 1.8% | High competition | Adjust messaging |
| Enterprise (500+ emp) | 3.1% | 1.2% | Wrong decision maker | Target VPs not CTOs |
| Non-tech industries | 2.8% | 0.9% | Poor fit | Remove from ICP |

## Message Performance
**Best Subject Lines:**  
1. "Quick question about [Company]'s sales ops" (11.2% open)
2. "[Mutual Connection] suggested I reach out" (10.8% open)
3. "Saw your post about [Topic]" (9.4% open)

**Best CTAs:**
1. "Worth a 15-min chat?" (8.3% response)
2. "Quick call this week?" (7.9% response)
3. "Brief conversation about [pain point]?" (7.2% response)

## Optimization Recommendations
🎯 **Double Down:** Boston SaaS CTOs segment - highest performance across all metrics  
🔧 **Optimize:** West Coast messaging - test competitor differentiation angles  
❌ **Exclude:** Enterprise 500+ employees - consistently underperforms  
📈 **Scale:** Series B FinTech companies - high conversion but small volume  

**Actions:** [🎯 Apply Optimizations] [📋 Create Focused Campaign] [📊 Export Data] [🔄 Refresh Analysis]
```

---

## Card Design System Guidelines

### Visual Hierarchy
1. **Card Title**: Clear, scannable with emoji/icon for quick recognition
2. **Status Indicators**: Color-coded status badges (🟢 Active, 🟡 Testing, 🔴 Paused)  
3. **Key Metrics**: Prominent display with trend indicators (↗️↘️)
4. **Action Buttons**: Clear CTAs with consistent styling
5. **Performance Indicators**: Star ratings, progress bars, trend charts

### Responsive Design
- **Desktop**: Full detailed cards with rich data
- **Tablet**: Condensed cards maintaining key information
- **Mobile**: Stack key metrics vertically, collapse secondary data

### Interaction Patterns  
- **Hover States**: Preview additional information
- **Quick Actions**: Single-click common actions (Edit, Clone, Archive)
- **Drill-Down**: Click titles/metrics for detailed views
- **Batch Operations**: Multi-select for bulk actions

This card design system provides a consistent, scannable interface for managing complex multi-ICP systems while maintaining visual clarity and actionable insights at every level of detail.