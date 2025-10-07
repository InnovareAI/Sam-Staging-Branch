'use client';

import { toastSuccess, toastError, toastWarning, toastInfo } from '@/lib/toast'

  RefreshCw, 
  Zap, 
  CheckCircle, 
  AlertCircle, 
  Users, 
  Settings, 
  Monitor,
  Activity,
  Shield,
  Database,
  Clock,
  BarChart3
} from 'lucide-react'

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
        toastError(`Deployment failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Deployment error:', error)
      toastError('Deployment failed - check console for details')
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Super Admin Dashboard</h1>
          <p className="text-gray-600">Manage Unipile authentication deployments across all workspaces</p>
        </div>
        <div className="flex items-center space-x-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm">
                  <Monitor className="h-4 w-4 mr-2" />
                  System Health
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View overall system status</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <Button size="sm" className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span>View Logs</span>
          </Button>
        </div>
      </div>

      {/* System Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>System Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {deploymentSummary?.total_workspaces || 0}
              </div>
              <div className="text-sm text-gray-600">Total Workspaces</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {deploymentSummary?.successful_deployments || 0}
              </div>
              <div className="text-sm text-gray-600">Active Deployments</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {deploymentSummary?.failed_deployments || 0}
              </div>
              <div className="text-sm text-gray-600">Failed Deployments</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {deploymentSummary ? Math.round((deploymentSummary.successful_deployments / Math.max(1, deploymentSummary.total_workspaces)) * 100) : 0}%
              </div>
              <div className="text-sm text-gray-600">Success Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deployment Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Deployment Configuration</span>
            <Badge className="bg-blue-100 text-blue-800">
              Admin Panel
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Tenants
              </label>
              <Select value={targetTenants} onValueChange={(value: string) => setTargetTenants(value as 'all' | 'new_only' | 'specific')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_only">🎯 New Tenants Only</SelectItem>
                  <SelectItem value="all">🏢 All Active Tenants</SelectItem>
                  <SelectItem value="specific">📋 Specific Tenants</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deployment Mode
              </label>
              <Select value={deploymentMode} onValueChange={(value: string) => setDeploymentMode(value as 'test' | 'production')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="test">🧪 Test Mode</SelectItem>
                  <SelectItem value="production">🚀 Production Mode</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {deploymentMode === 'test' ? 
                '⚠️ Test deployments will not affect production workspaces' : 
                '⚡ Production deployments will update all selected workspaces'
              }
            </div>
            <Button 
              onClick={deployUnipileAuth}
              disabled={isDeploying}
              className={`flex items-center space-x-2 ${deploymentMode === 'production' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
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
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Deployment Results</span>
              <Badge className="bg-gray-100 text-gray-800">
                {deploymentResults.length} workspaces
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {deploymentResults.map((result, index) => (
                <Card key={index} className={`transition-all duration-200 ${result.status === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {result.status === 'success' ? (
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        ) : (
                          <AlertCircle className="h-6 w-6 text-red-600" />
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{result.workspace_name}</div>
                          <div className="text-sm text-gray-600">{result.workspace_id}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(result.status)}>
                          {result.status.toUpperCase()}
                        </Badge>
                        {result.error && (
                          <div className="text-sm text-red-600 mt-1 max-w-xs">
                            {result.error}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Steps */}
      {deploymentSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Recommended Next Steps</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                <Monitor className="h-5 w-5 text-blue-600" />
                <span className="text-sm">Monitor authentication status across tenants</span>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-sm">Verify integrations are working correctly</span>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
                <Activity className="h-5 w-5 text-purple-600" />
                <span className="text-sm">Set up automated health monitoring</span>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg">
                <Settings className="h-5 w-5 text-orange-600" />
                <span className="text-sm">Configure N8N workflows for status updates</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Notice */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <Shield className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-amber-800">Security Notice</div>
              <div className="text-sm text-amber-700 mt-1">
                All deployment actions are logged and audited. Production deployments require additional verification 
                and will affect live customer workspaces. Always test in development mode first.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
