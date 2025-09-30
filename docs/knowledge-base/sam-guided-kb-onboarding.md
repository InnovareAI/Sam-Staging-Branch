# SAM AI Knowledge Base Guided Onboarding System

## Overview

The Knowledge Base system enables SAM to collect, organize, and leverage company-specific information to deliver personalized, contextual outreach. This document defines the guided conversation framework SAM uses to populate each Knowledge Base section through natural conversation.

## Knowledge Base Architecture

### Database Schema (Current Production Tables)
- **knowledge_base** – Flat text entries grouped by category/subcategory
- **knowledge_base_sections** – Global list of sections surfaced in the UI
- **knowledge_base_content** – JSONB payloads keyed by section identifier
- **icp_configurations** – Library of ICP templates (used during discovery)

> **Note:** Structured tables for documents, products, competitors, and personas are part of the long-term roadmap but are *not* present in the live schema yet. Until they are introduced, those data points are stored inside `knowledge_base_content.content`.

### API Endpoints
- `/api/knowledge-base/sections` - Section management
- `/api/knowledge-base/content` - Content CRUD operations  
- `/api/knowledge-base/search` - Full-text search
- `/api/knowledge-base/icps` - ICP management

## Guided Onboarding Conversation Framework

### Section 1: Overview (Company Foundation)

**Purpose**: Establish core company identity and value proposition
**Collection Method**: Conversational interview + document upload

**SAM's Questions**:
1. **Company Basics**
   - "Tell me about your company. What do you do and who do you serve?"
   - "What's your company's mission or main purpose?"
   - "How long has your company been in business?"
   - "What's the size of your team/company?"

2. **Core Value Proposition**
   - "What's the main problem your company solves for customers?"
   - "What makes your solution unique or different from competitors?"
   - "What's your elevator pitch - how do you describe what you do in 30 seconds?"

3. **Market Position**
   - "What industry or market are you in?"
   - "Are you a startup, growing company, or established business?"
   - "What's your annual revenue range or company stage?"

**Content Structure**:
```json
{
  "company_name": "string",
  "industry": "string",
  "company_size": "string",
  "founding_date": "string",
  "mission_statement": "string",
  "elevator_pitch": "string",
  "core_value_props": ["array"],
  "market_position": "string",
  "revenue_stage": "string"
}
```

**Documents to Request**:
- Company overview/about page
- Mission/vision statements
- Investor pitch deck
- Company fact sheet

---

### Section 2: ICP Config (Ideal Customer Profiles)

**Purpose**: Define detailed targeting criteria for prospect identification
**Collection Method**: Structured interview with validation

**SAM's Questions**:
1. **Customer Demographics**
   - "Describe your ideal customer. What type of companies do you work with?"
   - "What company size works best for you? (employees, revenue)"
   - "Which industries have you seen the most success in?"
   - "Are there specific geographic regions you focus on?"

2. **Decision Makers**
   - "Who typically makes the buying decision for your solution?"
   - "What job titles or roles do you usually sell to?"
   - "What department or function do they work in?"
   - "What seniority level are your typical buyers?"

3. **Qualifying Characteristics**
   - "What technologies or systems do your best customers use?"
   - "What challenges or pain points do they typically have?"
   - "What triggers usually make them start looking for a solution like yours?"
   - "What disqualifies a prospect? (red flags to avoid)"

4. **Success Patterns**
   - "Describe your best 3-5 customers. What do they have in common?"
   - "What industries or segments have the highest close rates?"
   - "What's the typical deal size for each customer segment?"

**Content Structure**:
```json
{
  "icp_name": "string",
  "company_size_min": "number",
  "company_size_max": "number", 
  "industries": ["array"],
  "job_titles": ["array"],
  "departments": ["array"],
  "seniority_levels": ["array"],
  "locations": ["array"],
  "technologies": ["array"],
  "pain_points": ["array"],
  "buying_triggers": ["array"],
  "disqualifiers": ["array"],
  "deal_size_range": "string",
  "close_rate": "string"
}
```

