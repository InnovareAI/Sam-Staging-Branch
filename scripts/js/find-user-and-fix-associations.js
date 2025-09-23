#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://latxadqrvrrrcvkktrog.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// MCP tool for getting Unipile accounts
const mcpTool = {
  async getAccounts() {
    console.log('🔌 MCP Tool: Getting Unipile accounts...')
    const fetch = (await import('node-fetch')).default
    
    try {
      const response = await fetch('http://localhost:3001/mcp/unipile/accounts', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log(`📊 Found ${data.accounts?.length || 0} Unipile accounts`)
      return data.accounts || []
    } catch (error) {
      console.error('❌ Error getting Unipile accounts:', error.message)
      return []
    }
  }
}

async function findUsersAndFixAssociations() {
  console.log('🔍 Finding all users in the system...\n')
  
  // Get all users
  const { data: users, error: userError } = await supabase.auth.admin.listUsers()
  
  if (userError) {
    console.error('❌ Error fetching users:', userError)
    return
  }
  
  console.log(`👥 Found ${users.users.length} users:`)
  users.users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email} (${user.id})`)
  })
  
  // Get Unipile accounts
  const unipileAccounts = await mcpTool.getAccounts()
  
  if (unipileAccounts.length === 0) {
    console.log('❌ No Unipile accounts found, cannot proceed with fixing associations')
    return
  }
  
  console.log('\n📋 Available LinkedIn accounts from Unipile:')
  const linkedinAccounts = unipileAccounts.filter(acc => 
    acc.sources && acc.sources.some(source => source.platform === 'LINKEDIN')
  )
  
  linkedinAccounts.forEach((account, index) => {
    const linkedinSource = account.sources.find(s => s.platform === 'LINKEDIN')
    console.log(`${index + 1}. ${account.name} (${linkedinSource?.username || 'N/A'}) - ID: ${linkedinSource?.id}`)
  })
  
  // Check current associations
  console.log('\n🔗 Current LinkedIn associations:')
  const { data: currentAssociations, error: assocError } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('platform', 'LINKEDIN')
  
  if (assocError) {
    console.error('❌ Error fetching current associations:', assocError)
    return
  }
  
  console.log(`Found ${currentAssociations.length} current LinkedIn associations:`)
  currentAssociations.forEach((assoc, index) => {
    console.log(`${index + 1}. User: ${assoc.user_id}, Account: ${assoc.unipile_account_id}, Username: ${assoc.username}`)
  })
  
  // If there's only one user, assume it's Thorsten and fix the associations
  if (users.users.length === 1) {
    const user = users.users[0]
    console.log(`\n🎯 Found single user: ${user.email} - fixing associations...`)
    
    await fixLinkedInAssociations(user.id, linkedinAccounts)
  } else {
    // Look for Thorsten specifically
    const thorstenUser = users.users.find(u => 
      u.email?.includes('thorsten') || 
      u.email?.includes('tl@') ||
      u.email?.includes('linz')
    )
    
    if (thorstenUser) {
      console.log(`\n🎯 Found Thorsten: ${thorstenUser.email} - fixing associations...`)
      await fixLinkedInAssociations(thorstenUser.id, linkedinAccounts)
    } else {
      console.log('\n❌ Could not identify Thorsten user - please specify which user to fix')
      console.log('Available users:')
      users.users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`)
      })
    }
  }
}

async function fixLinkedInAssociations(userId, linkedinAccounts) {
  console.log(`\n🔧 Fixing LinkedIn associations for user: ${userId}`)
  
  // First, remove ALL current associations for this user
  console.log('🧹 Removing all current LinkedIn associations...')
  const { error: deleteError } = await supabase
    .from('user_unipile_accounts')
    .delete()
    .eq('user_id', userId)
    .eq('platform', 'LINKEDIN')
  
  if (deleteError) {
    console.error('❌ Error removing associations:', deleteError)
    return
  }
  
  console.log('✅ All LinkedIn associations removed')
  
  // Find the Thorsten Linz account specifically
  const thorstenAccount = linkedinAccounts.find(account => {
    const linkedinSource = account.sources.find(s => s.platform === 'LINKEDIN')
    return account.name?.toLowerCase().includes('thorsten') ||
           account.name?.toLowerCase().includes('linz') ||
           linkedinSource?.username?.toLowerCase().includes('thorsten') ||
           linkedinSource?.username?.toLowerCase().includes('linz')
  })
  
  if (!thorstenAccount) {
    console.log('❌ Could not find Thorsten Linz LinkedIn account')
    console.log('Available accounts:')
    linkedinAccounts.forEach((account, index) => {
      const linkedinSource = account.sources.find(s => s.platform === 'LINKEDIN')
      console.log(`${index + 1}. ${account.name} (${linkedinSource?.username || 'N/A'})`)
    })
    
    // Just use the first account as fallback
    if (linkedinAccounts.length > 0) {
      console.log('🔄 Using first available account as fallback...')
      await createAssociation(userId, linkedinAccounts[0])
    }
    return
  }
  
  // Create association for Thorsten Linz account only
  await createAssociation(userId, thorstenAccount)
  
  console.log('✅ Fixed LinkedIn associations - now showing only 1 account')
}

async function createAssociation(userId, account) {
  const linkedinSource = account.sources.find(s => s.platform === 'LINKEDIN')
  
  if (!linkedinSource) {
    console.log('❌ No LinkedIn source found in account')
    return
  }
  
  console.log(`🔗 Creating association for: ${account.name} (${linkedinSource.username})`)
  
  const { error: insertError } = await supabase
    .from('user_unipile_accounts')
    .insert({
      user_id: userId,
      unipile_account_id: linkedinSource.id,
      platform: 'LINKEDIN',
      username: linkedinSource.username,
      account_status: 'CONNECTED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  
  if (insertError) {
    console.error('❌ Error creating association:', insertError)
    return
  }
  
  console.log('✅ Successfully created LinkedIn association')
}

// Run the script
findUsersAndFixAssociations().catch(console.error)