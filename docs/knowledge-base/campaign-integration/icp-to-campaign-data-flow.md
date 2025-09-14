# ICP-to-Campaign Data Flow Specification
Version: v1.0 | Created: 2025-09-14

## Purpose
This document defines the complete data flow from validated ICPs through campaign creation, list generation, and prospect population. It establishes the technical architecture for SAM AI's campaign creation system that leverages the multi-ICP framework.

---

## Campaign Creation Data Flow

### Phase 1: ICP Selection & Campaign Strategy

```typescript
interface CampaignCreationInput {
  // ICP Selection
  primary_icp_id: string
  secondary_icp_ids?: string[]
  icp_strategy: 'single' | 'parallel' | 'sequential' | 'a_b_test'
  
  // Campaign Context
  campaign_type: 'outbound_email' | 'linkedin_outreach' | 'multi_channel' | 'content_nurture'
  campaign_objective: 'lead_generation' | 'meeting_booking' | 'relationship_building' | 'market_research'
  
  // Resource Constraints
  max_prospects_per_icp: number
  campaign_duration: number  // days
  daily_send_limits: number
  budget_constraints?: BudgetConstraints
  
  // Quality Requirements
  min_data_quality_score: number  // 1-100
  email_verification_required: boolean
  personalization_depth: 'basic' | 'medium' | 'advanced'
}
```

### Phase 2: List Generation from ICPs

```typescript
interface ListGenerationProcess {
  icp_id: string
  
  // Criteria Application
  demographic_filters: AppliedFilter[]
  firmographic_filters: AppliedFilter[]
  technographic_filters: AppliedFilter[]
  behavioral_filters: AppliedFilter[]
  
  // Data Sourcing
  data_sources: {
    source_name: 'apollo' | 'zoominfo' | 'linkedin' | 'clearbit' | 'brightdata'
    source_priority: number
    cost_per_record: number
    expected_match_rate: number
  }[]
  
  // Quality Controls
  deduplication_rules: DeduplicationRule[]
  verification_requirements: VerificationRequirement[]
  exclusion_lists: ExclusionList[]
  
  // Output Specifications
  target_list_size: number
  quality_thresholds: QualityThreshold[]
  enrichment_requirements: EnrichmentRequirement[]
}
```

---

## Data Population Pipeline

### Stage 1: Prospect Discovery

```typescript
interface ProspectDiscovery {
  // Search Execution
  search_parameters: {
    icp_criteria: ICPCriteria
    search_sources: DataSource[]
    search_scope: 'comprehensive' | 'targeted' | 'sample'
    geographic_constraints?: GeographicConstraints
  }
  
  // Initial Results
  raw_prospects: {
    prospect_count: number
    data_completeness: number  // percentage
    source_distribution: Record<string, number>
    estimated_cost: number
  }
  
  // Quality Assessment
  initial_quality_check: {
    criteria_match_percentage: number
    data_accuracy_score: number
    duplicate_percentage: number
    verification_pass_rate: number
  }
}
```

### Stage 2: Data Enrichment

```typescript
interface DataEnrichment {
  prospect_id: string
  
  // Core Enrichment
  contact_enrichment: {
    email_discovery: EmailDiscovery
    phone_discovery: PhoneDiscovery
    social_profile_matching: SocialProfileMatching
    contact_verification: ContactVerification
  }
  
  // Company Enrichment
  company_enrichment: {
    firmographic_data: FirmographicData
    technographic_data: TechnographicData
    financial_data: FinancialData
    news_and_events: NewsAndEvents
  }
  
  // Personalization Enrichment
  personalization_data: {
    recent_activity: RecentActivity[]
    trigger_events: TriggerEvent[]
    content_interests: ContentInterest[]
    competitive_intelligence: CompetitiveIntelligence[]
  }
  
  // Quality Scoring
  enrichment_quality: {
    completeness_score: number
    accuracy_confidence: number
    freshness_score: number
    personalization_readiness: number
  }
}
```

### Stage 3: List Compilation & Optimization

```typescript
interface ListCompilation {
  campaign_id: string
  icp_breakdown: {
    icp_id: string
    prospect_count: number
    quality_score: number
    cost_per_prospect: number
  }[]
  
  // List Structure
  list_segments: {
    segment_name: string
    segment_criteria: SegmentCriteria
    prospect_ids: string[]
    priority_score: number
    personalization_template: string
  }[]
  
  // Quality Optimization
  optimization_rules: {
    remove_duplicates: boolean
    apply_quality_filters: boolean
    balance_icp_distribution: boolean
    optimize_for_deliverability: boolean
  }
  
  // Final List Metrics
  final_metrics: {
    total_prospects: number
    average_quality_score: number
    estimated_deliverability: number
    total_cost: number
    expected_response_rate: number
  }
}
```

