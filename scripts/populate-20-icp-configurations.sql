-- Populate 20 B2B Market Niche ICP Configurations
-- Based on the verticals from SAM's knowledge: SaaS, Financial Services, Pharma, Healthcare, Legal, Manufacturing, Energy, Oil & Gas, Telecom, Consulting, Marketing, Recruiting, Coaching, Logistics, Construction, Commercial Real Estate, IT Services, Education, Startups, SMEs

-- Clear existing ICP configurations
DELETE FROM icp_configurations WHERE is_template = TRUE;

-- 1. SaaS & Software Companies
INSERT INTO icp_configurations (
  name, display_name, description, market_niche, industry_vertical,
  target_profile, decision_makers, pain_points, buying_process, messaging_strategy, success_metrics, tags
) VALUES (
  'saas_software',
  'SaaS & Software Companies',
  'Software as a Service and B2B Software companies focused on cloud-native, API-first solutions',
  'technology',
  'SaaS',
  '{
    "company_size": "50-2000 employees",
    "revenue_range": "$5M-$100M ARR",
    "growth_stage": "Series A to IPO",
    "technology_focus": "Cloud-native, API-first, subscription model",
    "business_model": "B2B SaaS, Platform, Subscription"
  }'::jsonb,
  '{
    "primary": ["CTO", "VP Engineering", "Head of Product", "CEO (early-stage)"],
    "secondary": ["VP Sales", "VP Marketing", "Head of Growth"],
    "budget_authority": "Department-level approval",
    "decision_timeline": "2-8 weeks"
  }'::jsonb,
  '{
    "main_triggers": ["Scaling infrastructure challenges", "Technical debt accumulation", "Developer productivity bottlenecks", "Customer churn issues"],
    "business_drivers": ["Product-market fit optimization", "Team growth", "Performance bottlenecks", "Competitive pressure"],
    "urgency_indicators": ["System outages", "Scaling failures", "Developer complaints", "Customer churn spikes"]
  }'::jsonb,
  '{
    "timeline": "2-8 weeks",
    "process": "Technical validation first",
    "evaluation_criteria": ["Technical architecture", "Integration capabilities", "Developer experience"],
    "decision_factors": ["API quality", "Documentation", "Community support", "Performance metrics"],
    "proof_points": ["Technical demos", "Pilot implementations", "Case studies"]
  }'::jsonb,
  '{
    "tone": "Technical and direct",
    "content_preferences": ["Technical specifications", "Architecture diagrams", "Performance benchmarks"],
    "channels": ["Email", "Slack", "GitHub", "Developer forums"],
    "avoid": ["Sales-heavy language", "Buzzwords", "Non-technical pitches"]
  }'::jsonb,
  '{
    "primary_metrics": "50% faster development cycles",
    "roi_expectation": "3x ROI in 12 months through automation",
    "performance_improvement": "Reduced churn by 20% through better onboarding",
    "efficiency_gains": "40-60% improvement in key metrics"
  }'::jsonb,
  ARRAY['saas', 'software', 'technology', 'b2b', 'cloud', 'api', 'subscription', 'development']
);

-- 2. Financial Services & Fintech
INSERT INTO icp_configurations (
  name, display_name, description, market_niche, industry_vertical,
  target_profile, decision_makers, pain_points, buying_process, messaging_strategy, success_metrics, tags
) VALUES (
  'financial_services',
  'Financial Services & Fintech',
  'Banks, credit unions, investment firms, fintech companies with heavy regulatory requirements',
  'financial',
  'Financial Services',
  '{
    "company_size": "200-10000+ employees",
    "revenue_range": "$50M-$10B revenue",
    "regulatory_focus": "SOX, FINRA, SEC, PCI DSS, MiFID II, DORA compliance",
    "technology_stack": "Legacy systems, digital transformation initiatives",
    "business_model": "Banking, Investment, Insurance, Fintech"
  }'::jsonb,
  '{
    "primary": ["CRO (Chief Risk Officer)", "CTO", "Compliance Officer", "CFO"],
    "secondary": ["VP Technology", "Director of Risk Management", "CISO"],
    "budget_authority": "Board-level approval for major purchases",
    "decision_timeline": "9-24 months"
  }'::jsonb,
  '{
    "main_triggers": ["Regulatory compliance complexity", "Risk management optimization", "Audit preparation", "Digital transformation pressures"],
    "business_drivers": ["Operational efficiency mandates", "Competitive pressure", "Cost reduction", "Customer experience"],
    "urgency_indicators": ["Regulatory changes", "Audit findings", "Compliance violations", "Security breaches"]
  }'::jsonb,
  '{
    "timeline": "9-24 months",
    "process": "Risk mitigation focused, formal vendor management",
    "evaluation_criteria": ["Regulatory compliance", "Risk framework", "Financial controls"],
    "decision_factors": ["Audit trail capability", "Reporting functionality", "Integration risk"],
    "proof_points": ["Compliance certifications", "Audit reports", "Reference customers"]
  }'::jsonb,
  '{
    "tone": "Formal and risk-aware",
    "content_preferences": ["Regulatory compliance docs", "Risk assessments", "Audit reports"],
    "channels": ["Formal proposals", "Scheduled presentations", "Documented communications"],
    "avoid": ["Casual language", "Unverified claims", "Rushed timelines"]
  }'::jsonb,
  '{
    "primary_metrics": "45% reduction in compliance costs",
    "roi_expectation": "3x ROI via automated SEC/FINRA reporting",
    "performance_improvement": "50% faster audit preparation",
    "efficiency_gains": "40-60% improvement in operational efficiency"
  }'::jsonb,
  ARRAY['financial', 'fintech', 'banking', 'compliance', 'risk', 'regulatory', 'sox', 'finra', 'sec']
);

