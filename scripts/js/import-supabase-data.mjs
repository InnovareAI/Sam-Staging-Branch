import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'sam_prod',
    password: 'sam_root_pass_2025',
    port: 5432,
});

const DATA_DIR = './supabase_data';

async function importAllData() {
    console.log('🚀 Starting Robust Data Import into Cloud SQL...');

    if (!fs.existsSync(DATA_DIR)) {
        console.error(`❌ Data directory not found at ${DATA_DIR}`);
        return;
    }

    let queue = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    console.log(`Initial queue: ${queue.length} files.`);

    const client = await pool.connect();
    let iterations = 0;
    let lastQueueLength = queue.length + 1;

    while (queue.length > 0 && queue.length < lastQueueLength) {
        iterations++;
        lastQueueLength = queue.length;
        console.log(`\n🔄 Iteration ${iterations}: Processing ${queue.length} remaining tables...`);

        const nextQueue = [];

        for (const file of queue) {
            const tableName = file.replace('.json', '');
            const filePath = path.join(DATA_DIR, file);

            let rows;
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                rows = JSON.parse(content);
            } catch (e) {
                console.error(`  ❌ Failed to parse ${file}: ${e.message}`);
                continue;
            }

            if (rows.length === 0) {
                console.log(`  ⏭️ ${tableName}: No data, removing from queue.`);
                continue;
            }

            try {
                const columns = Object.keys(rows[0]);
                const chunkSize = 200;

                let successCount = 0;
                for (let i = 0; i < rows.length; i += chunkSize) {
                    const chunk = rows.slice(i, i + chunkSize);
                    const valuePlaceholders = [];
                    const values = [];
                    let placeholderCounter = 1;

                    for (const row of chunk) {
                        const rowPlaceholders = [];
                        for (const col of columns) {
                            let val = row[col];
                            if (val !== null && typeof val === 'object') val = JSON.stringify(val);
                            values.push(val);
                            rowPlaceholders.push(`$${placeholderCounter++}`);
                        }
                        valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
                    }

                    const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${valuePlaceholders.join(', ')} ON CONFLICT DO NOTHING;`;
                    await client.query(query, values);
                    successCount += chunk.length;
                }
                console.log(`  ✅ ${tableName}: Successfully imported ${successCount} rows.`);
            } catch (err) {
                if (err.message.includes('foreign key constraint')) {
                    console.log(`  ⏳ ${tableName}: Blocked by FK constraint: ${err.message}`);
                    nextQueue.push(file);
                } else {
                    console.error(`  ❌ ${tableName}: Failed with error: ${err.message}`);
                }
            }
        }
        queue = nextQueue;
    }

    if (queue.length > 0) {
        console.log(`\n⚠️ Finished with ${queue.length} tables still in queue:`);
        console.log(queue.join(', '));
    } else {
        console.log('\n🎉 All tables imported successfully!');
    }

    client.release();
    await pool.end();
}

importAllData();
