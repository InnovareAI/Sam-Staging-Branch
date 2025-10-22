import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

// Load environment variables with the following precedence:
// 1. Existing process.env values
// 2. Values from .env (standard Next.js behavior)
// 3. Values from .env.seed (demo seeding convenience file)
dotenv.config();

const seedEnvPath = path.resolve('.env.seed');
if (fs.existsSync(seedEnvPath)) {
  dotenv.config({ path: seedEnvPath, override: false });
}

const { randomUUID } = crypto;

const REQUIRED_ENVS = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL', 'WORKSPACE_ID', 'OPENROUTER_API_KEY'];

for (const key of REQUIRED_ENVS) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKSPACE_ID = process.env.WORKSPACE_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const UPLOADED_BY = process.env.SEED_UPLOADED_BY || null;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const now = () => new Date().toISOString();

const documents = [
  {
    title: 'SAM ICP Master Guide',
    section: 'icp',
    tags: ['ICP', 'targeting', 'playbook'],
    summary: 'Defines the ideal customer profile for SAM AI including verticals, signals, and decision makers.',
    keyInsights: [
      'Ideal prospects operate revenue teams of 15+ sellers and feel hiring pressure.',
      'Best-fit verticals: B2B SaaS, GTM agencies, RevOps consultancies, enterprise marketplaces.',
      'Buying signals include rapid SDR turnover, multi-channel outreach gaps, and heavy manual research.'
    ],
    content: `## SAM Ideal Customer Profile\n\n### Core Characteristics\n- Companies between 100 and 1,000 employees with dedicated revenue teams\n- North America, UK, DACH, and ANZ with English-first prospecting\n- Leadership titles: VP Sales, CRO, VP RevOps, Heads of Growth\n- Invest in Salesforce, HubSpot, or close variants with API access\n- Willing to blend AI autonomy with human review for enterprise-grade outreach\n\n### Buying Triggers\n- SDR hiring freeze or team attrition above 25%\n- Manual prospect research exceeds 6 hours per campaign\n- Existing tools (Apollo, Sales Navigator) do not personalize at scale\n- Leadership requests omnichannel sequencing but team uses email only\n- Pipeline coverage below 3× target for two consecutive quarters\n\n### Competitive Posture\nSAM wins when prospects value: speed-to-campaign, autonomous research, single orchestrator for LinkedIn + email + n8n. We lose when prospects insist on point tools or lack change management capacity.`
  },
  {
    title: 'SAM Product Overview',
    section: 'products',
    tags: ['product', 'features', 'architecture'],
    summary: 'Explains SAM AI’s orchestrated agent stack, channels, and compliance posture.',
    keyInsights: [
      'SAM runs a consultant orchestrator that assigns work to specialized agents (prospecting, KB curation, messaging, approval).',
      'Channels: LinkedIn (via Unipile MCP), email (ReachInbox + Google/Microsoft), enrichment (Bright Data, Apify, Google CSE).',
      'Compliance: workspace isolation, Netlify + Supabase stack, optional HITL checkpoints at every stage.'
    ],
    content: `# SAM AI Platform Overview\n\n## Agentic Architecture\n1. Consultant Orchestrator (Sam) — drives discovery, KB capture, strategy, and approvals.\n2. Prospect Intelligence Agent — executes Google CSE, Bright Data, and Unipile sourcing.\n3. Knowledge Curator — parses uploads, tags sections, vectors into Supabase pgvector.\n4. Campaign Builder — assembles channel steps, personalizes templates, schedules via n8n.\n5. Inbox & Reply Agent — triages responses, drafts follow-ups, escalates to humans.\n\n## Feature Highlights\n- Real-time ICP validation with live LinkedIn samples\n- Drag-and-drop knowledge ingestion (pitch decks, FAQs, pricing) feeding RAG\n- Multi-tenant safe: each workspace isolated with RLS and proxy routing\n- Approval console to enforce HITL before large sends\n- End-to-end analytics baked into Supabase + Tremor dashboards\n\n## Security & Compliance\n- Row-level security driven by workspace membership\n- OAuth / Hosted Auth for LinkedIn accounts via Unipile\n- Email sending through customer-owned reach inbox or Google/Microsoft\n- Audit logging on every automation step (campaigns, approvals, template edits).`
  },
  {
    title: 'SAM Messaging Framework',
    section: 'messaging',
    tags: ['messaging', 'linkedin', 'email'],
    summary: 'Provides the default LinkedIn + email outreach cadence and personalization levers.',
    keyInsights: [
      'Each sequence begins with a consultant-style connect request referencing KB insights.',
      'Follow-ups blend ICP-specific pains (research debt, SDR turnover) with social proof.',
      'Messaging adapts to vertical (SaaS vs agency) by switching case studies and metrics.'
    ],
    content: `# Standard SAM Messaging Sequence\n\n## LinkedIn Steps\n1. **Connection Note (Day 0)** — 220 characters max, reference shared KPI or recent funding.\n2. **Value Drop (Day 2)** — short voice of customer quote + CTA to see autonomous campaign.\n3. **Pattern Interrupt (Day 5)** — curiosity angle about agentic workflows replacing manual SDR workflows.\n\n## Email Steps\n- **Email 1:** Problem framing, highlight time saved per campaign, link to 3-slide primer.\n- **Email 2:** Case study snippet (target vertical), emphasize multi-channel orchestration.\n- **Email 3:** Objection handling ("we already use Apollo") with integration story.\n\n## Personalization Inputs\n- Industry modifiers (SaaS: ARR churn, Services: bench utilization).\n- Persona tweaks (VP Sales vs RevOps: team efficiency vs visibility).\n- Knowledge base references (use uploaded doc snippets as proof).`
  },
  {
    title: 'SAM Objection Handling Matrix',
    section: 'objections',
    tags: ['objections', 'sales', 'enablement'],
    summary: 'List of common buying objections with talk tracks and KB references.',
    keyInsights: [
      'Primary objections: “We already use Apollo,” “AI feels risky,” “Need HITL,” “Data privacy.”',
      'Talk tracks convert objection into benefit, then cite KB upload or case study.',
      'Always include fallback step: schedule 20-min GTM audit with Sam orchestrator.'
    ],
    content: `## Objection Playbook\n\n### 1. "We already use Apollo"\n- **Reframe:** Apollo = database; SAM = orchestration + personalization.\n- **Data Point:** Customers report 65% faster launch because agents do research + copy.\n- **CTA:** Offer to plug Apollo data into SAM’s agents for head-to-head A/B.\n\n### 2. "AI is risky for our brand"\n- **Reframe:** SAM maintains KB guardrails + human approvals.\n- **Evidence:** HITL approval queue + audit trail (show screenshot).\n- **CTA:** Suggest running 10-prospect pilot with manual approval to build trust.\n\n### 3. "We need human review"\n- **Reframe:** SAM bakes humans into orchestrated steps (pre-send approval, reply desk).\n- **CTA:** Demo approval UX, highlight Slack alerts for anomalies.\n\n### 4. "Data privacy?"\n- **Reframe:** Workspaces isolated via Supabase RLS + customer-controlled tokens.\n- **CTA:** Share security datasheet + optional DPA.`
  },
  {
    title: 'SAM Pricing & ROI Cheat Sheet',
    section: 'pricing',
    tags: ['pricing', 'roi', 'financial'],
    summary: 'Breaks down plan tiers, ROI math, and implementation effort.',
    keyInsights: [
      'Core plans: Starter $99, Pro $399, Enterprise $1,999+ with add-ons.',
      'ROI framing: compare to SDR cost ($120k) and tooling stack consolidation.',
      'Implementation: 1-week onboarding with ICP + KB + go-live review.'
    ],
    content: `# Pricing Overview\n\n| Plan | Monthly | Best For | Notes |\n| --- | --- | --- | --- |\n| Starter | $99 | Solo founders, early GTM | Manual approvals only, limited to 300 messages |\n| Pro | $399 | Growing teams | Full LinkedIn + email orchestration, KB automation, approval queue |\n| Enterprise | $1,999+ | Multi-region teams | Dedicated orchestrator, custom MCPs, compliance reviews |\n\n## ROI Calculation\n- Replace 1 SDR (fully loaded $120k) with autonomous prospecting + nurture agents.\n- Reduce prospect research time by 80% (avg 6 hrs → 1 hr).\n- Consolidate spend on Apollo, Lavender, scheduling tools.\n\n## Implementation Checklist\n1. ICP workshop (60 minutes)\n2. Knowledge base upload (pitch, pricing, objections)\n3. Lead source selection & approval guardrails\n4. Pilot campaign with 50 targets + review\n5. Scale automation + analytics hand-off.`
  }
];

