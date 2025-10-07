const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function checkEmails() {
  const { data, error } = await supabase
    .from('email_responses')
    .select('id, from_email, to_email, subject, text_body, received_at')
    .order('received_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('\n📧 Recent Email Responses:\n')
  if (data.length === 0) {
    console.log('No emails found in database yet.')
  } else {
    data.forEach((email, i) => {
      console.log(`${i + 1}. From: ${email.from_email}`)
      console.log(`   To: ${email.to_email}`)
      console.log(`   Subject: ${email.subject}`)
      console.log(`   Preview: ${email.text_body?.substring(0, 100)}...`)
      console.log(`   Received: ${new Date(email.received_at).toLocaleString()}`)
      console.log(`   ID: ${email.id}\n`)
    })
  }
}

checkEmails()
