'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, Zap, CheckCircle, AlertCircle, Users, Settings } from 'lucide-react'

interface DeploymentResult {
  workspace_id: string
  workspace_name: string
  status: 'success' | 'error'
  error?: string
}

export default function DeployUnipilePage() {
  const [deploymentMode, setDeploymentMode] = useState<'test' | 'production'>('test')
  const [targetTenants, setTargetTenants] = useState<'all' | 'new_only' | 'specific'>('new_only')
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentResults, setDeploymentResults] = useState<DeploymentResult[]>([])
  const [deploymentSummary, setDeploymentSummary] = useState<any>(null)

  const deployUnipileAuth = async () => {
    setIsDeploying(true)
    setDeploymentResults([])
    setDeploymentSummary(null)
    
    try {
      const response = await fetch('/api/admin/deploy-unipile-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          target_tenants: targetTenants,
          deployment_mode: deploymentMode
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setDeploymentResults(data.deployment_results)
        setDeploymentSummary(data.deployment_summary)
      } else {
        alert(`Deployment failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Deployment error:', error)
      alert('Deployment failed - check console for details')
    } finally {
      setIsDeploying(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800 border-green-200'
      case 'error': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Deploy Unipile Authentication
          </h1>
          <p className="text-gray-600">
            Deploy Unipile LinkedIn authentication across all tenant workspaces
          </p>
        </div>

        {/* Deployment Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Deployment Configuration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Tenants
                </label>
                <Select value={targetTenants} onValueChange={setTargetTenants}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new_only">New Tenants Only</SelectItem>
                    <SelectItem value="all">All Active Tenants</SelectItem>
                    <SelectItem value="specific">Specific Tenants</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deployment Mode
                </label>
                <Select value={deploymentMode} onValueChange={setDeploymentMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test">Test Mode</SelectItem>
                    <SelectItem value="production">Production Mode</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-4">
              <Button 
                onClick={deployUnipileAuth}
                disabled={isDeploying}
                className="w-full md:w-auto flex items-center space-x-2"
              >
                {isDeploying ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                <span>
                  {isDeploying ? 'Deploying...' : 'Deploy Unipile Authentication'}
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Deployment Summary */}
        {deploymentSummary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Deployment Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {deploymentSummary.total_workspaces}
                  </div>
                  <div className="text-sm text-gray-600">Total Workspaces</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {deploymentSummary.successful_deployments}
                  </div>
                  <div className="text-sm text-gray-600">Successful</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {deploymentSummary.failed_deployments}
                  </div>
                  <div className="text-sm text-gray-600">Failed</div>
                </div>
                <div className="text-center">
                  <Badge className="bg-blue-100 text-blue-800">
                    {deploymentSummary.deployment_mode}
                  </Badge>
                  <div className="text-sm text-gray-600 mt-1">Mode</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deployment Results */}
        {deploymentResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Deployment Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {deploymentResults.map((result, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      {result.status === 'success' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                      <div>
                        <div className="font-medium">{result.workspace_name}</div>
                        <div className="text-sm text-gray-600">{result.workspace_id}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(result.status)}>
                        {result.status}
                      </Badge>
                      {result.error && (
                        <div className="text-sm text-red-600 mt-1">
                          {result.error}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Steps */}
        {deploymentSummary && (
          <Card>
            <CardHeader>
              <CardTitle>Next Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>• Monitor authentication status across tenants</div>
                <div>• Verify integrations are working correctly</div>
                <div>• Set up automated health monitoring</div>
                <div>• Configure N8N workflows for status updates</div>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  )
}