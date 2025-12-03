const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sendNow() {
  const now = new Date().toISOString();

  // Get all pending items
  const { data: pending, error } = await supabase
    .from("send_queue")
    .select("id, campaign_id, scheduled_for")
    .eq("status", "pending");

  console.log("Found " + (pending?.length || 0) + " pending items");

  if (pending && pending.length > 0) {
    // Update first 5 to send NOW
    const toUpdate = pending.slice(0, 5);
    console.log("Rescheduling " + toUpdate.length + " items to NOW");

    for (const item of toUpdate) {
      const { error: updateErr } = await supabase
        .from("send_queue")
        .update({ scheduled_for: now })
        .eq("id", item.id);

      if (updateErr) {
        console.log("Error updating " + item.id + ": " + updateErr.message);
      } else {
        console.log("✅ Updated " + item.id.slice(0,8) + " to " + now);
      }
    }
  }

  console.log("\nNow trigger the cron job...");
}

sendNow().catch(console.error);
