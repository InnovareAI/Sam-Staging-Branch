# ICP Framework Specification
Version: v1.0 | Created: 2025-09-14

## Purpose
This document defines the complete ICP (Ideal Customer Profile) framework that powers SAM AI's multi-ICP management system. It establishes the data structures, relationships, and business logic for creating, managing, and utilizing ICPs across the entire sales intelligence platform.

---

## ICP Core Framework

### ICP Definition Structure
```typescript
interface ICP {
  // Core Identity
  id: string
  user_id: string
  name: string
  description: string
  icp_type: 'primary' | 'secondary' | 'variant' | 'experimental'
  status: 'active' | 'testing' | 'paused' | 'archived'
  
  // Hierarchical Relationships
  parent_icp_id?: string  // For variants and experiments
  related_icp_ids: string[]  // For related/similar ICPs
  derived_from?: string  // Original source ICP for clones
  
  // Business Context
  business_context: BusinessContext
  market_positioning: MarketPositioning
  value_proposition_alignment: ValuePropAlignment
  vertical_context: VerticalContext
  
  // Targeting Criteria
  demographic_criteria: DemographicCriteria
  firmographic_criteria: FirmographicCriteria
  technographic_criteria: TechnographicCriteria
  behavioral_criteria: BehavioralCriteria
  
  // Performance & Analytics
  performance_metrics: PerformanceMetrics
  market_size_analysis: MarketSizeAnalysis
  competitive_landscape: CompetitiveLandscape
  
  // Operational Data
  created_at: Date
  updated_at: Date
  last_validated: Date
  validation_status: 'pending' | 'validated' | 'needs_review'
  confidence_score: number  // 1-100 based on data quality and validation
}
```

### Business Context Schema
```typescript
interface BusinessContext {
  // Market Context
  industry_focus: string[]
  market_segment: 'enterprise' | 'mid-market' | 'smb' | 'startup'
  geographic_scope: GeographicScope
  market_maturity: 'emerging' | 'growing' | 'mature' | 'declining'
  
  // Product Fit Context
  product_alignment: string[]  // Which products/services this ICP is for
  use_case_scenarios: UseCaseScenario[]
  buying_journey_stage: 'awareness' | 'consideration' | 'decision' | 'retention'
  decision_timeline: 'immediate' | 'short' | 'medium' | 'long'
  
  // Sales Context
  sales_motion: 'inbound' | 'outbound' | 'partner' | 'hybrid'
  deal_complexity: 'simple' | 'complex' | 'enterprise'
  sales_cycle_length: number  // in days
  average_deal_size: number
  
  // Strategic Context
  strategic_priority: 'high' | 'medium' | 'low'
  resource_allocation: ResourceAllocation
  success_criteria: SuccessCriteria[]
}

interface VerticalContext {
  // Industry Vertical Classification
  primary_vertical: IndustryVertical
  sub_verticals: string[]
  vertical_maturity: 'emerging' | 'growing' | 'mature' | 'consolidating'
  
  // Regulatory Environment
  regulatory_framework: RegulatoryFramework[]
  compliance_requirements: ComplianceRequirement[]
  audit_requirements: AuditRequirement[]
  data_sovereignty_needs: DataSovereigntyNeed[]
  
  // Buying Process Intelligence
  buying_process_characteristics: BuyingProcessCharacteristics
  decision_making_hierarchy: DecisionMakingHierarchy
  budget_approval_process: BudgetApprovalProcess
  procurement_complexity: 'simple' | 'moderate' | 'complex' | 'enterprise'
  
  // Communication & Messaging
  communication_preferences: VerticalCommunicationPreference[]
  messaging_sensitivities: MessagingSensitivity[]
  content_consumption_patterns: ContentConsumptionPattern[]
  channel_effectiveness: ChannelEffectiveness[]
}
```

---

## Targeting Criteria Framework

