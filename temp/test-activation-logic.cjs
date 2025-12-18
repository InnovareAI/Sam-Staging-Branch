// Test the activation logic with Sebastian's actual account data

const account = {
  id: '386feaac-21ca-45c9-b098-126bf49baa86',
  account_name: 'Sebastian Henkel',
  connection_status: 'active',  // This is the actual value from database
};

// Current logic from activate/route.ts (lines 96-103)
const isValid = account.connection_status === 'connected' || account.connection_status === 'active';
const linkedinAccount = {
  id: account.id,
  account_name: account.account_name,
  connection_status: isValid ? 'connected' : account.connection_status,
  is_active: isValid
};

console.log('Mapped account:');
console.log('  is_active:', linkedinAccount.is_active);
console.log('  connection_status:', linkedinAccount.connection_status);

// Check 1: is_active (line 106)
console.log('\nCheck 1 - is_active:', linkedinAccount.is_active ? 'PASS ✅' : 'FAIL ❌');

// Check 2: connection_status !== 'connected' (line 113)
const failsCheck2 = linkedinAccount.connection_status !== 'connected';
console.log('Check 2 - connection_status !== "connected":', failsCheck2 ? 'FAIL ❌' : 'PASS ✅');

if (failsCheck2) {
  console.log('\n🚨 FOUND THE BUG!');
  console.log('   The code checks for connection_status !== "connected"');
  console.log('   But the mapped connection_status is:', linkedinAccount.connection_status);
  console.log('   This will throw error: "LinkedIn account disconnected"');
}
