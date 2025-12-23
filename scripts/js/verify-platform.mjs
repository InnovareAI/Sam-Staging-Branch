#!/usr/bin/env node
/**
 * SAM Platform Verification Script
 * Verifies all API connections, Supabase schema, and data tables
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

// ============================================
// Configuration
// ============================================
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const BRIGHTDATA_API_TOKEN = process.env.BRIGHTDATA_API_TOKEN;

console.log('═══════════════════════════════════════════════════════════════');
console.log('  SAM Platform Verification Script');
console.log('═══════════════════════════════════════════════════════════════\n');

const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    details: []
};

function pass(name, details = '') {
    results.passed++;
    results.details.push({ status: '✅', name, details });
    console.log(`✅ ${name}${details ? `: ${details}` : ''}`);
}

function fail(name, details = '') {
    results.failed++;
    results.details.push({ status: '❌', name, details });
    console.log(`❌ ${name}${details ? `: ${details}` : ''}`);
}

function warn(name, details = '') {
    results.warnings++;
    results.details.push({ status: '⚠️', name, details });
    console.log(`⚠️ ${name}${details ? `: ${details}` : ''}`);
}

// ============================================
// 1. Environment Variables Check
// ============================================
async function checkEnvVariables() {
    console.log('\n📋 ENVIRONMENT VARIABLES\n');

    const required = {
        'NEXT_PUBLIC_SUPABASE_URL': SUPABASE_URL,
        'SUPABASE_SERVICE_ROLE_KEY': SUPABASE_KEY,
        'UNIPILE_DSN': UNIPILE_DSN,
        'UNIPILE_API_KEY': UNIPILE_API_KEY,
    };

    const optional = {
        'BRIGHTDATA_API_TOKEN': BRIGHTDATA_API_TOKEN,
        'BRIGHT_DATA_ZONE': process.env.BRIGHT_DATA_ZONE,
        'APIFY_API_TOKEN': process.env.APIFY_API_TOKEN,
    };

    for (const [name, value] of Object.entries(required)) {
        if (value) {
            pass(name, value.substring(0, 20) + '...');
        } else {
            fail(name, 'NOT SET');
        }
    }

    console.log('\n  Optional:');
    for (const [name, value] of Object.entries(optional)) {
        if (value) {
            pass(name, value.substring(0, 20) + '...');
        } else {
            warn(name, 'Not configured');
        }
    }
}

// ============================================
// 2. Supabase Connection Check
// ============================================
async function checkSupabase() {
    console.log('\n\n📊 SUPABASE CONNECTION\n');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        fail('Supabase Connection', 'Missing credentials');
        return;
    }

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

        // Test connection with simple query
        const { data, error } = await supabase.from('workspaces').select('id').limit(1);

        if (error) {
            fail('Supabase Connection', error.message);
        } else {
            pass('Supabase Connection', 'Connected successfully');
        }
    } catch (err) {
        fail('Supabase Connection', err.message);
    }
}

// ============================================
// 3. Supabase Tables Verification
// ============================================
async function checkSupabaseTables() {
    console.log('\n\n📋 SUPABASE TABLES\n');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        fail('Table Check', 'Missing Supabase credentials');
        return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const tables = [
        { name: 'workspaces', critical: true },
        { name: 'workspace_users', critical: true },
        { name: 'workspace_accounts', critical: true },
        { name: 'workspace_prospects', critical: true },
        { name: 'prospect_approval_sessions', critical: true },
        { name: 'prospect_approval_data', critical: true },
        { name: 'prospect_approval_decisions', critical: true },
        { name: 'linkedin_searches', critical: false },
        { name: 'campaigns', critical: true },
        { name: 'campaign_prospects', critical: true },
        { name: 'messages', critical: true },
        { name: 'brand_briefs', critical: false },
        { name: 'templates', critical: false },
    ];

    for (const table of tables) {
        try {
            const { count, error } = await supabase
                .from(table.name)
                .select('*', { count: 'exact', head: true });

            if (error) {
                if (table.critical) {
                    fail(`Table: ${table.name}`, error.message);
                } else {
                    warn(`Table: ${table.name}`, error.message);
                }
            } else {
                pass(`Table: ${table.name}`, `${count ?? 0} rows`);
            }
        } catch (err) {
            fail(`Table: ${table.name}`, err.message);
        }
    }
}

// ============================================
// 4. Workspace Prospects Schema Check
// ============================================
async function checkProspectSchema() {
    console.log('\n\n📝 WORKSPACE_PROSPECTS SCHEMA\n');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        fail('Schema Check', 'Missing Supabase credentials');
        return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const expectedFields = [
        'id', 'workspace_id', 'first_name', 'last_name', 'email',
        'title', 'company', 'location', 'linkedin_url', 'linkedin_user_id',
        'status', 'quality_score', 'industry', 'enrichment_data',
        'created_at', 'updated_at'
    ];

    try {
        const { data, error } = await supabase
            .from('workspace_prospects')
            .select('*')
            .limit(1);

        if (error) {
            fail('Schema Check', error.message);
            return;
        }

        if (data && data.length > 0) {
            const columns = Object.keys(data[0]);

            for (const field of expectedFields) {
                if (columns.includes(field)) {
                    pass(`Field: ${field}`);
                } else {
                    warn(`Field: ${field}`, 'Not found');
                }
            }

            // Show extra fields
            const extraFields = columns.filter(c => !expectedFields.includes(c));
            if (extraFields.length > 0) {
                console.log(`\n  Additional fields: ${extraFields.join(', ')}`);
            }
        } else {
            warn('Schema Check', 'No data to verify schema - table is empty');
        }
    } catch (err) {
        fail('Schema Check', err.message);
    }
}

// ============================================
// 5. Unipile API Connection
// ============================================
async function checkUnipile() {
    console.log('\n\n🔗 UNIPILE API\n');

    if (!UNIPILE_DSN || !UNIPILE_API_KEY) {
        fail('Unipile API', 'Missing credentials');
        return;
    }

    try {
        const response = await fetch(`https://${UNIPILE_DSN}/api/v1/accounts`, {
            headers: {
                'X-API-KEY': UNIPILE_API_KEY,
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            const accounts = data.items || data || [];
            pass('Unipile Connection', `${accounts.length} accounts found`);

            // List accounts
            for (const account of accounts.slice(0, 5)) {
                const status = account.connection_params?.status || account.status || 'unknown';
                const type = account.type || 'unknown';
                console.log(`   └─ ${account.name || account.id}: ${type} (${status})`);
            }

            if (accounts.length > 5) {
                console.log(`   └─ ... and ${accounts.length - 5} more`);
            }
        } else {
            const text = await response.text();
            fail('Unipile Connection', `${response.status}: ${text.substring(0, 100)}`);
        }
    } catch (err) {
        fail('Unipile Connection', err.message);
    }
}

// ============================================
// 6. BrightData API Connection
// ============================================
async function checkBrightData() {
    console.log('\n\n🌐 BRIGHTDATA API\n');

    if (!BRIGHTDATA_API_TOKEN) {
        warn('BrightData API', 'Not configured (optional)');
        return;
    }

    try {
        // Just validate the token format
        if (BRIGHTDATA_API_TOKEN.length > 30) {
            pass('BrightData Token', 'Configured');
            console.log(`   Zone: ${process.env.BRIGHT_DATA_ZONE || 'linkedin_enrichment'}`);
        } else {
            warn('BrightData Token', 'Token seems too short');
        }
    } catch (err) {
        fail('BrightData Check', err.message);
    }
}

// ============================================
// 7. Workspace Accounts Check
// ============================================
async function checkWorkspaceAccounts() {
    console.log('\n\n👥 WORKSPACE ACCOUNTS\n');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        fail('Workspace Accounts', 'Missing Supabase credentials');
        return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    try {
        const { data, error } = await supabase
            .from('workspace_accounts')
            .select('id, workspace_id, account_type, unipile_account_id, created_at')
            .not('unipile_account_id', 'is', null)
            .limit(10);

        if (error) {
            fail('Workspace Accounts Query', error.message);
            return;
        }

        if (data && data.length > 0) {
            pass('Workspace Accounts', `${data.length} linked accounts`);
            for (const acc of data) {
                console.log(`   └─ ${acc.account_type}: ${acc.unipile_account_id?.substring(0, 30)}...`);
            }
        } else {
            warn('Workspace Accounts', 'No linked Unipile accounts found');
        }
    } catch (err) {
        fail('Workspace Accounts', err.message);
    }
}

// ============================================
// Run All Checks
// ============================================
async function runAllChecks() {
    await checkEnvVariables();
    await checkSupabase();
    await checkSupabaseTables();
    await checkProspectSchema();
    await checkUnipile();
    await checkBrightData();
    await checkWorkspaceAccounts();

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`  ✅ Passed:   ${results.passed}`);
    console.log(`  ❌ Failed:   ${results.failed}`);
    console.log(`  ⚠️  Warnings: ${results.warnings}`);
    console.log('\n═══════════════════════════════════════════════════════════════\n');

    if (results.failed > 0) {
        console.log('❌ Some checks failed. Please review the errors above.\n');
        process.exit(1);
    } else if (results.warnings > 0) {
        console.log('⚠️  All critical checks passed, but there are warnings.\n');
    } else {
        console.log('✅ All checks passed!\n');
    }
}

runAllChecks().catch(console.error);
