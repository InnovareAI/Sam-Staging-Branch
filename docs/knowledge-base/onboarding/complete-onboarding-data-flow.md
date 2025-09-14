# Complete Onboarding Data Flow & ICP Management System
Version: v1.0 | Created: 2025-09-14

## Executive Summary
This document defines the complete data flow for SAM's intelligence-driven onboarding system, including what data is captured at each stage, how it's processed and stored in the RAG/knowledge base, and the dynamic ICP management system that allows users to create and maintain **multiple ICPs** for different market segments, products, or campaigns, with automatic RAG updates.

---

## Onboarding Flow Overview

### 7-Stage Intelligence-First Process
1. **Discovery Interview** - Capture user's current situation and best customers
2. **Company Intelligence Research** - Analyze reference companies using free public data
3. **ICP Pattern Detection** - Extract patterns and build initial ICP framework
4. **Interactive ICP Refinement** - User refines ICP with real-time market sizing
5. **Competitive Intelligence** - Analyze competitive landscape and positioning
6. **Strategy Definition** - Create outreach strategy and messaging framework
7. **System Setup** - Configure integrations and launch initial campaign

---

## Stage 1: Discovery Interview Data Capture

### User Input Collection
```typescript
interface DiscoveryInterview {
  // Basic Business Context
  company_name: string
  industry_sector: string
  business_model: 'B2B' | 'B2C' | 'B2B2C' | 'marketplace' | 'saas' | 'ecommerce'
  company_size: {
    employees: number
    revenue_range: string
    funding_stage?: string
  }
  
  // Sales Organization
  sales_structure: {
    type: 'founder_led' | 'sdr_team' | 'full_sales_org' | 'channel_partners'
    team_size: number
    current_tools: string[]
    primary_bottleneck: string
  }
  
  // Reference Customers (Key Input)
  reference_companies: Array<{
    company_name: string
    domain?: string
    relationship: 'current_customer' | 'ideal_prospect' | 'lost_deal' | 'competitor_win'
    why_chosen: string
    deal_value?: number
    sales_cycle_length?: number
  }>
  
  // Current Challenges
  pain_points: Array<{
    category: 'lead_generation' | 'conversion' | 'sales_cycle' | 'pricing' | 'competition'
    description: string
    impact_level: 1 | 2 | 3 | 4 | 5
  }>
  
  // Success Metrics
  current_metrics: {
    monthly_leads?: number
    conversion_rate?: number
    average_deal_size?: number
    sales_cycle_days?: number
  }
  
  target_metrics: {
    monthly_leads_target?: number
    conversion_rate_target?: number
    deal_size_target?: number
    cycle_reduction_target?: number
  }
  
  // Metadata
  session_metadata: {
    interview_duration: number
    completion_percentage: number
    user_confidence_level: 1 | 2 | 3 | 4 | 5
    identified_gaps: string[]
  }
}
```

### Data Processing & Storage
```sql
-- Discovery interview responses
CREATE TABLE discovery_interviews (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  session_timestamp TIMESTAMPTZ DEFAULT NOW(),
  interview_data JSONB NOT NULL,
  completion_status VARCHAR(50) DEFAULT 'in_progress',
  quality_score INTEGER, -- 1-100 based on completeness
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reference companies for pattern analysis
CREATE TABLE reference_companies (
  id UUID PRIMARY KEY,
  interview_id UUID REFERENCES discovery_interviews(id),
  company_name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  relationship_type VARCHAR(50) NOT NULL,
  selection_reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Stage 2: Company Intelligence Research

### Free Public Data Collection
```typescript
interface CompanyIntelligence {
  // Basic Company Data (from public sources)
  company_profile: {
    domain: string
    official_name: string
    industry_primary: string
    industry_secondary?: string[]
    founded_year?: number
    headquarters_location: string
    company_type: 'private' | 'public' | 'nonprofit' | 'government'
  }
  
  // Size Indicators (public estimates)
  size_indicators: {
    employee_count_range: string  // "100-500", "1K-5K", etc.
    employee_count_source: 'linkedin_company' | 'about_page' | 'job_postings'
    revenue_estimate?: string
    revenue_source?: 'crunchbase' | 'press_release' | 'public_filing'
  }
  
  // Technology Stack (from job postings, tech pages)
  technology_intelligence: {
    confirmed_technologies: string[]
    likely_technologies: string[]
    tech_hiring_signals: string[]
    engineering_team_size_estimate?: number
  }
  
  // Growth Signals (public information)
  growth_indicators: {
    recent_funding?: {
      amount: string
      round_type: string
      date: string
      source: string
    }
    hiring_velocity: 'high' | 'medium' | 'low' | 'unknown'
    expansion_signals: string[]
    market_position: 'startup' | 'scale_up' | 'established' | 'enterprise'
  }
  
  // Public Content Analysis
  content_analysis: {
    primary_messaging: string[]
    value_propositions: string[]
    target_market_signals: string[]
    competitive_positioning?: string[]
  }
  
  // Data Collection Metadata
  research_metadata: {
    data_sources: string[]
    collection_timestamp: string
    confidence_scores: Record<string, number>
    research_duration_seconds: number
    cost_incurred: number  // Should be $0 for free research
  }
}
```

### Pattern Detection Analysis
```typescript
interface PatternAnalysis {
  // Industry Patterns
  industry_patterns: {
    primary_industries: Array<{
      industry: string
      company_count: number
      confidence_score: number
    }>
    secondary_industries: string[]
    industry_convergence?: string[]
  }
  
