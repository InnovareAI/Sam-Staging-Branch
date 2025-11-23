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

async function exportForManualEnrichment() {
  const campaignId = '0a56408b-be39-4144-870f-2b0dce45b620';

  console.log('📊 Exporting prospects for manual enrichment...\n');

  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, title, company_name, linkedin_url')
    .eq('campaign_id', campaignId)
    .order('first_name');

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`Found ${prospects.length} prospects\n`);

  // Create CSV
  const csvLines = [
    'id,first_name,last_name,current_title,current_company,linkedin_url,headline'
  ];

  prospects.forEach(p => {
    const csvLine = [
      p.id,
      p.first_name,
      p.last_name,
      '', // Empty - to be filled manually
      '', // Empty - to be filled manually
      p.linkedin_url,
      `"${(p.title || '').replace(/"/g, '""')}"` // Current headline for reference
    ].join(',');
    csvLines.push(csvLine);
  });

  const csvContent = csvLines.join('\n');
  const filename = '/Users/tvonlinz/Desktop/prospects-to-enrich.csv';

  fs.writeFileSync(filename, csvContent);

  console.log(`✅ Exported to: ${filename}`);
  console.log('\nInstructions:');
  console.log('1. Open the CSV file');
  console.log('2. For each prospect, visit their LinkedIn URL');
  console.log('3. Fill in current_title and current_company columns');
  console.log('4. Save the file');
  console.log('5. Run the import script to update the database');
}

exportForManualEnrichment();
