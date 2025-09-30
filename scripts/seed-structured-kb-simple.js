#!/usr/bin/env node

/**
 * Simple Seed Script for Structured Knowledge Base Tables
 * Seeds ICPs, Products, Competitors, and Personas with demo data
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const workspaceId = process.env.WORKSPACE_ID || 'b070d94f-11e2-41d4-a913-cc5a8c017208'; // Sendingcell by default

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Sample ICPs
const sampleICPs = [
  {
    title: 'B2B SaaS Growth Stage',
    description: 'Fast-growing B2B SaaS companies with 100-1000 employees looking to scale sales operations',
    industry: 'B2B SaaS',
    company_size: '100-1000 employees',
    revenue_range: '$10M-$100M ARR',
    geography: ['United States', 'Canada', 'United Kingdom'],
    pain_points: [
      'Manual prospecting consuming too much time',
      'Low response rates from generic outreach',
      'Difficulty scaling without adding headcount',
      'Inconsistent messaging across sales team'
    ],
    buying_process: {
      decision_makers: ['CRO', 'VP Sales', 'Head of Sales Operations'],
      evaluation_criteria: ['ROI', 'Ease of implementation', 'Team adoption'],
      typical_timeline: '2-4 months'
    },
    tags: ['b2b', 'saas', 'growth-stage']
  },
  {
    title: 'RevOps & GTM Agencies',
    description: 'Revenue operations and go-to-market agencies serving B2B clients',
    industry: 'Professional Services',
    company_size: '20-200 employees',
    revenue_range: '$2M-$20M',
    geography: ['United States', 'Europe'],
    pain_points: [
      'Client onboarding lacks consistent playbooks',
      'Hard to productize AI-powered services',
      'Manual research erodes margins'
    ],
    buying_process: {
      decision_makers: ['Founder', 'Managing Partner', 'Head of Delivery'],
      evaluation_criteria: ['White-label capability', 'Client results', 'Margin improvement'],
      typical_timeline: '1-2 months'
    },
    tags: ['agency', 'revops', 'services']
  }
];

// Sample Products
const sampleProducts = [
  {
    name: 'SAM AI Enterprise',
    description: 'Full-featured AI sales assistant with autonomous prospecting, multi-channel orchestration, and human-in-the-loop controls',
    sku: 'SAM-ENT-001',
    category: 'Sales Automation Platform',
    price: 1999.00,
    currency: 'USD',
    pricing_model: 'subscription',
    features: [
      'Autonomous prospect research via AI agents',
      'Multi-channel sequencing (LinkedIn + Email)',
      'Knowledge base with RAG search',
      'Human approval workflows (HITL)',
      'Campaign analytics dashboard',
      'Dedicated success manager'
    ],
    benefits: [
      'Launch campaigns in under 1 hour',
      'Reduce manual research by 80%',
      '3x increase in meeting bookings',
      'Maintain brand control with approvals'
    ],
    use_cases: [
      'Enterprise outbound sales teams',
      'Account-based marketing campaigns',
      'Multi-product sales organizations',
      'International expansion initiatives'
    ],
    specifications: {
      users: 'Unlimited',
      campaigns_per_month: 'Unlimited',
      integrations: ['Salesforce', 'HubSpot', 'LinkedIn', 'Email providers', 'Slack'],
      support: '24/7 Priority',
      sla: '99.9% uptime'
    },
    tags: ['enterprise', 'full-featured', 'white-glove']
  },
  {
    name: 'SAM AI Growth',
    description: 'Core AI sales assistant for growing teams who need autonomous prospecting without enterprise overhead',
    sku: 'SAM-GRO-001',
    category: 'Sales Automation Platform',
    price: 399.00,
    currency: 'USD',
    pricing_model: 'subscription',
    features: [
      'AI-powered prospect research',
      'Email and LinkedIn campaigns',
      'Basic knowledge base',
      'Campaign templates',
      'Standard analytics'
    ],
    benefits: [
      'Get started in 15 minutes',
      'Save 10+ hours per week',
      '2x response rate improvement',
      'Affordable for growing teams'
    ],
    use_cases: [
      'Series A/B sales teams',
      'Founder-led sales',
      'Sales development teams',
      'Market testing initiatives'
    ],
    specifications: {
      users: 'Up to 10',
      campaigns_per_month: '50',
      integrations: ['Basic CRM', 'Email', 'LinkedIn'],
      support: 'Email (24hr response)',
      sla: '99.5% uptime'
    },
    tags: ['growth', 'smb', 'self-serve']
  }
];

// Sample Competitors
const sampleCompetitors = [
  {
    name: 'Outreach.io',
    description: 'Enterprise sales engagement platform with email sequencing and analytics',
    website: 'https://www.outreach.io',
    market_share: 'Market Leader',
    market_position: '#1 in Sales Engagement',
    strengths: [
      'Mature platform with extensive features',
      'Strong enterprise customer base',
      'Robust integrations ecosystem',
      'Well-established brand'
    ],
    weaknesses: [
      'Complex setup (2-4 week onboarding)',
      'Higher price point ($100+/user)',
      'Limited AI personalization',
      'Requires significant training'
    ],
    opportunities: [
      'Emphasize SAM\'s faster setup (under 1 hour)',
      'Highlight superior AI personalization',
      'Target frustrated customers with complexity',
      'Compete on total cost of ownership'
    ],
    threats: [
      'Deep pockets for R&D investment',
      'Strong existing customer relationships',
      'Extensive partner network'
    ],
    pricing_info: {
      starting_price: '$100/user/month',
      model: 'Per-user subscription',
      enterprise_pricing: 'Custom (typically $150-200/user)',
      contract_terms: 'Annual contracts required'
    },
    product_comparison: {
      ai_personalization: 'Basic (templates only)',
      setup_time: '2-4 weeks',
      ease_of_use: 'Medium complexity',
      autonomous_research: 'No',
      hitl_controls: 'Limited'
    },
    tags: ['sales-engagement', 'enterprise', 'incumbent']
  },
  {
    name: 'Apollo.io',
    description: 'Sales intelligence and engagement platform with large contact database',
    website: 'https://www.apollo.io',
    market_share: 'Fast Growing',
    market_position: 'Challenger with momentum',
    strengths: [
      'Large contact database (270M+)',
      'Affordable entry price point',
      'Easy to get started',
      'Good for prospecting'
    ],
    weaknesses: [
      'Limited AI personalization',
      'Basic automation capabilities',
      'Data quality concerns',
      'No autonomous research'
    ],
    opportunities: [
      'Target users needing advanced AI',
      'Highlight autonomous research vs manual',
      'Emphasize quality over quantity',
      'Focus on enterprise features'
    ],
    threats: [
      'Large established user base',
      'Aggressive pricing',
      'Fast product development pace'
    ],
    pricing_info: {
      starting_price: '$49/user/month',
      model: 'Freemium + Paid tiers',
      enterprise_pricing: '$79-$149/user/month',
      contract_terms: 'Monthly or annual'
    },
    product_comparison: {
      ai_personalization: 'Minimal',
      setup_time: '1-2 days',
      ease_of_use: 'High (simple interface)',
      autonomous_research: 'No',
      hitl_controls: 'No'
    },
    tags: ['sales-intelligence', 'mid-market', 'database']
  }
];

// Sample Personas
const samplePersonas = [
  {
    name: 'VP of Sales (Growth Stage)',
    description: 'Experienced sales leader at fast-growing B2B company, focused on team productivity and pipeline growth',
    job_title: 'VP of Sales',
    seniority_level: 'VP/Director',
    department: 'Sales',
    age_range: '35-50',
    location: 'United States',
    goals: [
      'Hit aggressive new ARR targets',
      'Scale team without proportional cost increase',
      'Improve rep productivity by 30%',
      'Shorten sales cycles',
      'Build repeatable playbooks'
    ],
    challenges: [
      'Reps spend too much time on research vs selling',
      'Need pipeline growth without adding headcount',
      'Inconsistent outreach quality across team',
      'Difficulty proving ROI of sales tools',
      'Managing multiple point solutions'
    ],
    motivations: [
      'Career advancement through measurable results',
      'Building high-performing teams',
      'Being seen as strategic partner to CEO',
      'Implementing innovative solutions'
    ],
    frustrations: [
      'Sales reps ignoring new tools',
      'Complex tools requiring too much training',
      'Lack of integration between tools',
      'Manual data entry and admin work'
    ],
    decision_criteria: [
      'Clear ROI within 90 days',
      'Easy adoption by sales team',
      'Integrates with existing CRM',
      'Vendor support and partnership',
      'References from similar companies'
    ],
    preferred_channels: [
      'LinkedIn',
      'Industry events',
      'Peer recommendations',
      'Sales leadership communities',
      'Demo videos'
    ],
    content_preferences: {
      formats: ['Case studies', 'ROI calculators', 'Live demos', 'Peer testimonials'],
      topics: ['Team productivity', 'Pipeline acceleration', 'Sales efficiency'],
      tone: 'Data-driven, results-focused, strategic'
    },
    tags: ['sales-leader', 'decision-maker', 'b2b']
  },
  {
    name: 'Founder (Series A SaaS)',
    description: 'Technical founder wearing multiple hats, focused on rapid growth and efficient capital deployment',
    job_title: 'Co-Founder & CEO',
    seniority_level: 'C-Level',
    department: 'Executive',
    age_range: '28-40',
    location: 'San Francisco / New York',
    goals: [
      'Hit next funding milestone',
      'Prove repeatable sales motion',
      'Maximize runway efficiency',
      'Build sales processes that scale',
      'Achieve product-market fit'
    ],
    challenges: [
      'Limited budget for tooling',
      'Wearing too many hats',
      'Need to move fast and iterate',
      'Lack of established processes',
      'Pressure from investors for growth'
    ],
    motivations: [
      'Building a successful company',
      'Financial independence',
      'Making an impact in industry',
      'Proving the business model'
    ],
    frustrations: [
      'Slow manual prospecting processes',
      'Wasted time on unqualified leads',
      'High customer acquisition costs',
      'Complex enterprise tools',
      'Long implementation times'
    ],
    decision_criteria: [
      'Fast time to value (days not weeks)',
      'Affordable pricing for stage',
      'Easy to use without training',
      'Modern, intuitive interface',
      'Ability to scale with company'
    ],
    preferred_channels: [
      'Product Hunt',
      'Twitter/X',
      'Startup communities (YC, etc)',
      'Founder Slack groups',
      'Podcasts'
    ],
    content_preferences: {
      formats: ['Quick demos', 'Founder stories', 'Growth tactics', 'Video walkthroughs'],
      topics: ['Efficiency', 'Growth hacks', 'Fundraising', 'Scaling'],
      tone: 'Authentic, energetic, scrappy'
    },
    tags: ['founder', 'startup', 'early-stage']
  }
];

async function seedData() {
  console.log('🌱 Seeding structured knowledge base with demo data...\n');
  console.log(`📍 Target workspace: ${workspaceId}\n`);

  let stats = { icps: 0, products: 0, competitors: 0, personas: 0 };

  // Seed ICPs
  console.log('📋 Seeding ICPs...');
  for (const icp of sampleICPs) {
    const { error } = await supabase
      .from('knowledge_base_icps')
      .insert({
        workspace_id: workspaceId,
        ...icp
      });

    if (error) {
      console.error(`   ❌ Error seeding ICP "${icp.title}":`, error.message);
    } else {
      console.log(`   ✅ Created ICP: "${icp.title}"`);
      stats.icps++;
    }
  }

  // Seed Products
  console.log('\n📦 Seeding Products...');
  for (const product of sampleProducts) {
    const { error } = await supabase
      .from('knowledge_base_products')
      .insert({
        workspace_id: workspaceId,
        ...product
      });

    if (error) {
      console.error(`   ❌ Error seeding Product "${product.name}":`, error.message);
    } else {
      console.log(`   ✅ Created Product: "${product.name}"`);
      stats.products++;
    }
  }

  // Seed Competitors
  console.log('\n🏆 Seeding Competitors...');
  for (const competitor of sampleCompetitors) {
    const { error } = await supabase
      .from('knowledge_base_competitors')
      .insert({
        workspace_id: workspaceId,
        ...competitor
      });

    if (error) {
      console.error(`   ❌ Error seeding Competitor "${competitor.name}":`, error.message);
    } else {
      console.log(`   ✅ Created Competitor: "${competitor.name}"`);
      stats.competitors++;
    }
  }

  // Seed Personas
  console.log('\n👥 Seeding Personas...');
  for (const persona of samplePersonas) {
    const { error } = await supabase
      .from('knowledge_base_personas')
      .insert({
        workspace_id: workspaceId,
        ...persona
      });

    if (error) {
      console.error(`   ❌ Error seeding Persona "${persona.name}":`, error.message);
    } else {
      console.log(`   ✅ Created Persona: "${persona.name}"`);
      stats.personas++;
    }
  }

  console.log('\n✅ Seeding complete!\n');
  console.log('📊 Summary:');
  console.log(`   - ${stats.icps} ICPs`);
  console.log(`   - ${stats.products} Products`);
  console.log(`   - ${stats.competitors} Competitors`);
  console.log(`   - ${stats.personas} Personas`);
  console.log('\n🎉 Demo data ready at: https://app.meet-sam.com\n');
}

seedData().catch(error => {
  console.error('\n❌ Seeding failed:', error);
  process.exit(1);
});