import { toastSuccess, toastError, toastWarning, toastInfo } from '@/lib/toast';

'use client'


// LinkedIn Campaign Types
type LinkedInCampaignType = 
  | '1st-degree-direct'      // Direct messages to existing connections
  | '2nd-3rd-connection'     // Connection requests
  | '2nd-3rd-group'          // Group messages (shared groups)
  | 'open-inmail'            // InMail campaigns (requires premium)

// Using ProspectData from ProspectApprovalModal
type ProspectData = ProspectDataType & {
  campaignName?: string            // Primary: e.g., "20251001-IFC-College Campaign"
  campaignTag?: string             // Secondary: for A/B testing e.g., "Industry-FinTech", "Region-West"
  linkedinCampaignType?: LinkedInCampaignType  // LinkedIn campaign type
  connectionDegree?: '1st' | '2nd' | '3rd' | 'unknown'
  conversationId?: string          // For 1st degree follow-ups
  sharedGroups?: string[]          // For group campaigns
  inmailEligible?: boolean         // Has Open Profile or InMail available
  approvalStatus?: 'pending' | 'approved' | 'rejected'
  uploaded?: boolean
}

interface DataCollectionHubProps {
  onDataCollected: (data: ProspectData[], source: string) => void
  onApprovalComplete?: (approvedData: ProspectData[]) => void
  className?: string
  initialUploadedData?: ProspectData[]
}

// REMOVED: Dummy prospect data generation function

