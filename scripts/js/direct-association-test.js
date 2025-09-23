// Direct table insert test for LinkedIn associations
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDirectAssociation() {
  console.log('🧪 Testing direct table insertion...\n');

  const charissaUserId = '744649a8-d015-4ff7-9e41-983cc9ca7b79';
  const thorstenUserId = 'f6885ff3-deef-4781-8721-93011c990b1b';

  try {
    // First check table structure
    console.log('📋 Checking table structure...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .limit(1);

    if (tableError) {
      console.log('❌ Table access error:', tableError);
      return;
    }

    console.log('✅ Table accessible\n');

    // Try direct insert for Charissa
    console.log('🔗 Creating direct association for Charissa...');
    const { data: charissaResult, error: charissaError } = await supabase
      .from('user_unipile_accounts')
      .insert({
        user_id: charissaUserId,
        unipile_account_id: 'he3RXnROSLuhONxgNle7dw',
        platform: 'linkedin',
        account_name: '𝒞𝒽𝒶𝓇𝒾𝓈𝓈𝒶 𝒮𝒶𝓃𝒾𝒆𝓁',
        account_email: 'cs@innovareai.com'
      })
      .select();

    if (charissaError) {
      console.log('❌ Charissa association error:', charissaError);
    } else {
      console.log('✅ Charissa association created:', charissaResult);
    }

    // Try direct insert for Thorsten  
    console.log('\n🔗 Creating direct association for Thorsten...');
    const { data: thorstenResult, error: thorstenError } = await supabase
      .from('user_unipile_accounts')
      .insert({
        user_id: thorstenUserId,
        unipile_account_id: 'NLsTJRfCSg-WZAXCBo8w7A',
        platform: 'linkedin',
        account_name: 'Thorsten Linz',
        account_email: 'tl@innovareai.com'
      })
      .select();

    if (thorstenError) {
      console.log('❌ Thorsten association error:', thorstenError);
    } else {
      console.log('✅ Thorsten association created:', thorstenResult);
    }

    // Verify final count
    console.log('\n🔍 Final verification...');
    const { data: finalCheck, error: finalError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('platform', 'linkedin');

    if (finalError) {
      console.log('❌ Final check error:', finalError);
    } else {
      console.log(`✅ Total LinkedIn associations: ${finalCheck?.length || 0}`);
      if (finalCheck && finalCheck.length > 0) {
        finalCheck.forEach(assoc => {
          console.log(`  • ${assoc.account_name} (${assoc.user_id})`);
        });
      }
    }

  } catch (error) {
    console.error('🚨 Test error:', error);
  }
}

testDirectAssociation();