**Follow-up Actions**:
- Create multiple ICP variants if needed
- Validate against existing customer data
- Set up prospect scoring criteria

---

### Section 3: Products (Solution Portfolio)

**Purpose**: Comprehensive product knowledge for positioning and demos
**Collection Method**: Product walkthrough + documentation upload

**SAM's Questions**:
1. **Product Overview**
   - "Walk me through your main products or services."
   - "What's your core offering vs. add-on products?"
   - "How do you categorize or package your solutions?"

2. **Features & Benefits**
   - "What are the key features of each product?"
   - "What business outcomes do customers achieve?"
   - "What ROI or value do customers typically see?"
   - "How long does implementation typically take?"

3. **Differentiation**
   - "What makes each product unique in the market?"
   - "What can you do that competitors can't?"
   - "What are your strongest competitive advantages?"

4. **Use Cases**
   - "What are the most common use cases for each product?"
   - "Can you share success stories for different scenarios?"
   - "What problems does each product solve specifically?"

5. **Technical Details**
   - "What integrations or technical requirements exist?"
   - "What's your technology stack or platform?"
   - "Are there any technical limitations I should know about?"

**Content Structure**:
```json
{
  "product_name": "string",
  "category": "string",
  "description": "string",
  "key_features": ["array"],
  "benefits": ["array"],
  "use_cases": ["array"],
  "competitive_advantages": ["array"],
  "integrations": ["array"],
  "technical_requirements": ["array"],
  "implementation_time": "string",
  "pricing_model": "string",
  "target_segments": ["array"]
}
```

**Documents to Request**:
- Product datasheets
- Feature comparison charts
- Demo scripts
- Technical specifications
- Implementation guides

---

### Section 4: Competition (Competitive Intelligence)

**Purpose**: Position against competitors and handle objections
**Collection Method**: Competitive analysis interview

**SAM's Questions**:
1. **Competitive Landscape**
   - "Who are your main competitors?"
   - "How do you categorize the competitive landscape?"
   - "Who do you lose deals to most often?"
   - "Are there any emerging competitors to watch?"

2. **Competitive Positioning**
   - "How do you position against [Competitor X]?"
   - "What do they do well? What are their strengths?"
   - "Where do they fall short? What are their weaknesses?"
   - "What do prospects often say about competitors?"

3. **Differentiation Strategy**
   - "What's your key differentiator vs. each main competitor?"
   - "Why do customers choose you over alternatives?"
   - "What objections do you hear about competitors?"
   - "How do you handle 'we're already using [Competitor]'?"

4. **Competitive Intelligence**
   - "What's their pricing model compared to yours?"
   - "How do their features compare to yours?"
   - "What's their go-to-market strategy?"
   - "Any recent changes in their positioning or offerings?"

**Content Structure**:
```json
{
  "competitor_name": "string",
  "category": "string", 
  "website": "string",
  "strengths": ["array"],
  "weaknesses": ["array"],
  "pricing_model": "string",
  "key_features": ["array"],
  "target_market": "string",
  "positioning_against": "string",
  "common_objections": ["array"],
  "win_strategies": ["array"]
}
```

---

### Section 5: Messaging (Communication Framework)

**Purpose**: Consistent, effective messaging across all touchpoints
**Collection Method**: Message strategy workshop

**SAM's Questions**:
1. **Core Messaging**
   - "What's your main marketing message or tagline?"
   - "How do you typically introduce your company?"
   - "What key points do you always want to communicate?"

2. **Value Propositions**
   - "What are your top 3 value propositions?"
   - "How do you explain the value to different audiences?"
   - "What outcomes or benefits do you lead with?"

3. **Message Variations**
   - "How does your message change for different industries?"
   - "Do you have different messages for different roles/personas?"
   - "How do you adjust messaging for different stages of the buyer journey?"

4. **Proof Points**
   - "What evidence or proof points support your claims?"
   - "What metrics or results do you highlight?"
   - "What customer quotes or testimonials resonate most?"

