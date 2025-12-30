import fs from 'fs';

const spec = JSON.parse(fs.readFileSync('./schema_spec.json', 'utf8'));

function mapType(prop) {
    const type = prop.type;
    const format = prop.format;
    const description = prop.description || '';

    if (description.includes('UUID') || format === 'uuid') return 'UUID';
    if (description.includes('timestamp') || type === 'string' && format && format.includes('time')) return 'TIMESTAMPTZ';
    if (type === 'integer') return 'INTEGER';
    if (type === 'boolean') return 'BOOLEAN';
    if (type === 'number') return 'DECIMAL';
    if (type === 'object' || type === 'array') return 'JSONB';
    if (type === 'string' && description.includes('vector')) return 'vector(1536)'; // Default for many models, or 768/3072

    return 'TEXT';
}

async function generateSQL() {
    console.log('🏗️ Generating Perfect Production Schema from OpenAPI Spec...');
    const definitions = spec.definitions;
    let sql = `-- PERFECT PRODUCTION SCHEMA\n-- Generated from OpenAPI Spec\n\n`;
    sql += `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n`;
    sql += `CREATE EXTENSION IF NOT EXISTS "vector";\n\n`;

    // Create auth schema for compatibility
    sql += `CREATE SCHEMA IF NOT EXISTS auth;\n`;
    sql += `CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$ SELECT id FROM public.users LIMIT 1; $$ LANGUAGE sql;\n`;
    sql += `CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$ SELECT 'authenticated'; $$ LANGUAGE sql;\n\n`;

    for (const [tableName, def] of Object.entries(definitions)) {
        if (tableName === 'Introspection') continue;

        sql += `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;
        const props = def.properties;
        const body = [];

        for (const [propName, prop] of Object.entries(props)) {
            const pgType = mapType(prop);
            let line = `  ${propName} ${pgType}`;
            if (propName === 'id') line += ' PRIMARY KEY';
            body.push(line);
        }

        sql += body.join(',\n');
        sql += '\n);\n\n';
    }

    fs.writeFileSync('./scripts/sql/perfect_schema.sql', sql);
    console.log('✅ Generated ./scripts/sql/perfect_schema.sql');
}

generateSQL();
