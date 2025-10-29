#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Finding Noriko\'s campaign...\n');

// Find Noriko's user
const { data: user } = await supabase
  .from('users')
  .select('id, email, full_name')
  .ilike('email', '%noriko%')
  .single();

if (!user) {
  console.log('❌ Noriko user not found, searching by name...');
  const { data: userByName } = await supabase
    .from('users')
    .select('id, email, full_name')
    .ilike('full_name', '%noriko%')
    .single();
  
  if (!userByName) {
    console.log('❌ Could not find Noriko');
    process.exit(1);
  }
}

console.log(`✅ Found: ${user?.full_name || 'Noriko'} (${user?.email})`);
console.log();

// Find her campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('*')
  .eq('created_by', user.id)
  .order('created_at', { ascending: false });

console.log(`📋 Noriko's Campaigns: ${campaigns?.length || 0}\n`);

campaigns?.forEach((c, i) => {
  console.log(`${i + 1}. ${c.name}`);
  console.log(`   ID: ${c.id}`);
  console.log(`   Status: ${c.status}`);
  console.log(`   Created: ${c.created_at}`);
  console.log();
});

// Reactivate all her campaigns
if (campaigns && campaigns.length > 0) {
  console.log('🔄 Reactivating campaigns...\n');
  
  for (const campaign of campaigns) {
    const { error } = await supabase
      .from('campaigns')
      .update({
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', campaign.id);
    
    if (error) {
      console.log(`❌ Failed to reactivate: ${campaign.name}`);
    } else {
      console.log(`✅ Reactivated: ${campaign.name}`);
    }
  }
  
  console.log('\n✅ All campaigns reactivated!');
} else {
  console.log('⚠️  No campaigns found to reactivate');
}
