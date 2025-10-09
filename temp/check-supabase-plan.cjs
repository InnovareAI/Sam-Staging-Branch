require('dotenv').config({ path: '.env.local' });

async function checkSupabasePlan() {
  console.log('🔍 Checking Supabase Project Info');
  console.log('='.repeat(60));
  console.log('');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const projectRef = url?.split('//')[1]?.split('.')[0];

  console.log('Project URL:', url);
  console.log('Project Ref:', projectRef);
  console.log('');

  console.log('📋 To check your Supabase plan and backup features:');
  console.log('');
  console.log('1. Go to: https://supabase.com/dashboard/project/' + projectRef);
  console.log('2. Click "Settings" → "General"');
  console.log('3. Look for "Pricing Plan"');
  console.log('');
  console.log('━'.repeat(60));
  console.log('');
  console.log('Supabase Backup Options by Plan:');
  console.log('');
  console.log('FREE PLAN:');
  console.log('  ❌ No automatic backups');
  console.log('  ✅ Manual pg_dump (what we can do now)');
  console.log('  ❌ No point-in-time recovery');
  console.log('');
  console.log('PRO PLAN ($25/month):');
  console.log('  ✅ Daily automatic backups (7 days retention)');
  console.log('  ✅ Point-in-time recovery (7 days)');
  console.log('  ✅ Manual snapshots');
  console.log('  ✅ Download backups');
  console.log('');
  console.log('TEAM PLAN ($599/month):');
  console.log('  ✅ Daily backups (14 days retention)');
  console.log('  ✅ Point-in-time recovery (14 days)');
  console.log('  ✅ All Pro features');
  console.log('');
  console.log('ENTERPRISE:');
  console.log('  ✅ Custom backup retention');
  console.log('  ✅ Custom PITR windows');
  console.log('  ✅ Multi-region backups');
  console.log('');
  console.log('━'.repeat(60));
  console.log('');
  console.log('💡 What we can do based on your plan:');
  console.log('');
  console.log('If FREE:');
  console.log('  → Implement Option A or C (our custom backup solution)');
  console.log('');
  console.log('If PRO or higher:');
  console.log('  → Use Supabase native backups (much better!)');
  console.log('  → Add our custom solution as extra safety');
  console.log('');
}

checkSupabasePlan().then(() => process.exit(0));
