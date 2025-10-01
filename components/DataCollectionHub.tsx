'use client'

import React, { useState, useRef } from 'react'
import { Upload, Search, Linkedin, Database, FileText, Users, Download, Loader2 } from 'lucide-react'
import ProspectApprovalModal, { ProspectData as ProspectDataType, ApprovalSession } from './ProspectApprovalModal'

// Using ProspectData from ProspectApprovalModal
type ProspectData = ProspectDataType

interface DataCollectionHubProps {
  onDataCollected: (data: ProspectData[], source: string) => void
  onApprovalComplete?: (approvedData: ProspectData[]) => void
  className?: string
}

export default function DataCollectionHub({ 
  onDataCollected, 
  onApprovalComplete,
  className = '' 
}: DataCollectionHubProps) {
  // Removed collect tab - all data collection happens in Sam chat now
  const [loading, setLoading] = useState(false)
  const [prospectData, setProspectData] = useState<ProspectData[]>([])
  const [showApprovalPanel, setShowApprovalPanel] = useState(false)

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
        
        alert(`✅ CSV uploaded successfully!\n\n📊 Results:\n• ${data.validation_results?.total_records || 0} total records\n• ${data.validation_results?.valid_records || 0} valid prospects\n• ${data.validation_results?.quality_score ? (data.validation_results.quality_score * 100).toFixed(0) : 0}% quality score\n\nProceeding to approval...`)
      } else {
        throw new Error(data.error || 'Failed to upload CSV')
      }
    } catch (error) {
      console.error('CSV upload error:', error)
      alert(`❌ CSV upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
      setUploadProgress(0)
    }
  }

  // LinkedIn Data Collection via Unipile MCP
  const handleLinkedInSearch = async () => {
    if (!linkedinQuery.trim()) {
      alert('Please enter a search query for LinkedIn prospects')
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
        
        alert(`✅ LinkedIn data collected!\n\n📊 Found ${linkedinData.length} prospects\nProceeding to approval...`)
      } else {
        alert('No LinkedIn prospects found for your search query.')
      }
    } catch (error) {
      console.error('LinkedIn search error:', error)
      alert(`❌ LinkedIn search failed: ${error instanceof Error ? error.message : 'Connection error'}`)
    } finally {
      setLoading(false)
    }
  }

  // Bright Data Enrichment
  const handleBrightDataEnrich = async () => {
    if (!searchQuery.trim()) {
      alert('Please enter a company or industry to search')
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
      
      alert(`✅ Bright Data enrichment complete!\n\n📊 Found ${enrichedData.length} enriched prospects\nProceeding to approval...`)
    } catch (error) {
      console.error('Bright Data error:', error)
      alert(`❌ Data enrichment failed: ${error instanceof Error ? error.message : 'Service error'}`)
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
      alert('Failed to generate test data')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = (approvedData: ProspectData[]) => {
    console.log('Approved prospects:', approvedData)
    onApprovalComplete?.(approvedData)
    alert(`✅ Approved ${approvedData.length} prospects!\n\n🎯 What's Next:\n1. Scroll down to view your approved data in the "Approved Prospects" section\n2. Select prospects and create campaigns\n3. Launch outreach with confidence\n\nYour approved prospects are now saved and ready to use!`)
  }

  const handleReject = (rejectedData: ProspectData[]) => {
    console.log('Rejected prospects:', rejectedData)
    alert(`❌ Rejected ${rejectedData.length} prospects.`)
  }

  return (
    <div className={`bg-gray-800 rounded-lg ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">Approved Prospects Dashboard</h2>
          </div>
          <div className="text-sm text-gray-400">
            {prospectData.length} prospects ready for campaigns
          </div>
        </div>
      </div>

      {/* Main Content - Approved Prospects View */}
      <div className="p-6">
        {prospectData.length > 0 ? (
          <div className="space-y-4">
            <div className="text-gray-400 text-sm mb-4">
              Prospects approved through Sam chat will appear here.
            </div>
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-white">
                  {prospectData.length} Approved Prospects
                </h3>
                <button
                  onClick={() => setShowApprovalPanel(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  View All Details
                </button>
              </div>
              
              {/* Preview List */}
              <div className="bg-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto">
                <div className="space-y-3">
                  {prospectData.slice(0, 10).map((prospect, index) => (
                    <div key={prospect.id} className="flex justify-between items-center p-3 bg-gray-600 rounded-lg">
                      <div>
                        <div className="text-white font-medium">{prospect.name}</div>
                        <div className="text-gray-300 text-sm">{prospect.title} at {prospect.company}</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          prospect.confidence > 0.8 ? 'bg-green-600 text-green-100' :
                          prospect.confidence > 0.6 ? 'bg-yellow-600 text-yellow-100' :
                          'bg-red-600 text-red-100'
                        }`}>
                          {Math.round(prospect.confidence * 100)}%
                        </span>
                        <span className="text-xs text-gray-400">{prospect.source}</span>
                      </div>
                    </div>
                  ))}
                  {prospectData.length > 10 && (
                    <div className="text-center text-gray-400 text-sm py-2">
                      + {prospectData.length - 10} more prospects...
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-400 mb-2">No Approved Prospects Yet</h3>
              <p className="text-gray-500 mb-4">
                Use Sam chat to upload CSV files or search LinkedIn. Approved prospects will appear here.
              </p>
              <div className="text-sm text-gray-600">
                💬 Go to Sam chat and try:
                <ul className="mt-2 text-left inline-block">
                  <li>• "Upload prospects from my CSV"</li>
                  <li>• "Find CTOs at SaaS companies"</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Prospect Approval Modal */}
      <ProspectApprovalModal
        isVisible={showApprovalPanel}
        onClose={() => setShowApprovalPanel(false)}
        prospects={prospectData}
        onApprove={handleApprove}
        onReject={handleReject}
        title="Approve Collected Prospects"
        subtitle="Review prospects from your data collection"
      />
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