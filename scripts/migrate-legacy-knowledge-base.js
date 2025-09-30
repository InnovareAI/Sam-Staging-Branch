import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const loadEnv = () => {
  dotenv.config();
  const seedEnvPath = path.resolve('.env.seed');
  if (fs.existsSync(seedEnvPath)) {
    dotenv.config({ path: seedEnvPath, override: false });
  }
};

loadEnv();

const REQUIRED_ENVS = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL'];
for (const key of REQUIRED_ENVS) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item).trim()))
      .filter((item) => item.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const toRecord = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return {};
};

const safeString = (value, fallback = null) => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
};

const transformIcp = (row) => {
  const { content, metadata, title, workspace_id, created_at, updated_at } = row;
  if (!workspace_id) {
    return { skip: true, reason: 'Missing workspace_id' };
  }
  const source = content && typeof content === 'object' ? content : {};
  const name = safeString(source.name || source.icp_name || title || metadata?.name, null);
  if (!name) {
    return { skip: true, reason: 'Missing ICP name' };
  }

  return {
    workspace_id,
    name,
    company_size_min: typeof source.company_size_min === 'number' ? source.company_size_min : null,
    company_size_max: typeof source.company_size_max === 'number' ? source.company_size_max : null,
    industries: toArray(source.industries || metadata?.industries || source.target_markets),
    job_titles: toArray(source.job_titles || metadata?.job_titles),
    locations: toArray(source.locations || metadata?.geographies),
    technologies: toArray(source.technologies || metadata?.technology_stack),
    pain_points: toArray(source.pain_points || metadata?.pain_points),
    qualification_criteria: toRecord(source.qualification_criteria || metadata?.qualification_criteria),
    messaging_framework: toRecord(source.messaging_framework || metadata?.messaging_framework),
    is_active: row.is_active ?? true,
    created_at: created_at || new Date().toISOString(),
    updated_at: updated_at || new Date().toISOString(),
  };
};

const transformProduct = (row) => {
  const { content, metadata, title, workspace_id, created_at, updated_at } = row;
  if (!workspace_id) {
    return { skip: true, reason: 'Missing workspace_id' };
  }
  const source = content && typeof content === 'object' ? content : {};
  const name = safeString(source.name || title || metadata?.name, null);
  if (!name) {
    return { skip: true, reason: 'Missing product name' };
  }
  return {
    workspace_id,
    name,
    description: safeString(source.description || metadata?.summary || (typeof content === 'string' ? content : null), null),
    category: safeString(source.category || metadata?.category, null),
    pricing: toRecord(source.pricing || metadata?.pricing),
    features: toArray(source.features || metadata?.features),
    benefits: toArray(source.benefits || metadata?.benefits),
    use_cases: toArray(source.use_cases || metadata?.use_cases),
    competitive_advantages: toArray(source.competitive_advantages || metadata?.competitive_advantages),
    target_segments: toArray(source.target_segments || metadata?.target_segments),
    is_active: row.is_active ?? true,
    created_at: created_at || new Date().toISOString(),
    updated_at: updated_at || new Date().toISOString(),
  };
};

const transformCompetitor = (row) => {
  const { content, metadata, title, workspace_id, created_at, updated_at } = row;
  if (!workspace_id) {
    return { skip: true, reason: 'Missing workspace_id' };
  }
  const source = content && typeof content === 'object' ? content : {};
  const name = safeString(source.name || title || metadata?.name, null);
  if (!name) {
    return { skip: true, reason: 'Missing competitor name' };
  }
  return {
    workspace_id,
    name,
    website: safeString(source.website || metadata?.website, null),
    description: safeString(source.description || metadata?.description || (typeof content === 'string' ? content : null), null),
    strengths: toArray(source.strengths || metadata?.strengths),
    weaknesses: toArray(source.weaknesses || metadata?.weaknesses),
    pricing_model: safeString(source.pricing_model || metadata?.pricing_model, null),
    key_features: toArray(source.key_features || metadata?.key_features),
    target_market: safeString(source.target_market || metadata?.target_market, null),
    competitive_positioning: toRecord(source.competitive_positioning || metadata?.competitive_positioning),
    is_active: row.is_active ?? true,
    created_at: created_at || new Date().toISOString(),
    updated_at: updated_at || new Date().toISOString(),
  };
};

