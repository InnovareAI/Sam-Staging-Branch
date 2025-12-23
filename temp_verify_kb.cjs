
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fullAudit() {
    console.log('--- Knowledge Base Full Audit ---');

    // 1. Get all documents in knowledge_base
    const { data: kb, error: kbErr } = await supabase
        .from('knowledge_base')
        .select('id, title, content, created_at, source_type, workspace_id')
        .order('created_at', { ascending: false });

    if (kbErr) {
        console.error('KB Error:', kbErr);
        process.exit(1);
    }

    console.log(`Total KB items: ${kb.length}`);

    // 2. Count vectors
    const { data: vectors, error: vErr } = await supabase
        .from('knowledge_base_vectors')
        .select('document_id');

    const vectorMap = {};
    if (vectors) {
        vectors.forEach(v => {
            vectorMap[v.document_id] = (vectorMap[v.document_id] || 0) + 1;
        });
    }

    // 3. Display summary
    kb.forEach(d => {
        const hasContent = d.content && d.content.length > 50;
        const vectorCount = vectorMap[d.id] || 0;
        console.log(`- [${d.created_at}] [ID: ${d.id.substring(0, 8)}] [WID: ${d.workspace_id ? d.workspace_id.substring(0, 8) : 'Global'}] [Vecs: ${vectorCount}] [Content: ${hasContent ? 'YES' : 'NO'}] ${d.title.substring(0, 50)}`);
    });

    process.exit(0);
}

fullAudit();
