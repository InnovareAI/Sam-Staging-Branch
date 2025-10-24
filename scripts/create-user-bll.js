#!/usr/bin/env node

/**
 * Create user account for Blue Label Labs
 * Usage: node scripts/create-user-bll.js
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createUser() {
  const email = 'tl+BLL@innovareai.com'
  const password = 'BlueLabelLabs2024!' // Change this to your desired password
  
  console.log('Creating user account for Blue Label Labs...')
  console.log('Email:', email)
  
  try {
    // Create the user
    const { data: user, error: createError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true // Auto-confirm email
    })
    
    if (createError) {
      console.error('❌ Failed to create user:', createError.message)
      process.exit(1)
    }
    
    console.log('✅ User created successfully!')
    console.log('User ID:', user.user.id)
    console.log('Email:', user.user.email)
    console.log('\n📧 Login credentials:')
    console.log('   Email:', email)
    console.log('   Password:', password)
    console.log('\n⚠️  Make sure to change the password after first login!')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

createUser()
