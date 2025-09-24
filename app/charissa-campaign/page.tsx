'use client'

import { useState } from 'react'

export default function CharissaCampaignPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [launchResult, setLaunchResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile)
      setError(null)
    } else {
      setError('Please select a valid CSV file')
      setFile(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a CSV file first')
      return
    }

    setUploading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/campaigns/charissa/upload-csv', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        setResult(data)
      } else {
        setError(data.error || 'Upload failed')
      }
    } catch (err) {
      setError('Network error during upload')
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleLaunchCampaign = async () => {
    if (!result?.campaign_id) {
      setError('No campaign to launch. Please upload CSV first.')
      return
    }

    setLaunching(true)
    setError(null)
    setLaunchResult(null)

    try {
      const response = await fetch('/api/campaigns/charissa/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          campaign_id: result.campaign_id,
          execution_preferences: {
            batch_size: 20,
            max_daily_requests: 50,
            start_immediately: true
          }
        })
      })

      const data = await response.json()

      if (data.success) {
        setLaunchResult(data)
      } else {
        setError(data.error || 'Campaign launch failed')
      }
    } catch (err) {
      setError('Network error during campaign launch')
      console.error('Launch error:', err)
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Charissa's LinkedIn Campaign Setup
            </h1>
            <p className="text-gray-600">
              Upload your CSV file to launch your first LinkedIn campaign
            </p>
          </div>

          {/* Campaign Status */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-green-800 mb-4">
              🚀 Campaign Infrastructure Ready
            </h2>
            <div className="space-y-2 text-sm text-green-700">
              <div>✅ LinkedIn Account: Charissa Daniel (Active)</div>
              <div>✅ Account ID: he3RXnROSLuhONxgNle7dw</div>
              <div>✅ N8N Workflow: LinkedIn-Only Configuration</div>
              <div>✅ Campaign Type: LinkedIn Founder Outreach</div>
              <div>✅ Status: Ready for CSV Upload</div>
            </div>
          </div>

          {/* CSV Upload Section */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-6 hover:border-blue-400 transition-colors">
            <div className="text-center">
              <div className="mb-4">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              
              <input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              
              <label htmlFor="csv-upload" className="cursor-pointer block mb-4">
                <div className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium inline-block transition-colors">
                  Choose CSV File
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  CSV file with prospect data (max 1MB)
                </p>
              </label>
              
              {file && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    ✅ Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                </div>
              )}
              
              {file && (
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed ml-4"
                >
                  {uploading ? 'Uploading...' : 'Upload CSV & Create Campaign'}
                </button>
              )}
            </div>
          </div>

          {/* CSV Format Requirements */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-3">
              📋 Simple CSV Format - Only 4 Columns Required
            </h3>
            <div className="space-y-3">
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">Required Columns (exactly these headers):</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <p>• <code className="bg-gray-100 px-2 py-1 rounded">first_name</code></p>
                    <p>• <code className="bg-gray-100 px-2 py-1 rounded">last_name</code></p>
                  </div>
                  <div className="space-y-1">
                    <p>• <code className="bg-gray-100 px-2 py-1 rounded">company_name</code></p>
                    <p>• <code className="bg-gray-100 px-2 py-1 rounded">linkedin_url</code></p>
                  </div>
                </div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  <strong>Example CSV header row:</strong><br/>
                  <code className="bg-white px-2 py-1 rounded mt-1 inline-block">first_name,last_name,company_name,linkedin_url</code>
                </p>
              </div>
              <div className="text-xs text-blue-600">
                💡 Make sure your CSV has these exact column headers in the first row
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">❌ {error}</p>
            </div>
          )}

          {/* Success Result */}
          {result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-800 mb-4">
                🎉 Upload Successful!
              </h3>
              <div className="space-y-2 text-sm text-green-700">
                <p><strong>Campaign ID:</strong> {result.campaign_id}</p>
                <p><strong>Prospects Uploaded:</strong> {result.prospects?.successfully_inserted || 0}</p>
                <p><strong>LinkedIn Account:</strong> {result.linkedin_account_id}</p>
                <p><strong>Status:</strong> Ready for launch</p>
              </div>
              
              <div className="mt-4 p-4 bg-white rounded border">
                <h4 className="font-semibold text-gray-900 mb-2">Next Steps:</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  {result.next_steps?.map((step: string, index: number) => (
                    <li key={index}>{step}</li>
                  ))}
                </ul>
              </div>

              {/* Launch Campaign Button */}
              <div className="mt-6 text-center">
                <button
                  onClick={handleLaunchCampaign}
                  disabled={launching}
                  className="bg-green-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {launching ? 'Launching Campaign...' : '🚀 Launch LinkedIn Campaign'}
                </button>
              </div>
            </div>
          )}

          {/* Launch Result */}
          {launchResult && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-4">
                🎉 Campaign Launched Successfully!
              </h3>
              <div className="space-y-2 text-sm text-blue-700">
                <p><strong>Campaign ID:</strong> {launchResult.campaign_id}</p>
                <p><strong>Prospects Processing:</strong> {launchResult.execution_details?.prospects_processed || 0}</p>
                <p><strong>LinkedIn Account:</strong> {launchResult.linkedin_account_id}</p>
                <p><strong>Batch Size:</strong> {launchResult.execution_details?.batch_size || 0} connections per batch</p>
                <p><strong>Estimated Completion:</strong> {new Date(launchResult.execution_details?.estimated_completion_time || '').toLocaleDateString()}</p>
              </div>
              
              <div className="mt-4 p-4 bg-white rounded border">
                <h4 className="font-semibold text-gray-900 mb-2">Monitoring:</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>✅ Campaign is now active and running</li>
                  <li>🔗 LinkedIn connection requests are being sent automatically</li>
                  <li>📊 Progress updates will be sent via webhook</li>
                  <li>💬 Response tracking is enabled</li>
                </ul>
              </div>

              <div className="mt-4 p-4 bg-green-50 rounded border border-green-200">
                <h4 className="font-semibold text-green-800 mb-2">Next Steps:</h4>
                <ul className="space-y-1 text-sm text-green-700">
                  {launchResult.next_steps?.map((step: string, index: number) => (
                    <li key={index}>{step}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}