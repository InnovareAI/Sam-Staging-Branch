import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// LinkedIn account mappings based on names and organizations
const linkedinMappings = [
  {
    unipile_account_id: 'NLsTJRfCSg-WZAXCBo8w7A',
    name: 'Thorsten Linz',
    email: 'tl@innovareai.com',
    reason: 'Name match and InnovareAI organization membership'
  },
  {
    unipile_account_id: 'osKDIRFtTtqzmfULiWGTEg',
    name: 'Noriko Yokoi, Ph.D.',
    email: 'ny@3cubed.ai',
    reason: 'Name match and 3cubed.AI organization membership'
  },
  {
    unipile_account_id: 'he3RXnROSLuhONxgNle7dw',
    name: 'Charissa Saniel',
    email: 'cs@innovareai.com',
    reason: 'Name pattern match (stylized characters)'
  },
  {
    unipile_account_id: '3Zj8ks8aSrKg0ySaLQo_8A',
    name: 'Irish Cita De Ade',
    email: 'cl@innovareai.com',
    reason: 'InnovareAI organization membership (closest match available)'
  }
];

async function createLinkedInAssociations() {
  console.log('🔗 Creating LinkedIn account associations...\n');

  // First, get all users to match emails
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
  
  if (usersError) {
    console.error('❌ Failed to fetch users:', usersError);
    return;
  }

  console.log(`📊 Found ${users.users.length} users in system`);

  let successful = 0;
  let failed = 0;

  for (const mapping of linkedinMappings) {
    const user = users.users.find(u => u.email === mapping.email);
    
    if (!user) {
      console.log(`⚠️  User not found for email: ${mapping.email}`);
      failed++;
      continue;
    }

    console.log(`\n👤 Processing: ${mapping.name} (${mapping.email})`);
    console.log(`   LinkedIn Account: ${mapping.unipile_account_id}`);
    console.log(`   Reason: ${mapping.reason}`);

    // Check if association already exists
    const { data: existingAssoc } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('unipile_account_id', mapping.unipile_account_id)
      .single();

    if (existingAssoc) {
      console.log(`   ✅ Association already exists`);
      successful++;
      continue;
    }

    // Create new association
    const { error: insertError } = await supabase
      .from('user_unipile_accounts')
      .insert({
        user_id: user.id,
        unipile_account_id: mapping.unipile_account_id,
        account_name: mapping.name,
        platform: 'LINKEDIN',
        connection_status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (insertError) {
      console.log(`   ❌ Failed to create association: ${insertError.message}`);
      failed++;
    } else {
      console.log(`   ✅ Association created successfully`);
      successful++;
    }
  }

  console.log(`\n📊 Results:`);
  console.log(`   ✅ Successful: ${successful}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Total processed: ${linkedinMappings.length}`);

  // Verify associations
  console.log(`\n🔍 Verifying associations...`);
  const { data: associations } = await supabase
    .from('user_unipile_accounts')
    .select(`
      *,
      auth.users!inner(email)
    `)
    .eq('platform', 'LINKEDIN');

  if (associations && associations.length > 0) {
    console.log(`✅ Total LinkedIn associations now: ${associations.length}`);
    associations.forEach(assoc => {
      console.log(`   - ${assoc.account_name} → ${assoc.users.email}`);
    });
  } else {
    console.log(`❌ No associations found after creation`);
  }

  console.log(`\n💡 Users can now test LinkedIn status on Mac at http://localhost:3001`);
}

createLinkedInAssociations().catch(console.error);