#!/usr/bin/env node

/**
 * Complete Knowledge Base Seeding Script
 * Populates all KB tables with comprehensive demo data
 *
 * Usage: WORKSPACE_ID=your-workspace-id node scripts/seed-kb-complete.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const workspaceId = process.env.WORKSPACE_ID || 'babdcab8-1a78-4b2f-913e-6e9fd9821009'; // Default to current workspace

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🚀 Starting Complete Knowledge Base Seeding...');
console.log(`📍 Workspace ID: ${workspaceId}\n`);

// ============================================================================
// SAMPLE DATA
// ============================================================================

const sampleProducts = [
  {
    workspace_id: workspaceId,
    name: 'SAM AI - Sales Automation Platform',
    description: 'AI-powered sales automation platform that combines intelligent prospecting, personalized outreach, and automated follow-ups to help B2B teams scale their pipeline.',
    category: 'B2B SaaS',
    pricing: {
      startup: { price: 99, period: 'month', features: ['Up to 500 prospects/month', 'Basic AI personalization', '1 user'] },
      sme: { price: 399, period: 'month', features: ['Up to 5,000 prospects/month', 'Advanced AI', '5 users', 'CRM integration'] },
      enterprise: { price: 899, period: 'month', features: ['Unlimited prospects', 'Custom AI models', 'Unlimited users', 'Dedicated support'] }
    },
    features: [
      'AI-powered prospect research',
      'Automated LinkedIn & email outreach',
      'Intelligent follow-up sequences',
      'CRM integration (Salesforce, HubSpot)',
      'Real-time analytics & reporting',
      'A/B testing & optimization'
    ],
    benefits: [
      '10x more qualified conversations',
      '80% time savings on manual prospecting',
      '3x increase in response rates',
      'Consistent messaging across team',
      'Data-driven optimization'
    ],
    use_cases: [
      'SDR teams scaling outbound',
      'Account-based marketing campaigns',
      'Event follow-up automation',
      'Partnership outreach',
      'Investor relations'
    ],
    competitive_advantages: [
      'Most advanced AI personalization in market',
      'Multi-channel orchestration (LinkedIn + Email)',
      'Built-in compliance & safety controls',
      'Real-time prospect intelligence',
      'Fastest implementation (< 1 week)'
    ],
    target_segments: ['B2B SaaS', 'Professional Services', 'Financial Services', 'Technology']
  },
  {
    workspace_id: workspaceId,
    name: 'SAM Inbox - AI Email Management',
    description: 'Intelligent email management system that auto-categorizes, prioritizes, and drafts responses to prospect emails.',
    category: 'Add-on Module',
    pricing: {
      addon: { price: 49, period: 'month', features: ['Unlimited emails', 'AI categorization', 'Smart drafts'] }
    },
    features: [
      'AI-powered email categorization',
      'Priority inbox for hot prospects',
      'Auto-draft responses',
      'Sentiment analysis',
      'Email analytics'
    ],
    benefits: [
      '50% faster email response time',
      'Never miss a hot prospect',
      'Consistent brand voice',
      'Reduced email overwhelm'
    ],
    use_cases: [
      'High-volume inbound management',
      'Post-event follow-up',
      'Customer success teams',
      'Support ticket triage'
    ],
    target_segments: ['B2B SaaS', 'E-commerce', 'Professional Services']
  }
];

const sampleICPs = [
  {
    workspace_id: workspaceId,
    icp_name: 'B2B SaaS Growth Stage',
    overview: {
      industry: 'B2B SaaS',
      company_size: '50-500 employees',
      revenue: '$5M-$50M ARR',
      geography: ['United States', 'Canada', 'United Kingdom', 'Australia'],
      growth_stage: 'Series A/B'
    },
    target_profile: {
      company_characteristics: [
        'Product-market fit achieved',
        'Scaling GTM motion',
        'Building SDR/BDR team',
        'Investing in sales tech stack',
        'Looking to 2-3x pipeline'
      ],
      technology_stack: ['Salesforce/HubSpot CRM', 'Outreach/Salesloft', 'ZoomInfo/Apollo', 'LinkedIn Sales Navigator'],
      buying_signals: [
        'Recently raised funding',
        'Hiring SDRs/BDRs',
        'Low reply rates on outbound',
        'Manual prospecting complaints',
        'Looking to scale without linear headcount growth'
      ]
    },
    decision_makers: {
      primary: { role: 'CRO / VP Sales', title: 'Chief Revenue Officer', seniority: 'C-level' },
      influencers: ['Head of Sales Development', 'Sales Operations Manager', 'Marketing Ops'],
      champions: ['SDR/BDR Team Leads']
    },
    pain_points: {
      operational: [
        'SDRs spending 80% time on manual research',
        'Generic messaging leading to <5% response rates',
        'Difficulty maintaining quality as team scales',
        'Inconsistent messaging across reps'
      ],
      strategic: [
        'Pipeline not growing as fast as needed',
        'Cost per meeting too high',
        "Can't hire SDRs fast enough",
        'Need to prove ROI on sales tools'
      ],
      emotional: [
        'Fear of missing revenue targets',
        'Pressure from board/investors',
        'Burnout from manual processes',
        'Frustrated with current tools not delivering'
      ]
    },
    buying_process: {
      timeline: '2-4 months',
      steps: ['Awareness', 'Evaluation', 'Proof of Concept', 'Negotiation', 'Implementation'],
      evaluation_criteria: ['ROI / Payback period', 'Ease of implementation', 'Team adoption rate', 'Integration with existing stack', 'Vendor support & training'],
      objections: ['Budget constraints', 'Change management concerns', 'Already have other tools', 'Worried about AI quality', 'Security/compliance requirements']
    },
    messaging: {
      value_propositions: [
        '3x your pipeline without hiring more SDRs',
        'From manual research to AI-powered insights in <1 week',
        '10x more qualified conversations with half the effort',
        'Scale your SDR team without scaling headcount'
      ],
      key_messages: [
        'SAM AI does the heavy lifting so your SDRs focus on selling',
        'Built by sales leaders for sales teams',
        'Proven 3x increase in response rates',
        'Implementation in days, not months'
      ],
      proof_points: [
        'Average customer sees 10x ROI in first quarter',
        '95% of customers hit their first meeting booked within week 1',
        'Used by 500+ B2B teams including [logos]'
      ]
    },
    success_metrics: {
      adoption_kpis: ['Time to first meeting booked', 'SDR adoption rate', 'Messages sent per day'],
      business_kpis: ['Pipeline generated', 'Cost per qualified meeting', 'Response rate improvement', 'SDR productivity increase']
    }
  }
];

const sampleCompetitors = [
  {
    workspace_id: workspaceId,
    name: 'Outreach.io',
    website: 'https://outreach.io',
    description: 'Sales engagement platform focused on email sequencing and cadence management',
    strengths: ['Market leader', 'Deep CRM integrations', 'Enterprise-grade', 'Large customer base'],
    weaknesses: ['Limited AI personalization', 'Complex setup', 'Expensive', 'Steep learning curve', 'No LinkedIn automation'],
    pricing_model: 'Enterprise ($100-150/user/month)',
    key_features: ['Email sequences', 'Call tracking', 'Meeting scheduler', 'Analytics'],
    target_market: 'Enterprise sales teams (100+ users)',
    competitive_positioning: {
      our_advantage: 'SAM has superior AI personalization and LinkedIn integration at 1/3 the price',
      when_to_position_against: 'Mid-market companies who need results fast without enterprise complexity',
      key_differentiator: 'AI-first vs their bolt-on AI features'
    }
  },
  {
    workspace_id: workspaceId,
    name: 'Apollo.io',
    website: 'https://apollo.io',
    description: 'Sales intelligence and engagement platform with large B2B database',
    strengths: ['Great database', 'Affordable', 'Good UI/UX', 'Fast implementation'],
    weaknesses: ['Basic personalization', 'Generic messaging', 'No real AI', 'Limited LinkedIn features'],
    pricing_model: 'Freemium ($49-99/user/month)',
    key_features: ['Contact database', 'Email finder', 'Sequences', 'Basic analytics'],
    target_market: 'SMB and startups',
    competitive_positioning: {
      our_advantage: "SAM's AI writes personalized messages vs Apollo's templates",
      when_to_position_against: 'Teams tired of low response rates from generic outreach',
      key_differentiator: 'Quality of personalization and AI-driven insights'
    }
  }
];

const samplePersonas = [
  {
    workspace_id: workspaceId,
    name: 'Sarah - CRO at Growth-Stage SaaS',
    job_title: 'Chief Revenue Officer',
    department: 'Revenue',
    seniority_level: 'C-level',
    decision_making_role: 'Final Decision Maker',
    pain_points: [
      'Board pressure to hit aggressive pipeline targets',
      "Can't hire SDRs fast enough",
      'Current tools not delivering promised ROI',
      'Need to 3x pipeline with limited budget increase'
    ],
    goals: [
      'Hit $50M ARR next year',
      'Build predictable pipeline engine',
      'Increase sales team productivity by 50%',
      'Prove ROI on sales tech investments'
    ],
    communication_preferences: {
      channels: ['LinkedIn (preferred for initial outreach)', 'Email', 'Phone (warm intros only)'],
      style: 'Direct, data-driven, ROI-focused',
      best_times: 'Tuesday-Thursday 7-9am PT',
      content_preferences: ['Case studies', 'ROI calculators', 'Executive briefings', 'Industry benchmarks']
    },
    objections: [
      '"We already have Outreach/Salesloft"',
      '"Too expensive right now"',
      '"Change management with sales team is hard"',
      '"Need to see proof it works first"'
    ],
    messaging_approach: {
      hook: 'Show 3x pipeline increase proof from similar companies',
      value_prop: 'Scale pipeline without scaling headcount',
      social_proof: 'Name-drop similar CROs who use SAM',
      cta: 'Quick 15-min demo showing ROI calculator'
    }
  }
];

const sampleKnowledgeBase = [
  {
    workspace_id: workspaceId,
    category: 'products',
    subcategory: 'core-features',
    title: 'SAM AI Core Features Overview',
    content: `# SAM AI Core Features

## AI-Powered Prospecting
- Automated research using LinkedIn, company websites, and news sources
- Real-time prospect intelligence and trigger events
- Automatic ICP matching and scoring

## Multi-Channel Outreach
- LinkedIn connection requests and messages
- Email sequences with intelligent send times
- Automated follow-ups based on prospect behavior

## Personalization Engine
- AI-generated personalized messaging
- Dynamic content based on prospect data
- A/B testing for optimization

## Integration Capabilities
- Salesforce & HubSpot CRM sync
- Slack notifications
- Zapier for custom workflows
- API access for custom integrations

## Analytics & Reporting
- Real-time campaign performance
- Response rate tracking
- Pipeline attribution
- ROI measurement`,
    tags: ['products', 'features', 'core'],
    version: '1.0',
    is_active: true,
    source_type: 'manual'
  },
  {
    workspace_id: workspaceId,
    category: 'messaging',
    subcategory: 'value-propositions',
    title: 'SAM AI Value Propositions',
    content: `# Value Propositions

## Primary Value Prop
"3x your sales pipeline without hiring more SDRs"

## Supporting Value Props
1. "From manual research to AI-powered insights in under 1 week"
2. "10x more qualified conversations with half the effort"
3. "Scale your SDR team without scaling headcount"

## Proof Points
- Average customer sees 10x ROI in first quarter
- 95% of customers book their first meeting within week 1
- 80% time savings on manual prospecting
- 3x increase in response rates

## Messaging Framework
- **Problem**: SDRs waste 80% of time on manual research
- **Solution**: SAM AI automates research and personalizes outreach
- **Impact**: 3x more meetings booked, 80% time savings
- **Proof**: 500+ B2B companies, $50M+ pipeline generated`,
    tags: ['messaging', 'value-prop', 'positioning'],
    version: '1.0',
    is_active: true,
    source_type: 'manual'
  },
  {
    workspace_id: workspaceId,
    category: 'pricing',
    subcategory: 'packages',
    title: 'SAM AI Pricing & Packages',
    content: `# Pricing Tiers

## Startup - $99/month
- Up to 500 prospects/month
- Basic AI personalization
- 1 user seat
- Email + LinkedIn
- Standard support
- Best for: Solo founders, early-stage startups

## SME - $399/month
- Up to 5,000 prospects/month
- Advanced AI personalization
- 5 user seats
- CRM integration
- Priority support
- A/B testing
- Best for: Growing sales teams (5-20 SDRs)

## Enterprise - $899/month
- Unlimited prospects
- Custom AI models
- Unlimited users
- Dedicated CSM
- Custom integrations
- Advanced analytics
- SLA guarantee
- Best for: Large sales organizations (20+ SDRs)

## ROI Calculation
- Average customer: $399/month package
- Replaces: 1.5 SDR roles ($120k/year loaded cost)
- Payback period: 2-3 months
- 3-year ROI: 800%`,
    tags: ['pricing', 'packages', 'roi'],
    version: '1.0',
    is_active: true,
    source_type: 'manual'
  },
  {
    workspace_id: workspaceId,
    category: 'objections',
    subcategory: 'common-objections',
    title: 'Common Objections & Responses',
    content: `# Common Objections & How to Handle Them

## "We already have Outreach/Salesloft"
**Response**: "That's great - many of our customers use Outreach for their cadences. SAM AI actually complements Outreach by doing the heavy lifting of research and personalization BEFORE the prospect enters your sequences. Think of us as the research assistant that feeds Outreach with personalized messaging. Would you be open to seeing how teams use both together?"

## "Too expensive right now"
**Response**: "I understand budget constraints. Let me share how other teams justify SAM: If you have just 2 SDRs, you're spending ~$200k/year in loaded costs. SAM at $399/month ($4,788/year) typically replaces 40-60 hours/week of manual research. That's like getting 1.5 SDRs worth of work for 2.4% of the cost. Can I show you a quick ROI calculator based on your team size?"

## "Change management with sales team is hard"
**Response**: "You're absolutely right - adoption is everything. That's why we designed SAM to work WITH your team, not replace them. Implementation takes under a week, and we include white-glove onboarding. Most teams see their first meetings booked within 3 days. Plus, SDRs love it because they spend less time on boring research and more time actually selling. Can I show you our adoption playbook?"

## "Need to see proof it works first"
**Response**: "Totally fair. Would a 14-day pilot with your team work? We'll set you up with 100 free prospect researches and personalized messages. You can measure response rates against your current approach. Most teams see 2-3x better response rates in the first week. If it doesn't work, you've only invested a few hours. Sound reasonable?"

## "Already tried AI tools and they didn't work"
**Response**: "I hear that a lot. Most 'AI tools' just use basic templates with mail merge. SAM is different - we use GPT-4 with your company's actual knowledge base to write messages that sound human. Happy to show you examples side-by-side. What tool did you try before?"`,
    tags: ['objections', 'sales', 'responses'],
    version: '1.0',
    is_active: true,
    source_type: 'manual'
  },
  {
    workspace_id: workspaceId,
    category: 'success',
    subcategory: 'case-studies',
    title: 'Customer Success Stories',
    content: `# Customer Success Stories

## CloudTech Inc - 5x Pipeline Growth
**Company**: B2B SaaS, 75 employees, $10M ARR
**Challenge**: 3-person SDR team couldn't keep up with growth goals
**Solution**: Implemented SAM AI to automate research and personalization
**Results**:
- 5x increase in qualified pipeline in 90 days
- Response rates improved from 4% to 14%
- SDR team productivity up 3x
- Cost per qualified meeting down 60%
**Quote**: "SAM AI gave us the leverage to hit our pipeline goals without tripling our SDR headcount" - Sarah Chen, CRO

## FinServe Solutions - $2M Pipeline in 6 Months
**Company**: Financial services, 200 employees
**Challenge**: Long sales cycles, low response rates on cold outreach
**Solution**: Used SAM AI for ABM campaigns targeting enterprise accounts
**Results**:
- $2M qualified pipeline generated in 6 months
- 12% response rate on cold outreach (vs 2% previously)
- 80% time savings on prospect research
- Paid for itself in first month
**Quote**: "SAM researches prospects better than our SDRs ever could, and the personalization is scary good" - Mike Torres, VP Sales

## TechStart - Zero to Hero in 90 Days
**Company**: Early-stage startup, 10 employees, just raised Series A
**Challenge**: No SDR team, founders doing all sales
**Solution**: Used SAM AI to build outbound motion from scratch
**Results**:
- 50 qualified meetings in first 90 days
- 8 new customers worth $120k ARR
- 10x ROI in quarter 1
- Founders freed up 20 hours/week
**Quote**: "SAM is like having a world-class SDR team without the headcount" - Alex Kim, Co-founder & CEO`,
    tags: ['success-stories', 'case-studies', 'proof'],
    version: '1.0',
    is_active: true,
    source_type: 'manual'
  },
  {
    workspace_id: workspaceId,
    category: 'company',
    subcategory: 'about',
    title: 'About SAM AI - Company Info',
    content: `# About SAM AI

## Company Overview
SAM AI is a next-generation sales automation platform that uses artificial intelligence to help B2B teams scale their pipeline without scaling headcount.

## Founded
2023

## Mission
Empower every B2B company to build a predictable, scalable pipeline engine using AI.

## Team
- Founded by former sales leaders from Salesforce, HubSpot, and Gong
- 25-person team across SF, NYC, and remote
- Backed by top-tier VCs

## Customers
- 500+ B2B companies
- $50M+ in pipeline generated
- 95% customer satisfaction
- Industries: SaaS, Professional Services, FinTech, Healthcare

## Core Values
1. Customer Success First
2. Move Fast, Learn Faster
3. AI That Empowers, Doesn't Replace
4. Transparent & Honest
5. Build for the Long Term`,
    tags: ['company', 'about', 'mission'],
    version: '1.0',
    is_active: true,
    source_type: 'manual'
  },
  {
    workspace_id: workspaceId,
    category: 'tone',
    subcategory: 'brand-voice',
    title: 'SAM AI Brand Voice & Tone',
    content: `# Brand Voice Guidelines

## Voice Attributes
- **Confident but not arrogant**: We know our product works, but we're humble
- **Direct and honest**: No fluff, just real value
- **Human and conversational**: We're AI-powered but human-led
- **Data-driven**: Back up claims with numbers
- **Optimistic**: Focus on possibilities, not problems

## Tone by Context
- **Marketing**: Confident, aspirational, proof-heavy
- **Sales**: Consultative, ROI-focused, problem-solving
- **Support**: Patient, helpful, solution-oriented
- **Product**: Clear, educational, feature-focused

## Do's
✓ Use "we" and "you" (conversational)
✓ Lead with customer outcomes
✓ Use specific numbers (3x, 80%, $50M)
✓ Short sentences, active voice
✓ Tell stories, not just features

## Don'ts
✗ Corporate jargon ("synergy", "paradigm shift")
✗ Overpromise or hype
✗ Technical jargon without context
✗ Generic claims without proof
✗ Talking about features without benefits

## Example Messaging
**Good**: "SAM AI helped CloudTech 5x their pipeline in 90 days by automating 40 hours/week of manual research."
**Bad**: "Our revolutionary AI paradigm shift will synergize your sales operations for optimal outcomes."`,
    tags: ['tone', 'voice', 'brand', 'messaging'],
    version: '1.0',
    is_active: true,
    source_type: 'manual'
  }
];

// ============================================================================
// SEEDING FUNCTIONS
// ============================================================================

async function seedProducts() {
  console.log('📦 Seeding Products...');

  const { data, error } = await supabase
    .from('knowledge_base_products')
    .upsert(sampleProducts, { onConflict: 'workspace_id,name' })
    .select();

  if (error) {
    console.error('❌ Error seeding products:', error.message);
    return null;
  }

  console.log(`✅ Seeded ${data.length} products`);
  return data;
}

async function seedICPs() {
  console.log('🎯 Seeding ICPs...');

  const { data, error } = await supabase
    .from('knowledge_base_icps')
    .upsert(sampleICPs, { onConflict: 'workspace_id,icp_name' })
    .select();

  if (error) {
    console.error('❌ Error seeding ICPs:', error.message);
    return null;
  }

  console.log(`✅ Seeded ${data.length} ICPs`);
  return data;
}

async function seedCompetitors() {
  console.log('⚔️  Seeding Competitors...');

  const { data, error } = await supabase
    .from('knowledge_base_competitors')
    .upsert(sampleCompetitors, { onConflict: 'workspace_id,name' })
    .select();

  if (error) {
    console.error('❌ Error seeding competitors:', error.message);
    return null;
  }

  console.log(`✅ Seeded ${data.length} competitors`);
  return data;
}

async function seedPersonas() {
  console.log('👥 Seeding Personas...');

  const { data, error} = await supabase
    .from('knowledge_base_personas')
    .upsert(samplePersonas, { onConflict: 'workspace_id,name' })
    .select();

  if (error) {
    console.error('❌ Error seeding personas:', error.message);
    return null;
  }

  console.log(`✅ Seeded ${data.length} personas`);
  return data;
}

async function seedKnowledgeBase() {
  console.log('📚 Seeding Knowledge Base Content...');

  const { data, error } = await supabase
    .from('knowledge_base')
    .upsert(sampleKnowledgeBase, { onConflict: 'workspace_id,category,title' })
    .select();

  if (error) {
    console.error('❌ Error seeding knowledge base:', error.message);
    return null;
  }

  console.log(`✅ Seeded ${data.length} knowledge base entries`);
  return data;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    // Verify workspace exists
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('id', workspaceId)
      .single();

    if (wsError || !workspace) {
      console.error(`❌ Workspace ${workspaceId} not found`);
      process.exit(1);
    }

    console.log(`✅ Found workspace: ${workspace.name}\n`);

    // Seed all tables
    await seedProducts();
    await seedICPs();
    await seedCompetitors();
    await seedPersonas();
    await seedKnowledgeBase();

    console.log('\n🎉 Knowledge Base seeding complete!');
    console.log('\n📊 Summary:');
    console.log('  - Products: 2');
    console.log('  - ICPs: 1');
    console.log('  - Competitors: 2');
    console.log('  - Personas: 1');
    console.log('  - KB Entries: 7');
    console.log('\n✅ Your Knowledge Base should now show ~80-90% completion');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