-- 3. Healthcare & Life Sciences
INSERT INTO icp_configurations (
  name, display_name, description, market_niche, industry_vertical,
  target_profile, decision_makers, pain_points, buying_process, messaging_strategy, success_metrics, tags
) VALUES (
  'healthcare',
  'Healthcare & Life Sciences',
  'Hospitals, health systems, medical practices with strict HIPAA and patient privacy requirements',
  'healthcare',
  'Healthcare',
  '{
    "company_size": "100-50000+ employees",
    "revenue_range": "$10M-$50B revenue",
    "regulatory_focus": "HIPAA, GDPR, FDA regulations, state health laws",
    "technology_stack": "EHR systems, clinical workflows, patient data management",
    "business_model": "Healthcare providers, Health systems, Medical practices"
  }'::jsonb,
  '{
    "primary": ["CIO", "CISO", "Chief Medical Officer", "Compliance Officer"],
    "secondary": ["VP Clinical Operations", "Director of IT", "Practice Administrators"],
    "budget_authority": "C-suite approval required",
    "decision_timeline": "6-18 months"
  }'::jsonb,
  '{
    "main_triggers": ["Patient data management complexity", "HIPAA compliance requirements", "Clinical workflow optimization"],
    "business_drivers": ["Operational efficiency improvements", "Digital health transformation", "Patient outcomes"],
    "urgency_indicators": ["Regulatory changes", "Data breach concerns", "Efficiency mandates", "Patient complaints"]
  }'::jsonb,
  '{
    "timeline": "6-18 months",
    "process": "Risk assessment first, formal RFP process",
    "evaluation_criteria": ["HIPAA compliance", "Clinical integration", "Security framework"],
    "decision_factors": ["Compliance documentation", "Security certifications", "Clinical outcomes"],
    "proof_points": ["Compliance audits", "Security assessments", "Clinical validation"]
  }'::jsonb,
  '{
    "tone": "Conservative and evidence-based",
    "content_preferences": ["Compliance documentation", "Clinical evidence", "Security frameworks"],
    "channels": ["Formal email", "Scheduled calls", "In-person meetings"],
    "avoid": ["Aggressive sales tactics", "Unsubstantiated claims", "Casual communication"]
  }'::jsonb,
  '{
    "primary_metrics": "60% improvement in patient satisfaction",
    "roi_expectation": "Improved patient outcomes 15%",
    "performance_improvement": "Reduced compliance risk with HIPAA automation",
    "efficiency_gains": "40-50% improvement in clinical workflows"
  }'::jsonb,
  ARRAY['healthcare', 'medical', 'hipaa', 'clinical', 'patient', 'compliance', 'ehr', 'hospital']
);

-- 4. Legal Services & Law Firms
INSERT INTO icp_configurations (
  name, display_name, description, market_niche, industry_vertical,
  target_profile, decision_makers, pain_points, buying_process, messaging_strategy, success_metrics, tags
) VALUES (
  'legal',
  'Legal Services & Law Firms',
  'Law firms and corporate legal departments with attorney-client privilege and ethical requirements',
  'legal',
  'Legal',
  '{
    "company_size": "10-5000+ attorneys",
    "revenue_range": "$5M-$5B revenue",
    "practice_areas": "Corporate, Litigation, IP, Real Estate, Family Law",
    "technology_focus": "Practice management, document review, legal research",
    "business_model": "Law firms, Corporate legal departments, Legal tech"
  }'::jsonb,
  '{
    "primary": ["Managing Partner", "Practice Group Leaders", "IT Director"],
    "secondary": ["General Counsel", "Legal Operations Director", "Firm Administrator"],
    "budget_authority": "Partnership or board approval",
    "decision_timeline": "3-12 months"
  }'::jsonb,
  '{
    "main_triggers": ["Attorney-client privilege protection", "Conflict checking requirements", "Professional liability concerns"],
    "business_drivers": ["Efficiency pressures", "Billable hour optimization", "Client demands for technology"],
    "urgency_indicators": ["Ethical violations", "Malpractice concerns", "Client complaints", "Competitive pressure"]
  }'::jsonb,
  '{
    "timeline": "3-12 months",
    "process": "Risk and ethics first, committee-based decisions",
    "evaluation_criteria": ["Ethical compliance", "Confidentiality protection", "Professional liability"],
    "decision_factors": ["Bar approval", "Malpractice implications", "Client acceptance"],
    "proof_points": ["Ethical opinions", "Malpractice clearance", "Peer validation"]
  }'::jsonb,
  '{
    "tone": "Professional and conservative",
    "content_preferences": ["Ethical analysis", "Professional liability assessment", "Peer endorsements"],
    "channels": ["Formal correspondence", "Professional presentations", "Referral introductions"],
    "avoid": ["Automation fears", "Ethical shortcuts", "Pressure tactics"]
  }'::jsonb,
  '{
    "primary_metrics": "40% improvement in document review efficiency",
    "roi_expectation": "30% reduction in conflict checking time",
    "performance_improvement": "Enhanced client service delivery",
    "efficiency_gains": "25-35% improvement in billable hour efficiency"
  }'::jsonb,
  ARRAY['legal', 'law', 'attorney', 'lawyer', 'litigation', 'compliance', 'ethics', 'privilege']
);

-- 5. Manufacturing & Industrial
INSERT INTO icp_configurations (
  name, display_name, description, market_niche, industry_vertical,
  target_profile, decision_makers, pain_points, buying_process, messaging_strategy, success_metrics, tags
) VALUES (
  'manufacturing',
  'Manufacturing & Industrial',
  'Manufacturing companies focused on production efficiency and supply chain optimization',
  'manufacturing',
  'Manufacturing',
  '{
    "company_size": "200-20000+ employees",
    "revenue_range": "$50M-$10B revenue",
    "operations_focus": "Production facilities, supply chain, quality control",
    "standards": "ISO 9001, Six Sigma, Lean Manufacturing, OSHA compliance",
    "business_model": "Manufacturing, Industrial equipment, Automotive, Aerospace"
  }'::jsonb,
  '{
    "primary": ["VP Operations", "Plant Manager", "Supply Chain Director"],
    "secondary": ["Manufacturing Director", "Quality Manager", "CFO", "VP Technology"],
    "budget_authority": "CAPEX committee approval",
    "decision_timeline": "6-18 months"
  }'::jsonb,
  '{
    "main_triggers": ["Supply chain optimization needs", "Quality control improvements", "Predictive maintenance"],
    "business_drivers": ["Production efficiency targets", "Cost reduction pressures", "Safety compliance"],
    "urgency_indicators": ["Equipment failures", "Quality issues", "Safety incidents", "Cost overruns"]
  }'::jsonb,
  '{
    "timeline": "6-18 months",
    "process": "Operational impact assessment, CAPEX budgeting cycle",
    "evaluation_criteria": ["Operational efficiency", "Cost-benefit analysis", "Integration complexity"],
    "decision_factors": ["Payback period", "Productivity gains", "Implementation risk"],
    "proof_points": ["Plant visits", "Pilot programs", "ROI calculations"]
  }'::jsonb,
  '{
    "tone": "Practical and results-focused",
    "content_preferences": ["Efficiency metrics", "Cost analysis", "Implementation case studies"],
    "channels": ["Trade publications", "Industry events", "Plant visits"],
    "avoid": ["Theoretical benefits", "Complex technology descriptions", "Rushed implementation"]
  }'::jsonb,
  '{
    "primary_metrics": "35% reduction in operational costs",
    "roi_expectation": "25% improvement in production efficiency",
    "performance_improvement": "30% reduction in maintenance costs",
    "efficiency_gains": "20-40% improvement in overall equipment effectiveness"
  }'::jsonb,
  ARRAY['manufacturing', 'industrial', 'production', 'supply_chain', 'quality', 'lean', 'iso', 'osha']
);

