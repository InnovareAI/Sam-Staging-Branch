/**
 * Threaded Chat Interface for SAM AI
 * 
 * Main chat interface with threaded conversations, tagging, and filtering
 */

'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  Send, 
  Paperclip, 
  Hash, 
  Calendar,
  Filter,
  Clock,
  ArrowUpFromLine
} from 'lucide-react'
import ThreadSidebar from './ThreadSidebar'
import TagFilterPanel from './TagFilterPanel'
import DataApprovalPanel from './DataApprovalPanel'
import { LinkedInLimitsInfobox } from './LinkedInLimitsInfobox'
import { SamConversationThread, useSamThreadedChat } from '@/lib/hooks/useSamThreadedChat'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  has_prospect_intelligence?: boolean
  prospect_intelligence_data?: any
}

export default function ThreadedChatInterface() {
  const {
    threads,
    loadThreads,
    sendMessage,
    isLoading
  } = useSamThreadedChat()

  const [currentThread, setCurrentThread] = useState<SamConversationThread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [showTagFilter, setShowTagFilter] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showDataApproval, setShowDataApproval] = useState(false)
  const [pendingProspectData, setPendingProspectData] = useState<any[]>([])
  const [showMemorySnapshots, setShowMemorySnapshots] = useState(false)
  const [memorySnapshots, setMemorySnapshots] = useState<any[]>([])
  const [isLoadingMemory, setIsLoadingMemory] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load threads on mount
  useEffect(() => {
    loadThreads()
  }, [loadThreads])

  // Load messages when thread changes
  useEffect(() => {
    if (currentThread) {
      loadThreadMessages(currentThread.id)
    } else {
      setMessages([])
    }
  }, [currentThread])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages, isSending])

  const loadThreadMessages = async (threadId: string) => {
    setIsLoadingMessages(true)
    try {
      const response = await fetch(`/api/sam/threads/${threadId}/messages`)
      if (!response.ok) {
        throw new Error('Failed to load thread messages')
      }
      
      const data = await response.json()
      setMessages(data.messages || [])
    } catch (error) {
      console.error('Failed to load messages:', error)
      setMessages([])
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Load memory snapshots
  const loadMemorySnapshots = async () => {
    setIsLoadingMemory(true)
    try {
      const response = await fetch('/api/sam/memory?action=snapshots')
      if (!response.ok) {
        throw new Error('Failed to load memory snapshots')
      }
      
      const data = await response.json()
      setMemorySnapshots(data.snapshots || [])
    } catch (error) {
      console.error('Failed to load memory snapshots:', error)
      setMemorySnapshots([])
    } finally {
      setIsLoadingMemory(false)
    }
  }

  // Restore memory snapshot
  const restoreMemorySnapshot = async (snapshotId: string) => {
    setIsLoadingMemory(true)
    try {
      const response = await fetch('/api/sam/memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'restore_snapshot',
          snapshot_id: snapshotId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to restore memory snapshot')
      }

      const data = await response.json()
      
      if (data.success) {
        // Reload threads to show restored conversations
        await loadThreads()
        setShowMemorySnapshots(false)
        
        // Add system message to current thread about memory restoration
        if (currentThread) {
          const systemMessage = {
            id: `system-${Date.now()}`,
            role: 'assistant' as const,
            content: `✅ **Memory Restored Successfully**\n\nI've restored my memory from ${new Date(data.snapshot_date || Date.now()).toLocaleDateString()}. I now have access to ${data.conversations?.length || 0} previous conversations and can continue our work with full context.\n\n*Previous conversation history has been restored to help maintain continuity.*`,
            created_at: new Date().toISOString(),
          }
          setMessages(prev => [...prev, systemMessage])
        }
      }
    } catch (error) {
      console.error('Failed to restore memory:', error)
      // Add error message
      if (currentThread) {
        const errorMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant' as const,
          content: `❌ **Memory Restore Failed**\n\nSorry, I couldn't restore the memory snapshot. Please try again or contact support if the issue persists.`,
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } finally {
      setIsLoadingMemory(false)
    }
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !currentThread || isSending) return

    const trimmedInput = inputMessage.trim()

    // Check for template library save commands
    if (await handleTemplateLibraryCommands(trimmedInput)) {
      setInputMessage('')
      return
    }

    // Check for Unipile commands before sending
    if (await handleUnipileCommands(trimmedInput)) {
      setInputMessage('')
      return
    }

    setIsSending(true)
    try {
      const response = await sendMessage(currentThread.id, trimmedInput)
      if (response.success) {
        // Add both user and assistant messages to the local state
        const newMessages = [
          ...messages,
          response.userMessage,
          response.samMessage
        ]
        setMessages(newMessages)
        setInputMessage('')
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleTemplateLibraryCommands = async (input: string): Promise<boolean> => {
    const command = input.toLowerCase()

    // Template library save commands
    if (command.includes('save') && (command.includes('template') || command.includes('library')) ||
        command.includes('yes, save') ||
        command.includes('save to library') ||
        command.includes('save them')) {
      await executeTemplateLibrarySave(input)
      return true
    }

    // Template library list/search commands
    if (command.includes('show templates') ||
        command.includes('list templates') ||
        command.includes('my templates') ||
        command.startsWith('/templates')) {
      await executeTemplateLibraryList(input)
      return true
    }

    return false
  }

  const executeTemplateLibrarySave = async (input: string) => {
    if (!currentThread) return

    setIsSending(true)
    try {
      // Find the most recent message with template data
      const recentTemplateMessage = messages
        .slice()
        .reverse()
        .find(msg => msg.has_prospect_intelligence && msg.prospect_intelligence_data?.templates)

      if (!recentTemplateMessage?.prospect_intelligence_data?.templates) {
        const errorMessage = {
          id: `temp-${Date.now()}-error`,
          role: 'assistant' as const,
          content: `I don't see any recent templates to save. Please create or paste templates first, then ask me to save them.`,
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, errorMessage])
        return
      }

      const templates = recentTemplateMessage.prospect_intelligence_data.templates
      let savedCount = 0

      // Save each template to the library
      for (const template of templates) {
        try {
          const response = await fetch('/api/sam/template-library', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'create',
              template: {
                name: `${template.type.replace('_', ' ')} - ${new Date().toLocaleDateString()}`,
                type: template.type,
                content: template.content,
                variables: template.variables,
                industry: currentThread.prospect_company || 'General',
                campaign_type: currentThread.sales_methodology || 'General',
                target_audience: currentThread.prospect_name || 'General',
                tags: ['sam-created', 'auto-parsed']
              }
            })
          })

          if (response.ok) {
            savedCount++
          }
        } catch (error) {
          console.error('Failed to save template:', error)
        }
      }

      // Create success message
      const successMessage = {
        id: `temp-${Date.now()}-success`,
        role: 'assistant' as const,
        content: `✅ **Templates Saved Successfully!**\n\nSaved ${savedCount} of ${templates.length} templates to your library.\n\n**What's Next:**\n• Access them in Campaign Hub → Templates\n• Use them in new campaigns\n• Edit and optimize based on performance\n• Share with your team\n\n**Template Library Commands:**\n• "Show my templates" - View all saved templates\n• "List sales templates" - Filter by type\n• "Search templates for [industry]" - Find specific templates\n\nYour templates are now ready to use across all campaigns! 🚀`,
        created_at: new Date().toISOString(),
        has_prospect_intelligence: true,
      }

      setMessages(prev => [...prev, successMessage])

      // Update thread tags
      await updateThreadContext({
        tags: [...(currentThread.tags || []), 'template-saved', 'library-updated'],
      })

    } catch (error) {
      console.error('Template library save failed:', error)
    } finally {
      setIsSending(false)
    }
  }

  const executeTemplateLibraryList = async (input: string) => {
    if (!currentThread) return

    setIsSending(true)
    try {
      // Parse search parameters from input
      const searchParams: any = {}
      
      if (input.includes('sales')) searchParams.campaign_type = 'sales'
      if (input.includes('recruitment')) searchParams.campaign_type = 'recruitment'
      if (input.includes('connection')) searchParams.type = 'connection_request'
      if (input.includes('follow')) searchParams.type = 'follow_up_1'

      const response = await fetch('/api/sam/template-library', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      const result = await response.json()
      
      if (result.success) {
        let libraryResponse = `📚 **Your Template Library**\n\n`
        
        if (result.templates.length === 0) {
          libraryResponse += `No templates found in your library yet.\n\n**Getting Started:**\n• Paste message templates and I'll parse them\n• Use existing templates from campaigns\n• Import templates from CSV files\n\nWould you like me to help you create your first template?`
        } else {
          libraryResponse += `Found **${result.templates.length}** templates:\n\n`
          
          // Group by type
          Object.entries(result.grouped_templates).forEach(([type, templates]: [string, any]) => {
            const typeLabel = type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
            libraryResponse += `**${typeLabel}** (${templates.length}):\n`
            
            templates.slice(0, 3).forEach((template: any, index: number) => {
              libraryResponse += `${index + 1}. ${template.name} (${template.content.length} chars)\n`
              if (template.usage_count > 0) {
                libraryResponse += `   📊 Used ${template.usage_count} times\n`
              }
            })
            
            if (templates.length > 3) {
              libraryResponse += `   ... and ${templates.length - 3} more\n`
            }
            libraryResponse += `\n`
          })

          libraryResponse += `**Commands:**\n• "Use template [name]" - Apply to current campaign\n• "Edit template [name]" - Modify template\n• "Delete template [name]" - Remove from library\n• "Show template performance" - View analytics`
        }

        const libraryMessage = {
          id: `temp-${Date.now()}-library`,
          role: 'assistant' as const,
          content: libraryResponse,
          created_at: new Date().toISOString(),
          has_prospect_intelligence: true,
          prospect_intelligence_data: {
            library_data: result
          }
        }

        setMessages(prev => [...prev, libraryMessage])
      }
    } catch (error) {
      console.error('Template library list failed:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleUnipileCommands = async (input: string): Promise<boolean> => {
    const command = input.toLowerCase()

    // Template Creation Commands
    if (command.startsWith('/template') || 
        command.includes('create template') || 
        command.includes('parse template') ||
        command.includes('message template') ||
        command.includes('template sequence') ||
        detectTemplateInput(input)) {
      await executeTemplateCreation(input)
      return true
    }

    // ICP Research Commands
    if (command.startsWith('/icp') || command.includes('research icp') || command.includes('ideal customer profile')) {
      await executeICPResearch(input)
      return true
    }

    // Company Intelligence Commands
    if (command.startsWith('/company') || command.includes('analyze company') || command.includes('company intelligence')) {
      await executeCompanyIntelligence(input)
      return true
    }

    // Prospect Search Commands
    if (command.startsWith('/search') || command.includes('search prospects') || command.includes('find prospects')) {
      await executeProspectSearch(input)
      return true
    }

    // LinkedIn Automation Commands
    if (command.startsWith('/linkedin') || command.includes('linkedin automation')) {
      await executeLinkedInAutomation(input)
      return true
    }

    // Campaign Management Commands
    if (command.startsWith('/campaign') || 
        command.includes('create campaign') || 
        command.includes('new campaign') ||
        command.includes('launch campaign') ||
        command.includes('add prospects') ||
        command.includes('upload prospects') ||
        command.includes('review message') ||
        command.includes('campaign status') ||
        command.includes('my campaigns')) {
      await executeCampaignManagement(input)
      return true
    }

    return false
  }

  const executeICPResearch = async (input: string) => {
    if (!currentThread) return

    setIsSending(true)
    try {
      // Parse ICP parameters from input
      const icpData = parseICPParameters(input)
      
      // Call prospect intelligence API with ICP research
      const response = await fetch('/api/sam/prospect-intelligence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'icp_research_search',
          data: icpData,
          methodology: currentThread.sales_methodology,
          urgency: 'medium',
          budget: 100,
          conversationId: currentThread.id
        })
      })

      const result = await response.json()
      
      if (result.success) {
        // Create user message for the command
        const userMessage = {
          id: `temp-${Date.now()}-user`,
          role: 'user' as const,
          content: input,
          created_at: new Date().toISOString(),
        }

        // Create assistant response with ICP data
        const assistantMessage = {
          id: `temp-${Date.now()}-assistant`,
          role: 'assistant' as const,
          content: formatICPResponse(result.data),
          created_at: new Date().toISOString(),
          has_prospect_intelligence: true,
          prospect_intelligence_data: result
        }

        setMessages(prev => [...prev, userMessage, assistantMessage])
        
        // Update thread with ICP research context
        if (result.data.industry) {
          await updateThreadContext({
            tags: [...(currentThread.tags || []), 'icp-research', result.data.industry.toLowerCase()],
            thread_type: 'linkedin_research'
          })
        }
      }
    } catch (error) {
      console.error('ICP research failed:', error)
    } finally {
      setIsSending(false)
    }
  }

  const executeCompanyIntelligence = async (input: string) => {
    if (!currentThread) return

    setIsSending(true)
    try {
      const companyName = extractCompanyName(input)
      
      const response = await fetch('/api/sam/prospect-intelligence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'company_intelligence_search',
          data: {
            companyName,
            searchType: 'overview',
            maxResults: 10
          },
          methodology: currentThread.sales_methodology,
          conversationId: currentThread.id
        })
      })

      const result = await response.json()
      
      if (result.success) {
        const userMessage = {
          id: `temp-${Date.now()}-user`,
          role: 'user' as const,
          content: input,
          created_at: new Date().toISOString(),
        }

        const assistantMessage = {
          id: `temp-${Date.now()}-assistant`,
          role: 'assistant' as const,
          content: formatCompanyResponse(result.data, companyName),
          created_at: new Date().toISOString(),
          has_prospect_intelligence: true,
          prospect_intelligence_data: result
        }

        setMessages(prev => [...prev, userMessage, assistantMessage])
      }
    } catch (error) {
      console.error('Company intelligence failed:', error)
    } finally {
      setIsSending(false)
    }
  }

  const executeProspectSearch = async (input: string) => {
    if (!currentThread) return

    setIsSending(true)
    try {
      const searchCriteria = parseSearchCriteria(input)
      
      const response = await fetch('/api/sam/prospect-intelligence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'prospect_search',
          data: {
            searchCriteria,
            maxResults: 20
          },
          methodology: currentThread.sales_methodology,
          urgency: 'medium',
          budget: 150,
          conversationId: currentThread.id
        })
      })

      const result = await response.json()
      
      if (result.success && result.data.prospects) {
        // Store prospect data for approval
        const transformedProspects = result.data.prospects.map((prospect: any, index: number) => ({
          id: `prospect-${Date.now()}-${index}`,
          name: prospect.name || 'Unknown',
          title: prospect.title || 'Unknown',
          company: prospect.company || 'Unknown',
          email: prospect.email,
          phone: prospect.phone,
          linkedinUrl: prospect.linkedinUrl,
          source: result.metadata?.source || 'unipile',
          confidence: prospect.confidence || result.metadata?.confidence || 0.8,
          complianceFlags: prospect.complianceFlags || []
        }))

        setPendingProspectData(transformedProspects)
        
        const userMessage = {
          id: `temp-${Date.now()}-user`,
          role: 'user' as const,
          content: input,
          created_at: new Date().toISOString(),
        }

        const assistantMessage = {
          id: `temp-${Date.now()}-assistant`,
          role: 'assistant' as const,
          content: `Found ${transformedProspects.length} prospects matching your search criteria. Click "Review & Approve Data" below to examine the results and approve the data you want to use.`,
          created_at: new Date().toISOString(),
          has_prospect_intelligence: true,
          prospect_intelligence_data: result
        }

        setMessages(prev => [...prev, userMessage, assistantMessage])
        setShowDataApproval(true)
      }
    } catch (error) {
      console.error('Prospect search failed:', error)
    } finally {
      setIsSending(false)
    }
  }

  const executeTemplateCreation = async (input: string) => {
    if (!currentThread) return

    setIsSending(true)
    try {
      // Call template parsing API
      const response = await fetch('/api/sam/parse-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_input: input,
          conversation_context: {
            thread_id: currentThread.id,
            campaign_type: currentThread.sales_methodology,
            target_audience: currentThread.prospect_name || currentThread.prospect_company
          },
          parse_options: {
            auto_optimize: true,
            suggest_improvements: true,
            include_performance_data: true
          }
        })
      })

      const result = await response.json()
      
      if (result.success) {
        // Create user message
        const userMessage = {
          id: `temp-${Date.now()}-user`,
          role: 'user' as const,
          content: input,
          created_at: new Date().toISOString(),
        }

        // Create assistant response with parsed templates
        const assistantMessage = {
          id: `temp-${Date.now()}-assistant`,
          role: 'assistant' as const,
          content: result.sam_response,
          created_at: new Date().toISOString(),
          has_prospect_intelligence: true,
          prospect_intelligence_data: {
            templates: result.parsed_templates,
            template_sequence: result.template_sequence,
            suggestions: result.suggestions
          }
        }

        setMessages(prev => [...prev, userMessage, assistantMessage])
        
        // Update thread with template creation context
        await updateThreadContext({
          tags: [...(currentThread.tags || []), 'template-creation', 'messaging'],
          thread_type: 'template_builder'
        })

        // Optionally save templates to library
        if (result.parsed_templates.length > 0) {
          await promptTemplateLibrarySave(result.parsed_templates)
        }
      }
    } catch (error) {
      console.error('Template creation failed:', error)
    } finally {
      setIsSending(false)
    }
  }

  const detectTemplateInput = (input: string): boolean => {
    // Detect if user is pasting template content based on patterns
    const indicators = [
      /Hi \{[^}]+\}/, // Template variables like {first_name}
      /Message \d+:/i, // Message 1: Message 2:
      /Follow[-\s]?up/i, // Follow-up patterns
      /Connection request/i,
      /---+/, // Separator lines
      input.length > 200 && input.includes('\n'), // Multi-line content
      /Dear|Hi|Hello.*,.*\n/i // Email/message pattern
    ]

    return indicators.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(input)
      }
      return pattern
    })
  }

  const promptTemplateLibrarySave = async (templates: any[]) => {
    if (!currentThread) return

    // Create a follow-up message offering to save templates
    const savePromptMessage = {
      id: `temp-${Date.now()}-save-prompt`,
      role: 'assistant' as const,
      content: `💾 **Save to Template Library?**\n\nI can save these ${templates.length} template${templates.length > 1 ? 's' : ''} to your library for future use. This will make them available across all your campaigns.\n\n**Benefits:**\n• Quick access in Campaign Hub\n• Performance tracking over time\n• A/B testing variations\n• Team sharing (if applicable)\n\nWould you like me to save these templates? Just say "Yes, save them" or "Save to library".`,
      created_at: new Date().toISOString(),
      has_prospect_intelligence: true,
    }

    // Add after a short delay for better UX
    setTimeout(() => {
      setMessages(prev => [...prev, savePromptMessage])
    }, 1500)
  }

  const executeLinkedInAutomation = async (input: string) => {
    if (!currentThread) return

    setIsSending(true)
    try {
      // Show automation capabilities and current account status
      const userMessage = {
        id: `temp-${Date.now()}-user`,
        role: 'user' as const,
        content: input,
        created_at: new Date().toISOString(),
      }

      const assistantMessage = {
        id: `temp-${Date.now()}-assistant`,
        role: 'assistant' as const,
        content: formatLinkedInAutomationResponse(),
        created_at: new Date().toISOString(),
        has_prospect_intelligence: true,
      }

      setMessages(prev => [...prev, userMessage, assistantMessage])
    } catch (error) {
      console.error('LinkedIn automation command failed:', error)
    } finally {
      setIsSending(false)
    }
  }

  const executeCampaignManagement = async (input: string) => {
    if (!currentThread) return

    setIsSending(true)
    try {
      const userMessage = {
        id: `temp-${Date.now()}-user`,
        role: 'user' as const,
        content: input,
        created_at: new Date().toISOString(),
      }

      // Determine campaign action based on input
      const action = determineCampaignAction(input)
      const campaignData = parseCampaignData(input)

      // Call the campaign manager API
      const response = await fetch('/api/sam/campaign-manager', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          ...campaignData
        })
      })

      if (!response.ok) {
        throw new Error('Campaign management failed')
      }

      const result = await response.json()

      const assistantMessage = {
        id: `temp-${Date.now()}-assistant`,
        role: 'assistant' as const,
        content: result.message,
        created_at: new Date().toISOString(),
        has_prospect_intelligence: true,
        prospect_intelligence_data: {
          campaign_action: action,
          campaign_data: result.data,
          suggested_actions: result.suggested_actions,
          next_steps: result.next_steps
        }
      }

      setMessages(prev => [...prev, userMessage, assistantMessage])

      // Update thread context if campaign was created
      if (action === 'create_campaign' && result.success && result.data?.campaign_id) {
        await updateThreadContext({
          campaign_id: result.data.campaign_id,
          campaign_name: result.data.campaign?.name
        })
      }

    } catch (error) {
      console.error('Campaign management failed:', error)
      const errorMessage = {
        id: `temp-${Date.now()}-error`,
        role: 'assistant' as const,
        content: `Sorry, I encountered an error with campaign management: ${error.message}. Please try again or contact support if the issue persists.`,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsSending(false)
    }
  }

  const updateThreadContext = async (updates: Partial<SamConversationThread>) => {
    if (!currentThread) return

    try {
      const response = await fetch(`/api/sam/threads/${currentThread.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentThread(data.thread)
      }
    } catch (error) {
      console.error('Failed to update thread context:', error)
    }
  }

  const handleDataApproval = async (approvedData: any[]) => {
    if (!currentThread) return

    try {
      // Store approved data in database
      const response = await fetch('/api/sam/approved-prospects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threadId: currentThread.id,
          prospects: approvedData
        })
      })

      if (response.ok) {
        // Create success message
        const successMessage = {
          id: `temp-${Date.now()}-approval`,
          role: 'assistant' as const,
          content: `✅ Successfully approved ${approvedData.length} prospects. The data has been saved to your prospect database and is ready for outreach campaigns.

**Next Steps:**
• Create personalized outreach sequences
• Set up LinkedIn automation workflows  
• Schedule follow-up activities
• Track engagement metrics

Would you like me to help you create an outreach strategy for these prospects?`,
          created_at: new Date().toISOString(),
          has_prospect_intelligence: true,
        }

        setMessages(prev => [...prev, successMessage])
        
        // Update thread with approved prospect count
        await updateThreadContext({
          tags: [...(currentThread.tags || []), 'approved-prospects'],
        })
      }
    } catch (error) {
      console.error('Failed to save approved data:', error)
      
      const errorMessage = {
        id: `temp-${Date.now()}-error`,
        role: 'assistant' as const,
        content: 'Sorry, there was an issue saving the approved prospect data. Please try again.',
        created_at: new Date().toISOString(),
      }
      
      setMessages(prev => [...prev, errorMessage])
    }

    setShowDataApproval(false)
    setPendingProspectData([])
  }

  const handleDataRejection = (rejectedData: any[]) => {
    const rejectedMessage = {
      id: `temp-${Date.now()}-rejection`,
      role: 'assistant' as const,
      content: `❌ Rejected ${rejectedData.length} prospects. The data has been discarded as requested. 

Would you like me to search for different prospects or refine the search criteria?`,
      created_at: new Date().toISOString(),
    }

    setMessages(prev => [...prev, rejectedMessage])
    setShowDataApproval(false)
    setPendingProspectData([])
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleThreadSelect = (thread: SamConversationThread) => {
    setCurrentThread(thread)
  }

  // Utility functions for parsing and formatting
  const parseICPParameters = (input: string) => {
    // Extract ICP parameters from natural language input
    const patterns = {
      industry: /industry[:\s]+([a-zA-Z0-9\s,]+?)(?:\s|$|,|\.)/i,
      jobTitles: /(?:job titles?|positions?|roles?)[:\s]+([a-zA-Z0-9\s,&-]+?)(?:\s|$|\.|;)/i,
      companySize: /(?:company size|size)[:\s]+([a-zA-Z0-9\s-]+?)(?:\s|$|,|\.)/i,
      geography: /(?:geography|location|region)[:\s]+([a-zA-Z0-9\s,]+?)(?:\s|$|,|\.)/i
    }

    const industry = input.match(patterns.industry)?.[1]?.trim() || 'Technology'
    const jobTitlesMatch = input.match(patterns.jobTitles)?.[1]?.trim()
    const jobTitles = jobTitlesMatch ? jobTitlesMatch.split(/[,&]/).map(t => t.trim()) : ['VP', 'Director', 'Manager']
    const companySize = input.match(patterns.companySize)?.[1]?.trim() || '100-1000'
    const geography = input.match(patterns.geography)?.[1]?.trim() || 'United States'

    return {
      industry,
      jobTitles,
      companySize,
      geography,
      maxResults: 15
    }
  }

  const extractCompanyName = (input: string): string => {
    // Try to extract company name from various patterns
    const patterns = [
      /(?:company|analyze)\s+([A-Za-z0-9\s&.,'-]+?)(?:\s|$|,|\.)/i,
      /^([A-Za-z0-9\s&.,'-]+)$/i
    ]

    for (const pattern of patterns) {
      const match = input.match(pattern)
      if (match) {
        return match[1].trim()
      }
    }

    return input.replace(/^\/company\s*/i, '').trim() || 'Unknown Company'
  }

  const parseSearchCriteria = (input: string) => {
    // Parse prospect search criteria from input
    return {
      keywords: input.replace(/^\/search\s*/i, '').replace(/search prospects?\s*/i, '').trim(),
      includeJobTitles: true,
      includeCompanyInfo: true,
      includeContactInfo: false // Privacy compliance
    }
  }

  const formatICPResponse = (data: any) => {
    if (!data) return "I couldn't find ICP research data for that query."

    let response = `# ICP Research Results\n\n`
    
    if (data.marketSize) {
      response += `**Market Size**: ${data.marketSize.totalProspects || 'Unknown'} potential prospects\n`
      response += `**Market Value**: ${data.marketSize.estimatedValue || 'Unknown'}\n\n`
    }

    if (data.topCompanies && data.topCompanies.length > 0) {
      response += `**Top Target Companies**:\n`
      data.topCompanies.slice(0, 5).forEach((company: any, i: number) => {
        response += `${i + 1}. ${company.name} (${company.size || 'Unknown size'})\n`
      })
      response += `\n`
    }

    if (data.keyInsights && data.keyInsights.length > 0) {
      response += `**Key Insights**:\n`
      data.keyInsights.forEach((insight: string, i: number) => {
        response += `• ${insight}\n`
      })
      response += `\n`
    }

    response += `This ICP research can help you target the right prospects and craft personalized outreach. Would you like me to search for specific prospects in this ICP?`

    return response
  }

  const formatCompanyResponse = (data: any, companyName: string) => {
    if (!data) return `I couldn't find intelligence data for ${companyName}.`

    let response = `# ${companyName} - Company Intelligence\n\n`
    
    if (data.overview) {
      response += `**Overview**: ${data.overview}\n\n`
    }

    if (data.keyMetrics) {
      response += `**Key Metrics**:\n`
      if (data.keyMetrics.revenue) response += `• Revenue: ${data.keyMetrics.revenue}\n`
      if (data.keyMetrics.employees) response += `• Employees: ${data.keyMetrics.employees}\n`
      if (data.keyMetrics.founded) response += `• Founded: ${data.keyMetrics.founded}\n`
      response += `\n`
    }

    if (data.recentNews && data.recentNews.length > 0) {
      response += `**Recent News**:\n`
      data.recentNews.slice(0, 3).forEach((news: any) => {
        response += `• ${news.title}\n`
      })
      response += `\n`
    }

    if (data.salesIntelligence) {
      response += `**Sales Intelligence**:\n`
      if (data.salesIntelligence.buyingSignals) {
        response += `• **Buying Signals**: ${data.salesIntelligence.buyingSignals.join(', ')}\n`
      }
      if (data.salesIntelligence.painPoints) {
        response += `• **Potential Pain Points**: ${data.salesIntelligence.painPoints.join(', ')}\n`
      }
    }

    return response
  }

  const formatProspectSearchResponse = (data: any) => {
    if (!data.prospects || data.prospects.length === 0) {
      return "No prospects found matching your search criteria. Try adjusting your search terms."
    }

    let response = `# Prospect Search Results\n\n`
    response += `Found **${data.prospects.length}** prospects matching your criteria:\n\n`
    
    data.prospects.slice(0, 10).forEach((prospect: any, i: number) => {
      response += `**${i + 1}. ${prospect.name || 'Unknown'}**\n`
      if (prospect.title) response += `• Title: ${prospect.title}\n`
      if (prospect.company) response += `• Company: ${prospect.company}\n`
      if (prospect.location) response += `• Location: ${prospect.location}\n`
      if (prospect.linkedinUrl) response += `• LinkedIn: [View Profile](${prospect.linkedinUrl})\n`
      response += `\n`
    })

    if (data.prospects.length > 10) {
      response += `... and ${data.prospects.length - 10} more prospects.\n\n`
    }

    response += `Would you like me to research any of these prospects in detail or help you create outreach strategies?`

    return response
  }

  const formatLinkedInAutomationResponse = () => {
    return `# LinkedIn Automation Status

**Available Automation Systems:**
• Profile Visitor Intelligence - Automated profile visits with follow-up
• Company Follower Automation - Strategic company page engagement
• Post Engagement Intelligence - AI-powered post interactions
• AI Commenting Agent - Contextual comment generation
• Conversation Intelligence - Message analysis and response automation

**Current Integration Status:**
✅ Unipile API Connected (7 LinkedIn accounts available)
✅ AI Comment Generation Ready
✅ Profile Intelligence System Active
✅ Compliance & Safety Controls Enabled

**Quick Commands:**
• "Start profile visits for [company]" - Begin visitor automation
• "Analyze recent posts for [prospect]" - Review engagement opportunities
• "Generate comment for [LinkedIn post URL]" - Create AI comment
• "Check automation limits" - View daily usage status

**Performance Metrics:**
• Daily Profile Visits: 50-100 (60-80% acceptance rate)
• Post Engagements: 150-200 (40-60% response rate)
• AI Comments: 100+ (30-50% reply rate)
• Overall ROI: 88-93% cost reduction vs traditional methods

Ready to help you automate your LinkedIn prospecting! What would you like to start with?`
  }

  // Get all unique tags from threads for filtering
  const allTags = Array.from(new Set(
    threads.flatMap(thread => thread.tags || [])
  ))

  // Calculate thread counts for tags
  const threadCounts = allTags.reduce((acc, tag) => {
    acc[tag] = threads.filter(thread => thread.tags?.includes(tag)).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="flex h-full bg-gray-900 overflow-hidden">
      {/* Thread Sidebar */}
      <div className="w-80 border-r border-gray-700 flex-shrink-0 overflow-hidden">
        <ThreadSidebar
          onThreadSelect={handleThreadSelect}
          currentThreadId={currentThread?.id}
          className="h-full"
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {currentThread ? (
          <>
            {/* Chat Header */}
            <div className="bg-gray-800 border-b border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div>
                    <h1 className="text-lg font-semibold text-white">
                      {currentThread.title}
                    </h1>
                    <div className="flex items-center space-x-2 text-sm text-gray-400">
                      {currentThread.prospect_name && (
                        <span>{currentThread.prospect_name}</span>
                      )}
                      {currentThread.prospect_company && (
                        <span>• {currentThread.prospect_company}</span>
                      )}
                      <span>• {currentThread.thread_type}</span>
                      <span>• {currentThread.priority} priority</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      loadMemorySnapshots()
                      setShowMemorySnapshots(true)
                    }}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    title="Restore Memory"
                  >
                    <Clock size={20} />
                  </button>
                  <button
                    onClick={() => setShowTagFilter(!showTagFilter)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    title="Filter Tags"
                  >
                    <Filter size={20} />
                  </button>
                </div>
              </div>

              {/* Thread Tags */}
              {currentThread.tags && currentThread.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {currentThread.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium"
                    >
                      <Hash size={10} className="mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 pb-8 space-y-4">
              {isLoadingMessages ? (
                <div className="flex justify-center py-8">
                  <div className="text-gray-400">Loading messages...</div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <img 
                    src="/SAM.jpg" 
                    alt="Sam AI" 
                    className="w-24 h-24 rounded-full object-cover mb-4"
                    style={{ objectPosition: 'center 30%' }}
                  />
                  <h3 className="text-white text-lg font-medium mb-2">
                    Start a conversation with Sam
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Ask about prospects, strategies, or anything sales-related.
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                      {message.role === 'assistant' && (
                        <div className="flex items-start space-x-3">
                          <img 
                            src="/SAM.jpg" 
                            alt="Sam AI" 
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1"
                            style={{ objectPosition: 'center 30%' }}
                          />
                          <div className="bg-gray-700 text-white px-4 py-3 rounded-2xl">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                            {message.has_prospect_intelligence && (
                              <div className="mt-2 p-2 bg-purple-600 bg-opacity-20 rounded-lg border border-purple-600 border-opacity-30">
                                <div className="flex items-center space-x-1 text-xs text-purple-300">
                                  <Calendar size={12} />
                                  <span>Prospect intelligence gathered</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {message.role === 'user' && (
                        <>
                          <div className="flex items-center justify-end space-x-2 mb-1">
                            <span className="text-gray-400 text-sm font-medium">You</span>
                          </div>
                          <div className="bg-gray-800 text-white px-4 py-3 rounded-2xl">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
              
              {isSending && (
                <div className="flex justify-start">
                  <div className="max-w-[70%]">
                    <div className="flex items-start space-x-3">
                      <img 
                        src="/SAM.jpg" 
                        alt="Sam AI" 
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1"
                        style={{ objectPosition: 'center 30%' }}
                      />
                      <div className="bg-gray-700 text-white px-4 py-3 rounded-2xl">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                          <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                          <span className="text-sm text-gray-300 ml-2">Sam is thinking...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="flex-shrink-0 p-6">
              {pendingProspectData.length > 0 && (
                <div className="mb-4 max-w-4xl mx-auto">
                  <button
                    onClick={() => setShowDataApproval(true)}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                  >
                    <span>📊 Review & Approve Data ({pendingProspectData.length} prospects)</span>
                  </button>
                </div>
              )}
              
              <div className="bg-black text-white px-4 py-3 rounded-t-lg max-w-4xl mx-auto">
                <div className="flex items-center space-x-3">
                  <span className="text-sm">
                    {isSending ? 'Processing...' : 'Ready'}
                  </span>
                  <div className="flex space-x-1">
                    <div className={`w-2 h-2 rounded-full ${isSending ? 'bg-purple-400 animate-pulse' : 'bg-green-400'}`}></div>
                    <div className={`w-2 h-2 rounded-full ${isSending ? 'bg-purple-500 animate-pulse' : 'bg-green-500'}`} style={{animationDelay: '0.2s'}}></div>
                    <div className={`w-2 h-2 rounded-full ${isSending ? 'bg-purple-600 animate-pulse' : 'bg-green-600'}`} style={{animationDelay: '0.4s'}}></div>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {isSending ? 'Sam is thinking...' : 'Ready to chat with Sam AI'}
                </div>
              </div>
              
              <div className="bg-gray-700 p-4 rounded-b-lg max-w-4xl mx-auto">
                {/* LinkedIn Character Limits Infobox */}
                <LinkedInLimitsInfobox 
                  messageLength={inputMessage.length}
                  isTemplateContext={detectTemplateInput(inputMessage)}
                  messageContent={inputMessage}
                />
                
                <div className="flex items-end bg-gray-600 rounded-lg px-4 py-2">
                  <button className="text-gray-400 hover:text-gray-200 transition-colors p-1 mr-2">
                    <Paperclip size={18} />
                  </button>
                  <textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Continue the conversation..."
                    className="flex-1 bg-transparent text-white placeholder-gray-400 text-base pl-3 pr-3 py-2 outline-none resize-vertical min-h-[96px] max-h-48"
                    style={{ textAlign: 'left' }}
                    rows={4}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isSending || !inputMessage.trim()}
                    className="text-gray-400 hover:text-gray-200 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors ml-2 px-3 py-1 flex items-center space-x-1"
                  >
                    <span className="text-sm font-medium">
                      {isSending ? 'Sending...' : 'Send'}
                    </span>
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* No Thread Selected */
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="text-center max-w-md">
              <img 
                src="/SAM.jpg" 
                alt="Sam AI" 
                className="w-32 h-32 rounded-full object-cover mx-auto mb-6"
                style={{ objectPosition: 'center 30%' }}
              />
              <h2 className="text-2xl font-semibold text-white mb-4">
                Welcome to Sam AI
              </h2>
              <p className="text-gray-400 mb-6">
                Select a conversation from the sidebar or create a new one to start chatting with your AI sales assistant.
              </p>
              <div className="text-sm text-gray-500">
                <p>💡 Tips:</p>
                <ul className="mt-2 space-y-1 text-left">
                  <li>• Share LinkedIn profiles for instant prospect research</li>
                  <li>• Use tags to organize your conversations</li>
                  <li>• Filter conversations by type, priority, or tags</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tag Filter Panel (Overlay) */}
      {showTagFilter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="max-w-md w-full mx-4">
            <TagFilterPanel
              allTags={allTags}
              selectedTags={selectedTags}
              onTagsChange={setSelectedTags}
              threadCounts={threadCounts}
              className="max-h-96"
            />
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowTagFilter(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Approval Panel */}
      <DataApprovalPanel
        isVisible={showDataApproval}
        onClose={() => setShowDataApproval(false)}
        prospectData={pendingProspectData}
        onApprove={handleDataApproval}
        onReject={handleDataRejection}
      />

      {/* Memory Snapshots Panel */}
      {showMemorySnapshots && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="max-w-2xl w-full mx-4 bg-gray-800 rounded-lg shadow-xl">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Clock size={24} className="text-purple-400" />
                  <h2 className="text-xl font-semibold text-white">
                    Restore Memory Snapshots
                  </h2>
                </div>
                <button
                  onClick={() => setShowMemorySnapshots(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              <p className="text-gray-400 text-sm mt-2">
                Restore conversation history from previous 7-day periods. This helps maintain context and continuity.
              </p>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto">
              {isLoadingMemory ? (
                <div className="flex justify-center py-8">
                  <div className="text-gray-400">Loading memory snapshots...</div>
                </div>
              ) : memorySnapshots.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-4">No memory snapshots available</div>
                  <p className="text-sm text-gray-500">
                    Memory snapshots are created automatically every 7 days. 
                    Come back later to see your conversation history.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {memorySnapshots.map((snapshot) => (
                    <div
                      key={snapshot.id}
                      className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <ArrowUpFromLine size={16} className="text-purple-400" />
                            <span className="text-white font-medium">
                              {new Date(snapshot.snapshot_date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                          <div className="text-sm text-gray-300 mb-2">
                            {snapshot.memory_summary || `${snapshot.conversation_count} conversations, ${snapshot.total_messages} messages`}
                          </div>
                          <div className="flex items-center space-x-4 text-xs text-gray-400">
                            <span>📊 {snapshot.conversation_count} conversations</span>
                            <span>💬 {snapshot.total_messages} messages</span>
                            <span>⭐ {snapshot.importance_score}/10 importance</span>
                            {snapshot.restore_count > 0 && (
                              <span>🔄 Restored {snapshot.restore_count} times</span>
                            )}
                          </div>
                          {snapshot.user_notes && (
                            <div className="mt-2 text-sm text-gray-300 italic">
                              "{snapshot.user_notes}"
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => restoreMemorySnapshot(snapshot.id)}
                          disabled={isLoadingMemory}
                          className="ml-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium"
                        >
                          {isLoadingMemory ? 'Restoring...' : 'Restore'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-700 bg-gray-750 rounded-b-lg">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  💡 Tip: Memory snapshots help SAM maintain context across different time periods
                </div>
                <button
                  onClick={() => setShowMemorySnapshots(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper functions for campaign management
const determineCampaignAction = (input: string): string => {
  const lowerInput = input.toLowerCase()
  
  if (lowerInput.includes('upload') || lowerInput.includes('csv') || lowerInput.includes('import')) {
    return 'upload_prospects'
  }
  if (lowerInput.includes('create campaign') || lowerInput.includes('new campaign')) {
    return 'create_campaign'
  }
  if (lowerInput.includes('generate template') || lowerInput.includes('message template')) {
    return 'generate_templates'
  }
  if (lowerInput.includes('review') || lowerInput.includes('approve')) {
    return 'review_message'
  }
  if (lowerInput.includes('execute') || lowerInput.includes('send') || lowerInput.includes('launch')) {
    return 'execute_campaign'
  }
  if (lowerInput.includes('status') || lowerInput.includes('progress')) {
    return 'get_campaign_status'
  }
  
  return 'create_campaign' // default
}

const parseCampaignData = (input: string): any => {
  const data: any = {}
  
  // Check for CSV data
  if (input.includes(',') && (input.includes('\n') || input.includes('first_name') || input.includes('email'))) {
    data.prospects_data = parseCSVData(input)
  }
  
  // Extract campaign name
  const nameMatch = input.match(/campaign.*?["']([^"']+)["']/i) || input.match(/name.*?["']([^"']+)["']/i)
  if (nameMatch) {
    data.campaign_data = { name: nameMatch[1] }
  }
  
  // Extract message template
  const templateMatch = input.match(/template.*?["']([^"']+)["']/i) || input.match(/message.*?["']([^"']+)["']/i)
  if (templateMatch) {
    data.template_data = { user_input: templateMatch[1] }
  }
  
  return data
}

const parseCSVData = (input: string): any => {
  try {
    // Extract CSV content from the input
    const csvMatch = input.match(/([^\n]*(?:first_name|email|company|linkedin)[^\n]*(?:\n[^\n]*)*)/i)
    const csvContent = csvMatch ? csvMatch[1] : input
    
    const lines = csvContent.split('\n').filter(line => line.trim())
    if (lines.length < 2) return null
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const prospects = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim())
      const prospect: any = {}
      
      headers.forEach((header, index) => {
        if (values[index]) {
          // Map common field variations
          if (header.includes('first') || header.includes('fname')) prospect.first_name = values[index]
          else if (header.includes('last') || header.includes('lname')) prospect.last_name = values[index]
          else if (header.includes('company')) prospect.company_name = values[index]
          else if (header.includes('title') || header.includes('job')) prospect.job_title = values[index]
          else if (header.includes('linkedin')) prospect.linkedin_profile_url = values[index]
          else if (header.includes('email')) prospect.email_address = values[index]
          else if (header.includes('location')) prospect.location = values[index]
          else if (header.includes('industry')) prospect.industry = values[index]
          else prospect[header] = values[index]
        }
      })
      
      return prospect
    }).filter(p => p.first_name || p.email_address) // Filter out invalid rows
    
    return {
      prospects,
      source: 'csv'
    }
  } catch (error) {
    console.error('CSV parsing error:', error)
    return null
  }
}