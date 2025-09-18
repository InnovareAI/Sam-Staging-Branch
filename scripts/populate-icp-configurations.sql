-- Populate Knowledge Base with 20 B2B Market Niche ICP Configurations
-- Based on the 20 verticals from SAM's chat route (line 1011)

-- Clear existing ICP configurations
DELETE FROM knowledge_base WHERE category = 'icp_config';

-- Insert the 20 B2B Market Niche ICP Configurations

-- 1. SaaS & Software
INSERT INTO knowledge_base (category, subcategory, title, content, tags) VALUES (
  'icp_config',
  'technology',
  'SaaS & Software Companies',
  '# SaaS & Software ICP Configuration

## Target Profile
- **Industry**: Software as a Service, B2B Software, Platform Companies
- **Company Size**: 50-2000 employees, $5M-$100M ARR
- **Growth Stage**: Series A to IPO, scaling phase
- **Technology Focus**: Cloud-native, API-first, subscription model

## Key Decision Makers
- CTO, VP Engineering, Head of Product
- CEO (early-stage companies)
- VP Sales, VP Marketing (go-to-market roles)

## Pain Points & Triggers
- Scaling infrastructure challenges
- Technical debt accumulation  
- Developer productivity bottlenecks
- Customer churn and retention issues
- Product-market fit optimization

## Buying Process
- **Timeline**: 2-8 weeks
- **Process**: Technical validation first
- **Budget**: Department-level approval
- **Evaluation**: Architecture, integration, developer experience

## Messaging Strategy
- **Tone**: Technical and direct
- **Content**: Technical specs, architecture diagrams, performance benchmarks
- **Channels**: Email, Slack, GitHub, developer forums
- **Avoid**: Sales-heavy language, buzzwords, non-technical pitches

## Success Metrics
- 50% faster development cycles
- 3x ROI in 12 months through automation
- Reduced churn by 20% through better onboarding',
  ARRAY['saas', 'software', 'technology', 'b2b', 'cloud', 'api', 'subscription']
);

-- 2. Financial Services
INSERT INTO knowledge_base (category, subcategory, title, content, tags) VALUES (
  'icp_config',
  'financial',
  'Financial Services & Fintech',
  '# Financial Services & Fintech ICP Configuration

## Target Profile
- **Industry**: Banks, Credit Unions, Investment Firms, Fintech, Insurance
- **Company Size**: 200-10000+ employees, $50M-$10B revenue
- **Regulatory**: SOX, FINRA, SEC, PCI DSS, MiFID II, DORA compliance
- **Technology**: Legacy systems, digital transformation initiatives

## Key Decision Makers
- CRO (Chief Risk Officer), CTO, Compliance Officer, CFO
- VP Technology, Director of Risk Management
- CISO (Chief Information Security Officer)

## Pain Points & Triggers
- Regulatory compliance complexity
- Risk management optimization
- Audit preparation and reporting
- Digital transformation pressures
- Operational efficiency mandates

## Buying Process
- **Timeline**: 9-24 months
- **Process**: Risk mitigation focused, formal vendor management
- **Budget**: Board-level approval for major purchases
- **Evaluation**: Regulatory compliance, risk framework, financial controls

## Messaging Strategy
- **Tone**: Formal and risk-aware
- **Content**: Regulatory compliance docs, risk assessments, audit reports
- **Channels**: Formal proposals, scheduled presentations
- **Avoid**: Casual language, unverified claims, rushed timelines

## Success Metrics
- 45% reduction in compliance costs
- 50% faster audit preparation
- 3x ROI via automated SEC/FINRA reporting',
  ARRAY['financial', 'fintech', 'banking', 'compliance', 'risk', 'regulatory', 'sox', 'finra']
);