### Demographic Criteria (People)
```typescript
interface DemographicCriteria {
  // Role & Title
  job_titles: JobTitleCriteria[]
  job_functions: string[]
  seniority_levels: ('entry' | 'mid' | 'senior' | 'executive' | 'c-suite')[]
  department_focus: string[]
  
  // Experience & Background
  years_experience_min?: number
  years_experience_max?: number
  industry_background: string[]
  education_background?: EducationCriteria[]
  previous_company_types?: string[]
  
  // Personal Characteristics
  professional_interests?: string[]
  linkedin_activity_level?: 'low' | 'medium' | 'high'
  conference_attendance?: string[]
  certification_preferences?: string[]
  
  // Decision Making Role
  decision_authority: 'decision_maker' | 'influencer' | 'user' | 'blocker'
  budget_authority: boolean
  technical_authority: boolean
  procurement_involvement: boolean
}
```

### Firmographic Criteria (Companies)
```typescript
interface FirmographicCriteria {
  // Company Size
  employee_count_min?: number
  employee_count_max?: number
  revenue_range_min?: number
  revenue_range_max?: number
  
  // Industry & Sector
  industries: IndustryCriteria[]
  sub_industries?: string[]
  business_model: ('b2b' | 'b2c' | 'marketplace' | 'saas' | 'services')[]
  
  // Company Stage & Growth
  company_stage: ('startup' | 'scaleup' | 'growth' | 'mature' | 'enterprise')[]
  funding_stage?: ('pre-seed' | 'seed' | 'series-a' | 'series-b' | 'series-c' | 'series-d+' | 'public')[]
  growth_indicators: GrowthIndicator[]
  
  // Geographic & Location
  headquarters_regions: GeographicCriteria[]
  office_locations?: GeographicCriteria[]
  geographic_reach: 'local' | 'regional' | 'national' | 'international' | 'global'
  
  // Company Structure
  ownership_type?: ('private' | 'public' | 'nonprofit' | 'government')[]
  parent_company_type?: ('independent' | 'subsidiary' | 'division')[]
  organizational_structure?: ('centralized' | 'decentralized' | 'hybrid')[]
}
```

### Technographic Criteria (Technology)
```typescript
interface TechnographicCriteria {
  // Technology Stack
  required_technologies: TechnologyCriteria[]
  preferred_technologies?: TechnologyCriteria[]
  incompatible_technologies?: string[]
  
  // Infrastructure & Platforms
  cloud_infrastructure: ('aws' | 'azure' | 'gcp' | 'hybrid' | 'on-premise')[]
  development_frameworks?: string[]
  data_platforms?: string[]
  security_frameworks?: string[]
  
  // Technology Adoption Patterns
  technology_adoption_rate: 'early-adopter' | 'mainstream' | 'laggard'
  innovation_appetite: 'high' | 'medium' | 'low'
  technology_budget_priority: 'high' | 'medium' | 'low'
  
  // Integration Requirements
  integration_complexity: 'simple' | 'moderate' | 'complex'
  api_requirements?: string[]
  compliance_requirements?: string[]
  security_requirements?: SecurityRequirement[]
}
```

### Behavioral Criteria (Actions & Patterns)
```typescript
interface BehavioralCriteria {
  // Buying Behavior
  purchasing_patterns: PurchasingPattern[]
  vendor_evaluation_process: VendorEvaluationProcess
  decision_making_style: 'consensus' | 'authoritative' | 'delegated' | 'committee'
  
  // Digital Behavior
  content_consumption: ContentConsumption[]
  social_media_activity: SocialMediaActivity[]
  event_participation: EventParticipation[]
  search_behavior: SearchBehavior[]
  
  // Engagement Patterns
  communication_preferences: ('email' | 'linkedin' | 'phone' | 'in-person' | 'video')[]
  response_time_expectations: 'immediate' | 'same-day' | 'weekly' | 'flexible'
  information_processing: 'detailed' | 'summary' | 'visual' | 'data-driven'
  
  // Problem-Solving Approach
  problem_urgency: 'urgent' | 'important' | 'nice-to-have' | 'future-planning'
  solution_complexity_comfort: 'simple' | 'moderate' | 'complex' | 'cutting-edge'
  change_management_appetite: 'high' | 'medium' | 'low' | 'resistant'
  
  // Vertical-Specific Buying Behavior
  vertical_buying_characteristics: VerticalBuyingCharacteristics
  compliance_sensitivity: 'high' | 'medium' | 'low'
  regulatory_approval_requirements: RegulatoryApprovalRequirement[]
  industry_specific_concerns: IndustrySpecificConcern[]
}
```

