-- Comprehensive SAM AI Knowledge Base Population
-- This script populates the knowledge base with complete SAM AI product information

-- Clear existing knowledge base data for fresh start
DELETE FROM public.knowledge_base WHERE category IN ('core', 'product', 'company', 'pricing', 'personas', 'buying-process', 'success-metrics', 'verticals', 'strategy');

-- CORE PRODUCT INFORMATION
INSERT INTO public.knowledge_base (category, subcategory, title, content, tags) VALUES 

-- Product Core
('product', 'core', 'SAM AI Product Overview', 
'SAM is an AI-powered B2B sales assistant that automates the entire outreach process from prospect identification to deal closure. SAM orchestrates 14 specialized agents across data enrichment, personalization, multi-channel outreach, reply management, and performance analytics. Unlike traditional sales tools that just provide data, SAM acts as your AI SDR that thinks, researches, writes, and optimizes campaigns autonomously.', 
ARRAY['product', 'overview', 'automation', 'ai-sdr']),

('product', 'core', 'SAM AI Agentic Architecture', 
'SAM operates through 14 specialized AI agents: 1) Prospect Enrichment Agent - Enhances lead data with company insights, 2) Personalization Agent - Crafts contextual messaging, 3) LinkedIn Outreach Agent - Manages connection requests and messaging, 4) Email Campaign Agent - Orchestrates email sequences, 5) Reply Detection Agent - Monitors responses across channels, 6) Intent Classification Agent - Categorizes reply types, 7) Response Generation Agent - Crafts appropriate replies, 8) A/B Testing Agent - Optimizes message performance, 9) Analytics Agent - Provides performance insights, 10) Compliance Agent - Ensures regulatory adherence, 11) Schedule Optimization Agent - Times messages for maximum impact, 12) CRM Integration Agent - Syncs data with existing systems, 13) Lead Scoring Agent - Prioritizes prospects, 14) Campaign Orchestration Agent - Manages cross-channel workflows.', 
ARRAY['agents', 'architecture', 'automation', 'workflow']),

('product', 'features', 'Key Differentiators vs Competition', 
'SAM vs Apollo: Apollo provides data, SAM provides an AI SDR that acts on data. SAM vs Sales Navigator: Sales Nav finds prospects, SAM researches and engages them. SAM vs Outreach/SalesLoft: They send sequences, SAM thinks and personalizes each message. SAM vs Clay: Clay enriches data, SAM enriches AND acts. SAM vs traditional SDRs: SDRs take 3-6 months to ramp and cost $150K+ annually, SAM delivers ROI in weeks at 20% of the cost.', 
ARRAY['competitive', 'differentiators', 'value-prop']),

-- COMPANY INFORMATION
('company', 'about', 'InnovareAI Company Profile', 
'InnovareAI (innovareai.com) is the company behind SAM AI, founded to democratize B2B sales through intelligent automation. Based in the USA with global reach, InnovareAI specializes in agentic AI systems that replace traditional sales roles with autonomous, thinking AI assistants. The company serves 1000+ businesses from startups to enterprises across North America, Europe, and APAC regions.', 
ARRAY['company', 'innovareai', 'about', 'mission']),

('company', 'leadership', 'InnovareAI Leadership & Expertise', 
'InnovareAI leadership combines decades of B2B sales experience with cutting-edge AI research. The team has scaled sales operations for Fortune 500 companies and built AI systems processing millions of prospect interactions. Core expertise spans sales psychology, multi-channel automation, compliance frameworks, and agentic AI architecture.', 
ARRAY['leadership', 'expertise', 'team', 'experience']),

-- BUYING PROCESS BY SEGMENT
('buying-process', 'startup', 'Startup Buying Process & Journey', 
'Startup Buying Journey: 1) Pain Recognition - Founder realizes manual outreach doesn''t scale, 2) Solution Research - Compares SAM vs hiring SDRs vs other tools, 3) ROI Calculation - Evaluates cost savings and speed to value, 4) Pilot Request - Wants to test with 100-500 prospects, 5) Implementation - Onboards in 1-2 weeks, 6) Scale Decision - Expands based on early results. Key concerns: Cash flow, speed to ROI, ease of use. Decision makers: Founder, Head of Sales. Timeline: 2-4 weeks.', 
ARRAY['startup', 'buying-process', 'founder', 'pilot']),

('buying-process', 'sme', 'SME Buying Process & Journey', 
'SME Buying Journey: 1) Performance Gap - Sales team missing targets, 2) Resource Evaluation - Compare hiring vs automation, 3) Vendor Research - Evaluate 3-5 solutions, 4) Stakeholder Alignment - Sales, Marketing, Operations buy-in, 5) Security Review - IT and compliance check, 6) Pilot Program - 30-day proof of concept, 7) Full Deployment - Company-wide rollout. Key concerns: Integration complexity, team adoption, scalability. Decision makers: VP Sales, CMO, CFO. Timeline: 4-8 weeks.', 
ARRAY['sme', 'buying-process', 'vp-sales', 'proof-of-concept']),

