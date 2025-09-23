'use client'

import React, { useState, useEffect } from 'react'
import DataApprovalPanel from '@/components/DataApprovalPanel'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface ProspectData {
  id: string
  name: string
  title: string
  company: string
  email?: string
  phone?: string
  linkedinUrl?: string
  source: 'unipile' | 'bright-data' | 'websearch' | 'test_data'
  confidence: number
  complianceFlags?: string[]
}

export default function DataApprovalDemo() {
  const [prospectData, setProspectData] = useState<ProspectData[]>([])
  const [isVisible, setIsVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [stats, setStats] = useState({ approved: 0, rejected: 0, total: 0 })
  
  const supabase = createClientComponentClient()

  // Auto-generate test data on page load
  useEffect(() => {
    generateTestData(25, 'linkedin')
  }, [])

  const generateTestData = async (count: number = 25, source: string = 'linkedin') => {
    setLoading(true)
    try {
      // Get session for authenticated requests
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        // Use authenticated endpoint for full functionality
        const response = await fetch('/api/prospects/test-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            action: 'create_approval_session',
            count,
            data_type: 'prospect'
          })
        })
        
        const data = await response.json()
        
        if (data.success) {
          setProspectData(data.prospects)
          setSessionInfo(data.session)
          setStats({ approved: 0, rejected: 0, total: data.prospects.length })
          // Automatically show the popup
          setTimeout(() => setIsVisible(true), 500)
        } else {
          throw new Error(data.error || 'Failed to create approval session')
        }
      } else {
        // Use demo endpoint for unauthenticated users
        const response = await fetch(`/api/prospects/test-data?count=${count}&source=${source}`)
        const data = await response.json()
        
        if (data.success) {
          setProspectData(data.prospects)
          setStats({ approved: 0, rejected: 0, total: data.prospects.length })
          // Automatically show the popup for demo data too
          setTimeout(() => setIsVisible(true), 500)
        }
      }
    } catch (error) {
      console.error('Error generating test data:', error)
      alert(`Failed to generate test data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (approvedData: ProspectData[]) => {
    console.log('Approved prospects:', approvedData)
    setStats(prev => ({ ...prev, approved: prev.approved + approvedData.length }))
    
    // If we have a session, save the approval decision
    if (sessionInfo) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const prospectIndexes = approvedData.map(prospect => 
            prospectData.findIndex(p => p.id === prospect.id)
          ).filter(index => index !== -1)
          
          await fetch('/api/prospects/linkedin-approval', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              action: 'approve_prospects',
              session_id: sessionInfo.session_id,
              prospect_data: approvedData
            })
          })
        }
      } catch (error) {
        console.error('Error saving approval decision:', error)
      }
    }
    
    alert(`✅ Approved ${approvedData.length} prospects!\n\nThese would be added to your campaign prospects database.`)
  }

  const handleReject = async (rejectedData: ProspectData[]) => {
    console.log('Rejected prospects:', rejectedData)
    setStats(prev => ({ ...prev, rejected: prev.rejected + rejectedData.length }))
    
    // If we have a session, save the rejection decision
    if (sessionInfo) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await fetch('/api/prospects/linkedin-approval', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              action: 'reject_prospects',
              session_id: sessionInfo.session_id,
              prospect_data: rejectedData
            })
          })
        }
      } catch (error) {
        console.error('Error saving rejection decision:', error)
      }
    }
    
    alert(`❌ Rejected ${rejectedData.length} prospects.\n\nThese will not be added to your campaigns.`)
  }

  const resetDemo = () => {
    setProspectData([])
    setIsVisible(false)
    setSessionInfo(null)
    setStats({ approved: 0, rejected: 0, total: 0 })
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-4">
            Data Approval System Demo
          </h1>
          <p className="text-gray-300 text-lg">
            Experience SAM AI's prospect data approval workflow with realistic test data
          </p>
        </div>

        {/* Controls */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Generate Test Data</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <button
              onClick={() => generateTestData(10, 'linkedin')}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors flex items-center justify-center"
            >
              {loading ? '⏳ Generating...' : '📱 LinkedIn Data (10 prospects)'}
            </button>
            
            <button
              onClick={() => generateTestData(25, 'apollo')}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors flex items-center justify-center"
            >
              {loading ? '⏳ Generating...' : '🎯 Apollo Data (25 prospects)'}
            </button>
            
            <button
              onClick={() => generateTestData(50, 'csv_upload')}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors flex items-center justify-center"
            >
              {loading ? '⏳ Generating...' : '📄 CSV Import (50 prospects)'}
            </button>
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={resetDemo}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              🔄 Reset Demo
            </button>
            
            {sessionInfo && (
              <div className="text-sm text-gray-400 flex items-center">
                📊 Session: {sessionInfo.session_id?.slice(-8)} | 
                Quality Score: {(sessionInfo.data_quality_score * 100).toFixed(0)}%
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats.total > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Approval Statistics</h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{stats.total}</div>
                <div className="text-sm text-gray-400">Total Prospects</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{stats.approved}</div>
                <div className="text-sm text-gray-400">Approved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{stats.rejected}</div>
                <div className="text-sm text-gray-400">Rejected</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">
                  {stats.total - stats.approved - stats.rejected}
                </div>
                <div className="text-sm text-gray-400">Pending</div>
              </div>
            </div>
          </div>
        )}

        {/* Features Overview */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">System Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-semibold text-green-400 mb-2">✅ Smart Quality Scoring</h3>
              <p className="text-sm text-gray-300">
                AI-powered confidence scores based on title seniority, company size, and industry relevance
              </p>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-400 mb-2">📊 Batch Operations</h3>
              <p className="text-sm text-gray-300">
                Select multiple prospects for bulk approve/reject operations with detailed tracking
              </p>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-400 mb-2">🔍 Compliance Flags</h3>
              <p className="text-sm text-gray-300">
                Automatic detection of GDPR requirements and other compliance considerations
              </p>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-semibold text-yellow-400 mb-2">📈 Source Tracking</h3>
              <p className="text-sm text-gray-300">
                Track data sources (LinkedIn, Apollo, CSV) with source-specific quality metrics
              </p>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-semibold text-red-400 mb-2">⚡ Real-time Updates</h3>
              <p className="text-sm text-gray-300">
                Instant database updates with quota tracking and session management
              </p>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-semibold text-indigo-400 mb-2">📤 Export Ready</h3>
              <p className="text-sm text-gray-300">
                Export approved prospects to CSV or direct integration with campaign systems
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        {!isVisible && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">How It Works</h2>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
                <div>
                  <h3 className="font-semibold">Generate Test Data</h3>
                  <p className="text-gray-400">Click any button above to generate realistic prospect data from different sources</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
                <div>
                  <h3 className="font-semibold">Review Prospects</h3>
                  <p className="text-gray-400">Use the approval panel to review prospect details, quality scores, and compliance flags</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</span>
                <div>
                  <h3 className="font-semibold">Make Decisions</h3>
                  <p className="text-gray-400">Select prospects individually or in bulk to approve or reject them</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">4</span>
                <div>
                  <h3 className="font-semibold">Track Results</h3>
                  <p className="text-gray-400">Monitor approval statistics and export approved prospects for campaigns</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Data Approval Panel */}
        <DataApprovalPanel
          isVisible={isVisible}
          onClose={() => setIsVisible(false)}
          prospectData={prospectData}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      </div>
    </div>
  )
}