-- Comprehensive ICP Configuration System
-- Restores the extensive ICP knowledge base categories and subcategories

-- Create comprehensive ICP configurations table
CREATE TABLE IF NOT EXISTS public.icp_configurations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Basic Configuration Info
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  market_niche TEXT NOT NULL,
  industry_vertical TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'testing', 'archived', 'draft')),
  priority TEXT DEFAULT 'secondary' CHECK (priority IN ('primary', 'secondary', 'experimental')),
  
  -- 1. Target Profile Configuration
  target_profile JSONB NOT NULL DEFAULT '{
    "company_demographics": {
      "employee_count_ranges": ["100-500", "500-1000"],
      "revenue_ranges": ["$10M-$50M", "$50M-$100M"],
      "growth_stages": ["Series A", "Series B", "Growth"],
      "market_valuation_ranges": [],
      "geographic_distribution_patterns": []
    },
    "industry_segmentation": {
      "primary_industries": ["SaaS", "FinTech", "HealthTech"],
      "secondary_industries": ["MarTech", "EdTech", "PropTech"],
      "industry_classification": {},
      "market_segments": []
    },
    "geographic_focus": {
      "primary_markets": ["United States", "Canada"],
      "regional_preferences": ["East Coast", "West Coast", "Major Metro"],
      "expansion_markets": ["United Kingdom", "Australia"],
      "regulatory_environments": ["GDPR", "CCPA"],
      "cultural_considerations": {}
    },
    "technology_requirements": {
      "required_tech_stack": ["Salesforce", "HubSpot", "AWS"],
      "preferred_platforms": ["Azure", "React", "API-First"],
      "cloud_infrastructure": [],
      "security_requirements": ["SOC2", "GDPR", "API Security"],
      "integration_capabilities": [],
      "innovation_adoption_level": "early_majority"
    }
  }',
  
  -- 2. Decision Makers Configuration
  decision_makers JSONB NOT NULL DEFAULT '{
    "primary_decision_makers": {
      "c_level": ["CEO", "CTO", "CFO", "CMO", "COO"],
      "functional_leaders": ["VP Sales", "Sales Operations", "Revenue Operations"],
      "technical_authority": [],
      "user_authority": [],
      "champion_profiles": []
    },
    "authority_patterns": {
      "budget_authority_levels": {
        "under_10k": [],
        "10k_to_50k": [],
        "over_50k": []
      },
      "technical_authority": [],
      "user_authority": [],
      "stakeholder_influence": [],
      "champion_identification": []
    },
    "decision_hierarchies": {
      "approval_workflows": [],
      "evaluation_processes": [],
      "procurement_involvement": [],
      "it_security_review": [],
      "legal_review": []
    }
  }',
  
  -- 3. Pain Points & Triggers
  pain_points JSONB NOT NULL DEFAULT '{
    "operational_pain_points": {
      "sales_process_inefficiencies": [],
      "manual_research_time": [],
      "low_response_rates": [],
      "inconsistent_messaging": [],
      "poor_lead_qualification": []
    },
    "growth_scaling_challenges": {
      "revenue_growth_pressure": [],
      "scaling_effectiveness": [],
      "market_expansion": [],
      "competition_pressure": [],
      "customer_acquisition_cost": []
    },
    "technology_gaps": {
      "system_integration_issues": [],
      "manual_data_entry": [],
      "lack_of_intelligence": [],
      "poor_crm_adoption": [],
      "limited_automation": []
    },
    "buying_signals": {
      "explicit_signals": ["job_postings", "funding_announcements", "executive_changes"],
      "implicit_signals": ["declining_metrics", "competitive_pressure", "acquisition_challenges"],
      "timing_indicators": [],
      "urgency_factors": []
    }
  }',
  
  -- 4. Buying Process Configuration
  buying_process JSONB NOT NULL DEFAULT '{
    "discovery_research": {
      "problem_recognition": [],
      "solution_research": [],
      "requirements_definition": [],
      "stakeholder_alignment": []
    },
    "evaluation_selection": {
      "vendor_evaluation_criteria": [],
      "technical_capabilities": [],
      "security_compliance": [],
      "implementation_timeline": [],
      "cost_roi_projections": []
    },
    "decision_workflows": {
      "approval_stages": [],
      "committee_structure": [],
      "pilot_requirements": [],
      "contract_negotiation": []
    },
    "implementation_adoption": {
      "technical_integration": [],
      "user_training": [],
      "success_measurement": [],
      "ongoing_relationship": []
    }
  }',
  
  -- 5. Messaging Strategy Configuration
  messaging_strategy JSONB NOT NULL DEFAULT '{
    "value_proposition": {
      "primary_value_drivers": ["time_savings", "revenue_impact", "cost_efficiency"],
      "competitive_advantages": [],
      "risk_mitigation": [],
      "roi_quantification": []
    },
    "industry_messaging": {
      "saas_technology_focus": [],
      "healthcare_focus": [],
      "financial_services_focus": [],
      "manufacturing_focus": []
    },
    "role_based_communication": {
      "executive_messaging": [],
      "technical_messaging": [],
      "user_messaging": [],
      "procurement_messaging": []
    },
    "competitive_positioning": {
      "direct_competitors": [],
      "indirect_competitors": [],
      "differentiation_strategy": [],
      "competitive_response": []
    }
  }',
  
  -- 6. Success Metrics & Benchmarks
  success_metrics JSONB NOT NULL DEFAULT '{
    "industry_kpis": {
      "response_rate_benchmarks": {"typical": "3-8%", "excellent": "10%+"},
      "meeting_conversion_rates": {"typical": "2-5%", "excellent": "7%+"},
      "pipeline_velocity": {},
      "revenue_per_salesperson": {},
      "customer_acquisition_metrics": {}
    },
    "operational_efficiency": {
      "time_productivity_gains": [],
      "research_time_reduction": [],
      "outreach_volume_increase": [],
      "personalization_quality": [],
      "follow_up_optimization": []
    },
    "roi_models": {
      "cost_benefit_analysis": [],
      "time_savings_quantification": [],
      "revenue_increase_attribution": [],
      "team_productivity_multiplier": [],
      "implementation_costs": []
    },
    "success_measurement": {
      "leading_indicators": [],
      "lagging_indicators": [],
      "benchmarking": [],
      "optimization_opportunities": []
    }
  }',
  
  -- 7. Advanced Classification
  advanced_classification JSONB NOT NULL DEFAULT '{
    "technology_adoption": {
      "innovation_curve_position": "early_majority",
      "technology_maturity_preference": "proven",
      "integration_complexity_preference": "standard",
      "security_posture": "cautious"
    },
    "regulatory_compliance": {
      "industry_regulations": [],
      "data_requirements": [],
      "security_certifications": [],
      "audit_reporting": []
    },
    "market_trends": {
      "economic_cycles": [],
      "industry_trends": [],
      "seasonal_patterns": [],
      "competitive_dynamics": []
    },
    "cultural_communication": {
      "communication_style": "direct",
      "decision_speed": "deliberate",
      "risk_tolerance": "conservative",
      "vendor_relationship": "partnership"
    }
  }',
  
  -- 8. Market Intelligence Integration
  market_intelligence JSONB NOT NULL DEFAULT '{
    "competitive_landscape": {
      "direct_competitor_tracking": [],
      "indirect_competition": [],
      "market_share_analysis": [],
      "technology_evolution": []
    },
    "market_opportunity": {
      "total_addressable_market": {},
      "serviceable_available_market": {},
      "market_segmentation": [],
      "timing_analysis": []
    },
    "intelligence_sources": [],
    "monitoring_preferences": []
  }',
  
  -- Performance and Metadata
  performance_metrics JSONB DEFAULT '{
    "response_rate": 0,
    "meeting_rate": 0,
    "conversion_rate": 0,
    "roi_score": 0,
    "confidence_level": 0,
    "market_size_estimate": 0,
    "last_performance_update": null
  }',
  
  tags TEXT[] DEFAULT '{}',
  complexity_level TEXT DEFAULT 'medium' CHECK (complexity_level IN ('simple', 'medium', 'complex')),
  is_active BOOLEAN DEFAULT TRUE,
  is_template BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version TEXT DEFAULT '1.0',
  
  -- Constraints
  UNIQUE(workspace_id, name)
);

