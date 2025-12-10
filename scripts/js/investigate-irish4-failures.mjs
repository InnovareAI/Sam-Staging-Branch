#!/usr/bin/env node
/**
 * Investigate Irish Campaign 4 failed sends
 */

const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ";
const BASE = "https://latxadqrvrrrcvkktrog.supabase.co/rest/v1";
const CAMPAIGN_ID = "57fd7dfe-d735-4afe-ba98-e8283dd023c6";

async function investigate() {
  // Get failed queue items
  const failedRes = await fetch(`${BASE}/send_queue?campaign_id=eq.${CAMPAIGN_ID}&status=eq.failed&select=id,linkedin_user_id,error_message,scheduled_for,updated_at`, {
    headers: { "apikey": KEY, "Authorization": `Bearer ${KEY}` }
  });
  const failed = await failedRes.json();

  console.log("╔════════════════════════════════════════════════════════════════════════════════╗");
  console.log("║              IRISH CAMPAIGN 4 - FAILED SENDS INVESTIGATION                     ║");
  console.log("╠════════════════════════════════════════════════════════════════════════════════╣");
  console.log(`║  Total Failed: ${failed.length}                                                              ║`);
  console.log("╠════════════════════════════════════════════════════════════════════════════════╣");

  // Group by error message
  const errorGroups = {};
  failed.forEach(f => {
    const err = f.error_message || "No error message";
    if (!errorGroups[err]) errorGroups[err] = [];
    errorGroups[err].push(f);
  });

  console.log("║  ERROR BREAKDOWN:                                                              ║");
  for (const [error, items] of Object.entries(errorGroups)) {
    console.log("║  ─────────────────────────────────────────────────────────────────────────────  ║");
    console.log(`║  Count: ${items.length}`);
    console.log(`║  Error: ${error.substring(0, 70)}`);
    if (error.length > 70) console.log(`║         ${error.substring(70, 140)}`);
  }

  console.log("╚════════════════════════════════════════════════════════════════════════════════╝");

  // Show full error messages
  console.log("\n📋 FULL ERROR DETAILS:");
  const uniqueErrors = [...new Set(failed.map(f => f.error_message))];
  uniqueErrors.forEach((err, i) => {
    console.log(`\n${i + 1}. ${err}`);
  });

  // Show sample failed items
  console.log("\n📋 SAMPLE FAILED ITEMS:");
  failed.slice(0, 5).forEach((f, i) => {
    console.log(`${i + 1}. LinkedIn ID: ${f.linkedin_user_id}`);
    console.log(`   Scheduled: ${f.scheduled_for}`);
    console.log(`   Error: ${f.error_message?.substring(0, 80)}...`);
    console.log("");
  });
}

investigate().catch(console.error);
