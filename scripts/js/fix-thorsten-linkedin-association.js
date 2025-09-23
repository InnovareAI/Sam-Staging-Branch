#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://latxadqrvrrrcvkktrog.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Thorsten's user ID (tl@innovareai.com)
const THORSTEN_USER_ID = 'f6885ff3-deef-4781-8721-93011c990b1b'

// Use the most recent Thorsten Linz account (has Sales Navigator premium)
const THORSTEN_LINKEDIN_ACCOUNT_ID = 'NLsTJRfCSg-WZAXCBo8w7A_MESSAGING'

async function fixThorstenLinkedInAssociation() {
  console.log('🔧 Fixing Thorsten LinkedIn association...')
  console.log(`👤 User ID: ${THORSTEN_USER_ID}`)
  console.log(`🔗 LinkedIn Account: ${THORSTEN_LINKEDIN_ACCOUNT_ID}`)
  
  try {
    // Step 1: Remove ALL current LinkedIn associations for Thorsten
    console.log('\n🧹 Removing all current LinkedIn associations for Thorsten...')
    const { error: deleteError } = await supabase
      .from('user_unipile_accounts')
      .delete()
      .eq('user_id', THORSTEN_USER_ID)
      .eq('platform', 'LINKEDIN')
    
    if (deleteError) {
      console.error('❌ Error removing associations:', deleteError)
      return
    }
    
    console.log('✅ All LinkedIn associations removed')
    
    // Step 2: Create single association with the correct Thorsten account
    console.log('\n🔗 Creating single LinkedIn association...')
    const { error: insertError } = await supabase
      .from('user_unipile_accounts')
      .insert({
        user_id: THORSTEN_USER_ID,
        unipile_account_id: THORSTEN_LINKEDIN_ACCOUNT_ID,
        platform: 'LINKEDIN'
      })
    
    if (insertError) {
      console.error('❌ Error creating association:', insertError)
      return
    }
    
    console.log('✅ Successfully created single LinkedIn association')
    
    // Step 3: Verify the fix
    console.log('\n🔍 Verifying LinkedIn associations...')
    const { data: associations, error: verifyError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', THORSTEN_USER_ID)
      .eq('platform', 'LINKEDIN')
    
    if (verifyError) {
      console.error('❌ Error verifying associations:', verifyError)
      return
    }
    
    console.log(`📊 Found ${associations.length} LinkedIn association(s):`)
    associations.forEach((assoc, index) => {
      console.log(`${index + 1}. Account: ${assoc.unipile_account_id}, Platform: ${assoc.platform}`)
    })
    
    if (associations.length === 1) {
      console.log('\n🎉 SUCCESS: Thorsten now has exactly 1 LinkedIn account connected!')
    } else {
      console.log(`\n⚠️  WARNING: Expected 1 association, found ${associations.length}`)
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the script
fixThorstenLinkedInAssociation().catch(console.error)