const knowledgeContent = [
  {
    section: 'stories',
    title: 'Case Study: SaaS Sales Team Tripled Meetings',
    tags: ['case-study', 'saas', 'proof'],
    body: 'GrowthLoop replaced three SDRs by running SAM across LinkedIn and email. Meetings up 3×, cost per opportunity down 58%, compliance maintained with approval queue.'
  },
  {
    section: 'process',
    title: 'Standard SAM Onboarding Process',
    tags: ['process', 'onboarding'],
    body: 'Week 1: ICP workshop, KB ingestion, LinkedIn auth. Week 2: pilot campaign review + adjustments. Week 3: multi-channel automation and analytics hand-off.'
  }
];

const icpSeed = {
  name: 'B2B SaaS Demand Generation',
  display_name: 'Primary ICP — B2B SaaS Revenue Leaders',
  description: 'High-growth SaaS companies seeking autonomous outbound orchestration.',
  market_niche: 'sam-demo',
  industry_vertical: 'technology',
  target_profile: {
    company_demographics: {
      employee_count_ranges: ['200-1500'],
      revenue_ranges: ['$20M-$200M'],
      growth_stages: ['Series B', 'Series C', 'Growth'],
      market_valuation_ranges: ['$100M-$2B']
    },
    industry_segmentation: {
      primary_industries: ['B2B SaaS', 'Revenue Technology'],
      secondary_industries: ['RevOps Agencies']
    },
    geographic_focus: {
      primary_markets: ['United States', 'Canada', 'United Kingdom'],
      regional_preferences: ['Major Tech Hubs']
    },
    technology_requirements: {
      required_tech_stack: ['Salesforce', 'HubSpot'],
      preferred_platforms: ['Slack', 'G Suite'],
      security_requirements: ['SOC2', 'GDPR']
    }
  },
  decision_makers: {
    primary_decision_makers: {
      c_level: ['CRO', 'VP Sales', 'VP Revenue Operations']
    },
    authority_patterns: {
      budget_authority_levels: {
        'over_50k': ['CRO', 'CFO']
      }
    },
    decision_hierarchies: {
      approval_workflows: ['CRO + COO sign-off after pilot']
    }
  },
  pain_points: {
    operational_pain_points: {
      sales_process_inefficiencies: ['Manual prospecting across tools'],
      low_response_rates: ['Sequences feel generic']
    },
    buying_signals: {
      explicit_signals: ['Hiring SDRs', 'Funding announcements'],
      implicit_signals: ['LinkedIn job churn']
    }
  },
  buying_process: {
    discovery_research: {
      problem_recognition: ['Pipeline shortfall', 'SDR burnout']
    },
    evaluation_selection: {
      vendor_evaluation_criteria: ['Automation depth', 'Control & compliance']
    }
  },
  messaging_strategy: {
    value_propositions: ['Autonomous prospecting with guardrails', 'Faster go-to-market experiments'],
    proof_points: ['65% faster campaign launch', '3× meeting volume'],
    language_tone: 'Consultative, data-backed'
  },
  success_metrics: {
    pipeline_metrics: ['Meetings booked', 'Conversion to SQL'],
    efficiency_metrics: ['Hours saved per campaign']
  },
  advanced_classification: {
    persona_adaptation: ['CRO vs RevOps messaging'],
    competitive_edge: ['Blends MCP integrations + human approvals']
  }
};

