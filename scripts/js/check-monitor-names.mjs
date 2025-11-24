#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMonitorNames() {
  try {
    console.log('🔍 Checking linkedin_post_monitors table for names...\n');

    const { data: monitors, error } = await supabase
      .from('linkedin_post_monitors')
      .select('id, name, hashtags, keywords, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    console.log(`Found ${monitors.length} monitors:\n`);

    monitors.forEach((m, i) => {
      console.log(`${i + 1}. ID: ${m.id}`);
      console.log(`   Name: ${m.name || '(no name)'}`);
      console.log(`   Hashtags: ${m.hashtags?.join(', ') || 'none'}`);
      console.log(`   Keywords: ${m.keywords?.join(', ') || 'none'}`);
      console.log(`   Created: ${new Date(m.created_at).toLocaleString()}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkMonitorNames();
