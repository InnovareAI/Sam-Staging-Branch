import React, { useState, useEffect } from 'react';
import { supabase } from '../app/lib/supabase';

export default function SuperAdminInvite() {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [emailList, setEmailList] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);


  // Load workspaces on component mount
  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/admin/organizations', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data.organizations || []); // Still using organizations from DB
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    }
  };

  const handleInvite = async () => {
    if (!selectedWorkspaceId || !emailList.trim()) {
      alert('Please select a workspace and enter email addresses');
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      // Parse email list - simple format: "email@example.com FirstName LastName"
      const lines = emailList.trim().split('\n');
      const users = lines.map(line => {
        const parts = line.trim().split(/\s+/);
        const email = parts[0];
        const firstName = parts[1] || 'User';
        const lastName = parts[2] || 'Name';
        
        return { email, firstName, lastName, role: 'member' };
      }).filter(user => user.email && user.email.includes('@'));

      if (users.length === 0) {
        alert('No valid email addresses found');
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/admin/bulk-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          organizationId: selectedWorkspaceId,
          users
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setResults(result);
        setEmailList(''); // Clear the form
      } else {
        alert('Error: ' + result.error);
      }

    } catch (error) {
      alert('Failed to send invitations: ' + error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
        🔑 Super Admin - Invite Users
      </h1>
      
      {/* Workspace Selection */}
      <div className="mb-6">
        <label className="block text-lg font-medium text-gray-700 mb-3">
          Select Workspace:
        </label>
        <select
          value={selectedWorkspaceId}
          onChange={(e) => setSelectedWorkspaceId(e.target.value)}
          className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="">Choose a workspace...</option>
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
      </div>

      {/* Email Input */}
      <div className="mb-6">
        <label className="block text-lg font-medium text-gray-700 mb-3">
          Email Addresses (one per line):
        </label>
        <div className="mb-2 text-sm text-gray-600">
          Format: <code>email@example.com FirstName LastName</code>
        </div>
        <textarea
          value={emailList}
          onChange={(e) => setEmailList(e.target.value)}
          placeholder="john@example.com John Doe&#10;jane@example.com Jane Smith&#10;mike@example.com Mike Johnson"
          rows={10}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-mono text-sm"
        />
        <div className="mt-2 text-xs text-gray-500">
          You can also just paste email addresses (names will default to "User Name")
        </div>
      </div>

      {/* Send Button */}
      <button
        onClick={handleInvite}
        disabled={loading}
        className="w-full bg-purple-600 text-white py-4 px-6 rounded-lg text-lg font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '📤 Sending Invitations...' : '📨 Send All Invitations'}
      </button>

      {/* Results */}
      {results && (
        <div className="mt-8 p-6 bg-gray-50 rounded-lg">
          <h3 className="text-xl font-bold mb-4 text-gray-800">
            📊 Invitation Results for {results.organization?.name}
          </h3>
          
          <div className="mb-4 grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{results.summary?.total}</div>
              <div className="text-sm text-blue-600">Total</div>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{results.summary?.successful}</div>
              <div className="text-sm text-green-600">Successful</div>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{results.summary?.errors}</div>
              <div className="text-sm text-red-600">Errors</div>
            </div>
          </div>

          <div className="space-y-2">
            {results.results?.map((result: any, index: number) => (
              <div key={index} className={`p-3 rounded-lg ${
                result.status === 'success' ? 'bg-green-50 border-l-4 border-green-400' : 'bg-red-50 border-l-4 border-red-400'
              }`}>
                <div className="font-medium">{result.email}</div>
                {result.status === 'success' ? (
                  <div className="text-sm text-green-600">✅ Invitation sent</div>
                ) : (
                  <div className="text-sm text-red-600">❌ {result.error}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-800 mb-2">How it works:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Select the workspace you want to invite users to</li>
          <li>• Enter email addresses (one per line) with optional names</li>
          <li>• Click "Send All Invitations" to invite everyone at once</li>
          <li>• Users will receive email invitations to join the workspace</li>
          <li>• They'll set their password and automatically join the workspace</li>
        </ul>
      </div>
    </div>
  );
}