// Fix Workspace Selection
// Copy and paste this into your browser console

// Stan's workspace ID
const workspaceId = "014509ba-226e-43ee-ba58-ab5f20d2ed08";

// Set workspace ID
localStorage.setItem("selectedWorkspaceId", workspaceId);

console.log("✅ Workspace ID set:", workspaceId);
console.log("🔄 Reloading page...");

// Reload page
location.reload();