**Content Structure**:
```json
{
  "message_type": "string",
  "audience": "string",
  "key_message": "string",
  "value_props": ["array"],
  "proof_points": ["array"],
  "call_to_action": "string",
  "tone": "string",
  "variations": {}
}
```

---

### Section 6: Tone of Voice (Brand Communication Style)

**Purpose**: Maintain consistent brand voice across all communications
**Collection Method**: Brand voice workshop

**SAM's Questions**:
1. **Brand Personality**
   - "How would you describe your company's personality?"
   - "If your brand was a person, how would they communicate?"
   - "What adjectives best describe your communication style?"

2. **Communication Preferences**
   - "Do you prefer formal or casual communication?"
   - "How technical should messaging be for different audiences?"
   - "Do you use industry jargon or keep things simple?"

3. **Voice Examples**
   - "Can you share examples of communications you love?"
   - "What tone do your best salespeople use?"
   - "Are there any words or phrases you always/never use?"

**Content Structure**:
```json
{
  "brand_personality": ["array"],
  "communication_style": "string",
  "formality_level": "string",
  "technical_level": "string",
  "preferred_words": ["array"],
  "avoided_words": ["array"],
  "voice_examples": ["array"]
}
```

---

### Section 7: Company Info (Team & Culture)

**Purpose**: Humanize the company and build personal connections
**Collection Method**: Company culture interview

**SAM's Questions**:
1. **Team Information**
   - "Tell me about your team and key players."
   - "Who are the founders or key leaders?"
   - "What roles are you currently hiring for?"

2. **Company Culture**
   - "How would you describe your company culture?"
   - "What values are most important to your organization?"
   - "What makes your company a great place to work?"

3. **Company Story**
   - "How did the company get started?"
   - "What's the founding story or inspiration?"
   - "What major milestones have you achieved?"

**Content Structure**:
```json
{
  "key_team_members": [{}],
  "company_culture": "string",
  "core_values": ["array"],
  "founding_story": "string",
  "major_milestones": ["array"],
  "current_hiring": ["array"],
  "team_size": "string"
}
```

---

### Section 8: Success Stories (Social Proof)

**Purpose**: Provide compelling social proof and use cases
**Collection Method**: Success story collection workshop

**SAM's Questions**:
1. **Customer Success Stories**
   - "Can you share your best customer success stories?"
   - "What results have customers achieved with your solution?"
   - "Which success stories resonate most with prospects?"

2. **Metrics & Results**
   - "What specific metrics or ROI have customers seen?"
   - "How quickly do customers typically see results?"
   - "What's the most impressive outcome you've delivered?"

3. **Use Case Examples**
   - "Can you share examples for different industries or use cases?"
   - "Which success stories work best for different buyer personas?"
   - "Do you have any award wins or recognition to highlight?"

**Content Structure**:
```json
{
  "story_title": "string",
  "customer_industry": "string",
  "customer_size": "string",
  "challenge": "string",
  "solution": "string",
  "results": ["array"],
  "metrics": {},
  "quote": "string",
  "use_case": "string"
}
```

---

### Section 9: Buying Process (Sales Process)

**Purpose**: Align outreach with prospect's buying journey
**Collection Method**: Sales process mapping

**SAM's Questions**:
1. **Sales Stages**
   - "Walk me through your typical sales process."
   - "What are the key stages a prospect goes through?"
   - "How long is your average sales cycle?"

2. **Decision Process**
   - "How do prospects typically evaluate solutions like yours?"
   - "What's the decision-making process at your target companies?"
   - "Who else gets involved in the buying decision?"

3. **Qualification Criteria**
   - "What questions do you ask to qualify prospects?"
   - "What indicates a prospect is ready to buy?"
   - "What are the common sticking points or delays?"

**Content Structure**:
```json
{
  "sales_stages": ["array"],
  "average_cycle_length": "string",
  "qualification_questions": ["array"],
  "decision_criteria": ["array"],
  "buying_committee": ["array"],
  "common_objections": ["array"],
  "success_metrics": ["array"]
}
```

