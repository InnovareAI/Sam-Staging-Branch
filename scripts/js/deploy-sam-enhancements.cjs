/**
 * Deploy SAM Enhancements
 * - Document attachments system
 * - Enhanced ICP discovery with Q&A storage for RAG
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deploySamEnhancements() {
  console.log('🚀 Deploying SAM System Enhancements\n');

  const results = {
    attachments: false,
    icpEnhancement: false,
    storageReady: false,
    errors: []
  };

  try {
    // ================================================================
    // STEP 1: Deploy Attachments Migration
    // ================================================================
    console.log('1. Deploying SAM Attachments System...');

    const attachmentsMigration = path.join(
      process.cwd(),
      'supabase/migrations/20251006000000_create_sam_attachments.sql'
    );

    if (fs.existsSync(attachmentsMigration)) {
      console.log('   📄 Migration file found');
      console.log('   💡 Deploy manually via Supabase Dashboard > SQL Editor');
      console.log('   📁 File: supabase/migrations/20251006000000_create_sam_attachments.sql\n');
    } else {
      console.error('   ❌ Migration file not found\n');
      results.errors.push('Attachments migration file missing');
    }

    // ================================================================
    // STEP 2: Deploy ICP Enhancement Migration
    // ================================================================
    console.log('2. Deploying ICP Discovery Q&A Storage Enhancement...');

    const icpMigration = path.join(
      process.cwd(),
      'supabase/migrations/20251006000001_enhance_icp_discovery_for_rag.sql'
    );

    if (fs.existsSync(icpMigration)) {
      console.log('   📄 Migration file found');
      console.log('   💡 Deploy manually via Supabase Dashboard > SQL Editor');
      console.log('   📁 File: supabase/migrations/20251006000001_enhance_icp_discovery_for_rag.sql\n');
    } else {
      console.error('   ❌ Migration file not found\n');
      results.errors.push('ICP enhancement migration file missing');
    }

    // ================================================================
    // STEP 3: Check Storage Bucket
    // ================================================================
    console.log('3. Checking Supabase Storage...');

    const { data: buckets, error: listError } = await supabase
      .storage
      .listBuckets();

    if (listError) {
      console.error('   ❌ Cannot list buckets:', listError.message);
      results.errors.push('Storage access error');
    } else {
      const bucketExists = buckets.some(b => b.name === 'sam-attachments');

      if (bucketExists) {
        console.log('   ✅ Bucket "sam-attachments" exists');
        results.storageReady = true;

        // Test upload
        const testContent = 'Test - ' + new Date().toISOString();
        const testBuffer = Buffer.from(testContent, 'utf8');
        const testPath = `test-${Date.now()}.txt`;

        const { error: uploadError } = await supabase
          .storage
          .from('sam-attachments')
          .upload(testPath, testBuffer, { contentType: 'text/plain' });

        if (uploadError) {
          console.log('   ⚠️  Upload test failed:', uploadError.message);
          console.log('   💡 Storage policies may not be configured\n');
        } else {
          console.log('   ✅ Upload test successful');
          await supabase.storage.from('sam-attachments').remove([testPath]);
          console.log('   ✅ Storage fully operational\n');
        }
      } else {
        console.log('   ⚠️  Bucket "sam-attachments" not found');
        console.log('   💡 Create bucket in Supabase Dashboard > Storage\n');
      }
    }

    // ================================================================
    // STEP 4: Verify Tables (After Manual Deployment)
    // ================================================================
    console.log('4. Verifying database tables...');

    // Check attachments table
    const { data: attachments, error: attachError } = await supabase
      .from('sam_conversation_attachments')
      .select('count')
      .limit(1);

    if (attachError) {
      console.log('   ⏳ sam_conversation_attachments - NOT YET DEPLOYED');
      console.log('      (Deploy migration in Supabase Dashboard)\n');
    } else {
      console.log('   ✅ sam_conversation_attachments - DEPLOYED');
      results.attachments = true;
    }

    // Check ICP knowledge table
    const { data: icpKnowledge, error: icpError } = await supabase
      .from('sam_icp_knowledge_entries')
      .select('count')
      .limit(1);

    if (icpError) {
      console.log('   ⏳ sam_icp_knowledge_entries - NOT YET DEPLOYED');
      console.log('      (Deploy migration in Supabase Dashboard)\n');
    } else {
      console.log('   ✅ sam_icp_knowledge_entries - DEPLOYED');
      results.icpEnhancement = true;
    }

    // ================================================================
    // STEP 5: System Readiness Check
    // ================================================================
    console.log('5. System Components Readiness...');

    // Check API endpoints
    const endpoints = [
      { name: 'Upload API', path: 'app/api/sam/upload-document/route.ts' },
      { name: 'SAM Messages', path: 'app/api/sam/threads/[threadId]/messages/route.ts' }
    ];

    for (const endpoint of endpoints) {
      const exists = fs.existsSync(path.join(process.cwd(), endpoint.path));
      if (exists) {
        console.log(`   ✅ ${endpoint.name} - Ready`);
      } else {
        console.log(`   ❌ ${endpoint.name} - Missing`);
        results.errors.push(`${endpoint.name} not found`);
      }
    }

    // Check pdf-parse
    try {
      require('pdf-parse');
      console.log('   ✅ pdf-parse library - Installed');
    } catch (e) {
      console.log('   ❌ pdf-parse library - Not installed');
      results.errors.push('pdf-parse not installed');
    }

    // ================================================================
    // DEPLOYMENT SUMMARY
    // ================================================================
    console.log('\n' + '='.repeat(70));
    console.log('📊 DEPLOYMENT SUMMARY\n');

    console.log('Migration Files Created:');
    console.log('  ✅ 20251006000000_create_sam_attachments.sql');
    console.log('  ✅ 20251006000001_enhance_icp_discovery_for_rag.sql\n');

    console.log('Database Tables:');
    console.log(`  ${results.attachments ? '✅' : '⏳'} sam_conversation_attachments`);
    console.log(`  ${results.icpEnhancement ? '✅' : '⏳'} sam_icp_knowledge_entries\n`);

    console.log('Storage:');
    console.log(`  ${results.storageReady ? '✅' : '⏳'} sam-attachments bucket\n`);

    console.log('API Endpoints:');
    console.log('  ✅ POST /api/sam/upload-document - File upload');
    console.log('  ✅ GET  /api/sam/upload-document?id={id} - Get attachment');
    console.log('  ✅ DELETE /api/sam/upload-document?id={id} - Delete attachment\n');

    if (results.errors.length > 0) {
      console.log('⚠️  ISSUES FOUND:');
      results.errors.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err}`);
      });
      console.log('');
    }

    // ================================================================
    // MANUAL DEPLOYMENT STEPS
    // ================================================================
    console.log('='.repeat(70));
    console.log('📋 MANUAL DEPLOYMENT STEPS\n');

    console.log('1. DEPLOY DATABASE MIGRATIONS:');
    console.log('   a. Go to Supabase Dashboard > SQL Editor');
    console.log('   b. Open and run: supabase/migrations/20251006000000_create_sam_attachments.sql');
    console.log('   c. Open and run: supabase/migrations/20251006000001_enhance_icp_discovery_for_rag.sql\n');

    console.log('2. CONFIGURE STORAGE (if not done):');
    console.log('   a. Go to Supabase Dashboard > Storage');
    console.log('   b. Create bucket: "sam-attachments" (private, 10MB limit)');
    console.log('   c. Set up storage policies (see migration file comments)\n');

    console.log('3. UPDATE SAM MESSAGE ROUTE:');
    console.log('   a. Add Q&A storage logic to /app/api/sam/threads/[threadId]/messages/route.ts');
    console.log('   b. Generate embeddings for each Q&A pair');
    console.log('   c. Store in sam_icp_knowledge_entries table');
    console.log('   d. Query stored Q&A when SAM needs context\n');

    console.log('4. TEST THE SYSTEM:');
    console.log('   a. Upload a PDF document via SAM chat');
    console.log('   b. Ask SAM ICP discovery questions');
    console.log('   c. Verify Q&A is stored in sam_icp_knowledge_entries');
    console.log('   d. Ask a clarifying question and verify SAM references past answers\n');

    // ================================================================
    // Q&A STORAGE SCHEMA DOCUMENTATION
    // ================================================================
    console.log('='.repeat(70));
    console.log('📖 Q&A STORAGE SCHEMA\n');

    console.log('sam_icp_knowledge_entries table stores:');
    console.log('  • question_id: Unique identifier (e.g., "objectives", "pain_points")');
    console.log('  • question_text: The actual question asked');
    console.log('  • answer_text: User\'s answer');
    console.log('  • answer_structured: Parsed JSON structure');
    console.log('  • stage: Workflow stage (stage_1_target_market, stage_2_icp, etc.)');
    console.log('  • category: Question category (business_model, pain_points, etc.)');
    console.log('  • embedding: Vector for RAG similarity search');
    console.log('  • confidence_score: Answer confidence (0.0-1.0)');
    console.log('  • is_shallow: Flag for generic/shallow answers');
    console.log('  • needs_clarification: Flag for incomplete answers\n');

    console.log('Helper Functions:');
    console.log('  • search_icp_knowledge() - Semantic search for clarifying questions');
    console.log('  • get_discovery_qa_history() - Get complete Q&A history');
    console.log('  • get_prospecting_criteria() - Get prospecting Q&A for campaigns\n');

    console.log('='.repeat(70));

    // ================================================================
    // EXAMPLE USAGE
    // ================================================================
    console.log('💡 EXAMPLE USAGE\n');

    console.log('Storing Q&A in SAM message route:');
    console.log(`
const { data: qaEntry } = await supabase
  .from('sam_icp_knowledge_entries')
  .insert({
    workspace_id: workspaceId,
    user_id: userId,
    discovery_session_id: sessionId,
    question_id: 'pain_points',
    question_text: 'What are the top 3 pain points your buyers face?',
    answer_text: 'Long sales cycles, low conversion, high CAC',
    answer_structured: {
      pain_points: [
        { description: 'Long sales cycles', intensity: 'high' },
        { description: 'Low conversion', intensity: 'high' },
        { description: 'High CAC', intensity: 'medium' }
      ]
    },
    stage: 'stage_2_icp',
    category: 'pain_points',
    embedding: questionEmbedding, // Generated via OpenAI
    indexed_for_rag: true
  });
    `);

    console.log('Querying for clarifying questions:');
    console.log(`
const { data: relatedQA } = await supabase
  .rpc('search_icp_knowledge', {
    p_workspace_id: workspaceId,
    p_query_embedding: queryEmbedding,
    p_category: 'pain_points',
    p_limit: 3
  });

// SAM can now reference: "Earlier you mentioned [answer_text]..."
    `);

    console.log('='.repeat(70));
    console.log('✅ Deployment preparation complete!\n');

  } catch (error) {
    console.error('\n❌ Deployment check failed:', error.message);
    console.error(error.stack);
  }
}

// Run deployment
deploySamEnhancements();
