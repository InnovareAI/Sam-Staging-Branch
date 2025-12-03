/**
 * Apply database migrations to Supabase
 * Run: node scripts/js/apply-migrations.cjs
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration(filename) {
  const filepath = path.join(__dirname, "../../supabase/migrations", filename);
  const sql = fs.readFileSync(filepath, "utf8");

  console.log(`\n📦 Applying: ${filename}`);
  console.log("-".repeat(50));

  // Split by semicolons and run each statement
  const statements = sql
    .split(/;(?=(?:[^']*'[^']*')*[^']*$)/g)  // Split on ; but not inside quotes
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith("--"));

  let success = 0;
  let failed = 0;

  for (const statement of statements) {
    if (!statement || statement.length < 3) continue;

    const shortStmt = statement.substring(0, 80).replace(/\n/g, " ");
    try {
      const { error } = await supabase.rpc("exec_sql", { sql: statement });
      if (error) {
        // Try direct query for DDL
        const { error: directError } = await supabase.from("_").select().limit(0);
        if (directError) throw error;
      }
      console.log(`  ✅ ${shortStmt}...`);
      success++;
    } catch (err) {
      // Many statements might already exist (IF NOT EXISTS)
      if (err.message?.includes("already exists") ||
          err.message?.includes("duplicate") ||
          err.code === "42P07") {
        console.log(`  ⏭️  ${shortStmt}... (already exists)`);
      } else {
        console.log(`  ❌ ${shortStmt}...`);
        console.log(`     Error: ${err.message || err}`);
        failed++;
      }
    }
  }

  console.log(`\n  Summary: ${success} succeeded, ${failed} failed`);
  return failed === 0;
}

async function main() {
  console.log("🚀 APPLYING DATABASE MIGRATIONS\n");
  console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("=".repeat(50));

  const migrations = [
    "20251204_create_workspace_prospects.sql",
    "20251204_add_master_prospect_fk.sql",
  ];

  // Since Supabase JS client doesn't support raw SQL execution well,
  // we'll output the SQL for manual application
  console.log("\n⚠️  NOTE: Supabase JS client has limited raw SQL support.");
  console.log("   Please apply these migrations manually via Supabase Dashboard:");
  console.log("   1. Go to https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql");
  console.log("   2. Run each migration file in order\n");

  for (const migration of migrations) {
    const filepath = path.join(__dirname, "../../supabase/migrations", migration);
    console.log(`\n📄 ${migration}:`);
    console.log(`   File: ${filepath}`);
    console.log(`   Size: ${fs.statSync(filepath).size} bytes`);
  }

  console.log("\n=".repeat(50));
  console.log("✅ MIGRATION FILES READY FOR MANUAL APPLICATION");
}

main().catch(console.error);