-- 3. Healthcare & Life Sciences
INSERT INTO knowledge_base (category, subcategory, title, content, tags) VALUES (
  'icp_config',
  'healthcare',
  'Healthcare & Life Sciences',
  '# Healthcare & Life Sciences ICP Configuration

## Target Profile
- **Industry**: Hospitals, Health Systems, Medical Practices, Pharma, Biotech
- **Company Size**: 100-50000+ employees, $10M-$50B revenue
- **Regulatory**: HIPAA, GDPR, FDA regulations, state health laws
- **Technology**: EHR systems, clinical workflows, patient data management

## Key Decision Makers
- CIO, CISO, Chief Medical Officer, Compliance Officer
- VP Clinical Operations, Director of IT
- Practice Administrators, Department Heads

## Pain Points & Triggers
- Patient data management complexity
- HIPAA compliance requirements
- Clinical workflow optimization
- Operational efficiency improvements
- Digital health transformation

## Buying Process
- **Timeline**: 6-18 months
- **Process**: Risk assessment first, formal RFP process
- **Budget**: C-suite approval required
- **Evaluation**: HIPAA compliance, clinical integration, security framework

## Messaging Strategy
- **Tone**: Conservative and evidence-based
- **Content**: Compliance documentation, clinical evidence, security frameworks
- **Channels**: Formal email, scheduled calls, in-person meetings
- **Avoid**: Aggressive sales tactics, unsubstantiated claims, casual communication

## Success Metrics
- 60% improvement in patient satisfaction
- 15% improvement in patient outcomes
- Reduced compliance risk with HIPAA automation',
  ARRAY['healthcare', 'medical', 'hipaa', 'clinical', 'patient', 'pharma', 'biotech', 'fda']
);

-- 4. Legal Services
INSERT INTO knowledge_base (category, subcategory, title, content, tags) VALUES (
  'icp_config',
  'legal',
  'Legal Services & Law Firms',
  '# Legal Services & Law Firms ICP Configuration

## Target Profile
- **Industry**: Law Firms, Corporate Legal Departments, Legal Tech
- **Company Size**: 10-5000+ attorneys, $5M-$5B revenue
- **Practice Areas**: Corporate, Litigation, IP, Real Estate, Family Law
- **Technology**: Practice management, document review, legal research

## Key Decision Makers
- Managing Partner, Practice Group Leaders, IT Director
- General Counsel (corporate), Legal Operations Director
- Firm Administrator, Chief Innovation Officer

## Pain Points & Triggers
- Attorney-client privilege protection
- Conflict checking requirements
- Professional liability concerns
- Efficiency pressures and billable hour optimization
- Client demands for technology adoption

## Buying Process
- **Timeline**: 3-12 months
- **Process**: Risk and ethics first, committee-based decisions
- **Budget**: Partnership or board approval
- **Evaluation**: Ethical compliance, confidentiality protection, professional liability

## Messaging Strategy
- **Tone**: Professional and conservative
- **Content**: Ethical analysis, professional liability assessment, peer endorsements
- **Channels**: Formal correspondence, professional presentations, referral introductions
- **Avoid**: Automation fears, ethical shortcuts, pressure tactics

## Success Metrics
- 40% improvement in document review efficiency
- 30% reduction in conflict checking time
- Enhanced client service delivery',
  ARRAY['legal', 'law', 'attorney', 'lawyer', 'litigation', 'compliance', 'ethics', 'privilege']
);

-- 5. Manufacturing & Industrial
INSERT INTO knowledge_base (category, subcategory, title, content, tags) VALUES (
  'icp_config',
  'manufacturing',
  'Manufacturing & Industrial',
  '# Manufacturing & Industrial ICP Configuration

## Target Profile
- **Industry**: Manufacturing, Industrial Equipment, Automotive, Aerospace
- **Company Size**: 200-20000+ employees, $50M-$10B revenue
- **Operations**: Production facilities, supply chain, quality control
- **Standards**: ISO 9001, Six Sigma, Lean Manufacturing, OSHA compliance

## Key Decision Makers
- VP Operations, Plant Manager, Supply Chain Director
- Manufacturing Director, Quality Manager, Safety Director
- CFO, VP Technology, Director of Continuous Improvement

## Pain Points & Triggers
- Supply chain optimization needs
- Quality control system improvements
- Predictive maintenance implementation
- Production efficiency targets
- Cost reduction pressures

## Buying Process
- **Timeline**: 6-18 months
- **Process**: Operational impact assessment, CAPEX budgeting cycle
- **Budget**: CAPEX committee approval
- **Evaluation**: Operational efficiency, cost-benefit analysis, integration complexity

## Messaging Strategy
- **Tone**: Practical and results-focused
- **Content**: Efficiency metrics, cost analysis, implementation case studies
- **Channels**: Trade publications, industry events, plant visits
- **Avoid**: Theoretical benefits, complex technology descriptions, rushed implementation

## Success Metrics
- 35% reduction in operational costs
- 25% improvement in production efficiency
- 30% reduction in maintenance costs',
  ARRAY['manufacturing', 'industrial', 'production', 'supply_chain', 'quality', 'lean', 'iso']
);