-- Create user ICP selections table (for users to save their selected/customized ICPs)
CREATE TABLE IF NOT EXISTS public.user_icp_selections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- ICP Configuration Reference
  base_icp_config_id UUID REFERENCES public.icp_configurations(id),
  
  -- User Customizations (allow overriding any section)
  custom_name TEXT,
  custom_description TEXT,
  custom_target_profile JSONB DEFAULT '{}',
  custom_decision_makers JSONB DEFAULT '{}',
  custom_pain_points JSONB DEFAULT '{}',
  custom_buying_process JSONB DEFAULT '{}',
  custom_messaging_strategy JSONB DEFAULT '{}',
  custom_success_metrics JSONB DEFAULT '{}',
  custom_advanced_classification JSONB DEFAULT '{}',
  custom_market_intelligence JSONB DEFAULT '{}',
  
  -- Selection Status
  is_active BOOLEAN DEFAULT TRUE,
  is_primary BOOLEAN DEFAULT FALSE,
  
  -- Performance Tracking
  usage_count INTEGER DEFAULT 0,
  last_campaign_date TIMESTAMPTZ,
  performance_history JSONB DEFAULT '[]',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Create ICP categories table for organizing different ICP types
CREATE TABLE IF NOT EXISTS public.icp_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default ICP categories
INSERT INTO public.icp_categories (name, display_name, description, icon, sort_order) VALUES
('saas_technology', 'SaaS & Technology', 'Software as a Service and technology companies', 'Cpu', 1),
('fintech', 'Financial Technology', 'Financial services and fintech companies', 'DollarSign', 2),
('healthcare', 'Healthcare & MedTech', 'Healthcare, medical technology, and pharmaceutical companies', 'Heart', 3),
('manufacturing', 'Manufacturing', 'Manufacturing, supply chain, and industrial companies', 'Factory', 4),
('professional_services', 'Professional Services', 'Consulting, legal, accounting, and professional services', 'Briefcase', 5),
('ecommerce_retail', 'E-commerce & Retail', 'Online retail, e-commerce platforms, and consumer goods', 'ShoppingCart', 6),
('education', 'Education & EdTech', 'Educational institutions and education technology', 'BookOpen', 7),
('government', 'Government & Public Sector', 'Government agencies and public sector organizations', 'Building', 8),
('media_entertainment', 'Media & Entertainment', 'Media, entertainment, and content companies', 'Video', 9),
('real_estate', 'Real Estate & Construction', 'Real estate, construction, and property management', 'Home', 10);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_icp_configurations_workspace ON public.icp_configurations(workspace_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_icp_configurations_status ON public.icp_configurations(status);
CREATE INDEX IF NOT EXISTS idx_icp_configurations_priority ON public.icp_configurations(priority);
CREATE INDEX IF NOT EXISTS idx_icp_configurations_industry ON public.icp_configurations(industry_vertical);
CREATE INDEX IF NOT EXISTS idx_icp_configurations_tags ON public.icp_configurations USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_icp_configurations_market_niche ON public.icp_configurations(market_niche);

CREATE INDEX IF NOT EXISTS idx_user_icp_selections_user ON public.user_icp_selections(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_icp_selections_workspace ON public.user_icp_selections(workspace_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_icp_selections_primary ON public.user_icp_selections(user_id, is_primary) WHERE is_primary = TRUE;

-- Enable RLS
ALTER TABLE public.icp_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_icp_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icp_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ICP configurations
CREATE POLICY "Users can view ICPs in their workspace" ON public.icp_configurations
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create ICPs in their workspace" ON public.icp_configurations
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update ICPs in their workspace" ON public.icp_configurations
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete ICPs in their workspace" ON public.icp_configurations
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for user ICP selections
CREATE POLICY "Users can manage their own ICP selections" ON public.user_icp_selections
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for ICP categories (public read)
CREATE POLICY "ICP categories are readable by everyone" ON public.icp_categories
  FOR SELECT TO authenticated
  USING (is_active = TRUE);

-- Function to get user's active ICP configuration with customizations
CREATE OR REPLACE FUNCTION get_user_active_icp(p_user_id UUID, p_workspace_id UUID DEFAULT NULL)
RETURNS TABLE(
  selection_id UUID,
  config_id UUID,
  name TEXT,
  display_name TEXT,
  market_niche TEXT,
  industry_vertical TEXT,
  target_profile JSONB,
  decision_makers JSONB,
  pain_points JSONB,
  buying_process JSONB,
  messaging_strategy JSONB,
  success_metrics JSONB,
  advanced_classification JSONB,
  market_intelligence JSONB,
  performance_metrics JSONB,
  is_customized BOOLEAN,
  last_used_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.id as selection_id,
    ic.id as config_id,
    COALESCE(us.custom_name, ic.name) as name,
    COALESCE(us.custom_name, ic.display_name) as display_name,
    ic.market_niche,
    ic.industry_vertical,
    
    -- Merge custom configurations with base configurations
    CASE 
      WHEN us.custom_target_profile != '{}' THEN 
        ic.target_profile || us.custom_target_profile
      ELSE ic.target_profile 
    END as target_profile,
    
    CASE 
      WHEN us.custom_decision_makers != '{}' THEN 
        ic.decision_makers || us.custom_decision_makers
      ELSE ic.decision_makers 
    END as decision_makers,
    
    CASE 
      WHEN us.custom_pain_points != '{}' THEN 
        ic.pain_points || us.custom_pain_points
      ELSE ic.pain_points 
    END as pain_points,
    
    CASE 
      WHEN us.custom_buying_process != '{}' THEN 
        ic.buying_process || us.custom_buying_process
      ELSE ic.buying_process 
    END as buying_process,
    
    CASE 
      WHEN us.custom_messaging_strategy != '{}' THEN 
        ic.messaging_strategy || us.custom_messaging_strategy
      ELSE ic.messaging_strategy 
    END as messaging_strategy,
    
    CASE 
      WHEN us.custom_success_metrics != '{}' THEN 
        ic.success_metrics || us.custom_success_metrics
      ELSE ic.success_metrics 
    END as success_metrics,
    
    CASE 
      WHEN us.custom_advanced_classification != '{}' THEN 
        ic.advanced_classification || us.custom_advanced_classification
      ELSE ic.advanced_classification 
    END as advanced_classification,
    
    CASE 
      WHEN us.custom_market_intelligence != '{}' THEN 
        ic.market_intelligence || us.custom_market_intelligence
      ELSE ic.market_intelligence 
    END as market_intelligence,
    
    ic.performance_metrics,
    
    -- Check if any customizations exist
    (us.custom_target_profile != '{}' OR 
     us.custom_decision_makers != '{}' OR 
     us.custom_pain_points != '{}' OR 
     us.custom_buying_process != '{}' OR 
     us.custom_messaging_strategy != '{}' OR 
     us.custom_success_metrics != '{}' OR
     us.custom_advanced_classification != '{}' OR
     us.custom_market_intelligence != '{}') as is_customized,
     
    us.last_used_at
  FROM public.user_icp_selections us
  JOIN public.icp_configurations ic ON ic.id = us.base_icp_config_id
  WHERE us.user_id = p_user_id 
    AND us.is_active = TRUE 
    AND us.is_primary = TRUE
    AND (p_workspace_id IS NULL OR us.workspace_id = p_workspace_id)
    AND ic.is_active = TRUE
  ORDER BY us.last_used_at DESC NULLS LAST
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set user's primary ICP
CREATE OR REPLACE FUNCTION set_user_primary_icp(
  p_user_id UUID,
  p_config_id UUID,
  p_workspace_id UUID
)
RETURNS UUID AS $$
DECLARE
  selection_id UUID;
BEGIN
  -- Deactivate current primary ICP
  UPDATE public.user_icp_selections 
  SET is_primary = FALSE, updated_at = NOW()
  WHERE user_id = p_user_id 
    AND workspace_id = p_workspace_id 
    AND is_primary = TRUE;
  
  -- Check if user already has this ICP configuration
  SELECT id INTO selection_id
  FROM public.user_icp_selections
  WHERE user_id = p_user_id 
    AND base_icp_config_id = p_config_id
    AND workspace_id = p_workspace_id;
  
  IF selection_id IS NULL THEN
    -- Create new selection
    INSERT INTO public.user_icp_selections (
      user_id, 
      workspace_id, 
      base_icp_config_id, 
      is_active, 
      is_primary, 
      last_used_at
    ) VALUES (
      p_user_id, 
      p_workspace_id, 
      p_config_id, 
      TRUE, 
      TRUE, 
      NOW()
    ) RETURNING id INTO selection_id;
  ELSE
    -- Update existing selection
    UPDATE public.user_icp_selections 
    SET is_primary = TRUE, 
        is_active = TRUE, 
        last_used_at = NOW(),
        updated_at = NOW(),
        usage_count = usage_count + 1
    WHERE id = selection_id;
  END IF;
  
  RETURN selection_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add update triggers
CREATE OR REPLACE FUNCTION update_icp_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_icp_configurations_updated_at 
  BEFORE UPDATE ON public.icp_configurations 
  FOR EACH ROW EXECUTE FUNCTION update_icp_updated_at_column();

CREATE TRIGGER update_user_icp_selections_updated_at 
  BEFORE UPDATE ON public.user_icp_selections 
  FOR EACH ROW EXECUTE FUNCTION update_icp_updated_at_column();

-- Comments
COMMENT ON TABLE public.icp_configurations IS 'Comprehensive ICP configurations with 8 major knowledge categories and 40+ subcategories';
COMMENT ON TABLE public.user_icp_selections IS 'User-selected and customized ICP configurations with performance tracking';
COMMENT ON TABLE public.icp_categories IS 'ICP category definitions for organizing different ICP types';
COMMENT ON FUNCTION get_user_active_icp IS 'Get user''s currently active ICP configuration with all customizations merged';
COMMENT ON FUNCTION set_user_primary_icp IS 'Set user''s primary ICP configuration and track usage';