const structuredIcpSeeds = [
  {
    name: 'Series A SaaS Sales Leaders',
    company_size_min: 50,
    company_size_max: 500,
    industries: ['B2B SaaS', 'Revenue Technology'],
    job_titles: ['VP Sales', 'Chief Revenue Officer', 'Head of Sales'],
    locations: ['United States', 'Canada', 'United Kingdom'],
    technologies: ['Salesforce', 'HubSpot', 'Gong'],
    pain_points: [
      'Manual outbound consuming rep capacity',
      'Pipeline coverage slipping below 3x target',
      'Personalization inconsistent across the team'
    ],
    qualification_criteria: {
      revenue_team_size: '10+ sellers',
      outbound_channels: ['LinkedIn', 'Email'],
      data_sources: ['Sales Navigator', 'ZoomInfo']
    },
    messaging_framework: {
      tone: 'consultative and ROI-driven',
      hook: 'reclaim prospecting hours and refocus on closing',
      proof_points: ['40+ meetings / month in 90 days', '18 hrs / week saved per rep']
    }
  },
  {
    name: 'RevOps & GTM Agencies',
    company_size_min: 20,
    company_size_max: 200,
    industries: ['RevOps Services', 'GTM Agencies'],
    job_titles: ['Founder', 'Managing Partner', 'Head of RevOps'],
    locations: ['United States', 'Europe'],
    technologies: ['HubSpot', 'Client CRMs', 'Zapier'],
    pain_points: [
      'Client onboarding lacks consistent playbooks',
      'Difficult to productize AI-powered outreach',
      'Manual research erodes margin on retainers'
    ],
    qualification_criteria: {
      client_count: '5+ active retainers or fractional clients',
      delivery_model: 'High-touch outbound execution for clients'
    },
    messaging_framework: {
      tone: 'peer-to-peer agency partnership',
      offer: 'white-label autonomous outbound pods',
      differentiators: ['HITL approvals', 'Multi-channel sequencing']
    }
  }
];