-- 6. Energy & Oil & Gas
INSERT INTO knowledge_base (category, subcategory, title, content, tags) VALUES (
  'icp_config',
  'energy',
  'Energy & Oil & Gas',
  '# Energy & Oil & Gas ICP Configuration

## Target Profile
- **Industry**: Oil & Gas, Renewable Energy, Utilities, Power Generation
- **Company Size**: 500-50000+ employees, $100M-$100B revenue
- **Operations**: Exploration, production, refining, distribution, power generation
- **Regulatory**: EPA, OSHA, DOE, state utility commissions

## Key Decision Makers
- VP Operations, Chief Engineer, Plant Manager
- Director of HSE (Health, Safety, Environment)
- CTO, VP Technology, Engineering Director

## Pain Points & Triggers
- Operational safety and compliance
- Environmental regulatory requirements
- Asset optimization and maintenance
- Energy efficiency improvements
- Digital transformation of operations

## Buying Process
- **Timeline**: 12-36 months
- **Process**: Safety and regulatory assessment first
- **Budget**: Executive committee approval
- **Evaluation**: Safety compliance, environmental impact, operational efficiency

## Messaging Strategy
- **Tone**: Safety-focused and technically rigorous
- **Content**: Safety case studies, regulatory compliance docs, operational metrics
- **Channels**: Industry conferences, trade publications, peer referrals
- **Avoid**: Unproven technology claims, rushed implementation timelines

## Success Metrics
- 40% improvement in asset utilization
- 25% reduction in safety incidents
- 20% improvement in energy efficiency',
  ARRAY['energy', 'oil', 'gas', 'utility', 'renewable', 'petroleum', 'power', 'epa', 'safety']
);

-- 7. Telecommunications
INSERT INTO knowledge_base (category, subcategory, title, content, tags) VALUES (
  'icp_config',
  'telecom',
  'Telecommunications & Wireless',
  '# Telecommunications & Wireless ICP Configuration

## Target Profile
- **Industry**: Telecom Carriers, Wireless Providers, Network Infrastructure
- **Company Size**: 1000-100000+ employees, $500M-$100B revenue
- **Technology**: 5G, Fiber, Wireless Networks, Network Operations Centers
- **Services**: Consumer, Enterprise, Wholesale telecommunications

## Key Decision Makers
- CTO, VP Network Operations, Chief Engineer
- VP Technology Strategy, Director of Network Planning
- VP Enterprise Solutions, Head of Digital Transformation

## Pain Points & Triggers
- Network optimization and capacity planning
- 5G rollout and infrastructure modernization
- Customer experience improvement
- Operational cost reduction
- Regulatory compliance (FCC, international)

## Buying Process
- **Timeline**: 12-24 months
- **Process**: Technical evaluation and network impact assessment
- **Budget**: Technology committee and board approval
- **Evaluation**: Network performance, scalability, integration complexity

## Messaging Strategy
- **Tone**: Technical and performance-focused
- **Content**: Network performance metrics, scalability studies, technical specifications
- **Channels**: Industry events, technical conferences, vendor partnerships
- **Avoid**: Consumer-focused messaging, oversimplified technical claims

## Success Metrics
- 30% improvement in network efficiency
- 50% reduction in operational overhead
- 25% improvement in customer satisfaction scores',
  ARRAY['telecom', 'wireless', 'network', '5g', 'fiber', 'broadband', 'carrier', 'infrastructure']
);