-- Continue with the remaining 15 ICPs (6-20)
-- 6. Energy & Oil & Gas
INSERT INTO icp_configurations (
  name, display_name, description, market_niche, industry_vertical,
  target_profile, decision_makers, pain_points, buying_process, messaging_strategy, success_metrics, tags
) VALUES (
  'energy',
  'Energy & Oil & Gas',
  'Energy companies including oil & gas, renewable energy, utilities with safety and regulatory focus',
  'energy',
  'Energy',
  '{
    "company_size": "500-50000+ employees",
    "revenue_range": "$100M-$100B revenue",
    "operations_focus": "Exploration, production, refining, distribution, power generation",
    "regulatory_compliance": "EPA, OSHA, DOE, state utility commissions",
    "business_model": "Oil & gas, Renewable energy, Utilities, Power generation"
  }'::jsonb,
  '{
    "primary": ["VP Operations", "Chief Engineer", "Plant Manager"],
    "secondary": ["Director of HSE", "CTO", "VP Technology", "Engineering Director"],
    "budget_authority": "Executive committee approval",
    "decision_timeline": "12-36 months"
  }'::jsonb,
  '{
    "main_triggers": ["Operational safety and compliance", "Environmental regulatory requirements", "Asset optimization"],
    "business_drivers": ["Energy efficiency improvements", "Digital transformation", "Cost reduction"],
    "urgency_indicators": ["Safety incidents", "Regulatory violations", "Equipment failures", "Environmental concerns"]
  }'::jsonb,
  '{
    "timeline": "12-36 months",
    "process": "Safety and regulatory assessment first",
    "evaluation_criteria": ["Safety compliance", "Environmental impact", "Operational efficiency"],
    "decision_factors": ["Regulatory approval", "Safety improvements", "ROI"],
    "proof_points": ["Safety case studies", "Regulatory compliance", "Operational metrics"]
  }'::jsonb,
  '{
    "tone": "Safety-focused and technically rigorous",
    "content_preferences": ["Safety case studies", "Regulatory compliance docs", "Operational metrics"],
    "channels": ["Industry conferences", "Trade publications", "Peer referrals"],
    "avoid": ["Unproven technology claims", "Rushed implementation timelines"]
  }'::jsonb,
  '{
    "primary_metrics": "40% improvement in asset utilization",
    "roi_expectation": "25% reduction in safety incidents",
    "performance_improvement": "20% improvement in energy efficiency",
    "efficiency_gains": "30-50% improvement in operational metrics"
  }'::jsonb,
  ARRAY['energy', 'oil', 'gas', 'utility', 'renewable', 'petroleum', 'power', 'epa', 'safety', 'hse']
);

-- 7. Telecommunications & Wireless
INSERT INTO icp_configurations (
  name, display_name, description, market_niche, industry_vertical,
  target_profile, decision_makers, pain_points, buying_process, messaging_strategy, success_metrics, tags
) VALUES (
  'telecom',
  'Telecommunications & Wireless',
  'Telecom carriers and wireless providers focused on network performance and 5G rollout',
  'telecom',
  'Telecommunications',
  '{
    "company_size": "1000-100000+ employees",
    "revenue_range": "$500M-$100B revenue",
    "technology_focus": "5G, Fiber, Wireless Networks, Network Operations Centers",
    "services": "Consumer, Enterprise, Wholesale telecommunications",
    "business_model": "Telecom carriers, Wireless providers, Network infrastructure"
  }'::jsonb,
  '{
    "primary": ["CTO", "VP Network Operations", "Chief Engineer"],
    "secondary": ["VP Technology Strategy", "Director of Network Planning", "VP Enterprise Solutions"],
    "budget_authority": "Technology committee and board approval",
    "decision_timeline": "12-24 months"
  }'::jsonb,
  '{
    "main_triggers": ["Network optimization and capacity planning", "5G rollout", "Customer experience improvement"],
    "business_drivers": ["Operational cost reduction", "Competitive pressure", "Technology advancement"],
    "urgency_indicators": ["Network congestion", "Customer complaints", "Competitive threats", "Technology obsolescence"]
  }'::jsonb,
  '{
    "timeline": "12-24 months",
    "process": "Technical evaluation and network impact assessment",
    "evaluation_criteria": ["Network performance", "Scalability", "Integration complexity"],
    "decision_factors": ["Performance improvements", "Cost savings", "Implementation risk"],
    "proof_points": ["Network performance metrics", "Scalability studies", "Technical specifications"]
  }'::jsonb,
  '{
    "tone": "Technical and performance-focused",
    "content_preferences": ["Network performance metrics", "Scalability studies", "Technical specifications"],
    "channels": ["Industry events", "Technical conferences", "Vendor partnerships"],
    "avoid": ["Consumer-focused messaging", "Oversimplified technical claims"]
  }'::jsonb,
  '{
    "primary_metrics": "30% improvement in network efficiency",
    "roi_expectation": "50% reduction in operational overhead",
    "performance_improvement": "25% improvement in customer satisfaction scores",
    "efficiency_gains": "40-60% improvement in network performance"
  }'::jsonb,
  ARRAY['telecom', 'wireless', 'network', '5g', 'fiber', 'broadband', 'carrier', 'infrastructure']
);