const structuredProductSeeds = [
  {
    name: 'SAM Orchestrated Outbound',
    description: 'AI-led outbound orchestration that blends agent automation with human approvals.',
    category: 'Platform',
    pricing: {
      plan: 'Growth',
      monthly: 99,
      trial: '14-day free trial with cancel anytime',
      signup_url: 'https://innovareai.com/sam',
      contact_email: 'helloSam@innovareai.com'
    },
    features: [
      'Consultant orchestrator with discovery workflows',
      'Prospect sourcing via Bright Data + Apify MCPs',
      'Knowledge base ingestion with vector search',
      'Multi-channel sequencing for LinkedIn and email'
    ],
    benefits: [
      'Launch full campaigns in under an hour',
      'Reduce manual research by 80%',
      'Keep HITL control without losing scale'
    ],
    use_cases: ['Founder-led sales teams', 'Agency service delivery', 'RevOps experiment pods'],
    competitive_advantages: ['End-to-end orchestration', 'Managed MCP integrations included'],
    target_segments: ['B2B SaaS', 'Revenue agencies', 'RevOps consultants']
  }
];

const structuredCompetitorSeeds = [
  {
    name: 'Outreach.io',
    website: 'https://www.outreach.io',
    description: 'Sequencing platform focused on email-first cadences and rep productivity.',
    strengths: [
      'Robust sequence management for sales teams',
      'Deep analytics on email performance'
    ],
    weaknesses: [
      'Limited automation outside of email channel',
      'Requires large teams to see full value'
    ],
    pricing_model: 'Per-seat annual subscription',
    key_features: ['Sequence editor', 'Deal intelligence', 'Task queues'],
    target_market: 'Mid-market to enterprise outbound teams',
    competitive_positioning: {
      sam_differentiator: 'Autonomous research + personalization before sequencing',
      hitl_controls: 'Built-in approvals before sends',
      integration_scope: 'MCP infrastructure baked in (Bright Data, Apify, ReachInbox)'
    }
  },
  {
    name: 'Apollo.io',
    website: 'https://www.apollo.io',
    description: 'Prospecting database with basic sequencing capabilities.',
    strengths: ['Large contact database', 'Affordable entry price'],
    weaknesses: ['Limited personalization depth', 'No agent orchestration'],
    pricing_model: 'Freemium with paid tiers',
    key_features: ['Contact enrichment', 'Basic sequences', 'Email verification'],
    target_market: 'SMB sales teams and SDRs',
    competitive_positioning: {
      sam_differentiator: 'Real prospect research + template orchestration',
      workflow: 'Blends sourcing, copy, and follow-up in one flow',
      compliance: 'Workspace RLS + approvals ensures enterprise guardrails'
    }
  }
];