  // Size Patterns
  size_patterns: {
    employee_ranges: Array<{
      range: string
      company_count: number
      percentage: number
    }>
    revenue_patterns?: Array<{
      range: string
      company_count: number
    }>
    growth_stage_distribution: Record<string, number>
  }
  
  // Geographic Patterns
  geographic_patterns: {
    primary_locations: Array<{
      location: string
      company_count: number
    }>
    geographic_spread: 'local' | 'national' | 'international'
  }
  
  // Technology Patterns
  technology_patterns: {
    common_technologies: Array<{
      technology: string
      frequency: number
      category: string
    }>
    tech_stack_similarity_score: number
  }
  
  // Business Model Patterns
  business_model_patterns: {
    revenue_models: string[]
    market_types: string[]
    customer_relationship_models: string[]
  }
}
```

---

## Stage 3: ICP Framework Generation

### Multi-ICP User Management
```typescript
interface UserICPManagement {
  user_id: string
  icps: ICPFramework[]
  icp_relationships: Array<{
    icp_id: string
    relationship_type: 'primary' | 'secondary' | 'experimental' | 'archived'
    usage_context: 'main_market' | 'expansion_market' | 'product_specific' | 'campaign_specific'
  }>
  default_icp_id?: string
  icp_switching_rules?: {
    auto_switch_conditions: string[]
    manual_approval_required: boolean
  }
}
```

### Individual ICP Structure
```typescript
interface ICPFramework {
  // ICP Identity & Management
  icp_identity: {
    icp_id: string
    user_id: string
    name: string
    description?: string
    created_from: 'onboarding' | 'campaign_split' | 'market_expansion' | 'manual_creation'
    parent_icp_id?: string  // If derived from another ICP
  }
  
  // Core ICP Definition
  icp_definition: {
    version: number
    created_from_patterns: boolean
    confidence_level: number  // 0-100
    usage_status: 'active' | 'testing' | 'paused' | 'archived'
    
    // Firmographic Criteria
    firmographics: {
      industries: Array<{
        industry: string
        priority: 'primary' | 'secondary' | 'tertiary'
        confidence: number
      }>
      
      company_sizes: Array<{
        size_range: string
        employee_min?: number
        employee_max?: number
        revenue_min?: number
        revenue_max?: number
        priority: 'primary' | 'secondary'
      }>
      
      geographies: Array<{
        region: string
        country?: string
        state?: string
        priority: 'primary' | 'secondary'
      }>
      
      company_stages: Array<{
        stage: 'startup' | 'scale_up' | 'established' | 'enterprise'
        funding_stage?: string
        priority: number
      }>
    }
    
    // Technographic Criteria
    technographics: {
      required_technologies?: string[]
      preferred_technologies?: string[]
      technology_budgets?: Array<{
        category: string
        budget_range: string
      }>
      technical_maturity: 'low' | 'medium' | 'high' | 'any'
    }
    
    // Behavioral Criteria
    behavioral_indicators: {
      buying_triggers: string[]
      decision_making_process: string
      typical_sales_cycle: string
      budget_approval_process: string
    }
    
    // Negative Criteria (exclusions)
    exclusions: {
      industries_to_avoid: string[]
      company_types_to_avoid: string[]
      geographic_exclusions: string[]
      size_exclusions?: string[]
    }
  }
  
  // Market Sizing
  market_intelligence: {
    total_addressable_market: {
      company_count_estimate: number
      confidence_level: number
      data_sources: string[]
    }
    
    serviceable_addressable_market: {
      company_count_estimate: number
      geographic_limitations: string[]
      capability_limitations: string[]
    }
    
    competitive_overlap: {
      estimated_competitor_count: number
      market_saturation_level: 'low' | 'medium' | 'high'
    }
  }
  
  // Validation Metrics
  validation_data: {
    pattern_match_score: number  // How well ICP matches reference companies
    market_size_validation: number
    feasibility_score: number
    refinement_suggestions: string[]
  }
}
```

---

## Stage 4: Interactive ICP Refinement

### User Refinement Process
```typescript
interface ICPRefinementSession {
  // Session Management
  session_info: {
    session_id: string
    started_at: string
    current_step: number
    total_steps: number
    user_engagement_score: number
  }
  
  // Refinement Actions
  refinement_actions: Array<{
    timestamp: string
    action_type: 'add_criteria' | 'remove_criteria' | 'modify_criteria' | 'adjust_priority'
    criteria_category: string
    old_value?: any
    new_value: any
    market_size_impact: {
      previous_count: number
      new_count: number
      change_percentage: number
    }
    user_reasoning?: string
  }>
  
  // Real-time Market Sizing
  market_size_tracking: Array<{
    timestamp: string
    criteria_state: ICPFramework['icp_definition']
    market_estimates: {
      total_companies: number
      primary_targets: number
      secondary_targets: number
      data_confidence: number
    }
    geographic_distribution: Record<string, number>
  }>
  
  // User Feedback
  user_feedback: {
    criteria_confidence: Record<string, number>  // User's confidence in each criteria
    market_size_satisfaction: number  // 1-5 rating
    refinement_completion_feeling: number  // 1-5 rating
    additional_considerations: string[]
  }
}
```

---

## RAG & Knowledge Base Storage Architecture

### Vector Embeddings for Semantic Search
```typescript
interface RAGStorage {
  // Company Intelligence Vectors
  company_embeddings: {
    company_id: string
    embedding_vector: number[]  // 1536-dimensional for OpenAI
    embedding_metadata: {
      company_name: string
      domain: string
      industry: string
      size_range: string
      key_attributes: string[]
    }
    created_at: string
    last_updated: string
  }
  
