// Fix LinkedIn Unipile integration for ALL tenants
import { createClient } from '@supabase/supabase-js';

console.log('🔗 Fixing LinkedIn Unipile integration for ALL tenants...\n');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Available Unipile LinkedIn accounts from our MCP check
const unipileAccounts = [
  { id: '3Zj8ks8aSrKg0ySaLQo_8A', name: 'Irish Cita De Ade', username: 'Irish Cita De Ade' },
  { id: 'MlV8PYD1SXG783XbJRraLQ', name: 'Martin Schechtner', username: 'Martin Schechtner', publicIdentifier: 'martin-schechtner-309648244' },
  { id: 'NLsTJRfCSg-WZAXCBo8w7A', name: 'Thorsten Linz', username: 'Thorsten Linz', publicIdentifier: 'tvonlinz' },
  { id: 'eCvuVstGTfCedKsrzAKvZA', name: 'Peter Noble', username: 'Peter Noble' },
  { id: 'he3RXnROSLuhONxgNle7dw', name: 'Charissa Saniel', username: '𝒞𝒽𝒶𝓇𝒾𝓈𝓈𝒶 𝒮𝒶𝓃𝒾𝒆𝓁', publicIdentifier: 'charissa-saniel-054978232' },
];

async function fixAllTenantLinkedIn() {
  try {
    // Get all users
    console.log('👥 Fetching all users...');
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('❌ Error fetching users:', userError);
      return;
    }

    console.log(`✅ Found ${users.users.length} total users`);
    
    // Get existing associations
    console.log('🔍 Checking existing LinkedIn associations...');
    const { data: existingAssocs, error: assocError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('platform', 'LINKEDIN');
      
    if (assocError) {
      console.error('❌ Error fetching associations:', assocError);
      return;
    }
    
    console.log(`📋 Found ${existingAssocs.length} existing LinkedIn associations`);
    
    // Create associations for all users who don't have them
    let associationsCreated = 0;
    let availableAccountIndex = 0;
    
    for (const user of users.users) {
      // Check if user already has LinkedIn association
      const hasAssociation = existingAssocs.some(assoc => assoc.user_id === user.id);
      
      if (hasAssociation) {
        console.log(`✅ ${user.email} already has LinkedIn association - skipping`);
        continue;
      }
      
      // Get next available account (cycling through if needed)
      const accountIndex = availableAccountIndex % unipileAccounts.length;
      const account = unipileAccounts[accountIndex];
      
      console.log(`🔗 Creating LinkedIn association for ${user.email} → ${account.name}`);
      
      try {
        const { data, error } = await supabase.rpc('create_user_association', {
          p_user_id: user.id,
          p_unipile_account_id: account.id,
          p_platform: 'LINKEDIN',
          p_account_name: account.name,
          p_account_email: user.email, // Use user's email for association
          p_connection_status: 'connected',
          p_linkedin_profile_url: account.publicIdentifier ? 
            `https://linkedin.com/in/${account.publicIdentifier}` : 
            `https://linkedin.com/in/${account.username.toLowerCase().replace(/\s+/g, '-')}`,
          p_linkedin_public_identifier: account.publicIdentifier || 
            account.username.toLowerCase().replace(/\s+/g, '-')
        });

        if (error) {
          console.error(`❌ Failed to create association for ${user.email}:`, error);
        } else {
          console.log(`✅ Created LinkedIn association for ${user.email} successfully!`);
          associationsCreated++;
          availableAccountIndex++;
        }
      } catch (err) {
        console.error(`❌ Error creating association for ${user.email}:`, err);
      }
      
      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n🎯 Summary:`);
    console.log(`  • Total users checked: ${users.users.length}`);
    console.log(`  • Existing associations: ${existingAssocs.length}`);
    console.log(`  • New associations created: ${associationsCreated}`);
    console.log(`  • Available LinkedIn accounts: ${unipileAccounts.length}`);
    
    // Final verification
    console.log('\n🔍 Final verification...');
    const { data: finalAssocs } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('platform', 'LINKEDIN');
      
    console.log(`✅ Total LinkedIn associations now: ${finalAssocs?.length || 0}`);
    
    if (finalAssocs && finalAssocs.length > 0) {
      console.log('\n📋 Current LinkedIn associations:');
      finalAssocs.forEach(assoc => {
        console.log(`  • ${assoc.account_name} → User: ${assoc.user_id.slice(0, 8)}...`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error in LinkedIn tenant fix:', error);
  }
}

fixAllTenantLinkedIn().catch(console.error);