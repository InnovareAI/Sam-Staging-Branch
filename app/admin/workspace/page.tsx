'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { 
  Building2, 
  Users, 
  Settings, 
  DollarSign,
  UserPlus,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Mail,
  Shield,
  Crown,
  Edit,
  Trash2,
  MoreVertical,
  Calendar,
  CreditCard,
  TrendingUp
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

interface WorkspaceMember {
  id: string
  user_id: string
  email: string
  full_name: string
  role: 'owner' | 'admin' | 'member'
  status: 'active' | 'invited' | 'suspended'
  joined_at: string
}

export default function AdminWorkspacePage() {
  const [loading, setLoading] = useState(false)
  const [workspace, setWorkspace] = useState<any>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  
  // Workspace settings form
  const [workspaceForm, setWorkspaceForm] = useState({
    name: '',
    description: '',
    website: '',
    industry: ''
  })
  
  // Billing info
  const [billingInfo, setBillingInfo] = useState({
    plan: 'Enterprise',
    status: 'active',
    nextBilling: '2024-10-15',
    amount: 299,
    users: 15,
    maxUsers: 50
  })

  useEffect(() => {
    fetchWorkspaceData()
    fetchMembers()
  }, [])

  const fetchWorkspaceData = async () => {
    try {
      setLoading(true)
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Fetch workspace info
        const { data: workspaceData, error } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009') // InnovareAI workspace
          .single()
        
        if (workspaceData) {
          setWorkspace(workspaceData)
          setWorkspaceForm({
            name: workspaceData.name || '',
            description: workspaceData.description || '',
            website: workspaceData.website || '',
            industry: workspaceData.industry || ''
          })
        }
      }
    } catch (error) {
      console.error('Error fetching workspace:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMembers = async () => {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      const { data, error } = await supabase
        .from('workspace_members')
        .select(`
          id,
          user_id,
          role,
          status,
          created_at,
          users!inner(email, raw_user_meta_data)
        `)
        .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')
        .order('created_at', { ascending: false })
      
      if (data) {
        const formattedMembers = data.map((m: any) => ({
          id: m.id,
          user_id: m.user_id,
          email: m.users?.email || '',
          full_name: m.users?.raw_user_meta_data?.full_name || 'Unknown User',
          role: m.role,
          status: m.status,
          joined_at: new Date(m.created_at).toLocaleDateString()
        }))
        setMembers(formattedMembers)
      }
    } catch (error) {
      console.error('Error fetching members:', error)
    }
  }

  const handleWorkspaceUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      const { error } = await supabase
        .from('workspaces')
        .update({
          name: workspaceForm.name,
          description: workspaceForm.description,
          website: workspaceForm.website,
          industry: workspaceForm.industry
        })
        .eq('id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')
      
      if (error) throw error
      
      setMessage({ type: 'success', text: 'Workspace updated successfully!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update workspace' })
    } finally {
      setLoading(false)
    }
  }

  const handleInviteMember = async () => {
    setLoading(true)
    setMessage(null)
    
    try {
      const response = await fetch('/api/admin/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          workspaceId: 'babdcab8-1a78-4b2f-913e-6e9fd9821009',
          role: inviteRole
        })
      })
      
      if (!response.ok) throw new Error('Failed to send invitation')
      
      setMessage({ type: 'success', text: `Invitation sent to ${inviteEmail}!` })
      setInviteEmail('')
      setShowInviteDialog(false)
      setTimeout(() => setMessage(null), 3000)
      fetchMembers()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to send invitation' })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    setLoading(true)
    setMessage(null)
    
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      const { error } = await supabase
        .from('workspace_members')
        .update({ role: newRole })
        .eq('id', memberId)
      
      if (error) throw error
      
      setMessage({ type: 'success', text: 'Member role updated!' })
      setTimeout(() => setMessage(null), 3000)
      fetchMembers()
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Failed to update role' })
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return
    
    setLoading(true)
    setMessage(null)
    
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('id', memberId)
      
      if (error) throw error
      
      setMessage({ type: 'success', text: 'Member removed successfully!' })
      setTimeout(() => setMessage(null), 3000)
      fetchMembers()
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Failed to remove member' })
    } finally {
      setLoading(false)
    }
  }

  const getRoleBadge = (role: string) => {
    const colors = {
      owner: 'bg-purple-100 text-purple-700 border-purple-200',
      admin: 'bg-blue-100 text-blue-700 border-blue-200',
      member: 'bg-slate-100 text-slate-700 border-slate-200'
    }
    return colors[role as keyof typeof colors] || colors.member
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-700 border-green-200',
      invited: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      suspended: 'bg-red-100 text-red-700 border-red-200'
    }
    return colors[status as keyof typeof colors] || colors.active
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            Workspace Management
          </h1>
          <p className="text-slate-600">Manage your InnovareAI workspace and team members</p>
        </motion.div>

        {/* Alert Messages */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Alert className={message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
              {message.type === 'success' ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
              <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                {message.text}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Main Content */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white shadow-sm">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Members
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Billing
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="shadow-lg border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="h-5 w-5 text-blue-600" />
                      Team Members
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">{members.length}</div>
                    <p className="text-sm text-slate-500 mt-1">Active users</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="shadow-lg border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Crown className="h-5 w-5 text-purple-600" />
                      Current Plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-600">{billingInfo.plan}</div>
                    <p className="text-sm text-slate-500 mt-1">${billingInfo.amount}/month</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="shadow-lg border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600 capitalize">{billingInfo.status}</div>
                    <p className="text-sm text-slate-500 mt-1">All systems operational</p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6"
            >
              <Card className="shadow-lg border-0">
                <CardHeader>
                  <CardTitle>Workspace Information</CardTitle>
                  <CardDescription>Basic details about your workspace</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">Workspace Name</p>
                      <p className="font-medium">{workspace?.name || 'InnovareAI'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Workspace ID</p>
                      <p className="font-mono text-sm">{workspace?.id || 'babdcab8-1a78-4b2f-913e-6e9fd9821009'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Created Date</p>
                      <p className="font-medium">{workspace?.created_at ? new Date(workspace.created_at).toLocaleDateString() : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Status</p>
                      <Badge className="bg-green-100 text-green-700">Active</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="shadow-lg border-0">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-600" />
                        Team Members
                      </CardTitle>
                      <CardDescription>Manage workspace members and their roles</CardDescription>
                    </div>
                    <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                      <DialogTrigger asChild>
                        <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
                          <UserPlus className="mr-2 h-4 w-4" />
                          Invite Member
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Invite New Member</DialogTitle>
                          <DialogDescription>Send an invitation to join your workspace</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="inviteEmail">Email Address</Label>
                            <Input
                              id="inviteEmail"
                              type="email"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              placeholder="colleague@example.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="inviteRole">Role</Label>
                            <Select value={inviteRole} onValueChange={(val: any) => setInviteRole(val)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            onClick={handleInviteMember}
                            disabled={loading || !inviteEmail}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600"
                          >
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Mail className="mr-2 h-4 w-4" />
                                Send Invitation
                              </>
                            )}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.full_name}</TableCell>
                          <TableCell>{member.email}</TableCell>
                          <TableCell>
                            <Badge className={getRoleBadge(member.role)}>
                              {member.role === 'owner' && <Crown className="mr-1 h-3 w-3" />}
                              {member.role === 'admin' && <Shield className="mr-1 h-3 w-3" />}
                              {member.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusBadge(member.status)}>
                              {member.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{member.joined_at}</TableCell>
                          <TableCell className="text-right">
                            {member.role !== 'owner' && (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUpdateMemberRole(member.id, member.role === 'admin' ? 'member' : 'admin')}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="shadow-lg border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-blue-600" />
                    Workspace Settings
                  </CardTitle>
                  <CardDescription>Update workspace information and preferences</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleWorkspaceUpdate} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="name">Workspace Name</Label>
                        <Input
                          id="name"
                          value={workspaceForm.name}
                          onChange={(e) => setWorkspaceForm({ ...workspaceForm, name: e.target.value })}
                          placeholder="InnovareAI"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="website">Website</Label>
                        <Input
                          id="website"
                          value={workspaceForm.website}
                          onChange={(e) => setWorkspaceForm({ ...workspaceForm, website: e.target.value })}
                          placeholder="https://innovareai.com"
                        />
                      </div>
                      
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="description">Description</Label>
                        <Input
                          id="description"
                          value={workspaceForm.description}
                          onChange={(e) => setWorkspaceForm({ ...workspaceForm, description: e.target.value })}
                          placeholder="Brief description of your workspace"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="industry">Industry</Label>
                        <Input
                          id="industry"
                          value={workspaceForm.industry}
                          onChange={(e) => setWorkspaceForm({ ...workspaceForm, industry: e.target.value })}
                          placeholder="Technology, Healthcare, etc."
                        />
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <Button type="submit" disabled={loading} className="bg-gradient-to-r from-blue-600 to-indigo-600">
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="shadow-lg border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    Billing & Subscription
                  </CardTitle>
                  <CardDescription>Manage your billing information and subscription</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-500 mb-1">Current Plan</p>
                      <p className="text-2xl font-bold text-blue-600">{billingInfo.plan}</p>
                      <p className="text-sm text-slate-600 mt-2">${billingInfo.amount}/month</p>
                    </div>
                    
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-500 mb-1">Next Billing Date</p>
                      <p className="text-2xl font-bold text-indigo-600">{new Date(billingInfo.nextBilling).toLocaleDateString()}</p>
                      <p className="text-sm text-slate-600 mt-2">Auto-renewal enabled</p>
                    </div>
                    
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-500 mb-1">Active Users</p>
                      <p className="text-2xl font-bold text-green-600">{billingInfo.users} / {billingInfo.maxUsers}</p>
                      <p className="text-sm text-slate-600 mt-2">User seats available</p>
                    </div>
                    
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-500 mb-1">Billing Status</p>
                      <p className="text-2xl font-bold text-green-600 capitalize">{billingInfo.status}</p>
                      <p className="text-sm text-slate-600 mt-2">All payments current</p>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex gap-4">
                    <Button variant="outline">
                      <Calendar className="mr-2 h-4 w-4" />
                      View Billing History
                    </Button>
                    <Button variant="outline">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Update Payment Method
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
