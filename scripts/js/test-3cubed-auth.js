// Test 3cubed authentication flow
import { createClient } from '@supabase/supabase-js';

console.log('🧪 Testing 3cubed authentication flow...\n');

// Test environment variables
console.log('📧 Environment Variables Check:');
console.log(`NEXT_PUBLIC_SITE_URL: ${process.env.NEXT_PUBLIC_SITE_URL || 'NOT SET'}`);
console.log(`POSTMARK_3CUBEDAI_API_KEY: ${process.env.POSTMARK_3CUBEDAI_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(`POSTMARK_INNOVAREAI_API_KEY: ${process.env.POSTMARK_INNOVAREAI_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(`NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET'}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET'}\n`);

// Test email detection logic
function testEmailDetection() {
  console.log('🔍 Testing email detection logic:');
  
  const testEmails = [
    'ny@3cubed.ai',
    'test@3cubed.com', 
    'user@cubedcapital.com',
    'dave.stuteville@sendingcell.com',
    'test@innovareai.com'
  ];
  
  testEmails.forEach(email => {
    const is3Cubed = email.includes('3cubed') || email.includes('cubedcapital') || email.includes('sendingcell.com');
    console.log(`  ${email}: ${is3Cubed ? '✅ 3cubed detected' : '❌ InnovareAI detected'}`);
  });
  console.log();
}

// Test Supabase connection
async function testSupabaseConnection() {
  console.log('🔗 Testing Supabase connection...');
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Check if we can list users
    const { data: users, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.log(`❌ Supabase connection failed: ${error.message}`);
    } else {
      const cubed3Users = users.users.filter(user => 
        user.email && (user.email.includes('3cubed') || user.email.includes('sendingcell'))
      );
      console.log(`✅ Supabase connected. Found ${cubed3Users.length} 3cubed users:`);
      cubed3Users.forEach(user => {
        console.log(`  - ${user.email} (${user.id})`);
      });
    }
  } catch (error) {
    console.log(`❌ Supabase connection error: ${error.message}`);
  }
  console.log();
}

// Test Postmark email sending
async function testPostmarkConnection() {
  console.log('📨 Testing Postmark connection...');
  
  const postmark3CubedKey = process.env.POSTMARK_3CUBEDAI_API_KEY;
  const postmarkInnovareKey = process.env.POSTMARK_INNOVAREAI_API_KEY;
  
  if (!postmark3CubedKey) {
    console.log('❌ POSTMARK_3CUBEDAI_API_KEY not set - 3cubed emails will fail');
  } else {
    console.log('✅ POSTMARK_3CUBEDAI_API_KEY is set');
    
    // Test API key validity (simple ping)
    try {
      const response = await fetch('https://api.postmarkapp.com/server', {
        headers: {
          'Accept': 'application/json',
          'X-Postmark-Server-Token': postmark3CubedKey,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ 3cubed Postmark server: ${data.Name} (${data.Id})`);
      } else {
        console.log(`❌ 3cubed Postmark API key invalid: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ 3cubed Postmark connection failed: ${error.message}`);
    }
  }
  
  if (!postmarkInnovareKey) {
    console.log('❌ POSTMARK_INNOVAREAI_API_KEY not set');
  } else {
    console.log('✅ POSTMARK_INNOVAREAI_API_KEY is set');
  }
  console.log();
}

// Run all tests
async function runAllTests() {
  testEmailDetection();
  await testSupabaseConnection();
  await testPostmarkConnection();
  
  console.log('🎯 Common Issues for 3cubed:');
  console.log('1. Missing POSTMARK_3CUBEDAI_API_KEY environment variable');
  console.log('2. Wrong NEXT_PUBLIC_SITE_URL causing redirect issues');
  console.log('3. Email detection not catching all 3cubed variations');
  console.log('4. Magic link using Supabase default instead of Postmark');
  console.log('\n🔧 Recommended fixes:');
  console.log('1. Set POSTMARK_3CUBEDAI_API_KEY in environment');
  console.log('2. Update magic link route to use Postmark for 3cubed users');
  console.log('3. Fix redirect URLs for 3cubed domain');
}

runAllTests().catch(console.error);