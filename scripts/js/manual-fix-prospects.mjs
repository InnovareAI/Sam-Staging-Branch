#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Manual data from LinkedIn profiles
// Setting title and company to null for prospects that need manual lookup
const manualFixes = [
  {
    name: 'Candy Alexander',
    title: null,
    company: null
  },
  {
    name: 'Bogdan Vykhovanyuk',
    title: null,
    company: null
  },
  {
    name: 'Edward Lagow',
    title: null,
    company: null
  },
  {
    name: 'Steve Salinas',
    title: null,
    company: null
  },
  {
    name: 'Thomas Wolfe',
    title: null,
    company: null
  },
  {
    name: 'Erik Wells',
    title: null,
    company: null
  },
  {
    name: 'Mark Kondrak',
    title: null,
    company: null
  }
];

async function manuallyFixProspects() {
  const campaignId = '0a56408b-be39-4144-870f-2b0dce45b620';

  console.log('🔧 Manually updating prospects with correct data...\n');

  for (const fix of manualFixes) {
    try {
      // Find prospect by name
      const { data: prospect, error: findError } = await supabase
        .from('campaign_prospects')
        .select('id, first_name, last_name')
        .eq('campaign_id', campaignId)
        .or(`first_name.ilike.%${fix.name.split(' ')[0]}%`)
        .single();

      if (findError || !prospect) {
        console.log('⚠️ ', fix.name, '- Not found in database');
        continue;
      }

      // Update with correct data
      const { error: updateError } = await supabase
        .from('campaign_prospects')
        .update({
          title: fix.title,
          company_name: fix.company,
          updated_at: new Date().toISOString()
        })
        .eq('id', prospect.id);

      if (updateError) {
        console.log('❌', fix.name, '- Update failed:', updateError.message);
      } else {
        console.log('✅', fix.name);
        console.log('   Title:', fix.title);
        console.log('   Company:', fix.company);
      }

    } catch (error) {
      console.log('❌', fix.name, '- Error:', error.message);
    }
  }

  console.log('\n✅ Manual fixes complete!');
}

manuallyFixProspects();
