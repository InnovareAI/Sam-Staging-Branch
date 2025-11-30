'use client'

import { Check, ChevronDown, ChevronUp, ChevronRight, Download, Search, Tag, Users, X, Upload, FileText, Link, Sparkles, Mail, Phone, Linkedin, Star, Plus, CheckSquare, Trash2 } from 'lucide-react';
import { toastError, toastSuccess } from '@/lib/toast';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ProspectSearchChat from '@/components/ProspectSearchChat';
import { ProspectData as BaseProspectData } from '@/components/ProspectApprovalModal';
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/app/lib/supabase-client';
// Custom Tailwind components - no shadcn imports needed
import ImportProspectsModal from '@/components/ImportProspectsModal'
import ConfirmModal from '@/components/ConfirmModal'
// import EnrichProspectsButton from '@/components/EnrichProspectsButton' // REMOVED: Users bring their own enriched data


// LinkedIn Campaign Types
type LinkedInCampaignType =
  | '1st-degree-direct'      // Direct messages to existing connections
  | '2nd-3rd-connection'     // Connection requests
  | '2nd-3rd-group'          // Group messages (shared groups)
  | 'open-inmail'            // InMail campaigns (requires premium)

// FIXED: Import ProspectData from ProspectApprovalModal and extend it
type ProspectData = BaseProspectData & {
  campaignName?: string            // Primary: e.g., "20251001-IFC-College Campaign"
  campaignTag?: string             // Secondary: for A/B testing e.g., "Industry-FinTech", "Region-West"
  sessionId?: string               // Session ID for updating campaign names
  linkedinCampaignType?: LinkedInCampaignType  // LinkedIn campaign type
  conversationId?: string          // For 1st degree follow-ups
  sharedGroups?: string[]          // For group campaigns
  inmailEligible?: boolean         // Has Open Profile or InMail available
  approvalStatus?: 'pending' | 'approved' | 'rejected'
  uploaded?: boolean
  qualityScore?: number            // 0-100 quality score
  draftMessage?: string            // SAM-generated outreach message
  messageGenerating?: boolean      // Is message currently being generated
  createdAt?: Date                 // Timestamp for sorting (newest first)
  researchedBy?: string            // User who researched/created this prospect
  researchedByInitials?: string    // User initials (e.g., "CL" for Charissa L.)
  linkedinUserId?: string          // LinkedIn Internal ID for messaging (ACoAAA...)
}

// Quality Score Calculation (0-100)
function calculateQualityScore(prospect: ProspectData): number {
  let score = 0

  // Has email: +30 points
  if (prospect.email) score += 30

  // Has phone: +20 points
  if (prospect.phone) score += 20

  // Connection degree: 1st=+25, 2nd=+15, 3rd=+5
  if (prospect.connectionDegree === '1st') score += 25
  else if (prospect.connectionDegree === '2nd') score += 15
  else if (prospect.connectionDegree === '3rd') score += 5

  // Confidence/enrichment score: +15 if > 80%
  if (prospect.confidence && prospect.confidence > 0.8) score += 15
  else if (prospect.enrichmentScore && prospect.enrichmentScore > 80) score += 15

  // Complete profile (location + industry): +10
  if (prospect.location && prospect.industry) score += 10

  return Math.min(score, 100)
}

// Get quality badge variant and label
function getQualityBadge(score: number): { variant: 'default' | 'secondary' | 'destructive', label: string, icon: React.ReactNode } {
  if (score >= 85) return { variant: 'default', label: 'High', icon: <Star className="w-3 h-3 fill-green-500 text-green-500" /> }
  if (score >= 60) return { variant: 'secondary', label: 'Medium', icon: <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" /> }
  return { variant: 'destructive', label: 'Low', icon: <Star className="w-3 h-3 fill-gray-500 text-gray-500" /> }
}

interface DataCollectionHubProps {
  onDataCollected: (data: ProspectData[], source: string) => void
  onApprovalComplete?: (approvedData: ProspectData[], campaignType?: 'email' | 'linkedin') => void
  className?: string
  initialUploadedData?: ProspectData[]
  userSession?: any  // Pass session from parent to avoid auth issues
  workspaceId?: string | null  // Pass workspace ID from parent
  workspacesLoading?: boolean  // True while workspaces are being loaded
  userVerified?: boolean  // True after user change detection has run
}

// REMOVED: Dummy prospect data generation function

// Generate 3-letter code from workspace name
function generateWorkspaceCode(workspaceName: string): string {
  if (!workspaceName) return 'CLI'

  // Remove spaces and special characters
  const cleanName = workspaceName.replace(/[^a-zA-Z0-9]/g, '')

  // Extract uppercase letters from camelCase (e.g., InnovareAI → IAI)
  const capitals = cleanName.match(/[A-Z]/g)
  if (capitals && capitals.length >= 3) {
    return capitals.slice(0, 3).join('')
  }

  // If starts with number (e.g., 3Cubed → 3CU)
  if (/^\d/.test(cleanName)) {
    return (cleanName.substring(0, 1) + cleanName.substring(1, 3).toUpperCase()).padEnd(3, 'X')
  }

  // Default: first 3 letters (e.g., SendingCell → SEN)
  return cleanName.substring(0, 3).toUpperCase().padEnd(3, 'X')
}

// Helper function to get initials from name or email
function getInitials(nameOrEmail: string): string {
  if (!nameOrEmail) return 'U'

  // If it's an email, extract the part before @
  if (nameOrEmail.includes('@')) {
    const emailPart = nameOrEmail.split('@')[0]
    const parts = emailPart.split(/[._-]/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return emailPart.substring(0, 2).toUpperCase()
  }

  // If it's a name, take first letter of each word
  const words = nameOrEmail.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return nameOrEmail.substring(0, 2).toUpperCase()
}

// React Query function to fetch approval sessions with pagination
async function fetchApprovalSessions(
  page: number = 1,
  limit: number = 50,
  statusFilter: string = 'all',
  workspaceId?: string | null
): Promise<{
  prospects: ProspectData[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
    showing: number
  }
}> {
  try {
    const url = workspaceId
      ? `/api/prospect-approval/sessions/list?workspace_id=${workspaceId}`
      : '/api/prospect-approval/sessions/list';
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch sessions')

    const data = await response.json()
    if (!data.success || !data.sessions || data.sessions.length === 0) {
      return { prospects: [], pagination: { page: 1, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false, showing: 0 } }
    }

    // DEBUG: Log sessions to see campaign_name
    console.log('🔍 [DATA APPROVAL] Sessions fetched:', data.sessions.map((s: any) => ({
      id: s.id?.substring(0, 8),
      campaign_name: s.campaign_name,
      total_prospects: s.total_prospects
    })));

    // PERFORMANCE FIX: Limit to 10 most recent sessions to prevent crash
    // Previously fetching all 78 sessions caused 78 API calls and browser crash
    const recentSessions = data.sessions.slice(0, 10)
    console.log(`📊 [DATA APPROVAL] Processing ${recentSessions.length} of ${data.sessions.length} sessions (limited for performance)`)

    const allProspects: ProspectData[] = []

    for (const session of recentSessions) {
      const prospectsResponse = await fetch(
        `/api/prospect-approval/prospects?session_id=${session.id}&page=1&limit=1000&status=${statusFilter}`
      )

      console.log(`🔍 [DATA APPROVAL] Prospects fetch for session ${session.id.substring(0, 8)}: status=${prospectsResponse.status}, ok=${prospectsResponse.ok}`);

      if (!prospectsResponse.ok) {
        const errorText = await prospectsResponse.text();
        console.log(`❌ [DATA APPROVAL] Prospects API error for session ${session.id.substring(0, 8)}:`, errorText);
        continue;
      }

      const prospectsData = await prospectsResponse.json()
      console.log(`📊 [DATA APPROVAL] Prospects API response for session ${session.id.substring(0, 8)}:`, { success: prospectsData.success, count: prospectsData.prospects?.length || 0, error: prospectsData.error });

      if (prospectsData.success && prospectsData.prospects) {
          const mappedProspects = prospectsData.prospects
            .filter((p: any) => p.approval_status !== 'transferred_to_campaign') // Exclude prospects already in campaigns
            .map((p: any) => ({
              id: p.prospect_id,
              name: p.name,
              title: p.title || '',
              company: p.company?.name || '',
              industry: p.company?.industry || '',
              location: p.location || '',
              email: p.contact?.email || '',
              linkedinUrl: p.contact?.linkedin_url || '',
              phone: p.contact?.phone || '',
              connectionDegree: p.connection_degree ? `${p.connection_degree}${p.connection_degree === 1 ? 'st' : p.connection_degree === 2 ? 'nd' : 'rd'}` : undefined,
              source: p.source || 'linkedin',
              enrichmentScore: p.enrichment_score || 0,
              confidence: (p.enrichment_score || 80) / 100,
              approvalStatus: (p.approval_status || 'pending') as 'pending' | 'approved' | 'rejected',
              campaignName: session.campaign_name || `Session-${session.id.slice(0, 8)}`,
              campaignTag: session.campaign_tag || session.campaign_name || session.prospect_source || 'linkedin',
              sessionId: session.id,
              uploaded: false,
              qualityScore: 0,
              createdAt: p.created_at ? new Date(p.created_at) : session.created_at ? new Date(session.created_at) : new Date(),
              researchedBy: session.user_email || session.user_name || 'Unknown',
              researchedByInitials: session.user_initials || getInitials(session.user_email || session.user_name || 'U'),
              linkedinUserId: p.linkedin_user_id || p.contact?.linkedin_user_id || undefined
            }))

          // DEBUG: Log mapped prospects to verify campaignName
          console.log(`📋 [DATA APPROVAL] Session ${session.id.substring(0, 8)} mapped ${mappedProspects.length} prospects with campaignName:`, mappedProspects[0]?.campaignName);

          // Calculate quality scores
          mappedProspects.forEach((p: ProspectData) => {
            p.qualityScore = calculateQualityScore(p)
          })

          allProspects.push(...mappedProspects)
        }
    }

    // Sort by created date (newest first) - NO PAGINATION, show all prospects
    allProspects.sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0
      const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0
      return dateB - dateA
    })

    const totalProspects = allProspects.length

    return {
      prospects: allProspects, // Return ALL prospects, no pagination
      pagination: {
        page: 1,
        limit: totalProspects,
        total: totalProspects,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
        showing: totalProspects
      }
    }
  } catch (error) {
    console.error('Failed to fetch approval sessions:', error)
    return { prospects: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0, hasNext: false, hasPrev: false, showing: 0 } }
  }
}

