require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProspectTiming() {
  console.log('🔍 Checking when prospects were created vs when fix was deployed\n');

  const deployTime = new Date('2025-11-07T09:26:00Z'); // Approximate deployment time
  console.log(`Deployment time: ${deployTime.toISOString()}\n`);

  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('first_name, last_name, linkedin_url, created_at')
    .order('created_at', { ascending: false })
    .limit(15);

  console.log('Recent prospects (newest first):\n');

  let beforeFix = 0;
  let afterFix = 0;

  prospects.forEach((p, index) => {
    const createdAt = new Date(p.created_at);
    const isAfterFix = createdAt > deployTime;
    const hasProperName = p.first_name &&
                         p.first_name.length > 0 &&
                         !p.first_name.includes('/') &&
                         p.first_name !== p.linkedin_url?.split('/in/')[1]?.split('/')[0];

    if (isAfterFix) {
      afterFix++;
    } else {
      beforeFix++;
    }

    console.log(`${index + 1}. ${p.first_name} ${p.last_name} ${hasProperName ? '✅' : '⚠️'}`);
    console.log(`   Created: ${createdAt.toLocaleString()} ${isAfterFix ? '(AFTER FIX)' : '(before fix)'}`);
    console.log(`   LinkedIn: ${p.linkedin_url}`);
    console.log('');
  });

  console.log(`\nSummary:`);
  console.log(`  📅 Created before fix: ${beforeFix}`);
  console.log(`  📅 Created after fix: ${afterFix}\n`);

  if (afterFix > 0) {
    console.log('✅ We have new prospects created after fix - checking name quality...\n');
  } else {
    console.log('⚠️  No prospects created after fix yet - need to create test prospect\n');
  }
}

checkProspectTiming().catch(console.error);
