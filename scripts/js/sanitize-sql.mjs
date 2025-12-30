import fs from 'fs';

const inputFile = './scripts/sql/master_schema.sql';
const outputFile = './scripts/sql/gcp_schema.sql';

async function sanitize() {
    console.log('🧹 Sanitizing SQL for GCP Cloud SQL...');
    let sql = fs.readFileSync(inputFile, 'utf8');

    // 1. Replace Supabase schema references
    // Replaces 'auth.users' with 'public.users' since we have a users table in public
    sql = sql.replace(/REFERENCES auth\.users\(id\)/g, 'REFERENCES public.users(id)');

    // 2. Handle auth.uid() and auth.role()
    // These are often used in RLS. We'll replace them with placeholders or simple checks
    // for initial migration, we might want to disable RLS or use a dummy function
    sql = `
-- DUMMY AUTH FUNCTIONS FOR GCP COMPATIBILITY
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$ SELECT id FROM public.users LIMIT 1; $$ LANGUAGE sql;
CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$ SELECT 'authenticated'; $$ LANGUAGE sql;
\n` + sql;

    // 3. Ensure extensions are correct for GCP
    // Cloud SQL supports these but sometimes the names or setup differs slightly
    // We already added them in the consolidation script, but let's make sure

    // 4. Remove 'SET search_path' calls if they point to supabase-specific schemas
    sql = sql.replace(/SET search_path = .*/g, '-- SET search_path removed for portability');

    // 5. Fix common Supabase-specific DDL that might fail
    // Like 'grant' to 'authenticated', 'anon', 'service_role'
    sql = sql.replace(/TO authenticated/g, '-- TO authenticated');
    sql = sql.replace(/TO anon/g, '-- TO anon');
    sql = sql.replace(/TO service_role/g, '-- TO service_role');

    // 6. Handle gen_random_uuid() - standard in Postgres 13+

    fs.writeFileSync(outputFile, sql);
    console.log(`✅ Sanitized SQL generated: ${outputFile}`);
}

sanitize();