('buying-process', 'enterprise', 'Enterprise Buying Process & Journey', 
'Enterprise Buying Journey: 1) Strategic Initiative - Board/C-suite mandates sales transformation, 2) Vendor Shortlist - RFP process with 5-10 vendors, 3) Technical Evaluation - Architecture, security, compliance review, 4) Pilot Selection - Department-level testing, 5) Security & Legal Review - Contracts, privacy, compliance, 6) Stakeholder Consensus - Cross-functional approval, 7) Procurement Negotiation - Terms, pricing, SLAs, 8) Phased Rollout - Department by department. Key concerns: Security, compliance, integration, change management. Decision makers: CRO, CTO, CPO, Legal. Timeline: 3-6 months.', 
ARRAY['enterprise', 'buying-process', 'rfp', 'compliance']),

-- PERSONAS & ROLES
('personas', 'founder', 'Founder/CEO Persona', 
'Profile: Company founder or CEO, typically 2-50 employee companies. Pain Points: Manual outreach doesn''t scale, hiring SDRs is expensive and slow, need predictable pipeline. Goals: Efficient growth, cost-effective customer acquisition, faster time to revenue. Objections: "AI feels impersonal", "We need human touch", "Too complex for small team". Messaging: Focus on speed to value, cost savings vs hiring, simplicity of setup. Success Metrics: Pipeline velocity, cost per lead, time saved on manual tasks.', 
ARRAY['founder', 'ceo', 'startup', 'growth']),

('personas', 'vp-sales', 'VP Sales/Head of Sales Persona', 
'Profile: Sales leader managing 5-50 person sales team. Pain Points: Team missing quotas, inconsistent messaging, manual prospecting inefficiency, coaching overhead. Goals: Predictable pipeline, team productivity, consistent performance. Objections: "Team won''t adopt new tools", "Integration complexity", "Cost justification". Messaging: Focus on team enablement, performance consistency, coaching insights. Success Metrics: Team quota attainment, pipeline quality, sales velocity.', 
ARRAY['vp-sales', 'sales-leader', 'team-management', 'quota']),

('personas', 'marketer', 'Marketing Director/CMO Persona', 
'Profile: Marketing leader responsible for lead generation and campaign performance. Pain Points: Leads not converting, brand message inconsistency, channel optimization challenges. Goals: Higher quality leads, brand compliance, multi-channel orchestration. Objections: "Brand voice concerns", "Campaign control", "Attribution complexity". Messaging: Focus on brand consistency, message personalization, campaign insights. Success Metrics: Lead quality scores, brand compliance rates, multi-touch attribution.', 
ARRAY['marketer', 'cmo', 'lead-generation', 'brand']),

('personas', 'consultant', 'Business Consultant Persona', 
'Profile: Independent consultant or consulting firm partner needing consistent client acquisition. Pain Points: Feast or famine pipeline, time spent on outreach vs delivery, scaling personal brand. Goals: Steady lead flow, premium positioning, referral generation. Objections: "Personal relationships matter", "Industry expertise required", "Client confidentiality". Messaging: Focus on thought leadership, relationship building, vertical expertise. Success Metrics: Pipeline consistency, deal value, referral rates.', 
ARRAY['consultant', 'independent', 'thought-leadership', 'referrals']),

-- OBJECTIONS & RESPONSES
('strategy', 'objections', 'Comprehensive Objection Handling', 
'Common Objections & Responses:

"We already use Apollo/Sales Navigator" → "Those are great tools for data and research. SAM goes beyond data - it acts as your AI SDR that researches, writes personalized messages, manages conversations, and optimizes performance. Think of Apollo as the library, SAM as the librarian who reads, synthesizes, and takes action."

"We can just hire an SDR" → "SDRs take 3-6 months to ramp, cost $150K+ annually (salary + benefits + training), and have variable performance. SAM delivers consistent results from week one at 20% of the cost, works 24/7, and never gets sick or quits."

"AI feels robotic and impersonal" → "SAM personalizes every message using 47 data points including LinkedIn activity, company news, mutual connections, and website content. Messages feel researched and thoughtful, not robotic. Our clients see 3x higher response rates than generic outreach."

"We''re concerned about compliance" → "SAM includes HITL (Human-in-the-Loop) approval workflows, pre-approved industry disclaimers, GDPR/CCPA compliance, and vertical-specific templates. You maintain full control while SAM handles the heavy lifting."

"It seems too complex to implement" → "Most clients are fully operational within 2 weeks. Our team handles the technical setup while you focus on defining your ideal customer profile and messaging strategy. We provide dedicated success management throughout."

"What about data quality and accuracy?" → "SAM combines 12+ premium data sources, validates contact information in real-time, and uses AI to verify company information accuracy. Data quality is often better than manual research."', 
ARRAY['objections', 'responses', 'competitive', 'handling']),

