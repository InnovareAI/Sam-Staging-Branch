import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStanProspects() {
  const stanUserId = '6a927440-ebe1-49b4-ae5e-fbee5d27944d';
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  
  console.log('🔍 Checking prospects created by Stan Bounev...\n');
  
  // Check workspace_prospects table
  const { data: prospects, error } = await supabase
    .from('workspace_prospects')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('❌ Error fetching prospects:', error);
    return;
  }
  
  console.log(`📊 Total prospects in Blue Label Labs workspace: ${prospects?.length || 0}\n`);
  
  if (prospects && prospects.length > 0) {
    const byCreator = prospects.reduce((acc, p) => {
      const creator = p.created_by || 'Unknown';
      acc[creator] = (acc[creator] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📈 Prospects by creator:');
    Object.entries(byCreator).forEach(([creator, count]) => {
      const isStan = creator === stanUserId;
      console.log(`   ${isStan ? '⭐' : '  '} ${creator}: ${count} prospects`);
    });
    
    const stanProspects = prospects.filter(p => p.created_by === stanUserId);
    if (stanProspects.length > 0) {
      console.log(`\n✅ Stan created ${stanProspects.length} prospects:`);
      stanProspects.slice(0, 10).forEach(p => {
        console.log(`   • ${p.name || 'Unnamed'} - ${p.company || 'No company'} (${p.status || 'no status'})`);
      });
      if (stanProspects.length > 10) {
        console.log(`   ... and ${stanProspects.length - 10} more`);
      }
    } else {
      console.log('\n❌ No prospects created by Stan found');
    }
  } else {
    console.log('❌ No prospects found in this workspace');
  }
  
  // Check campaigns
  console.log('\n\n🔍 Checking campaigns...\n');
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', workspaceId);
    
  console.log(`📊 Total campaigns: ${campaigns?.length || 0}`);
  if (campaigns && campaigns.length > 0) {
    campaigns.forEach(c => {
      console.log(`   • ${c.name} - Status: ${c.status}`);
    });
  }
}

checkStanProspects();