const structuredPersonaSeeds = [
  {
    name: 'VP of Sales (Growth Stage)',
    job_title: 'VP of Sales',
    department: 'Revenue',
    seniority_level: 'Executive',
    decision_making_role: 'Economic Buyer',
    pain_points: [
      'Reps spend more time researching than selling',
      'Need pipeline growth without additional headcount'
    ],
    goals: ['Hit new ARR targets', 'Shorten ramp time for new reps'],
    communication_preferences: {
      preferred_channels: ['Email', 'Slack'],
      tone: 'Direct, data-backed'
    },
    objections: ['We already use Outreach', 'AI can feel impersonal'],
    messaging_approach: {
      proof: 'Share case studies with meeting lift metrics',
      offer: '14-day pilot + SDR time-savings calculator'
    },
    icpName: 'Series A SaaS Sales Leaders'
  },
  {
    name: 'Agency Founder (RevOps Services)',
    job_title: 'Founder',
    department: 'Client Delivery',
    seniority_level: 'Owner',
    decision_making_role: 'Economic Buyer',
    pain_points: ['Balancing client delivery with biz-dev', 'Margins eroded by manual research'],
    goals: ['Productize outbound services', 'Launch campaigns in under a week'],
    communication_preferences: {
      preferred_channels: ['LinkedIn DM', 'Email'],
      tone: 'Peer-to-peer, pragmatic'
    },
    objections: ['Can we white-label it?', 'Will clients approve AI copy?'],
    messaging_approach: {
      proof: 'Highlight white-label successes and approval workflows',
      offer: 'Co-branded outbound pod with SOP handoff'
    },
    icpName: 'RevOps & GTM Agencies'
  }
];

const chunkText = (text, chunkSize = 1000, overlap = 200) => {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);

    if (end < text.length) {
      const periodIndex = chunk.lastIndexOf('.');
      const newlineIndex = chunk.lastIndexOf('\n');
      const boundary = Math.max(periodIndex, newlineIndex);
      if (boundary > chunkSize * 0.5) {
        chunk = chunk.slice(0, boundary + 1);
        end = start + chunk.length;
      }
    }

    const cleaned = chunk.trim();
    if (cleaned.length > 50) {
      chunks.push(cleaned);
    }

    if (end >= text.length) {
      break;
    }

    start = end - overlap;
    if (start < 0) start = 0;
  }

  return chunks;
};

