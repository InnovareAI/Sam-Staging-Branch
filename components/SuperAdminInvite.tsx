
import React, { useState, useEffect } from 'react';
import { supabase } from '../app/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Info } from 'lucide-react';
import { toastSuccess, toastError, toastWarning, toastInfo } from '@/lib/toast';

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
        setWorkspaces(data.organizations || []);
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    }
  };

  const handleInvite = async () => {
    if (!selectedWorkspaceId || !emailList.trim()) {
      toastError('Please select a workspace and enter email addresses');
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
        toastError('No valid email addresses found');
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
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl flex items-center justify-center gap-2">
          🔑 Super Admin - Invite Users
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Workspace Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Select Workspace:
          </label>
          <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a workspace..." />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Email Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Email Addresses (one per line):
          </label>
          <div className="text-xs text-muted-foreground mb-2">
            Format: <code className="bg-muted px-1 py-0.5 rounded text-xs">email@example.com FirstName LastName</code>
          </div>
          <Textarea
            value={emailList}
            onChange={(e) => setEmailList(e.target.value)}
            placeholder="john@example.com John Doe&#10;jane@example.com Jane Smith&#10;mike@example.com Mike Johnson"
            rows={8}
            className="font-mono text-sm resize-none"
          />
          <p className="text-xs text-muted-foreground">
            You can also just paste email addresses (names will default to "User Name")
          </p>
        </div>

        {/* Send Button */}
        <Button
          onClick={handleInvite}
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? '📤 Sending Invitations...' : '📨 Send All Invitations'}
        </Button>

        {/* Results */}
        {results && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                📊 Invitation Results for {results.organization?.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-lg font-semibold">{results.summary?.total}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-lg font-semibold text-green-600">{results.summary?.successful}</div>
                    <div className="text-xs text-muted-foreground">Successful</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-lg font-semibold text-destructive">{results.summary?.errors}</div>
                    <div className="text-xs text-muted-foreground">Errors</div>
                  </CardContent>
                </Card>
              </div>

              {/* Individual Results */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {results.results?.map((result: any, index: number) => (
                  <Alert key={index} variant={result.status === 'success' ? 'default' : 'destructive'}>
                    <div className="flex items-center gap-2">
                      {result.status === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <AlertDescription className="flex-1">
                        <div className="font-medium text-sm">{result.email}</div>
                        <div className="text-xs opacity-75">
                          {result.status === 'success' ? 'Invitation sent successfully' : result.error}
                        </div>
                      </AlertDescription>
                    </div>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help Information */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <div className="font-medium text-sm">How it works:</div>
              <ul className="text-sm space-y-0.5 ml-2">
                <li>• Select the workspace you want to invite users to</li>
                <li>• Enter email addresses (one per line) with optional names</li>
                <li>• Click "Send All Invitations" to invite everyone at once</li>
                <li>• Users will receive email invitations to join the workspace</li>
                <li>• They'll set their password and automatically join the workspace</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
