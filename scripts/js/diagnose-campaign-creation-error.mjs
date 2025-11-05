/**
 * Diagnose Campaign Creation Error
 *
 * This script helps debug the "Workspace ID and campaign name are required" error
 * by checking common issues in the campaign creation flow.
 */

console.log('🔍 Diagnosing Campaign Creation Error\n');
console.log('Error: "Workspace ID and campaign name are required"\n');
console.log('═'.repeat(70));
console.log('\n📋 CHECKLIST FOR DEBUGGING:\n');

console.log('1️⃣  Frontend Check:');
console.log('   □ Is selectedWorkspaceId defined in the component state?');
console.log('   □ Is it being passed to CampaignHub as prop?');
console.log('   □ Check browser console: localStorage.getItem("selectedWorkspaceId")');
console.log('');

console.log('2️⃣  API Request Check:');
console.log('   □ Open browser DevTools → Network tab');
console.log('   □ Look for POST request to /api/campaigns');
console.log('   □ Check request payload has:');
console.log('      - workspace_id: "xxx-xxx-xxx..."');
console.log('      - name: "Campaign Name"');
console.log('');

console.log('3️⃣  Common Causes:');
console.log('   ❌ workspaceId prop is undefined');
console.log('   ❌ campaign name field is empty');
console.log('   ❌ form submit happens before state update');
console.log('   ❌ selectedWorkspaceId is null/undefined in localStorage');
console.log('');

console.log('4️⃣  Quick Fix (Browser Console):');
console.log('   Run this in browser console to check workspace:');
console.log('   > localStorage.getItem("selectedWorkspaceId")');
console.log('');
console.log('   If it\'s null, set it manually:');
console.log('   > localStorage.setItem("selectedWorkspaceId", "014509ba-226e-43ee-ba58-ab5f20d2ed08")');
console.log('   > location.reload()');
console.log('');

console.log('5️⃣  Code Locations to Check:');
console.log('   📁 app/components/CampaignHub.tsx');
console.log('      - Line 3993: Check workspaceId prop is received');
console.log('      - Search for: "workspace_id:"');
console.log('');
console.log('   📁 app/page.tsx');
console.log('      - Search for: <CampaignHub');
console.log('      - Ensure: workspaceId={selectedWorkspaceId}');
console.log('');
console.log('   📁 app/api/campaigns/route.ts');
console.log('      - Line 130-134: Validation that\'s failing');
console.log('');

console.log('6️⃣  Expected Request Body:');
console.log(JSON.stringify({
  workspace_id: "014509ba-226e-43ee-ba58-ab5f20d2ed08",
  name: "My Campaign",
  description: "Optional description",
  campaign_type: "connector",
  status: "draft"
}, null, 2));
console.log('');

console.log('═'.repeat(70));
console.log('\n💡 MOST LIKELY ISSUE:');
console.log('   The selectedWorkspaceId is not being passed to the campaign');
console.log('   creation API call. Check the fetch() call in CampaignHub.');
console.log('');
console.log('✅ TO FIX:');
console.log('   1. Find where campaign is being created in CampaignHub.tsx');
console.log('   2. Ensure fetch body includes: workspace_id: workspaceId');
console.log('   3. Ensure name field is not empty');
console.log('');
