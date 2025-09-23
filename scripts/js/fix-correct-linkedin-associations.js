// Fix LinkedIn associations with correct company mappings
import { createClient } from '@supabase/supabase-js';

console.log('🔗 Fixing LinkedIn associations with correct company mappings...\n');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixCorrectAssociations() {
  try {
    // Clear all existing incorrect associations first
    console.log('🧹 Clearing existing incorrect associations...');
    const { error: deleteError } = await supabase
      .from('user_unipile_accounts')
      .delete()
      .eq('platform', 'LINKEDIN');
      
    if (deleteError) {
      console.error('❌ Error clearing associations:', deleteError);
      return;
    }
    
    console.log('✅ Cleared existing associations');

    // Get all users
    console.log('👥 Fetching all users...');
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('❌ Error fetching users:', userError);
      return;
    }

    console.log(`✅ Found ${users.users.length} users`);

    // Create correct associations based on email domains and actual company affiliations
    const correctAssociations = [
      // InnovareAI users get Irish Cita De Ade (InnovareAI Services)
      { userEmail: 'tl@innovareai.com', accountId: '3Zj8ks8aSrKg0ySaLQo_8A', accountName: 'Irish Cita De Ade', reason: 'InnovareAI → InnovareAI Services' },
      { userEmail: 'cs@innovareai.com', accountId: '3Zj8ks8aSrKg0ySaLQo_8A', accountName: 'Irish Cita De Ade', reason: 'InnovareAI → InnovareAI Services' },
      { userEmail: 'cl@innovareai.com', accountId: '3Zj8ks8aSrKg0ySaLQo_8A', accountName: 'Irish Cita De Ade', reason: 'InnovareAI → InnovareAI Services' },
      
      // 3cubed users get Thorsten Linz (has 3cubed.AI org) or Noriko Yokoi (has 3cubed.AI org)
      { userEmail: 'ny@3cubed.ai', accountId: 'osKDIRFtTtqzmfULiWGTEg', accountName: 'Noriko Yokoi, Ph.D.', reason: '3cubed → Noriko has 3cubed.AI org' },
      { userEmail: 'tl@3cubed.ai', accountId: 'NLsTJRfCSg-WZAXCBo8w7A', accountName: 'Thorsten Linz', reason: '3cubed → Thorsten has 3cubed.AI org' },
      
      // sendingcell users get remaining accounts
      { userEmail: 'dave.stuteville@sendingcell.com', accountId: 'eCvuVstGTfCedKsrzAKvZA', accountName: 'Peter Noble', reason: 'sendingcell → Peter Noble' },
      { userEmail: 'cathy.smith@sendingcell.com', accountId: 'he3RXnROSLuhONxgNle7dw', accountName: 'Charissa Saniel', reason: 'sendingcell → Charissa Saniel' },
      { userEmail: 'jim.heim@sendingcell.com', accountId: 'MlV8PYD1SXG783XbJRraLQ', accountName: 'Martin Schechtner', reason: 'sendingcell → Martin Schechtner' },
      
      // wtmatchmaker gets a fallback account
      { userEmail: 'laura@wtmatchmaker.com', accountId: 'he3RXnROSLuhONxgNle7dw', accountName: 'Charissa Saniel', reason: 'wtmatchmaker → fallback account' },
    ];

    console.log('\n🎯 Creating correct associations:');
    let created = 0;

    for (const assoc of correctAssociations) {
      const user = users.users.find(u => u.email === assoc.userEmail);
      
      if (!user) {
        console.log(`⚠️  User ${assoc.userEmail} not found - skipping`);
        continue;
      }

      console.log(`🔗 ${assoc.userEmail} → ${assoc.accountName} (${assoc.reason})`);
      
      try {
        const { data, error } = await supabase.rpc('create_user_association', {
          p_user_id: user.id,
          p_unipile_account_id: assoc.accountId,
          p_platform: 'LINKEDIN',
          p_account_name: assoc.accountName,
          p_account_email: assoc.userEmail,
          p_connection_status: 'connected',
          p_linkedin_profile_url: `https://linkedin.com/in/${assoc.accountName.toLowerCase().replace(/\s+/g, '-')}`,
          p_linkedin_public_identifier: assoc.accountName.toLowerCase().replace(/\s+/g, '-')
        });

        if (error) {
          console.error(`❌ Failed to create association for ${assoc.userEmail}:`, error);
        } else {
          console.log(`✅ Created association for ${assoc.userEmail}`);
          created++;
        }
      } catch (err) {
        console.error(`❌ Error creating association for ${assoc.userEmail}:`, err);
      }
    }

    console.log(`\n🎯 Summary: Created ${created} correct associations`);
    
    // Final verification
    console.log('\n🔍 Final verification...');
    const { data: finalAssocs } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('platform', 'LINKEDIN');
      
    console.log(`✅ Total LinkedIn associations: ${finalAssocs?.length || 0}`);
    
    if (finalAssocs && finalAssocs.length > 0) {
      console.log('\n📋 Current correct associations:');
      for (const assoc of finalAssocs) {
        const user = users.users.find(u => u.id === assoc.user_id);
        console.log(`  • ${user?.email} → ${assoc.account_name}`);
      }
    }

  } catch (error) {
    console.error('❌ Error fixing associations:', error);
  }
}

fixCorrectAssociations().catch(console.error);