const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Count all approved prospects
  const { count: approvedCount } = await supabase
    .from("prospect_approval_data")
    .select("*", { count: "exact", head: true })
    .eq("approval_status", "approved");

  console.log("Total approved prospects:", approvedCount);

  // Get samples of approved prospects
  const { data: samples } = await supabase
    .from("prospect_approval_data")
    .select("id, name, session_id, approval_status, created_at")
    .eq("approval_status", "approved")
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("\nRecent approved prospects:");
  samples?.forEach(s => {
    console.log(`  ${s.name} | session: ${s.session_id?.slice(0,8)} | ${s.created_at}`);
  });

  // Count by session
  const { data: sessions } = await supabase
    .from("prospect_approval_sessions")
    .select("id, campaign_name, created_at, total_prospects, approved_count")
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("\nRecent sessions:");
  sessions?.forEach(s => {
    console.log(`  ${s.campaign_name} | approved: ${s.approved_count}/${s.total_prospects} | ${s.created_at}`);
  });

  // Check pending count
  const { count: pendingCount } = await supabase
    .from("prospect_approval_data")
    .select("*", { count: "exact", head: true })
    .eq("approval_status", "pending");

  console.log("\nTotal pending prospects:", pendingCount);
}

main().catch(console.error);
