import fs from 'fs';
import path from 'path';

const migrationsDir = './supabase/migrations';
const outputFile = './scripts/sql/master_schema.sql';

async function consolidate() {
    console.log('🚀 Consolidating migrations...');

    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort((a, b) => a.localeCompare(b));

    console.log(`Found ${files.length} migration files.`);

    let masterSQL = `-- MASTER SCHEMA CONSOLIDATION\n`;
    masterSQL += `-- Generated on: ${new Date().toISOString()}\n\n`;
    masterSQL += `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n`;
    masterSQL += `CREATE EXTENSION IF NOT EXISTS "pg_net"; -- If needed\n`;
    masterSQL += `CREATE EXTENSION IF NOT EXISTS "vector";\n\n`;

    for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        masterSQL += `\n-- --- START OF ${file} ---\n`;
        masterSQL += content;
        masterSQL += `\n-- --- END OF ${file} ---\n`;
    }

    // Basic cleanup: Remove Supabase-specific things that might break Cloud SQL
    // (Optional: can be done manually after generation or during processing)

    fs.writeFileSync(outputFile, masterSQL);
    console.log(`✅ Master schema generated: ${outputFile}`);
}

consolidate();