const transformPersona = (row) => {
  const { content, metadata, title, workspace_id, created_at, updated_at } = row;
  if (!workspace_id) {
    return { skip: true, reason: 'Missing workspace_id' };
  }
  const source = content && typeof content === 'object' ? content : {};
  const name = safeString(source.name || title || metadata?.name, null);
  if (!name) {
    return { skip: true, reason: 'Missing persona name' };
  }
  return {
    workspace_id,
    name,
    icp_id: safeString(source.icp_id || metadata?.icp_id, null),
    job_title: safeString(source.job_title || metadata?.job_title, null),
    department: safeString(source.department || metadata?.department, null),
    seniority_level: safeString(source.seniority_level || metadata?.seniority_level, null),
    decision_making_role: safeString(source.decision_making_role || metadata?.decision_making_role, null),
    pain_points: toArray(source.pain_points || metadata?.pain_points),
    goals: toArray(source.goals || metadata?.goals),
    communication_preferences: toRecord(source.communication_preferences || metadata?.communication_preferences),
    objections: toArray(source.objections || metadata?.objections),
    messaging_approach: toRecord(source.messaging_approach || metadata?.messaging_approach),
    is_active: row.is_active ?? true,
    created_at: created_at || new Date().toISOString(),
    updated_at: updated_at || new Date().toISOString(),
  };
};

const SECTION_HANDLERS = {
  icp: {
    target: 'knowledge_base_icps',
    transform: transformIcp,
    conflictKey: 'workspace_id,name',
  },
  products: {
    target: 'knowledge_base_products',
    transform: transformProduct,
    conflictKey: 'workspace_id,name',
  },
  competition: {
    target: 'knowledge_base_competitors',
    transform: transformCompetitor,
    conflictKey: 'workspace_id,name',
  },
  personas: {
    target: 'knowledge_base_personas',
    transform: transformPersona,
    conflictKey: 'workspace_id,name',
  },
};

const processSection = async (sectionId) => {
  const handler = SECTION_HANDLERS[sectionId];
  if (!handler) return;

  const summary = {
    total: 0,
    transformed: 0,
    inserted: 0,
    skipped: 0,
    errors: 0,
    skipReasons: {},
  };

  const { data: rows, error } = await supabase
    .from('knowledge_base_content')
    .select('*')
    .eq('section_id', sectionId);

  if (error) {
    console.error(`Failed to fetch legacy content for section ${sectionId}:`, error);
    throw error;
  }

  summary.total = rows.length;

  for (const row of rows) {
    const result = handler.transform(row);
    if (result?.skip) {
      summary.skipped += 1;
      summary.skipReasons[result.reason] = (summary.skipReasons[result.reason] || 0) + 1;
      continue;
    }

    summary.transformed += 1;

    if (DRY_RUN) {
      summary.inserted += 1;
      continue;
    }

    const { error: upsertError } = await supabase
      .from(handler.target)
      .upsert(result, { onConflict: handler.conflictKey });

    if (upsertError) {
      summary.errors += 1;
      console.error(`Failed to upsert into ${handler.target}:`, upsertError, '\nPayload:', result);
      continue;
    }

    summary.inserted += 1;
  }

  return summary;
};

const run = async () => {
  const sections = Object.keys(SECTION_HANDLERS);
  const overall = {};
  console.log(`Starting legacy knowledge base migration${DRY_RUN ? ' (dry run)' : ''}...`);

  for (const section of sections) {
    console.log(`\nProcessing section: ${section}`);
    try {
      const summary = await processSection(section);
      overall[section] = summary;
      console.table({
        total: summary.total,
        transformed: summary.transformed,
        inserted: summary.inserted,
        skipped: summary.skipped,
        errors: summary.errors,
      });
      if (Object.keys(summary.skipReasons).length > 0) {
        console.log('Skip reasons:', summary.skipReasons);
      }
    } catch (error) {
      console.error(`Section ${section} failed`, error);
      overall[section] = { error: error.message };
    }
  }

  console.log('\nMigration complete. Summary:');
  console.dir(overall, { depth: null });
  if (DRY_RUN) {
    console.log('\nNo records were written (dry run). Run again without --dry-run to apply changes.');
  }
};

run().catch((error) => {
  console.error('Migration failed', error);
  process.exit(1);
});