-- 8. Professional Services - Consulting
INSERT INTO icp_configurations (
  name, display_name, description, market_niche, industry_vertical,
  target_profile, decision_makers, pain_points, buying_process, messaging_strategy, success_metrics, tags
) VALUES (
  'consulting',
  'Professional Services - Consulting',
  'Management and IT consulting firms focused on client delivery efficiency and expertise scaling',
  'consulting',
  'Professional Services',
  '{
    "company_size": "20-10000+ employees",
    "revenue_range": "$5M-$10B revenue",
    "specializations": "Digital transformation, process optimization, technology implementation",
    "clients": "Fortune 500, mid-market, government",
    "business_model": "Management consulting, IT consulting, Strategy consulting"
  }'::jsonb,
  '{
    "primary": ["Managing Director", "Practice Leaders", "Partner"],
    "secondary": ["VP Delivery", "Director of Operations", "Chief Innovation Officer"],
    "budget_authority": "Practice or firm-level approval",
    "decision_timeline": "3-9 months"
  }'::jsonb,
  '{
    "main_triggers": ["Project delivery efficiency", "Resource utilization optimization", "Client satisfaction"],
    "business_drivers": ["Knowledge management", "Scaling expertise", "Competitive differentiation"],
    "urgency_indicators": ["Project delays", "Resource constraints", "Client complaints", "Competitive pressure"]
  }'::jsonb,
  '{
    "timeline": "3-9 months",
    "process": "ROI-focused evaluation, pilot programs",
    "evaluation_criteria": ["Productivity gains", "Client value enhancement", "Competitive advantage"],
    "decision_factors": ["ROI projections", "Implementation ease", "Scalability"],
    "proof_points": ["ROI studies", "Productivity metrics", "Client success stories"]
  }'::jsonb,
  '{
    "tone": "Results-oriented and strategic",
    "content_preferences": ["ROI studies", "Productivity metrics", "Client success stories"],
    "channels": ["Industry networks", "Professional associations", "Referrals"],
    "avoid": ["Generic solutions", "One-size-fits-all approaches"]
  }'::jsonb,
  '{
    "primary_metrics": "40% improvement in project delivery efficiency",
    "roi_expectation": "25% increase in consultant utilization rates",
    "performance_improvement": "35% improvement in client satisfaction scores",
    "efficiency_gains": "30-50% improvement in operational metrics"
  }'::jsonb,
  ARRAY['consulting', 'professional_services', 'management', 'strategy', 'transformation', 'advisory']
);

-- 9. Marketing & Advertising Agencies
INSERT INTO icp_configurations (
  name, display_name, description, market_niche, industry_vertical,
  target_profile, decision_makers, pain_points, buying_process, messaging_strategy, success_metrics, tags
) VALUES (
  'marketing',
  'Marketing & Advertising Agencies',
  'Digital marketing and advertising agencies focused on campaign performance and client results',
  'marketing',
  'Marketing',
  '{
    "company_size": "10-2000+ employees",
    "revenue_range": "$2M-$500M revenue",
    "specializations": "Digital marketing, brand strategy, content creation, performance marketing",
    "clients": "B2B, B2C, e-commerce, local businesses",
    "business_model": "Digital marketing, Advertising agencies, Creative agencies, PR firms"
  }'::jsonb,
  '{
    "primary": ["Agency Owner", "Managing Director", "VP Client Services"],
    "secondary": ["Creative Director", "Head of Strategy", "New Business Director"],
    "budget_authority": "Department or agency-level approval",
    "decision_timeline": "1-6 months"
  }'::jsonb,
  '{
    "main_triggers": ["Client acquisition and retention", "Campaign performance optimization", "Resource management"],
    "business_drivers": ["Scaling creative operations", "Proving ROI to clients", "Competitive differentiation"],
    "urgency_indicators": ["Client churn", "Poor campaign performance", "Resource bottlenecks", "New business pressure"]
  }'::jsonb,
  '{
    "timeline": "1-6 months",
    "process": "Performance and ROI focused",
    "evaluation_criteria": ["Campaign improvement potential", "Operational efficiency", "Client value"],
    "decision_factors": ["Performance metrics", "Cost-effectiveness", "Implementation speed"],
    "proof_points": ["Campaign performance metrics", "Creative efficiency gains", "Client success stories"]
  }'::jsonb,
  '{
    "tone": "Creative and results-driven",
    "content_preferences": ["Campaign performance metrics", "Creative efficiency gains", "Client success stories"],
    "channels": ["Industry events", "Digital marketing communities", "Peer networks"],
    "avoid": ["Generic marketing promises", "Complex technical jargon"]
  }'::jsonb,
  '{
    "primary_metrics": "50% improvement in campaign performance",
    "roi_expectation": "30% increase in client retention",
    "performance_improvement": "40% improvement in creative production efficiency",
    "efficiency_gains": "35-55% improvement in campaign metrics"
  }'::jsonb,
  ARRAY['marketing', 'advertising', 'agency', 'digital', 'creative', 'campaigns', 'roi', 'clients']
);

-- 10. Startups (Early Stage)
INSERT INTO icp_configurations (
  name, display_name, description, market_niche, industry_vertical,
  target_profile, decision_makers, pain_points, buying_process, messaging_strategy, success_metrics, tags
) VALUES (
  'startups',
  'Startups (Early Stage)',
  'Early-stage startups across all verticals focused on rapid growth and scaling efficiently',
  'startups',
  'Startups',
  '{
    "company_size": "5-100 employees",
    "revenue_range": "$100K-$10M revenue",
    "funding_stage": "Pre-seed to Series A, bootstrapped to VC-backed",
    "focus_areas": "Product-market fit, rapid growth, operational efficiency",
    "business_model": "Early-stage startups across all verticals"
  }'::jsonb,
  '{
    "primary": ["CEO", "Co-founder", "CTO"],
    "secondary": ["VP Growth", "Head of Operations", "VP Sales"],
    "budget_authority": "Founder or C-level approval",
    "decision_timeline": "1-6 months"
  }'::jsonb,
  '{
    "main_triggers": ["Scaling operations efficiently", "Product-market fit optimization", "Customer acquisition"],
    "business_drivers": ["Fundraising preparation", "Resource optimization", "Competitive advantage"],
    "urgency_indicators": ["Growth stagnation", "Cash burn", "Competitive pressure", "Investor pressure"]
  }'::jsonb,
  '{
    "timeline": "1-6 months",
    "process": "Speed and ROI focused, informal evaluation",
    "evaluation_criteria": ["Immediate impact", "Cost-effectiveness", "Scalability"],
    "decision_factors": ["Growth potential", "Resource efficiency", "Implementation speed"],
    "proof_points": ["Growth metrics", "Startup success stories", "Rapid implementation"]
  }'::jsonb,
  '{
    "tone": "Growth-focused and agile",
    "content_preferences": ["Growth metrics", "Startup success stories", "Rapid implementation"],
    "channels": ["Startup communities", "Accelerators", "Investor networks"],
    "avoid": ["Enterprise complexity", "Lengthy implementation timelines"]
  }'::jsonb,
  '{
    "primary_metrics": "100% improvement in operational efficiency",
    "roi_expectation": "200% increase in growth metrics",
    "performance_improvement": "50% reduction in customer acquisition costs",
    "efficiency_gains": "80-150% improvement in key startup metrics"
  }'::jsonb,
  ARRAY['startups', 'early_stage', 'founders', 'growth', 'scaling', 'product_market_fit', 'venture']
);