---

### Section 10: Compliance (Regulatory Requirements)

**Purpose**: Ensure compliant communications for regulated industries
**Collection Method**: Compliance requirements gathering

**SAM's Questions**:
1. **Regulatory Environment**
   - "Are you in a regulated industry with specific compliance requirements?"
   - "What regulations apply to your business or communications?"
   - "Are there specific disclaimers or language you must use?"

2. **Communication Restrictions**
   - "Are there topics or claims you cannot make in marketing?"
   - "Do you need legal review for certain types of communications?"
   - "Are there industry-specific compliance requirements for outreach?"

**Content Structure**:
```json
{
  "applicable_regulations": ["array"],
  "required_disclaimers": ["array"],
  "restricted_topics": ["array"],
  "approval_requirements": ["array"],
  "compliance_guidelines": "string"
}
```

---

### Section 11: Personas & Roles (Buyer Personas)

**Purpose**: Tailor messaging to specific decision-maker profiles
**Collection Method**: Persona development workshop

**SAM's Questions**:
1. **Persona Development**
   - "Who are the key personas involved in buying decisions?"
   - "What are their primary responsibilities and goals?"
   - "What challenges do they face in their role?"

2. **Communication Preferences**
   - "How does each persona prefer to be approached?"
   - "What information is most relevant to each role?"
   - "What objections or concerns does each persona typically have?"

3. **Influence & Authority**
   - "What's each persona's role in the decision process?"
   - "Who has budget authority vs. technical influence?"
   - "How do you navigate multi-stakeholder decisions?"

**Content Structure**:
```json
{
  "persona_name": "string",
  "job_title": "string",
  "department": "string",
  "seniority_level": "string",
  "decision_role": "string",
  "primary_goals": ["array"],
  "pain_points": ["array"],
  "communication_preferences": {},
  "common_objections": ["array"],
  "key_messages": ["array"]
}
```

---

### Section 12: Objections (Objection Handling)

**Purpose**: Prepare responses to common prospect objections
**Collection Method**: Objection handling workshop

**SAM's Questions**:
1. **Common Objections**
   - "What objections do you hear most frequently?"
   - "How do prospects typically push back or hesitate?"
   - "What concerns come up during the sales process?"

2. **Objection Responses**
   - "How do you typically respond to [specific objection]?"
   - "What proof points or examples help overcome objections?"
   - "Which responses have been most effective?"

3. **Prevention Strategies**
   - "How can we address objections proactively in outreach?"
   - "What information helps prevent common objections?"
   - "When do you typically encounter each objection?"

**Content Structure**:
```json
{
  "objection": "string",
  "category": "string",
  "frequency": "string",
  "typical_responses": ["array"],
  "proof_points": ["array"],
  "prevention_strategy": "string",
  "timing": "string"
}
```

---

### Section 13: Pricing (Value Proposition)

**Purpose**: Communicate value and handle pricing discussions
**Collection Method**: Pricing strategy workshop

**SAM's Questions**:
1. **Pricing Model**
   - "How is your solution priced?"
   - "What pricing model do you use? (per user, flat fee, usage-based)"
   - "What's your typical deal size or price range?"

2. **Value Communication**
   - "How do you communicate value relative to price?"
   - "What ROI do customers typically achieve?"
   - "How do you handle price objections?"

3. **Pricing Strategy**
   - "When do you discuss pricing in the sales process?"
   - "Do you have different pricing for different segments?"
   - "What's your negotiation strategy?"

**Content Structure**:
```json
{
  "pricing_model": "string",
  "price_ranges": {},
  "value_drivers": ["array"],
  "roi_examples": ["array"],
  "pricing_objection_responses": ["array"],
  "negotiation_guidelines": "string"
}
```

---

### Section 14: Success Metrics (KPIs & ROI)

**Purpose**: Define and track success for prospects and customers
**Collection Method**: Success metrics workshop

