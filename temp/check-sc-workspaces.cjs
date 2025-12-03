const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWorkspace(workspaceId, name) {
  console.log(`\n=== ${name} (${workspaceId}) ===`);

  // Check sessions
  const { data: sessions } = await supabase
    .from("prospect_approval_sessions")
    .select("id, campaign_name, total_prospects, approved_count, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!sessions?.length) {
    console.log("No sessions found");
    return;
  }

  console.log("Recent sessions:");
  sessions?.forEach(s => {
    console.log(`  ${s.campaign_name} | ${s.approved_count}/${s.total_prospects}`);
  });

  const sessionIds = sessions?.map(s => s.id) || [];

  // Count approved prospects
  const { count: approvedCount } = await supabase
    .from("prospect_approval_data")
    .select("*", { count: "exact", head: true })
    .in("session_id", sessionIds)
    .eq("approval_status", "approved");

  console.log("Approved prospects:", approvedCount);

  // Check how many are already in campaigns
  const { data: approvedProspects } = await supabase
    .from("prospect_approval_data")
    .select("id, name, contact")
    .in("session_id", sessionIds)
    .eq("approval_status", "approved");

  const linkedinUrls = approvedProspects
    ?.map(p => p.contact?.linkedin_url)
    .filter(Boolean);

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
    .select("id, name, status, campaign_type")
    .eq("workspace_id", workspaceId)
    .eq("status", "draft");

  console.log("Draft campaigns:", drafts?.length);
}

async function main() {
  // Check SC workspaces and others
  const workspaces = [
    ["cf27fd56-2350-4bef-9c0b-9508463a1646", "SC1"],
    ["b070d94f-11e2-41d4-a913-cc5a8c017208", "SC2"],
    ["c3100bea-82a6-4365-b159-6581f1be9be3", "Asphericon"],
    ["aa1a214c-02f0-4f3a-8849-92c7a50ee4f7", "ChillMine"],
  ];

  for (const [id, name] of workspaces) {
    await checkWorkspace(id, name);
  }
}

main().catch(console.error);