export default function DataCollectionHub({
  onDataCollected,
  onApprovalComplete,
  className = '',
  userSession,
  workspaceId,
  workspacesLoading = false,
  userVerified = false,
  initialUploadedData = []
}: DataCollectionHubProps) {
  // Initialize with uploaded data from chat only (no dummy data)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState<string>('')
  const [workspaceCode, setWorkspaceCode] = useState<string>('CLI')
  const [showWorkspaceWarning, setShowWorkspaceWarning] = useState(false)

  // Use workspace ID from parent - NO FALLBACK for security
  // Users can only upload to their own workspace
  const actualWorkspaceId = workspaceId

  console.log('🔍 [DATA APPROVAL] Workspace ID from parent:', workspaceId, 'Loading:', workspacesLoading)

  // Show warning only if no workspace AND workspaces finished loading
  // Don't show warning while workspaces are still being loaded
  useEffect(() => {
    if (!actualWorkspaceId && !workspacesLoading) {
      // Only show warning after loading is complete and still no workspace
      const timer = setTimeout(() => {
        setShowWorkspaceWarning(true)
      }, 1000) // Reduced to 1 second since loading is complete
      return () => clearTimeout(timer)
    } else {
      setShowWorkspaceWarning(false)
    }
  }, [actualWorkspaceId, workspacesLoading])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(50)
  const [filterStatus, setFilterStatus] = useState<string>('pending') // Only show pending prospects by default

  // REACT QUERY: Fetch and cache approval sessions with pagination
  const queryClient = useQueryClient()
  const { data, isLoading: isLoadingSessions, refetch } = useQuery({
    queryKey: ['approval-sessions', currentPage, pageSize, filterStatus, actualWorkspaceId],
    queryFn: () => fetchApprovalSessions(currentPage, pageSize, filterStatus, actualWorkspaceId),
    staleTime: 10000, // Cache for 10 seconds (faster page loads)
    refetchInterval: 30000, // Auto-refresh every 30 seconds (was 5, too aggressive)
    refetchOnWindowFocus: true, // Auto-refresh when tab becomes visible
    keepPreviousData: true, // Smooth page transitions
    enabled: !!actualWorkspaceId && !workspacesLoading && userVerified, // Only fetch after user verified AND workspace validated
  })

  // REAL-TIME SUBSCRIPTIONS: Invalidate cache when sessions change
  useEffect(() => {
    // Wait for user verified AND workspace validated before subscribing
    if (!actualWorkspaceId || workspacesLoading || !userVerified) return

    console.log('📡 [REAL-TIME] Setting up Supabase subscription for prospect sessions')

    const channel = supabase
      .channel('prospect_approval_sessions_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'prospect_approval_sessions',
          filter: `workspace_id=eq.${actualWorkspaceId}` // Only workspace sessions
        },
        (payload) => {
          console.log('📡 [REAL-TIME] Session change detected:', payload.eventType, payload.new?.id || payload.old?.id)
          // Invalidate query cache to trigger refetch
          queryClient.invalidateQueries(['approval-sessions'])
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'prospect_approval_data',
          filter: `workspace_id=eq.${actualWorkspaceId}` // Only workspace prospects
        },
        (payload) => {
          console.log('📡 [REAL-TIME] Prospect data change detected:', payload.eventType)
          // Invalidate query cache to trigger refetch
          queryClient.invalidateQueries(['approval-sessions'])
        }
      )
      .subscribe((status) => {
        console.log('📡 [REAL-TIME] Subscription status:', status)
      })

    return () => {
      console.log('📡 [REAL-TIME] Cleaning up subscription')
      channel.unsubscribe()
    }
  }, [actualWorkspaceId, workspacesLoading, userVerified, queryClient])

  const serverProspects = data?.prospects || []
  const pagination = data?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0, hasNext: false, hasPrev: false, showing: 0 }

  const [prospectData, setProspectData] = useState<ProspectData[]>([])
  const [expandedProspect, setExpandedProspect] = useState<string | null>(null)
  const [expandedSearchGroups, setExpandedSearchGroups] = useState<Set<string>>(new Set()) // Track which search groups are expanded
  const [searchTerm, setSearchTerm] = useState('')
  // Generate default campaign name with systematic naming: YYYYMMDD-ClientID-CampaignName
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
  const [defaultCampaignName, setDefaultCampaignName] = useState(`${today}-CLIENT-Demo`)
  const [defaultCampaignTag, setDefaultCampaignTag] = useState('')
  const [selectedCampaignName, setSelectedCampaignName] = useState<string>('all')
  const [selectedCampaignTag, setSelectedCampaignTag] = useState<string>('all')
  const [showLatestSessionOnly, setShowLatestSessionOnly] = useState<boolean>(false) // Default to showing all searches

  // Phase 2: Add to Existing Campaign state
  const [availableCampaigns, setAvailableCampaigns] = useState<any[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('')
  const [loadingCampaigns, setLoadingCampaigns] = useState(false)

  // Campaign type selection modal
  const [showCampaignTypeModal, setShowCampaignTypeModal] = useState(false)
  const [selectedCampaignType, setSelectedCampaignType] = useState<'email' | 'linkedin' | null>(null)

  // Available prospects (approved but not in campaigns)
  const [availableProspects, setAvailableProspects] = useState<any[]>([])
  const [loadingAvailableProspects, setLoadingAvailableProspects] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0) // Trigger to force refresh

  // Missing state variables
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showApprovalPanel, setShowApprovalPanel] = useState(true)
  const [activeTab, setActiveTab] = useState(() => {
    // Remember last tab across page refreshes
    if (typeof window !== 'undefined') {
      return localStorage.getItem('prospectDatabaseActiveTab') || 'database'
    }
    return 'database'
  })
  const [linkedinQuery, setLinkedinQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isProspectSearchOpen, setIsProspectSearchOpen] = useState(false)
  const [connectionDegree] = useState<'1st' | '2nd' | '3rd'>('1st') // Not used - search returns all degrees

  // Bulk selection state
  const [selectedProspectIds, setSelectedProspectIds] = useState<Set<string>>(new Set())
  const [quickFilter, setQuickFilter] = useState<string>('all') // 'all', 'high-quality', 'has-email', '1st-degree', etc.

  // Dismiss-based approval state
  const [dismissedProspectIds, setDismissedProspectIds] = useState<Set<string>>(new Set())

  // ProspectSearchChat integration
  const [searchJobId, setSearchJobId] = useState<string | null>(null)
  const [searchProspects, setSearchProspects] = useState<any[]>([])

  // Campaign name editing
  const [editingCampaignName, setEditingCampaignName] = useState<string | null>(null)
  const [editedCampaignNameValue, setEditedCampaignNameValue] = useState('')

  // Data input methods
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [linkedinSearchUrl, setLinkedinSearchUrl] = useState('')
  const [isUploadingCsv, setIsUploadingCsv] = useState(false)
  const [isProcessingPaste, setIsProcessingPaste] = useState(false)
  const [isProcessingUrl, setIsProcessingUrl] = useState(false)
  const [isAddingQuickProspect, setIsAddingQuickProspect] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importInitialTab, setImportInitialTab] = useState<'url' | 'paste' | 'csv' | 'quick-add'>('url')

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info' | 'success';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning'
  })

  // Update campaign name
  const updateCampaignName = async (sessionId: string, newCampaignName: string) => {
    try {
      const response = await fetch('/api/prospect-approval/sessions/update-campaign', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, campaign_name: newCampaignName })
      })

      if (response.ok) {
        // Update local prospect data
        // CRITICAL FIX: Database returns snake_case 'session_id', not camelCase 'sessionId'
        setProspectData(prev => prev.map(p => {
          const pSessionId = (p as any)?.session_id || (p as any)?.sessionId
          return pSessionId === sessionId ? { ...p, campaignName: newCampaignName } : p
        }))
        setEditingCampaignName(null)
        console.log('✅ Campaign name updated:', newCampaignName)
      } else {
        console.error('Failed to update campaign name')
        toastError('Failed to update campaign name')
      }
    } catch (error) {
      console.error('Error updating campaign name:', error)
      toastError('Error updating campaign name')
    }
  }

  // Handle CSV file upload - SAVES TO DATABASE
  const handleCsvUpload = async (file: File) => {
    if (!file) return

    setIsUploadingCsv(true)
    try {
      // Use session passed from parent component
      if (!userSession) {
        toastError('Please sign in to upload CSV files')
        return
      }

      // Check workspace ID is available - users can only upload to their own workspace
      if (!actualWorkspaceId) {
        toastError('No workspace selected. Please select your workspace from the top menu.')
        console.error('CSV Upload blocked: No workspace ID available')
        return
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('campaign_name', `${today}-${workspaceCode}-CSV Upload`)
      formData.append('source', 'csv-upload')
      formData.append('workspace_id', actualWorkspaceId)
      // CRITICAL: Include campaign_id so prospects get transferred to campaign after approval
      if (selectedCampaignId) {
        formData.append('campaign_id', selectedCampaignId)
      }

      console.log('CSV upload request:', {
        fileName: file.name,
        fileSize: file.size,
        campaignName: `${today}-${workspaceCode}-CSV Upload`,
        workspaceId: actualWorkspaceId,
        workspaceIdFromProp: workspaceId,
        campaignId: selectedCampaignId || 'none',
        hasSession: !!userSession
      })

      // Use the approval session API to save to database
      const response = await fetch('/api/prospect-approval/upload-csv', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userSession.access_token}`
        },
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          toastSuccess(`✅ Uploaded ${data.count || 0} prospects from CSV and saved to database`)
          // Close the import modal automatically
          setShowImportModal(false)
          // Force full page reload to bypass all caches and show uploaded prospects
          window.location.reload()
        }
      } else {
        const errorData = await response.json()
        console.error('CSV upload error response:', errorData)

        // Show detailed error for duplicates
        if (errorData.duplicates && errorData.duplicates.length > 0) {
          const dupCount = errorData.duplicates.length
          const dupList = errorData.duplicates.slice(0, 3).map((d: any) =>
            `${d.linkedin_url} (already in: ${d.existing_campaign})`
          ).join('\n')

          const message = `${errorData.error}\n\nExamples:\n${dupList}${dupCount > 3 ? `\n...and ${dupCount - 3} more` : ''}`
          toastError(message)

          // Log all duplicates for troubleshooting
          console.warn('🔍 All duplicate prospects:', errorData.duplicates)
        } else {
          toastError(errorData.error || 'Failed to upload CSV file')
        }
      }
    } catch (error) {
      console.error('CSV upload error:', error)
      toastError('Error uploading CSV file')
    } finally {
      setIsUploadingCsv(false)
      setCsvFile(null)
      if (csvFileInputRef.current) {
        csvFileInputRef.current.value = ''
      }
    }
  }

  // Handle copy/paste text data - SAVES TO DATABASE
  const handlePasteData = async () => {
    if (!pasteText.trim()) {
      toastError('Please paste some prospect data first')
      return
    }

    // Check workspace ID is available
    if (!actualWorkspaceId) {
      toastError('No workspace selected. Please select your workspace from the top menu.')
      console.error('Paste Upload blocked: No workspace ID available')
      return
    }

    setIsProcessingPaste(true)
    try {
      // Parse pasted text - expecting format like:
      // Name, Title, Company, Email, LinkedIn
      // or tab-separated values
      const lines = pasteText.trim().split('\n')
      const prospects: any[] = []

      for (const line of lines) {
        if (!line.trim()) continue

        // Try comma-separated first, then tab-separated
        const parts = line.includes('\t') ? line.split('\t') : line.split(',')
        const cleanParts = parts.map(p => p.trim())

        if (cleanParts.length >= 2) {
          prospects.push({
            name: cleanParts[0] || 'Unknown',
            title: cleanParts[1] || '',
            company: { name: cleanParts[2] || '' },
            location: '',
            contact: {
              email: cleanParts[3] || '',
              linkedin_url: cleanParts[4] || ''
            },
            source: 'paste-import',
            enrichment_score: 70,
            approval_status: 'pending'
          })
        }
      }

      if (prospects.length > 0) {
        // Save to database via API
        const response = await fetch('/api/prospect-approval/upload-prospects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaign_name: `${today}-${workspaceCode}-Pasted Data`,
            campaign_tag: 'paste-import',
            source: 'paste-import',
            workspace_id: actualWorkspaceId,
            prospects
          })
        })

        if (response.ok) {
          const data = await response.json()
          toastSuccess(`✅ Added ${data.count || 0} prospects from pasted data and saved to database`)
          setPasteText('') // Clear the textarea
          // Immediately refetch to show new data
          await refetch()
        } else {
          toastError('Failed to save pasted data')
        }
      } else {
        toastError('No valid prospect data found')
      }
    } catch (error) {
      console.error('Paste processing error:', error)
      toastError('Error processing pasted data')
    } finally {
      setIsProcessingPaste(false)
    }
  }

  // Handle LinkedIn search URL
  const handleLinkedInUrl = async () => {
    if (!linkedinSearchUrl.trim()) {
      toastError('Please enter a LinkedIn search URL')
      return
    }

    setIsProcessingUrl(true)
    try {
      const response = await fetch('/api/linkedin/search/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search_criteria: {
            url: linkedinSearchUrl
          },
          target_count: 50
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          toastSuccess(`✅ Found ${data.count || 0} prospects from LinkedIn search and saved to database`)
          setLinkedinSearchUrl('') // Clear the input
          // Immediately refetch to show new data
          await refetch()
        }
      } else {
        toastError('Failed to search LinkedIn')
      }
    } catch (error) {
      console.error('LinkedIn URL processing error:', error)
      toastError('Error processing LinkedIn URL')
    } finally {
      setIsProcessingUrl(false)
    }
  }

  // Sync React Query data to local state
  useEffect(() => {
    if (serverProspects.length > 0) {
      setProspectData(serverProspects)
    }
  }, [serverProspects])

  // Fetch workspace information to generate code
  useEffect(() => {
    async function fetchWorkspace() {
      try {
        const response = await fetch('/api/workspace/current')
        if (response.ok) {
          const data = await response.json()
          if (data.workspace?.name) {
            const code = generateWorkspaceCode(data.workspace.name)
            setWorkspaceCode(code)
          }
        }
      } catch (error) {
        console.error('Failed to fetch workspace:', error)
        // Keep default 'CLI' code
      }
    }
    fetchWorkspace()
  }, [])

  // Save active tab to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('prospectDatabaseActiveTab', activeTab)
    }
  }, [activeTab])

  // Update prospects when new data is uploaded from chat
  useEffect(() => {
    if (initialUploadedData && initialUploadedData.length > 0) {
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
      const uploadedProspects = initialUploadedData.map(p => ({
        ...p,
        approvalStatus: (p.approvalStatus || 'pending') as const,
        campaignTag: p.campaignTag || `${today}-${workspaceCode}-Demo`,
        uploaded: true
      }))
      // Add uploaded prospects to the beginning of the list
      setProspectData(prev => {
        // Filter out any duplicates based on email or linkedinUrl
        const existingIds = new Set(prev.map(p => p.email || p.linkedinUrl).filter(Boolean))
        const newProspects = uploadedProspects.filter(p => !existingIds.has(p.email || p.linkedinUrl))
        return [...newProspects, ...prev]
      })
    }
  }, [initialUploadedData, workspaceCode])

  // Fetch available campaigns for "Add to Existing Campaign" dropdown
  useEffect(() => {
    const fetchCampaigns = async () => {
      // Wait for user verified AND workspace validation before fetching
      if (!actualWorkspaceId || workspacesLoading || !userVerified) return

      setLoadingCampaigns(true)
      try {
        const response = await fetch(`/api/campaigns?workspace_id=${actualWorkspaceId}`)
        if (!response.ok) throw new Error('Failed to fetch campaigns')

        const data = await response.json()
        // Filter for active and draft campaigns only (not archived)
        const activeCampaigns = (data.campaigns || []).filter(
          (c: any) => c.status === 'active' || c.status === 'draft' || c.status === 'paused'
        )
        setAvailableCampaigns(activeCampaigns)
      } catch (error) {
        console.error('Error fetching campaigns:', error)
        setAvailableCampaigns([])
      } finally {
        setLoadingCampaigns(false)
      }
    }

    fetchCampaigns()
  }, [actualWorkspaceId, workspacesLoading, userVerified])

  // Fetch available prospects (approved but not in campaigns)
  useEffect(() => {
    const fetchAvailableProspects = async () => {
      // Wait for user verified AND workspace validation before fetching
      if (!actualWorkspaceId || workspacesLoading || !userVerified) return

      setLoadingAvailableProspects(true)
      try {
        const response = await fetch(`/api/workspace-prospects/available?workspace_id=${actualWorkspaceId}`)
        if (!response.ok) throw new Error('Failed to fetch available prospects')

        const data = await response.json()
        setAvailableProspects(data.prospects || [])
      } catch (error) {
        console.error('Error fetching available prospects:', error)
        setAvailableProspects([])
      } finally {
        setLoadingAvailableProspects(false)
      }
    }

    // Fetch immediately
    fetchAvailableProspects()

    // Set up polling to refresh every 3 seconds (so SAM search results appear quickly)
    const intervalId = setInterval(() => {
      fetchAvailableProspects()
    }, 3000) // 3 seconds

    // Clean up interval on unmount or dependency change
    return () => clearInterval(intervalId)
  }, [actualWorkspaceId, workspacesLoading, userVerified, activeTab, refreshTrigger]) // Refetch when tab changes or when explicitly triggered

  // CSV Upload Handler
  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('dataset_name', `CSV Upload - ${file.name}`)

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch('/api/prospects/csv-upload', {
        method: 'POST',
        body: formData
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const data = await response.json()
      
      if (data.success) {
        const prospects = data.preview_data || []
        setProspectData(prospects)
        onDataCollected(prospects, 'csv_upload')
        setShowApprovalPanel(true)
        setActiveTab('approve')
        
        toastError(`✅ CSV uploaded successfully!\n\n📊 Results:\n• ${data.validation_results?.total_records || 0} total records\n• ${data.validation_results?.valid_records || 0} valid prospects\n• ${data.validation_results?.quality_score ? (data.validation_results.quality_score * 100).toFixed(0) : 0}% quality score\n\nProceeding to approval...`)
      } else {
        throw new Error(data.error || 'Failed to upload CSV')
      }
    } catch (error) {
      console.error('CSV upload error:', error)
      toastError(`❌ CSV upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
      setUploadProgress(0)
    }
  }

  // Quick Add LinkedIn URL Handler
  const handleQuickAddProspect = async () => {
    if (!quickAddUrl.trim()) {
      toastError('Please enter a LinkedIn URL')
      return
    }

    // Basic URL validation
    if (!quickAddUrl.toLowerCase().includes('linkedin.com/in/')) {
      toastError('Invalid LinkedIn URL. Expected format: https://linkedin.com/in/username')
      return
    }

    setIsAddingQuickProspect(true)

    try {
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
      const campaignName = `${today}-${workspaceCode}-Quick Add`

      const response = await fetch('/api/prospects/quick-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkedin_url: quickAddUrl.trim(),
          workspace_id: workspaceId,
          campaign_name: campaignName
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to add prospect')
      }

      const data = await response.json()

      if (data.success) {
        // Reload prospect data from the database
        await refetch()

        // Clear input and hide
        setQuickAddUrl('')
        setShowQuickAdd(false)

        // Show success message
        toastSuccess(data.message || '✅ Prospect added successfully')
      }
    } catch (error) {
      console.error('Quick add prospect error:', error)
      toastError(error instanceof Error ? error.message : 'Failed to add prospect')
    } finally {
      setIsAddingQuickProspect(false)
    }
  }

  // LinkedIn Data Collection via Unipile MCP
  const handleLinkedInSearch = async () => {
    if (!linkedinQuery.trim()) {
      toastError('Please enter a search query for LinkedIn prospects')
      return
    }

    setLoading(true)
    try {
      // First, get LinkedIn accounts via MCP
      const linkedinData = await collectLinkedInData(linkedinQuery, workspaceCode, connectionDegree)
      
      if (linkedinData.length > 0) {
        setProspectData(linkedinData)
        onDataCollected(linkedinData, 'unipile')
        setShowApprovalPanel(true)
        setActiveTab('approve')
        
        toastError(`✅ LinkedIn data collected!\n\n📊 Found ${linkedinData.length} prospects\nProceeding to approval...`)
      } else {
        toastError('No LinkedIn prospects found for your search query.')
      }
    } catch (error) {
      console.error('LinkedIn search error:', error)
      toastError(`❌ LinkedIn search failed: ${error instanceof Error ? error.message : 'Connection error'}`)
    } finally {
      setLoading(false)
    }
  }

  // Bright Data Enrichment
  const handleBrightDataEnrich = async () => {
    if (!searchQuery.trim()) {
      toastError('Please enter a company or industry to search')
      return
    }

    setLoading(true)
    try {
      // Simulate Bright Data collection
      const enrichedData = await collectBrightData(searchQuery)
      
      setProspectData(enrichedData)
      onDataCollected(enrichedData, 'bright-data')
      setShowApprovalPanel(true)
      setActiveTab('approve')
      
      toastError(`✅ Bright Data enrichment complete!\n\n📊 Found ${enrichedData.length} enriched prospects\nProceeding to approval...`)
    } catch (error) {
      console.error('Bright Data error:', error)
      toastError(`❌ Data enrichment failed: ${error instanceof Error ? error.message : 'Service error'}`)
    } finally {
      setLoading(false)
    }
  }

  // Generate Test Data
  const handleGenerateTestData = async (count: number = 25) => {
    setLoading(true)
    try {
      const response = await fetch('/api/prospects/test-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_prospects',
          count,
          data_source: 'test_generation'
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setProspectData(data.prospects)
        onDataCollected(data.prospects, 'test_data')
        setShowApprovalPanel(true)
        setActiveTab('approve')
      }
    } catch (error) {
      console.error('Test data generation error:', error)
      toastError('Failed to generate test data')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async (prospectId: string) => {
    // Find prospect in server data first, fallback to local filtered data
    const prospect = serverProspects.find(p => p.id === prospectId) || prospectData.find(p => p.id === prospectId)
    // CRITICAL FIX: Database returns snake_case 'session_id', not camelCase 'sessionId'
    const sessionId = (prospect as any)?.session_id || (prospect as any)?.sessionId
    if (!prospect || !sessionId) {
      console.error('Prospect not found or missing session_id:', prospectId, prospect)
      toastError('Cannot reject: prospect data not found')
      return
    }

    // Toggle logic: if already rejected, revert to pending
    const newStatus = prospect.approvalStatus === 'rejected' ? 'pending' : 'rejected'

    try {
      // Save decision to database
      const response = await fetch('/api/prospect-approval/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          prospect_id: prospectId,
          decision: newStatus
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to save decision:', errorData)
        toastError(`Failed to update: ${errorData.error || 'Unknown error'}`)
        return
      }

      // Update local state immediately (optimistic update)
      setProspectData(prev => prev.map(p =>
        p.id === prospectId ? { ...p, approvalStatus: newStatus as const } : p
      ))

      toastSuccess(newStatus === 'rejected' ? 'Prospect rejected' : 'Rejection reverted')
      // Note: No refetch needed - optimistic update handles UI
      // Data will refresh on next filter change or page load
    } catch (error) {
      console.error('Error updating prospect:', error)
      toastError(`Failed to update: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleApprove = async (prospectId: string) => {
    // Find prospect in server data first, fallback to local filtered data
    const prospect = serverProspects.find(p => p.id === prospectId) || prospectData.find(p => p.id === prospectId)
    // CRITICAL FIX: Database returns snake_case 'session_id', not camelCase 'sessionId'
    const sessionId = (prospect as any)?.session_id || (prospect as any)?.sessionId
    if (!prospect || !sessionId) {
      console.error('Prospect not found or missing session_id:', prospectId, prospect)
      toastError('Cannot approve: prospect data not found')
      return
    }

    // Toggle logic: if already approved, revert to pending
    const newStatus = prospect.approvalStatus === 'approved' ? 'pending' : 'approved'

    try {
      // Save decision to database
      const response = await fetch('/api/prospect-approval/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          prospect_id: prospectId,
          decision: newStatus
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to save decision:', errorData)
        toastError(`Failed to update: ${errorData.error || 'Unknown error'}`)
        return
      }

      // Update local state immediately (optimistic update)
      setProspectData(prev => prev.map(p =>
        p.id === prospectId ? { ...p, approvalStatus: newStatus as const } : p
      ))

      toastSuccess(newStatus === 'approved' ? 'Prospect approved' : 'Approval reverted')
      // Note: No refetch needed - optimistic update handles UI
      // Data will refresh on next filter change or page load
    } catch (error) {
      console.error('Error updating prospect:', error)
      toastError(`Failed to update: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleApproveAll = async () => {
    const pendingProspects = prospectData.filter(p => p.approvalStatus === 'pending')

    // Optimistic UI update
    setProspectData(prev => prev.map(p =>
      p.approvalStatus === 'pending' ? { ...p, approvalStatus: 'approved' as const } : p
    ))

    // Save all to database
    for (const prospect of pendingProspects) {
      // CRITICAL FIX: Database returns snake_case 'session_id', not camelCase 'sessionId'
      const sessionId = (prospect as any)?.session_id || (prospect as any)?.sessionId
      if (sessionId) {
        try {
          await fetch('/api/prospect-approval/decisions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              prospect_id: prospect.id,
              decision: 'approved'
            })
          })
        } catch (error) {
          console.error('Error approving prospect:', prospect.id, error)
        }
      }
    }

    // Show success message - prospects stay in database until user clicks "Send Approved to Campaign"
    toastSuccess(`✅ Approved ${pendingProspects.length} prospect(s)\n\nClick "Send Approved to Campaign" when ready to create campaigns`)
  }

  const performRejectAll = async () => {
    const allProspects = prospectData

    // Save rejections (but don't delete - let them auto-expire after 7 days)
    for (const prospect of allProspects) {
      // CRITICAL FIX: Database returns snake_case 'session_id', not camelCase 'sessionId'
      const sessionId = (prospect as any)?.session_id || (prospect as any)?.sessionId
      if (sessionId) {
        try {
          await fetch('/api/prospect-approval/decisions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              prospect_id: prospect.id,
              decision: 'rejected'
            })
          })
        } catch (error) {
          console.error('Error rejecting prospect:', prospect.id, error)
        }
      }
    }

    // Update local state to rejected
    setProspectData(prev => prev.map(p => ({ ...p, approvalStatus: 'rejected' as const })))

    toastSuccess(`All prospects rejected\n\nℹ️ Prospects will auto-delete after 7 days\n(View in "Dismissed" filter)`)
  }

  const handleRejectAll = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reject All Prospects',
      message: 'Are you sure you want to reject all prospects?\n\nThey will be kept for 7 days before auto-deletion.',
      onConfirm: performRejectAll,
      type: 'warning'
    })
  }

  const performDeleteProspect = async (prospectId: string) => {
    try {
      // Delete from database
      const response = await fetch(`/api/prospect-approval/delete?prospect_id=${prospectId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete prospect')
      }

      // Remove from local state
      setProspectData(prev => prev.filter(p => p.id !== prospectId))

      // Refresh server data
      queryClient.invalidateQueries({ queryKey: ['workspace-prospects', workspaceId] })

      toastSuccess('Prospect deleted successfully')
    } catch (error) {
      console.error('Error deleting prospect:', error)
      toastError(error instanceof Error ? error.message : 'Failed to delete prospect')
    }
  }

  const handleDeleteProspect = (prospectId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Prospect',
      message: 'Are you sure you want to permanently delete this prospect?\n\nThis action cannot be undone.',
      onConfirm: () => performDeleteProspect(prospectId),
      type: 'danger'
    })
  }

  const handleCampaignTagChange = (prospectId: string, tag: string) => {
    setProspectData(prev => prev.map(p => 
      p.id === prospectId ? { ...p, campaignTag: tag } : p
    ))
  }

  const toggleExpanded = (prospectId: string) => {
    setExpandedProspect(prev => prev === prospectId ? null : prospectId)
  }

  const toggleSearchGroup = (searchName: string) => {
    setExpandedSearchGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(searchName)) {
        newSet.delete(searchName)
      } else {
        newSet.add(searchName)
      }
      return newSet
    })
  }

  const downloadCSV = () => {
    const csv = [
      ['Name', 'Company', 'Title', 'Industry', 'Email', 'Phone', 'LinkedIn', 'Location', 'Campaign Tag', 'Status', 'Confidence', 'Source'],
      ...prospectData.map(p => [
        p.name,
        p.company,
        p.title,
        p.industry || '',
        p.email || '',
        p.phone || '',
        p.linkedinUrl || '',
        p.location || '',
        p.campaignTag || '',
        p.approvalStatus || 'pending',
        p.confidence ? `${Math.round(p.confidence * 100)}%` : '',
        p.source
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prospects_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Calculate quality scores for all prospects
  const prospectsWithScores = prospectData.map(p => ({
    ...p,
    qualityScore: p.qualityScore ?? calculateQualityScore(p)
  }))

  // Get unique campaign tags
  const campaignTags = ['all', ...Array.from(new Set(prospectsWithScores.map(p => p.campaignTag).filter(Boolean))) as string[]]

  // Calculate filter counts
  const highQualityCount = prospectsWithScores.filter(p => (p.qualityScore ?? 0) >= 85).length
  const hasEmailCount = prospectsWithScores.filter(p => p.email).length
  const firstDegreeCount = prospectsWithScores.filter(p => p.connectionDegree === '1st').length
  const missingInfoCount = prospectsWithScores.filter(p => !p.email || !p.phone).length

  // Get latest campaign name for "latest" filter
  const latestCampaignName = prospectData.length > 0
    ? prospectData.sort((a, b) => {
        const dateA = a.createdAt ? a.createdAt.getTime() : 0
        const dateB = b.createdAt ? b.createdAt.getTime() : 0
        return dateB - dateA
      })[0]?.campaignName
    : null

  // Auto-expiration: Remove old prospect data to prevent clutter
  // Prospects older than this many days will be automatically filtered out
  const PROSPECT_EXPIRATION_DAYS = 7
  const expirationDate = new Date()
  expirationDate.setDate(expirationDate.getDate() - PROSPECT_EXPIRATION_DAYS)

  // Filter prospects - SERVER-SIDE: status filter is handled by API
  // CLIENT-SIDE: search term, campaign filters, and auto-expiration
  let filteredProspects = prospectsWithScores.filter(p => {
    // Auto-expiration: Filter out old unused prospect data (older than 30 days)
    if (p.createdAt && p.createdAt < expirationDate) {
      return false
    }

    // Campaign name filter - Allow filtering by specific search names
    if (selectedCampaignName === 'latest') {
      // Show only latest search
      if (latestCampaignName && p.campaignName !== latestCampaignName) {
        return false
      }
    } else if (selectedCampaignName !== 'all') {
      // Show only selected search
      if (p.campaignName !== selectedCampaignName) {
        return false
      }
    }
    // If 'all' is selected, don't filter by campaign name

    // Campaign tag filter - independent of campaign name
    if (selectedCampaignTag !== 'all' && p.campaignTag !== selectedCampaignTag) {
      return false
    }

    // NOTE: Approval status filter now handled server-side via API
    // The data from server is already filtered by status

    // Quick filter
    if (quickFilter === 'high-quality' && (p.qualityScore ?? 0) < 85) return false
    if (quickFilter === 'has-email' && !p.email) return false
    if (quickFilter === '1st-degree' && p.connectionDegree !== '1st') return false
    if (quickFilter === 'missing-info' && p.email && p.phone) return false

    // Search term (client-side on current page)
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        p.name.toLowerCase().includes(search) ||
        p.company.toLowerCase().includes(search) ||
        p.title.toLowerCase().includes(search) ||
        p.industry?.toLowerCase().includes(search) ||
        p.email?.toLowerCase().includes(search)
      )
    }
    return true
  })

  // Sort by newest first (most recent at top)
  filteredProspects = filteredProspects.sort((a, b) => {
    const dateA = a.createdAt ? a.createdAt.getTime() : 0
    const dateB = b.createdAt ? b.createdAt.getTime() : 0
    return dateB - dateA // Descending order (newest first)
  })

  // Group prospects by campaign name (search name)
  const prospectsBySearch = new Map<string, ProspectData[]>()
  filteredProspects.forEach(prospect => {
    const searchName = prospect.campaignName || 'Unknown Search'
    if (!prospectsBySearch.has(searchName)) {
      prospectsBySearch.set(searchName, [])
    }
    prospectsBySearch.get(searchName)!.push(prospect)
  })

  // Sort search groups by most recent prospect in each group
  const sortedSearchGroups = Array.from(prospectsBySearch.entries()).sort((a, b) => {
    const latestA = Math.max(...a[1].map(p => p.createdAt ? p.createdAt.getTime() : 0))
    const latestB = Math.max(...b[1].map(p => p.createdAt ? p.createdAt.getTime() : 0))
    return latestB - latestA
  })

  // Auto-expand the first search group on initial load
  React.useEffect(() => {
    if (sortedSearchGroups.length > 0 && expandedSearchGroups.size === 0) {
      setExpandedSearchGroups(new Set([sortedSearchGroups[0][0]]))
    }
  }, [sortedSearchGroups.length])

  // Debug logging for campaign filtering
  console.log('🔍 Campaign Filter Debug:', {
    selectedCampaignName,
    showLatestSessionOnly,
    totalProspects: prospectData.length,
    filteredProspects: filteredProspects.length,
    uniqueCampaigns: Array.from(new Set(prospectData.map(p => p.campaignName).filter(Boolean))),
    searchGroups: sortedSearchGroups.length
  })

  // Calculate counts based on the currently filtered prospects (respects campaign selection)
  // For approved count, use availableProspects (prospects in database but NOT in campaigns)
  const approvedCount = availableProspects.length
  const rejectedCount = prospectData.filter(p => p.approvalStatus === 'rejected').length // Always use full data for rejected count
  const pendingCount = filteredProspects.filter(p => p.approvalStatus === 'pending').length
  
  // Total visible count (excluding rejected unless explicitly filtering for them)
  const visibleCount = filterStatus === 'rejected' ? rejectedCount : filteredProspects.length

  const applyDefaultTagToAll = () => {
    if (defaultCampaignTag.trim()) {
      setProspectData(prev => prev.map(p => ({ ...p, campaignTag: defaultCampaignTag })))
    }
  }

  // Bulk selection handlers
  const toggleSelectProspect = (prospectId: string) => {
    console.log('🔘 Checkbox toggled for prospect:', prospectId);
    setSelectedProspectIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(prospectId)) {
        newSet.delete(prospectId)
        console.log('✓ Deselected. New count:', newSet.size);
      } else {
        newSet.add(prospectId)
        console.log('✓ Selected. New count:', newSet.size);
      }
      return newSet
    })
  }

  const selectAllVisible = () => {
    setSelectedProspectIds(new Set(filteredProspects.map(p => p.id)))
  }

  const deselectAll = () => {
    setSelectedProspectIds(new Set())
  }

  const selectTopQuality = (count: number = 50) => {
    const topProspects = filteredProspects
      .sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0))
      .slice(0, count)
      .map(p => p.id)
    setSelectedProspectIds(new Set(topProspects))
    toastSuccess(`Selected top ${topProspects.length} quality prospects`)
  }

  const selectWithEmail = () => {
    const prospectsWithEmail = filteredProspects.filter(p => p.email).map(p => p.id)
    setSelectedProspectIds(new Set(prospectsWithEmail))
    toastSuccess(`Selected ${prospectsWithEmail.length} prospects with email`)
  }

  const selectFirstDegree = () => {
    const firstDegree = filteredProspects.filter(p => p.connectionDegree === '1st').map(p => p.id)
    setSelectedProspectIds(new Set(firstDegree))
    toastSuccess(`Selected ${firstDegree.length} 1st degree connections`)
  }

  const bulkApproveSelected = async () => {
    // Get ONLY prospects that are already marked as approved (ignore rejected and pending)
    const approvedProspects = prospectData.filter(p => p.approvalStatus === 'approved')

    if (approvedProspects.length === 0) {
      toastError('No approved prospects to send. Please approve prospects first.')
      return
    }

    // Show loading state
    setLoading(true)
    setLoadingMessage(`Sending ${approvedProspects.length} approved prospects to Campaign Hub...`)

    toastSuccess(`Sending ${approvedProspects.length} approved prospects to Campaign Hub`)

    setLoading(false)

    // Forward ONLY approved prospects to Campaign Hub (disregard rejected and pending)
    handleProceedToCampaignHub(approvedProspects)
  }

  const addApprovedToExistingCampaign = async () => {
    // FIXED: Use selected prospects if any are checked, otherwise use all approved
    const approvedProspects = prospectData.filter(p => p.approvalStatus === 'approved')
    const prospectsToAdd = selectedProspectIds.size > 0
      ? approvedProspects.filter(p => selectedProspectIds.has(p.id))
      : approvedProspects

    if (prospectsToAdd.length === 0) {
      toastError('No prospects to add. Please select prospects or approve some first.')
      return
    }

    if (!selectedCampaignId) {
      toastError('Please select a campaign first.')
      return
    }

    setLoading(true)
    setLoadingMessage(`Adding ${prospectsToAdd.length} prospects to campaign...`)

    try {
      // FIXED: Use prospectsToAdd instead of approvedProspects
      const prospectIds = prospectsToAdd.map(p => p.id).filter(Boolean)

      const response = await fetch(`/api/campaigns/${selectedCampaignId}/prospects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_ids: prospectIds })
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          // Conflict with other campaigns
          const conflictList = data.conflicts
            .map((c: any) => `- ${c.name} (in ${c.current_campaign})`)
            .join('\n')
          toastError(`Campaign conflict:\n\n${data.message}\n\n${conflictList}`)
        } else {
          toastError(data.error || 'Failed to add prospects to campaign')
        }
        setLoading(false)
        return
      }

      toastSuccess(`Added ${data.added_prospects} prospect(s) to campaign!`)

      // FIXED: Only remove prospects that were actually added (selected or all approved)
      if (selectedProspectIds.size > 0) {
        // Remove only selected prospects
        setProspectData(prev => prev.filter(p => !selectedProspectIds.has(p.id)))
        setSelectedProspectIds(new Set()) // Clear selection
      } else {
        // Remove all approved prospects
        setProspectData(prev => prev.filter(p => p.approvalStatus !== 'approved'))
      }

      // Reset campaign selection
      setSelectedCampaignId('')

      // Refresh available prospects count
      setRefreshTrigger(prev => prev + 1)
    } catch (error) {
      console.error('Error adding prospects to campaign:', error)
      toastError('Failed to add prospects to campaign. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const bulkRejectSelected = async () => {
    if (selectedProspectIds.size === 0) return

    const selectedProspects = prospectData.filter(p => selectedProspectIds.has(p.id))

    // Save rejections and delete from database
    for (const prospect of selectedProspects) {
      // CRITICAL FIX: Database returns snake_case 'session_id', not camelCase 'sessionId'
      const sessionId = (prospect as any)?.session_id || (prospect as any)?.sessionId
      if (sessionId) {
        try {
          await fetch('/api/prospect-approval/decisions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              prospect_id: prospect.id,
              decision: 'rejected'
            })
          })
        } catch (error) {
          console.error('Error rejecting prospect:', prospect.id, error)
        }
      }

      // Delete from database
      try {
        await fetch(`/api/prospects/${prospect.id}`, {
          method: 'DELETE'
        })
      } catch (error) {
        console.error('Error deleting prospect:', prospect.id, error)
      }
    }

    // Remove from UI
    setProspectData(prev => prev.filter(p => !selectedProspectIds.has(p.id)))
    toastSuccess(`Rejected and removed ${selectedProspectIds.size} prospects`)
    deselectAll()
  }

  const performBulkDelete = async () => {
    try {
      // Delete from database and check each response
      const deleteResults = await Promise.all(
        Array.from(selectedProspectIds).map(async (id) => {
          const response = await fetch(`/api/prospect-approval/delete?prospect_id=${id}`, { method: 'DELETE' })
          const data = await response.json()
          return { id, success: response.ok && data.success, error: data.error }
        })
      )

      const successIds = deleteResults.filter(r => r.success).map(r => r.id)
      const failedResults = deleteResults.filter(r => !r.success)

      // Only remove successfully deleted from UI
      if (successIds.length > 0) {
        setProspectData(prev => prev.filter(p => !successIds.includes(p.id)))
      }

      if (failedResults.length === 0) {
        toastSuccess(`Deleted ${successIds.length} prospects`)
      } else if (successIds.length > 0) {
        toastError(`Deleted ${successIds.length}, but ${failedResults.length} failed: ${failedResults[0].error || 'Unknown error'}`)
      } else {
        toastError(`Failed to delete: ${failedResults[0].error || 'Unknown error'}`)
      }

      deselectAll()
    } catch (error) {
      console.error('Error deleting prospects:', error)
      toastError('Failed to delete prospects')
    }
  }

  const bulkDeleteSelected = () => {
    if (selectedProspectIds.size === 0) return

    setConfirmModal({
      isOpen: true,
      title: 'Delete Prospects',
      message: `Are you sure you want to permanently delete ${selectedProspectIds.size} prospect${selectedProspectIds.size > 1 ? 's' : ''}?\n\nThis action cannot be undone.`,
      onConfirm: performBulkDelete,
      type: 'danger'
    })
  }

  // Dismiss-based approval handlers
  const dismissProspect = (prospectId: string) => {
    setDismissedProspectIds(prev => {
      const newSet = new Set(prev)
      newSet.add(prospectId)
      return newSet
    })
  }

  const undoDismiss = (prospectId: string) => {
    setDismissedProspectIds(prev => {
      const newSet = new Set(prev)
      newSet.delete(prospectId)
      return newSet
    })
  }

  const clearAllDismissals = () => {
    setDismissedProspectIds(new Set())
    toastSuccess('All dismissals cleared')
  }

  const handleApproveAllNonDismissed = async () => {
    const nonDismissed = filteredProspects.filter(p => !dismissedProspectIds.has(p.id))
    const dismissed = filteredProspects.filter(p => dismissedProspectIds.has(p.id))

    // Approve non-dismissed
    setProspectData(prev => prev.map(p =>
      nonDismissed.find(nd => nd.id === p.id) ? { ...p, approvalStatus: 'approved' as const } : p
    ))

    // Reject dismissed
    setProspectData(prev => prev.map(p =>
      dismissed.find(d => d.id === p.id) ? { ...p, approvalStatus: 'rejected' as const } : p
    ))

    setDismissedProspectIds(new Set())

    // Save all decisions to database
    for (const prospect of nonDismissed) {
      // CRITICAL FIX: Database returns snake_case 'session_id', not camelCase 'sessionId'
      const sessionId = (prospect as any)?.session_id || (prospect as any)?.sessionId
      if (sessionId) {
        try {
          await fetch('/api/prospect-approval/decisions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              prospect_id: prospect.id,
              decision: 'approved'
            })
          })
        } catch (error) {
          console.error('Error approving prospect:', prospect.id, error)
        }
      }
    }

    for (const prospect of dismissed) {
      // CRITICAL FIX: Database returns snake_case 'session_id', not camelCase 'sessionId'
      const sessionId = (prospect as any)?.session_id || (prospect as any)?.sessionId
      if (sessionId) {
        try {
          await fetch('/api/prospect-approval/decisions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              prospect_id: prospect.id,
              decision: 'rejected'
            })
          })
        } catch (error) {
          console.error('Error rejecting prospect:', prospect.id, error)
        }
      }

      // Delete rejected from database
      try {
        await fetch(`/api/prospects/${prospect.id}`, { method: 'DELETE' })
      } catch (error) {
        console.error('Error deleting prospect:', prospect.id, error)
      }
    }

    // Show success message - prospects stay in database until user clicks "Send Approved to Campaign"
    toastSuccess(`✅ Approved ${nonDismissed.length} prospect(s), dismissed ${dismissed.length}\n\nClick "Send Approved to Campaign" when ready to create campaigns`)
  }

  // Helper function to perform the actual navigation to Campaign Hub
  const performCampaignHubNavigation = async (approvedProspects: ProspectData[], campaignType?: 'email' | 'linkedin') => {
    // CRITICAL FIX: Save approved prospects to database FIRST to get prospect_ids
    setLoading(true)
    setLoadingMessage(`Saving ${approvedProspects.length} approved prospects...`)

    let savedProspects = approvedProspects;

    try {
      // Check if prospects need to be saved to database (don't have prospect_id yet)
      const needsSaving = approvedProspects.some(p => !p.prospect_id || p.prospect_id.startsWith('temp_'));

      if (needsSaving && workspaceId) {
        // Save to prospect_approval_data via upload-prospects API
        const response = await fetch('/api/prospect-approval/upload-prospects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaign_name: approvedProspects[0]?.campaignName || 'Approved Prospects',
            campaign_tag: approvedProspects[0]?.campaignTag || 'approved',
            source: 'data-approval',
            prospects: approvedProspects.map(p => ({
              name: p.name,
              title: p.title || '',
              company: p.company || { name: '' },
              location: p.location || '',
              contact: p.contact || {
                email: p.email,
                linkedin_url: p.linkedinUrl || p.linkedin_url
              },
              source: 'data-approval',
              enrichment_score: p.enrichment_score || 70,
              approval_status: 'approved'
            }))
          })
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ Prospects saved to database:', result);

          // Fetch the saved prospects to get their database IDs
          const approvedResponse = await fetch(`/api/prospect-approval/approved?workspace_id=${workspaceId}`);
          if (approvedResponse.ok) {
            const approvedData = await approvedResponse.json();
            savedProspects = approvedData.prospects || approvedProspects;
            console.log('✅ Fetched saved prospects with IDs:', savedProspects.length);
          }
        }
      }
    } catch (error) {
      console.error('Error saving prospects to database:', error)
      // Continue anyway - prospects will still be passed to campaign hub
    }

    setLoading(false)

    // Remove approved prospects from view
    // Keep pending AND rejected prospects in the list for future decisions
    // Rejected prospects will auto-expire after 7 days (see PROSPECT_EXPIRATION_DAYS)
    const approvedIds = new Set(approvedProspects.map(p => p.id))
    setProspectData(prev => prev.filter(p => !approvedIds.has(p.id)))

    // Clear selections
    setSelectedProspectIds(new Set())
    setDismissedProspectIds(new Set())

    // Call the onApprovalComplete callback to navigate to Campaign screen
    // Use savedProspects (with database IDs) instead of local approvedProspects
    if (onApprovalComplete) {
      onApprovalComplete(savedProspects, campaignType || undefined)
    }

    toastSuccess(`✅ Success!\n\n${approvedProspects.length} approved prospects ready for campaign\n\nNext: Select or create a campaign to add them to`)
  }

  // Proceed to Campaign Hub with approved prospects ONLY (disregard rejected and pending)
  const handleProceedToCampaignHub = async (prospectsOverride?: ProspectData[], campaignType?: 'email' | 'linkedin') => {
    // ALWAYS filter for approved prospects only, even if override is provided
    // This ensures rejected and pending prospects are never sent to Campaign Hub
    const approvedProspects = prospectsOverride && prospectsOverride.length > 0
      ? prospectsOverride.filter(p => p.approvalStatus === 'approved')
      : prospectData.filter(p => p.approvalStatus === 'approved')

    if (approvedProspects.length === 0) {
      toastError('⚠️ No approved prospects found. Please approve at least one prospect before proceeding to Campaign Hub.')
      return
    }

    // Check if all approved prospects have campaign tags
    const untaggedCount = approvedProspects.filter(p => !p.campaignTag || p.campaignTag.trim() === '').length
    if (untaggedCount > 0) {
      // Show confirm modal - navigation will continue in onConfirm callback
      setConfirmModal({
        isOpen: true,
        title: 'Missing Campaign Tags',
        message: `${untaggedCount} approved prospect(s) don't have campaign tags assigned.\n\nDo you want to proceed anyway?`,
        onConfirm: () => performCampaignHubNavigation(approvedProspects, campaignType),
        type: 'warning'
      })
      return
    }

    // All prospects have tags, proceed directly
    await performCampaignHubNavigation(approvedProspects, campaignType)
  }

  // Download only approved prospects
  const downloadApprovedCSV = () => {
    const approvedProspects = prospectData.filter(p => p.approvalStatus === 'approved')

    if (approvedProspects.length === 0) {
      toastError('No approved prospects to download.')
      return
    }

    const csv = [
      ['Name', 'Company', 'Title', 'Industry', 'Email', 'Phone', 'LinkedIn', 'Location', 'Campaign Tag', 'Confidence', 'Source'],
      ...approvedProspects.map(p => [
        p.name,
        p.company,
        p.title,
        p.industry || '',
        p.email || '',
        p.phone || '',
        p.linkedinUrl || '',
        p.location || '',
        p.campaignTag || '',
        p.confidence ? `${Math.round(p.confidence * 100)}%` : '',
        p.source
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `approved_prospects_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // ProspectSearchChat callbacks
  const handleSearchTriggered = (jobId: string, criteria: any) => {
    console.log('Search job started:', jobId, criteria)
    setSearchJobId(jobId)
  }

  const handleProspectsReceived = (prospects: any[]) => {
    console.log('Prospects received:', prospects.length)
    setSearchProspects(prospects)
    setProspectData(prospects) // Populate existing approval UI
    setShowApprovalPanel(true)
    setActiveTab('approve')
    onDataCollected(prospects, 'linkedin_search_job')
  }

  return (
    <div>
      {/* Pulsating Loading Overlay */}
      {loading && loadingMessage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-900 rounded-xl border border-purple-500/50 p-8 shadow-2xl">
            <div className="flex flex-col items-center gap-4">
              {/* Pulsating purple circle */}
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full animate-ping opacity-75"></div>
              </div>
              {/* Loading message */}
              <p className="text-white text-lg font-medium">{loadingMessage}</p>
              <p className="text-gray-400 text-sm">Please wait...</p>
            </div>
          </div>
        </div>
      )}

      {/* Workspace Warning Banner */}
      {showWorkspaceWarning && !actualWorkspaceId && (
        <div className="max-w-[1400px] mx-auto mb-6">
          <div className="bg-yellow-500/10 rounded-xl border-2 border-yellow-500/50 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-yellow-400 font-semibold text-lg mb-2">No Workspace Selected</h3>
                <p className="text-yellow-200 mb-4">
                  You need to select a workspace before uploading prospects. Look for the workspace selector at the top of the page.
                </p>
                <div className="bg-yellow-900/30 border border-yellow-700/50 rounded p-4 mb-4">
                  <p className="text-yellow-100 font-mono text-sm">
                    <strong>Debug Info:</strong><br/>
                    Workspace ID: {actualWorkspaceId || 'null'}<br/>
                    Session: {userSession ? '✓ Logged in' : '✗ Not logged in'}<br/>
                    Check browser console (F12) for more details.
                  </p>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto">
        {/* Prospect Approval Dashboard */}
        <div>
          {/* Action Bar - All items on one line */}
          <div className="mb-6 space-y-4">
            {/* Row 1: Import button + Status badges + Actions - all inline */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Button: Import Prospects */}
              <button
                type="button"
                onClick={() => { setImportInitialTab('url'); setShowImportModal(true); }}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-md text-white bg-purple-600 hover:bg-purple-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import Prospects
              </button>

              {/* Separator */}
              <div className="w-px h-6 bg-gray-700 mx-1" />

              {/* Badge: Pending */}
              <span className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium border border-green-500/40">
                {filteredProspects.filter(p => !dismissedProspectIds.has(p.id) && p.approvalStatus === 'pending').length} pending
              </span>

              {/* Badge: Approved */}
              <span className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium border border-blue-500/40">
                {prospectData.filter(p => p.approvalStatus === 'approved').length} approved
              </span>

              {/* Badge: Dismissed (conditional) */}
              {dismissedProspectIds.size > 0 && (
                <span className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium border border-red-500/40">
                  {dismissedProspectIds.size} dismissed
                </span>
              )}

              {/* Badge: Selected (conditional) */}
              {selectedProspectIds.size > 0 && (
                <span className="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-medium border border-purple-500/40">
                  {selectedProspectIds.size} selected
                </span>
              )}

              {/* Separator */}
              <div className="w-px h-6 bg-gray-700 mx-1" />

              {/* Button: Approve All */}
              <button
                type="button"
                onClick={async () => {
                  const pendingProspects = prospectData.filter(p => p.approvalStatus === 'pending')
                  if (pendingProspects.length === 0) {
                    toastError('No pending prospects to approve')
                    return
                  }
                  setProspectData(prev => prev.map(p =>
                    p.approvalStatus === 'pending'
                      ? { ...p, approvalStatus: 'approved' as const }
                      : p
                  ))
                  toastSuccess(`✅ Auto-approved ${pendingProspects.length} prospects`)
                  for (const prospect of pendingProspects) {
                    const sessionId = (prospect as any)?.session_id || (prospect as any)?.sessionId
                    if (sessionId) {
                      try {
                        await fetch('/api/prospect-approval/decisions', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            session_id: sessionId,
                            prospect_id: prospect.id,
                            decision: 'approved'
                          })
                        })
                      } catch (error) {
                        console.error('Error approving prospect:', prospect.id, error)
                      }
                    }
                  }
                }}
                disabled={prospectData.filter(p => p.approvalStatus === 'pending').length === 0}
                className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
              >
                <CheckSquare className="w-4 h-4" />
                <span>Approve All</span>
              </button>

              {/* Button: Undo Dismissals (conditional) */}
              {dismissedProspectIds.size > 0 && (
                <button
                  onClick={clearAllDismissals}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300 rounded-lg transition-colors text-sm font-medium"
                >
                  Undo Dismissals
                </button>
              )}

              {/* Button: Delete Selected - always visible */}
              <button
                type="button"
                onClick={bulkDeleteSelected}
                disabled={selectedProspectIds.size === 0}
                className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete{selectedProspectIds.size > 0 ? ` (${selectedProspectIds.size})` : ''}</span>
              </button>
            </div>

            {/* Row 2: Campaign Actions - Only show when there are approved prospects */}
            {prospectData.filter(p => p.approvalStatus === 'approved').length > 0 && (
              <div className="flex items-center justify-between bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center gap-4">
                  {/* Create New Campaign */}
                  <button
                    type="button"
                    onClick={() => setShowCampaignTypeModal(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-colors font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Campaign ({selectedProspectIds.size > 0 ? selectedProspectIds.size : prospectData.filter(p => p.approvalStatus === 'approved').length})</span>
                  </button>

                  <span className="text-gray-500 text-sm">or add to existing:</span>

                  {/* Add to Existing */}
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedCampaignId}
                      onChange={(e) => setSelectedCampaignId(e.target.value)}
                      disabled={loadingCampaigns}
                      className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">Select campaign...</option>
                      {availableCampaigns.map(campaign => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.name} ({campaign.status})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={addApprovedToExistingCampaign}
                      disabled={!selectedCampaignId}
                      className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {/* Status text */}
                <div className="text-sm text-gray-400">
                  {selectedProspectIds.size > 0
                    ? `${selectedProspectIds.size} selected for campaign`
                    : `${prospectData.filter(p => p.approvalStatus === 'approved').length} prospects ready`
                  }
                </div>
              </div>
            )}
          </div>

      {/* Workflow Guide Banner */}
      <div className="border-b border-gray-700 px-6 py-4 bg-blue-500/10">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
            <span className="text-blue-400 text-lg">ℹ️</span>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-400 mb-1">How to Use Prospect Database</h4>
            <ol className="text-xs text-gray-300 space-y-1 list-decimal list-inside">
              <li><strong>Import</strong> prospects via SAM Search, CSV, LinkedIn URL, or Sales Navigator (ensure your CSV includes email addresses)</li>
              <li><strong>Review</strong>: Check quality scores and contact info</li>
              <li><strong>Approve</strong>: Click green checkmark ✓ on prospects you want to use</li>
              <li><strong>Send to Campaign</strong>: Click "Send Approved to Campaign" button to create campaigns</li>
            </ol>
            <p className="text-xs text-yellow-400 mt-2">💡 Import prospects with email addresses already included in your CSV for best results.</p>
          </div>
        </div>
      </div>

      {/* Campaign Selector with Latest Search Toggle */}
      {(() => {
        // Group prospects by campaign name to show unique campaigns
        const campaignsByName = prospectData.reduce((acc, p) => {
          const campName = p.campaignName || 'Unnamed Campaign'
          // CRITICAL FIX: Database returns snake_case 'session_id', not camelCase 'sessionId'
          const sessionId = (p as any)?.session_id || (p as any)?.sessionId
          if (!acc[campName]) {
            acc[campName] = { campaignName: campName, count: 0, sessionId }
          }
          acc[campName].count++
          return acc
        }, {} as Record<string, { campaignName: string, count: number, sessionId?: string }>)

        const campaigns = Object.values(campaignsByName).sort((a, b) => {
          // Sort by name (which includes date) descending - newest first
          return b.campaignName.localeCompare(a.campaignName)
        })

        // Get latest campaign for display
        const latestCampaign = campaigns[0]

        return (
          <div className="border-b border-gray-700 px-6 py-4 bg-gray-850">
            <div className="flex items-center justify-between gap-6">
              {/* Campaign Filter */}
              <div className="flex items-center space-x-4 flex-1">
                <label className="text-sm font-semibold text-gray-300 whitespace-nowrap">Select Campaign:</label>
                <select
                  value={selectedCampaignName}
                  onChange={(e) => setSelectedCampaignName(e.target.value)}
                  className="flex-1 max-w-md px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="latest">Latest Search ({latestCampaignName ? campaigns.find(c => c.campaignName === latestCampaignName)?.count || 0 : 0} prospects)</option>
                  <option value="all">All Campaigns ({prospectData.length} prospects)</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.campaignName} value={campaign.campaignName}>
                      {campaign.campaignName} ({campaign.count} prospects)
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-4">
                <label className="text-sm font-semibold text-gray-300 whitespace-nowrap">Status:</label>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value)
                    setCurrentPage(1) // Reset to first page when filter changes
                  }}
                  className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Status ({visibleCount} visible)</option>
                  <option value="pending">Pending ({pendingCount})</option>
                  <option value="approved">Approved ({approvedCount})</option>
                  <option value="rejected">Dismissed ({rejectedCount})</option>
                </select>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Loading Banner */}
      {isLoadingSessions && (
        <div className="bg-blue-500/10 rounded-xl border border-blue-500/30 p-4 mb-4 flex items-center justify-center gap-3">
          <svg className="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-blue-400 font-medium text-lg">Loading prospect data...</span>
        </div>
      )}

      {/* Main Content - Table View */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-750 border-b border-gray-700">
            <tr>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider w-12">
                <input
                  type="checkbox"
                  checked={selectedProspectIds.size === filteredProspects.length && filteredProspects.length > 0}
                  onChange={selectedProspectIds.size === filteredProspects.length ? deselectAll : selectAllVisible}
                  aria-label="Select all"
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-800"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Company</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Title</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Industry</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Campaign</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Researched By</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {/* Render prospects grouped by search name */}
            {sortedSearchGroups.flatMap(([searchName, prospects]) => [
              // Group header row
              <tr key={`header-${searchName}`} className="bg-gray-800/80 border-b-2 border-purple-500/30">
                <td colSpan={9} className="px-4 py-3">
                  <div className="flex items-center justify-between w-full">
                    <button
                      onClick={() => toggleSearchGroup(searchName)}
                      className="flex items-center gap-3 text-left hover:bg-gray-750/50 rounded px-2 py-1 transition-colors flex-1"
                    >
                      <div className="flex items-center gap-3">
                        {expandedSearchGroups.has(searchName) ? (
                          <ChevronDown className="w-5 h-5 text-purple-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-500" />
                        )}
                        <span className="text-lg font-semibold text-white">{searchName}</span>
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-600/30 text-purple-300">
                          {prospects.length} prospects
                        </span>
                        <span className="text-xs text-gray-400">
                          {prospects.filter(p => p.approvalStatus === 'approved').length} approved,
                          {prospects.filter(p => p.approvalStatus === 'pending').length} pending,
                          {prospects.filter(p => p.approvalStatus === 'rejected').length} rejected
                        </span>
                      </div>
                    </button>
                    {/* Select All button for this campaign */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const allProspectIds = prospects.map(p => p.id);
                        const allSelected = allProspectIds.every(id => selectedProspectIds.has(id));

                        if (allSelected) {
                          // Deselect all from this campaign
                          setSelectedProspectIds(prev => {
                            const newSet = new Set(prev);
                            allProspectIds.forEach(id => newSet.delete(id));
                            return newSet;
                          });
                        } else {
                          // Select all from this campaign
                          setSelectedProspectIds(prev => {
                            const newSet = new Set(prev);
                            allProspectIds.forEach(id => newSet.add(id));
                            return newSet;
                          });
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 transition-colors"
                      title={
                        prospects.every(p => selectedProspectIds.has(p.id))
                          ? "Deselect all prospects from this campaign"
                          : "Select all prospects from this campaign"
                      }
                    >
                      {prospects.every(p => selectedProspectIds.has(p.id)) ? (
                        <>✓ Selected ({prospects.length})</>
                      ) : (
                        <>Select All ({prospects.length})</>
                      )}
                    </button>
                  </div>
                </td>
              </tr>,
              // Render prospects if group is expanded
              ...(expandedSearchGroups.has(searchName) ? prospects.map((prospect) => {
                return (
              <React.Fragment key={prospect.id}>
                <tr className={`hover:bg-gray-750 transition-colors ${
                  dismissedProspectIds.has(prospect.id)
                    ? 'bg-red-500/5 opacity-50'
                    : selectedProspectIds.has(prospect.id)
                    ? 'bg-purple-600/10'
                    : ''
                }`}>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedProspectIds.has(prospect.id)}
                      onChange={() => toggleSelectProspect(prospect.id)}
                      aria-label={`Select ${prospect.name}`}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-800"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-white font-medium">{prospect.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{prospect.company}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{prospect.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{prospect.industry || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-300">
                      <div className="font-medium text-white">{prospect.campaignName || 'Unnamed Campaign'}</div>
                      {prospect.campaignTag && prospect.campaignTag !== prospect.campaignName && (
                        <div className="text-xs text-gray-400 mt-0.5">{prospect.campaignTag}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600/20 text-purple-300 text-xs font-bold" title={prospect.researchedBy || 'Unknown'}>
                        {prospect.researchedByInitials || 'U'}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      {/* Status Badge */}
                      {prospect.approvalStatus === 'approved' ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-600/80 text-green-100">
                          ✓ Approved
                        </span>
                      ) : prospect.approvalStatus === 'rejected' ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-600/80 text-red-100">
                          ✗ Rejected
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-600/80 text-gray-300">
                          Pending
                        </span>
                      )}

                      {/* Action Buttons - Always visible */}
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleApprove(prospect.id)}
                          className={`p-1.5 rounded-lg transition-colors border ${
                            prospect.approvalStatus === 'approved'
                              ? 'bg-green-500/40 text-green-300 border-green-500/60'
                              : 'bg-green-500/20 hover:bg-green-500/30 text-green-400 border-green-500/40'
                          }`}
                          title={prospect.approvalStatus === 'approved' ? 'Already approved' : 'Approve this prospect'}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleReject(prospect.id)}
                          className={`p-1.5 rounded-lg transition-colors border ${
                            prospect.approvalStatus === 'rejected'
                              ? 'bg-red-500/40 text-red-300 border-red-500/60'
                              : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/40'
                          }`}
                          title={prospect.approvalStatus === 'rejected' ? 'Already rejected' : 'Reject this prospect'}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <button
                        onClick={() => toggleExpanded(prospect.id)}
                        className="p-1.5 text-gray-400 hover:text-white transition-colors"
                        title="View Details"
                      >
                        {expandedProspect === prospect.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteProspect(prospect.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                        title="Delete Prospect"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                {/* Expanded Detail Row */}
                {expandedProspect === prospect.id && (
                  <tr className="bg-gray-750">
                    <td colSpan={10} className="px-4 py-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Email:</span>
                          <span className="text-white ml-2">{prospect.email || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Phone:</span>
                          <span className="text-white ml-2">{prospect.phone || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Location:</span>
                          <span className="text-white ml-2">{prospect.location || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Source:</span>
                          <span className="text-white ml-2">{prospect.source}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Confidence:</span>
                          <span className="text-white ml-2">{prospect.confidence ? `${Math.round(prospect.confidence * 100)}%` : 'N/A'}</span>
                        </div>
                        {prospect.linkedinCampaignType && (
                          <div>
                            <span className="text-gray-400">Campaign Type:</span>
                            <span className="px-2 py-1 ml-2 rounded text-xs font-semibold bg-blue-600 text-blue-100">
                              {prospect.linkedinCampaignType}
                            </span>
                          </div>
                        )}
                        {prospect.connectionDegree && (
                          <div>
                            <span className="text-gray-400">Connection Degree:</span>
                            <span className={`px-2 py-1 ml-2 rounded text-xs font-semibold ${
                              prospect.connectionDegree === '1st' ? 'bg-green-600 text-green-100' :
                              prospect.connectionDegree === '2nd' ? 'bg-yellow-600 text-yellow-100' :
                              'bg-orange-600 text-orange-100'
                            }`}>
                              {prospect.connectionDegree} degree
                            </span>
                          </div>
                        )}
                        {prospect.linkedinUrl && (
                          <div className="col-span-2">
                            <span className="text-gray-400">LinkedIn:</span>
                            <a
                              href={prospect.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 ml-2"
                            >
                              {prospect.linkedinUrl}
                            </a>
                          </div>
                        )}
                        {prospect.linkedinUserId && (
                          <div className="col-span-2">
                            <span className="text-gray-400">LinkedIn ID:</span>
                            <span className="text-green-400 ml-2 font-mono text-xs">
                              {prospect.linkedinUserId.substring(0, 20)}... ✅
                            </span>
                            <span className="text-gray-500 text-xs ml-2">(Ready for messaging)</span>
                          </div>
                        )}
                        {!prospect.linkedinUserId && prospect.connectionDegree === '1st' && (
                          <div className="col-span-2">
                            <span className="text-gray-400">LinkedIn ID:</span>
                            <span className="text-yellow-400 ml-2 text-xs">
                              ⚠️ Not found - will auto-sync on campaign creation
                            </span>
                          </div>
                        )}
                        {prospect.complianceFlags && prospect.complianceFlags.length > 0 && (
                          <div className="col-span-2">
                            <span className="text-gray-400">Compliance Flags:</span>
                            <span className="text-yellow-400 ml-2">{prospect.complianceFlags.join(', ')}</span>
                          </div>
                        )}
                        {/* Reject button in detail view if still pending */}
                        {prospect.approvalStatus === 'pending' && (
                          <div className="col-span-2 mt-2">
                            <button
                              onClick={() => handleReject(prospect.id)}
                              className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                            >
                              <X className="w-4 h-4" />
                              <span>Reject</span>
                            </button>
                          </div>
                        )}
                        {prospect.approvalStatus !== 'pending' && (
                          <div className="col-span-2 mt-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              prospect.approvalStatus === 'approved' 
                                ? 'bg-green-600 text-green-100' 
                                : 'bg-red-600 text-red-100'
                            }`}>
                              {prospect.approvalStatus}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
              )
              }) : []) // Close expandedSearchGroups conditional
            ])} {/* Close sortedSearchGroups.flatMap */}
          </tbody>
        </table>
        {filteredProspects.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 mb-2">No Prospects Found</h3>
            <p className="text-gray-500">
              {searchTerm || filterStatus !== 'all' ? 'Try adjusting your filters' : 'Upload prospects to get started'}
            </p>
          </div>
        )}

        {/* Results Summary - No Pagination */}
        {pagination.total > 0 && (
          <div className="border-t border-gray-700 px-6 py-4 flex items-center justify-between bg-gray-900">
            <div className="text-sm text-gray-400">
              Showing all {pagination.total} prospects across {sortedSearchGroups.length} searches
            </div>
            <div className="text-sm text-gray-500">
              {sortedSearchGroups.filter(([name]) => expandedSearchGroups.has(name)).length} searches expanded
            </div>
          </div>
        )}

        {/* OLD PAGINATION REMOVED - Show all prospects in grouped sections */}
        {false && pagination.total > 0 && (
          <div className="border-t border-gray-700 px-6 py-4 flex items-center justify-between bg-gray-900" style={{display: 'none'}}>
            <div className="text-sm text-gray-400"></div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {}}
                disabled={true}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                First
              </button>

              <button
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={!pagination.hasPrev || isLoadingSessions}
                className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Previous
              </button>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Page</span>
                <select
                  value={pagination.page}
                  onChange={(e) => setCurrentPage(Number(e.target.value))}
                  disabled={isLoadingSessions}
                  className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-gray-300 text-sm disabled:opacity-50"
                >
                  {Array.from({ length: pagination.totalPages }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-gray-400">of {pagination.totalPages}</span>
              </div>

              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={!pagination.hasNext || isLoadingSessions}
                className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Next
              </button>

              <button
                onClick={() => setCurrentPage(pagination.totalPages)}
                disabled={!pagination.hasNext || isLoadingSessions}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Last
              </button>
            </div>

            {/* Page size info */}
            <div className="text-sm text-gray-400">
              {pagination.limit} per page
            </div>
          </div>
        )}
      </div>
        </div>
      </div>
      {/* Import Prospects Modal */}
      <ImportProspectsModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        initialTab={importInitialTab}
        isProcessingPaste={isProcessingPaste}
        isProcessingUrl={isProcessingUrl}
        isProcessingCsv={isUploadingCsv}
        isProcessingQuickAdd={isAddingQuickProspect}
        onCsvUpload={handleCsvUpload}
        onQuickAdd={handleQuickAddProspect}
        onPaste={async (text: string) => {
          setIsProcessingPaste(true)
          try {
            const lines = text.trim().split('\n')
            const newProspects: ProspectData[] = []
            for (const line of lines) {
              if (!line.trim()) continue
              const parts = line.includes('\t') ? line.split('\t') : line.split(',')
              const cleanParts = parts.map(p => p.trim())
              if (cleanParts.length >= 2) {
                newProspects.push({
                  id: `paste_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  name: cleanParts[0] || 'Unknown',
                  title: cleanParts[1] || '',
                  company: cleanParts[2] || '',
                  location: '',
                  email: cleanParts[3] || '',
                  linkedinUrl: cleanParts[4] || '',
                  contact: { email: cleanParts[3] || '', linkedin_url: cleanParts[4] || '' },
                  source: 'manual' as const,
                  approvalStatus: 'pending' as const,
                  campaignName: `${today}-${workspaceCode}-Pasted Data`,
                  campaignTag: 'paste-import',
                  uploaded: true
                })
              }
            }
            if (newProspects.length > 0) {
              setProspectData(prev => [...newProspects, ...prev])
              toastSuccess(`Added ${newProspects.length} prospects from pasted data`)
            } else {
              toastError('No valid prospect data found')
            }
            setShowImportModal(false)
          } catch (error) {
            console.error('Paste processing error:', error)
            toastError('Error processing pasted data')
          } finally {
            setIsProcessingPaste(false)
          }
        }}
        onLinkedInUrl={async (url: string) => {
          setIsProcessingUrl(true)
          try {
            const isSavedSearchReference = url.match(/savedSearchId=(\d+)(?!.*[?&]query=|.*[?&]filters=)/)
            if (isSavedSearchReference) {
              const searchId = isSavedSearchReference[1]
              toastError(`Saved Search Reference URLs are not supported. Please open the saved search, wait for results to load, then copy the full URL.`)
              return
            }
            const isSavedSearch = url.includes('/sales/search/') || url.includes('/recruiting/search/')
            const endpoint = isSavedSearch ? '/api/linkedin/import-saved-search' : '/api/linkedin/search/simple'
            const requestBody = isSavedSearch
              ? { saved_search_url: url.trim(), campaign_name: `${today}-${workspaceCode}-SavedSearch` }
              : { search_criteria: { url: url.trim() }, target_count: 50 }
            const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) })
            if (response.ok) {
              const data = await response.json()
              if (data.success && data.count !== undefined) {
                toastSuccess(`Imported ${data.count} prospects from saved search. Refreshing...`)
                window.location.reload()
                return
              } else if (data.success && data.prospects && data.prospects.length > 0) {
                const newProspects: ProspectData[] = data.prospects.map((p: any, index: number) => ({
                  id: `linkedin_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
                  name: p.fullName || p.name || 'Unknown',
                  title: p.title || '',
                  company: p.company || '',
                  location: '',
                  email: p.email || '',
                  linkedinUrl: p.linkedinUrl || '',
                  contact: { email: p.email || '', linkedin_url: p.linkedinUrl || '' },
                  source: 'linkedin' as const,
                  confidence: p.confidence || 0.7,
                  approvalStatus: 'pending' as const,
                  campaignName: `${today}-${workspaceCode}-LinkedIn Search`,
                  campaignTag: 'linkedin-url',
                  uploaded: true
                }))
                setProspectData(prev => [...newProspects, ...prev])
                toastSuccess(`Found ${newProspects.length} prospects from LinkedIn URL`)
              } else {
                toastError('No prospects found in LinkedIn URL')
              }
              setShowImportModal(false)
            } else {
              const errorData = await response.json().catch(() => ({}))
              const errorMsg = errorData.error || `Failed to search LinkedIn (HTTP ${response.status})`
              toastError(errorMsg)
              console.error('LinkedIn search API error:', errorData)
            }
          } catch (error) {
            console.error('LinkedIn URL processing error:', error)
            toastError('Error processing LinkedIn URL')
          } finally {
            setIsProcessingUrl(false)
          }
        }}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.type === 'danger' ? 'Delete' : 'Confirm'}
      />

      {/* Campaign Type Selection Modal */}
      <CampaignTypeModal
        isOpen={showCampaignTypeModal}
        onClose={() => setShowCampaignTypeModal(false)}
        onSelectType={(type) => {
          setSelectedCampaignType(type);
          setShowCampaignTypeModal(false);

          // Get prospects to send (selected or all approved)
          const approvedProspects = prospectData.filter(p => p.approvalStatus === 'approved');
          const prospectsToSend = selectedProspectIds.size > 0
            ? approvedProspects.filter(p => selectedProspectIds.has(p.id))
            : approvedProspects;

          // Forward to Campaign Hub with campaign type
          handleProceedToCampaignHub(prospectsToSend, type);
        }}
        prospectCount={selectedProspectIds.size > 0 ? selectedProspectIds.size : prospectData.filter(p => p.approvalStatus === 'approved').length}
      />
    </div>
  )
}

