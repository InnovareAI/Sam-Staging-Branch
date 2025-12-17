'use client'

import { Check, ChevronDown, ChevronUp, ChevronRight, Download, Search, Tag, Users, X, Upload, FileText, Link, Sparkles, Mail, Phone, Linkedin, Star, Plus, CheckSquare, Trash2, UserPlus, MessageSquare, Loader2, AlertTriangle, AlertCircle, CheckCircle, XCircle, Send } from 'lucide-react';
import { toastError, toastSuccess, toastInfo } from '@/lib/toast';
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

// Duplicate Warning Type
type DuplicateWarning = {
  type: 'email' | 'linkedin'
  identifier: string
  existing_campaign_id: string
  existing_campaign_name: string
  existing_campaign_type: string
  blocking: boolean
}

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
  duplicateWarning?: DuplicateWarning  // Duplicate detection warning
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

// Duplicate Warning Badge Component
function DuplicateWarningBadge({
  warning,
  prospectId,
  onRemoveFromCampaign
}: {
  warning: DuplicateWarning
  prospectId: string
  onRemoveFromCampaign: (campaignId: string, identifier: string, type: string) => Promise<void>
}) {
  const [isRemoving, setIsRemoving] = useState(false)

  const handleRemove = async () => {
    setIsRemoving(true)
    try {
      await onRemoveFromCampaign(
        warning.existing_campaign_id,
        warning.identifier,
        warning.type
      )
      toastSuccess(`Removed from ${warning.existing_campaign_name}`)
    } catch (error) {
      toastError('Failed to remove from campaign')
    } finally {
      setIsRemoving(false)
    }
  }

  if (warning.blocking) {
    // LinkedIn campaigns - hard block
    return (
      <div className="mt-2 p-2 bg-red-600/20 border border-red-600/30 rounded flex items-start gap-2">
        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-xs">
          <p className="text-red-300 font-medium">
            Already in {warning.existing_campaign_name}
          </p>
          <p className="text-red-400/80 mt-0.5">
            LinkedIn profiles can only be in one campaign at a time
          </p>
        </div>
      </div>
    )
  }

  // Email campaigns - warning with action
  return (
    <div className="mt-2 p-2 bg-yellow-600/20 border border-yellow-600/30 rounded flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 text-xs">
        <p className="text-yellow-300 font-medium">
          Also in {warning.existing_campaign_name}
        </p>
        <p className="text-yellow-400/80 mt-0.5">
          This email is already in another campaign
        </p>
        <button
          onClick={handleRemove}
          disabled={isRemoving}
          className="mt-1 px-2 py-1 text-xs bg-yellow-600/30 hover:bg-yellow-600/50 rounded text-yellow-200 disabled:opacity-50"
        >
          {isRemoving ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
              Removing...
            </>
          ) : (
            'Remove from that campaign'
          )}
        </button>
      </div>
    </div>
  )
}

interface DataCollectionHubProps {
  onDataCollected: (data: ProspectData[], source: string) => void
  onApprovalComplete?: (approvedData: ProspectData[], campaignType?: 'email' | 'linkedin' | 'connector' | 'messenger' | 'inmail' | 'open_inmail', draftId?: string) => void
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

  // Modal states (defined early so useQuery can reference them for refetch control)
  const [showPreflightModal, setShowPreflightModal] = useState(false)
  // CRITICAL FIX (Dec 7): Combine modal state to avoid async race condition
  const [campaignModal, setCampaignModal] = useState<{
    isOpen: boolean;
    approvedProspects: any[];
  }>({ isOpen: false, approvedProspects: [] })

  // REACT QUERY: Fetch and cache approval sessions with pagination
  const queryClient = useQueryClient()
  const { data, isLoading: isLoadingSessions, refetch } = useQuery({
    queryKey: ['approval-sessions', currentPage, pageSize, filterStatus, actualWorkspaceId],
    queryFn: () => fetchApprovalSessions(currentPage, pageSize, filterStatus, actualWorkspaceId),
    staleTime: 10000, // Cache for 10 seconds (faster page loads)
    refetchInterval: campaignModal.isOpen || showPreflightModal ? false : 30000, // Pause refetch when modals open
    refetchOnWindowFocus: !campaignModal.isOpen && !showPreflightModal, // Don't refetch when modals open
    keepPreviousData: true, // Smooth page transitions
    enabled: !!actualWorkspaceId && !workspacesLoading && userVerified, // Only fetch after user verified AND workspace validated
  })

  // REACT QUERY: Check for connected email accounts
  const { data: emailAccountsData } = useQuery({
    queryKey: ['email-accounts', actualWorkspaceId],
    queryFn: async () => {
      if (!actualWorkspaceId) return { hasEmailAccount: false };
      const { data, error } = await supabase
        .from('workspace_accounts')
        .select('id, provider, status')
        .eq('workspace_id', actualWorkspaceId)
        .in('provider', ['postmark', 'gmail', 'outlook', 'smtp'])
        .eq('status', 'active')
        .limit(1);

      return { hasEmailAccount: !error && data && data.length > 0 };
    },
    staleTime: 60000, // Cache for 1 minute
    enabled: !!actualWorkspaceId && !workspacesLoading && userVerified,
  })
  const hasEmailAccount = emailAccountsData?.hasEmailAccount || false;

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

  // Campaign type selection modal (showCampaignTypeModal defined earlier for useQuery)
  const [selectedCampaignType, setSelectedCampaignType] = useState<'email' | 'linkedin' | 'connector' | 'messenger' | null>(null)

  // Pre-flight verification state (showPreflightModal defined earlier for useQuery)
  const [isRunningPreflight, setIsRunningPreflight] = useState(false)
  const [preflightResults, setPreflightResults] = useState<any>(null)
  const [pendingCampaignType, setPendingCampaignType] = useState<'email' | 'linkedin' | 'connector' | 'messenger' | null>(null)
  const [pendingCampaignName, setPendingCampaignName] = useState<string>('')
  const [pendingProspects, setPendingProspects] = useState<any[]>([])

