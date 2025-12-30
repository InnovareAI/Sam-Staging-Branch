'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  User, 
  Mail, 
  MessageSquare, 
  Users, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Settings, 
  Plus,
  Eye,
  EyeOff,
  BarChart3
} from 'lucide-react'

interface WorkspaceAccount {
  id: string
  user_id: string
  user_email: string
  account_type: 'linkedin' | 'email' | 'whatsapp' | 'instagram'
  account_identifier: string
  account_name?: string
  connection_status: 'connected' | 'disconnected' | 'error' | 'suspended'
  is_primary: boolean
  daily_message_count: number
  daily_message_limit: number
  usage_percentage: number
  last_message_sent_at?: string
  is_currently_selected: boolean
}

interface TeamMember {
  user_id: string
  user_email: string
  role: string
  accounts: WorkspaceAccount[]
}

interface AccountSwitcherProps {
  workspaceId: string
  currentUserId: string
  onAccountSwitch?: (accountType: string, accountId: string) => void
}

export function WorkspaceAccountSwitcher({ workspaceId, currentUserId, onAccountSwitch }: AccountSwitcherProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showAllAccounts, setShowAllAccounts] = useState(false)
  const [selectedAccountType, setSelectedAccountType] = useState<string>('all')

  useEffect(() => {
    fetchWorkspaceAccounts()
  }, [workspaceId])

  const fetchWorkspaceAccounts = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/workspace/${workspaceId}/accounts`)
      const data = await response.json()

      if (data.success) {
        // Group accounts by user
        const memberMap = new Map<string, TeamMember>()
        
        data.accounts.forEach((account: WorkspaceAccount) => {
          if (!memberMap.has(account.user_id)) {
            memberMap.set(account.user_id, {
              user_id: account.user_id,
              user_email: account.user_email,
              role: 'member', // This would come from workspace_members
              accounts: []
            })
          }
          memberMap.get(account.user_id)!.accounts.push(account)
        })

        setTeamMembers(Array.from(memberMap.values()))
      }
    } catch (error) {
      console.error('Failed to fetch workspace accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAccountSwitch = async (accountType: string, accountId: string) => {
    try {
      const response = await fetch(`/api/workspace/${workspaceId}/switch-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_type: accountType,
          account_id: accountId
        })
      })

      if (response.ok) {
        await fetchWorkspaceAccounts() // Refresh to show updated selection
        onAccountSwitch?.(accountType, accountId)
      }
    } catch (error) {
      console.error('Failed to switch account:', error)
    }
  }

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case 'linkedin': return '💼'
      case 'email': return '📧'
      case 'whatsapp': return '💬'
      case 'instagram': return '📷'
      default: return '🔗'
    }
  }

  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-100 text-green-800'
      case 'disconnected': return 'bg-gray-100 text-gray-800'
      case 'error': return 'bg-red-100 text-red-800'
      case 'suspended': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const currentUserAccounts = teamMembers.find(member => member.user_id === currentUserId)?.accounts || []
  const otherMembers = teamMembers.filter(member => member.user_id !== currentUserId)

  const AccountCard = ({ account, isCurrentUser }: { account: WorkspaceAccount; isCurrentUser: boolean }) => (
    <Card className={`transition-all duration-200 ${account.is_currently_selected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{getAccountTypeIcon(account.account_type)}</div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-medium capitalize">{account.account_type}</span>
                {account.is_primary && (
                  <Badge variant="outline" className="text-xs">Primary</Badge>
                )}
                {account.is_currently_selected && (
                  <Badge className="text-xs bg-blue-600">Active</Badge>
                )}
              </div>
              <div className="text-sm text-gray-600">{account.account_identifier}</div>
              {account.account_name && (
                <div className="text-xs text-gray-500">{account.account_name}</div>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <Badge className={`text-xs ${getConnectionStatusColor(account.connection_status)}`}>
              {account.connection_status}
            </Badge>
          </div>
        </div>

        {/* Usage Statistics */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Daily Usage</span>
            <span>{account.daily_message_count}/{account.daily_message_limit}</span>
          </div>
          <Progress 
            value={account.usage_percentage * 100} 
            className={`h-2 ${getUsageColor(account.usage_percentage * 100)}`}
          />
          {account.last_message_sent_at && (
            <div className="text-xs text-gray-500">
              Last used: {new Date(account.last_message_sent_at).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex justify-between items-center">
          {isCurrentUser && account.connection_status === 'connected' && !account.is_currently_selected && (
            <Button
              size="sm"
              onClick={() => handleAccountSwitch(account.account_type, account.id)}
              className="bg-blue-600 hover:bg-blue-700 text-foreground"
            >
              Switch To This
            </Button>
          )}
          
          {account.is_currently_selected && (
            <Badge className="bg-green-100 text-green-800">
              Currently Using
            </Badge>
          )}

          {!isCurrentUser && (
            <div className="text-xs text-gray-500">
              Used by {account.user_email}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )

  const TeamMemberSection = ({ member, isCurrentUser }: { member: TeamMember; isCurrentUser: boolean }) => (
    <div className="space-y-4">
      <div className="flex items-center space-x-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-sm">
            {member.user_email.split('@')[0].slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="font-medium">{member.user_email}</div>
          <div className="text-sm text-gray-600">
            {isCurrentUser ? 'You' : member.role} • {member.accounts.length} accounts
          </div>
        </div>
        {isCurrentUser && (
          <Badge className="bg-blue-100 text-blue-800">Your Accounts</Badge>
        )}
      </div>

      {/* Filter accounts by type if selected */}
      {member.accounts
        .filter(account => selectedAccountType === 'all' || account.account_type === selectedAccountType)
        .map(account => (
          <AccountCard key={account.id} account={account} isCurrentUser={isCurrentUser} />
        ))}
    </div>
  )

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading workspace accounts...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Account Management</h2>
          <p className="text-gray-600">Switch between team accounts for campaigns</p>
        </div>
        <div className="flex items-center space-x-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllAccounts(!showAllAccounts)}
                >
                  {showAllAccounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="ml-2">
                    {showAllAccounts ? 'Hide Team' : 'Show Team'}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{showAllAccounts ? 'Hide other team members\' accounts' : 'Show all team accounts'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <Button size="sm" className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Connect Account</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Filter Accounts</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Account Type:</label>
              <Select value={selectedAccountType} onValueChange={setSelectedAccountType}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="linkedin">💼 LinkedIn</SelectItem>
                  <SelectItem value="email">📧 Email</SelectItem>
                  <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                  <SelectItem value="instagram">📷 Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Your Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Your Accounts</span>
            <Badge className="bg-blue-100 text-blue-800">
              {currentUserAccounts.length} connected
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentUserAccounts.length === 0 ? (
            <div className="text-center p-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No accounts connected yet</p>
              <Button className="flex items-center space-x-2 mx-auto">
                <Plus className="h-4 w-4" />
                <span>Connect Your First Account</span>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {currentUserAccounts
                .filter(account => selectedAccountType === 'all' || account.account_type === selectedAccountType)
                .map(account => (
                  <AccountCard key={account.id} account={account} isCurrentUser={true} />
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Accounts */}
      {showAllAccounts && otherMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Team Accounts</span>
              <Badge className="bg-gray-100 text-gray-800">
                {otherMembers.length} members
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {otherMembers.map(member => (
              <TeamMemberSection key={member.user_id} member={member} isCurrentUser={false} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Team Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Team Usage Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-semibold text-blue-600">
                {teamMembers.reduce((sum, member) => sum + member.accounts.length, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Accounts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-green-600">
                {teamMembers.reduce((sum, member) => 
                  sum + member.accounts.filter(acc => acc.connection_status === 'connected').length, 0
                )}
              </div>
              <div className="text-sm text-gray-600">Connected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-orange-600">
                {teamMembers.reduce((sum, member) => 
                  sum + member.accounts.reduce((accSum, acc) => accSum + acc.daily_message_count, 0), 0
                )}
              </div>
              <div className="text-sm text-gray-600">Messages Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-purple-600">
                {Math.round(
                  (teamMembers.reduce((sum, member) => 
                    sum + member.accounts.reduce((accSum, acc) => accSum + acc.usage_percentage, 0), 0
                  ) / Math.max(1, teamMembers.reduce((sum, member) => sum + member.accounts.length, 0))) * 100
                )}%
              </div>
              <div className="text-sm text-gray-600">Avg Usage</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Important Notice */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-amber-800">Prospect Deduplication Active</div>
              <div className="text-sm text-amber-700 mt-1">
                Our system automatically prevents duplicate messaging across all team accounts. 
                If someone else has already contacted a prospect, you'll be notified before sending.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}