-- 11. Recruiting & Staffing
INSERT INTO icp_configurations (
  name, display_name, description, market_niche, industry_vertical,
  target_profile, decision_makers, pain_points, buying_process, messaging_strategy, success_metrics, tags
) VALUES (
  'recruiting',
  'Recruiting & Staffing',
  'Recruiting agencies and corporate talent acquisition teams focused on candidate sourcing and placement',
  'recruiting',
  'Recruiting',
  '{
    "company_size": "10-5000+ employees",
    "revenue_range": "$1M-$500M revenue",
    "specializations": "Executive search, contract staffing, permanent placement, RPO",
    "markets": "Technology, Healthcare, Finance, Executive, Contract staffing",
    "business_model": "Recruiting agencies, Corporate HR, Executive search, Staffing firms"
  }'::jsonb,
  '{
    "primary": ["VP Talent Acquisition", "Recruiting Director", "Agency Owner"],
    "secondary": ["Head of HR", "Branch Manager", "Senior Recruiters"],
    "budget_authority": "Department or division-level approval",
    "decision_timeline": "2-6 months"
  }'::jsonb,
  '{
    "main_triggers": ["Candidate sourcing challenges", "Time-to-fill optimization", "Quality of hire improvement"],
    "business_drivers": ["Competitive talent market", "Client demands", "Revenue per recruiter"],
    "urgency_indicators": ["Difficult requisitions", "Client complaints", "Recruiter productivity", "Market competition"]
  }'::jsonb,
  '{
    "timeline": "2-6 months",
    "process": "ROI and productivity focused",
    "evaluation_criteria": ["Sourcing efficiency", "Placement rates", "Time-to-fill reduction"],
    "decision_factors": ["Productivity gains", "Cost per hire", "Quality metrics"],
    "proof_points": ["Placement success metrics", "Time-to-fill improvements", "ROI calculations"]
  }'::jsonb,
  '{
    "tone": "Results-driven and competitive",
    "content_preferences": ["Placement success metrics", "Time-to-fill improvements", "ROI calculations"],
    "channels": ["Industry associations", "Recruiting conferences", "Professional networks"],
    "avoid": ["Generic HR solutions", "Complex technical implementations"]
  }'::jsonb,
  '{
    "primary_metrics": "50% improvement in sourcing efficiency",
    "roi_expectation": "40% reduction in time-to-fill",
    "performance_improvement": "30% increase in placement rates",
    "efficiency_gains": "35-60% improvement in recruiting metrics"
  }'::jsonb,
  ARRAY['recruiting', 'staffing', 'talent', 'hr', 'sourcing', 'placement', 'hiring', 'headhunting']
);

-- 12. Executive Coaching & Training
INSERT INTO icp_configurations (
  name, display_name, description, market_niche, industry_vertical,
  target_profile, decision_makers, pain_points, buying_process, messaging_strategy, success_metrics, tags
) VALUES (
  'coaching',
  'Executive Coaching & Training',
  'Executive coaches, leadership development consultants, and corporate training organizations',
  'coaching',
  'Professional Development',
  '{
    "company_size": "1-500 employees",
    "revenue_range": "$100K-$50M revenue",
    "specializations": "Executive coaching, leadership development, team building, skills training",
    "clients": "C-suite executives, high-potential leaders, corporate teams",
    "business_model": "Independent coaches, Coaching firms, Corporate training, Leadership development"
  }'::jsonb,
  '{
    "primary": ["Coach/Owner", "VP Learning & Development", "Head of Talent"],
    "secondary": ["CEO", "CHRO", "Practice Leaders"],
    "budget_authority": "Individual or corporate approval",
    "decision_timeline": "1-4 months"
  }'::jsonb,
  '{
    "main_triggers": ["Client engagement and outcomes", "Scaling coaching practice", "Measuring impact"],
    "business_drivers": ["Client success stories", "Practice growth", "Competitive differentiation"],
    "urgency_indicators": ["Client retention issues", "Outcome measurement challenges", "Practice stagnation"]
  }'::jsonb,
  '{
    "timeline": "1-4 months",
    "process": "Outcome and impact focused",
    "evaluation_criteria": ["Client success measurement", "Practice efficiency", "Competitive advantage"],
    "decision_factors": ["Impact metrics", "Client satisfaction", "Practice scalability"],
    "proof_points": ["Client success stories", "Outcome measurements", "Practice growth metrics"]
  }'::jsonb,
  '{
    "tone": "Professional and impact-focused",
    "content_preferences": ["Client success stories", "Outcome measurements", "Practice growth metrics"],
    "channels": ["Professional coaching networks", "Leadership conferences", "Referrals"],
    "avoid": ["Generic training solutions", "Unproven methodologies"]
  }'::jsonb,
  '{
    "primary_metrics": "60% improvement in client outcomes",
    "roi_expectation": "40% increase in practice efficiency",
    "performance_improvement": "50% improvement in client engagement",
    "efficiency_gains": "30-50% improvement in coaching effectiveness"
  }'::jsonb,
  ARRAY['coaching', 'executive', 'leadership', 'training', 'development', 'consulting', 'mentoring']
);

