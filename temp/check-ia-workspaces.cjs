const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWorkspace(workspaceId, name) {
  console.log(`\n=== ${name} (${workspaceId.slice(0,8)}) ===`);

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
  // Check IA workspaces
  const workspaces = [
    ["babdcab8-1a78-4b2f-913e-6e9fd9821009", "IA1"],
    ["04666209-fce8-4d71-8eaf-01278edfc73b", "IA2"],
    ["96c03b38-a2f4-40de-9e16-43098599e1d4", "IA3"],
    ["7f0341da-88db-476b-ae0a-fc0da5b70861", "IA4"],
    ["cd57981a-e63b-401c-bde1-ac71752c2293", "IA5"],
    ["2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c", "IA6"],
  ];

  for (const [id, name] of workspaces) {
    await checkWorkspace(id, name);
  }

  // Summary - total approved across all workspaces
  console.log("\n\n=== SUMMARY ===");
  const { count: totalApproved } = await supabase
    .from("prospect_approval_data")
    .select("*", { count: "exact", head: true })
    .eq("approval_status", "approved");
  console.log("Total approved in all workspaces:", totalApproved);
}

main().catch(console.error);
