import { createClient } from '@supabase/supabase-js'

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// MCP Tool simulation (using your accounts from the MCP call)
const unipileAccounts = [
  {
    id: "3Zj8ks8aSrKg0ySaLQo_8A",
    name: "Irish Cita De Ade",
    type: "LINKEDIN",
    connection_params: {
      im: {
        id: "ACoAACjdh2IBb8lp_tUbzduKedE22yVTTpMgLEQ",
        username: "Irish Cita De Ade"
      }
    }
  },
  {
    id: "MlV8PYD1SXG783XbJRraLQ",
    name: "Martin Schechtner", 
    type: "LINKEDIN",
    connection_params: {
      im: {
        id: "ACoAADybg7kB-uGKroJMeNyYbOuksdQuDW5G8Y4",
        publicIdentifier: "martin-schechtner-309648244",
        username: "Martin Schechtner"
      }
    }
  },
  {
    id: "NLsTJRfCSg-WZAXCBo8w7A",
    name: "Thorsten Linz",
    type: "LINKEDIN", 
    connection_params: {
      im: {
        id: "ACoAAACYv0MB5sgfg5P09EbKyGzp2OH-qwKEmgc",
        publicIdentifier: "tvonlinz",
        username: "Thorsten Linz"
      }
    }
  },
  {
    id: "eCvuVstGTfCedKsrzAKvZA",
    name: "Peter Noble",
    type: "LINKEDIN",
    connection_params: {
      im: {
        id: "ACoAAAA7dAABoF3a6Ax3Pj0Gjc6OKdL9y6s7EaY",
        username: "Peter Noble"
      }
    }
  },
  {
    id: "he3RXnROSLuhONxgNle7dw",
    name: "𝐂𝐡𝐚𝐫𝐢𝐬𝐬𝐚 𝐂𝐚𝐧𝐢𝐞𝐥",
    type: "LINKEDIN",
    connection_params: {
      im: {
        id: "ACoAADop-UABEUd5Sn_XycUyk52X73muKIaW4cc",
        publicIdentifier: "𝐂𝐡𝐚𝐫𝐢𝐬𝐬𝐚-𝐂𝐚𝐧𝐢𝐞𝐥-054978232",
        username: "𝐂𝐡𝐚𝐫𝐢𝐬𝐬𝐚 𝐂𝐚𝐧𝐢𝐞𝐥"
      }
    }
  },
  {
    id: "osKDIRFtTtqzmfULiWGTEg",
    name: "Noriko Yokoi, Ph.D.",
    type: "LINKEDIN",
    connection_params: {
      im: {
        id: "ACoAAAAwOXwBT9Jh0v-mzkm9PcmW1iShDrHCk0I", 
        publicIdentifier: "noriko-yokoi",
        username: "Noriko Yokoi, Ph.D."
      }
    }
  }
]

async function fixLinkedInAssociation() {
  try {
    console.log('🔍 Finding user by email: thorsten.linz@gmail.com')
    
    // Find your user
    const { data: user, error: userError } = await supabase.auth.admin.listUsers()
    if (userError) throw userError
    
    const targetUser = user.users.find(u => 
      u.email?.toLowerCase() === 'thorsten.linz@gmail.com' ||
      u.email?.toLowerCase() === 'tl@innovareai.com'
    )
    
    if (!targetUser) {
      console.error('❌ User not found')
      return
    }
    
    console.log(`✅ Found user: ${targetUser.email} (${targetUser.id})`)
    
    // Check existing associations
    const { data: existing } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', targetUser.id)
    
    console.log(`📊 Existing associations: ${existing?.length || 0}`)
    
    // Associate all LinkedIn accounts with your user
    for (const account of unipileAccounts) {
      console.log(`🔗 Associating ${account.name} (${account.id})`)
      
      const connectionParams = account.connection_params?.im || {}
      
      const { data, error } = await supabase
        .from('user_unipile_accounts')
        .upsert({
          user_id: targetUser.id,
          unipile_account_id: account.id,
          platform: 'LINKEDIN',
          account_name: account.name,
          account_email: connectionParams.username || connectionParams.email,
          linkedin_public_identifier: connectionParams.publicIdentifier,
          linkedin_profile_url: connectionParams.publicIdentifier ? 
            `https://www.linkedin.com/in/${connectionParams.publicIdentifier}` : null,
          connection_status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'unipile_account_id'
        })
        .select()
      
      if (error) {
        console.error(`❌ Failed to associate ${account.name}:`, error)
      } else {
        console.log(`✅ Associated ${account.name}`)
      }
    }
    
    // Verify associations
    const { data: finalAssociations } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', targetUser.id)
      .eq('platform', 'LINKEDIN')
    
    console.log(`🎉 Final LinkedIn associations: ${finalAssociations?.length || 0}`)
    finalAssociations?.forEach(assoc => {
      console.log(`  - ${assoc.account_name} (${assoc.unipile_account_id})`)
    })
    
  } catch (error) {
    console.error('❌ Error fixing LinkedIn association:', error)
  }
}

fixLinkedInAssociation()