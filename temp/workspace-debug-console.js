// Run this in your browser console (F12) to debug workspace selection

console.log('🔍 WORKSPACE DEBUG DIAGNOSTICS');
console.log('================================');

// Check localStorage
const storedWorkspaceId = localStorage.getItem('selectedWorkspaceId');
console.log('📦 localStorage.selectedWorkspaceId:', storedWorkspaceId);

// Check session
fetch('/api/auth/session')
  .then(r => r.json())
  .then(session => {
    console.log('👤 Session:', session?.user?.email || 'Not logged in');

    // Check workspaces
    return fetch('/api/workspace/list');
  })
  .then(r => r.json())
  .then(data => {
    console.log('🏢 Available workspaces:', data.workspaces?.length || 0);
    console.log('📋 Workspace details:', data.workspaces?.map(w => ({
      id: w.id,
      name: w.name
    })));
    console.log('✅ Current workspace from API:', data.current?.id);

    // Check if stored ID is valid
    if (storedWorkspaceId) {
      const isValid = data.workspaces?.some(w => w.id === storedWorkspaceId);
      console.log('🔍 Stored ID is valid:', isValid);
      if (!isValid) {
        console.log('❌ PROBLEM: Stored workspace ID not in available workspaces!');
        console.log('💡 FIX: Clear localStorage and refresh');
      }
    } else {
      console.log('ℹ️  No workspace ID in localStorage');
    }
  })
  .catch(err => {
    console.error('❌ Error:', err);
  });

console.log('================================');
console.log('💡 To fix manually:');
console.log('1. localStorage.removeItem("selectedWorkspaceId")');
console.log('2. Refresh the page');
