#!/usr/bin/env node
/**
 * Check actual KB completion for a workspace
 * This queries the real database to see what the completion percentage actually is
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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getWorkspaceKBData(workspaceId) {
  console.log(`\n📊 Analyzing KB for workspace: ${workspaceId}\n`);

  // Get all KB entries by category
  const { data: kbEntries, error: kbError } = await supabase
    .from('knowledge_base')
    .select('id, category, title, content, is_active')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  if (kbError) {
    console.error('Error fetching KB entries:', kbError);
    return null;
  }

  // Get ICP data
  const { data: icps, error: icpError } = await supabase
    .from('sam_icps')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  // Get ICP knowledge entries
  const { data: icpKnowledge, error: icpKnowError } = await supabase
    .from('sam_icp_knowledge_entries')
    .select('category')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  // Get products
  const { data: products, error: prodError } = await supabase
    .from('knowledge_base_products')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  // Get competitors
  const { data: competitors, error: compError } = await supabase
    .from('knowledge_base_competitors')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  // Get personas
  const { data: personas, error: persError } = await supabase
    .from('knowledge_base_personas')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  return {
    kbEntries: kbEntries || [],
    icps: icps || [],
    icpKnowledge: icpKnowledge || [],
    products: products || [],
    competitors: competitors || [],
    personas: personas || []
  };
}

function calculateCompletion(data) {
  const sections = {
    // Critical: 60% total weight
    products: { category: 'products', weight: 15, minEntries: 2 },
    icp: { category: 'icp-intelligence', weight: 15, minEntries: 3 },
    messaging: { category: 'messaging', weight: 15, minEntries: 3 },
    pricing: { category: 'pricing', weight: 15, minEntries: 1 },
    
    // Important: 30% total weight
    objections: { category: 'objection-handling', weight: 10, minEntries: 3 },
    success_stories: { category: 'case-studies', weight: 10, minEntries: 2 },
    competition: { category: 'competitive-intelligence', weight: 10, minEntries: 2 },
    
    // Supporting: 10% total weight
    company_info: { category: 'company-info', weight: 2, minEntries: 1 },
    buying_process: { category: 'sales-process', weight: 2, minEntries: 1 },
    personas: { category: 'personas', weight: 2, minEntries: 2 },
    compliance: { category: 'compliance', weight: 2, minEntries: 1 },
    tone_of_voice: { category: 'tone-of-voice', weight: 2, minEntries: 1 }
  };

  const sectionResults = {};
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const [sectionName, config] of Object.entries(sections)) {
    let entries = 0;
    let totalContentLength = 0;

    // Count entries from knowledge_base
    const categoryEntries = data.kbEntries.filter(e => 
      e.category === config.category || 
      e.category?.includes(sectionName.replace('_', '-'))
    );
    entries += categoryEntries.length;
    totalContentLength += categoryEntries.reduce((sum, e) => sum + (e.content?.length || 0), 0);

    // Count from ICP knowledge entries
    if (sectionName === 'icp') {
      const icpKnowledgeCount = data.icpKnowledge.filter(e => 
        e.category === 'icp' || e.category?.includes('target')
      ).length;
      entries += icpKnowledgeCount;
      entries += data.icps.length * 2; // Each ICP config counts as 2 entries
    }

    // Count structured data
    if (sectionName === 'products') entries += data.products.length;
    if (sectionName === 'competition') entries += data.competitors.length;
    if (sectionName === 'personas') entries += data.personas.length;

    // Calculate percentage (based on entries vs. minEntries)
    const percentage = config.minEntries > 0 
      ? Math.min(100, Math.round((entries / config.minEntries) * 100))
      : entries > 0 ? 100 : 0;

    sectionResults[sectionName] = { percentage, entries, weight: config.weight };

    // Calculate weighted score
    totalWeightedScore += percentage * config.weight;
    totalWeight += config.weight;
  }

  const overallCompleteness = Math.round(totalWeightedScore / totalWeight);

  return { overallCompleteness, sectionResults };
}

async function main() {
  const workspaceId = process.argv[2];

  if (!workspaceId) {
    // List all workspaces
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching workspaces:', error);
      process.exit(1);
    }

    console.log('\n📋 Recent Workspaces:');
    console.log('====================\n');
    workspaces.forEach(w => {
      console.log(`${w.name || 'Unnamed'}`);
      console.log(`  ID: ${w.id}`);
      console.log(`  Created: ${new Date(w.created_at).toLocaleDateString()}\n`);
    });
    console.log('\nUsage: node check-actual-kb-completion.js <workspace_id>');
    process.exit(0);
  }

  const data = await getWorkspaceKBData(workspaceId);
  if (!data) {
    process.exit(1);
  }

  const { overallCompleteness, sectionResults } = calculateCompletion(data);

  console.log(`Overall Completion: ${overallCompleteness}%\n`);
  console.log('Section Breakdown:');
  console.log('==================\n');

  console.log('🔴 CRITICAL (60% weight):');
  ['products', 'icp', 'messaging', 'pricing'].forEach(section => {
    const result = sectionResults[section];
    console.log(`  ${section.padEnd(15)} ${result.percentage}%  (${result.entries} entries, weight: ${result.weight})`);
  });

  console.log('\n🟡 IMPORTANT (30% weight):');
  ['objections', 'success_stories', 'competition'].forEach(section => {
    const result = sectionResults[section];
    console.log(`  ${section.padEnd(15)} ${result.percentage}%  (${result.entries} entries, weight: ${result.weight})`);
  });

  console.log('\n🟢 SUPPORTING (10% weight):');
  ['company_info', 'buying_process', 'personas', 'compliance', 'tone_of_voice'].forEach(section => {
    const result = sectionResults[section];
    console.log(`  ${section.padEnd(15)} ${result.percentage}%  (${result.entries} entries, weight: ${result.weight})`);
  });

  console.log('\n');
}

main().catch(console.error);
