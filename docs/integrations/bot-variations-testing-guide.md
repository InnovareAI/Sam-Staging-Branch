# Bot Variations Testing Guide

## Overview

This guide provides comprehensive testing procedures for the 4 MCP lead generation bot variations. Each bot has been built to handle specific aspects of the lead generation and campaign building process.

## Testing Environment

**Base URL**: `http://localhost:3003/api/leads/mcp-orchestrator`
**Authentication**: Required (Supabase user session)
**Method**: POST

## Bot Variation 1: Lead Finder Bot

### Purpose
Multi-source prospect discovery with intelligent scoring and ranking.

### Test Case 1: Basic Prospect Search
```json
{
  "bot_type": "lead_finder",
  "search_criteria": {
    "target_titles": ["VP Engineering", "CTO", "Head of Engineering"],
    "target_industries": ["SaaS", "Enterprise Software"],
    "target_locations": ["San Francisco", "New York", "Austin"],
    "keywords": "AI machine learning"
  },
  "data_sources": {
    "use_brightdata": true,
    "use_unipile_linkedin": false
  },
  "output_preferences": {
    "max_prospects": 25,
    "require_email": true,
    "quality_threshold": 0.8
  }
}
```

**Expected Output**:
- Scored prospect list (0.8+ confidence)
- Email addresses included
- Brightdata source attribution
- Outreach recommendations per prospect

### Test Case 2: LinkedIn + Brightdata Combined
```json
{
  "bot_type": "lead_finder", 
  "search_criteria": {
    "target_titles": ["Product Manager", "Head of Product"],
    "target_industries": ["Fintech", "Healthcare Tech"],
    "company_size": "101-500"
  },
  "data_sources": {
    "use_brightdata": true,
    "use_unipile_linkedin": true,
    "prioritize_premium": true
  },
  "output_preferences": {
    "max_prospects": 50,
    "require_linkedin": true,
    "auto_import_to_campaign": "test_campaign_123"
  }
}
```

**Expected Output**:
- Mixed source results (Brightdata + Unipile)
- LinkedIn profiles included
- Premium insights (mutual connections, etc.)
- Auto-import confirmation

### Test Case 3: High-Volume Enterprise Search
```json
{
  "bot_type": "lead_finder",
  "search_criteria": {
    "target_titles": ["Director", "VP", "C-Level"],
    "target_industries": ["Technology", "Software"],
    "target_locations": ["United States"],
    "company_size": "1000+",
    "exclude_companies": ["Google", "Microsoft", "Amazon"]
  },
  "data_sources": {
    "use_brightdata": true,
    "use_enrichment": true
  },
  "output_preferences": {
    "max_prospects": 100,
    "require_email": true,
    "require_linkedin": true,
    "quality_threshold": 0.9
  }
}
```

**Expected Output**:
- High-quality prospects only (0.9+ score)
- Enterprise-level contacts
- Comprehensive enrichment data
- Detailed company intelligence

## Bot Variation 2: Intelligence Gatherer Bot

### Purpose
Deep market research and competitive intelligence gathering.

### Test Case 1: Market Analysis
```json
{
  "bot_type": "intelligence_gatherer",
  "search_criteria": {
    "target_industries": ["Artificial Intelligence", "Machine Learning"],
    "target_locations": ["Silicon Valley", "Boston", "Seattle"],
    "keywords": "enterprise AI solutions"
  },
  "conversation_context": {
    "user_request": "Analyze the enterprise AI market for B2B outreach opportunities",
    "sam_context": {
      "previous_research": ["competitor_analysis_q3"],
      "user_goals": ["increase_revenue", "expand_market_share"]
    }
  }
}
```

**Expected Output**:
- Market size analysis (~X companies match criteria)
- Key players identification
- Hiring trends (% increase in target roles)
- Competitive landscape assessment
- Industry growth signals
- Common pain points analysis
- Decision maker profiles

### Test Case 2: Competitive Intelligence
```json
{
  "bot_type": "intelligence_gatherer",
  "search_criteria": {
    "target_industries": ["CRM Software", "Sales Technology"],
    "keywords": "sales automation lead generation",
    "company_size": "51-1000"
  },
  "conversation_context": {
    "user_request": "Research competitive landscape for sales automation tools"
  }
}
```

**Expected Output**:
- Direct competitor analysis
- Market positioning insights
- Differentiation opportunities
- Customer pain points
- Buying behavior patterns
- Technology adoption trends

### Test Case 3: Industry Deep Dive
```json
{
  "bot_type": "intelligence_gatherer",
  "search_criteria": {
    "target_industries": ["Healthcare Technology", "Digital Health"],
    "target_locations": ["United States"],
    "keywords": "HIPAA compliance healthcare software"
  }
}
```

**Expected Output**:
- Regulatory landscape analysis
- Compliance requirements overview
- Market growth projections
- Key decision influences
- Budget cycle information
- Success metrics definition

## Bot Variation 3: Campaign Builder Bot

### Purpose
End-to-end campaign creation with templates and automation setup.