-- 13. Logistics & Supply Chain
INSERT INTO icp_configurations (
  name, display_name, description, market_niche, industry_vertical,
  target_profile, decision_makers, pain_points, buying_process, messaging_strategy, success_metrics, tags
) VALUES (
  'logistics',
  'Logistics & Supply Chain',
  'Logistics companies, freight forwarders, and supply chain management organizations',
  'logistics',
  'Logistics',
  '{
    "company_size": "50-10000+ employees",
    "revenue_range": "$10M-$10B revenue",
    "operations": "Freight forwarding, warehouse management, distribution, last-mile delivery",
    "specializations": "International shipping, domestic transport, e-commerce fulfillment",
    "business_model": "3PL providers, Freight forwarders, Warehouse operators, Transportation companies"
  }'::jsonb,
  '{
    "primary": ["VP Operations", "Supply Chain Director", "Logistics Manager"],
    "secondary": ["CFO", "VP Technology", "Warehouse Manager", "Transportation Director"],
    "budget_authority": "Operations or executive approval",
    "decision_timeline": "4-12 months"
  }'::jsonb,
  '{
    "main_triggers": ["Operational efficiency optimization", "Cost reduction pressures", "Customer service improvements"],
    "business_drivers": ["E-commerce growth", "Labor shortages", "Technology modernization"],
    "urgency_indicators": ["Capacity constraints", "Service failures", "Cost overruns", "Customer complaints"]
  }'::jsonb,
  '{
    "timeline": "4-12 months",
    "process": "Operational impact and ROI assessment",
    "evaluation_criteria": ["Efficiency improvements", "Cost reduction", "Service quality"],
    "decision_factors": ["Operational ROI", "Implementation complexity", "Scalability"],
    "proof_points": ["Efficiency metrics", "Cost savings", "Service improvements"]
  }'::jsonb,
  '{
    "tone": "Efficiency and results-focused",
    "content_preferences": ["Efficiency metrics", "Cost savings", "Service improvements"],
    "channels": ["Industry trade shows", "Supply chain conferences", "Professional associations"],
    "avoid": ["Complex technical jargon", "Unproven efficiency claims"]
  }'::jsonb,
  '{
    "primary_metrics": "35% reduction in operational costs",
    "roi_expectation": "25% improvement in delivery efficiency",
    "performance_improvement": "40% improvement in warehouse productivity",
    "efficiency_gains": "30-50% improvement in logistics metrics"
  }'::jsonb,
  ARRAY['logistics', 'supply_chain', 'freight', 'warehouse', 'shipping', 'distribution', '3pl', 'transportation']
);

-- 14. Construction & Real Estate Development
INSERT INTO icp_configurations (
  name, display_name, description, market_niche, industry_vertical,
  target_profile, decision_makers, pain_points, buying_process, messaging_strategy, success_metrics, tags
) VALUES (
  'construction',
  'Construction & Real Estate Development',
  'Construction companies, real estate developers, and property management firms',
  'construction',
  'Construction',
  '{
    "company_size": "20-5000+ employees",
    "revenue_range": "$5M-$5B revenue",
    "project_types": "Commercial, Residential, Industrial, Infrastructure",
    "specializations": "General contracting, Development, Property management, Construction services",
    "business_model": "General contractors, Real estate developers, Property managers, Specialty contractors"
  }'::jsonb,
  '{
    "primary": ["Project Manager", "Construction Manager", "VP Operations"],
    "secondary": ["Owner", "CFO", "Development Director", "Site Supervisor"],
    "budget_authority": "Project or company-level approval",
    "decision_timeline": "3-12 months"
  }'::jsonb,
  '{
    "main_triggers": ["Project delivery optimization", "Cost control", "Safety compliance"],
    "business_drivers": ["Margin improvement", "Schedule adherence", "Quality control"],
    "urgency_indicators": ["Project delays", "Cost overruns", "Safety incidents", "Quality issues"]
  }'::jsonb,
  '{
    "timeline": "3-12 months",
    "process": "Project impact and cost-benefit focused",
    "evaluation_criteria": ["Project efficiency", "Cost savings", "Safety improvements"],
    "decision_factors": ["ROI on projects", "Implementation ease", "Safety benefits"],
    "proof_points": ["Project success metrics", "Cost savings", "Safety improvements"]
  }'::jsonb,
  '{
    "tone": "Practical and safety-focused",
    "content_preferences": ["Project success metrics", "Cost savings", "Safety improvements"],
    "channels": ["Construction trade shows", "Industry publications", "Contractor networks"],
    "avoid": ["Complex technology descriptions", "Theoretical benefits"]
  }'::jsonb,
  '{
    "primary_metrics": "25% improvement in project delivery times",
    "roi_expectation": "20% reduction in project costs",
    "performance_improvement": "30% improvement in safety metrics",
    "efficiency_gains": "25-40% improvement in construction efficiency"
  }'::jsonb,
  ARRAY['construction', 'real_estate', 'development', 'building', 'contractor', 'property', 'projects', 'safety']
);

-- 15. Commercial Real Estate
INSERT INTO icp_configurations (
  name, display_name, description, market_niche, industry_vertical,
  target_profile, decision_makers, pain_points, buying_process, messaging_strategy, success_metrics, tags
) VALUES (
  'commercial_real_estate',
  'Commercial Real Estate',
  'Commercial real estate brokers, property managers, and investment firms',
  'real_estate',
  'Commercial Real Estate',
  '{
    "company_size": "5-2000+ employees",
    "revenue_range": "$1M-$1B revenue",
    "property_types": "Office, Retail, Industrial, Multifamily, Hospitality",
    "services": "Brokerage, Property management, Investment, Development",
    "business_model": "Commercial brokers, Property managers, REIT, Investment firms"
  }'::jsonb,
  '{
    "primary": ["Broker/Owner", "Property Manager", "Investment Director"],
    "secondary": ["VP Leasing", "Asset Manager", "Development Director"],
    "budget_authority": "Individual or firm-level approval",
    "decision_timeline": "2-8 months"
  }'::jsonb,
  '{
    "main_triggers": ["Client acquisition and retention", "Property performance optimization", "Market intelligence"],
    "business_drivers": ["Deal flow", "Property values", "Operational efficiency"],
    "urgency_indicators": ["Market competition", "Property vacancies", "Client demands", "Economic pressures"]
  }'::jsonb,
  '{
    "timeline": "2-8 months",
    "process": "ROI and competitive advantage focused",
    "evaluation_criteria": ["Business development impact", "Operational efficiency", "Market advantage"],
    "decision_factors": ["Revenue potential", "Competitive edge", "Cost-effectiveness"],
    "proof_points": ["Deal success metrics", "Market intelligence", "Operational improvements"]
  }'::jsonb,
  '{
    "tone": "Professional and market-focused",
    "content_preferences": ["Deal success metrics", "Market intelligence", "Operational improvements"],
    "channels": ["Industry associations", "Real estate events", "Professional networks"],
    "avoid": ["Generic sales pitches", "Complex technical solutions"]
  }'::jsonb,
  '{
    "primary_metrics": "40% increase in deal flow",
    "roi_expectation": "30% improvement in property performance",
    "performance_improvement": "35% increase in client satisfaction",
    "efficiency_gains": "25-45% improvement in business metrics"
  }'::jsonb,
  ARRAY['commercial_real_estate', 'brokerage', 'property', 'investment', 'leasing', 'cre', 'assets', 'development']
);

