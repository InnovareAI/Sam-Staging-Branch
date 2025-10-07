#!/usr/bin/env node

/**
 * Clean Dummy Data from Knowledge Base
 *
 * Identifies and removes test/dummy data from KB tables
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function identifyDummyData() {
  console.log('\n🔍 Scanning for dummy data in Knowledge Base...\n');

  // Check knowledge_base table
  const { data: kbData, error: kbError } = await supabase
    .from('knowledge_base')
    .select('id, workspace_id, category, title, content, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (kbError) {
    console.error('❌ Error fetching KB data:', kbError);
    return;
  }

  console.log(`📊 Found ${kbData?.length || 0} recent KB entries\n`);

  // Identify dummy patterns
  const dummyPatterns = [
    /test/i,
    /dummy/i,
    /example/i,
    /lorem ipsum/i,
    /sample/i,
    /placeholder/i,
    /fake/i,
    /demo/i
  ];

  const dummyEntries = [];
  const realEntries = [];

  kbData?.forEach((entry) => {
    const titleText = entry.title?.toLowerCase() || '';
    const contentText = entry.content?.toLowerCase() || '';

    const isDummy = dummyPatterns.some(pattern =>
      pattern.test(titleText) || pattern.test(contentText)
    );

    if (isDummy) {
      dummyEntries.push(entry);
    } else {
      realEntries.push(entry);
    }
  });

  console.log(`✅ Real entries: ${realEntries.length}`);
  console.log(`🗑️  Dummy entries: ${dummyEntries.length}\n`);

  if (dummyEntries.length > 0) {
    console.log('Dummy entries found:');
    dummyEntries.forEach((entry, index) => {
      console.log(`  ${index + 1}. ${entry.title} (${entry.category}) - ${entry.id}`);
    });
  }

  // Check ICPs
  const { data: icpData, error: icpError } = await supabase
    .from('knowledge_base_icps')
    .select('id, workspace_id, name, description, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (!icpError && icpData) {
    const dummyICPs = icpData.filter(icp => {
      const name = icp.name?.toLowerCase() || '';
      const desc = icp.description?.toLowerCase() || '';
      return dummyPatterns.some(pattern => pattern.test(name) || pattern.test(desc));
    });

    console.log(`\n📊 ICP Analysis:`);
    console.log(`  Total ICPs: ${icpData.length}`);
    console.log(`  Dummy ICPs: ${dummyICPs.length}`);

    if (dummyICPs.length > 0) {
      dummyICPs.forEach((icp, index) => {
        console.log(`    ${index + 1}. ${icp.name} - ${icp.id}`);
      });
    }
  }

  return {
    kbDummyIds: dummyEntries.map(e => e.id),
    kbDummyCount: dummyEntries.length,
    realCount: realEntries.length
  };
}

async function cleanDummyData(dryRun = true) {
  const analysis = await identifyDummyData();

  if (!analysis || analysis.kbDummyCount === 0) {
    console.log('\n✨ No dummy data found! KB is clean.\n');
    return;
  }

  console.log(`\n🧹 ${dryRun ? 'DRY RUN:' : 'DELETING:'} Would remove ${analysis.kbDummyCount} dummy entries\n`);

  if (!dryRun) {
    const { error } = await supabase
      .from('knowledge_base')
      .delete()
      .in('id', analysis.kbDummyIds);

    if (error) {
      console.error('❌ Error deleting dummy data:', error);
    } else {
      console.log(`✅ Successfully deleted ${analysis.kbDummyCount} dummy entries`);
    }
  }

  console.log('\n📝 Summary:');
  console.log(`  Real entries preserved: ${analysis.realCount}`);
  console.log(`  Dummy entries ${dryRun ? 'identified' : 'removed'}: ${analysis.kbDummyCount}\n`);
}

// Run script
const dryRun = process.argv[2] !== '--delete';

console.log('╔═══════════════════════════════════════╗');
console.log('║  Knowledge Base Dummy Data Cleaner    ║');
console.log('╚═══════════════════════════════════════╝\n');

if (dryRun) {
  console.log('ℹ️  Running in DRY RUN mode (no deletions)');
  console.log('   Use --delete flag to actually remove dummy data\n');
}

cleanDummyData(dryRun)
  .then(() => {
    if (dryRun) {
      console.log('💡 To remove dummy data, run: node scripts/js/clean-kb-dummy-data.js --delete\n');
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
