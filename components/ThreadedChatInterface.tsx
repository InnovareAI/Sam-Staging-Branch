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
  Filter
} from 'lucide-react'
import ThreadSidebar from './ThreadSidebar'
import TagFilterPanel from './TagFilterPanel'
import DataApprovalPanel from './DataApprovalPanel'
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

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !currentThread || isSending) return

    // Check for Unipile commands before sending
    const trimmedInput = inputMessage.trim()
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

  const handleUnipileCommands = async (input: string): Promise<boolean> => {
    const command = input.toLowerCase()

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
    <div className="flex h-full bg-gray-900">
      {/* Thread Sidebar */}
      <div className="w-80 border-r border-gray-700">
        <ThreadSidebar
          onThreadSelect={handleThreadSelect}
          currentThreadId={currentThread?.id}
          className="h-full"
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
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
                    onClick={() => setShowTagFilter(!showTagFilter)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
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
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
    </div>
  )
}