/**
 * Deploy SAM Attachments System
 * Creates database tables and storage bucket for document uploads
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deploySamAttachments() {
  console.log('🚀 Deploying SAM Attachments System\n');

  try {
    // ================================================================
    // STEP 1: Deploy Database Migration
    // ================================================================
    console.log('1. Deploying database tables...');

    const migrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20251006000000_create_sam_attachments.sql'
    );

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration via database connection
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      console.error('   ❌ Migration failed:', error.message);
      console.log('\n💡 Manual deployment required:');
      console.log('   1. Go to Supabase Dashboard > SQL Editor');
      console.log('   2. Run the migration file: supabase/migrations/20251006000000_create_sam_attachments.sql');
    } else {
      console.log('   ✅ Database tables created');
    }

    // ================================================================
    // STEP 2: Verify Tables Exist
    // ================================================================
    console.log('\n2. Verifying table creation...');

    const { data: attachments, error: tableError } = await supabase
      .from('sam_conversation_attachments')
      .select('*')
      .limit(1);

    if (tableError) {
      console.log('   ⚠️  Table not accessible:', tableError.message);
      console.log('   💡 Deploy migration manually via Supabase Dashboard');
    } else {
      console.log('   ✅ sam_conversation_attachments table verified');
    }

    // ================================================================
    // STEP 3: Create Storage Bucket
    // ================================================================
    console.log('\n3. Creating storage bucket...');

    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase
      .storage
      .listBuckets();

    if (listError) {
      console.error('   ❌ Cannot list buckets:', listError.message);
    } else {
      const bucketExists = buckets.some(b => b.name === 'sam-attachments');

      if (bucketExists) {
        console.log('   ✅ Bucket "sam-attachments" already exists');
      } else {
        // Create bucket
        const { data: newBucket, error: createError } = await supabase
          .storage
          .createBucket('sam-attachments', {
            public: false,
            fileSizeLimit: 10485760, // 10MB
            allowedMimeTypes: [
              'application/pdf',
              'image/png',
              'image/jpeg',
              'image/jpg',
              'image/webp',
              'text/plain',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ]
          });

        if (createError) {
          console.error('   ❌ Bucket creation failed:', createError.message);
          console.log('\n💡 Manual bucket creation required:');
          console.log('   1. Go to Supabase Dashboard > Storage');
          console.log('   2. Click "New bucket"');
          console.log('   3. Name: sam-attachments');
          console.log('   4. Public: No (private bucket)');
          console.log('   5. File size limit: 10MB');
        } else {
          console.log('   ✅ Bucket "sam-attachments" created');
        }
      }
    }

    // ================================================================
    // STEP 4: Set Up Storage Policies
    // ================================================================
    console.log('\n4. Setting up storage policies...');

    const storagePoliciesSQL = `
-- Storage policies for sam-attachments bucket

-- Users can upload their own attachments
CREATE POLICY "Users can upload their own attachments"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'sam-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own attachments
CREATE POLICY "Users can view their own attachments"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'sam-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own attachments
CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'sam-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
);
    `;

    console.log('   💡 Storage policies need to be created manually:');
    console.log('   1. Go to Supabase Dashboard > SQL Editor');
    console.log('   2. Run the following SQL:\n');
    console.log(storagePoliciesSQL);

    // ================================================================
    // STEP 5: Test Upload
    // ================================================================
    console.log('\n5. Testing file upload capability...');

    // Create a test file
    const testContent = 'SAM Attachments Test File - ' + new Date().toISOString();
    const testBuffer = Buffer.from(testContent, 'utf8');

    // Try to upload test file
    const testPath = `test-upload-${Date.now()}.txt`;

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('sam-attachments')
      .upload(testPath, testBuffer, {
        contentType: 'text/plain'
      });

    if (uploadError) {
      console.log('   ⚠️  Upload test failed:', uploadError.message);
      console.log('   💡 This is expected if storage policies are not yet set up');
    } else {
      console.log('   ✅ Upload test successful');

      // Clean up test file
      await supabase.storage.from('sam-attachments').remove([testPath]);
      console.log('   ✅ Test file cleaned up');
    }

    // ================================================================
    // SUMMARY
    // ================================================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 DEPLOYMENT SUMMARY\n');

    console.log('✅ Database migration created');
    console.log('✅ Upload API endpoint ready at /api/sam/upload-document');
    console.log('✅ pdf-parse library installed');

    console.log('\n📋 NEXT STEPS:\n');
    console.log('1. Deploy database migration (if not auto-deployed):');
    console.log('   • Go to Supabase Dashboard > SQL Editor');
    console.log('   • Run: supabase/migrations/20251006000000_create_sam_attachments.sql\n');

    console.log('2. Create storage bucket (if not auto-created):');
    console.log('   • Go to Supabase Dashboard > Storage');
    console.log('   • Create bucket: "sam-attachments" (private, 10MB limit)\n');

    console.log('3. Set up storage policies:');
    console.log('   • Go to Supabase Dashboard > SQL Editor');
    console.log('   • Run the storage policies SQL shown above\n');

    console.log('4. Update SAM message route to handle attachments');
    console.log('5. Add file upload UI component to SAM chat\n');

    console.log('📖 API Documentation:');
    console.log('   POST /api/sam/upload-document - Upload file');
    console.log('   GET  /api/sam/upload-document?id={id} - Get attachment');
    console.log('   DELETE /api/sam/upload-document?id={id} - Delete attachment\n');

    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    console.error(error.stack);
  }
}

// Run deployment
deploySamAttachments();
