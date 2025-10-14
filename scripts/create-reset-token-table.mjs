import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTable() {
  console.log('Creating password_reset_tokens table...');

  // Create table using raw SQL via Supabase REST API
  const { data, error } = await supabase.rpc('exec', {
    sql: `
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        email TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

      ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
    `
  });

  if (error) {
    // Try direct SQL execution
    console.log('RPC failed, trying direct table creation...');

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          query: `
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
              email TEXT PRIMARY KEY,
              token TEXT NOT NULL,
              expires_at TIMESTAMPTZ NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
          `
        })
      }
    );

    console.log('Response:', await response.text());
  } else {
    console.log('✅ Table created successfully!', data);
  }
}

createTable();
