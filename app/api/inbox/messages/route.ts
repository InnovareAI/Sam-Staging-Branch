import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

// MCP Tools for message fetching (MCP-first approach)
declare const mcp__unipile__unipile_get_accounts: () => Promise<any[]>
declare const mcp__unipile__unipile_get_recent_messages: (params: {
  account_id: string
  batch_size?: number
}) => Promise<any[]>
declare const mcp__unipile__unipile_get_emails: (params: {
  account_id: string
  limit?: number
}) => Promise<any[]>

export async function GET(request: NextRequest) {
  try {
    const supabase = pool
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const allMessages: any[] = []

    // Get pagination parameters from query string
    const { searchParams } = new URL(request.url)
    const batchSize = parseInt(searchParams.get('batch_size') || '50') // Increased default
    const loadMore = searchParams.get('load_more') === 'true'

    // 1. Get LinkedIn messages using MCP Unipile (MCP-first approach)
    try {
      console.log('📨 Loading LinkedIn messages via MCP Unipile...')
      
      // First, get accounts using MCP
      const accounts = await mcp__unipile__unipile_get_accounts()
      
      if (accounts && accounts.length > 0) {
        // Get messages for each account using larger batch size
        for (const account of accounts) {
          if (account.sources && account.sources.length > 0) {
            const sourceId = account.sources[0].id // Use first source ID
            
            const mcpMessages = await mcp__unipile__unipile_get_recent_messages({
              account_id: sourceId,
              batch_size: batchSize
            })
            
            if (mcpMessages && Array.isArray(mcpMessages)) {
              const transformedMessages = mcpMessages.map((msg: any) => ({
                id: msg.id || `msg_${Date.now()}_${Math.random()}`,
                type: 'linkedin',
                subject: msg.subject || extractSubjectFromText(msg.text) || 'LinkedIn Message',
                from: extractSenderName(msg) || 'Unknown Sender',
                company: msg.chat_info?.name || 'Unknown Company',
                time: formatMessageTime(msg.timestamp),
                details: msg.text || 'No content available',
                source: 'linkedin',
                platform: 'unipile',
                accountName: account.name,
                rawMessage: msg
              }))
              
              allMessages.push(...transformedMessages)
              console.log(`✅ MCP loaded ${transformedMessages.length} LinkedIn messages for ${account.name}`)
            }
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to load LinkedIn messages via MCP:', error)
      
      // Fallback to existing contact-center endpoint if MCP fails
      try {
        const linkedinResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/contact-center/messages`, {
          headers: {
            'Cookie': request.headers.get('cookie') || ''
          }
        })
        
        if (linkedinResponse.ok) {
          const linkedinData = await linkedinResponse.json()
          if (linkedinData.success && linkedinData.messages) {
            allMessages.push(...linkedinData.messages.map((msg: any) => ({
              ...msg,
              source: 'linkedin',
              platform: 'unipile'
            })))
            console.log(`✅ Fallback loaded ${linkedinData.messages.length} LinkedIn messages`)
          }
        }
      } catch (fallbackError) {
        console.warn('⚠️ Fallback LinkedIn loading also failed:', fallbackError)
      }
    }

    // 2. Get Email messages from email providers
    try {
      console.log('📧 Loading email messages from providers...')
      
      // Get user's connected email providers
      const { data: emailProviders } = await supabase
        .from('email_providers')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'connected')

      if (emailProviders && emailProviders.length > 0) {
        // Get email messages from database
        const { data: emailMessages } = await supabase
          .from('email_messages')
          .select('*')
          .eq('user_id', user.id)
          .order('message_date', { ascending: false })
          .limit(50)

        if (emailMessages && emailMessages.length > 0) {
          const transformedEmailMessages = emailMessages.map(msg => {
            const provider = emailProviders.find(p => p.id === msg.provider_id)
            return {
              id: msg.id,
              type: provider?.provider_type === 'google' ? 'gmail' : 
                    provider?.provider_type === 'microsoft' ? 'outlook' : 'email',
              subject: msg.subject || 'No Subject',
              from: msg.from_name || msg.from_address,
              time: formatMessageTime(msg.message_date),
              company: extractCompany(msg.from_address, msg.from_name),
              details: msg.body_text || 'No preview available',
              platform: 'email',
              source: 'email',
              email_address: msg.from_address,
              provider_type: provider?.provider_type,
              is_read: msg.is_read,
              has_attachments: msg.has_attachments
            }
          })
          
          allMessages.push(...transformedEmailMessages)
          console.log(`✅ Loaded ${emailMessages.length} email messages`)
        }
        
        // 2.2. Try MCP Unipile for email accounts as well (MCP-first approach)
        try {
          console.log('📧 Attempting MCP Unipile email loading...')
          const accounts = await mcp__unipile__unipile_get_accounts()
          
          if (accounts && accounts.length > 0) {
            for (const account of accounts) {
              if (account.sources && account.sources.length > 0) {
                const sourceId = account.sources[0].id
                
                const mcpEmails = await mcp__unipile__unipile_get_emails({
                  account_id: sourceId,
                  limit: batchSize
                })
                
                if (mcpEmails && Array.isArray(mcpEmails)) {
                  const transformedMcpEmails = mcpEmails.map((email: any) => ({
                    id: `mcp_email_${email.id || Date.now()}`,
                    type: 'email',
                    subject: email.subject || 'No Subject',
                    from: email.from || 'Unknown Sender',
                    time: formatMessageTime(email.timestamp || email.date),
                    company: extractCompany(email.from || '', ''),
                    details: email.content || email.text || 'No preview available',
                    platform: 'email',
                    source: 'email',
                    email_address: email.from || '',
                    provider_type: 'mcp_unipile',
                    is_read: email.read || false,
                    has_attachments: !!email.attachments
                  }))
                  
                  allMessages.push(...transformedMcpEmails)
                  console.log(`✅ MCP loaded ${transformedMcpEmails.length} email messages for ${account.name}`)
                }
              }
            }
          }
        } catch (mcpEmailError) {
          console.warn('⚠️ MCP email loading failed (this is expected if no email accounts in Unipile):', mcpEmailError)
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to load email messages:', error)
    }

    // 3. Sort all messages by time (most recent first)
    allMessages.sort((a, b) => {
      const timeA = parseTimeString(a.time)
      const timeB = parseTimeString(b.time)
      return timeB - timeA
    })

    console.log(`📊 Total unified messages loaded: ${allMessages.length}`)

    const requestedLimit = parseInt(searchParams.get('limit') || '50')

    return NextResponse.json({
      success: true,
      messages: allMessages.slice(0, requestedLimit),
      summary: {
        total: allMessages.length,
        linkedin: allMessages.filter(m => m.source === 'linkedin').length,
        email: allMessages.filter(m => m.source === 'email').length,
        unread: allMessages.filter(m => m.status === 'new' || !m.is_read).length,
        displayed: Math.min(allMessages.length, requestedLimit)
      },
      pagination: {
        has_more: allMessages.length > requestedLimit,
        current_batch_size: batchSize,
        next_batch_suggestion: batchSize < 100 ? batchSize * 2 : batchSize,
        load_more_url: allMessages.length > requestedLimit ? 
          `${request.url.split('?')[0]}?batch_size=${batchSize * 2}&limit=${requestedLimit + 50}` : null
      },
      sync_info: {
        method: 'mcp_first_with_fallback',
        sources: ['mcp_unipile_linkedin', 'database_email', 'mcp_unipile_email'],
        last_sync: new Date().toISOString(),
        suggested_sync_interval: '5m' // 5 minutes for frequent updates
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Failed to load unified messages:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper functions
function formatMessageTime(dateString: string): string {
  if (!dateString) return 'recently'
  
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  return `${diffDays}d`
}

function extractCompany(fromAddress: string, fromName?: string): string {
  if (fromName && fromName !== fromAddress) {
    // Try to extract company from name
    const words = fromName.split(' ')
    if (words.length > 2) {
      return words.slice(-1)[0] // Assume last word might be company
    }
  }
  
  // Extract from email domain
  if (fromAddress && fromAddress.includes('@')) {
    const domain = fromAddress.split('@')[1]
    if (domain) {
      const company = domain.split('.')[0]
      return company.charAt(0).toUpperCase() + company.slice(1)
    }
  }
  
  return 'Unknown'
}

function parseTimeString(timeStr: string): number {
  if (timeStr === 'now') return Date.now()
  if (timeStr === 'recently') return Date.now() - 60000 // 1 minute ago
  
  const match = timeStr.match(/^(\d+)([mhd])$/)
  if (match) {
    const value = parseInt(match[1])
    const unit = match[2]
    const now = Date.now()
    
    switch (unit) {
      case 'm': return now - (value * 60 * 1000)
      case 'h': return now - (value * 60 * 60 * 1000)
      case 'd': return now - (value * 24 * 60 * 60 * 1000)
    }
  }
  
  // Try to parse as ISO date
  try {
    return new Date(timeStr).getTime()
  } catch {
    return Date.now() - 3600000 // Default to 1 hour ago
  }
}

function extractSubjectFromText(text: string): string | null {
  if (!text) return null
  // Extract first 50 characters as subject
  return text.substring(0, 50) + (text.length > 50 ? '...' : '')
}

function extractSenderName(msg: any): string | null {
  return msg.sender?.name || msg.from?.name || msg.user_name || null
}