async function createEmbedding(input) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://innovareai.com/sam',
        'X-Title': 'SAM KB Seeder'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: input.substring(0, 8000),
        encoding_format: 'float'
      })
    });

    if (!response.ok) {
      throw new Error(`Embedding request failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const bodyText = await response.text();

    if (!contentType.includes('application/json')) {
      throw new Error(`Unexpected response type: ${contentType}`);
    }

    let data;
    try {
      data = JSON.parse(bodyText);
    } catch (parseError) {
      throw new Error(`Failed to parse embedding response: ${bodyText.slice(0, 150)}`);
    }

    const embedding = data?.data?.[0]?.embedding;
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Embedding payload missing or malformed');
    }

    return embedding;
  } catch (error) {
    console.error('Embedding creation error:', error);

    const fallbackVector = Array.from({ length: 1536 }, (_, i) => {
      const hash = Array.from(input).reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1), 0);
      return Math.sin(hash + i) * 0.1;
    });

    return fallbackVector;
  }
}

async function seedICPs() {
  await supabase
    .from('icp_configurations')
    .delete()
    .eq('workspace_id', WORKSPACE_ID)
    .eq('market_niche', 'sam-demo');

  const { error } = await supabase
    .from('icp_configurations')
    .insert({
      workspace_id: WORKSPACE_ID,
      status: 'active',
      priority: 'primary',
      ...icpSeed,
      created_at: now(),
      updated_at: now()
    });

  if (error) {
    throw new Error(`Failed to seed ICP configuration: ${error.message}`);
  }
}

async function seedKnowledgeContent() {
  for (const entry of knowledgeContent) {
    await supabase
      .from('knowledge_base_content')
      .delete()
      .eq('workspace_id', WORKSPACE_ID)
      .eq('section_id', entry.section)
      .eq('title', entry.title);

    const { error } = await supabase
      .from('knowledge_base_content')
      .insert({
        workspace_id: WORKSPACE_ID,
        section_id: entry.section,
        content_type: 'text',
        title: entry.title,
        content: { text: entry.body },
        metadata: { seedGroup: 'sam-demo', displayTitle: entry.title },
        tags: entry.tags,
        created_by: UPLOADED_BY,
        created_at: now(),
        updated_at: now()
      });

    if (error) {
      throw new Error(`Failed to seed content ${entry.title}: ${error.message}`);
    }
  }
}

async function seedDocuments() {
  for (const doc of documents) {
    const filename = `${doc.title.replace(/\s+/g, '-').toLowerCase()}.md`;

    await supabase
      .from('knowledge_base_documents')
      .delete()
      .eq('workspace_id', WORKSPACE_ID)
      .eq('original_filename', filename)
      .eq('section_id', doc.section);

    const documentId = randomUUID();

    const { error: insertError } = await supabase
      .from('knowledge_base_documents')
      .insert({
        id: documentId,
        workspace_id: WORKSPACE_ID,
        section_id: doc.section,
        section: doc.section,
        filename,
        original_filename: filename,
        file_type: 'text/markdown',
        file_size: doc.content.length,
        storage_path: `seed://${documentId}`,
        extracted_content: doc.content,
        metadata: { seedGroup: 'sam-demo' },
        tags: doc.tags,
        categories: doc.tags,
        content_type: 'document',
        key_insights: doc.keyInsights,
        summary: doc.summary,
        relevance_score: 0.92,
        suggested_section: doc.section,
        ai_metadata: { seeded: true },
        status: 'processed',
        processed_at: now(),
        uploaded_by: UPLOADED_BY,
        created_at: now(),
        updated_at: now()
      });

    if (insertError) {
      throw new Error(`Failed to insert document ${doc.title}: ${insertError.message}`);
    }

    const chunks = chunkText(doc.content);
    const vectorRows = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await createEmbedding(chunk);

      vectorRows.push({
        document_id: documentId,
        workspace_id: WORKSPACE_ID,
        section_id: doc.section,
        chunk_index: i,
        content: chunk,
        embedding,
        metadata: {
          seedGroup: 'sam-demo',
          chunk_length: chunk.length,
          source_title: doc.title
        },
        tags: doc.tags,
        created_at: now(),
        updated_at: now()
      });

      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    const { error: vectorError } = await supabase
      .from('knowledge_base_vectors')
      .insert(vectorRows);

    if (vectorError) {
      throw new Error(`Failed to insert vectors for ${doc.title}: ${vectorError.message}`);
    }

    const { error: updateDocError } = await supabase
      .from('knowledge_base_documents')
      .update({
        vector_chunks: vectorRows.length,
        vectorized_at: now()
      })
      .eq('id', documentId);

    if (updateDocError) {
      throw new Error(`Failed to update document metadata for ${doc.title}: ${updateDocError.message}`);
    }

    await supabase
      .from('sam_knowledge_summaries')
      .delete()
      .eq('document_id', documentId);

    const { error: summaryError } = await supabase
      .from('sam_knowledge_summaries')
      .insert({
        document_id: documentId,
        workspace_id: WORKSPACE_ID,
        section_id: doc.section,
        total_chunks: vectorRows.length,
        total_tokens: doc.content.length,
        tags: doc.tags,
        quick_summary: doc.summary,
        metadata: { seedGroup: 'sam-demo', displayTitle: doc.title },
        sam_ready: true,
        created_at: now(),
        updated_at: now()
      });

    if (summaryError) {
      throw new Error(`Failed to insert summary for ${doc.title}: ${summaryError.message}`);
    }

    const { error: analysisError } = await supabase
      .from('document_ai_analysis')
      .insert({
        workspace_id: WORKSPACE_ID,
        document_id: documentId,
        analysis_type: 'seeded_content',
        model_used: 'manual-seed',
        tags: doc.tags,
        categories: doc.tags,
        key_insights: doc.keyInsights,
        summary: doc.summary,
        relevance_score: 0.92,
        metadata: { seedGroup: 'sam-demo', displayTitle: doc.title },
        created_at: now()
      });

    if (analysisError) {
      throw new Error(`Failed to log analysis for ${doc.title}: ${analysisError.message}`);
    }
  }
}

