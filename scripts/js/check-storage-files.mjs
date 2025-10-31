#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '../../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🔍 Checking Supabase Storage for deleted files\n')

  // List all storage buckets
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()

  if (bucketsError) {
    console.log('❌ Error listing buckets:', bucketsError.message)
    return
  }

  console.log(`Found ${buckets.length} storage buckets:\n`)

  for (const bucket of buckets) {
    console.log(`📦 Bucket: ${bucket.name}`)
    
    // List files in bucket
    const { data: files, error: filesError } = await supabase.storage
      .from(bucket.name)
      .list()

    if (filesError) {
      console.log(`   ❌ Error: ${filesError.message}`)
    } else {
      console.log(`   Files: ${files?.length || 0}`)
      
      if (files && files.length > 0) {
        files.slice(0, 10).forEach(f => {
          console.log(`   - ${f.name} (${f.metadata?.size || 0} bytes)`)
        })
        if (files.length > 10) {
          console.log(`   ... and ${files.length - 10} more`)
        }
      }
    }
    console.log('')
  }

  console.log('\n💡 If files exist in storage, we might be able to restore metadata')
}

main().catch(console.error)
