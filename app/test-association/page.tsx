'use client'

import { useState } from 'react'

export default function TestAssociationPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testAssociation = async () => {
    setLoading(true)
    try {
      // First, ensure the database table and functions are set up
      console.log('🔧 Setting up database table and functions...')
      const setupResponse = await fetch('/api/setup/user-associations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const setupData = await setupResponse.json()
      console.log('📊 Setup result:', setupData)
      
      if (!setupData.success) {
        setResult({ error: 'Database setup failed', setup: setupData })
        setLoading(false)
        return
      }
      
      // Now test the manual association (this is specific to Thorsten's account)
      console.log('🔗 Testing manual LinkedIn association...')
      const response = await fetch('/api/setup/manual-linkedin-association', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const data = await response.json()
      setResult({ status: response.status, data, setup: setupData })
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Unknown error' })
    }
    setLoading(false)
  }

  const checkTable = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/setup/user-associations', {
        method: 'GET'
      })
      const data = await response.json()
      setResult({ status: response.status, data })
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Unknown error' })
    }
    setLoading(false)
  }

  const testProductionAPI = async () => {
    setLoading(true)
    try {
      // First, ensure the database table and functions are set up
      console.log('🔧 Setting up database table and functions...')
      const setupResponse = await fetch('/api/setup/user-associations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const setupData = await setupResponse.json()
      console.log('📊 Setup result:', setupData)
      
      if (!setupData.success) {
        setResult({ error: 'Database setup failed', setup: setupData })
        setLoading(false)
        return
      }
      
      // Test the production LinkedIn association API
      console.log('🔗 Testing production LinkedIn association API...')
      const response = await fetch('/api/linkedin/associate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          unipile_account_id: 'isCX0_ZQStWs1xxqilsw5Q',
          platform: 'LINKEDIN',
          account_name: 'Thorsten Linz',
          account_email: 'tl@innovareai.com',
          linkedin_public_identifier: 'tvonlinz',
          linkedin_profile_url: 'https://linkedin.com/in/tvonlinz',
          connection_status: 'active'
        })
      })
      const data = await response.json()
      setResult({ status: response.status, data, setup: setupData, test_type: 'production_api' })
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Unknown error' })
    }
    setLoading(false)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test LinkedIn Association</h1>
      
      <div className="space-y-4">
        <button
          onClick={testAssociation}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Test Manual Association'}
        </button>

        <button
          onClick={checkTable}
          disabled={loading}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 ml-4"
        >
          {loading ? 'Loading...' : 'Check Table Status'}
        </button>

        <button
          onClick={testProductionAPI}
          disabled={loading}
          className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50 ml-4"
        >
          {loading ? 'Loading...' : 'Test Production API'}
        </button>
      </div>

      {result && (
        <div className="mt-6 p-4 bg-gray-100 rounded">
          <h2 className="font-bold mb-2">Result:</h2>
          <pre className="whitespace-pre-wrap text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}