-- 16. IT Services & Technology Consulting
INSERT INTO icp_configurations (
  name, display_name, description, market_niche, industry_vertical,
  target_profile, decision_makers, pain_points, buying_process, messaging_strategy, success_metrics, tags
) VALUES (
  'it_services',
  'IT Services & Technology Consulting',
  'IT service providers, technology consultants, and managed service providers (MSPs)',
  'technology',
  'IT Services',
  '{
    "company_size": "10-10000+ employees",
    "revenue_range": "$2M-$10B revenue",
    "services": "Managed services, Cloud migration, Cybersecurity, Digital transformation",
    "clients": "SME to Enterprise, Multi-industry focus",
    "business_model": "MSPs, IT consultants, Technology integrators, Cloud service providers"
  }'::jsonb,
  '{
    "primary": ["VP Services", "Practice Leader", "Service Delivery Manager"],
    "secondary": ["CTO", "VP Sales", "Account Manager", "Technical Director"],
    "budget_authority": "Practice or company-level approval",
    "decision_timeline": "3-9 months"
  }'::jsonb,
  '{
    "main_triggers": ["Service delivery optimization", "Client satisfaction", "Technical expertise scaling"],
    "business_drivers": ["Recurring revenue growth", "Operational efficiency", "Competitive differentiation"],
    "urgency_indicators": ["Service issues", "Client churn", "Technical challenges", "Resource constraints"]
  }'::jsonb,
  '{
    "timeline": "3-9 months",
    "process": "Technical validation and ROI assessment",
    "evaluation_criteria": ["Service improvement", "Operational efficiency", "Client value"],
    "decision_factors": ["Technology benefits", "Implementation complexity", "ROI projections"],
    "proof_points": ["Service metrics", "Client success stories", "Technical capabilities"]
  }'::jsonb,
  '{
    "tone": "Technical and business-focused",
    "content_preferences": ["Service metrics", "Client success stories", "Technical capabilities"],
    "channels": ["Technology conferences", "Partner networks", "Industry publications"],
    "avoid": ["Sales-heavy approaches", "Unproven technology claims"]
  }'::jsonb,
  '{
    "primary_metrics": "45% improvement in service delivery efficiency",
    "roi_expectation": "35% increase in client satisfaction",
    "performance_improvement": "40% reduction in service issues",
    "efficiency_gains": "30-50% improvement in operational metrics"
  }'::jsonb,
  ARRAY['it_services', 'msp', 'technology', 'consulting', 'managed_services', 'cloud', 'cybersecurity', 'digital']
);

-- 17. Education & Academic Institutions
INSERT INTO icp_configurations (
  name, display_name, description, market_niche, industry_vertical,
  target_profile, decision_makers, pain_points, buying_process, messaging_strategy, success_metrics, tags
) VALUES (
  'education',
  'Education & Academic Institutions',
  'Universities, colleges, K-12 schools, and educational technology organizations',
  'education',
  'Education',
  '{
    "company_size": "100-50000+ employees",
    "revenue_range": "$10M-$10B budget",
    "institution_types": "Universities, Community colleges, K-12 schools, Online education",
    "focus_areas": "Student success, Administrative efficiency, Academic technology",
    "business_model": "Higher education, K-12 schools, EdTech companies, Training organizations"
  }'::jsonb,
  '{
    "primary": ["CIO", "VP Academic Affairs", "Director of IT"],
    "secondary": ["Provost", "Dean", "Director of Student Services", "CFO"],
    "budget_authority": "Committee or board approval",
    "decision_timeline": "6-18 months"
  }'::jsonb,
  '{
    "main_triggers": ["Student success optimization", "Administrative efficiency", "Budget constraints"],
    "business_drivers": ["Enrollment management", "Student outcomes", "Operational efficiency"],
    "urgency_indicators": ["Enrollment declines", "Budget cuts", "Accreditation requirements", "Student complaints"]
  }'::jsonb,
  '{
    "timeline": "6-18 months",
    "process": "Committee-based, budget cycle dependent",
    "evaluation_criteria": ["Student impact", "Administrative efficiency", "Cost-effectiveness"],
    "decision_factors": ["Educational outcomes", "Budget constraints", "Implementation feasibility"],
    "proof_points": ["Student success metrics", "Administrative efficiency", "Institutional case studies"]
  }'::jsonb,
  '{
    "tone": "Educational and mission-focused",
    "content_preferences": ["Student success metrics", "Administrative efficiency", "Institutional case studies"],
    "channels": ["Educational conferences", "Academic networks", "Institutional partnerships"],
    "avoid": ["Commercial sales language", "Unproven educational benefits"]
  }'::jsonb,
  '{
    "primary_metrics": "30% improvement in student success rates",
    "roi_expectation": "25% reduction in administrative costs",
    "performance_improvement": "40% improvement in operational efficiency",
    "efficiency_gains": "20-40% improvement in educational metrics"
  }'::jsonb,
  ARRAY['education', 'university', 'college', 'k12', 'edtech', 'academic', 'student', 'learning']
);

-- 18. SMEs (Small-Medium Enterprises)
INSERT INTO icp_configurations (
  name, display_name, description, market_niche, industry_vertical,
  target_profile, decision_makers, pain_points, buying_process, messaging_strategy, success_metrics, tags
) VALUES (
  'smes',
  'SMEs (Small-Medium Enterprises)',
  'Small to medium enterprises across all industries focused on growth and operational efficiency',
  'smes',
  'SME',
  '{
    "company_size": "10-500 employees",
    "revenue_range": "$1M-$100M revenue",
    "industries": "Multi-industry, Professional services, Manufacturing, Retail, Distribution",
    "growth_stage": "Established businesses, Growth-focused, Family-owned enterprises",
    "business_model": "Small-medium enterprises across all verticals"
  }'::jsonb,
  '{
    "primary": ["Owner", "CEO", "General Manager"],
    "secondary": ["Operations Manager", "CFO", "VP Sales", "IT Manager"],
    "budget_authority": "Owner or senior management approval",
    "decision_timeline": "1-6 months"
  }'::jsonb,
  '{
    "main_triggers": ["Growth challenges", "Operational efficiency", "Competitive pressure"],
    "business_drivers": ["Revenue growth", "Cost control", "Market competition"],
    "urgency_indicators": ["Cash flow issues", "Growth stagnation", "Operational bottlenecks", "Customer complaints"]
  }'::jsonb,
  '{
    "timeline": "1-6 months",
    "process": "Practical and ROI-focused",
    "evaluation_criteria": ["Immediate impact", "Cost-effectiveness", "Implementation simplicity"],
    "decision_factors": ["ROI potential", "Resource requirements", "Business impact"],
    "proof_points": ["SME success stories", "ROI calculations", "Implementation ease"]
  }'::jsonb,
  '{
    "tone": "Practical and growth-oriented",
    "content_preferences": ["SME success stories", "ROI calculations", "Implementation ease"],
    "channels": ["Business associations", "Industry groups", "Referrals"],
    "avoid": ["Enterprise complexity", "Lengthy implementations"]
  }'::jsonb,
  '{
    "primary_metrics": "50% improvement in operational efficiency",
    "roi_expectation": "100% ROI in business growth",
    "performance_improvement": "30% increase in revenue potential",
    "efficiency_gains": "40-80% improvement in business metrics"
  }'::jsonb,
  ARRAY['sme', 'small_business', 'medium_enterprise', 'growth', 'operations', 'efficiency', 'owners']
);