-- PRICING STRATEGY
('pricing', 'structure', 'SAM AI Pricing Strategy', 
'SAM AI Three-Tier Pricing:

STARTUP PLAN - $99/month
- 2,000 prospect contacts
- Single LinkedIn + Email channel
- Basic personalization (5 data points)
- Standard templates library
- Email support
- Perfect for: Solopreneurs, early-stage startups

SME PLAN - $399/month  
- 10,000 prospect contacts
- Multi-channel (LinkedIn + Email + Phone)
- Advanced personalization (25 data points)
- Custom template builder
- A/B testing capabilities
- Priority support + Success Manager
- Perfect for: Growing companies, sales teams 5-20 people

ENTERPRISE PLAN - $899/month
- 30,000 prospect contacts
- Full multi-channel orchestration
- Maximum personalization (47 data points)
- Custom AI agent training
- Advanced analytics + reporting
- Compliance packages (HIPAA, FINRA, etc.)
- Dedicated Customer Success + Technical Support
- Custom integrations
- Perfect for: Large sales organizations, regulated industries

All plans include: 14-day free trial, setup assistance, HITL approval systems, CRM integrations, knowledge base access. Sign up at https://innovareai.com/sam or email helloSam@innovareai.com',
ARRAY['pricing', 'plans', 'startup', 'sme', 'enterprise']),

('pricing', 'value', 'ROI & Value Proposition', 
'SAM AI ROI Calculation:

Traditional SDR Cost:
- Salary: $60,000/year
- Benefits: $18,000/year  
- Training: $15,000/year
- Tools/Software: $12,000/year
- Management overhead: $25,000/year
- Total: $130,000/year per SDR

SAM AI Cost:
- SME Plan: $4,788/year
- Savings: $125,212/year (96% cost reduction)

Performance Comparison:
- SDR: 3-6 month ramp time, 50-100 prospects/day, 2-5% response rates
- SAM: Immediate deployment, 500+ prospects/day, 8-15% response rates

Typical ROI Timeline:
- Week 1-2: Setup and training
- Week 3-4: First qualified conversations 
- Month 2: Pipeline building momentum
- Month 3+: Consistent lead flow exceeding SDR performance', 
ARRAY['roi', 'value', 'cost-savings', 'performance']),

-- SUCCESS METRICS
('success-metrics', 'kpis', 'Key Performance Indicators', 
'SAM AI Success Metrics by Role:

FOUNDER/CEO KPIs:
- Pipeline velocity (deals moving through stages faster)
- Cost per qualified lead (50-80% reduction typical)
- Time to first revenue from new prospects
- Overall sales efficiency ratio

VP SALES KPIs:
- Team quota attainment rates
- Pipeline quality score (SAL to SQL conversion)
- Sales cycle length reduction
- Rep productivity (activities per day)

MARKETING KPIs:
- Marketing Qualified Lead (MQL) to Sales Qualified Lead (SQL) conversion
- Multi-touch attribution accuracy
- Brand message consistency score
- Campaign performance optimization

FINANCIAL KPIs:
- Customer Acquisition Cost (CAC) reduction
- Return on Sales Investment (ROSI)
- Revenue per sales dollar invested
- Payback period on sales technology

OPERATIONAL KPIs:
- Response time to new leads
- Data accuracy and completeness
- Integration uptime and performance
- User adoption and utilization rates', 
ARRAY['success-metrics', 'kpis', 'performance', 'measurement']),

-- INDUSTRY VERTICALS
('verticals', 'healthcare', 'Healthcare & Life Sciences', 
'Healthcare Vertical Strategy:
Pain Points: HCP engagement restrictions, compliance complexity, long sales cycles, trust building challenges.
SAM AI Solutions: HIPAA-compliant messaging, pre-approved medical disclaimers, physician-specific personalization, conference and publication triggers.
Key Messages: "Research shows personalized outreach increases HCP engagement by 67%", "Maintain compliance while scaling reach", "Focus on value-driven relationships".
Compliance Features: HIPAA-compliant data handling, medical marketing regulations, physician preference management.
Success Metrics: HCP response rates, compliance audit scores, relationship depth scores.', 
ARRAY['healthcare', 'hipaa', 'hcp', 'compliance']),

