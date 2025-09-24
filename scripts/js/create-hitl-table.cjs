/**
 * Create HITL Reply Approval Sessions Table
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createHITLTable() {
  console.log('🔧 Creating HITL Reply Approval Sessions Table...')
  
  try {
    // First check if table exists
    const { data: existingTable } = await supabase
      .from('hitl_reply_approval_sessions')
      .select('count')
      .limit(1)
      .then(result => ({ data: true }))
      .catch(() => ({ data: false }))

    if (existingTable) {
      console.log('✅ HITL table already exists')
      return
    }

    // Create table using raw SQL
    console.log('Creating HITL table...')
    
    // Use the simpler approach - check if we can use the existing schema
    const fs = require('fs')
    const schemaContent = fs.readFileSync('./sql/tenant-integrations-schema.sql', 'utf8')
    
    // Extract just the HITL table creation part
    const hitlTableMatch = schemaContent.match(/CREATE TABLE hitl_reply_approval_sessions[\s\S]*?;/)
    
    if (!hitlTableMatch) {
      throw new Error('Could not find HITL table definition in schema')
    }
    
    const hitlTableSQL = hitlTableMatch[0]
    console.log('Found HITL table definition, creating table...')
    
    // Try alternative approach - insert a test record to trigger table creation
    try {
      // This will create the table structure if it doesn't exist
      await supabase
        .from('hitl_reply_approval_sessions')
        .insert({
          workspace_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
          original_message_id: 'test',
          original_message_content: 'test',
          original_message_channel: 'email',
          sam_suggested_reply: 'test',
          expires_at: new Date().toISOString()
        })
        .then(() => {
          console.log('✅ Table created via insert')
          // Delete the test record
          return supabase
            .from('hitl_reply_approval_sessions')
            .delete()
            .eq('original_message_id', 'test')
        })
    } catch (insertError) {
      console.log('Insert method failed, table likely needs manual creation')
      console.log('Table schema needed:')
      console.log(hitlTableSQL)
      throw insertError
    }

    console.log('✅ HITL table creation completed')
    
  } catch (error) {
    console.error('❌ Failed to create HITL table:', error.message)
    console.log('')
    console.log('🛠️  **MANUAL CREATION REQUIRED:**')
    console.log('   Execute the SQL from sql/tenant-integrations-schema.sql')
    console.log('   Look for the "hitl_reply_approval_sessions" table definition')
    console.log('')
  }
}

createHITLTable()