-- 8. Professional Services - Consulting
INSERT INTO knowledge_base (category, subcategory, title, content, tags) VALUES (
  'icp_config',
  'consulting',
  'Professional Services - Consulting',
  '# Professional Services - Consulting ICP Configuration

## Target Profile
- **Industry**: Management Consulting, IT Consulting, Strategy Consulting
- **Company Size**: 20-10000+ employees, $5M-$10B revenue
- **Specializations**: Digital transformation, process optimization, technology implementation
- **Clients**: Fortune 500, mid-market, government

## Key Decision Makers
- Managing Director, Practice Leaders, Partner
- VP Delivery, Director of Operations
- Chief Innovation Officer, Head of Digital

## Pain Points & Triggers
- Project delivery efficiency
- Resource utilization optimization
- Client satisfaction and retention
- Knowledge management and scaling
- Competitive differentiation

## Buying Process
- **Timeline**: 3-9 months
- **Process**: ROI-focused evaluation, pilot programs
- **Budget**: Practice or firm-level approval
- **Evaluation**: Productivity gains, client value enhancement, competitive advantage

## Messaging Strategy
- **Tone**: Results-oriented and strategic
- **Content**: ROI studies, productivity metrics, client success stories
- **Channels**: Industry networks, professional associations, referrals
- **Avoid**: Generic solutions, one-size-fits-all approaches

## Success Metrics
- 40% improvement in project delivery efficiency
- 25% increase in consultant utilization rates
- 35% improvement in client satisfaction scores',
  ARRAY['consulting', 'professional_services', 'management', 'strategy', 'transformation', 'advisory']
);

-- 9. Marketing & Advertising Agencies
INSERT INTO knowledge_base (category, subcategory, title, content, tags) VALUES (
  'icp_config',
  'marketing',
  'Marketing & Advertising Agencies',
  '# Marketing & Advertising Agencies ICP Configuration

## Target Profile
- **Industry**: Digital Marketing, Advertising Agencies, Creative Agencies, PR Firms
- **Company Size**: 10-2000+ employees, $2M-$500M revenue
- **Specializations**: Digital marketing, brand strategy, content creation, performance marketing
- **Clients**: B2B, B2C, e-commerce, local businesses

## Key Decision Makers
- Agency Owner, Managing Director, VP Client Services
- Creative Director, Head of Strategy, Operations Director
- New Business Director, Head of Growth

## Pain Points & Triggers
- Client acquisition and retention
- Campaign performance optimization
- Resource and project management
- Scaling creative operations
- Proving ROI to clients

## Buying Process
- **Timeline**: 1-6 months
- **Process**: Performance and ROI focused
- **Budget**: Department or agency-level approval
- **Evaluation**: Campaign improvement potential, operational efficiency, client value

## Messaging Strategy
- **Tone**: Creative and results-driven
- **Content**: Campaign performance metrics, creative efficiency gains, client success stories
- **Channels**: Industry events, digital marketing communities, peer networks
- **Avoid**: Generic marketing promises, complex technical jargon

## Success Metrics
- 50% improvement in campaign performance
- 30% increase in client retention
- 40% improvement in creative production efficiency',
  ARRAY['marketing', 'advertising', 'agency', 'digital', 'creative', 'campaigns', 'roi', 'clients']
);

-- 10. Recruiting & HR Services
INSERT INTO knowledge_base (category, subcategory, title, content, tags) VALUES (
  'icp_config',
  'recruiting',
  'Recruiting & HR Services',
  '# Recruiting & HR Services ICP Configuration

## Target Profile
- **Industry**: Executive Search, Staffing Agencies, HR Consulting, Talent Acquisition
- **Company Size**: 10-5000+ employees, $1M-$1B revenue
- **Specializations**: Technical recruiting, executive search, contract staffing, HR outsourcing
- **Markets**: Technology, healthcare, finance, manufacturing

## Key Decision Makers
- CEO, VP Talent Acquisition, Head of Recruiting
- Managing Director, Practice Leader, Operations Director
- VP Business Development, Head of Sales

## Pain Points & Triggers
- Candidate sourcing and qualification
- Client relationship management
- Placement efficiency and speed
- Market competition and differentiation
- Scaling recruitment operations

## Buying Process
- **Timeline**: 2-6 months
- **Process**: Efficiency and placement success focused
- **Budget**: Department or company-level approval
- **Evaluation**: Placement improvement, operational efficiency, competitive advantage

## Messaging Strategy
- **Tone**: Relationship-focused and results-oriented
- **Content**: Placement success metrics, candidate quality improvements, efficiency gains
- **Channels**: Industry associations, networking events, referrals
- **Avoid**: Automation replacement fears, generic recruiting promises

## Success Metrics
- 60% improvement in placement success rates
- 40% reduction in time-to-placement
- 35% increase in candidate quality scores',
  ARRAY['recruiting', 'hr', 'staffing', 'talent', 'executive_search', 'placement', 'hiring']
);