// Helper functions for data collection

async function collectLinkedInData(query: string, workspaceCode: string, connectionDegree: '1st' | '2nd' | '3rd' = '2nd'): Promise<ProspectData[]> {
  try {
    // Auto-generate campaign name: YYYYMMDD-XXX-ProjectName (XXX = workspace code)
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const campaignName = `${today}-${workspaceCode}-LinkedIn`

    // Detect if query is a LinkedIn URL or keywords
    const isUrl = query.startsWith('http') || query.includes('linkedin.com')

    // Call working API that saves to approval tables
    const response = await fetch('/api/linkedin/search/simple', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        search_criteria: isUrl
          ? { keywords: query, connectionDegree } // URL searches treated as keywords with user-selected degree
          : { keywords: query, connectionDegree }, // Use user-selected connection degree
        target_count: 50
      })
    })

    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.success && data.prospects) {
      return data.prospects.map((prospect: any) => ({
        id: `linkedin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: prospect.fullName || prospect.name || 'Unknown',
        title: prospect.title || 'Not specified',
        company: prospect.company || 'Unknown Company',
        email: null, // Not available from LinkedIn search
        phone: null, // Not available from LinkedIn search
        linkedinUrl: prospect.linkedinUrl || prospect.linkedin_profile_url || null,
        source: 'linkedin_search' as const,
        confidence: 0.8, // High confidence since from official LinkedIn API
        complianceFlags: [],
        campaignName: campaignName,
        campaignTag: campaignName,
        approvalStatus: 'pending' as const
      }))
    } else {
      throw new Error(data.error || 'No prospects found')
    }
  } catch (error) {
    console.error('LinkedIn API search failed:', error)
    // Fallback to mock data for development
    const titles = ['VP Sales', 'Sales Director', 'Head of Sales', 'Sales Manager', 'Business Development Manager']
    const companies = ['TechCorp', 'SaaS Solutions', 'DataVantage', 'CloudFirst', 'AI Systems']
    
    return Array.from({ length: Math.floor(Math.random() * 15) + 5 }, (_, i) => ({
      id: `linkedin_mock_${Date.now()}_${i}`,
      name: `LinkedIn Prospect ${i + 1}`,
      title: titles[Math.floor(Math.random() * titles.length)],
      company: companies[Math.floor(Math.random() * companies.length)],
      email: `prospect${i + 1}@${companies[Math.floor(Math.random() * companies.length)].toLowerCase().replace(/[^a-z]/g, '')}.com`,
      linkedinUrl: `https://linkedin.com/in/prospect-${i + 1}`,
      source: 'unipile' as const,
      confidence: Math.round((Math.random() * 0.4 + 0.6) * 100) / 100,
      complianceFlags: Math.random() > 0.8 ? ['gdpr-review'] : []
    }))
  }
}

