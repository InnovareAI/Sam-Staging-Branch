#!/usr/bin/env node
/**
 * Backfill Knowledge Base Vectors
 *
 * This script generates vector embeddings for all KB documents that are missing them.
 * Currently 55 out of 56 documents have no vectors, which breaks SAM AI's RAG functionality.
 *
 * Usage:
 *   node scripts/js/backfill-knowledge-vectors.mjs
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔧 Knowledge Base Vector Backfill Script');
console.log('=========================================\n');

async function backfillVectors() {
  try {
    // Step 1: Get all KB documents
    console.log('📊 Step 1: Fetching KB documents...');
    const { data: kbDocs, error: kbError } = await supabase
      .from('knowledge_base')
      .select('id, workspace_id, category, title, content, tags')
      .eq('is_active', true);

    if (kbError) {
      throw new Error(`Failed to fetch KB documents: ${kbError.message}`);
    }

    console.log(`   Found ${kbDocs.length} active KB documents\n`);

    // Step 2: Check which ones have vectors
    console.log('📊 Step 2: Checking vector status...');
    const { data: existingVectors, error: vectorError } = await supabase
      .from('knowledge_base_vectors')
      .select('document_id');

    if (vectorError) {
      throw new Error(`Failed to fetch vectors: ${vectorError.message}`);
    }

    const vectorizedDocIds = new Set(existingVectors.map(v => v.document_id));
    const docsNeedingVectors = kbDocs.filter(doc => !vectorizedDocIds.has(doc.id));

    console.log(`   ${existingVectors.length} documents already have vectors`);
    console.log(`   ${docsNeedingVectors.length} documents need vectorization\n`);

    if (docsNeedingVectors.length === 0) {
      console.log('✅ All documents already have vectors! Nothing to do.');
      return;
    }

    // Step 3: Vectorize each document
    console.log('🚀 Step 3: Generating vectors...\n');

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (let i = 0; i < docsNeedingVectors.length; i++) {
      const doc = docsNeedingVectors[i];
      const progress = `[${i + 1}/${docsNeedingVectors.length}]`;

      console.log(`${progress} Processing: ${doc.title.substring(0, 60)}...`);

      try {
        // Call the vectorize-content API endpoint
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://latxadqrvrrrcvkktrog.supabase.co', 'http://localhost:3000')}/api/knowledge-base/vectorize-content`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            documentId: doc.id,
            content: doc.content,
            tags: doc.tags || [],
            section: doc.category,
            metadata: {
              backfill: true,
              backfill_date: new Date().toISOString()
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log(`   ✅ Success - Generated ${result.vectorChunks} vector chunks`);
        successCount++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.log(`   ❌ Failed - ${error.message}`);
        failCount++;
        errors.push({
          docId: doc.id,
          title: doc.title,
          error: error.message
        });
      }
    }

    // Step 4: Report results
    console.log('\n=========================================');
    console.log('📊 BACKFILL COMPLETE');
    console.log('=========================================');
    console.log(`✅ Successfully vectorized: ${successCount} documents`);
    console.log(`❌ Failed: ${failCount} documents`);

    if (errors.length > 0) {
      console.log('\n⚠️  ERRORS:');
      errors.forEach(err => {
        console.log(`   - ${err.title}: ${err.error}`);
      });
    }

    // Verify final state
    console.log('\n📊 Verification:');
    const { data: finalVectors } = await supabase
      .from('knowledge_base_vectors')
      .select('document_id');

    const vectorizedDocCount = new Set(finalVectors.map(v => v.document_id)).size;
    const coverage = ((vectorizedDocCount / kbDocs.length) * 100).toFixed(1);

    console.log(`   Total KB documents: ${kbDocs.length}`);
    console.log(`   Documents with vectors: ${vectorizedDocCount}`);
    console.log(`   Coverage: ${coverage}%`);

    if (coverage >= 95) {
      console.log('\n✅ RAG SYSTEM IS NOW FUNCTIONAL!');
    } else {
      console.log('\n⚠️  RAG system still has low coverage. Manual intervention may be needed.');
    }

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the backfill
backfillVectors();
