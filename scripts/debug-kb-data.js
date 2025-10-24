#!/usr/bin/env node
/**
 * Debug KB data to see what frontend sees vs what backend calculates
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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const workspaceId = process.argv[2] || 'dea5a7f2-673c-4429-972d-6ba5fca473fb';

  console.log(`\n🔍 Debug KB Data for workspace: ${workspaceId}\n`);

  // Get all documents (what frontend sees)
  const { data: documents, error: docError } = await supabase
    .from('knowledge_base')
    .select('id, title, category, is_active')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  if (docError) {
    console.error('Error:', docError);
    process.exit(1);
  }

  console.log(`\n📄 Total Documents: ${documents.length}\n`);

  // Group by category (this is what's actually stored)
  const byCategory = {};
  documents.forEach(doc => {
    const category = doc.category || 'unknown';
    if (!byCategory[category]) {
      byCategory[category] = [];
    }
    byCategory[category].push(doc);
  });

  console.log('Documents by CATEGORY:');
  Object.entries(byCategory).sort().forEach(([category, docs]) => {
    console.log(`  ${category}: ${docs.length} docs`);
  });

  console.log('\n');

  // Get ICPs
  const { data: icps } = await supabase
    .from('sam_icps')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  console.log(`\n🎯 ICPs: ${icps?.length || 0}`);
  icps?.forEach(icp => console.log(`  - ${icp.name}`));

  // Get products
  const { data: products } = await supabase
    .from('knowledge_base_products')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  console.log(`\n📦 Products: ${products?.length || 0}`);
  products?.forEach(p => console.log(`  - ${p.name}`));

  // Get competitors
  const { data: competitors } = await supabase
    .from('knowledge_base_competitors')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  console.log(`\n🥊 Competitors: ${competitors?.length || 0}`);
  competitors?.forEach(c => console.log(`  - ${c.name}`));

  // Get personas
  const { data: personas } = await supabase
    .from('knowledge_base_personas')
    .select('id, title')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  console.log(`\n👤 Personas: ${personas?.length || 0}`);
  personas?.forEach(p => console.log(`  - ${p.title}`));

  console.log('\n\n🔍 FRONTEND CALCULATION (by section):');
  console.log('====================================\n');
  
  const categoryMap = {
    products: ['products'],
    icp: ['icp', 'icp-intelligence'],
    messaging: ['messaging'],
    pricing: ['pricing'],
    objections: ['objections', 'objection-handling'],
    success: ['case-studies', 'success-stories'],
    competition: ['competitive-intelligence', 'competition', 'competitors'],
    company: ['company-info'],
    buying: ['sales-process', 'buying-process'],
    personas: ['personas'],
    compliance: ['compliance'],
    tone: ['tone-of-voice']
  };

  const getSectionScore = (sectionId, count) => {
    if (count === 0) return 0;
    if (count === 1) return 40;
    if (count <= 3) return 70;
    return 100;
  };

  const criticalSections = [
    { id: 'products', weight: 15 },
    { id: 'icp', weight: 15 },
    { id: 'messaging', weight: 15 },
    { id: 'pricing', weight: 15 }
  ];

  const importantSections = [
    { id: 'objections', weight: 10 },
    { id: 'success', weight: 10 },
    { id: 'competition', weight: 10 }
  ];

  const supportingSections = [
    { id: 'company', weight: 2 },
    { id: 'buying', weight: 2 },
    { id: 'personas', weight: 2 },
    { id: 'compliance', weight: 2 },
    { id: 'tone', weight: 2 }
  ];

  let criticalScore = 0;
  let importantScore = 0;
  let supportingScore = 0;

  console.log('🔴 CRITICAL (60% weight):');
  criticalSections.forEach(section => {
    let count = 0;
    if (section.id === 'icp') {
      count = icps?.length || 0;
    } else {
      const matches = categoryMap[section.id];
      count = documents.filter(d => 
        matches.some(m => d.category?.toLowerCase() === m.toLowerCase())
      ).length;
    }
    const score = getSectionScore(section.id, count);
    const weighted = score * section.weight / 100;
    criticalScore += weighted;
    console.log(`  ${section.id.padEnd(12)} ${count} docs -> ${score}% -> ${weighted.toFixed(1)} points`);
  });

  console.log('\n🟡 IMPORTANT (30% weight):');
  importantSections.forEach(section => {
    const matches = categoryMap[section.id];
    const count = documents.filter(d => 
      matches.some(m => d.category?.toLowerCase() === m.toLowerCase())
    ).length;
    const score = getSectionScore(section.id, count);
    const weighted = score * section.weight / 100;
    importantScore += weighted;
    console.log(`  ${section.id.padEnd(12)} ${count} docs -> ${score}% -> ${weighted.toFixed(1)} points`);
  });

  console.log('\n🟢 SUPPORTING (10% weight):');
  supportingSections.forEach(section => {
    const matches = categoryMap[section.id];
    const count = documents.filter(d => 
      matches.some(m => d.category?.toLowerCase() === m.toLowerCase())
    ).length;
    const score = getSectionScore(section.id, count);
    const weighted = score * section.weight / 100;
    supportingScore += weighted;
    console.log(`  ${section.id.padEnd(12)} ${count} docs -> ${score}% -> ${weighted.toFixed(1)} points`);
  });

  const total = Math.round(criticalScore + importantScore + supportingScore);
  console.log(`\n📊 TOTAL: ${criticalScore.toFixed(1)} + ${importantScore.toFixed(1)} + ${supportingScore.toFixed(1)} = ${total}%\n`);
}

main().catch(console.error);
