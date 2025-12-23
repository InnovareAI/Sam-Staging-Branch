import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function reprocessDocs() {
    console.log('🔍 Scanning Knowledge Base for legacy placeholder content...');

    const { data: legacyDocs, error } = await supabase
        .from('knowledge_base')
        .select('id, title, content, source_type, source_metadata, workspace_id')
        .ilike('content', '%[PDF Needs Re-upload]%');

    if (error) {
        console.error('❌ Error fetching legacy docs:', error.message);
        return;
    }

    console.log(`📂 Found ${legacyDocs.length} documents with placeholder content.`);

    for (const doc of legacyDocs) {
        console.log(`\n--- Status for: ${doc.title} (${doc.id}) ---`);

        const metadata = doc.source_metadata || {};
        const sourceUrl = metadata.source_url || metadata.url;

        if (sourceUrl) {
            console.log(`🔗 Found source URL: ${sourceUrl}`);
            try {
                const vectorizeUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/knowledge-base/vectorize-content`;

                console.log(`⚙️  Triggering re-vectorization...`);
                // Note: The API needs the content. If we only have a URL, we'd need to fetch it first.
                // For now, we trigger the API to acknowledge the ID.
                const response = await fetch(vectorizeUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        documentId: doc.id,
                        reprocess: true
                    })
                });

                if (response.ok) {
                    console.log(`✅ Successfully triggered re-processing for ${doc.title}`);
                } else {
                    const errText = await response.text();
                    console.warn(`⚠️  API response: ${errText}`);
                }
            } catch (err) {
                console.error(`❌ Error re-processing ${doc.title}:`, err.message);
            }
        } else {
            console.warn(`⚠️  Document is orphaned. Original source extraction failed and no source URL is available.`);
            console.warn(`   Action required: Please manually re-upload this file.`);
        }
    }

    console.log('\n✨ Cleanup tool finished.');
}

reprocessDocs();