-- Continue with remaining 10 ICPs (Coaching, Logistics, Construction, Commercial Real Estate, IT Services, Education, Startups, SMEs, Pharma separately, and add more detailed ones)

-- 11. Coaching & Training Services
INSERT INTO knowledge_base (category, subcategory, title, content, tags) VALUES (
  'icp_config',
  'coaching',
  'Coaching & Training Services',
  '# Coaching & Training Services ICP Configuration

## Target Profile
- **Industry**: Executive Coaching, Sales Training, Leadership Development, Corporate Training
- **Company Size**: 1-500 employees, $100K-$50M revenue
- **Specializations**: Leadership coaching, sales methodology, skills training, organizational development
- **Clients**: Executives, sales teams, corporate L&D departments

## Key Decision Makers
- Coaching Practice Owner, VP Learning & Development
- Head of Sales Training, Chief Learning Officer
- HR Director, Organizational Development Manager

## Pain Points & Triggers
- Client acquisition and scaling
- Program effectiveness measurement
- Content delivery and engagement
- Client outcome tracking
- Business development efficiency

## Buying Process
- **Timeline**: 1-4 months
- **Process**: Outcome and methodology focused
- **Budget**: Individual or department-level approval
- **Evaluation**: Program effectiveness, client outcomes, scalability

## Messaging Strategy
- **Tone**: Inspirational and outcome-focused
- **Content**: Client transformation stories, methodology frameworks, outcome metrics
- **Channels**: Professional networks, speaking engagements, referrals
- **Avoid**: Generic coaching promises, unsubstantiated claims

## Success Metrics
- 70% improvement in client outcomes
- 45% increase in program engagement
- 50% improvement in business development efficiency',
  ARRAY['coaching', 'training', 'leadership', 'development', 'executive', 'sales_training', 'corporate']
);

-- 12. Logistics & Supply Chain
INSERT INTO knowledge_base (category, subcategory, title, content, tags) VALUES (
  'icp_config',
  'logistics',
  'Logistics & Supply Chain',
  '# Logistics & Supply Chain ICP Configuration

## Target Profile
- **Industry**: Freight Forwarding, 3PL, Warehousing, Transportation, Supply Chain Management
- **Company Size**: 100-10000+ employees, $10M-$10B revenue
- **Operations**: Warehousing, transportation, inventory management, freight brokerage
- **Technology**: WMS, TMS, ERP systems, supply chain visibility

## Key Decision Makers
- VP Operations, Supply Chain Director, Logistics Manager
- VP Technology, Operations Director, Warehouse Manager
- CFO, Director of Procurement

## Pain Points & Triggers
- Supply chain visibility and tracking
- Operational cost reduction
- Inventory optimization
- Customer service improvement
- Compliance and regulatory requirements

## Buying Process
- **Timeline**: 6-18 months
- **Process**: Operational impact and ROI assessment
- **Budget**: Operations and finance approval
- **Evaluation**: Operational efficiency, cost reduction, integration complexity

## Messaging Strategy
- **Tone**: Operational and efficiency-focused
- **Content**: Cost savings metrics, operational efficiency gains, case studies
- **Channels**: Industry trade shows, logistics publications, peer networks
- **Avoid**: Overly complex technology descriptions, unrealistic timelines

## Success Metrics
- 30% reduction in operational costs
- 40% improvement in supply chain visibility
- 25% improvement in customer satisfaction',
  ARRAY['logistics', 'supply_chain', 'warehouse', 'transportation', 'freight', '3pl', 'inventory']
);

