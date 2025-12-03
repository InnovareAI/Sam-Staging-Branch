const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // List all workspaces
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  console.log("Workspaces:");
  workspaces?.forEach(w => {
    console.log(`  ${w.name} | ${w.id}`);
  });

  // Check InnovareAI workspace
  const { data: innovare } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("id", "babdcab8-1a78-4b2f-913e-6e9fd9821009")
    .single();

  console.log("\nInnovareAI workspace:", innovare);

  if (innovare) {
    // Check sessions in InnovareAI workspace
    const { data: sessions } = await supabase
      .from("prospect_approval_sessions")
      .select("id, campaign_name, total_prospects, approved_count, created_at")
      .eq("workspace_id", innovare.id)
      .order("created_at", { ascending: false })
      .limit(10);

    console.log("\nRecent sessions in InnovareAI:");
    sessions?.forEach(s => {
      console.log(`  ${s.campaign_name} | ${s.approved_count}/${s.total_prospects}`);
    });

    // Get session IDs for InnovareAI
    const sessionIds = sessions?.map(s => s.id) || [];

    // Count approved prospects
    const { count: approvedCount } = await supabase
      .from("prospect_approval_data")
      .select("*", { count: "exact", head: true })
      .in("session_id", sessionIds)
      .eq("approval_status", "approved");

    console.log("\nApproved prospects in InnovareAI:", approvedCount);

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

      console.log("With LinkedIn URLs:", linkedinUrls?.length);
      console.log("Already in campaigns:", campaignProspects?.length);
      console.log("Available for In Progress:", linkedinUrls.length - (campaignProspects?.length || 0));
    }

    // Check draft campaigns
    const { data: drafts } = await supabase
      .from("campaigns")
      .select("id, name, status, campaign_type, created_at")
      .eq("workspace_id", innovare.id)
      .eq("status", "draft");

    console.log("\nDraft campaigns in InnovareAI:", drafts?.length);
    drafts?.forEach(d => {
      console.log(`  ${d.name} | ${d.campaign_type} | ${d.created_at}`);
    });
  }
}

main().catch(console.error);
