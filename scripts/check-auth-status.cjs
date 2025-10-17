/**
 * Quick script to check authentication status
 * Run with: node scripts/check-auth-status.cjs
 */

console.log('🔍 SAM AI Authentication Troubleshooting\n');

console.log('📋 Common Causes of 401 "Authentication Required" Error:\n');
console.log('1. ⏰ Session Expired (Supabase sessions expire after ~1 hour)');
console.log('2. 🍪 Browser cleared cookies');
console.log('3. 🔄 Page needs refresh to restore session');
console.log('4. 🚪 You were logged out');

console.log('\n✅ Quick Fixes:\n');
console.log('1. Refresh the page (Cmd+R / Ctrl+R)');
console.log('2. Sign out and sign back in');
console.log('3. Clear browser cache and re-login');
console.log('4. Check if you\'re in incognito/private mode');

console.log('\n🔧 For Developers:\n');
console.log('The error comes from: /app/api/sam/threads/[threadId]/messages/route.ts:421');
console.log('The endpoint checks: supabase.auth.getUser()');
console.log('If this returns null/error, it returns 401');

console.log('\n📍 Where SEARCH uses authentication:');
console.log('- Main page (app/page.tsx:1360) calls /api/sam/threads/{id}/messages');
console.log('- This endpoint requires valid Supabase session cookies');
console.log('- Sessions are managed by @supabase/ssr library');

console.log('\n💡 If refreshing doesn\'t work:');
console.log('1. Check browser console for cookie errors');
console.log('2. Verify Supabase project is running');
console.log('3. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