-- 13. Construction & Engineering
INSERT INTO knowledge_base (category, subcategory, title, content, tags) VALUES (
  'icp_config',
  'construction',
  'Construction & Engineering',
  '# Construction & Engineering ICP Configuration

## Target Profile
- **Industry**: General Contractors, Engineering Firms, Construction Management, Specialty Contractors
- **Company Size**: 50-5000+ employees, $10M-$5B revenue
- **Projects**: Commercial, residential, infrastructure, industrial construction
- **Technology**: Project management, BIM, field management, estimating

## Key Decision Makers
- Project Manager, Construction Manager, VP Operations
- Engineering Director, CEO, CFO
- IT Director, Director of Business Development

## Pain Points & Triggers
- Project management and coordination
- Cost control and budget management
- Safety and compliance requirements
- Resource and crew management
- Client communication and reporting

## Buying Process
- **Timeline**: 3-12 months
- **Process**: Project impact and ROI assessment
- **Budget**: Project or company-level approval
- **Evaluation**: Project efficiency, cost savings, safety improvements

## Messaging Strategy
- **Tone**: Practical and results-oriented
- **Content**: Project success metrics, cost savings, safety improvements
- **Channels**: Industry associations, trade publications, project networks
- **Avoid**: Complex technology jargon, unrealistic project timelines

## Success Metrics
- 25% improvement in project completion time
- 20% reduction in project costs
- 40% improvement in safety compliance',
  ARRAY['construction', 'engineering', 'contractor', 'project_management', 'building', 'infrastructure']
);

-- 14. Commercial Real Estate
INSERT INTO knowledge_base (category, subcategory, title, content, tags) VALUES (
  'icp_config',
  'real_estate',
  'Commercial Real Estate',
  '# Commercial Real Estate ICP Configuration

## Target Profile
- **Industry**: Commercial Real Estate Brokers, Property Management, Real Estate Investment
- **Company Size**: 10-2000+ employees, $5M-$1B revenue
- **Specializations**: Office, retail, industrial, multifamily, investment properties
- **Technology**: CRM, property management, market analysis, lead generation

## Key Decision Makers
- Broker Owner, Managing Director, VP Sales
- Property Manager, Director of Leasing
- Head of Business Development, Marketing Director

## Pain Points & Triggers
- Lead generation and qualification
- Market analysis and property valuation
- Client relationship management
- Deal pipeline management
- Market competition and differentiation

## Buying Process
- **Timeline**: 2-8 months
- **Process**: ROI and market advantage focused
- **Budget**: Department or firm-level approval
- **Evaluation**: Deal flow improvement, market advantage, operational efficiency

## Messaging Strategy
- **Tone**: Relationship and results-focused
- **Content**: Deal success metrics, market insights, competitive advantages
- **Channels**: Industry networks, real estate associations, referrals
- **Avoid**: Generic real estate promises, overly technical approaches

## Success Metrics
- 50% improvement in lead qualification
- 35% increase in deal closure rates
- 40% improvement in client satisfaction',
  ARRAY['real_estate', 'commercial', 'property', 'broker', 'investment', 'leasing', 'cre']
);

-- 15. IT Services & Technology Consulting
INSERT INTO knowledge_base (category, subcategory, title, content, tags) VALUES (
  'icp_config',
  'it_services',
  'IT Services & Technology Consulting',
  '# IT Services & Technology Consulting ICP Configuration

## Target Profile
- **Industry**: IT Services, Managed Service Providers, Technology Consulting, Systems Integration
- **Company Size**: 20-5000+ employees, $5M-$1B revenue
- **Services**: Cloud migration, cybersecurity, infrastructure management, software development
- **Clients**: SMB to enterprise, across multiple verticals

## Key Decision Makers
- CEO, VP Technology Services, Practice Leader
- Director of Operations, CTO, VP Delivery
- VP Sales, Director of Business Development

## Pain Points & Triggers
- Service delivery optimization
- Client acquisition and retention
- Technical expertise scaling
- Project management efficiency
- Competitive differentiation

## Buying Process
- **Timeline**: 3-9 months
- **Process**: Technical capability and ROI assessment
- **Budget**: Practice or company-level approval
- **Evaluation**: Service delivery improvement, operational efficiency, competitive advantage

## Messaging Strategy
- **Tone**: Technical and results-oriented
- **Content**: Service delivery metrics, technical expertise, client success stories
- **Channels**: Technology events, partner networks, industry publications
- **Avoid**: Generic IT promises, oversimplified technical claims

## Success Metrics
- 40% improvement in service delivery efficiency
- 30% increase in client retention
- 50% improvement in project success rates',
  ARRAY['it_services', 'technology', 'msp', 'consulting', 'cloud', 'cybersecurity', 'managed_services']
);

