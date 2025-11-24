#!/usr/bin/env node

/**
 * Force reset authentication state
 * This script will help clear browser localStorage and show you how to log in
 */

console.log('🔧 Force Auth Reset Helper\n');
console.log('=' .repeat(60));
console.log('\n📋 INSTRUCTIONS:\n');

console.log('1️⃣  Open your browser DevTools (Cmd+Option+I on Mac)');
console.log('2️⃣  Go to the Console tab');
console.log('3️⃣  Copy and paste this command:\n');

console.log('─'.repeat(60));
console.log(`
// Clear all Supabase auth data
localStorage.clear();
sessionStorage.clear();
// Delete all cookies
document.cookie.split(";").forEach(c => {
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
});
// Reload the page
location.reload();
`.trim());
console.log('─'.repeat(60));

console.log('\n4️⃣  Press Enter to execute');
console.log('5️⃣  The page will reload and you should see the login form');
console.log('6️⃣  Log in with: tl@innovareai.com\n');

console.log('=' .repeat(60));
console.log('\n✅ If you still can\'t log out after logging in, there\'s a bug');
console.log('   in nav-user.tsx (the logout button has no onClick handler)\n');
