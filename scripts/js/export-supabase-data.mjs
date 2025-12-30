import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DATA_DIR = './temp/supabase_data';

async function exportAllData() {
    console.log('🚀 Starting Data Export from Supabase...');

    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // 1. Get all tables from the master_schema.sql file
    const schemaPath = './scripts/sql/master_schema.sql';
    if (!fs.existsSync(schemaPath)) {
        console.error(`❌ Schema file not found at ${schemaPath}`);
        return;
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    // Regex to find table names
    const tableRegex = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:public\.)?(\w+)/gi;
    const tableNames = [];
    let match;
    while ((match = tableRegex.exec(schemaSql)) !== null) {
        if (!tableNames.includes(match[1])) {
            tableNames.push(match[1]);
        }
    }

    console.log(`Extracted ${tableNames.length} tables from master schema.`);

    for (const tableName of tableNames) {
        console.log(`📦 Exporting ${tableName}...`);
        let allRows = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        try {
            while (hasMore) {
                const { data, error } = await supabase
                    .from(tableName)
                    .select('*')
                    .range(from, from + step - 1);

                if (error) {
                    console.error(`  ⚠️ Skipped ${tableName}: ${error.message}`);
                    break;
                }

                if (data && data.length > 0) {
                    allRows = allRows.concat(data);
                    from += step;
                    console.log(`  Fetched ${allRows.length} rows...`);
                    if (data.length < step) hasMore = false;
                } else {
                    hasMore = false;
                }

                if (from > 50000) {
                    console.warn(`  ⚠️ Table ${tableName} is large. Stopping after 50k rows.`);
                    break;
                }
            }

            if (allRows.length > 0) {
                const filePath = path.join(DATA_DIR, `${tableName}.json`);
                fs.writeFileSync(filePath, JSON.stringify(allRows, null, 2));
                console.log(`  ✅ Exported ${allRows.length} rows to ${filePath}`);
            }
        } catch (e) {
            console.error(`  ❌ Failed to export ${tableName}:`, e.message);
        }
    }

    console.log('🎉 Export Complete!');
}

exportAllData();
