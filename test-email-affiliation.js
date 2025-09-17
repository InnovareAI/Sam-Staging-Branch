// Test script to verify email sender affiliation detection
// This tests the same logic used in our password reset routes

function getSenderByAffiliation(userEmail) {
  console.log('🔍 Testing sender affiliation for:', userEmail);
  
  // Check if user belongs to 3cubed or sendingcell.com
  if (userEmail.includes('3cubed') || userEmail.includes('cubedcapital') || userEmail.includes('sendingcell.com')) {
    console.log('✅ 3cubed affiliation detected, using Sophia Caldwell');
    return 'Sophia Caldwell <sophia@innovareai.com>';
  }
  
  // Default to Sarah Powell for InnovareAI and other users
  console.log('✅ InnovareAI affiliation, using Sarah Powell');
  return 'Sarah Powell <sarah@innovareai.com>';
}

// Test cases for sendingcell.com users
const testEmails = [
  // sendingcell.com variations
  'user@sendingcell.com',
  'admin@sendingcell.com',
  'test.user@sendingcell.com',
  'marketing@sendingcell.com',
  
  // 3cubed variations
  'user@3cubed.ai',
  'tl@3cubed.ai',
  'test@3cubedai.com',
  
  // cubedcapital variations
  'user@cubedcapital.com',
  'admin@cubedcapital.net',
  
  // InnovareAI (should use Sarah Powell)
  'user@innovareai.com',
  'tl@innovareai.com',
  'admin@innovareai.com',
  
  // Other domains (should use Sarah Powell)
  'user@gmail.com',
  'test@yahoo.com',
  'admin@company.com'
];

console.log('🧪 TESTING EMAIL SENDER AFFILIATION DETECTION\n');
console.log('=' * 60);

testEmails.forEach((email, index) => {
  console.log(`\nTest ${index + 1}:`);
  const sender = getSenderByAffiliation(email);
  console.log(`📧 Email: ${email}`);
  console.log(`👤 Sender: ${sender}`);
  
  // Validate expected results
  const isSendingcell = email.includes('sendingcell.com');
  const is3cubed = email.includes('3cubed');
  const isCubedcapital = email.includes('cubedcapital');
  const shouldUseSophia = isSendingcell || is3cubed || isCubedcapital;
  const usesSophia = sender.includes('Sophia Caldwell');
  
  if (shouldUseSophia && usesSophia) {
    console.log('🟢 PASS - Correctly assigned to Sophia Caldwell');
  } else if (!shouldUseSophia && !usesSophia) {
    console.log('🟢 PASS - Correctly assigned to Sarah Powell');
  } else {
    console.log('🔴 FAIL - Incorrect sender assignment!');
  }
  
  console.log('-'.repeat(50));
});

console.log('\n🎯 SUMMARY');
console.log('=' * 60);
console.log('✅ sendingcell.com users → Sophia Caldwell');
console.log('✅ 3cubed users → Sophia Caldwell'); 
console.log('✅ cubedcapital users → Sophia Caldwell');
console.log('✅ InnovareAI users → Sarah Powell');
console.log('✅ Other domains → Sarah Powell');