  // Available prospects (approved but not in campaigns)
  const [availableProspects, setAvailableProspects] = useState<any[]>([])
  const [loadingAvailableProspects, setLoadingAvailableProspects] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0) // Trigger to force refresh

  // Data validation modal state
  const [showDataValidationModal, setShowDataValidationModal] = useState(false)
  const [dataValidationResults, setDataValidationResults] = useState<{
    totalProspects: number
    missingLinkedIn: number
    missingEmail: number
    missingConnectionDegree: number
    prospects: any[]
  } | null>(null)

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

  // Duplicate warnings tracking
  const [duplicateWarnings, setDuplicateWarnings] = useState<Map<string, DuplicateWarning>>(new Map())

  // Attach duplicate warnings to prospects when data loads or warnings change
  useEffect(() => {
    if (serverProspects.length > 0 && duplicateWarnings.size > 0) {
      const prospectsWithWarnings = serverProspects.map(p => {
        // Check for duplicate warning by LinkedIn URL
        const linkedinUrl = p.linkedinUrl
        if (linkedinUrl) {
          const warning = duplicateWarnings.get(linkedinUrl)
          if (warning) {
            return { ...p, duplicateWarning: warning }
          }
        }

        // Check for duplicate warning by email
        const email = p.email
        if (email) {
          const warning = duplicateWarnings.get(email)
          if (warning) {
            return { ...p, duplicateWarning: warning }
          }
        }

        return p
      })
      setProspectData(prospectsWithWarnings)
    } else if (serverProspects.length > 0) {
      // No warnings, just set the prospects
      setProspectData(serverProspects)
    }
  }, [serverProspects, duplicateWarnings])

  // Remove prospect from existing campaign
  const handleRemoveFromCampaign = async (
    campaignId: string,
    identifier: string,
    type: 'email' | 'linkedin'
  ) => {
    try {
      const response = await fetch(
        `/api/prospect-approval/remove-from-campaign?` +
        `campaign_id=${campaignId}&identifier=${encodeURIComponent(identifier)}&type=${type}`,
        { method: 'DELETE' }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to remove prospect')
      }

      // Update local state - remove duplicate warning for this prospect
      const updatedWarnings = new Map(duplicateWarnings)
      // Find and remove the warning by matching identifier
      for (const [key, warning] of updatedWarnings) {
        if (warning.identifier === identifier && warning.type === type) {
          updatedWarnings.delete(key)
        }
      }
      setDuplicateWarnings(updatedWarnings)

      // Update prospect data to remove duplicate warning
      setProspectData(prev => prev.map(p => {
        const prospectIdentifier = type === 'email'
          ? p.email
          : p.linkedinUrl

        if (prospectIdentifier === identifier) {
          return { ...p, duplicateWarning: undefined }
        }
        return p
      }))

      return data
    } catch (error) {
      console.error('Remove from campaign error:', error)
      throw error
    }
  }

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
          // Show detailed error message with debug info if available
          let errorMessage = errorData.error || 'Failed to upload CSV file'

          // Log debug info for troubleshooting
          if (errorData.debug) {
            console.error('CSV Upload Debug Info:', {
              headers: errorData.debug.headers,
              totalRows: errorData.debug.totalRows,
              skipBreakdown: errorData.debug.skipBreakdown,
              skippedRows: errorData.debug.skippedRows
            })
          }

          toastError(errorMessage)
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

          // Store duplicate warnings if any exist
          if (data.duplicate_warnings && data.duplicate_warnings.length > 0) {
            const warningsMap = new Map<string, DuplicateWarning>()
            data.duplicate_warnings.forEach((warning: DuplicateWarning) => {
              // Use identifier as key
              warningsMap.set(warning.identifier, warning)
            })
            setDuplicateWarnings(warningsMap)

            // Show summary toast
            toastInfo(
              `Uploaded ${data.count} prospects. ` +
              `${data.duplicate_warnings.length} duplicate(s) detected - review warnings during approval.`
            )
          } else {
            toastSuccess(`✅ Added ${data.count || 0} prospects from pasted data and saved to database`)
          }

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
  // DON'T sync when campaign type modal is open (prevents data clearing mid-selection)
  useEffect(() => {
    if (serverProspects.length > 0 && !campaignModal.isOpen && !showPreflightModal) {
      setProspectData(serverProspects)
    }
  }, [serverProspects, campaignModal.isOpen, showPreflightModal])

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
        // API returns { success, data: { campaigns } } via apiSuccess()
        const campaignsList = data.data?.campaigns || data.campaigns || []
        const activeCampaigns = campaignsList.filter(
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

  // Helper function to validate prospect data and show modal if issues found
  const validateAndShowModal = (prospects: any[]) => {
    const hasLinkedIn = (p: any) => p.linkedinUrl || p.linkedin_url || p.contact?.linkedin_url
    const hasEmail = (p: any) => {
      const email = p.email || p.email_address || p.contact?.email
      return email && typeof email === 'string' && email.trim().length > 0
    }
    const hasConnectionDegree = (p: any) => {
      const degree = p.connectionDegree || p.connection_degree
      return degree !== undefined && degree !== null && degree !== ''
    }

    const missingLinkedIn = prospects.filter(p => !hasLinkedIn(p)).length
    const missingEmail = prospects.filter(p => !hasEmail(p)).length
    const missingConnectionDegree = prospects.filter(p => !hasConnectionDegree(p)).length

    // Only show modal if there are issues
    if (missingLinkedIn > 0 || missingEmail > 0 || missingConnectionDegree > 0) {
      setDataValidationResults({
        totalProspects: prospects.length,
        missingLinkedIn,
        missingEmail,
        missingConnectionDegree,
        prospects
      })
      setShowDataValidationModal(true)
    }
  }

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

        // Show data validation modal if there are missing fields
        validateAndShowModal(prospects)

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

        // Show data validation modal if there are missing fields
        validateAndShowModal(linkedinData)

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

      // Show data validation modal if there are missing fields
      validateAndShowModal(enrichedData)

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
    // Dec 8 FIX: Prevent data leakage - use only most recent session if no selection
    const approvedProspects = prospectData.filter(p => p.approvalStatus === 'approved')

    let prospectsToAdd: ProspectData[]
    if (selectedProspectIds.size > 0) {
      // User explicitly selected prospects - use exactly those
      prospectsToAdd = approvedProspects.filter(p => selectedProspectIds.has(p.id))
    } else if (approvedProspects.length > 0) {
      // No explicit selection - ONLY use prospects from the most recent session
      const sortedByDate = [...approvedProspects].sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0
        const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0
        return dateB - dateA
      })
      const mostRecentSessionId = sortedByDate[0]?.sessionId

      if (mostRecentSessionId) {
        prospectsToAdd = approvedProspects.filter(p => p.sessionId === mostRecentSessionId)
        console.log(`📊 [DATA LEAKAGE FIX] Adding ${prospectsToAdd.length} prospects from most recent session: ${mostRecentSessionId.substring(0, 8)}`)
      } else {
        prospectsToAdd = [sortedByDate[0]]
      }
    } else {
      prospectsToAdd = []
    }

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

      console.log('📋 Sending prospect IDs to campaign:', prospectIds.slice(0, 5))
      console.log('📋 Sample prospect data:', prospectsToAdd.slice(0, 2).map(p => ({ id: p.id, name: p.name, sessionId: p.sessionId })))

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
          const errorMsg = data.error || 'Failed to add prospects to campaign'
          if (errorMsg.includes('verify') || errorMsg.includes('not found') || errorMsg.includes('invalid')) {
            toastError(`${errorMsg}\n\nPlease refresh the page and re-upload your CSV file.`)
          } else {
            toastError(errorMsg)
          }
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
  const performCampaignHubNavigation = async (approvedProspects: ProspectData[], campaignType?: 'email' | 'linkedin' | 'connector' | 'messenger' | 'inmail' | 'open_inmail') => {
    // CRITICAL FIX: Save approved prospects to database FIRST to get prospect_ids
    setLoading(true)
    setLoadingMessage(`Saving ${approvedProspects.length} approved prospects...`)

    // Dec 8 CRITICAL FIX: DO NOT fetch from /api/prospect-approval/approved
    // That endpoint returns ALL approved prospects in the session, which can include
    // prospects from previous uploads (data leakage). Instead, use the prospects
    // passed in directly - they are already the user's explicit selection.
    //
    // Previous bug: User selects 2 → uploads → fetches ALL 6 from session → 6 in campaign
    // Fix: User selects 2 → passes 2 directly → 2 in campaign
    const savedProspects = approvedProspects;
    console.log(`📊 [DATA LEAKAGE FIX] Using ${savedProspects.length} prospects directly (no database fetch)`)

    // CHANGED (Dec 8): Do NOT create draft here - just pass prospects to CampaignHub
    // Draft/campaign will be created when user actually saves or activates
    // This allows user to see prospects BEFORE any database record is created
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
    // NOTE: No draftId - campaign will be created when user saves/activates in CampaignHub
    console.log('🚀 Calling onApprovalComplete with:', {
      prospectsCount: savedProspects.length,
      campaignType,
      sample: savedProspects[0]
    });

    if (onApprovalComplete) {
      onApprovalComplete(savedProspects, campaignType || undefined, undefined) // No draftId - prospects passed directly
    } else {
      console.error('❌ onApprovalComplete callback is not defined!');
    }

    toastSuccess(`✅ Success!\n\n${approvedProspects.length} approved prospects ready for campaign\n\nNext: Select or create a campaign to add them to`)
  }

  // Proceed to Campaign Hub with approved prospects ONLY (disregard rejected and pending)
  const handleProceedToCampaignHub = async (prospectsOverride?: ProspectData[], campaignType?: 'email' | 'linkedin' | 'connector' | 'messenger' | 'inmail' | 'open_inmail') => {
    console.log('🎯 handleProceedToCampaignHub CALLED:', {
      prospectsOverride: prospectsOverride?.length,
      campaignType,
      sample: prospectsOverride?.[0]
    });

    // When prospectsOverride is provided (from preflight), use them directly
    // These prospects have already been validated by preflight check
    // Only filter by approvalStatus when using prospectData (local state)
    let approvedProspects: ProspectData[];

    if (prospectsOverride && prospectsOverride.length > 0) {
      // From preflight - prospects are validated, use them directly
      // They may not have approvalStatus set, so don't filter by it
      approvedProspects = prospectsOverride;
      console.log('📊 Using preflight-validated prospects:', approvedProspects.length);
    } else {
      // From local state - filter by approval status
      approvedProspects = prospectData.filter(p => p.approvalStatus === 'approved');
      console.log('📊 Using locally approved prospects:', approvedProspects.length);
    }

    if (approvedProspects.length === 0) {
      toastError('⚠️ No prospects found. Please approve prospects before proceeding to Campaign Hub.')
      return
    }

    // Campaign tags check removed - confusing to users since campaign name IS assigned
    // Prospects are properly associated with the campaign regardless of this field

    // Proceed directly to campaign creation
    await performCampaignHubNavigation(approvedProspects, campaignType)
  }

  // Auto-detect campaign type and go directly to preflight (NO manual selection)
  const autoDetectAndCreateCampaign = async () => {
    // CRITICAL: Check workspace ID first - this is the most common cause of failure
    if (!actualWorkspaceId) {
      toastError('No workspace selected. Please select a workspace from the sidebar before creating a campaign.')
      console.error('❌ Create Campaign failed: actualWorkspaceId is undefined/null')
      return
    }

    const approvedProspects = prospectData.filter(p => p.approvalStatus === 'approved')

    // Dec 8 FIX: Prevent data leakage across sessions
    // If no prospects explicitly selected, use ONLY the most recently approved prospect's session
    // This prevents accidentally including approved prospects from old/unrelated sessions
    let prospectsToSend: ProspectData[]
    if (selectedProspectIds.size > 0) {
      // User explicitly selected prospects - use exactly those
      prospectsToSend = approvedProspects.filter(p => selectedProspectIds.has(p.id))
    } else if (approvedProspects.length > 0) {
      // No explicit selection - ONLY use prospects from the most recent session
      // Sort by creation date and get the most recent prospect's session
      const sortedByDate = [...approvedProspects].sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0
        const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0
        return dateB - dateA // Most recent first
      })
      const mostRecentSessionId = sortedByDate[0]?.sessionId

      if (mostRecentSessionId) {
        prospectsToSend = approvedProspects.filter(p => p.sessionId === mostRecentSessionId)
        console.log(`📊 [DATA LEAKAGE FIX] Using ${prospectsToSend.length} prospects from most recent session: ${mostRecentSessionId.substring(0, 8)}`)
      } else {
        // Fallback if no sessionId - use just the most recent one
        prospectsToSend = [sortedByDate[0]]
        console.log('⚠️ [DATA LEAKAGE FIX] No sessionId found, using single most recent prospect')
      }
    } else {
      prospectsToSend = []
    }

    if (prospectsToSend.length === 0) {
      toastError('No approved prospects to create campaign. Please approve some prospects first.')
      return
    }

    // Helper to check LinkedIn URL
    const hasLinkedIn = (p: any) => p.contact?.linkedin_url || p.linkedin_url || p.linkedinUrl

    // Helper to check if email exists (must be non-empty string)
    const hasEmail = (p: any) => {
      const email = p.contact?.email || p.email || p.email_address;
      return email && typeof email === 'string' && email.trim().length > 0;
    }

    // Count eligible prospects for each type
    // MESSENGER: Must be 1st degree connection
    const messengerProspects = prospectsToSend.filter(p => {
      if (!hasLinkedIn(p)) return false
      const degree = String(p.connection_degree || p.connectionDegree || '').toLowerCase()
      return degree.includes('1st') || degree === '1'
    })

    // CONNECTOR: Has LinkedIn but NOT 1st degree (includes unknown/empty degree)
    // If degree is empty, assume they need a connection request
    const connectorProspects = prospectsToSend.filter(p => {
      if (!hasLinkedIn(p)) return false
      const degree = String(p.connection_degree || p.connectionDegree || '').toLowerCase()
      // Not 1st degree = needs connection request
      return !degree.includes('1st') && degree !== '1'
    })

    // EMAIL: Has email address
    const emailProspects = prospectsToSend.filter(p => hasEmail(p))

    console.log('📊 Campaign type eligibility:', {
      total: prospectsToSend.length,
      messenger: messengerProspects.length,
      connector: connectorProspects.length,
      email: emailProspects.length,
      workspaceId: actualWorkspaceId
    })

    // Auto-detect: use the type with the most eligible prospects
    let detectedType: 'connector' | 'messenger' | 'email'
    let eligibleProspects: any[]

    if (messengerProspects.length > 0 && messengerProspects.length >= connectorProspects.length) {
      detectedType = 'messenger'
      eligibleProspects = messengerProspects
    } else if (connectorProspects.length > 0) {
      detectedType = 'connector'
      eligibleProspects = connectorProspects
    } else if (emailProspects.length > 0) {
      detectedType = 'email'
      eligibleProspects = emailProspects
    } else {
      // More helpful error message
      const hasLinkedInUrls = prospectsToSend.some(p => hasLinkedIn(p))
      const hasEmails = prospectsToSend.some(p => hasEmail(p))

      if (!hasLinkedInUrls && !hasEmails) {
        toastError('No eligible prospects found. Your prospects need either LinkedIn URLs or email addresses.')
      } else if (hasLinkedInUrls && !hasEmails) {
        toastError('LinkedIn prospects found but no connection degree set. This is needed to determine campaign type.')
      } else {
        toastError('No eligible prospects found. Please check prospect data has LinkedIn URLs or emails.')
      }
      return
    }

    console.log(`📊 Auto-detected campaign type: ${detectedType} (${eligibleProspects.length} eligible prospects)`)
    toastInfo(`Creating ${detectedType === 'messenger' ? 'Messenger' : detectedType === 'connector' ? 'Connector' : 'Email'} campaign with ${eligibleProspects.length} prospects`)

    // Set state and run preflight
    setSelectedCampaignType(detectedType)
    setPendingCampaignType(detectedType)
    setPendingProspects(eligibleProspects)
    setIsRunningPreflight(true)
    setShowPreflightModal(true)

    try {
      const response = await fetch('/api/linkedin/preflight-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospects: eligibleProspects,
          workspaceId: actualWorkspaceId,
          campaignType: detectedType
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ Pre-flight API error:', response.status, errorData)

        if (response.status === 401) {
          toastError('Session expired. Please refresh the page and try again.')
        } else if (response.status === 403) {
          toastError('You don\'t have access to this workspace. Please check your workspace membership.')
        } else {
          toastError(`Pre-flight check failed: ${errorData.error || 'Unknown error'}`)
        }
        setShowPreflightModal(false)
        return
      }

      const data = await response.json()
      console.log('📊 Pre-flight results:', data.summary)
      setPreflightResults(data)
    } catch (error: any) {
      console.error('Pre-flight check failed:', error)
      const errorMsg = error?.message || error?.toString() || 'Unknown error'
      toastError(`Failed to verify prospects: ${errorMsg}. Please refresh and try again.`)
      setShowPreflightModal(false)
    } finally {
      setIsRunningPreflight(false)
    }
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

              {/* Button: Approve Selected (conditional - only when prospects are selected) */}
              {selectedProspectIds.size > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    const selectedIds = Array.from(selectedProspectIds)
                    const selectedProspects = prospectData.filter(p => selectedIds.includes(p.id) && p.approvalStatus !== 'approved')
                    if (selectedProspects.length === 0) {
                      toastInfo('All selected prospects are already approved')
                      return
                    }
                    setProspectData(prev => prev.map(p =>
                      selectedIds.includes(p.id)
                        ? { ...p, approvalStatus: 'approved' as const }
                        : p
                    ))
                    toastSuccess(`✅ Approved ${selectedProspects.length} prospect(s)`)
                    // Update in database
                    for (const prospect of selectedProspects) {
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
                    // Also update in workspace_prospects if they're from new architecture
                    if (workspaceId) {
                      try {
                        await fetch('/api/prospects/approve', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            workspaceId,
                            action: 'approve',
                            prospectIds: selectedIds
                          })
                        })
                      } catch (error) {
                        console.error('Error approving in workspace_prospects:', error)
                      }
                    }
                    setSelectedProspectIds(new Set()) // Clear selection after action
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg text-white bg-green-600 hover:bg-green-700 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Approve ({selectedProspectIds.size})</span>
                </button>
              )}

              {/* Button: Reject Selected (conditional - only when prospects are selected) */}
              {selectedProspectIds.size > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    const selectedIds = Array.from(selectedProspectIds)
                    const selectedProspects = prospectData.filter(p => selectedIds.includes(p.id) && p.approvalStatus !== 'rejected')
                    if (selectedProspects.length === 0) {
                      toastInfo('All selected prospects are already rejected')
                      return
                    }
                    setProspectData(prev => prev.map(p =>
                      selectedIds.includes(p.id)
                        ? { ...p, approvalStatus: 'rejected' as const }
                        : p
                    ))
                    toastSuccess(`❌ Rejected ${selectedProspects.length} prospect(s)`)
                    // Update in database
                    for (const prospect of selectedProspects) {
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
                    // Also update in workspace_prospects if they're from new architecture
                    if (workspaceId) {
                      try {
                        await fetch('/api/prospects/approve', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            workspaceId,
                            action: 'reject',
                            prospectIds: selectedIds
                          })
                        })
                      } catch (error) {
                        console.error('Error rejecting in workspace_prospects:', error)
                      }
                    }
                    setSelectedProspectIds(new Set()) // Clear selection after action
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg text-white bg-orange-600 hover:bg-orange-700 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject ({selectedProspectIds.size})</span>
                </button>
              )}

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
                  {/* Create New Campaign - Shows campaign type selection modal */}
                  <button
                    type="button"
                    onClick={async () => {
                      // Validate before showing modal
                      if (!actualWorkspaceId) {
                        toastError('No workspace selected. Please select a workspace from the sidebar.')
                        return
                      }

                      // Use SELECTED prospects (checked boxes) for campaign creation
                      const selectedIds = Array.from(selectedProspectIds)
                      const selectedProspects = prospectData.filter(p => selectedIds.includes(p.id))

                      console.log('🔍 DEBUG: Selected prospects for campaign:', selectedProspects.map(p => ({
                        id: p.id,
                        name: p.name,
                        email: p.email || p.contact?.email,
                        linkedin_url: p.linkedin_url || p.contact?.linkedin_url,
                        connection_degree: p.connection_degree || p.connectionDegree
                      })))

                      if (selectedProspects.length === 0) {
                        toastError('No prospects selected. Please check the boxes next to prospects you want in the campaign.')
                        return
                      }

                      console.log('📊 Opening campaign modal with', selectedProspects.length, 'selected prospects')

                      // CRITICAL FIX: Single atomic state update prevents React batching race condition
                      setCampaignModal({
                        isOpen: true,
                        approvedProspects: selectedProspects
                      })
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-colors font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Campaign ({selectedProspectIds.size > 0 ? selectedProspectIds.size : campaignModal.approvedProspects.length || 0})</span>
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
                      disabled={prospect.duplicateWarning?.blocking}
                      aria-label={`Select ${prospect.name}`}
                      className={`w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-800 ${
                        prospect.duplicateWarning?.blocking ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      title={prospect.duplicateWarning?.blocking ? 'Cannot approve - already in another LinkedIn campaign' : undefined}
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
                          disabled={prospect.duplicateWarning?.blocking}
                          className={`p-1.5 rounded-lg transition-colors border ${
                            prospect.duplicateWarning?.blocking
                              ? 'bg-gray-500/20 text-gray-500 border-gray-500/40 cursor-not-allowed opacity-50'
                              : prospect.approvalStatus === 'approved'
                              ? 'bg-green-500/40 text-green-300 border-green-500/60'
                              : 'bg-green-500/20 hover:bg-green-500/30 text-green-400 border-green-500/40'
                          }`}
                          title={
                            prospect.duplicateWarning?.blocking
                              ? 'Cannot approve - already in another LinkedIn campaign'
                              : prospect.approvalStatus === 'approved'
                              ? 'Already approved'
                              : 'Approve this prospect'
                          }
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
                {/* Duplicate Warning Row */}
                {prospect.duplicateWarning && (
                  <tr className={`${
                    dismissedProspectIds.has(prospect.id)
                      ? 'bg-red-500/5 opacity-50'
                      : selectedProspectIds.has(prospect.id)
                      ? 'bg-purple-600/10'
                      : 'bg-gray-800/50'
                  }`}>
                    <td colSpan={10} className="px-4 py-2">
                      <DuplicateWarningBadge
                        warning={prospect.duplicateWarning}
                        prospectId={prospect.id}
                        onRemoveFromCampaign={handleRemoveFromCampaign}
                      />
                    </td>
                  </tr>
                )}
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
                        {!prospect.linkedinUserId && prospect.connectionDegree === '1st' && prospect.linkedinUrl && (
                          <div className="col-span-2">
                            <span className="text-gray-400">LinkedIn ID:</span>
                            <span className="text-gray-500 ml-2 text-xs">
                              Will resolve on campaign launch
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

      {/* Data Validation Modal - shows missing fields after data upload */}
      <DataValidationModal
        isOpen={showDataValidationModal}
        onClose={() => {
          setShowDataValidationModal(false)
          setDataValidationResults(null)
        }}
        onProceed={() => {
          setShowDataValidationModal(false)
          // Data stays in prospectData, user can proceed to approve/campaign
        }}
        validationResults={dataValidationResults}
      />

      {/* Campaign Type Selection Modal */}
      <CampaignTypeModal
        isOpen={campaignModal.isOpen}
        onClose={() => setCampaignModal({ isOpen: false, approvedProspects: [] })}
        prospects={campaignModal.approvedProspects}
        onSelectType={async (type, campaignName) => {
          setCampaignModal({ ...campaignModal, isOpen: false });
          setSelectedCampaignType(type); // Keep exact type (connector/messenger/email)

          // CRITICAL: Store campaign name in state so it survives preflight API call
          setPendingCampaignName(campaignName);

          // Dec 8 CRITICAL FIX: campaignModal.approvedProspects already contains ONLY the
          // user's selected prospects (filtered when modal was opened at line 2580).
          // DO NOT check selectedProspectIds again - React state may have changed between
          // modal open and onSelectType call, causing data leakage.
          //
          // Previous bug: selectedProspectIds.size === 0 would fall through to "most recent session"
          // logic, which included ALL prospects from the session instead of just the selected ones.
          let prospectsToSend = campaignModal.approvedProspects.map(p => ({
            ...p,
            campaignName // Add campaign name to each prospect so draft creation can use it
          }));

          console.log(`📊 [DATA LEAKAGE FIX] Using ${prospectsToSend.length} prospects from modal (already filtered at modal open)`)

          // Filter prospects based on campaign type selection
          // Helper to check if email exists (must be non-empty string)
          const hasValidEmail = (p: any) => {
            const email = p.contact?.email || p.email || p.email_address;
            return email && typeof email === 'string' && email.trim().length > 0;
          };

          if (type === 'email') {
            prospectsToSend = prospectsToSend.filter(p => hasValidEmail(p));
          } else if (type === 'connector') {
            prospectsToSend = prospectsToSend.filter(p => {
              const hasLinkedIn = p.contact?.linkedin_url || p.linkedin_url || p.linkedinUrl;
              if (!hasLinkedIn) return false;
              const degree = String(p.connection_degree || p.connectionDegree || '').toLowerCase();
              return !degree.includes('1st') && degree !== '1';
            });
          } else if (type === 'messenger') {
            prospectsToSend = prospectsToSend.filter(p => {
              const hasLinkedIn = p.contact?.linkedin_url || p.linkedin_url || p.linkedinUrl;
              if (!hasLinkedIn) return false;
              const degree = String(p.connection_degree || p.connectionDegree || '').toLowerCase();
              return degree.includes('1st') || degree === '1';
            });
          }

          console.log(`📊 Campaign type "${type}" selected: ${prospectsToSend.length} prospects`);

          if (prospectsToSend.length === 0) {
            toastError('No eligible prospects for this campaign type');
            return;
          }

          // Run pre-flight check
          setPendingCampaignType(type);
          setPendingProspects(prospectsToSend);
          setIsRunningPreflight(true);
          setShowPreflightModal(true);

          try {
            // Dec 9: Safely serialize prospects to avoid circular reference crashes
            const safeProspects = prospectsToSend.map((p: any) => ({
              id: p.id,
              name: p.name || p.contact?.name || 'Unknown',
              email: p.email || p.contact?.email || p.email_address,
              linkedin_url: p.linkedin_url || p.contact?.linkedin_url || p.linkedinUrl,
              linkedinUrl: p.linkedinUrl || p.linkedin_url || p.contact?.linkedin_url,
              connection_degree: p.connection_degree || p.connectionDegree,
              connectionDegree: p.connectionDegree || p.connection_degree,
              company: p.company || p.contact?.company,
              title: p.title || p.contact?.title,
              sessionId: p.sessionId,
              campaignName: p.campaignName
            }));

            console.log(`📤 Sending ${safeProspects.length} prospects to preflight check`);

            const response = await fetch('/api/linkedin/preflight-check', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prospects: safeProspects,
                workspaceId: actualWorkspaceId,
                campaignType: type
              })
            });

            // FIX (Dec 9): Add proper error handling for HTTP errors
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              console.error('❌ Pre-flight API error:', response.status, errorData);

              if (response.status === 401) {
                toastError('Session expired. Please refresh the page and try again.');
              } else if (response.status === 403) {
                toastError('You don\'t have access to this workspace.');
              } else {
                const errMsg = errorData.error || errorData.details || errorData.message || 'Server error';
                console.error('Pre-flight error details:', JSON.stringify(errorData));
                toastError(`Pre-flight check failed: ${errMsg}`);
              }
              setShowPreflightModal(false);
              setIsRunningPreflight(false);
              return;
            }

            const data = await response.json();
            console.log('📊 Pre-flight results:', data.summary);
            setPreflightResults(data);
          } catch (error: any) {
            console.error('Pre-flight check failed:', error);
            const errorMsg = error?.message || error?.toString() || 'Network error';
            toastError(`Failed to verify prospects: ${errorMsg}. Please refresh and try again.`);
            setShowPreflightModal(false);
          } finally {
            setIsRunningPreflight(false);
          }
        }}
        prospectCount={campaignModal.approvedProspects.length}
        prospects={campaignModal.approvedProspects}
        hasEmailAccount={hasEmailAccount}
      />

      {/* Pre-flight Results Modal */}
      <PreflightResultsModal
        isOpen={showPreflightModal}
        isLoading={isRunningPreflight}
        results={preflightResults}
        campaignType={pendingCampaignType}
        onClose={() => {
          setShowPreflightModal(false);
          setPreflightResults(null);
          setPendingCampaignType(null);
          setPendingCampaignName('');
          setPendingProspects([]);
        }}
        onProceed={() => {
          console.log('🚀 PREFLIGHT PROCEED CLICKED:', {
            validProspects: preflightResults?.validProspects?.length,
            campaignType: pendingCampaignType,
            campaignName: pendingCampaignName,
            sample: preflightResults?.validProspects?.[0]
          });
          setShowPreflightModal(false);
          if (preflightResults?.validProspects?.length > 0 && pendingCampaignType) {
            // Add campaign name to each prospect before proceeding
            const prospectsWithName = preflightResults.validProspects.map((p: any) => ({
              ...p,
              campaignName: pendingCampaignName
            }));
            console.log('✅ Calling handleProceedToCampaignHub with', prospectsWithName.length, 'prospects and name:', pendingCampaignName);
            handleProceedToCampaignHub(prospectsWithName, pendingCampaignType);
          } else {
            console.error('❌ NO VALID PROSPECTS OR CAMPAIGN TYPE:', {
              validProspects: preflightResults?.validProspects,
              campaignType: pendingCampaignType
            });
          }
          setPreflightResults(null);
          setPendingCampaignType(null);
          setPendingProspects([]);
        }}
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
        approvalStatus: 'pending' as const,
        // Include connection degree for campaign type selection (messenger requires 1st degree)
        connectionDegree: prospect.connectionDegree ? `${prospect.connectionDegree}${prospect.connectionDegree === 1 ? 'st' : prospect.connectionDegree === 2 ? 'nd' : 'rd'}` : undefined,
        connection_degree: prospect.connectionDegree // Numeric version for compatibility
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

// Data Validation Modal Component - shows missing fields after data upload
function DataValidationModal({
  isOpen,
  onClose,
  onProceed,
  validationResults
}: {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  validationResults: {
    totalProspects: number;
    missingLinkedIn: number;
    missingEmail: number;
    missingConnectionDegree: number;
    prospects: any[];
  } | null;
}) {
  if (!isOpen || !validationResults) return null;

  const hasIssues = validationResults.missingLinkedIn > 0 ||
                    validationResults.missingEmail > 0 ||
                    validationResults.missingConnectionDegree > 0;

  const allMissingLinkedIn = validationResults.missingLinkedIn === validationResults.totalProspects;
  const allMissingEmail = validationResults.missingEmail === validationResults.totalProspects;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full mx-4 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            {hasIssues ? (
              <>
                <AlertCircle className="w-5 h-5 text-amber-400" />
                Data Quality Review
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 text-green-400" />
                Data Looks Good!
              </>
            )}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-gray-700/50 rounded-lg p-4">
            <p className="text-gray-300 text-sm mb-3">
              Loaded <span className="font-bold text-white">{validationResults.totalProspects}</span> prospects
            </p>

            {hasIssues && (
              <div className="space-y-2">
                {validationResults.missingLinkedIn > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      Missing LinkedIn URL
                    </span>
                    <span className={`font-medium ${allMissingLinkedIn ? 'text-red-400' : 'text-amber-400'}`}>
                      {validationResults.missingLinkedIn} prospects
                    </span>
                  </div>
                )}

                {validationResults.missingEmail > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Missing Email
                    </span>
                    <span className={`font-medium ${allMissingEmail ? 'text-red-400' : 'text-amber-400'}`}>
                      {validationResults.missingEmail} prospects
                    </span>
                  </div>
                )}

                {validationResults.missingConnectionDegree > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      Missing Connection Degree
                    </span>
                    <span className="text-amber-400 font-medium">
                      {validationResults.missingConnectionDegree} prospects
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Impact explanation */}
          {hasIssues && (
            <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
              <h4 className="text-amber-400 text-sm font-medium mb-2">What this means:</h4>
              <ul className="text-gray-300 text-sm space-y-1">
                {validationResults.missingLinkedIn > 0 && (
                  <li>• {validationResults.missingLinkedIn} prospects cannot be used for LinkedIn campaigns</li>
                )}
                {validationResults.missingEmail > 0 && (
                  <li>• {validationResults.missingEmail} prospects cannot be used for Email campaigns</li>
                )}
                {validationResults.missingConnectionDegree > 0 && (
                  <li>• {validationResults.missingConnectionDegree} prospects cannot be properly filtered for Messenger campaigns (1st degree only)</li>
                )}
              </ul>
            </div>
          )}

          {/* Eligible counts */}
          <div className="bg-gray-700/30 rounded-lg p-4">
            <h4 className="text-white text-sm font-medium mb-2">Campaign Eligibility:</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">LinkedIn Campaigns:</span>
                <span className="text-white font-medium">
                  {validationResults.totalProspects - validationResults.missingLinkedIn} eligible
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Email Campaigns:</span>
                <span className="text-white font-medium">
                  {validationResults.totalProspects - validationResults.missingEmail} eligible
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          >
            Go Back & Fix Data
          </button>
          <button
            onClick={onProceed}
            className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white transition-colors"
          >
            {hasIssues ? 'Proceed Anyway' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Campaign Type Selection Modal Component
function CampaignTypeModal({
  isOpen,
  onClose,
  onSelectType,
  prospectCount,
  prospects = [],
  hasEmailAccount = false
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: 'email' | 'linkedin' | 'connector' | 'messenger' | 'inmail' | 'open_inmail', campaignName?: string) => void;
  prospectCount: number;
  prospects?: any[];
  hasEmailAccount?: boolean;
}) {
  // State for campaign name
  const [campaignName, setCampaignName] = React.useState('');
  const [hasInitialized, setHasInitialized] = React.useState(false);

  // Update campaign name ONLY when modal first opens (not on every prospects change)
  React.useEffect(() => {
    if (isOpen && !hasInitialized) {
      // Use lead search name from prospects if available, fallback to date-based name
      const defaultName = prospects?.length > 0 && prospects[0]?.campaignName
        ? prospects[0].campaignName
        : `Campaign-${new Date().toISOString().split('T')[0]}`;
      setCampaignName(defaultName);
      setHasInitialized(true);
    }
    // Reset initialization when modal closes
    if (!isOpen && hasInitialized) {
      setHasInitialized(false);
    }
  }, [isOpen, prospects, hasInitialized]);

  if (!isOpen) return null;

  // Count prospects by campaign type eligibility
  // Helper to check if email exists (must be non-empty string)
  const hasValidEmail = (p: any) => {
    const email = p.contact?.email || p.email || p.email_address;
    return email && typeof email === 'string' && email.trim().length > 0;
  };
  const emailCount = prospects.filter(p => hasValidEmail(p)).length;

  const hasLinkedIn = (p: any) =>
    p.contact?.linkedin_url || p.linkedin_url || p.linkedinUrl;

  // 1st degree = Messenger eligible, 2nd/3rd/OUT_OF_NETWORK = Connector eligible
  const messengerCount = prospects.filter(p => {
    if (!hasLinkedIn(p)) return false;
    const degree = String(p.connection_degree || p.connectionDegree || '').toLowerCase();
    return degree.includes('1st') || degree === '1';
  }).length;

  const connectorCount = prospects.filter(p => {
    if (!hasLinkedIn(p)) return false;
    const degree = String(p.connection_degree || p.connectionDegree || '').toLowerCase();
    // 2nd, 3rd, OUT_OF_NETWORK, or unknown (default to connector)
    return !degree.includes('1st') && degree !== '1';
  }).length;

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

        <p className="text-gray-400 text-sm mb-4">
          Select the type of campaign to create
        </p>

        {/* Campaign Name Input */}
        <div className="mb-6">
          <label htmlFor="campaign-name" className="block text-sm font-medium text-gray-300 mb-2">
            Campaign Name
          </label>
          <input
            id="campaign-name"
            type="text"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="Enter campaign name..."
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="space-y-3">
          {/* Email Campaign Option */}
          <div className="relative">
            <button
              onClick={() => emailCount > 0 && hasEmailAccount && onSelectType('email', campaignName)}
              disabled={emailCount === 0 || !hasEmailAccount}
              className={`w-full p-4 rounded-lg border-2 transition-all group text-left ${
                emailCount === 0 || !hasEmailAccount
                  ? 'border-gray-700 bg-gray-800/50 opacity-50 cursor-not-allowed'
                  : 'border-gray-700 hover:border-blue-500 hover:bg-gray-750'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${emailCount > 0 && hasEmailAccount ? 'bg-blue-600/20 text-blue-400 group-hover:bg-blue-600/30' : 'bg-gray-600/20 text-gray-500'}`}>
                  <Mail className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold">Email Campaign</div>
                  <div className="text-gray-400 text-sm">Send emails to prospects with email addresses</div>
                </div>
              </div>
            </button>
            {/* Warning tooltip when no email account connected */}
            {emailCount > 0 && !hasEmailAccount && (
              <div className="mt-2 p-3 bg-yellow-600/20 border border-yellow-600/30 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-yellow-300 text-xs font-medium">No email account connected</p>
                  <p className="text-yellow-400/80 text-xs mt-0.5">
                    Connect an email provider in Settings → Integrations to send email campaigns
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* LinkedIn Connector Option */}
          <button
            onClick={() => connectorCount > 0 && onSelectType('connector', campaignName)}
            disabled={connectorCount === 0}
            className={`w-full p-4 rounded-lg border-2 transition-all group text-left ${
              connectorCount === 0
                ? 'border-gray-700 bg-gray-800/50 opacity-50 cursor-not-allowed'
                : 'border-gray-700 hover:border-purple-500 hover:bg-gray-750'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${connectorCount > 0 ? 'bg-purple-600/20 text-purple-400 group-hover:bg-purple-600/30' : 'bg-gray-600/20 text-gray-500'}`}>
                <UserPlus className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-white font-semibold">LinkedIn Connector</div>
                <div className="text-gray-400 text-sm">Send connection requests to 2nd/3rd degree</div>
              </div>
            </div>
          </button>

          {/* LinkedIn Messenger Option */}
          <button
            onClick={() => messengerCount > 0 && onSelectType('messenger', campaignName)}
            disabled={messengerCount === 0}
            className={`w-full p-4 rounded-lg border-2 transition-all group text-left ${
              messengerCount === 0
                ? 'border-gray-700 bg-gray-800/50 opacity-50 cursor-not-allowed'
                : 'border-gray-700 hover:border-green-500 hover:bg-gray-750'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${messengerCount > 0 ? 'bg-green-600/20 text-green-400 group-hover:bg-green-600/30' : 'bg-gray-600/20 text-gray-500'}`}>
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-white font-semibold">LinkedIn Messenger</div>
                <div className="text-gray-400 text-sm">Send direct messages to 1st degree connections</div>
              </div>
            </div>
          </button>

          {/* LinkedIn InMail Option (Premium Credits) */}
          <button
            onClick={() => connectorCount > 0 && onSelectType('inmail', campaignName)}
            disabled={connectorCount === 0}
            className={`w-full p-4 rounded-lg border-2 transition-all group text-left ${
              connectorCount === 0
                ? 'border-gray-700 bg-gray-800/50 opacity-50 cursor-not-allowed'
                : 'border-gray-700 hover:border-amber-500 hover:bg-gray-750'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${connectorCount > 0 ? 'bg-amber-600/20 text-amber-400 group-hover:bg-amber-600/30' : 'bg-gray-600/20 text-gray-500'}`}>
                <Send className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-white font-semibold">LinkedIn InMail</div>
                <div className="text-gray-400 text-sm">Message anyone (uses Premium InMail credits)</div>
              </div>
            </div>
          </button>

          {/* LinkedIn Open InMail Option (Free) */}
          <button
            onClick={() => connectorCount > 0 && onSelectType('open_inmail', campaignName)}
            disabled={connectorCount === 0}
            className={`w-full p-4 rounded-lg border-2 transition-all group text-left ${
              connectorCount === 0
                ? 'border-gray-700 bg-gray-800/50 opacity-50 cursor-not-allowed'
                : 'border-gray-700 hover:border-teal-500 hover:bg-gray-750'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${connectorCount > 0 ? 'bg-teal-600/20 text-teal-400 group-hover:bg-teal-600/30' : 'bg-gray-600/20 text-gray-500'}`}>
                <Send className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-white font-semibold">LinkedIn Open InMail</div>
                <div className="text-gray-400 text-sm">Free InMail to Open Profiles (no credits needed)</div>
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

// Pre-flight Results Modal Component
function PreflightResultsModal({
  isOpen,
  isLoading,
  results,
  campaignType,
  onClose,
  onProceed
}: {
  isOpen: boolean;
  isLoading: boolean;
  results: any;
  campaignType: 'email' | 'linkedin' | 'connector' | 'messenger' | 'inmail' | 'open_inmail' | null;
  onClose: () => void;
  onProceed: () => void;
}) {
  if (!isOpen) return null;

  const summary = results?.summary;
  const validCount = summary?.canProceed || 0;
  const blockedCount = summary?.blocked || 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full mx-4 border border-gray-700 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            {isLoading ? 'Verifying Prospects...' : 'Pre-flight Check Results'}
          </h3>
          {!isLoading && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
            <p className="text-gray-400">Checking prospects against existing campaigns...</p>
            <p className="text-gray-500 text-sm mt-2">This may take a few seconds</p>
          </div>
        ) : summary ? (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-green-600/20 rounded-lg p-3 border border-green-600/30">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-green-400 font-semibold text-lg">{validCount}</span>
                </div>
                <div className="text-green-300 text-sm">Ready to proceed</div>
              </div>
              <div className="bg-red-600/20 rounded-lg p-3 border border-red-600/30">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-400" />
                  <span className="text-red-400 font-semibold text-lg">{blockedCount}</span>
                </div>
                <div className="text-red-300 text-sm">Cannot proceed</div>
              </div>
            </div>

            {/* Rate Limit Status */}
            {summary.rateLimitStatus && (
              <div className={`mb-4 p-3 rounded-lg border ${
                summary.rateLimitStatus.canSend
                  ? 'bg-gray-700/50 border-gray-600'
                  : 'bg-yellow-600/20 border-yellow-600/30'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className={`w-4 h-4 ${summary.rateLimitStatus.canSend ? 'text-gray-400' : 'text-yellow-400'}`} />
                  <span className="text-white text-sm font-medium">Rate Limits</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Today: {summary.rateLimitStatus.dailyUsed}/{summary.rateLimitStatus.dailyLimit}</span>
                  <span className="text-gray-400">This week: {summary.rateLimitStatus.weeklyUsed}/{summary.rateLimitStatus.weeklyLimit}</span>
                </div>
                {summary.rateLimitStatus.warning && (
                  <p className="text-yellow-400 text-xs mt-2">{summary.rateLimitStatus.warning}</p>
                )}
              </div>
            )}

            {/* Blocked Reasons Breakdown */}
            {blockedCount > 0 && (
              <div className="mb-4 space-y-2">
                <h4 className="text-white text-sm font-medium mb-2">Blocked Reasons:</h4>

                {summary.alreadyContacted > 0 && (
                  <div className="flex items-center justify-between text-sm bg-gray-700/50 rounded-lg px-3 py-2">
                    <span className="text-gray-300">Already contacted</span>
                    <span className="text-red-400 font-medium">{summary.alreadyContacted}</span>
                  </div>
                )}

                {summary.pendingInvitation > 0 && (
                  <div className="flex items-center justify-between text-sm bg-gray-700/50 rounded-lg px-3 py-2">
                    <span className="text-gray-300">Pending invitation</span>
                    <span className="text-yellow-400 font-medium">{summary.pendingInvitation}</span>
                  </div>
                )}

                {summary.duplicates > 0 && (
                  <div className="flex items-center justify-between text-sm bg-gray-700/50 rounded-lg px-3 py-2">
                    <span className="text-gray-300">Duplicates in batch</span>
                    <span className="text-orange-400 font-medium">{summary.duplicates}</span>
                  </div>
                )}

                {summary.wrongDegree > 0 && (
                  <div className="flex items-center justify-between text-sm bg-gray-700/50 rounded-lg px-3 py-2">
                    <span className="text-gray-300">Wrong connection degree</span>
                    <span className="text-purple-400 font-medium">{summary.wrongDegree}</span>
                  </div>
                )}

                {summary.previouslyFailed > 0 && (
                  <div className="flex items-center justify-between text-sm bg-gray-700/50 rounded-lg px-3 py-2">
                    <span className="text-gray-300">Previously failed</span>
                    <span className="text-gray-400 font-medium">{summary.previouslyFailed}</span>
                  </div>
                )}
              </div>
            )}

            {/* Verified Profiles */}
            {summary.verified > 0 && (
              <div className="mb-4 text-sm text-gray-400">
                ✓ {summary.verified} profiles verified with LinkedIn
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onProceed}
                disabled={validCount === 0}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  validCount > 0
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {validCount > 0 ? `Proceed with ${validCount}` : 'No valid prospects'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <XCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
            <p className="text-gray-400">Failed to verify prospects</p>
          </div>
        )}
      </div>
    </div>
  );
}
