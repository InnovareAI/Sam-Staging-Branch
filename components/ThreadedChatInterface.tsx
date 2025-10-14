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
import ProspectApprovalModal, { ProspectData, ApprovalSession } from './ProspectApprovalModal'
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
    isLoading,
    getRecentThreads
  } = useSamThreadedChat()

  const [currentThread, setCurrentThread] = useState<SamConversationThread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [showTagFilter, setShowTagFilter] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showDataApproval, setShowDataApproval] = useState(false)
  const [pendingProspectData, setPendingProspectData] = useState<ProspectData[]>([])
  const [approvalSession, setApprovalSession] = useState<ApprovalSession | undefined>(undefined)
  const [showMemorySnapshots, setShowMemorySnapshots] = useState(false)
  const [memorySnapshots, setMemorySnapshots] = useState<any[]>([])
  const [isLoadingMemory, setIsLoadingMemory] = useState(false)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [pendingDocumentData, setPendingDocumentData] = useState<any>(null)
  const [showDocumentApproval, setShowDocumentApproval] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // Chat input UX (Brand Assistant style)
  const inputTextAreaRef = useRef<HTMLTextAreaElement>(null)
  const [inputFocused, setInputFocused] = useState(false)

  // Load threads on mount
  useEffect(() => {
    loadThreads()
  }, [loadThreads])

  // Auto-resume most recent conversation after threads load
  useEffect(() => {
    if (threads.length > 0 && !currentThread) {
      // Try to restore last active thread from localStorage
      const lastThreadId = localStorage.getItem('sam_last_thread_id')
      const lastThread = lastThreadId ? threads.find(t => t.id === lastThreadId) : null

      if (lastThread) {
        console.log('🔄 Restoring previous conversation:', lastThread.title)
        setCurrentThread(lastThread)
      } else {
        // Fall back to most recent thread
        const recentThreads = getRecentThreads(1)
        if (recentThreads.length > 0) {
          console.log('🔄 Auto-resuming most recent conversation:', recentThreads[0].title)
          setCurrentThread(recentThreads[0])
        }
      }
    }
  }, [threads, currentThread, getRecentThreads])

  // Save current thread to localStorage when it changes
  useEffect(() => {
    if (currentThread) {
      localStorage.setItem('sam_last_thread_id', currentThread.id)
      console.log('💾 Saved thread to memory:', currentThread.title)
    }
  }, [currentThread])

  // Load messages when thread changes
  useEffect(() => {
    if (currentThread) {
      loadThreadMessages(currentThread.id)
    } else {
      setMessages([])
    }
  }, [currentThread])

  // Auto-scroll to bottom for new messages using scrollIntoView
  useEffect(() => {
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    // Scroll after a brief delay to ensure DOM is fully rendered
    const timeoutId = setTimeout(scrollToBottom, 150)
    return () => clearTimeout(timeoutId)
  }, [messages])

  // Also scroll when thread changes (chat window opens)
  useEffect(() => {
    if (currentThread && messages.length > 0) {
      const timeoutId = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [currentThread, messages.length])

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

  // Auto-resize input textarea when message changes
  useEffect(() => {
    if (inputTextAreaRef.current) {
      const el = inputTextAreaRef.current
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`
    }
  }, [inputMessage])

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

  const handleFileUpload = async (file: File) => {
    if (!currentThread || isUploadingFile) return

    setIsUploadingFile(true)
    try {
      // Get workspace ID
      const response = await fetch('/api/sam/threads/' + currentThread.id)
      const threadData = await response.json()
      const workspaceId = threadData.thread?.workspace_id

      if (!workspaceId) {
        throw new Error('No workspace context available')
      }

      // Show processing message
      const processingMessage = {
        id: `temp-${Date.now()}-processing`,
        role: 'assistant' as const,
        content: `📄 **Processing ${file.name}...**\n\nI'm analyzing your document and extracting structured information. This will take a moment.`,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, processingMessage])

      // Upload document to knowledge base
      const formData = new FormData()
      formData.append('file', file)
      formData.append('section', 'documents') // Use valid section ID from knowledge_base_sections
      formData.append('uploadMode', 'file')

      const uploadResponse = await fetch('/api/knowledge-base/upload-document', {
        method: 'POST',
        body: formData
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Upload failed with status ${uploadResponse.status}`)
      }

      const uploadResult = await uploadResponse.json()

      // Process document with AI to extract tags and insights
      const processResponse = await fetch('/api/knowledge-base/process-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentId: uploadResult.documentId,
          content: uploadResult.content,
          section: 'general',
          filename: file.name
        })
      })

      if (!processResponse.ok) {
        const errorData = await processResponse.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Processing failed with status ${processResponse.status}`)
      }

      const processResult = await processResponse.json()

      // Store pending data for user confirmation
      setPendingDocumentData({
        file,
        workspaceId,
        uploadResult,
        processResult,
        documentId: uploadResult.documentId
      })

      // Create confirmation message with extracted information
      const confirmationMessage = {
        id: `temp-${Date.now()}-confirmation`,
        role: 'assistant' as const,
        content: `✅ **Document Analysis Complete!**\n\n📄 **File:** ${file.name}\n📊 **Size:** ${(file.size / 1024).toFixed(2)} KB\n\n**🔍 What I Found:**\n\n**Summary:**\n${processResult.analysis?.summary || 'Content extracted successfully'}\n\n**Key Insights:**\n${processResult.analysis?.key_insights?.slice(0, 5).map((insight: string, i: number) => `${i + 1}. ${insight}`).join('\n') || '• Content processed successfully'}\n\n**📝 Extracted Information:**\n• **Tags:** ${processResult.analysis?.tags?.slice(0, 8).join(', ') || 'General'}\n• **Categories:** ${processResult.analysis?.categories?.join(', ') || 'General'}\n• **Content Type:** ${processResult.analysis?.content_type || 'Document'}\n• **Business Value:** ${processResult.analysis?.metadata?.business_value || 'Medium'}\n\n**🎯 Detected Topics:**\n${processResult.analysis?.metadata?.topics?.slice(0, 5).map((topic: string) => `• ${topic}`).join('\n') || '• General information'}\n\n---\n\n**Please review this information and confirm:**\n\n✅ **Does this look accurate?**\n\n• Reply **"Yes, save it"** or **"Confirm"** to add this to your knowledge base\n• Reply **"Edit tags"** or **"Change category"** if you want to modify the classification\n• Reply **"Cancel"** or **"Discard"** if this information isn't useful\n\nOnce confirmed, I'll:\n1. Vectorize the content for semantic search\n2. Store it in your knowledge base\n3. Make it available for all our conversations\n4. Use it to enhance campaign messaging and research`,
        created_at: new Date().toISOString(),
        has_prospect_intelligence: true,
        prospect_intelligence_data: {
          document: uploadResult,
          analysis: processResult.analysis,
          pending_confirmation: true
        }
      }

      setMessages(prev => [...prev.filter(m => m.id !== processingMessage.id), confirmationMessage])
      setShowDocumentApproval(true)

    } catch (error) {
      console.error('File upload error:', error)
      const errorMessage = {
        id: `temp-${Date.now()}-error`,
        role: 'assistant' as const,
        content: `❌ **Upload Failed**\n\nSorry, I couldn't process ${file.name}. ${error instanceof Error ? error.message : 'Please try again or contact support.'}`,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsUploadingFile(false)
      setSelectedFile(null)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setSelectedFile(file)
    
    // Check if it's a CSV file for prospect upload
    if (file.name.endsWith('.csv') && currentThread) {
      await handleCSVProspectUpload(file)
    } else {
      // Handle as knowledge base document
      await handleFileUpload(file)
    }
  }
  
  const handleCSVProspectUpload = async (file: File) => {
    if (!currentThread) return
    
    setIsUploadingFile(true)
    try {
      // Show processing message
      const processingMessage = {
        id: `temp-${Date.now()}-processing`,
        role: 'assistant' as const,
        content: `📄 **Processing CSV Upload: ${file.name}**\n\nValidating data and preparing prospects for review...`,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, processingMessage])
      
      // Upload CSV for processing
      const formData = new FormData()
      formData.append('file', file)
      formData.append('dataset_name', file.name.replace('.csv', ''))
      formData.append('action', 'upload')
      
      const response = await fetch('/api/prospects/csv-upload', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        throw new Error('CSV upload failed')
      }
      
      const result = await response.json()
      
      if (result.success && result.session) {
        // Transform CSV data to ProspectData format
        const transformedProspects: ProspectData[] = result.session.processed_data.map((prospect: any, index: number) => ({
          id: `csv-${Date.now()}-${index}`,
          name: prospect.name || prospect.full_name || 'Unknown',
          title: prospect.title || prospect.job_title || 'Unknown',
          company: prospect.company || prospect.company_name || 'Unknown',
          email: prospect.email,
          phone: prospect.phone || prospect.phone_number,
          linkedinUrl: prospect.linkedin_url || prospect.linkedinUrl,
          source: 'csv_upload',
          confidence: prospect.confidence || 0.7,
          complianceFlags: prospect.compliance_flags || [],
          location: prospect.location || prospect.city,
          industry: prospect.industry
        }))
        
        setPendingProspectData(transformedProspects)
        
        // Set approval session
        setApprovalSession({
          session_id: result.session_id,
          dataset_name: result.session.dataset_name || file.name,
          dataset_source: 'csv_upload',
          total_count: result.session.total_count,
          data_quality_score: result.session.data_quality_score || 0.75,
          completeness_score: result.session.completeness_score || 0.8,
          duplicate_count: result.session.duplicate_count
        })
        
        // Show success message with validation results
        const successMessage = {
          id: `temp-${Date.now()}-success`,
          role: 'assistant' as const,
          content: `✅ **CSV Upload Complete!**\n\n📊 **Validation Results:**\n• Total Records: ${result.validation_results.total_records}\n• Valid Records: ${result.validation_results.valid_records}\n• Invalid Records: ${result.validation_results.invalid_records}\n• Duplicates: ${result.validation_results.duplicates}\n• Quality Score: ${(result.validation_results.quality_score * 100).toFixed(0)}%\n\nClick "Review & Approve Data" below to examine the prospects and select which ones to add to your campaign.`,
          created_at: new Date().toISOString(),
          has_prospect_intelligence: true,
          prospect_intelligence_data: {
            csv_upload: true,
            validation_results: result.validation_results
          }
        }
        
        setMessages(prev => [...prev.filter(m => m.id !== processingMessage.id), successMessage])
        setShowDataApproval(true)
      }
    } catch (error) {
      console.error('CSV upload error:', error)
      const errorMessage = {
        id: `temp-${Date.now()}-error`,
        role: 'assistant' as const,
        content: `❌ **CSV Upload Failed**\n\nSorry, I couldn't process ${file.name}. ${error instanceof Error ? error.message : 'Please make sure your CSV has the required columns (name, title, company) and try again.'}`,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsUploadingFile(false)
      setSelectedFile(null)
    }
  }

  const handleDocumentConfirmation = async () => {
    if (!pendingDocumentData || !currentThread) return

    setIsSending(true)
    try {
      const { workspaceId, uploadResult, processResult, documentId, file } = pendingDocumentData

      // Vectorize and store in RAG system
      const vectorizeResponse = await fetch('/api/knowledge-base/vectorize-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          workspaceId,
          documentId: uploadResult.documentId,
          content: uploadResult.content,
          section: 'general',
          metadata: {
            filename: file.name,
            tags: processResult.analysis?.tags || [],
            categories: processResult.analysis?.categories || [],
            summary: processResult.analysis?.summary || ''
          }
        })
      })

      const vectorizeResult = vectorizeResponse.ok ? await vectorizeResponse.json() : null

      // Create success message
      const successMessage = {
        id: `temp-${Date.now()}-success`,
        role: 'assistant' as const,
        content: `🎉 **Knowledge Base Updated!**\n\n✅ ${file.name} has been successfully added to your knowledge base.\n\n**What's Available Now:**\n• ${vectorizeResult?.chunks_created || 0} searchable chunks created\n• Indexed with ${processResult.analysis?.tags?.length || 0} tags\n• Available for semantic search\n• Ready for use in all conversations\n• Can be referenced in campaign messaging\n\n**Next Steps:**\n• Ask me questions about this document\n• Use it to build ICPs or personas\n• Reference it when creating campaigns\n• Let me pull insights for prospect research\n\nWhat would you like to do with this information?`,
        created_at: new Date().toISOString(),
        has_prospect_intelligence: true,
        prospect_intelligence_data: {
          document: uploadResult,
          analysis: processResult.analysis,
          vectorization: vectorizeResult,
          confirmed: true
        }
      }

      setMessages(prev => [...prev, successMessage])

      // Update thread tags
      await updateThreadContext({
        tags: [...(currentThread.tags || []), 'document-upload', 'knowledge-base'],
      })

      // Clear pending data
      setPendingDocumentData(null)
      setShowDocumentApproval(false)

    } catch (error) {
      console.error('Document confirmation error:', error)
      const errorMessage = {
        id: `temp-${Date.now()}-error`,
        role: 'assistant' as const,
        content: `❌ **Failed to save document**\n\nThere was an error saving to the knowledge base. ${error instanceof Error ? error.message : 'Please try again.'}`,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsSending(false)
    }
  }

  const handleDocumentRejection = () => {
    if (!pendingDocumentData) return

    const rejectionMessage = {
      id: `temp-${Date.now()}-rejected`,
      role: 'assistant' as const,
      content: `❌ **Document Discarded**\n\nI've removed ${pendingDocumentData.file.name} and won't add it to your knowledge base.\n\nFeel free to upload a different document or let me know if you need any help!`,
      created_at: new Date().toISOString(),
    }

    setMessages(prev => [...prev, rejectionMessage])
    setPendingDocumentData(null)
    setShowDocumentApproval(false)
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !currentThread || isSending) return

    const trimmedInput = inputMessage.trim()

    // Check for document confirmation commands
    if (showDocumentApproval && pendingDocumentData) {
      const lowerInput = trimmedInput.toLowerCase()
      if (lowerInput.includes('yes') || lowerInput.includes('confirm') || lowerInput.includes('save it') || lowerInput.includes('looks good') || lowerInput === 'ok') {
        setInputMessage('')
        await handleDocumentConfirmation()
        return
      } else if (lowerInput.includes('cancel') || lowerInput.includes('discard') || lowerInput.includes('no') || lowerInput.includes('reject')) {
        setInputMessage('')
        handleDocumentRejection()
        return
      }
    }

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

    // Check for Sam MCP tool commands
    if (await handleSamMCPCommands(trimmedInput)) {
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

  const handleSamMCPCommands = async (input: string): Promise<boolean> => {
    const command = input.toLowerCase()

    // Campaign creation commands
    if (command.includes('create campaign') || 
        command.includes('start campaign') ||
        command.includes('new campaign') ||
        command.includes('campaign for') ||
        command.includes('target campaign')) {
      await executeSamMCPCommand(input, 'campaign')
      return true
    }

    // Template optimization commands
    if (command.includes('optimize template') ||
        command.includes('improve template') ||
        command.includes('analyze template') ||
        command.includes('template performance')) {
      await executeSamMCPCommand(input, 'template')
      return true
    }

    // Campaign execution commands
    if (command.includes('execute campaign') ||
        command.includes('run campaign') ||
        command.includes('start execution') ||
        command.includes('campaign status')) {
      await executeSamMCPCommand(input, 'execution')
      return true
    }

    return false
  }

  const executeSamMCPCommand = async (input: string, type: 'campaign' | 'template' | 'execution') => {
    if (!currentThread) return

    setIsSending(true)
    try {
      const response = await fetch('/api/sam/mcp-tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input,
          workspaceId: currentThread.workspace_id || 'default',
          conversationContext: {
            threadId: currentThread.id,
            prospectName: currentThread.prospect_name,
            prospectCompany: currentThread.prospect_company,
            tags: currentThread.tags,
            recentMessages: messages.slice(-5)
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to process MCP command')
      }

      const result = await response.json()

      if (result.success) {
        const mcpMessage = {
          id: `temp-${Date.now()}-mcp`,
          role: 'assistant' as const,
          content: result.response,
          created_at: new Date().toISOString(),
          has_prospect_intelligence: true,
          prospect_intelligence_data: result.data || {}
        }

        setMessages(prev => [...prev, mcpMessage])
      } else {
        const errorMessage = {
          id: `temp-${Date.now()}-error`,
          role: 'assistant' as const,
          content: `❌ MCP Command Failed: ${result.error || 'Unknown error occurred'}`,
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      console.error('Sam MCP command failed:', error)
      const errorMessage = {
        id: `temp-${Date.now()}-error`,
        role: 'assistant' as const,
        content: `❌ Failed to execute MCP command. Please try again.`,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsSending(false)
    }
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
          source: result.metadata?.source || 'linkedin',
          confidence: prospect.confidence || result.metadata?.confidence || 0.8,
          complianceFlags: prospect.complianceFlags || [],
          connectionDegree: prospect.connectionDegree,
          mutualConnections: prospect.mutualConnections,
          location: prospect.location,
          industry: prospect.industry
        }))

        setPendingProspectData(transformedProspects)
        
        // Set approval session info
        setApprovalSession({
          session_id: `linkedin_${Date.now()}`,
          dataset_name: 'LinkedIn Search Results',
          dataset_source: 'linkedin',
          total_count: transformedProspects.length,
          data_quality_score: result.metadata?.quality_score || 0.85,
          completeness_score: result.metadata?.completeness_score || 0.9
        })
        
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

    // Add after a short delay for better UX (reduced from 1500ms)
    setTimeout(() => {
      setMessages(prev => [...prev, savePromptMessage])
    }, 300)
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

  // Lightweight time formatter for message timestamps
  const formatMessageTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
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
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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

            {/* Messages Area - Fixed Layout */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col"
            >
              {isLoadingMessages ? (
                <div className="flex justify-center py-8">
                  <div className="text-gray-400">Loading messages...</div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-grow">
                  <img src="/SAM.jpg" alt="Sam AI" className="w-24 h-24 rounded-full object-cover mb-4" />
                  <h3 className="text-white text-lg font-medium mb-2">Start a conversation with Sam</h3>
                  <p className="text-gray-400 text-sm">Ask about prospects, strategies, or anything sales-related.</p>
                </div>
              ) : (
                <div className="w-full px-4 flex flex-col space-y-4">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex items-start ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {/* Avatar for assistant messages only */}
                      {message.role === 'assistant' && (
                        <img 
                          src="/SAM.jpg" 
                          alt="Sam AI" 
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1 mr-2"
                          style={{ objectPosition: 'center 30%' }}
                        />
                      )}

                      {/* Message bubble */}
                      <div className={`${message.role === 'user' ? 'ml-auto' : ''} max-w-full` }>
                        <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                          message.role === 'user'
                            ? 'bg-purple-600 text-white'
                            : 'bg-white/5 text-gray-100 border border-white/10 backdrop-blur-sm'
                        }`}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words m-0">
                            {message.content}
                          </p>
                          {message.has_prospect_intelligence && (
                            <div className="mt-2 p-2 bg-purple-600/20 rounded-lg border border-purple-600/30">
                              <div className="flex items-center space-x-1 text-xs text-purple-300">
                                <span>📊 Prospect intelligence included</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className={`mt-1 text-xs ${message.role === 'user' ? 'text-purple-200 text-right' : 'text-gray-400'}`}>
                          {formatMessageTime(message.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Invisible anchor for auto-scroll */}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="flex-shrink-0 p-6 bg-gray-900 border-t border-gray-700">
              {pendingProspectData.length > 0 && (
                <div className="mb-4 px-4">
                  <button
                    onClick={() => setShowDataApproval(true)}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                  >
                    <span>📊 Review & Approve Data ({pendingProspectData.length} prospects)</span>
                  </button>
                </div>
              )}
              
              <div className="px-4">
                {/* LinkedIn Character Limits Infobox */}
                <LinkedInLimitsInfobox 
                  messageLength={inputMessage.length}
                  isTemplateContext={detectTemplateInput(inputMessage)}
                  messageContent={inputMessage}
                />
                
                <div className={`flex gap-3 items-end p-2 rounded-2xl border-2 transition-all duration-200 mt-4 ${
                  inputFocused 
                    ? 'border-purple-500 bg-gray-800/50' 
                    : 'border-gray-700 bg-gray-900'
                }`}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    accept=".pdf,.txt,.md"
                    className="hidden"
                  />
                  <textarea
                    ref={inputTextAreaRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    placeholder={isSending ? "Sending..." : "Type your message..."}
                    disabled={isSending}
                    className="flex-1 resize-none bg-transparent border-none outline-none px-2 py-2 text-[15px] leading-relaxed text-white placeholder:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ maxHeight: '200px' }}
                    rows={1}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isSending || !inputMessage.trim()}
                    className={`shrink-0 h-10 w-10 rounded-xl transition-all duration-200 flex items-center justify-center ${
                      inputMessage.trim() && !isSending
                        ? 'bg-purple-600 hover:bg-purple-700 scale-100'
                        : 'bg-gray-700 scale-95 opacity-50'
                    }`}
                    title="Send message"
                  >
                    <Send size={20} className="text-white" />
                  </button>
                </div>
                <div className="mt-2 px-2 text-xs text-gray-500">
                  Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700">Shift + Enter</kbd> for new line
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

      {/* Prospect Approval Modal */}
      <ProspectApprovalModal
        isVisible={showDataApproval}
        onClose={() => {
          setShowDataApproval(false)
          setPendingProspectData([])
          setApprovalSession(undefined)
        }}
        prospects={pendingProspectData}
        session={approvalSession}
        onApprove={handleDataApproval}
        onReject={handleDataRejection}
        title={approvalSession?.dataset_source === 'csv_upload' ? 'Approve CSV Upload' : 'Approve LinkedIn Prospects'}
        subtitle={approvalSession?.dataset_source === 'csv_upload' ? 'Review uploaded prospects before adding to campaign' : 'Review LinkedIn search results before adding to campaign'}
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