---

## Campaign Configuration Integration

### Message Personalization from ICP Data

```typescript
interface ICPPersonalizationMapping {
  icp_id: string
  
  // Dynamic Variables from ICP
  demographic_variables: {
    '{job_title}': string
    '{seniority_level}': string
    '{department}': string
    '{years_experience}': string
  }
  
  firmographic_variables: {
    '{company_name}': string
    '{company_size}': string
    '{industry}': string
    '{company_stage}': string
  }
  
  // Behavioral Variables
  behavioral_variables: {
    '{pain_points}': string[]
    '{business_priorities}': string[]
    '{technology_stack}': string[]
    '{recent_triggers}': string[]
  }
  
  // Value Proposition Alignment
  value_prop_mapping: {
    icp_criteria: string
    aligned_value_props: string[]
    messaging_angles: string[]
    social_proof_elements: string[]
  }[]
}
```

### Message Template Framework

```typescript
interface MessageTemplateFramework {
  // Template Structure
  template_hierarchy: {
    campaign_level: CampaignTemplate
    icp_level: ICPTemplate[]
    segment_level: SegmentTemplate[]
    individual_level: PersonalizedTemplate[]
  }
  
  // Dynamic Content Rules
  content_variation_rules: {
    condition: string  // ICP criteria or prospect attribute
    content_variant: string
    priority: number
    fallback_content: string
  }[]
  
  // Personalization Depth
  personalization_layers: {
    basic: {
      variables: string[]
      fallback_values: Record<string, string>
    }
    advanced: {
      conditional_logic: ConditionalLogic[]
      dynamic_sections: DynamicSection[]
    }
    ai_generated: {
      context_sources: string[]
      generation_rules: GenerationRule[]
    }
  }
}
```

---

## Campaign Execution Data Flow

### Prospect Assignment & Sequencing

```typescript
interface ProspectCampaignAssignment {
  prospect_id: string
  campaign_id: string
  icp_id: string
  
  // Assignment Logic
  assignment_criteria: {
    icp_match_score: number
    quality_score: number
    priority_tier: 'high' | 'medium' | 'low'
    sequence_position: number
  }
  
  // Personalization Context
  personalization_context: {
    selected_variables: Record<string, string>
    message_variant_id: string
    send_time_optimization: SendTimeOptimization
    channel_preference: ChannelPreference
  }
  
  // Tracking Setup
  tracking_parameters: {
    utm_parameters: UTMParameters
    custom_tracking_fields: Record<string, string>
    attribution_source: string
    expected_outcomes: ExpectedOutcome[]
  }
}
```

### Real-Time Campaign Optimization

```typescript
interface CampaignOptimization {
  campaign_id: string
  
  // Performance Monitoring
  real_time_metrics: {
    sends_completed: number
    open_rate: number
    response_rate: number
    bounce_rate: number
    unsubscribe_rate: number
  }
  
  // ICP Performance Breakdown
  icp_performance: {
    icp_id: string
    performance_vs_benchmark: number
    quality_indicators: QualityIndicator[]
    optimization_recommendations: OptimizationRecommendation[]
  }[]
  
  // Dynamic Adjustments
  adjustment_triggers: {
    trigger_condition: string
    adjustment_action: string
    threshold_value: number
    auto_apply: boolean
  }[]
  
  // A/B Test Results
  ab_test_insights: {
    variant_performance: VariantPerformance[]
    statistical_significance: boolean
    winning_variant: string
    rollout_recommendation: string
  }
}
```

---

## Data Feedback Loop

### Campaign Performance to ICP Insights

```typescript
interface PerformanceToICPFeedback {
  campaign_id: string
  
  // ICP Validation Updates
  icp_validation_updates: {
    icp_id: string
    validation_status: 'confirmed' | 'needs_refinement' | 'pivot_required'
    performance_evidence: PerformanceEvidence[]
    refinement_suggestions: RefinementSuggestion[]
  }[]
  
  // Market Intelligence Updates
  market_intelligence: {
    response_patterns: ResponsePattern[]
    competitive_insights: CompetitiveInsight[]
    market_trend_indicators: MarketTrendIndicator[]
    buyer_behavior_updates: BuyerBehaviorUpdate[]
  }
  
  // Data Quality Feedback
  data_quality_feedback: {
    source_accuracy_updates: SourceAccuracyUpdate[]
    verification_effectiveness: VerificationEffectiveness[]
    enrichment_value_analysis: EnrichmentValueAnalysis[]
  }
}
```