**SAM's Questions**:
1. **Customer Success Metrics**
   - "How do you measure success for customers?"
   - "What KPIs or metrics do customers track?"
   - "What does a successful implementation look like?"

2. **Business Impact**
   - "What business outcomes do customers achieve?"
   - "How do you quantify the value of your solution?"
   - "What's the typical payback period or ROI?"

3. **Benchmarking**
   - "What are industry benchmarks for key metrics?"
   - "How do you help customers set realistic expectations?"
   - "What metrics do you track for your own success?"

**Content Structure**:
```json
{
  "metric_name": "string",
  "category": "string",
  "typical_improvement": "string",
  "measurement_method": "string",
  "benchmark_data": {},
  "customer_examples": ["array"]
}
```

---

### Section 15: Documents (Supporting Materials)

**Purpose**: Organize and leverage supporting documentation
**Collection Method**: Document audit and upload

**SAM's Questions**:
1. **Available Materials**
   - "What sales materials and documents do you have?"
   - "Which documents are most effective in your sales process?"
   - "What materials do prospects find most valuable?"

2. **Content Gaps**
   - "What materials do you wish you had?"
   - "Where do prospects ask for additional information?"
   - "What content would help accelerate deals?"

**Document Categories**:
- Product datasheets
- Case studies
- Whitepapers
- Demo videos
- Pricing sheets
- ROI calculators
- Competitive comparisons
- Implementation guides

---

## SAM's Conversation Management

### Conversation Flow Strategy

1. **Progressive Disclosure**: Start with high-level questions, drill down based on responses
2. **Contextual Follow-ups**: Use previous answers to ask more targeted questions
3. **Natural Conversation**: Feel like a consultant interview, not a form
4. **Validation**: Confirm understanding and ask for corrections
5. **Prioritization**: Focus on sections most critical for immediate outreach needs

### Sample Conversation Starters

**Initial Knowledge Base Onboarding**:
"I'd love to learn about your company so I can personalize outreach for you. Let's start with the basics - tell me about your company. What do you do and who do you serve?"

**Section-Specific Entry**:
"Let's dive into your ideal customer profile. I want to make sure I'm targeting the right prospects for you. Describe your ideal customer - what type of companies do you work with?"

**Follow-up Conversations**:
"I noticed we haven't filled out your competitive positioning yet. This will help me handle objections better. Who are your main competitors?"

### Knowledge Base Completion Tracking

**Priority Levels**:
1. **Critical** (Required for basic outreach): Overview, ICP Config, Products
2. **Important** (Improves effectiveness): Messaging, Success Stories, Objections  
3. **Valuable** (Optimizes performance): Competition, Personas, Pricing

**Completion Prompts**:
- Dashboard progress indicators
- Gentle conversation prompts
- Section-specific suggestions during relevant conversations

### Integration with Outreach

**Real-time Knowledge Application**:
- Reference specific ICP criteria during prospect qualification
- Use success stories relevant to prospect's industry
- Apply persona-specific messaging automatically
- Handle objections with documented responses

**Continuous Learning**:
- Track which messages perform best
- Update knowledge base based on successful outreach patterns
- Learn from prospect responses and feedback

---

## Technical Implementation

### Database Schema Utilization

**Content Storage Strategy**:
- Use JSONB for flexible, structured content
- Full-text search across all content types
- Version control for content updates
- Workspace isolation for multi-tenant security

**API Integration**:
- RESTful endpoints for all CRUD operations
- Real-time search capabilities
- Bulk import/export functionality
- Integration with file upload system

### Security & Privacy

**Data Protection**:
- Workspace-level access control
- User permission management
- Audit logs for all changes
- Data encryption at rest and in transit

**Compliance Features**:
- Data retention policies
- Export/delete capabilities for GDPR
- Access logging and monitoring
- Secure file storage

---

This comprehensive framework enables SAM to systematically collect and organize all necessary knowledge for effective, personalized outreach while maintaining a natural, consultative conversation flow.
