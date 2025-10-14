require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function createTable() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const sql = `
    -- Create password_reset_tokens table
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      email TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Add index on token for faster lookups
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);

    -- Add index on expires_at for cleanup
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

    -- RLS policies (table is only accessed via service role)
    ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
  `;

  console.log('Creating password_reset_tokens table...');

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('Error creating table:', error);
    process.exit(1);
  }

  console.log('✅ Table created successfully!');
}

createTable().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
