import { createClient } from '@supabase/supabase-js'

// Initialize Supabase with service role key for direct database access
const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
)

const linkedinAccounts = [
  { id: '3Zj8ks8aSrKg0ySaLQo_8A', name: 'Irish Cita De Ade' },
  { id: 'MlV8PYD1SXG783XbJRraLQ', name: 'Martin Schechtner' },
  { id: 'eCvuVstGTfCedKsrzAKvZA', name: 'Peter Noble' },
  { id: 'h8l0NxcsRi2se19zn0DbJw', name: 'Thorsten Linz' },
  { id: 'he3RXnROSLuhONxgNle7dw', name: '𝗖𝗵𝗮𝗿𝗶𝘀𝘀𝗮 𝗦𝗮𝗻𝗶𝗲𝗹' }
]

async function insertLinkedInAccounts() {
  try {
    console.log('🛠️ Creating workspace_accounts table first...')
    
    // Create the table using raw SQL
    const createTableSQL = `
    CREATE TABLE IF NOT EXISTS workspace_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        
        -- Account identification
        account_type TEXT NOT NULL CHECK (account_type IN ('linkedin', 'email', 'whatsapp', 'instagram')),
        account_identifier TEXT NOT NULL,
        account_name TEXT,
        
        -- Account connection details
        unipile_account_id TEXT,
        connection_status TEXT DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'error', 'suspended')),
        connection_details JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        
        -- Usage tracking
        daily_message_count INTEGER DEFAULT 0,
        daily_message_limit INTEGER DEFAULT 50,
        monthly_message_count INTEGER DEFAULT 0,
        last_message_sent_at TIMESTAMPTZ,
        last_reset_date DATE DEFAULT CURRENT_DATE,
        
        -- Account status
        is_active BOOLEAN DEFAULT true,
        is_primary BOOLEAN DEFAULT false,
        
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        
        -- Constraints
        UNIQUE(workspace_id, user_id, account_type, account_identifier)
    );`
    
    const { error: tableError } = await supabase.rpc('exec', { sql: createTableSQL })
    if (tableError) {
      console.log('⚠️ Table creation result:', tableError.message || 'Table may already exist')
    } else {
      console.log('✅ Table created successfully')
    }
    
    console.log('🔍 Finding users with thorsten or tvonlinz in email...')
    
    // Find user - check both auth.users and public.users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError)
      return
    }
    
    console.log(`📊 Found ${authUsers.users.length} auth users`)
    
    // Find Thorsten's user
    const targetUser = authUsers.users.find(u => 
      u.email === 'tl@innovareai.com'
    )
    
    if (!targetUser) {
      console.error('❌ No user found with thorsten/tvonlinz/linz in email')
      console.log('Available users:', authUsers.users.map(u => u.email))
      return
    }
    
    console.log(`👤 Found target user: ${targetUser.email} (${targetUser.id})`)
    
    // Get user's workspace
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', targetUser.id)
      .single()
    
    if (profileError || !userProfile?.current_workspace_id) {
      console.error('❌ Error getting user workspace:', profileError)
      return
    }
    
    const workspaceId = userProfile.current_workspace_id
    console.log(`🏢 User workspace: ${workspaceId}`)
    
    // Check existing accounts
    const { data: existing } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id, account_name')
      .eq('workspace_id', workspaceId)
      .eq('user_id', targetUser.id)
      .eq('account_type', 'linkedin')
    
    const existingIds = new Set(existing?.map(acc => acc.unipile_account_id) || [])
    console.log(`📋 Existing LinkedIn accounts: ${existingIds.size}`)
    
    // Insert each LinkedIn account
    for (const account of linkedinAccounts) {
      if (existingIds.has(account.id)) {
        console.log(`⏭️ ${account.name} already exists`)
        continue
      }
      
      const now = new Date().toISOString()
      const insertData = {
        workspace_id: workspaceId,
        user_id: targetUser.id,
        account_type: 'linkedin',
        account_identifier: account.name,
        account_name: account.name,
        unipile_account_id: account.id,
        connection_status: 'connected',
        created_at: now,
        updated_at: now,
        metadata: {
          linkedin_experience: 'classic',
          connection_method: 'direct_insert',
          inserted_timestamp: now
        }
      }
      
      console.log(`📝 Inserting ${account.name}...`)
      
      const { data: newAccount, error: insertError } = await supabase
        .from('workspace_accounts')
        .insert(insertData)
        .select()
        .single()
      
      if (insertError) {
        console.error(`❌ Failed to insert ${account.name}:`, insertError)
      } else {
        console.log(`✅ Successfully inserted ${account.name}`)
      }
    }
    
    console.log('🎉 Direct insertion process complete!')
    
  } catch (error) {
    console.error('💥 Script error:', error)
  }
}

insertLinkedInAccounts()