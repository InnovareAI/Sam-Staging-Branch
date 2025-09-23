// Final correct LinkedIn associations based on actual company affiliations
import { createClient } from '@supabase/supabase-js';

console.log('🔗 Creating FINAL correct LinkedIn associations...\n');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createFinalCorrectAssociations() {
  try {
    // Clear all existing associations first
    console.log('🧹 Clearing existing associations...');
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

    // FINAL CORRECT associations based on actual companies:
    // InnovareAI: Irish Cita De Ade, Charissa Saniel, Thorsten Linz (multi-company)
    // 3cubed: Noriko Yokoi (has 3cubed.AI org), Thorsten Linz (has 3cubed.AI org)
    // sendingcell: Peter Noble, Martin Schechtner
    // wtmatchmaker: fallback
    
    const finalCorrectAssociations = [
      // InnovareAI users - use InnovareAI team members
      { userEmail: 'tl@innovareai.com', accountId: 'NLsTJRfCSg-WZAXCBo8w7A', accountName: 'Thorsten Linz', reason: 'InnovareAI founder → Thorsten (InnovareAI + 3cubed orgs)' },
      { userEmail: 'cs@innovareai.com', accountId: 'he3RXnROSLuhONxgNle7dw', accountName: 'Charissa Saniel', reason: 'InnovareAI → Charissa Saniel (InnovareAI team)' },
      { userEmail: 'cl@innovareai.com', accountId: '3Zj8ks8aSrKg0ySaLQo_8A', accountName: 'Irish Cita De Ade', reason: 'InnovareAI → Irish Cita De Ade (InnovareAI Services org)' },
      
      // 3cubed users - use accounts with 3cubed.AI organization
      { userEmail: 'ny@3cubed.ai', accountId: 'osKDIRFtTtqzmfULiWGTEg', accountName: 'Noriko Yokoi, Ph.D.', reason: '3cubed → Noriko Yokoi (has 3cubed.AI org)' },
      { userEmail: 'tl@3cubed.ai', accountId: 'NLsTJRfCSg-WZAXCBo8w7A', accountName: 'Thorsten Linz', reason: '3cubed → Thorsten Linz (has 3cubed.AI org)' },
      
      // sendingcell users - use remaining external accounts
      { userEmail: 'dave.stuteville@sendingcell.com', accountId: 'eCvuVstGTfCedKsrzAKvZA', accountName: 'Peter Noble', reason: 'sendingcell → Peter Noble (red-dragonfly)' },
      { userEmail: 'cathy.smith@sendingcell.com', accountId: 'MlV8PYD1SXG783XbJRraLQ', accountName: 'Martin Schechtner', reason: 'sendingcell → Martin Schechtner (Energiekreislauf)' },
      { userEmail: 'jim.heim@sendingcell.com', accountId: 'he3RXnROSLuhONxgNle7dw', accountName: 'Charissa Saniel', reason: 'sendingcell → Charissa Saniel (shared)' },
      
      // wtmatchmaker - fallback
      { userEmail: 'laura@wtmatchmaker.com', accountId: '3Zj8ks8aSrKg0ySaLQo_8A', accountName: 'Irish Cita De Ade', reason: 'wtmatchmaker → Irish Cita De Ade (shared)' },
    ];

    console.log('\n🎯 Creating FINAL correct associations:');
    let created = 0;

    for (const assoc of finalCorrectAssociations) {
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
    
    // Final verification by company
    console.log('\n🔍 Final verification by company...');
    const { data: finalAssocs } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('platform', 'LINKEDIN');
      
    console.log(`✅ Total LinkedIn associations: ${finalAssocs?.length || 0}`);
    
    if (finalAssocs && finalAssocs.length > 0) {
      console.log('\n📋 Final associations by company:');
      
      const companies = {
        'InnovareAI': [],
        '3cubed': [],
        'sendingcell': [],
        'wtmatchmaker': []
      };
      
      for (const assoc of finalAssocs) {
        const user = users.users.find(u => u.id === assoc.user_id);
        if (user?.email) {
          if (user.email.includes('innovareai.com')) {
            companies['InnovareAI'].push(`${user.email} → ${assoc.account_name}`);
          } else if (user.email.includes('3cubed.ai')) {
            companies['3cubed'].push(`${user.email} → ${assoc.account_name}`);
          } else if (user.email.includes('sendingcell.com')) {
            companies['sendingcell'].push(`${user.email} → ${assoc.account_name}`);
          } else if (user.email.includes('wtmatchmaker.com')) {
            companies['wtmatchmaker'].push(`${user.email} → ${assoc.account_name}`);
          }
        }
      }
      
      Object.keys(companies).forEach(company => {
        if (companies[company].length > 0) {
          console.log(`\n  ${company.toUpperCase()}:`);
          companies[company].forEach(assoc => console.log(`    • ${assoc}`));
        }
      });
    }

  } catch (error) {
    console.error('❌ Error creating final associations:', error);
  }
}

createFinalCorrectAssociations().catch(console.error);