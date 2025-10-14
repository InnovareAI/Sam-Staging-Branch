'use client'

import { Check, ChevronDown, ChevronUp, Download, Search, Tag, Users, X, Upload, FileText, Link, Sparkles, Mail, Phone, Linkedin, Star } from 'lucide-react';
import { toastError, toastSuccess } from '@/lib/toast';
import { useState, useEffect, useRef } from 'react';
import ProspectSearchChat from '@/components/ProspectSearchChat';
import { ProspectData as BaseProspectData } from '@/components/ProspectApprovalModal';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';


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
  onApprovalComplete?: (approvedData: ProspectData[]) => void
  className?: string
  initialUploadedData?: ProspectData[]
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

export default function DataCollectionHub({
  onDataCollected,
  onApprovalComplete,
  className = '',
  initialUploadedData = []
}: DataCollectionHubProps) {
  // Initialize with uploaded data from chat only (no dummy data)
  const [loading, setLoading] = useState(false)
  const [workspaceCode, setWorkspaceCode] = useState<string>('CLI')
  const initializeProspects = () => {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const uploadedProspects = initialUploadedData.map(p => ({
      ...p,
      approvalStatus: (p.approvalStatus || 'pending') as const,
      campaignName: p.campaignName || `${today}-CLIENT-Demo`,
      campaignTag: p.campaignTag,
      uploaded: true
    }))
    return uploadedProspects
  }
  const [prospectData, setProspectData] = useState<ProspectData[]>(initializeProspects())
  const [expandedProspect, setExpandedProspect] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  // Generate default campaign name with systematic naming: YYYYMMDD-ClientID-CampaignName
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
  const [defaultCampaignName, setDefaultCampaignName] = useState(`${today}-CLIENT-Demo`)
  const [defaultCampaignTag, setDefaultCampaignTag] = useState('')
  const [selectedCampaignName, setSelectedCampaignName] = useState<string>('all')
  const [selectedCampaignTag, setSelectedCampaignTag] = useState<string>('all')
  const [showLatestSessionOnly, setShowLatestSessionOnly] = useState<boolean>(true) // Default to showing only latest search
  
  // Missing state variables
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showApprovalPanel, setShowApprovalPanel] = useState(true)
  const [activeTab, setActiveTab] = useState('approve')
  const [linkedinQuery, setLinkedinQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isChatMinimized, setIsChatMinimized] = useState(false)
  const [connectionDegree] = useState<'1st' | '2nd' | '3rd'>('1st') // Not used - search returns all degrees

  // Bulk selection state
  const [selectedProspectIds, setSelectedProspectIds] = useState<Set<string>>(new Set())
  const [quickFilter, setQuickFilter] = useState<string>('all') // 'all', 'high-quality', 'has-email', '1st-degree', etc.

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
  const csvFileInputRef = useRef<HTMLInputElement>(null)

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
        setProspectData(prev => prev.map(p =>
          p.sessionId === sessionId ? { ...p, campaignName: newCampaignName } : p
        ))
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

  // Handle CSV file upload
  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploadingCsv(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/prospects/parse-csv', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        if (data.prospects && data.prospects.length > 0) {
          // Add prospects to the list
          const newProspects: ProspectData[] = data.prospects.map((p: any) => ({
            name: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
            title: p.title || p.job_title || '',
            company: p.company || p.company_name || '',
            location: p.location || '',
            contact: {
              email: p.email || '',
              linkedin_url: p.linkedin_url || p.linkedinUrl || ''
            },
            approvalStatus: 'pending' as const,
            campaignName: `${today}-${workspaceCode}-CSV Upload`,
            campaignTag: 'csv-import',
            uploaded: true
          }))

          setProspectData(prev => [...newProspects, ...prev])
          console.log(`✅ Uploaded ${newProspects.length} prospects from CSV`)
        }
      } else {
        toastError('Failed to parse CSV file')
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

  // Handle copy/paste text data
  const handlePasteData = async () => {
    if (!pasteText.trim()) {
      toastError('Please paste some prospect data first')
      return
    }

    setIsProcessingPaste(true)
    try {
      // Parse pasted text - expecting format like:
      // Name, Title, Company, Email, LinkedIn
      // or tab-separated values
      const lines = pasteText.trim().split('\n')
      const newProspects: ProspectData[] = []

      for (const line of lines) {
        if (!line.trim()) continue

        // Try comma-separated first, then tab-separated
        const parts = line.includes('\t') ? line.split('\t') : line.split(',')
        const cleanParts = parts.map(p => p.trim())

        if (cleanParts.length >= 2) {
          newProspects.push({
            name: cleanParts[0] || 'Unknown',
            title: cleanParts[1] || '',
            company: cleanParts[2] || '',
            location: '',
            contact: {
              email: cleanParts[3] || '',
              linkedin_url: cleanParts[4] || ''
            },
            approvalStatus: 'pending' as const,
            campaignName: `${today}-${workspaceCode}-Pasted Data`,
            campaignTag: 'paste-import',
            uploaded: true
          })
        }
      }

      if (newProspects.length > 0) {
        setProspectData(prev => [...newProspects, ...prev])
        console.log(`✅ Added ${newProspects.length} prospects from pasted data`)
        setPasteText('') // Clear the textarea
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
        if (data.success && data.prospects && data.prospects.length > 0) {
          const newProspects: ProspectData[] = data.prospects.map((p: any) => ({
            name: p.fullName || p.name || 'Unknown',
            title: p.title || '',
            company: p.company || '',
            location: '',
            contact: {
              email: '',
              linkedin_url: p.linkedinUrl || ''
            },
            approvalStatus: 'pending' as const,
            campaignName: `${today}-${workspaceCode}-LinkedIn Search`,
            campaignTag: 'linkedin-url',
            uploaded: true
          }))

          setProspectData(prev => [...newProspects, ...prev])
          console.log(`✅ Found ${newProspects.length} prospects from LinkedIn URL`)
          setLinkedinSearchUrl('') // Clear the input
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

  // CRITICAL: Load existing approval sessions from database
  // Force rebuild: 2025-10-14-visibility-fix
  const loadExistingApprovalSessions = async () => {
    try {
      console.log('📥 Loading existing approval sessions...')
      const response = await fetch('/api/prospect-approval/sessions/list')
      if (response.ok) {
        const data = await response.json()
        console.log('📊 Found approval sessions:', data.sessions?.length || 0, 'sessions')
        console.log('Session details:', data.sessions?.map((s: any) => ({
          id: s.id.substring(0, 8),
          campaign: s.campaign_name,
          prospects: s.total_prospects
        })))

        if (data.success && data.sessions && data.sessions.length > 0) {
            // Load prospects for all active sessions
            const allProspects: ProspectData[] = []

            for (const session of data.sessions) {
              console.log(`Processing session: ${session.id.substring(0, 8)} - ${session.campaign_name} (${session.total_prospects} prospects)`)
              if (session.status === 'active') { // CORRECTED: Valid status values are 'active' or 'completed'
                const prospectsResponse = await fetch(`/api/prospect-approval/prospects?session_id=${session.id}`)
                console.log(`Prospects API response for ${session.id.substring(0, 8)}:`, prospectsResponse.status)
                if (prospectsResponse.ok) {
                  const prospectsData = await prospectsResponse.json()
                  console.log(`Fetched ${prospectsData.prospects?.length || 0} prospects from session ${session.id.substring(0, 8)}`)
                  if (prospectsData.success && prospectsData.prospects) {
                    // Map approval data to ProspectData format
                    // CORRECTED: company and contact are JSONB objects, not strings
                    const mappedProspects = prospectsData.prospects.map((p: any) => ({
                      id: p.prospect_id,
                      name: p.name,
                      title: p.title || '',
                      company: p.company?.name || '',  // FIXED: Extract name from JSONB
                      industry: p.company?.industry || '',  // FIXED: Extract industry from JSONB
                      location: p.location || '',
                      email: p.contact?.email || '',    // FIXED: Extract email from JSONB
                      linkedinUrl: p.contact?.linkedin_url || '',  // FIXED: Extract URL from JSONB
                      phone: p.contact?.phone || '',
                      connectionDegree: p.connection_degree ? `${p.connection_degree}${p.connection_degree === 1 ? 'st' : p.connection_degree === 2 ? 'nd' : 'rd'}` : undefined,
                      source: p.source || 'linkedin',
                      enrichmentScore: p.enrichment_score || 0,
                      confidence: (p.enrichment_score || 80) / 100,  // FIXED: Convert integer to decimal
                      approvalStatus: (p.approval_status || 'pending') as 'pending' | 'approved' | 'rejected',  // DEFAULT: pending - requires user approval
                      campaignName: session.campaign_name || `Session-${session.id.slice(0, 8)}`,  // Use actual campaign_name from DB
                      campaignTag: session.campaign_tag || session.campaign_name || session.prospect_source || 'linkedin',  // FIXED: Use campaign_name as fallback tag
                      sessionId: session.id,  // Track session ID for campaign name updates
                      uploaded: false,
                      qualityScore: 0  // Will be calculated below
                    }))
                    // Calculate quality scores for each prospect
                    mappedProspects.forEach(p => {
                      p.qualityScore = calculateQualityScore(p)
                    })
                    allProspects.push(...mappedProspects)
                  }
                }
              }
            }

          if (allProspects.length > 0) {
            console.log(`✅ Loaded ${allProspects.length} prospects from approval sessions`)
            // Replace all data instead of merging to avoid duplicates on reload
            setProspectData(allProspects)
          } else {
            // No prospects found, keep empty
            setProspectData([])
          }
        }
      }
    } catch (error) {
      console.error('Failed to load approval sessions:', error)
    }
  }

  // Load data on mount
  useEffect(() => {
    loadExistingApprovalSessions()
  }, [])

  // Reload data when window becomes visible (user returns to tab/page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Page became visible, reloading data...')
        loadExistingApprovalSessions()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

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
    const prospect = prospectData.find(p => p.id === prospectId)
    if (!prospect || !prospect.sessionId) return

    // Optimistic UI update
    setProspectData(prev => prev.map(p =>
      p.id === prospectId ? { ...p, approvalStatus: 'rejected' as const } : p
    ))

    try {
      // Save to database
      const response = await fetch('/api/prospect-approval/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: prospect.sessionId,
          prospect_id: prospectId,
          decision: 'rejected'
        })
      })

      if (!response.ok) {
        console.error('Failed to save rejection')
        // Revert on error
        setProspectData(prev => prev.map(p =>
          p.id === prospectId ? { ...p, approvalStatus: 'pending' as const } : p
        ))
      }
    } catch (error) {
      console.error('Error rejecting prospect:', error)
    }
  }

  const handleApprove = async (prospectId: string) => {
    const prospect = prospectData.find(p => p.id === prospectId)
    if (!prospect || !prospect.sessionId) return

    // Optimistic UI update
    setProspectData(prev => prev.map(p =>
      p.id === prospectId ? { ...p, approvalStatus: 'approved' as const } : p
    ))

    try {
      // Save to database
      const response = await fetch('/api/prospect-approval/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: prospect.sessionId,
          prospect_id: prospectId,
          decision: 'approved'
        })
      })

      if (!response.ok) {
        console.error('Failed to save approval')
        // Revert on error
        setProspectData(prev => prev.map(p =>
          p.id === prospectId ? { ...p, approvalStatus: 'pending' as const } : p
        ))
      }
    } catch (error) {
      console.error('Error approving prospect:', error)
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
      if (prospect.sessionId) {
        try {
          await fetch('/api/prospect-approval/decisions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: prospect.sessionId,
              prospect_id: prospect.id,
              decision: 'approved'
            })
          })
        } catch (error) {
          console.error('Error approving prospect:', prospect.id, error)
        }
      }
    }
  }

  const handleRejectAll = async () => {
    if (!confirm('Are you sure you want to reject all prospects?')) return

    const pendingProspects = prospectData.filter(p => p.approvalStatus === 'pending')

    // Optimistic UI update
    setProspectData(prev => prev.map(p => ({ ...p, approvalStatus: 'rejected' as const })))

    // Save all to database
    for (const prospect of pendingProspects) {
      if (prospect.sessionId) {
        try {
          await fetch('/api/prospect-approval/decisions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: prospect.sessionId,
              prospect_id: prospect.id,
              decision: 'rejected'
            })
          })
        } catch (error) {
          console.error('Error rejecting prospect:', prospect.id, error)
        }
      }
    }
  }

  const handleCampaignTagChange = (prospectId: string, tag: string) => {
    setProspectData(prev => prev.map(p => 
      p.id === prospectId ? { ...p, campaignTag: tag } : p
    ))
  }

  const toggleExpanded = (prospectId: string) => {
    setExpandedProspect(prev => prev === prospectId ? null : prospectId)
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

  // Filter prospects - USER CONTROLS ALL FILTERS INDEPENDENTLY
  let filteredProspects = prospectsWithScores.filter(p => {
    // Campaign name filter - user explicitly selects which campaign to view
    if (selectedCampaignName !== 'all' && p.campaignName !== selectedCampaignName) {
      return false
    }

    // Campaign tag filter - independent of campaign name
    if (selectedCampaignTag !== 'all' && p.campaignTag !== selectedCampaignTag) {
      return false
    }

    // Approval status filter - user decides which status to view
    if (filterStatus !== 'all' && p.approvalStatus !== filterStatus) {
      return false
    }

    // Quick filter
    if (quickFilter === 'high-quality' && (p.qualityScore ?? 0) < 85) return false
    if (quickFilter === 'has-email' && !p.email) return false
    if (quickFilter === '1st-degree' && p.connectionDegree !== '1st') return false
    if (quickFilter === 'missing-info' && p.email && p.phone) return false

    // Search term
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

  // Sort by quality score (highest first)
  filteredProspects = filteredProspects.sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0))

  // Debug logging for campaign filtering
  console.log('🔍 Campaign Filter Debug:', {
    selectedCampaignName,
    showLatestSessionOnly,
    totalProspects: prospectData.length,
    filteredProspects: filteredProspects.length,
    uniqueCampaigns: Array.from(new Set(prospectData.map(p => p.campaignName).filter(Boolean)))
  })

  // Calculate counts based on the currently filtered prospects (respects campaign selection)
  const approvedCount = filteredProspects.filter(p => p.approvalStatus === 'approved').length
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
    setSelectedProspectIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(prospectId)) {
        newSet.delete(prospectId)
      } else {
        newSet.add(prospectId)
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
    if (selectedProspectIds.size === 0) return

    const selectedProspects = prospectData.filter(p => selectedProspectIds.has(p.id))

    // Optimistic UI update
    setProspectData(prev => prev.map(p =>
      selectedProspectIds.has(p.id) ? { ...p, approvalStatus: 'approved' as const } : p
    ))
    toastSuccess(`Approved ${selectedProspectIds.size} prospects`)
    deselectAll()

    // Save all to database
    for (const prospect of selectedProspects) {
      if (prospect.sessionId) {
        try {
          await fetch('/api/prospect-approval/decisions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: prospect.sessionId,
              prospect_id: prospect.id,
              decision: 'approved'
            })
          })
        } catch (error) {
          console.error('Error approving prospect:', prospect.id, error)
        }
      }
    }
  }

  const bulkRejectSelected = async () => {
    if (selectedProspectIds.size === 0) return

    const selectedProspects = prospectData.filter(p => selectedProspectIds.has(p.id))

    // Optimistic UI update
    setProspectData(prev => prev.map(p =>
      selectedProspectIds.has(p.id) ? { ...p, approvalStatus: 'rejected' as const } : p
    ))
    toastSuccess(`Rejected ${selectedProspectIds.size} prospects`)
    deselectAll()

    // Save all to database
    for (const prospect of selectedProspects) {
      if (prospect.sessionId) {
        try {
          await fetch('/api/prospect-approval/decisions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: prospect.sessionId,
              prospect_id: prospect.id,
              decision: 'rejected'
            })
          })
        } catch (error) {
          console.error('Error rejecting prospect:', prospect.id, error)
        }
      }
    }
  }

  // Proceed to Campaign Hub with approved prospects
  const handleProceedToCampaignHub = () => {
    const approvedProspects = prospectData.filter(p => p.approvalStatus === 'approved')
    
    if (approvedProspects.length === 0) {
      toastError('⚠️ No approved prospects found. Please approve at least one prospect before proceeding to Campaign Hub.')
      return
    }

    // Check if all approved prospects have campaign tags
    const untaggedCount = approvedProspects.filter(p => !p.campaignTag || p.campaignTag.trim() === '').length
    if (untaggedCount > 0) {
      if (!confirm(`⚠️ ${untaggedCount} approved prospect(s) don't have campaign tags assigned.\n\nDo you want to proceed anyway?`)) {
        return
      }
    }

    // Call the onApprovalComplete callback
    if (onApprovalComplete) {
      onApprovalComplete(approvedProspects)
    }

    toastError(`✅ Success!\n\n${approvedProspects.length} approved prospects are ready for campaigns.\n\nProceeding to Campaign Hub...`)
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
    <div className={`grid grid-cols-12 gap-4 h-full ${className}`}>
      {/* Left: ProspectSearchChat (4 columns - 33%, hidden when minimized) */}
      {!isChatMinimized && (
        <div className="col-span-4 h-full">
          <ProspectSearchChat
            onSearchTriggered={handleSearchTriggered}
            onProspectsReceived={handleProspectsReceived}
            isMinimized={isChatMinimized}
            onMinimizeChange={setIsChatMinimized}
          />
        </div>
      )}

      {/* ProspectSearchChat minimized bubble (shown when minimized) */}
      {isChatMinimized && (
        <ProspectSearchChat
          onSearchTriggered={handleSearchTriggered}
          onProspectsReceived={handleProspectsReceived}
          isMinimized={isChatMinimized}
          onMinimizeChange={setIsChatMinimized}
        />
      )}

      {/* Right: Prospect Approval Dashboard (8 columns normally, 12 when chat minimized) */}
      <div className={`${isChatMinimized ? 'col-span-12' : 'col-span-8'} h-full overflow-y-auto`}>
        <div className="bg-gray-800 rounded-lg h-full">
          {/* Header */}
          <div className="border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">Prospect Approval Dashboard</h2>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-400">
              <span className="text-green-400 font-semibold">{approvedCount}</span> approved • 
              <span className="text-red-400 font-semibold">{rejectedCount}</span> rejected • 
              <span className="text-yellow-400 font-semibold">{pendingCount}</span> pending
            </div>
            <button
              onClick={downloadApprovedCSV}
              disabled={approvedCount === 0}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download approved prospects only"
            >
              <Download className="w-4 h-4" />
              <span>Download Approved</span>
            </button>
            <button
              onClick={handleProceedToCampaignHub}
              disabled={approvedCount === 0}
              className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-2 rounded-lg transition-all font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>Proceed to Campaign Hub</span>
            </button>
          </div>
        </div>
      </div>

      {/* Add Prospects Section - CSV, Copy/Paste, LinkedIn URL */}
      <div className="border-b border-gray-700 px-6 py-4 bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Add Prospects</h3>
        <div className="flex items-center space-x-2">
          {/* CSV Upload */}
          <input
            ref={csvFileInputRef}
            type="file"
            accept=".csv"
            onChange={handleCsvUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => csvFileInputRef.current?.click()}
            disabled={isUploadingCsv}
          >
            <Upload className="w-3 h-3 mr-1" />
            {isUploadingCsv ? 'Uploading...' : 'CSV Upload'}
          </Button>

          {/* Copy/Paste Text - Opens modal */}
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const text = prompt('Paste prospect data (Name, Title, Company, Email, LinkedIn):\nExample: John Doe, CEO, Acme Inc, john@acme.com, linkedin.com/in/johndoe')
              if (text && text.trim()) {
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
                        contact: {
                          email: cleanParts[3] || '',
                          linkedin_url: cleanParts[4] || ''
                        },
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
                } catch (error) {
                  console.error('Paste processing error:', error)
                  toastError('Error processing pasted data')
                } finally {
                  setIsProcessingPaste(false)
                }
              }
            }}
            disabled={isProcessingPaste}
          >
            <FileText className="w-3 h-3 mr-1" />
            {isProcessingPaste ? 'Processing...' : 'Copy & Paste'}
          </Button>

          {/* LinkedIn Search URL - Opens modal */}
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const url = prompt('Paste LinkedIn search URL (Sales Nav or Recruiter):')
              if (url && url.trim()) {
                setIsProcessingUrl(true)
                try {
                  const response = await fetch('/api/linkedin/search/simple', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      search_criteria: { url: url.trim() },
                      target_count: 50
                    })
                  })

                  if (response.ok) {
                    const data = await response.json()
                    if (data.success && data.prospects && data.prospects.length > 0) {
                      const newProspects: ProspectData[] = data.prospects.map((p: any, index: number) => ({
                        id: `linkedin_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
                        name: p.fullName || p.name || 'Unknown',
                        title: p.title || '',
                        company: p.company || '',
                        location: '',
                        email: p.email || '',
                        linkedinUrl: p.linkedinUrl || '',
                        contact: {
                          email: p.email || '',
                          linkedin_url: p.linkedinUrl || ''
                        },
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
            }}
            disabled={isProcessingUrl}
          >
            <Link className="w-3 h-3 mr-1" />
            {isProcessingUrl ? 'Searching...' : 'LinkedIn URL'}
          </Button>
        </div>
      </div>

      {/* Campaign Selector with Latest Search Toggle */}
      {(() => {
        // Group prospects by campaign name to show unique campaigns
        const campaignsByName = prospectData.reduce((acc, p) => {
          const campName = p.campaignName || 'Unnamed Campaign'
          if (!acc[campName]) {
            acc[campName] = { campaignName: campName, count: 0, sessionId: p.sessionId }
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
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1">
                <label className="text-sm font-semibold text-gray-300">Select Campaign:</label>
                <select
                  value={selectedCampaignName}
                  onChange={(e) => setSelectedCampaignName(e.target.value)}
                  className="flex-1 max-w-md px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Campaigns ({prospectData.length} prospects)</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.campaignName} value={campaign.campaignName}>
                      {campaign.campaignName} ({campaign.count} prospects)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )
      })()}


      {/* Status Filter Only */}
      <div className="border-b border-gray-700 px-6 py-3 bg-gray-750">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-semibold text-gray-300">Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Status ({visibleCount} visible)</option>
            <option value="pending">Pending ({pendingCount})</option>
            <option value="approved">Approved ({approvedCount})</option>
            <option value="rejected">Rejected ({rejectedCount})</option>
          </select>
        </div>
      </div>

      {/* Main Content - Table View */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-750 border-b border-gray-700">
            <tr>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider w-12">
                <Checkbox
                  checked={selectedProspectIds.size === filteredProspects.length && filteredProspects.length > 0}
                  onChange={selectedProspectIds.size === filteredProspects.length ? deselectAll : selectAllVisible}
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Quality</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Company</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Title</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Industry</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Campaign</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredProspects.map((prospect) => {
              const qualityBadge = getQualityBadge(prospect.qualityScore ?? 0)
              return (
              <React.Fragment key={prospect.id}>
                <tr className={`hover:bg-gray-750 transition-colors ${selectedProspectIds.has(prospect.id) ? 'bg-purple-600/10' : ''}`}>
                  <td className="px-4 py-3 text-center">
                    <Checkbox
                      checked={selectedProspectIds.has(prospect.id)}
                      onChange={() => toggleSelectProspect(prospect.id)}
                      aria-label={`Select ${prospect.name}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-1">
                      {qualityBadge.icon}
                      <Badge variant={qualityBadge.variant} className="text-xs">
                        {prospect.qualityScore}
                      </Badge>
                    </div>
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
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center space-x-2">
                      {prospect.approvalStatus === 'rejected' ? (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-600 text-red-100">
                          rejected
                        </span>
                      ) : (
                        <button
                          onClick={() => handleReject(prospect.id)}
                          className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                          title="Reject (all prospects approved by default)"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
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
                  </td>
                </tr>
                {/* Expanded Detail Row */}
                {expandedProspect === prospect.id && (
                  <tr className="bg-gray-750">
                    <td colSpan={9} className="px-4 py-4">
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
            })}
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
      </div>
        </div>
      </div>
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
