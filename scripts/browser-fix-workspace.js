// BROWSER FIX: Force set workspace context
// Run this in your browser console on app.meet-sam.com

(async () => {
  console.log('🔧 FORCING WORKSPACE CONTEXT FIX...\n');

  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  // Try to access React internals to force a re-render with the workspace
  const rootElement = document.querySelector('#__next') || document.querySelector('body > div');

  if (rootElement && rootElement._reactRootContainer) {
    console.log('Found React root, attempting to trigger workspace selection...');
  }

  // Alternative: Trigger a custom event to refresh campaigns
  console.log('Dispatching refreshCampaigns event...');
  window.dispatchEvent(new Event('refreshCampaigns'));

  // Store workspace in localStorage as a hint for the app
  localStorage.setItem('sam_current_workspace_id', workspaceId);
  console.log('✅ Workspace ID stored in localStorage');

  // Refresh the page to pick up the workspace
  console.log('\n⚠️ Please refresh the page (Cmd+R or Ctrl+R) to apply the fix');
  console.log('The app should now load with the correct workspace selected.');
})();