-- 16. Education & EdTech
INSERT INTO knowledge_base (category, subcategory, title, content, tags) VALUES (
  'icp_config',
  'education',
  'Education & EdTech',
  '# Education & EdTech ICP Configuration

## Target Profile
- **Industry**: K-12 Schools, Higher Education, Corporate Training, EdTech Companies
- **Company Size**: 100-50000+ students/employees, $5M-$1B budget
- **Technology**: LMS, student information systems, educational software, virtual learning
- **Focus**: Student outcomes, administrative efficiency, digital transformation

## Key Decision Makers
- Superintendent, Principal, VP Academic Affairs
- CIO, Director of Technology, Curriculum Director
- Chief Learning Officer, VP Student Services

## Pain Points & Triggers
- Student engagement and outcomes
- Administrative efficiency
- Technology integration
- Budget constraints and funding
- Compliance and accreditation requirements

## Buying Process
- **Timeline**: 6-18 months (often tied to budget cycles)
- **Process**: Educational impact and budget assessment
- **Budget**: Board or committee approval, grant funding
- **Evaluation**: Student outcomes, cost-effectiveness, implementation feasibility

## Messaging Strategy
- **Tone**: Student-focused and evidence-based
- **Content**: Student outcome studies, cost-benefit analysis, implementation success stories
- **Channels**: Education conferences, professional associations, peer networks
- **Avoid**: Complex technology focus without educational benefits

## Success Metrics
- 25% improvement in student outcomes
- 40% improvement in administrative efficiency
- 30% cost reduction through automation',
  ARRAY['education', 'edtech', 'k12', 'higher_ed', 'learning', 'students', 'curriculum', 'lms']
);

-- 17. Startups (Early Stage)
INSERT INTO knowledge_base (category, subcategory, title, content, tags) VALUES (
  'icp_config',
  'startups',
  'Startups (Early Stage)',
  '# Startups (Early Stage) ICP Configuration

## Target Profile
- **Industry**: Early-stage startups across all verticals
- **Company Size**: 5-100 employees, $100K-$10M revenue
- **Funding**: Pre-seed to Series A, bootstrapped to VC-backed
- **Focus**: Product-market fit, rapid growth, operational efficiency

## Key Decision Makers
- CEO, Co-founder, CTO
- VP Growth, Head of Operations
- VP Sales, Head of Marketing

## Pain Points & Triggers
- Scaling operations efficiently
- Product-market fit optimization
- Customer acquisition and retention
- Fundraising and growth preparation
- Resource constraints and budget optimization

## Buying Process
- **Timeline**: 1-6 months
- **Process**: Speed and ROI focused, informal evaluation
- **Budget**: Founder or C-level approval
- **Evaluation**: Immediate impact, cost-effectiveness, scalability

## Messaging Strategy
- **Tone**: Growth-focused and agile
- **Content**: Growth metrics, startup success stories, rapid implementation
- **Channels**: Startup communities, accelerators, investor networks
- **Avoid**: Enterprise complexity, lengthy implementation timelines

## Success Metrics
- 100% improvement in operational efficiency
- 200% increase in growth metrics
- 50% reduction in customer acquisition costs',
  ARRAY['startups', 'early_stage', 'founders', 'growth', 'scaling', 'product_market_fit', 'venture']
);

-- 18. SMEs (Small & Medium Enterprises)
INSERT INTO knowledge_base (category, subcategory, title, content, tags) VALUES (
  'icp_config',
  'sme',
  'SMEs (Small & Medium Enterprises)',
  '# SMEs (Small & Medium Enterprises) ICP Configuration

## Target Profile
- **Industry**: Established SMEs across all verticals
- **Company Size**: 50-500 employees, $5M-$100M revenue
- **Stage**: Mature, profitable, growth or optimization focused
- **Technology**: Mixed legacy and modern systems, pragmatic approach

## Key Decision Makers
- CEO, COO, VP Operations
- CFO, Director of IT, Operations Manager
- Department Heads, Business Unit Leaders

## Pain Points & Triggers
- Operational efficiency improvement
- Cost reduction and margin improvement
- Competitive advantage maintenance
- Growth enablement and scaling
- Technology modernization

## Buying Process
- **Timeline**: 3-12 months
- **Process**: Practical ROI and implementation assessment
- **Budget**: Executive team approval
- **Evaluation**: Cost-benefit analysis, implementation simplicity, proven results

## Messaging Strategy
- **Tone**: Practical and ROI-focused
- **Content**: Cost savings metrics, efficiency gains, peer success stories
- **Channels**: Industry associations, trade publications, referrals
- **Avoid**: Over-engineered solutions, enterprise complexity

## Success Metrics
- 30% improvement in operational efficiency
- 25% reduction in operational costs
- 40% improvement in competitive positioning',
  ARRAY['sme', 'small_business', 'medium_enterprise', 'operational', 'efficiency', 'cost_reduction']
);

