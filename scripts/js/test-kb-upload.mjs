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
  console.log('🔍 Knowledge Base Upload Diagnostic\n')

  // Check if knowledge_base table exists and is accessible
  const { data: kbTest, error: kbError } = await supabase
    .from('knowledge_base')
    .select('id, title, section, workspace_id, created_at')
    .limit(10)

  if (kbError) {
    console.error('❌ Error accessing knowledge_base table:', kbError.message)
    return
  }

  console.log(`✅ knowledge_base table accessible`)
  console.log(`   Total documents across all workspaces: ${kbTest?.length || 0}`)
  
  if (kbTest && kbTest.length > 0) {
    console.log('\n   Recent documents:')
    kbTest.forEach(doc => {
      console.log(`   - [${doc.section || 'no section'}] ${doc.title} (${doc.created_at})`)
    })
  } else {
    console.log('\n   ⚠️  NO DOCUMENTS FOUND IN ANY WORKSPACE')
    console.log('   This suggests KB upload has never worked or all documents were deleted')
  }

  // Check upload API endpoint
  console.log('\n📡 Checking API endpoint...')
  const testUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com'}/api/knowledge-base/upload-document`
  console.log(`   URL: ${testUrl}`)
  console.log('   (Cannot test without authentication token)')

  // Check if there are any deleted/archived documents
  const { data: allKB, error: allError } = await supabase
    .from('knowledge_base')
    .select('count')
  
  console.log(`\n📊 Total KB records (including deleted): ${allKB?.[0]?.count || 0}`)
}

main().catch(console.error)