---

## ICP Relationship Framework

### ICP Hierarchies
```typescript
interface ICPHierarchy {
  primary_icps: ICP[]        // Core business focus
  secondary_icps: ICP[]      // Adjacent markets/segments
  variant_icps: ICP[]        // Variations of primary/secondary
  experimental_icps: ICP[]   // Testing hypotheses
  archived_icps: ICP[]       // Historical/inactive
}

interface ICPRelationship {
  relationship_type: 'parent-child' | 'variant' | 'related' | 'competitive' | 'exclusive'
  strength: number           // 1-10 relationship strength
  business_rationale: string
  performance_correlation?: number  // -1 to 1, if performance data exists
}
```

### Multi-ICP Strategies
```typescript
interface MultiICPStrategy {
  strategy_name: string
  strategy_type: 'parallel' | 'sequential' | 'experimental' | 'seasonal'
  
  icp_allocation: {
    icp_id: string
    resource_percentage: number
    priority_rank: number
    success_metrics: string[]
  }[]
  
  cross_icp_rules: {
    rule_type: 'overlap_prevention' | 'sequential_nurturing' | 'competitive_exclusion'
    rule_logic: string
    affected_icps: string[]
  }[]
  
  performance_benchmarks: {
    metric_name: string
    target_value: number
    measurement_timeframe: number  // days
  }[]
}
```

---

## Performance & Analytics Framework

### ICP Performance Metrics
```typescript
interface PerformanceMetrics {
  // Outreach Performance
  outreach_metrics: {
    prospects_contacted: number
    response_rate: number
    positive_response_rate: number
    meeting_booking_rate: number
    email_open_rate: number
    linkedin_connection_rate: number
  }
  
  // Conversion Metrics
  conversion_metrics: {
    sql_conversion_rate: number
    opportunity_conversion_rate: number
    closed_won_rate: number
    average_deal_size: number
    sales_cycle_length: number
    customer_lifetime_value: number
  }
  
  // Quality Metrics
  quality_metrics: {
    data_accuracy_score: number     // 1-100
    targeting_precision_score: number  // 1-100
    personalization_effectiveness: number  // 1-100
    prospect_engagement_score: number     // 1-100
  }
  
  // ROI Metrics
  roi_metrics: {
    cost_per_prospect: number
    cost_per_meeting: number
    cost_per_opportunity: number
    cost_per_customer: number
    roi_percentage: number
    payback_period_days: number
  }
  
  // Temporal Data
  performance_period: {
    start_date: Date
    end_date: Date
    measurement_frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  }
}
```

### Market Size Analysis
```typescript
interface MarketSizeAnalysis {
  // Addressable Market
  total_addressable_market: {
    company_count: number
    prospect_count: number
    estimated_revenue_opportunity: number
    market_penetration_potential: number  // 0-1
  }
  
  // Serviceable Market
  serviceable_addressable_market: {
    reachable_companies: number
    targetable_prospects: number
    realistic_revenue_opportunity: number
    competition_density: 'low' | 'medium' | 'high'
  }
  
  // Obtainable Market
  serviceable_obtainable_market: {
    winnable_companies: number
    convertible_prospects: number
    expected_revenue_12_months: number
    market_share_potential: number  // 0-1
  }
  
  // Market Dynamics
  market_trends: {
    growth_rate: number  // annual percentage
    competitive_intensity: number  // 1-10
    technology_disruption_risk: number  // 1-10
    regulatory_complexity: number  // 1-10
  }
}
```

---

## Validation & Quality Framework

### ICP Validation Process
```typescript
interface ICPValidation {
  validation_stage: 'hypothesis' | 'data_validated' | 'market_tested' | 'performance_proven'
  
  data_validation: {
    prospect_sample_size: number
    data_accuracy_percentage: number
    criteria_match_percentage: number
    validation_date: Date
    validation_method: 'manual' | 'automated' | 'hybrid'
  }
  
  market_validation: {
    outreach_test_size: number
    response_rate_benchmark: number
    meeting_conversion_benchmark: number
    feedback_quality_score: number  // 1-10
    market_receptivity_score: number  // 1-10
  }
  
  performance_validation: {
    campaigns_tested: number
    performance_vs_benchmark: number  // percentage above/below
    statistical_significance: boolean
    confidence_interval: [number, number]
    recommendation: 'scale' | 'optimize' | 'pivot' | 'pause'
  }
}
```

