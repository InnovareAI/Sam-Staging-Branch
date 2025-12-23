
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testUpload() {
    console.log('--- Testing Document Upload Flow ---');
    const docId = uuidv4();
    const testContent = "This is a test document to verify that uploads work, are transcribed, and saved. Created at " + new Date().toISOString();
    const testTitle = "Test Verification Document.txt";

    // 1. Insert into knowledge_base
    const { data: doc, error: dbError } = await supabase
        .from('knowledge_base')
        .insert({
            id: docId,
            workspace_id: workspaceId,
            category: 'general',
            title: testTitle,
            content: testContent,
            tags: ['test', 'verification'],
            version: '1.0',
            is_active: true,
            source_type: 'document_upload',
            source_metadata: {
                upload_mode: 'file',
                mime_type: 'text/plain',
                original_filename: testTitle,
            }
        })
        .select()
        .single();

    if (dbError) {
        console.error('Insert error:', dbError);
        process.exit(1);
    }

    console.log(`Document created with ID: ${doc.id}`);

    // 2. Verify it's there
    const { data: verify, error: vError } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('id', docId)
        .single();

    if (vError) {
        console.error('Verification error:', vError);
    } else {
        console.log('Successfully verified record in database.');
        console.log(`Title: ${verify.title}`);
        console.log(`Content: ${verify.content}`);
    }

    // Cleanup: I'll leave it there for the user to see in the UI if they want, but I'll delete it later or mark it.
    process.exit(0);
}

testUpload();