  // ICP Pattern Vectors (Multi-ICP Aware)
  icp_pattern_embeddings: {
    pattern_id: string
    user_id: string
    icp_ids: string[]  // Multiple ICPs can share patterns
    embedding_vector: number[]
    pattern_metadata: {
      pattern_type: 'industry' | 'size' | 'geography' | 'technology' | 'behavior'
      pattern_description: string
      success_indicators: number[]
      companies_in_pattern: string[]
      cross_icp_applicability: Record<string, number>  // ICP ID -> relevance score
    }
    performance_data?: Record<string, {  // Performance per ICP
      icp_id: string
      campaign_results: CampaignMetrics[]
      conversion_rates: number[]
      engagement_scores: number[]
    }>
  }
  
  // Content Embeddings (Multi-ICP Personalization)
  content_embeddings: {
    content_id: string
    content_type: 'company_description' | 'value_proposition' | 'pain_point' | 'case_study'
    embedding_vector: number[]
    content_text: string
    associated_icp_ids: string[]
    icp_specific_variants?: Record<string, {  // Content variations per ICP
      icp_id: string
      variant_text: string
      personalization_elements: string[]
      embedding_vector: number[]
    }>
    performance_metrics?: Record<string, {  // Performance per ICP
      icp_id: string
      engagement_rate: number
      conversion_rate: number
      response_rate: number
      a_b_test_results?: Array<{
        variant: string
        performance: number
        confidence_interval: [number, number]
      }>
    }>
  }
}
```

### Relational Data Storage
```sql
-- Core ICP definitions with multi-ICP support
CREATE TABLE icp_definitions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  icp_name VARCHAR(255) NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  parent_icp_id UUID REFERENCES icp_definitions(id),
  created_from VARCHAR(50) DEFAULT 'manual_creation',
  usage_status VARCHAR(20) DEFAULT 'active',
  icp_criteria JSONB NOT NULL,
  market_intelligence JSONB,
  validation_data JSONB,
  performance_summary JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  
  -- Ensure unique names per user
  UNIQUE(user_id, icp_name),
  -- Index for performance
  INDEX idx_user_active_icps (user_id, usage_status),
  INDEX idx_icp_performance (user_id, (performance_summary->>'overall_score'))
);