async function seedStructuredICPs() {
  const insertedMap = new Map();

  for (const icp of structuredIcpSeeds) {
    await supabase
      .from('knowledge_base_icps')
      .delete()
      .eq('workspace_id', WORKSPACE_ID)
      .eq('name', icp.name);

    const { data, error } = await supabase
      .from('knowledge_base_icps')
      .insert({
        workspace_id: WORKSPACE_ID,
        name: icp.name,
        company_size_min: icp.company_size_min ?? null,
        company_size_max: icp.company_size_max ?? null,
        industries: icp.industries ?? [],
        job_titles: icp.job_titles ?? [],
        locations: icp.locations ?? [],
        technologies: icp.technologies ?? [],
        pain_points: icp.pain_points ?? [],
        qualification_criteria: icp.qualification_criteria ?? {},
        messaging_framework: icp.messaging_framework ?? {},
        is_active: true,
        created_by: UPLOADED_BY,
        created_at: now(),
        updated_at: now()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to seed ICP ${icp.name}: ${error.message}`);
    }

    insertedMap.set(icp.name, data.id);
  }

  return insertedMap;
}

async function seedStructuredProducts() {
  for (const product of structuredProductSeeds) {
    await supabase
      .from('knowledge_base_products')
      .delete()
      .eq('workspace_id', WORKSPACE_ID)
      .eq('name', product.name);

    const { error } = await supabase
      .from('knowledge_base_products')
      .insert({
        workspace_id: WORKSPACE_ID,
        name: product.name,
        description: product.description ?? null,
        category: product.category ?? null,
        pricing: product.pricing ?? {},
        features: product.features ?? [],
        benefits: product.benefits ?? [],
        use_cases: product.use_cases ?? [],
        competitive_advantages: product.competitive_advantages ?? [],
        target_segments: product.target_segments ?? [],
        is_active: true,
        created_by: UPLOADED_BY,
        created_at: now(),
        updated_at: now()
      });

    if (error) {
      throw new Error(`Failed to seed product ${product.name}: ${error.message}`);
    }
  }
}

async function seedStructuredCompetitors() {
  for (const competitor of structuredCompetitorSeeds) {
    await supabase
      .from('knowledge_base_competitors')
      .delete()
      .eq('workspace_id', WORKSPACE_ID)
      .eq('name', competitor.name);

    const { error } = await supabase
      .from('knowledge_base_competitors')
      .insert({
        workspace_id: WORKSPACE_ID,
        name: competitor.name,
        website: competitor.website ?? null,
        description: competitor.description ?? null,
        strengths: competitor.strengths ?? [],
        weaknesses: competitor.weaknesses ?? [],
        pricing_model: competitor.pricing_model ?? null,
        key_features: competitor.key_features ?? [],
        target_market: competitor.target_market ?? null,
        competitive_positioning: competitor.competitive_positioning ?? {},
        is_active: true,
        created_by: UPLOADED_BY,
        created_at: now(),
        updated_at: now()
      });

    if (error) {
      throw new Error(`Failed to seed competitor ${competitor.name}: ${error.message}`);
    }
  }
}

async function seedStructuredPersonas(icpMap) {
  for (const persona of structuredPersonaSeeds) {
    await supabase
      .from('knowledge_base_personas')
      .delete()
      .eq('workspace_id', WORKSPACE_ID)
      .eq('name', persona.name);

    const icpId = persona.icpName ? icpMap.get(persona.icpName) ?? null : null;

    if (persona.icpName && !icpId) {
      console.warn(`Skipping persona ${persona.name} because ICP ${persona.icpName} was not seeded.`);
      continue;
    }

    const { error } = await supabase
      .from('knowledge_base_personas')
      .insert({
        workspace_id: WORKSPACE_ID,
        icp_id: icpId,
        name: persona.name,
        job_title: persona.job_title ?? null,
        department: persona.department ?? null,
        seniority_level: persona.seniority_level ?? null,
        decision_making_role: persona.decision_making_role ?? null,
        pain_points: persona.pain_points ?? [],
        goals: persona.goals ?? [],
        communication_preferences: persona.communication_preferences ?? {},
        objections: persona.objections ?? [],
        messaging_approach: persona.messaging_approach ?? {},
        is_active: true,
        created_by: UPLOADED_BY,
        created_at: now(),
        updated_at: now()
      });

    if (error) {
      throw new Error(`Failed to seed persona ${persona.name}: ${error.message}`);
    }
  }
}

async function main() {
  console.log('🚀 Seeding SAM demo knowledge base...');

  const { error: sectionError } = await supabase
    .rpc('initialize_knowledge_base_sections', { p_workspace_id: WORKSPACE_ID });

  if (sectionError) {
    console.warn('Warning: could not initialize knowledge base sections', sectionError.message);
  }

  await seedICPs();
  await seedKnowledgeContent();
  await seedDocuments();
  const icpMap = await seedStructuredICPs();
  await seedStructuredProducts();
  await seedStructuredCompetitors();
  await seedStructuredPersonas(icpMap);

  console.log('✅ SAM knowledge base seeded successfully.');
}

main().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