-- 19. Pharmaceutical & Life Sciences
INSERT INTO icp_configurations (
  name, display_name, description, market_niche, industry_vertical,
  target_profile, decision_makers, pain_points, buying_process, messaging_strategy, success_metrics, tags
) VALUES (
  'pharma',
  'Pharmaceutical & Life Sciences',
  'Pharmaceutical companies, biotech firms, and life sciences organizations with FDA compliance requirements',
  'pharma',
  'Pharmaceutical',
  '{
    "company_size": "500-100000+ employees",
    "revenue_range": "$100M-$100B revenue",
    "regulatory_focus": "FDA, EMA, GxP compliance, 21 CFR Part 11",
    "operations": "Drug development, Clinical trials, Manufacturing, Quality assurance",
    "business_model": "Pharmaceutical companies, Biotech firms, CROs, Medical device companies"
  }'::jsonb,
  '{
    "primary": ["VP Quality", "VP Regulatory Affairs", "Chief Scientific Officer"],
    "secondary": ["VP Manufacturing", "CIO", "VP Clinical Operations", "Compliance Director"],
    "budget_authority": "Executive committee approval",
    "decision_timeline": "12-36 months"
  }'::jsonb,
  '{
    "main_triggers": ["Regulatory compliance optimization", "Quality system improvements", "FDA readiness"],
    "business_drivers": ["Drug approval timelines", "Quality compliance", "Operational efficiency"],
    "urgency_indicators": ["FDA inspections", "Compliance violations", "Quality issues", "Regulatory changes"]
  }'::jsonb,
  '{
    "timeline": "12-36 months",
    "process": "Regulatory compliance first, extensive validation",
    "evaluation_criteria": ["FDA compliance", "Quality systems", "Validation requirements"],
    "decision_factors": ["Regulatory approval", "Validation complexity", "Compliance assurance"],
    "proof_points": ["FDA compliance documentation", "Validation studies", "Pharmaceutical references"]
  }'::jsonb,
  '{
    "tone": "Regulatory-focused and scientifically rigorous",
    "content_preferences": ["FDA compliance documentation", "Validation studies", "Pharmaceutical references"],
    "channels": ["Industry conferences", "Regulatory publications", "Scientific networks"],
    "avoid": ["Unvalidated claims", "Non-compliant approaches"]
  }'::jsonb,
  '{
    "primary_metrics": "50% reduction in compliance preparation time",
    "roi_expectation": "30% improvement in FDA inspection readiness",
    "performance_improvement": "40% improvement in quality metrics",
    "efficiency_gains": "25-45% improvement in regulatory processes"
  }'::jsonb,
  ARRAY['pharmaceutical', 'pharma', 'biotech', 'life_sciences', 'fda', 'gxp', 'regulatory', 'clinical']
);

-- 20. Government & Public Sector
INSERT INTO icp_configurations (
  name, display_name, description, market_niche, industry_vertical,
  target_profile, decision_makers, pain_points, buying_process, messaging_strategy, success_metrics, tags
) VALUES (
  'government',
  'Government & Public Sector',
  'Federal, state, and local government agencies with procurement and compliance requirements',
  'government',
  'Government',
  '{
    "company_size": "100-100000+ employees",
    "revenue_range": "$10M-$100B budget",
    "levels": "Federal, State, Local government, Public agencies",
    "focus_areas": "Citizen services, Public safety, Administrative efficiency",
    "business_model": "Government agencies, Public sector organizations, Contractors"
  }'::jsonb,
  '{
    "primary": ["CIO", "IT Director", "Program Manager"],
    "secondary": ["Deputy Director", "Procurement Officer", "Budget Director"],
    "budget_authority": "Formal procurement process",
    "decision_timeline": "12-36 months"
  }'::jsonb,
  '{
    "main_triggers": ["Citizen service improvement", "Budget optimization", "Security requirements"],
    "business_drivers": ["Public accountability", "Efficiency mandates", "Modernization initiatives"],
    "urgency_indicators": ["Public complaints", "Budget constraints", "Security threats", "Compliance requirements"]
  }'::jsonb,
  '{
    "timeline": "12-36 months",
    "process": "Formal procurement, RFP-based",
    "evaluation_criteria": ["Compliance requirements", "Public value", "Cost-effectiveness"],
    "decision_factors": ["Procurement compliance", "Public benefit", "Budget constraints"],
    "proof_points": ["Government case studies", "Compliance certifications", "Public sector references"]
  }'::jsonb,
  '{
    "tone": "Formal and public service-focused",
    "content_preferences": ["Government case studies", "Compliance certifications", "Public sector references"],
    "channels": ["Government conferences", "Procurement portals", "Public sector publications"],
    "avoid": ["Commercial sales approaches", "Proprietary solutions only"]
  }'::jsonb,
  '{
    "primary_metrics": "40% improvement in citizen services",
    "roi_expectation": "30% reduction in administrative costs",
    "performance_improvement": "35% improvement in operational efficiency",
    "efficiency_gains": "25-50% improvement in public service delivery"
  }'::jsonb,
  ARRAY['government', 'public_sector', 'federal', 'state', 'local', 'agency', 'procurement', 'compliance']
);

-- Display summary of populated configurations
SELECT 
  name,
  display_name,
  market_niche,
  industry_vertical,
  array_length(tags, 1) as tag_count
FROM icp_configurations 
WHERE is_template = TRUE
ORDER BY display_name;