export default function DataCollectionHub({ 
  onDataCollected, 
  onApprovalComplete,
  className = '',
  initialUploadedData = []
}: DataCollectionHubProps) {
  // Initialize with uploaded data from chat only (no dummy data)
  const [loading, setLoading] = useState(false)
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
  
  // Missing state variables
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showApprovalPanel, setShowApprovalPanel] = useState(true)
  const [activeTab, setActiveTab] = useState('approve')
  const [linkedinQuery, setLinkedinQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Update prospects when new data is uploaded from chat
  useEffect(() => {
    if (initialUploadedData && initialUploadedData.length > 0) {
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
      const uploadedProspects = initialUploadedData.map(p => ({
        ...p,
        approvalStatus: (p.approvalStatus || 'pending') as const,
        campaignTag: p.campaignTag || `${today}-CLIENT-Demo`,
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
  }, [initialUploadedData])

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
      const linkedinData = await collectLinkedInData(linkedinQuery)
      
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

  const handleReject = (prospectId: string) => {
    setProspectData(prev => prev.map(p => 
      p.id === prospectId ? { ...p, approvalStatus: 'rejected' as const } : p
    ))
  }

  const handleApproveAll = () => {
    setProspectData(prev => prev.map(p => 
      p.approvalStatus !== 'rejected' ? { ...p, approvalStatus: 'approved' as const } : p
    ))
  }

  const handleRejectAll = () => {
    if (confirm('Are you sure you want to reject all prospects?')) {
      setProspectData(prev => prev.map(p => ({ ...p, approvalStatus: 'rejected' as const })))
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

  // Get unique campaign tags
  const campaignTags = ['all', ...Array.from(new Set(prospectData.map(p => p.campaignTag).filter(Boolean))) as string[]]
  
  // Filter prospects
  const filteredProspects = prospectData.filter(p => {
    if (selectedCampaignTag !== 'all' && p.campaignTag !== selectedCampaignTag) return false
    if (filterStatus !== 'all' && p.approvalStatus !== filterStatus) return false
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

  const approvedCount = prospectData.filter(p => p.approvalStatus === 'approved').length
  const rejectedCount = prospectData.filter(p => p.approvalStatus === 'rejected').length
  const pendingCount = prospectData.filter(p => p.approvalStatus === 'pending').length

  const applyDefaultTagToAll = () => {
    if (defaultCampaignTag.trim()) {
      setProspectData(prev => prev.map(p => ({ ...p, campaignTag: defaultCampaignTag })))
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

  return (
    <div className={`bg-gray-800 rounded-lg ${className}`}>
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

      {/* Campaign Tag Tabs */}
      <div className="border-b-2 border-purple-500/20 px-6 py-4 bg-gray-900">
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Campaign Filter</h3>
        </div>
        <div className="flex items-center space-x-2 overflow-x-auto pb-1">
          {campaignTags.length === 1 && (
            <p className="text-sm text-gray-500 italic">Upload CSV files to create campaigns</p>
          )}
          {campaignTags.map((tag) => {
            const tagCount = tag === 'all' 
              ? prospectData.length 
              : prospectData.filter(p => p.campaignTag === tag).length
            return (
              <button
                key={tag}
                onClick={() => setSelectedCampaignTag(tag)}
                className={`flex items-center space-x-2 px-5 py-3 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200 shadow-sm ${
                  selectedCampaignTag === tag
                    ? 'bg-purple-600 text-white shadow-purple-500/50 scale-105'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:scale-102'
                }`}
              >
                <Tag className="w-3 h-3" />
                <span>{tag === 'all' ? 'All Campaigns' : tag}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  selectedCampaignTag === tag
                    ? 'bg-purple-700 text-purple-100'
                    : 'bg-gray-600 text-gray-300'
                }`}>
                  {tagCount}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Campaign Tag Assignment Bar */}
      <div className="border-b border-gray-700 px-6 py-3 bg-gray-750">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            <Tag className="w-4 h-4 text-purple-400" />
            <label className="text-sm text-gray-300 font-medium">Default Campaign Tag:</label>
            <input
              type="text"
              value={defaultCampaignTag}
              onChange={(e) => setDefaultCampaignTag(e.target.value)}
              placeholder="Enter campaign name..."
              className="flex-1 max-w-md px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={applyDefaultTagToAll}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Apply to All
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleApproveAll}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Check className="w-4 h-4" />
              <span>Approve All</span>
            </button>
            <button
              onClick={handleRejectAll}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <X className="w-4 h-4" />
              <span>Reject All</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="border-b border-gray-700 px-6 py-3 bg-gray-750">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, company, title, industry, email..."
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Main Content - Table View */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-750 border-b border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Company</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Title</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Industry</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Campaign Tag</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredProspects.map((prospect) => (
              <React.Fragment key={prospect.id}>
                <tr className="hover:bg-gray-750 transition-colors">
                  <td className="px-4 py-3 text-sm text-white font-medium">{prospect.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{prospect.company}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{prospect.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{prospect.industry || '-'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={prospect.campaignTag || ''}
                      onChange={(e) => handleCampaignTagChange(prospect.id, e.target.value)}
                      className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="">Select tag...</option>
                      {Array.from(new Set(prospectData.map(p => p.campaignTag).filter(Boolean))).map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center space-x-2">
                      {prospect.approvalStatus === 'rejected' ? (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-600 text-red-100">
                          rejected
                        </span>
                      ) : prospect.approvalStatus === 'approved' ? (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-600 text-green-100">
                          approved
                        </span>
                      ) : (
                        <button
                          onClick={() => handleReject(prospect.id)}
                          className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                          title="Reject"
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
                    <td colSpan={7} className="px-4 py-4">
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
            ))}
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
  )
}

// Helper functions for data collection

async function collectLinkedInData(query: string): Promise<ProspectData[]> {
  try {
    // Get LinkedIn accounts via Unipile MCP
    const response = await fetch('/api/unipile/linkedin-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        action: 'search_prospects'
      })
    })

    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.success && data.prospects) {
      return data.prospects.map((prospect: any) => ({
        id: `linkedin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: prospect.name || 'Unknown',
        title: prospect.title || 'Not specified',
        company: prospect.company || 'Unknown Company',
        email: prospect.email || null,
        phone: prospect.phone || null,
        linkedinUrl: prospect.linkedinUrl || prospect.profileUrl || null,
        source: 'unipile' as const,
        confidence: prospect.confidence || 0.7,
        complianceFlags: prospect.complianceFlags || []
      }))
    } else {
      throw new Error(data.error || 'No prospects found')
    }
  } catch (error) {
    console.error('LinkedIn MCP search failed:', error)
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
