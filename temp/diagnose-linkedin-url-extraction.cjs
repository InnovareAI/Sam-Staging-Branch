require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseLinkedInURLs() {
  console.log('🔍 DIAGNOSING LINKEDIN URL EXTRACTION\n');
  console.log('='.repeat(70));

  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  // Get recent prospects from approval system
  const { data: prospects } = await supabase
    .from('prospect_approval_data')
    .select('id, name, contact')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`\nTesting LinkedIn URL extraction for ${prospects.length} prospects:\n`);

  let validCount = 0;
  let invalidCount = 0;
  const issues = [];

  for (const p of prospects) {
    const linkedinUrl = p.contact?.linkedin_url;

    console.log(`\n${p.name}:`);
    console.log(`  URL: ${linkedinUrl || 'MISSING'}`);

    if (!linkedinUrl) {
      console.log(`  ❌ ISSUE: No LinkedIn URL`);
      issues.push({ name: p.name, issue: 'Missing LinkedIn URL' });
      invalidCount++;
      continue;
    }

    // Simulate N8N extraction logic
    const username = linkedinUrl.split('/in/')[1]?.split('?')[0]?.replace('/', '');

    console.log(`  Extracted: ${username || 'FAILED'}`);

    if (!username) {
      console.log(`  ❌ ISSUE: Failed to extract username`);
      issues.push({ name: p.name, issue: 'Failed to extract username', url: linkedinUrl });
      invalidCount++;
    } else if (username.includes('/') || username.includes('?')) {
      console.log(`  ⚠️  WARNING: Username contains special chars: ${username}`);
      issues.push({ name: p.name, issue: 'Invalid username format', username });
      invalidCount++;
    } else if (username.length < 3) {
      console.log(`  ⚠️  WARNING: Username too short: ${username}`);
      issues.push({ name: p.name, issue: 'Username too short', username });
      invalidCount++;
    } else {
      console.log(`  ✅ Valid extraction`);
      validCount++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Valid: ${validCount}`);
  console.log(`   Invalid: ${invalidCount}\n`);

  if (issues.length > 0) {
    console.log('❌ ISSUES FOUND:\n');
    issues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue.name}`);
      console.log(`   Problem: ${issue.issue}`);
      if (issue.url) console.log(`   URL: ${issue.url}`);
      if (issue.username) console.log(`   Extracted: ${issue.username}`);
      console.log('');
    });

    console.log('💡 LIKELY CAUSE OF N8N ERROR:');
    console.log('The "Get LinkedIn Profile" node is receiving invalid/missing usernames,');
    console.log('which causes Unipile to return "Bad request - please check your parameters".\n');

    console.log('🔧 SOLUTION:');
    console.log('1. Ensure all prospects have valid LinkedIn URLs in contact.linkedin_url');
    console.log('2. URLs should be in format: https://www.linkedin.com/in/username');
    console.log('3. Add validation in N8N to skip prospects with invalid URLs\n');
  } else {
    console.log('✅ All LinkedIn URLs are valid and should extract properly!\n');
    console.log('The N8N error is likely caused by something else:');
    console.log('  - Missing unipileAccountId');
    console.log('  - Invalid Unipile API credentials');
    console.log('  - Unipile account not connected\n');
  }

  console.log('='.repeat(70));
}

diagnoseLinkedInURLs().catch(console.error);