### Continuous ICP Improvement

```typescript
interface ICPContinuousImprovement {
  icp_id: string
  
  // Performance-Based Updates
  criteria_optimization: {
    criteria_field: string
    current_criteria: any
    suggested_criteria: any
    performance_evidence: PerformanceEvidence
    confidence_score: number
  }[]
  
  // Market Evolution Tracking
  market_evolution: {
    trend_indicator: string
    impact_assessment: 'positive' | 'negative' | 'neutral'
    adaptation_recommendation: string
    urgency_level: 'immediate' | 'short_term' | 'long_term'
  }[]
  
  // New Opportunity Identification
  opportunity_discovery: {
    opportunity_type: 'new_segment' | 'adjacent_market' | 'variant_icp'
    opportunity_description: string
    market_size_estimate: number
    exploration_recommendation: string
  }[]
}
```

---

## Technical Implementation Architecture

### Database Schema Extensions

```sql
-- Campaign to ICP Mapping
CREATE TABLE campaign_icp_assignments (
  id UUID PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id),
  icp_id UUID REFERENCES icps(id),
  assignment_type TEXT CHECK (assignment_type IN ('primary', 'secondary', 'test')),
  prospect_allocation_percentage DECIMAL(5,2),
  priority_rank INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Prospect Campaign Assignment
CREATE TABLE prospect_campaign_assignments (
  id UUID PRIMARY KEY,
  prospect_id UUID REFERENCES prospects(id),
  campaign_id UUID REFERENCES campaigns(id),
  icp_id UUID REFERENCES icps(id),
  assignment_reason JSONB,
  personalization_context JSONB,
  sequence_position INTEGER,
  status TEXT DEFAULT 'pending',
  assigned_at TIMESTAMP DEFAULT NOW()
);

-- Campaign Performance by ICP
CREATE TABLE campaign_icp_performance (
  id UUID PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id),
  icp_id UUID REFERENCES icps(id),
  measurement_period_start DATE,
  measurement_period_end DATE,
  prospects_targeted INTEGER,
  emails_sent INTEGER,
  opens INTEGER,
  clicks INTEGER,
  replies INTEGER,
  meetings_booked INTEGER,
  opportunities_created INTEGER,
  deals_closed INTEGER,
  revenue_generated DECIMAL(15,2),
  cost_per_prospect DECIMAL(10,2),
  roi_percentage DECIMAL(8,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ICP Performance Feedback
CREATE TABLE icp_performance_feedback (
  id UUID PRIMARY KEY,
  icp_id UUID REFERENCES icps(id),
  feedback_source TEXT, -- 'campaign_performance', 'user_input', 'market_data'
  feedback_type TEXT, -- 'validation', 'refinement', 'opportunity'
  feedback_data JSONB,
  impact_score INTEGER CHECK (impact_score BETWEEN 1 AND 10),
  applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints Architecture

```typescript
// Campaign Creation with ICP Integration
POST /api/campaigns/create
{
  name: string
  icps: {
    icp_id: string
    role: 'primary' | 'secondary' | 'test'
    target_size: number
  }[]
  campaign_config: CampaignConfiguration
  list_generation_rules: ListGenerationRules
}

// Generate Prospects from ICPs
POST /api/campaigns/{campaign_id}/generate-prospects
{
  quality_requirements: QualityRequirements
  budget_limits: BudgetLimits
  data_source_preferences: DataSourcePreferences
}

// Campaign Performance Analysis
GET /api/campaigns/{campaign_id}/icp-performance
Response: {
  overall_performance: CampaignMetrics
  icp_breakdown: ICPPerformanceBreakdown[]
  optimization_recommendations: OptimizationRecommendation[]
  feedback_for_icps: ICPFeedback[]
}

// Update ICP from Campaign Insights
POST /api/icps/{icp_id}/apply-campaign-feedback
{
  campaign_id: string
  feedback_data: PerformanceFeedback
  auto_apply: boolean
}
```

This comprehensive data flow specification ensures seamless integration between the multi-ICP framework and campaign creation system, enabling SAM AI to deliver intelligent, data-driven campaign execution with continuous improvement capabilities.