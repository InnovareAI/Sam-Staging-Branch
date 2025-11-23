#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importEnrichedProspects() {
  const filename = '/Users/tvonlinz/Desktop/prospects-to-enrich.csv';

  console.log('📥 Importing enriched prospects...\n');

  const csvContent = fs.readFileSync(filename, 'utf-8');
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',');

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line (handle quoted fields)
    const matches = line.match(/(?:\"([^\"]*)\"|([^,]*))/g);
    if (!matches || matches.length < 7) {
      console.log('⚠️  Line', i, '- Invalid format');
      skipped++;
      continue;
    }

    const id = matches[0].replace(/\"/g, '');
    const firstName = matches[1].replace(/\"/g, '');
    const lastName = matches[2].replace(/\"/g, '');
    const currentTitle = matches[3].replace(/\"/g, '');
    const currentCompany = matches[4].replace(/\"/g, '');

    // Skip if no enrichment data provided
    if (!currentTitle && !currentCompany) {
      console.log('⏭️ ', firstName, lastName, '- No enrichment data');
      skipped++;
      continue;
    }

    try {
      const { error } = await supabase
        .from('campaign_prospects')
        .update({
          title: currentTitle || null,
          company_name: currentCompany || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.log('❌', firstName, lastName, '- Update failed:', error.message);
        failed++;
      } else {
        console.log('✅', firstName, lastName);
        console.log('   Title:', currentTitle || '(none)');
        console.log('   Company:', currentCompany || '(none)');
        updated++;
      }
    } catch (error) {
      console.log('❌', firstName, lastName, '- Error:', error.message);
      failed++;
    }
  }

  console.log('\n📊 Summary:');
  console.log('  ✅ Updated:', updated);
  console.log('  ⏭️  Skipped:', skipped);
  console.log('  ❌ Failed:', failed);
  console.log('\n✅ Import complete!');
}

importEnrichedProspects();