('verticals', 'financial', 'Financial Services', 
'Financial Services Vertical Strategy:
Pain Points: Regulatory compliance, trust building, sophisticated buyers, risk-averse culture.
SAM AI Solutions: FINRA-compliant templates, fiduciary duty messaging, market insight personalization, regulatory change triggers.
Key Messages: "Build trust through thought leadership", "Regulatory compliance built-in", "Sophisticated prospect engagement".
Compliance Features: FINRA regulations, SEC compliance, investment adviser rules, privacy requirements.
Success Metrics: Asset gathering rates, compliance scores, relationship trust indicators.', 
ARRAY['financial', 'finra', 'sec', 'trust']),

('verticals', 'manufacturing', 'Manufacturing & Industrial', 
'Manufacturing Vertical Strategy:
Pain Points: Long procurement cycles, technical complexity, relationship-based sales, supply chain concerns.
SAM AI Solutions: Technical specification analysis, supply chain trigger events, relationship mapping, industry expertise demonstration.
Key Messages: "Understand your technical requirements", "Navigate complex procurement", "Supply chain optimization focus".
Success Metrics: Procurement cycle acceleration, technical qualification rates, relationship development scores.', 
ARRAY['manufacturing', 'industrial', 'procurement', 'technical']),

('verticals', 'legal', 'Legal Services', 
'Legal Services Vertical Strategy:
Pain Points: Professional reputation sensitivity, referral dependency, business development challenges, billing pressure.
SAM AI Solutions: Thought leadership positioning, referral source nurturing, practice area expertise demonstration, legal trend triggers.
Key Messages: "Build practice through thought leadership", "Professional referral relationship management", "Industry expertise demonstration".
Success Metrics: Referral conversion rates, thought leadership engagement, practice development velocity.', 
ARRAY['legal', 'law-firm', 'referrals', 'thought-leadership']),

-- CONVERSATION TEMPLATES
('strategy', 'conversation-starters', 'Conversation Starter Templates', 
'Industry-Specific Conversation Starters:

SAAS/TECH:
"I noticed [Company] just raised [Amount] in Series [X]. Scaling sales teams is often the biggest challenge in the 6-12 months post-funding. How are you thinking about building predictable pipeline as you grow?"

HEALTHCARE:
"Saw your presentation at [Conference] on [Topic]. The challenge you mentioned about HCP engagement resonating across the industry. Have you explored how AI can help maintain compliance while scaling outreach?"

FINANCIAL SERVICES:
"Your recent insights on [Market Trend] really stood out. With all the regulatory changes affecting client acquisition, how are you balancing compliance requirements with growth objectives?"

MANUFACTURING:
"The supply chain optimization work you''re doing at [Company] is impressive. As you expand into new markets, what''s your strategy for identifying and engaging the right procurement decision makers?"

CONSULTING:
"Your expertise in [Specialty Area] really comes through in your content. Independent consultants often struggle with the feast-or-famine pipeline. How do you maintain consistent business development alongside client delivery?"', 
ARRAY['conversation-starters', 'templates', 'industry-specific']),

-- TECHNICAL CAPABILITIES  
('product', 'technical', 'Technical Architecture & Integrations', 
'SAM AI Technical Capabilities:

INTEGRATIONS:
- CRM: Salesforce, HubSpot, Pipedrive, Copper, Microsoft Dynamics
- Email: Gmail, Outlook, Exchange, SMTP/IMAP
- LinkedIn: Sales Navigator API, Recruiter API, Standard LinkedIn
- Data Sources: ZoomInfo, Apollo, Clay, Clearbit, 6sense
- Communication: Slack, Microsoft Teams, Telegram
- Calendar: Google Calendar, Outlook Calendar, Calendly

DATA SOURCES (47 personalization points):
- LinkedIn profile and activity data
- Company websites and news
- SEC filings and financial reports  
- Industry publications and reports
- Conference attendance and speaking
- Social media activity
- Funding and investment data
- Technology stack information
- Hiring patterns and job postings
- Mutual connections and relationships

SECURITY & COMPLIANCE:
- SOC 2 Type II certification
- GDPR and CCPA compliance
- HIPAA-ready infrastructure  
- Enterprise SSO integration
- Role-based access controls
- Audit logging and monitoring
- Data encryption at rest and transit', 
ARRAY['technical', 'integrations', 'security', 'data-sources']);

-- Verify insertion
SELECT category, subcategory, title, array_length(tags, 1) as tag_count 
FROM public.knowledge_base 
WHERE category IN ('product', 'company', 'pricing', 'personas', 'buying-process', 'success-metrics', 'verticals', 'strategy')
ORDER BY category, subcategory, title;