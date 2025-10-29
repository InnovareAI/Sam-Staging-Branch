#!/usr/bin/env node
import 'dotenv/config';

const unipileAccountId = 'lN6tdIWOStK_dEaxhygCEQ';

// Test with one prospect
const linkedinUsername = 'ted-marcuccio-a6b0aaa';

console.log('🔍 Debugging Unipile API Response\n');
console.log(`Testing LinkedIn username: ${linkedinUsername}\n`);

const profileUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/${linkedinUsername}?account_id=${unipileAccountId}`;

const response = await fetch(profileUrl, {
  method: 'GET',
  headers: {
    'X-API-KEY': process.env.UNIPILE_API_KEY,
    'Accept': 'application/json'
  }
});

if (!response.ok) {
  console.log(`❌ API Error ${response.status}`);
  const errorText = await response.text();
  console.log(errorText);
  process.exit(1);
}

const profileData = await response.json();

console.log('📦 Full Unipile Response:');
console.log(JSON.stringify(profileData, null, 2));

console.log('\n🔍 Company Data Analysis:');
console.log(`   profileData.company_name: "${profileData.company_name || 'undefined'}"`);
console.log(`   profileData.company?.name: "${profileData.company?.name || 'undefined'}"`);
console.log(`   profileData.company: ${JSON.stringify(profileData.company, null, 2) || 'undefined'}`);

console.log('\n📝 Name Data:');
console.log(`   first_name: "${profileData.first_name || 'undefined'}"`);
console.log(`   last_name: "${profileData.last_name || 'undefined'}"`);
console.log(`   display_name: "${profileData.display_name || 'undefined'}"`);

console.log('\n💼 Job Title Data:');
console.log(`   headline: "${profileData.headline || 'undefined'}"`);

console.log('\n🔑 Other Fields:');
Object.keys(profileData).forEach(key => {
  if (!['first_name', 'last_name', 'display_name', 'headline', 'company', 'company_name'].includes(key)) {
    const value = profileData[key];
    if (typeof value === 'object') {
      console.log(`   ${key}: ${JSON.stringify(value)}`);
    } else {
      console.log(`   ${key}: "${value}"`);
    }
  }
});
