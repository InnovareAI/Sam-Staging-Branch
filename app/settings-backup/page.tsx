'use client';

import { toastSuccess, toastError, toastWarning, toastInfo } from '@/lib/toast';
import { createClient } from '@/app/lib/supabase';
import { useState, useEffect } from 'react';
import { Settings, Building2, UserCheck, Globe, Plus, Mail, Users, Trash2 } from 'lucide-react';
import LocationIndicator from '@/components/LocationIndicator';

interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  settings: any;
  members: WorkspaceMember[];
}

interface WorkspaceMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  user: {
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

export default function SettingsPage() {
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('workspaces');
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [showInviteUser, setShowInviteUser] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Instead of redirecting to signin, go back to main app
        console.log('No user found, redirecting to home');
        window.location.href = '/';
        return;
      }
      setUser(user);
      await loadWorkspaces(user.id);
    } catch (error) {
      console.error('Auth check failed:', error);
      // On error, also go back to main app instead of signin
      window.location.href = '/';
    } finally {
      setLoading(false);
    }
  };

  const loadWorkspaces = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select(`
          *,
          workspace_members (
            id,
            user_id,
            role,
            joined_at,
            users (
              email,
              first_name,
              last_name
            )
          )
        `)
        .eq('owner_id', userId);

      if (error) throw error;
      setWorkspaces(data || []);
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    }
  };

  const createWorkspace = async () => {
    if (!newWorkspaceName.trim() || !user) return;

    try {
      const { data, error } = await supabase
        .from('workspaces')
        .insert({
          name: newWorkspaceName,
          owner_id: user.id,
          created_by: user.id,
          settings: {}
        })
        .select()
        .single();

      if (error) throw error;

      // Add owner as workspace member
      await supabase
        .from('workspace_members')
        .insert({
          workspace_id: data.id,
          user_id: user.id,
          role: 'owner'
        });

      setNewWorkspaceName('');
      setShowCreateWorkspace(false);
      await loadWorkspaces(user.id);
    } catch (error) {
      console.error('Failed to create workspace:', error);
      toastError('Failed to create workspace');
    }
  };

  const inviteUser = async () => {
    if (!inviteEmail.trim() || !selectedWorkspace) return;

    try {
      // Send invite via API (will use Postmark)
      const response = await fetch('/api/workspaces/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          workspaceId: selectedWorkspace,
          role: inviteRole
        })
      });

      if (response.ok) {
        setInviteEmail('');
        setShowInviteUser(false);
        toastError('Invitation sent successfully!');
        await loadWorkspaces(user.id);
      } else {
        throw new Error('Failed to send invitation');
      }
    } catch (error) {
      console.error('Failed to invite user:', error);
      toastError('Failed to send invitation');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <Settings className="animate-spin mx-auto mb-4" size={48} />
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-semibold flex items-center">
            <Settings className="mr-3" size={36} />
            Settings
          </h1>
          <button 
            onClick={() => window.location.href = '/'}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors"
          >
            ← Back to App
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-800 rounded-lg p-1 mb-8">
          <button
            onClick={() => setActiveTab('workspaces')}
            className={`flex items-center px-4 py-2 rounded-md transition-colors ${
              activeTab === 'workspaces' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Building2 className="mr-2" size={16} />
            Workspaces
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center px-4 py-2 rounded-md transition-colors ${
              activeTab === 'profile' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <UserCheck className="mr-2" size={16} />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('location')}
            className={`flex items-center px-4 py-2 rounded-md transition-colors ${
              activeTab === 'location' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Globe className="mr-2" size={16} />
            Proxy Location
          </button>
        </div>

        {/* Workspaces Tab */}
        {activeTab === 'workspaces' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Workspace Management</h2>
              <button
                onClick={() => setShowCreateWorkspace(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
              >
                <Plus className="mr-2" size={16} />
                Create Workspace
              </button>
            </div>

            {/* Workspaces List */}
            <div className="grid gap-6">
              {workspaces.map((workspace) => (
                <div key={workspace.id} className="bg-gray-800 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-semibold">{workspace.name}</h3>
                      <p className="text-gray-400 text-sm">
                        Created {new Date(workspace.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedWorkspace(workspace.id);
                        setShowInviteUser(true);
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
                    >
                      <Mail className="mr-2" size={16} />
                      Invite User
                    </button>
                  </div>

                  {/* Members List */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-300 flex items-center">
                      <Users className="mr-2" size={16} />
                      Members ({workspace.members?.length || 0})
                    </h4>
                    {workspace.members?.map((member) => (
                      <div key={member.id} className="flex items-center justify-between py-2 px-3 bg-gray-700 rounded">
                        <div>
                          <p className="font-medium">
                            {member.user?.first_name} {member.user?.last_name} 
                            <span className="text-gray-400 ml-2">({member.user?.email})</span>
                          </p>
                          <p className="text-sm text-gray-400">
                            {member.role} • Joined {new Date(member.joined_at).toLocaleDateString()}
                          </p>
                        </div>
                        {member.role !== 'owner' && (
                          <button className="text-red-400 hover:text-red-300 p-1">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    {(!workspace.members || workspace.members.length === 0) && (
                      <p className="text-gray-500 text-center py-4">No members yet</p>
                    )}
                  </div>
                </div>
              ))}

              {workspaces.length === 0 && (
                <div className="text-center py-12 bg-gray-800 rounded-lg">
                  <Building2 className="mx-auto mb-4 text-gray-600" size={48} />
                  <p className="text-gray-400 mb-4">No workspaces yet</p>
                  <button
                    onClick={() => setShowCreateWorkspace(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg"
                  >
                    Create Your First Workspace
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-6">User Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">First Name</label>
                  <input
                    type="text"
                    value={user?.user_metadata?.first_name || ''}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Last Name</label>
                  <input
                    type="text"
                    value={user?.user_metadata?.last_name || ''}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>
              </div>
              <button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg">
                Update Profile
              </button>
            </div>
          </div>
        )}

        {/* Proxy Location Tab */}
        {activeTab === 'location' && (
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center mb-6">
              <Globe className="mr-3 text-blue-400" size={24} />
              <h2 className="text-2xl font-semibold">Proxy Location Settings</h2>
            </div>
            <div className="space-y-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-2 text-blue-400">Current Location</h3>
                <p className="text-gray-300 text-sm mb-4">
                  Your current Bright Data proxy location for LinkedIn scraping and web requests. 
                  This location determines how your activity appears globally and affects compliance and performance.
                </p>
                <LocationIndicator />
              </div>
              
              <div className="bg-blue-900/20 border border-blue-400/30 rounded-lg p-4">
                <h4 className="text-blue-300 font-medium mb-2">About Proxy Locations</h4>
                <ul className="text-blue-200 text-sm space-y-1">
                  <li>• Locations are automatically assigned based on your LinkedIn profile when you first connect</li>
                  <li>• You can manually change your location at any time using the "Change" button</li>
                  <li>• Different locations may have varying performance and compliance requirements</li>
                  <li>• US locations (especially California, New York, Texas) typically offer the best performance</li>
                  <li>• Choose a location that matches your target audience or compliance needs</li>
                </ul>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Create Workspace Modal */}
      {showCreateWorkspace && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Create New Workspace</h3>
            <input
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              placeholder="Workspace name"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white mb-4"
            />
            <div className="flex space-x-3">
              <button
                onClick={createWorkspace}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreateWorkspace(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Invite User</h3>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white mb-4"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white mb-4"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <div className="flex space-x-3">
              <button
                onClick={inviteUser}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg"
              >
                Send Invite
              </button>
              <button
                onClick={() => setShowInviteUser(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
