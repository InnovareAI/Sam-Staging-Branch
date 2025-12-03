const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Find Tim's queue item and mark as failed
  const { data: timItems } = await supabase
    .from("send_queue")
    .select("id, prospect_id, status")
    .eq("status", "pending")
    .limit(5);

  console.log("First 5 pending items:");
  for (const item of timItems || []) {
    // Get prospect name
    const { data: prospect } = await supabase
      .from("campaign_prospects")
      .select("name")
      .eq("id", item.prospect_id)
      .single();

    console.log("  " + item.id.slice(0,8) + " - " + (prospect?.name || "Unknown"));

    // If name contains Tim, mark as failed
    if (prospect?.name?.toLowerCase().includes("tim")) {
      const { error } = await supabase
        .from("send_queue")
        .update({ status: "failed", error_message: "Recipient cannot be reached - manually skipped" })
        .eq("id", item.id);
      console.log("    -> Marked as FAILED");
    }
  }
}

main().catch(console.error);