async function collectBrightData(query: string): Promise<ProspectData[]> {
  // TODO: Integrate with actual Bright Data MCP tools
  // For now, simulate Bright Data enrichment
  
  const industries = ['FinTech', 'HealthTech', 'EdTech', 'E-commerce', 'SaaS']
  const titles = ['CEO', 'CTO', 'VP Marketing', 'Director of Growth', 'Head of Product']
  
  return Array.from({ length: Math.floor(Math.random() * 20) + 10 }, (_, i) => ({
    id: `bright_${Date.now()}_${i}`,
    name: `Enriched Contact ${i + 1}`,
    title: titles[Math.floor(Math.random() * titles.length)],
    company: `${industries[Math.floor(Math.random() * industries.length)]} Company ${i + 1}`,
    email: `contact${i + 1}@company${i + 1}.com`,
    phone: `+1 (555) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
    source: 'bright-data' as const,
    confidence: Math.round((Math.random() * 0.3 + 0.7) * 100) / 100,
    complianceFlags: []
  }))
}

// Campaign Type Selection Modal Component
function CampaignTypeModal({
  isOpen,
  onClose,
  onSelectType,
  prospectCount
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: 'email' | 'linkedin') => void;
  prospectCount: number;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Choose Campaign Type</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-400 text-sm mb-6">
          Select the type of campaign to create with {prospectCount} prospects
        </p>

        <div className="space-y-3">
          {/* Email Campaign Option */}
          <button
            onClick={() => onSelectType('email')}
            className="w-full p-4 rounded-lg border-2 border-gray-700 hover:border-blue-500 hover:bg-gray-750 transition-all group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 group-hover:bg-blue-600/30">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="text-white font-semibold">Email Campaign</div>
                <div className="text-gray-400 text-sm">Send emails to prospects with email addresses</div>
              </div>
            </div>
          </button>

          {/* LinkedIn Campaign Option */}
          <button
            onClick={() => onSelectType('linkedin')}
            className="w-full p-4 rounded-lg border-2 border-gray-700 hover:border-purple-500 hover:bg-gray-750 transition-all group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-600/20 text-purple-400 group-hover:bg-purple-600/30">
                <Linkedin className="w-5 h-5" />
              </div>
              <div>
                <div className="text-white font-semibold">LinkedIn Campaign</div>
                <div className="text-gray-400 text-sm">Send connection requests and messages on LinkedIn</div>
              </div>
            </div>
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