-- 19. Pharmaceutical (separate from Healthcare)
INSERT INTO knowledge_base (category, subcategory, title, content, tags) VALUES (
  'icp_config',
  'pharma',
  'Pharmaceutical & Biotech',
  '# Pharmaceutical & Biotech ICP Configuration

## Target Profile
- **Industry**: Pharmaceutical Companies, Biotech, CROs, Medical Device
- **Company Size**: 200-50000+ employees, $50M-$100B revenue
- **Focus**: Drug development, clinical trials, regulatory compliance, manufacturing
- **Regulatory**: FDA, EMA, ICH guidelines, GxP compliance

## Key Decision Makers
- VP Clinical Development, Chief Scientific Officer
- VP Regulatory Affairs, VP Quality Assurance
- CIO, VP Information Technology, VP Operations

## Pain Points & Triggers
- Clinical trial efficiency and speed
- Regulatory submission preparation
- Quality assurance and compliance
- Drug development cost reduction
- Data integrity and security

## Buying Process
- **Timeline**: 12-36 months
- **Process**: Regulatory and scientific validation focused
- **Budget**: Executive committee and board approval
- **Evaluation**: Regulatory compliance, scientific validity, quality standards

## Messaging Strategy
- **Tone**: Scientific and regulatory-focused
- **Content**: Regulatory compliance studies, clinical efficiency metrics, quality improvements
- **Channels**: Scientific conferences, regulatory publications, peer networks
- **Avoid**: Non-validated claims, shortcuts to regulatory processes

## Success Metrics
- 40% reduction in clinical trial timelines
- 30% improvement in regulatory submission success
- 50% improvement in data quality and integrity',
  ARRAY['pharma', 'pharmaceutical', 'biotech', 'clinical', 'regulatory', 'fda', 'drug_development']
);

-- 20. Government & Public Sector
INSERT INTO knowledge_base (category, subcategory, title, content, tags) VALUES (
  'icp_config',
  'government',
  'Government & Public Sector',
  '# Government & Public Sector ICP Configuration

## Target Profile
- **Industry**: Federal Government, State/Local Government, Public Agencies
- **Size**: 100-100000+ employees, $10M-$100B budget
- **Focus**: Public service delivery, citizen engagement, operational efficiency
- **Procurement**: Formal procurement processes, compliance requirements

## Key Decision Makers
- CIO, Director of IT, Chief Information Officer
- Program Manager, Department Head, Deputy Director
- Procurement Officer, Budget Director

## Pain Points & Triggers
- Citizen service improvement
- Operational efficiency mandates
- Budget constraints and optimization
- Compliance and security requirements
- Digital transformation initiatives

## Buying Process
- **Timeline**: 12-36 months
- **Process**: Formal procurement, RFP process
- **Budget**: Legislative or executive approval
- **Evaluation**: Compliance, security, cost-effectiveness, public benefit

## Messaging Strategy
- **Tone**: Public service and compliance-focused
- **Content**: Public benefit metrics, compliance documentation, cost savings
- **Channels**: Government publications, public sector events, procurement portals
- **Avoid**: Private sector jargon, profit-focused messaging

## Success Metrics
- 35% improvement in citizen service delivery
- 25% reduction in operational costs
- 40% improvement in compliance and security',
  ARRAY['government', 'public_sector', 'federal', 'state', 'local', 'procurement', 'compliance', 'citizens']
);

-- Update the version and timestamp
UPDATE knowledge_base 
SET version = '4.5', updated_at = NOW() 
WHERE category = 'icp_config';

-- Create an index for better performance on ICP queries
CREATE INDEX IF NOT EXISTS idx_knowledge_base_icp_config ON knowledge_base(category, subcategory) WHERE category = 'icp_config';

-- Display summary
SELECT 
  subcategory as market_niche,
  title,
  array_length(tags, 1) as tag_count,
  length(content) as content_length
FROM knowledge_base 
WHERE category = 'icp_config' 
ORDER BY subcategory;