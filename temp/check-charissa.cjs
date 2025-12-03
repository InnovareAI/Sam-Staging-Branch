const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Find Charissa's user
  const { data: users } = await supabase
    .from("users")
    .select("id, email, current_workspace_id")
    .ilike("email", "%charissa%");

  console.log("Users matching 'charissa':", users);

  if (!users?.length) {
    // Try to find workspaces
    const { data: workspaces } = await supabase
      .from("workspaces")
      .select("id, name")
      .ilike("name", "%charissa%");
    console.log("Workspaces matching 'charissa':", workspaces);
    return;
  }

  const charissa = users[0];
  const workspaceId = charissa.current_workspace_id;

  console.log("\nCharissa's current workspace:", workspaceId);

  // Check approved prospects in her workspace
  const { data: sessions } = await supabase
    .from("prospect_approval_sessions")
    .select("id, campaign_name, total_prospects, approved_count, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("\nRecent sessions in workspace:");
  sessions?.forEach(s => {
    console.log(`  ${s.campaign_name} | ${s.approved_count}/${s.total_prospects}`);
  });

  // Get session IDs
  const sessionIds = sessions?.map(s => s.id) || [];

  // Count approved prospects
  const { count: approvedCount } = await supabase
    .from("prospect_approval_data")
    .select("*", { count: "exact", head: true })
    .in("session_id", sessionIds)
    .eq("approval_status", "approved");

  console.log("\nApproved prospects in workspace:", approvedCount);

  // Check how many are already in campaigns
  const { data: approvedProspects } = await supabase
    .from("prospect_approval_data")
    .select("id, name, contact")
    .in("session_id", sessionIds)
    .eq("approval_status", "approved");

  const linkedinUrls = approvedProspects
    ?.map(p => p.contact?.linkedin_url)
    .filter(Boolean);

  console.log("With LinkedIn URLs:", linkedinUrls?.length);

  if (linkedinUrls?.length) {
    const { data: campaignProspects } = await supabase
      .from("campaign_prospects")
      .select("linkedin_url")
      .in("linkedin_url", linkedinUrls);

    console.log("Already in campaigns:", campaignProspects?.length);
    console.log("Available for In Progress:", linkedinUrls.length - (campaignProspects?.length || 0));
  }

  // Check draft campaigns
  const { data: drafts } = await supabase
    .from("campaigns")
    .select("id, name, status, campaign_type, created_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "draft");

  console.log("\nDraft campaigns:", drafts?.length);
  drafts?.forEach(d => {
    console.log(`  ${d.name} | ${d.campaign_type} | ${d.created_at}`);
  });
}

main().catch(console.error);