### Quality Assurance Framework
```typescript
interface ICPQualityAssurance {
  // Data Quality
  data_health: {
    completeness_score: number      // 1-100
    accuracy_score: number          // 1-100
    freshness_score: number         // 1-100
    consistency_score: number       // 1-100
    uniqueness_score: number        // 1-100 (duplicate detection)
  }
  
  // Targeting Quality
  targeting_precision: {
    criteria_specificity: number    // 1-10 (too broad vs too narrow)
    criteria_alignment: number      // 1-10 (internal consistency)
    market_reality_check: number   // 1-10 (realistic vs theoretical)
    competitive_differentiation: number  // 1-10 (unique vs generic)
  }
  
  // Performance Quality
  performance_indicators: {
    response_rate_tier: 'top' | 'above_avg' | 'average' | 'below_avg' | 'poor'
    conversion_quality_tier: 'excellent' | 'good' | 'average' | 'poor' | 'problematic'
    roi_sustainability: 'sustainable' | 'promising' | 'marginal' | 'unsustainable'
    scalability_potential: 'high' | 'medium' | 'low' | 'limited'
  }
}
```

---

## Integration Framework

### Campaign Integration
```typescript
interface ICPCampaignIntegration {
  // Campaign Assignment
  campaign_assignments: {
    campaign_id: string
    campaign_type: 'email' | 'linkedin' | 'multi-channel' | 'content' | 'events'
    priority_level: number
    resource_allocation: number
    expected_outcomes: CampaignOutcome[]
  }[]
  
  // List Generation
  list_generation_rules: {
    max_prospects_per_campaign: number
    refresh_frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly'
    quality_thresholds: QualityThreshold[]
    exclusion_rules: ExclusionRule[]
  }
  
  // Personalization Rules
  personalization_framework: {
    personalization_variables: PersonalizationVariable[]
    message_variants: MessageVariant[]
    dynamic_content_rules: DynamicContentRule[]
  }
}
```

### CRM & Sales Tool Integration
```typescript
interface ICPSalesIntegration {
  // CRM Integration
  crm_mapping: {
    icp_field_mapping: Record<string, string>
    lead_scoring_rules: LeadScoringRule[]
    opportunity_classification: OpportunityClassification[]
    pipeline_stage_mapping: PipelineStageMapping[]
  }
  
  // Sales Process Integration
  sales_process_alignment: {
    qualification_criteria: QualificationCriteria[]
    discovery_question_sets: DiscoveryQuestionSet[]
    value_proposition_variants: ValuePropVariant[]
    objection_handling_guides: ObjectionHandlingGuide[]
  }
}
```

---

## Governance & Management Framework

### ICP Lifecycle Management
```typescript
interface ICPLifecycle {
  lifecycle_stage: 'development' | 'testing' | 'active' | 'optimization' | 'retirement'
  
  stage_transitions: {
    trigger_conditions: string[]
    approval_required: boolean
    approval_workflow: string[]
    rollback_conditions: string[]
  }
  
  maintenance_schedule: {
    data_refresh_frequency: 'weekly' | 'monthly' | 'quarterly'
    performance_review_frequency: 'monthly' | 'quarterly' | 'semi-annual'
    criteria_validation_frequency: 'quarterly' | 'semi-annual' | 'annual'
  }
}
```

### Access Control & Permissions
```typescript
interface ICPAccessControl {
  ownership: {
    owner_user_id: string
    co_owners: string[]
    access_level: 'full' | 'edit' | 'view' | 'restricted'
  }
  
  team_permissions: {
    user_id: string
    permission_level: 'admin' | 'editor' | 'viewer' | 'restricted'
    specific_permissions: string[]
    expiration_date?: Date
  }[]
  
  sharing_rules: {
    internal_sharing: boolean
    external_sharing: boolean
    export_permissions: boolean
    clone_permissions: boolean
  }
}
```

This ICP Framework Specification provides the complete foundation for SAM AI's multi-ICP management system, ensuring scalable, high-quality ICP operations across all user scenarios and business contexts.