### Test Case 1: LinkedIn Campaign Creation
```json
{
  "bot_type": "campaign_builder",
  "search_criteria": {
    "target_titles": ["Engineering Manager", "Senior Software Engineer"],
    "target_industries": ["Startup", "Scale-up"],
    "target_locations": ["San Francisco Bay Area"]
  },
  "output_preferences": {
    "max_prospects": 150,
    "auto_import_to_campaign": "linkedin_eng_q4_2025"
  },
  "conversation_context": {
    "user_request": "Create a LinkedIn outreach campaign for engineering talent recruitment"
  }
}
```

**Expected Output**:
- Campaign structure definition
- Message template variations:
  - Connection request template
  - Follow-up message 1
  - Follow-up message 2
- Automation settings:
  - Delay configurations (3-5 days)
  - Daily send limits (50 messages)
  - Time zone optimization
- Tracking setup:
  - KPI definitions (sent, accepted, replied, meetings)
  - Success criteria (15% response rate)
- Implementation timeline (2-3 days setup)

### Test Case 2: Multi-Channel Campaign
```json
{
  "bot_type": "campaign_builder",
  "search_criteria": {
    "target_titles": ["CMO", "VP Marketing", "Marketing Director"],
    "target_industries": ["B2B SaaS", "Enterprise Software"],
    "company_size": "201-1000"
  },
  "output_preferences": {
    "require_email": true,
    "require_linkedin": true
  }
}
```

**Expected Output**:
- Multi-touch campaign design
- LinkedIn + Email coordination
- Content personalization strategy
- A/B testing framework
- Performance optimization plan

### Test Case 3: Industry-Specific Campaign
```json
{
  "bot_type": "campaign_builder",
  "search_criteria": {
    "target_titles": ["CISO", "Security Director"],
    "target_industries": ["Financial Services", "Banking"],
    "keywords": "cybersecurity compliance"
  }
}
```

**Expected Output**:
- Industry-compliant messaging
- Regulatory-aware content
- Decision maker journey mapping
- Compliance-focused value props
- Risk-mitigation messaging

## Bot Variation 4: Research Assistant Bot

### Purpose
Comprehensive market and competitive research analysis.

### Test Case 1: TAM Analysis
```json
{
  "bot_type": "research_assistant",
  "search_criteria": {
    "target_industries": ["HR Technology", "Talent Management"],
    "target_locations": ["North America", "Europe"],
    "keywords": "AI recruiting talent acquisition"
  },
  "conversation_context": {
    "user_request": "Analyze total addressable market for AI-powered recruiting solutions"
  }
}
```

**Expected Output**:
- TAM Analysis:
  - Total Addressable Market: $X.XB
  - Serviceable Market: $X.XM  
  - Target Segment Size: $X.XM
- Growth trends (AI adoption %, market expansion)
- Key challenges (talent shortage, budget constraints)
- Market dynamics analysis

### Test Case 2: Competitor Research
```json
{
  "bot_type": "research_assistant",
  "search_criteria": {
    "target_industries": ["Project Management Software"],
    "keywords": "team collaboration project tracking"
  }
}
```

**Expected Output**:
- Direct competitors with market share
- Competitive gap analysis
- Differentiation strategies
- Pricing positioning
- Feature comparison matrix
- Market opportunity assessment

### Test Case 3: Buying Signal Research
```json
{
  "bot_type": "research_assistant",
  "search_criteria": {
    "target_industries": ["Enterprise Software"],
    "target_titles": ["CTO", "VP Engineering"],
    "keywords": "digital transformation cloud migration"
  }
}
```

**Expected Output**:
- Buying signal identification:
  - Recent funding announcements
  - Leadership changes
  - Technology partnerships
  - Job posting increases
- Decision process mapping:
  - Timeline: 3-6 months
  - Stakeholders: Technical, Finance, Legal
  - Evaluation criteria: Features, Price, Support
- Strategic recommendations

## Testing Checklist

### Pre-Test Setup
- [ ] Development server running on port 3003
- [ ] Valid Supabase authentication configured
- [ ] MCP tools accessible (Unipile, Brightdata)
- [ ] Test database with sample campaigns

### Test Execution
- [ ] Test all 4 bot variations
- [ ] Verify error handling (invalid requests)
- [ ] Test authentication requirements
- [ ] Validate response structure
- [ ] Check execution times
- [ ] Monitor server logs for errors

### Success Criteria
- [ ] All bots return structured responses
- [ ] No authentication bypasses
- [ ] Proper error messages for invalid inputs
- [ ] Response times under 30 seconds
- [ ] No server crashes or timeouts
- [ ] Data source integration working
- [ ] Quality scores within expected ranges

### Performance Benchmarks
- **Response Time**: < 30 seconds per request
- **Success Rate**: > 95% for valid requests
- **Data Quality**: > 85% confidence scores
- **Error Handling**: Graceful degradation when sources fail

## Common Issues & Solutions

### Issue: "Unauthorized" Response
**Solution**: Ensure valid Supabase user session in request headers

### Issue: Empty Results
**Solution**: Adjust search criteria, lower quality threshold, or verify data source availability

### Issue: Timeout Errors  
**Solution**: Check source API rate limits, reduce max_prospects, or retry with different sources

### Issue: Poor Quality Scores
**Solution**: Enable email verification, increase enrichment, or use premium LinkedIn accounts

---

**Testing Status**: Ready for execution
**Last Updated**: 2025-09-18
**Total Test Cases**: 12 (3 per bot variation)
**Expected Duration**: 2-3 hours for comprehensive testing