-- User ICP management and relationships
CREATE TABLE user_icp_management (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  default_icp_id UUID REFERENCES icp_definitions(id),
  icp_switching_preferences JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- ICP relationships and contexts
CREATE TABLE icp_relationships (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  icp_id UUID REFERENCES icp_definitions(id),
  relationship_type VARCHAR(50) NOT NULL, -- 'primary', 'secondary', 'experimental', 'archived'
  usage_context VARCHAR(50) NOT NULL, -- 'main_market', 'expansion_market', 'product_specific', 'campaign_specific'
  context_metadata JSONB,
  priority_order INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_user_icp_relationships (user_id, relationship_type),
  INDEX idx_icp_usage_context (icp_id, usage_context)
);

-- ICP modification history
CREATE TABLE icp_modifications (
  id UUID PRIMARY KEY,
  icp_id UUID REFERENCES icp_definitions(id),
  modification_type VARCHAR(50) NOT NULL,
  old_criteria JSONB,
  new_criteria JSONB,
  change_reason TEXT,
  market_size_impact JSONB,
  user_confidence_change JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Company intelligence cache
CREATE TABLE company_intelligence_cache (
  id UUID PRIMARY KEY,
  domain VARCHAR(255) UNIQUE NOT NULL,
  company_data JSONB NOT NULL,
  pattern_analysis JSONB,
  research_metadata JSONB,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  expiry_date TIMESTAMPTZ,
  
  -- Indexes for fast retrieval
  INDEX idx_company_domain (domain),
  INDEX idx_company_industry ((company_data->>'industry_primary')),
  INDEX idx_company_size ((company_data->>'employee_count_range')),
  INDEX idx_last_updated (last_updated)
);

-- ICP performance tracking
CREATE TABLE icp_performance (
  id UUID PRIMARY KEY,
  icp_id UUID REFERENCES icp_definitions(id),
  campaign_id UUID,
  performance_period VARCHAR(20) NOT NULL, -- 'weekly', 'monthly', 'quarterly'
  metrics JSONB NOT NULL,
  insights JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Multi-ICP Management System

### Common Multi-ICP Scenarios
```typescript
interface MultiICPScenarios {
  // Scenario 1: Multiple Product Lines
  product_specific_icps: {
    scenario: 'Each product targets different customer segments'
    example: {
      user_company: 'Marketing Software Company'
      icps: [
        { name: 'Email Marketing ICP', target: 'Small businesses, marketing managers' },
        { name: 'Marketing Automation ICP', target: 'Mid-market, CMOs' },
        { name: 'Analytics ICP', target: 'Enterprise, data analysts' }
      ]
    }
    management_strategy: 'Separate campaigns, shared competitive intelligence'
  }
  
  // Scenario 2: Geographic Expansion
  geographic_icps: {
    scenario: 'Same product, different geographic markets'
    example: {
      user_company: 'SaaS Platform'
      icps: [
        { name: 'North America ICP', target: 'US & Canada, English-speaking' },
        { name: 'Europe ICP', target: 'GDPR compliance, multi-language' },
        { name: 'APAC ICP', target: 'Different business culture, time zones' }
      ]
    }
    management_strategy: 'Shared base criteria, localized messaging'
  }
  
  // Scenario 3: Market Maturity Segments
  maturity_based_icps: {
    scenario: 'Different approaches for market maturity levels'
    example: {
      user_company: 'AI/ML Platform'
      icps: [
        { name: 'AI Early Adopters ICP', target: 'Tech-forward, innovation leaders' },
        { name: 'AI Mainstream ICP', target: 'Proven ROI seekers, risk-averse' },
        { name: 'AI Laggards ICP', target: 'Competitive pressure, education needed' }
      ]
    }
    management_strategy: 'Different messaging, same core product'
  }
  
  // Scenario 4: Channel-Specific ICPs
  channel_specific_icps: {
    scenario: 'Different ICPs for different sales channels'
    example: {
      user_company: 'B2B Software'
      icps: [
        { name: 'Direct Sales ICP', target: 'Enterprise, complex deals' },
        { name: 'Partner Channel ICP', target: 'Mid-market, standardized process' },
        { name: 'Self-Service ICP', target: 'SMB, low-touch, high-volume' }
      ]
    }
    management_strategy: 'Channel-optimized processes and messaging'
  }
}
```

### ICP Creation & Management Workflows
```typescript
interface ICPManagementWorkflows {
  // Creating New ICPs
  icp_creation: {
    // From scratch (new onboarding)
    fresh_creation: {
      trigger: 'New user onboarding or major pivot'
      process: 'Full 7-stage discovery process'
      data_sources: 'Reference companies, market research'
      timeline: '45-60 minutes'
    }
    
    // From existing ICP (expansion/segmentation)
    derivative_creation: {
      trigger: 'Market expansion, product launch, campaign optimization'
      process: 'Clone + modify existing ICP'
      data_sources: 'Parent ICP + differential research'
      timeline: '15-20 minutes'
      workflow_steps: [
        'Select parent ICP to clone',
        'Define differences (geography, product, segment)',
        'Modify criteria based on differences',
        'Validate market size and opportunity',
        'Set relationship to parent ICP'
      ]
    }
    
    // Campaign-specific ICP (testing)
    experimental_creation: {
      trigger: 'A/B testing, hypothesis validation'
      process: 'Focused modification for specific test'
      data_sources: 'Parent ICP + hypothesis data'
      timeline: '10-15 minutes'
      auto_promotion_rules: 'If performance > parent by X%, promote to primary'
    }
  }
  
  // ICP Switching & Context Management
  icp_switching: {
    // Manual switching
    user_initiated: {
      trigger_locations: ['Campaign creation', 'Prospect research', 'Strategy planning']
      switching_interface: 'ICP selector dropdown with context preview'
      confirmation_required: false
      switch_persistence: 'Session-based or global preference'
    }
    
    // Contextual auto-switching
    contextual_switching: {
      triggers: [
        'Geographic region detected in prospect data',
        'Product mention in conversation',
        'Company size indicates different segment'
      ]
      user_approval: 'First time only, then automatic'
      learning_system: 'Track successful switches to improve auto-detection'
    }
    
    // Campaign-specific defaults
    campaign_defaults: {
      rule: 'Each campaign can have default ICP'
      inheritance: 'New campaigns inherit from user default'
      override: 'Can be changed per campaign'
    }
  }
}
```

### ICP Performance Comparison & Optimization
```typescript
interface ICPPerformanceComparison {
  // Cross-ICP Analytics
  comparative_analytics: {
    performance_metrics: Array<{
      icp_id: string
      icp_name: string
      time_period: string
      metrics: {
        prospects_contacted: number
        response_rate: number
        meeting_booking_rate: number
        conversion_rate: number
        average_deal_size: number
        sales_cycle_length: number
        customer_acquisition_cost: number
        lifetime_value: number
      }
      market_conditions: {
        competition_level: string
        market_saturation: number
        economic_factors: string[]
      }
    }>
    
    // Performance rankings
    icp_rankings: {
      overall_performance: Array<{ icp_id: string, score: number, rank: number }>
      specific_metrics: Record<string, Array<{ icp_id: string, value: number, rank: number }>>
      improvement_opportunities: Array<{
        icp_id: string
        metric: string
        current_value: number
        benchmark_value: number
        improvement_potential: number
      }>
    }
  }
  
  // Resource Allocation Recommendations
  resource_allocation: {
    budget_optimization: Array<{
      icp_id: string
      current_allocation: number
      recommended_allocation: number
      expected_roi_change: number
      reasoning: string[]
    }>
    
    time_allocation: Array<{
      icp_id: string
      current_time_percentage: number
      recommended_time_percentage: number
      expected_outcome_change: string
    }>
    
    channel_allocation: Record<string, Array<{
      icp_id: string
      channel_effectiveness: number
      recommended_priority: number
    }>>
  }
}
```

---

## ICP Modification & Dynamic Updates System

### User-Initiated ICP Changes
```typescript
interface ICPModificationSystem {
  // Modification Triggers
  modification_triggers: {
    user_initiated: {
      trigger_type: 'manual_edit' | 'campaign_feedback' | 'market_research_update'
      modification_scope: 'criteria' | 'priorities' | 'exclusions' | 'market_sizing'
      change_magnitude: 'minor' | 'moderate' | 'major'
    }
    
    system_suggested: {
      trigger_type: 'performance_analysis' | 'market_shift_detection' | 'competitive_intelligence'
      confidence_level: number
      supporting_data: any[]
      user_approval_required: boolean
    }
  }
  
  // Change Processing Pipeline
  change_processing: {
    // Step 1: Impact Analysis
    impact_analysis: {
      market_size_change: {
        current_tam: number
        projected_tam: number
        change_percentage: number
      }
      
      existing_campaigns_impact: Array<{
        campaign_id: string
        affected_prospects: number
        required_actions: string[]
      }>
      
      rag_update_requirements: {
        embeddings_to_refresh: string[]
        pattern_analysis_updates: string[]
        content_relevance_updates: string[]
      }
    }
    
    // Step 2: User Confirmation
    user_confirmation: {
      change_summary: string
      impact_preview: string
      cost_implications: string
      time_to_implement: string
      user_approval: boolean
      confirmation_timestamp?: string
    }
    
    // Step 3: Implementation
    implementation_steps: Array<{
      step_type: 'update_icp_criteria' | 'refresh_embeddings' | 'update_campaigns' | 'notify_systems'
      status: 'pending' | 'in_progress' | 'completed' | 'failed'
      execution_timestamp?: string
      error_details?: string
    }>
  }
}
```

### RAG Update Process for ICP Changes
```typescript
interface RAGUpdateProcess {
  // Embedding Refresh Strategy
  embedding_updates: {
    // Full Refresh (for major ICP changes)
    full_refresh: {
      trigger_conditions: string[]
      affected_embeddings: {
        company_embeddings: 'all' | 'filtered'
        pattern_embeddings: 'user_specific' | 'related_patterns'
        content_embeddings: 'icp_related' | 'all'
      }
      estimated_processing_time: number
      cost_estimate: number
    }
    
    // Incremental Update (for minor changes)
    incremental_update: {
      trigger_conditions: string[]
      update_scope: {
        new_criteria_embeddings: string[]
        modified_pattern_weights: Record<string, number>
        relevance_score_adjustments: Record<string, number>
      }
      processing_time: number
      cost_estimate: number
    }
  }
  
  // Pattern Reanalysis
  pattern_reanalysis: {
    affected_patterns: Array<{
      pattern_id: string
      pattern_type: string
      reanalysis_required: boolean
      new_companies_to_analyze: string[]
      pattern_strength_change: number
    }>
    
    new_pattern_detection: {
      search_criteria: ICPFramework['icp_definition']
      expected_new_patterns: number
      analysis_depth: 'shallow' | 'deep'
    }
  }
  
  // Content Relevance Updates
  content_relevance_updates: {
    messaging_updates: Array<{
      content_id: string
      old_relevance_score: number
      new_relevance_score: number
      update_reason: string
    }>
    
    case_study_relevance: Array<{
      case_study_id: string
      relevance_change: number
      applicability_updates: string[]
    }>
  }
}
```

### Real-time Synchronization
```typescript
interface RealTimeSyncSystem {
  // Change Propagation
  change_propagation: {
    immediate_updates: {
      // Systems that update immediately
      active_campaigns: 'pause_and_review' | 'continue_with_notification'
      user_interface: 'refresh_all_views'
      api_responses: 'include_change_timestamp'
    }
    
    batched_updates: {
      // Systems that update in batches
      embeddings_refresh: 'next_scheduled_batch' | 'priority_queue'
      pattern_analysis: 'nightly_batch' | 'weekend_batch'
      performance_recalculation: 'weekly_batch'
    }
    
    eventual_consistency: {
      // Systems with eventual consistency
      cross_user_patterns: 'monthly_batch'
      market_intelligence: 'quarterly_update'
      competitive_analysis: 'market_event_triggered'
    }
  }
  
  // Conflict Resolution
  conflict_resolution: {
    concurrent_modifications: {
      detection_strategy: 'timestamp_comparison' | 'version_vectors'
      resolution_strategy: 'last_write_wins' | 'user_conflict_resolution'
    }
    
    system_vs_user_changes: {
      priority_rules: Record<string, 'user' | 'system' | 'merge'>
      escalation_conditions: string[]
    }
  }
}
```

---

## Multi-ICP User Interface & Experience

### ICP Management Dashboard
```typescript
interface ICPManagementUI {
  // Main ICP Overview
  icp_dashboard: {
    layout: 'card_grid' | 'table_view' | 'performance_chart'
    icp_cards: Array<{
      icp_id: string
      icp_name: string
      description: string
      status: 'active' | 'testing' | 'paused' | 'archived'
      quick_stats: {
        prospects_count: number
        active_campaigns: number
        last_30_days_performance: {
          response_rate: number
          meeting_rate: number
          conversion_rate: number
        }
      }
      visual_indicators: {
        performance_trend: 'up' | 'down' | 'stable'
        market_size_confidence: number
        last_updated: string
      }
    }>
    
    quick_actions: {
      create_new_icp: 'From scratch' | 'Clone existing' | 'Campaign-specific'
      bulk_operations: ['Archive selected', 'Export data', 'Compare performance']
      filters: ['Status', 'Performance', 'Creation date', 'Usage context']
    }
  }
  
  // ICP Selector Component (for campaigns, research, etc.)
  icp_selector: {
    context_aware: boolean  // Show relevant ICPs based on current context
    display_format: {
      compact: 'Name + key metrics only'
      detailed: 'Name + description + performance preview'
      comparison: 'Side-by-side comparison view'
    }
    
    selection_helpers: {
      smart_suggestions: Array<{
        icp_id: string
        reason: string
        confidence: number
      }>
      
      context_hints: {
        geographic_context?: string
        product_context?: string
        channel_context?: string
      }
    }
  }
  
  // ICP Creation/Editing Flow
  icp_creation_flow: {
    // Creation type selection
    creation_type_selector: {
      options: ['Fresh (Full onboarding)', 'Clone existing', 'Campaign-specific test']
      time_estimates: Record<string, string>
      complexity_indicators: Record<string, 'Simple' | 'Moderate' | 'Complex'>
    }
    
    // Clone workflow (most common for multi-ICP)
    clone_workflow: {
      parent_selection: {
        interface: 'ICP grid with performance preview'
        selection_criteria: ['Performance', 'Similarity to goal', 'Market size']
      }
      
      difference_definition: {
        categories: ['Geographic', 'Product-specific', 'Market segment', 'Channel']
        guided_questions: Array<{
          question: string
          impact_preview: string
          market_size_change: string
        }>
      }
      
      validation_preview: {
        side_by_side_comparison: 'Parent vs New ICP'
        market_size_estimates: 'Before and after'
        potential_conflicts: 'Overlapping criteria warnings'
      }
    }
  }
}
```

### Context-Aware ICP Switching
```typescript
interface ContextualICPSwitching {
  // Automatic context detection
  context_detection: {
    // Geographic context
    geographic_signals: {
      prospect_location: 'IP geolocation, profile location'
      campaign_targeting: 'Campaign geographic settings'
      time_zone: 'User activity time patterns'
    }
    
    // Product context
    product_signals: {
      conversation_keywords: 'Product mentions in messages'
      landing_page: 'Which product page user came from'
      campaign_association: 'Product-specific campaign'
    }
    
    // Company size context
    size_signals: {
      prospect_company_size: 'LinkedIn employee count'
      deal_size_indicators: 'Budget discussions, enterprise signals'
      complexity_signals: 'Decision-maker count, approval process'
    }
  }
  
  // Smart switching logic
  switching_intelligence: {
    confidence_thresholds: {
      auto_switch: 0.8  // Switch automatically if confidence > 80%
      suggest_switch: 0.6  // Show suggestion if confidence > 60%
      no_action: 0.4  // No suggestion if confidence < 40%
    }
    
    switch_suggestions: Array<{
      suggested_icp_id: string
      current_icp_id: string
      confidence: number
      reasoning: string[]
      context_match_score: number
      expected_performance_lift: number
    }>
    
    user_feedback_learning: {
      track_user_decisions: 'Accept/reject suggestions'
      improve_suggestions: 'Machine learning on user preferences'
      personalize_thresholds: 'User-specific confidence levels'
    }
  }
}
```

---

## ICP-Driven Campaign Creation & Data Population

### Campaign Creation with ICP Integration
```typescript
interface ICPCampaignIntegration {
  // Campaign creation workflow
  campaign_creation: {
    // Step 1: ICP Selection
    icp_selection: {
      interface: 'ICP selector with performance preview'
      selection_options: {
        single_icp: 'Focus campaign on one ICP'
        multi_icp: 'Compare multiple ICPs in A/B tests'
        icp_combination: 'Merge criteria from multiple ICPs'
        icp_exclusion: 'Use one ICP but exclude certain criteria'
      }
      
      impact_preview: {
        estimated_list_size: number
        expected_response_rates: Record<string, number>  // Per ICP
        cost_estimation: {
          prospect_research_cost: number
          outreach_cost_per_prospect: number
          total_campaign_cost: number
        }
      }
    }
    
    // Step 2: List Generation
    list_generation: {
      prospect_discovery_strategy: {
        primary_sources: ['LinkedIn (Unipile)', 'Company databases (Apify)', 'Web research (BrightData)']
        search_criteria_mapping: 'Convert ICP criteria to search parameters'
        deduplication_logic: 'Cross-ICP prospect deduplication'
        quality_scoring: 'ICP match confidence scores per prospect'
      }
      
      list_building_process: Array<{
        step: string
        data_source: string
        search_parameters: Record<string, any>
        expected_results: number
        quality_threshold: number
        cost_per_result: number
      }>
      
      list_validation: {
        icp_match_verification: 'Double-check prospects against ICP criteria'
        data_enrichment: 'Add missing contact info and company data'
        list_hygiene: 'Remove invalid emails, duplicates, opt-outs'
        compliance_check: 'GDPR, CAN-SPAM, industry-specific rules'
      }
    }
    
    // Step 3: Message Personalization
    message_personalization: {
      icp_specific_messaging: {
        value_proposition_matching: 'Select messages that resonate with ICP'
        pain_point_alignment: 'Match prospect pain points to ICP insights'
        case_study_selection: 'Choose relevant case studies for ICP'
        industry_customization: 'Adapt language for ICP industry'
      }
      
      prospect_level_personalization: {
        company_research: 'Recent news, funding, job postings'
        role_specific_messaging: 'Customize for decision-maker role'
        mutual_connections: 'Leverage LinkedIn connections'
        technology_stack: 'Reference known technologies'
      }
    }
  }
  
  // Multi-ICP Campaign Types
  campaign_types: {
    // Single ICP Campaign
    focused_campaign: {
      description: 'Deep focus on one ICP for maximum personalization'
      use_cases: ['New ICP validation', 'High-value segment focus', 'Premium product launch']
      advantages: ['Maximum personalization', 'Clear attribution', 'Simplified optimization']
      list_generation: 'Use all ICP criteria without compromise'
      message_strategy: 'Highly targeted messaging for specific segment'
    }
    
    // Multi-ICP A/B Test Campaign
    comparative_campaign: {
      description: 'Test multiple ICPs against each other'
      use_cases: ['ICP validation', 'Market expansion testing', 'Resource allocation decisions']
      setup_requirements: {
        min_list_size_per_icp: 100
        statistical_significance_target: '95% confidence'
        test_duration: 'Minimum 2 weeks'
        success_metrics: ['Response rate', 'Meeting rate', 'Conversion rate']
      }
      list_generation: 'Separate lists per ICP with equal quality standards'
      message_strategy: 'Consistent messaging framework, ICP-specific personalization'
    }
    
    // Hybrid ICP Campaign
    blended_campaign: {
      description: 'Combine criteria from multiple ICPs for broader reach'
      use_cases: ['Market expansion', 'Volume-focused campaigns', 'Feature-specific outreach']
      criteria_merging: {
        union_approach: 'Include prospects matching ANY selected ICP'
        intersection_approach: 'Include only prospects matching ALL selected ICPs'
        weighted_approach: 'Score prospects based on multiple ICP matches'
      }
      list_generation: 'Merged criteria with ICP attribution per prospect'
      message_strategy: 'Dynamic messaging based on strongest ICP match'
    }
  }
}
```

### Data Population & Enrichment Pipeline
```typescript
interface ICPDataPopulationPipeline {
  // Real-time list building
  list_building_pipeline: {
    // Phase 1: Prospect Discovery
    discovery_phase: {
      icp_to_search_translation: {
        firmographic_mapping: {
          industries: 'LinkedIn company industry filters'
          company_size: 'Employee count ranges'
          geography: 'Location-based filtering'
          company_stage: 'Funding stage and growth indicators'
        }
        
        technographic_mapping: {
          technology_stack: 'Job posting technology requirements'
          tech_hiring: 'Engineering roles and skills'
          digital_maturity: 'Website technology and complexity'
        }
        
        behavioral_mapping: {
          buying_signals: 'Recent funding, hiring, expansion news'
          pain_point_indicators: 'Industry challenges, market trends'
          engagement_patterns: 'Social media activity, content engagement'
        }
      }
      
      search_execution: Array<{
        data_source: 'unipile' | 'apify' | 'brightdata' | 'google_search'
        search_parameters: Record<string, any>
        expected_prospect_count: number
        search_cost: number
        execution_time_estimate: number
      }>
    }
    
    // Phase 2: Prospect Scoring & Filtering
    scoring_phase: {
      icp_match_scoring: {
        scoring_algorithm: 'Weighted criteria matching'
        score_components: {
          firmographic_match: 'Weight: 40%'
          technographic_match: 'Weight: 30%'
          behavioral_match: 'Weight: 20%'
          negative_criteria_check: 'Weight: 10% (exclusions)'
        }
        
        quality_thresholds: {
          high_quality: '>= 80% match score'
          medium_quality: '60-79% match score'
          low_quality: '40-59% match score'
          rejected: '< 40% match score'
        }
      }
      
      deduplication_logic: {
        cross_icp_deduplication: 'Remove prospects appearing in multiple ICPs'
        contact_deduplication: 'Handle multiple contacts at same company'
        historical_deduplication: 'Check against previous campaigns'
        suppression_list_check: 'Remove opted-out or bounced contacts'
      }
    }
    
    // Phase 3: Data Enrichment
    enrichment_phase: {
      contact_enrichment: {
        email_finding: 'Professional email discovery'
        phone_enrichment: 'Direct dial numbers when available'
        social_profiles: 'LinkedIn, Twitter profile links'
        role_verification: 'Job title and responsibility validation'
      }
      
      company_enrichment: {
        company_intelligence: 'Revenue, employee count, recent news'
        technology_stack: 'Confirmed technology usage'
        competitive_landscape: 'Competitor analysis and positioning'
        buying_signals: 'Recent activities indicating purchase intent'
      }
      
      personalization_data: {
        recent_activity: 'LinkedIn posts, company news, job changes'
        mutual_connections: 'Shared LinkedIn connections'
        content_engagement: 'Blog comments, social media interactions'
        event_participation: 'Conference attendance, webinar participation'
      }
    }
  }
  
  // Campaign Data Integration
  campaign_data_integration: {
    // Pre-campaign data preparation
    data_preparation: {
      list_segmentation: {
        icp_segments: 'Group prospects by ICP match'
        priority_tiers: 'High, medium, low priority based on scores'
        personalization_groups: 'Similar prospects for message variants'
        sequence_assignments: 'Different sequences based on ICP criteria'
      }
      
      message_variant_assignment: {
        icp_specific_templates: 'Message templates tailored to ICP'
        dynamic_personalization: 'Real-time data insertion'
        a_b_test_groups: 'Variant assignment for testing'
        send_time_optimization: 'Best sending times per ICP'
      }
    }
    
    // Campaign execution data flow
    execution_data_flow: {
      real_time_data_sync: {
        prospect_status_updates: 'Opened, replied, bounced, unsubscribed'
        engagement_tracking: 'Link clicks, email opens, response sentiment'
        conversion_tracking: 'Meeting booked, demo scheduled, opportunity created'
        icp_performance_attribution: 'Track success back to original ICP'
      }
      
      dynamic_list_updates: {
        new_prospect_discovery: 'Continuous prospect finding based on performance'
        list_refresh: 'Remove unresponsive prospects, add new matches'
        icp_refinement_integration: 'Update lists when ICP criteria change'
        competitive_intelligence_updates: 'Adjust targeting based on market changes'
      }
    }
  }
}
```

### Campaign Performance Attribution
```typescript
interface ICPCampaignAttribution {
  // Multi-ICP performance tracking
  performance_attribution: {
    // Individual ICP performance
    icp_specific_metrics: Array<{
      icp_id: string
      icp_name: string
      campaign_metrics: {
        prospects_contacted: number
        emails_sent: number
        open_rate: number
        response_rate: number
        meeting_booking_rate: number
        conversion_to_opportunity: number
        average_deal_size: number
        sales_cycle_length: number
        customer_acquisition_cost: number
      }
      
      quality_metrics: {
        icp_match_accuracy: number
        data_quality_score: number
        prospect_engagement_score: number
        message_relevance_score: number
      }
      
      cost_metrics: {
        cost_per_prospect: number
        cost_per_response: number
        cost_per_meeting: number
        roi_calculation: number
      }
    }>
    
    // Cross-ICP insights
    comparative_analysis: {
      performance_rankings: Array<{
        icp_id: string
        metric: string
        value: number
        rank: number
        percentile: number
      }>
      
      efficiency_analysis: {
        best_performing_criteria: Array<{
          criteria_type: string
          criteria_value: string
          performance_lift: number
          statistical_significance: number
        }>
        
        underperforming_segments: Array<{
          criteria_combination: string[]
          performance_gap: number
          recommended_action: string
        }>
      }
    }
  }
  
  // Feedback loop to ICP refinement
  icp_learning_integration: {
    performance_based_refinement: {
      criteria_optimization: 'Adjust ICP criteria based on campaign results'
      market_size_recalculation: 'Update TAM/SAM based on actual response rates'
      messaging_optimization: 'Refine value propositions based on engagement'
      competitive_positioning: 'Adjust positioning based on win/loss feedback'
    }
    
    cross_campaign_learning: {
      pattern_recognition: 'Identify successful patterns across campaigns'
      failure_analysis: 'Learn from underperforming campaigns'
      seasonal_adjustments: 'Account for time-of-year performance variations'
      market_shift_detection: 'Identify changes in market responsiveness'
    }
  }
}
```

---

## Performance Monitoring & Optimization

### ICP Effectiveness Tracking
```typescript
interface ICPEffectivenessTracking {
  // Campaign Performance by ICP Criteria
  criteria_performance: Array<{
    criteria_type: string
    criteria_value: string
    campaign_metrics: {
      prospects_reached: number
      response_rate: number
      meeting_booking_rate: number
      conversion_rate: number
      average_deal_size?: number
    }
    performance_trends: Array<{
      period: string
      metrics: Record<string, number>
    }>
  }>
  
  // ICP Refinement Impact
  refinement_impact: Array<{
    modification_id: string
    modification_date: string
    performance_before: CampaignMetrics
    performance_after: CampaignMetrics
    improvement_percentage: Record<string, number>
    confidence_interval: Record<string, [number, number]>
  }>
  
  // Cross-User Pattern Learning
  cross_user_insights: {
    successful_icp_patterns: Array<{
      pattern_description: string
      success_indicators: Record<string, number>
      applicable_industries: string[]
      user_count: number
      anonymized_performance: Record<string, number>
    }>
    
    failed_icp_patterns: Array<{
      pattern_description: string
      failure_indicators: Record<string, number>
      lessons_learned: string[]
      avoidance_recommendations: string[]
    }>
  }
}
```

### Continuous Learning System
```sql
-- ICP learning and optimization
CREATE TABLE icp_learning_insights (
  id UUID PRIMARY KEY,
  insight_type VARCHAR(50) NOT NULL,
  insight_data JSONB NOT NULL,
  confidence_score FLOAT NOT NULL,
  supporting_evidence JSONB,
  applicable_user_segments TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  validated_at TIMESTAMPTZ,
  validation_results JSONB
);

-- System performance metrics
CREATE TABLE system_performance_metrics (
  id UUID PRIMARY KEY,
  metric_category VARCHAR(50) NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_value FLOAT NOT NULL,
  measurement_timestamp TIMESTAMPTZ DEFAULT NOW(),
  context_data JSONB,
  
  INDEX idx_metric_category_name (metric_category, metric_name),
  INDEX idx_measurement_timestamp (measurement_timestamp)
);
```

---

## Implementation Priorities

### Phase 1: Core Data Flow (Weeks 1-2)
- ✅ Discovery interview data capture
- ✅ Company intelligence research pipeline  
- ✅ Basic ICP framework generation
- ✅ Initial RAG storage architecture

### Phase 2: Interactive Refinement (Weeks 3-4)
- 🔄 Real-time market sizing during ICP refinement
- 🔄 User feedback collection and processing
- 🔄 Basic embedding generation and storage
- 🔄 Simple pattern detection algorithms

### Phase 3: Dynamic Updates (Weeks 5-6)
- ⏳ ICP modification system
- ⏳ RAG update pipeline for changes
- ⏳ Real-time synchronization
- ⏳ Conflict resolution mechanisms

### Phase 4: Advanced Learning (Weeks 7-8)
- ⏳ Performance tracking and analytics
- ⏳ Cross-user pattern learning
- ⏳ Predictive ICP optimization
- ⏳ Advanced embedding strategies

This comprehensive system ensures that every piece of data captured during onboarding is properly stored, vectorized for semantic search, and dynamically updated as users refine their ICPs, creating a continuously improving intelligence system.