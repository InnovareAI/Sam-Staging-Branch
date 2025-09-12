'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Mail, CheckCircle, AlertCircle, Zap } from 'lucide-react';

interface ActiveCampaignList {
  id: string;
  name: string;
  stringid: string;
}

interface ConnectionTest {
  success: boolean;
  error?: string;
  data?: any;
}

function ActiveCampaignAdminPage() {
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<any>(null);
  const [lists, setLists] = useState<ActiveCampaignList[]>([]);
  const [connectionTest, setConnectionTest] = useState<ConnectionTest | null>(null);
  const [loading, setLoading] = useState(false);
  const [testContactResult, setTestContactResult] = useState<any>(null);

  // Check authentication on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Test connection
  const testConnection = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/admin/activecampaign?action=test', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });
      
      const result = await response.json();
      setConnectionTest(result);
      
      if (result.success) {
        // If connection successful, also get lists
        await getLists();
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionTest({ success: false, error: 'Connection test failed' });
    } finally {
      setLoading(false);
    }
  };

  // Get all lists
  const getLists = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/admin/activecampaign?action=lists', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });
      
      const result = await response.json();
      if (result.lists) {
        setLists(result.lists);
      }
    } catch (error) {
      console.error('Failed to get lists:', error);
    }
  };

  // Test adding a contact
  const testAddContact = async (listId: string) => {
    setLoading(true);
    try {
      const testData = {
        email: 'test-sam-ai@example.com',
        firstName: 'Test',
        lastName: 'User',
        listId: listId,
        additionalData: {
          fieldValues: [
            { field: 'company', value: 'InnovareAI' },
            { field: 'source', value: 'SAM AI Test' }
          ]
        }
      };

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/admin/activecampaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(testData)
      });
      
      const result = await response.json();
      setTestContactResult(result);
    } catch (error) {
      console.error('Test contact addition failed:', error);
      setTestContactResult({ error: 'Test contact addition failed' });
    } finally {
      setLoading(false);
    }
  };

  // Auto-test connection on load
  useEffect(() => {
    if (user) {
      testConnection();
    }
  }, [user]);

  if (!user) {
    return <div>Please sign in to access this page.</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ActiveCampaign Integration</h1>
          <p className="text-muted-foreground">Manage ActiveCampaign connection and lists</p>
        </div>
        <Button
          onClick={testConnection}
          disabled={loading}
          variant="outline"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
          Test Connection
        </Button>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            {connectionTest?.success ? (
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            )}
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {connectionTest ? (
            <div className="space-y-2">
              <Badge variant={connectionTest.success ? "default" : "destructive"}>
                {connectionTest.success ? "Connected" : "Failed"}
              </Badge>
              {connectionTest.error && (
                <p className="text-red-500 text-sm">{connectionTest.error}</p>
              )}
              {connectionTest.success && connectionTest.data && (
                <p className="text-green-600 text-sm">
                  ActiveCampaign API is working correctly
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">Click "Test Connection" to check status</p>
          )}
        </CardContent>
      </Card>

      {/* Lists */}
      {lists.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Available Lists ({lists.length})
            </CardTitle>
            <CardDescription>
              These are the mailing lists available in your ActiveCampaign account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {lists.map((list) => (
                <Card key={list.id} className="border-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{list.name}</CardTitle>
                    <div className="flex gap-2">
                      <Badge variant="secondary">ID: {list.id}</Badge>
                      {list.stringid && (
                        <Badge variant="outline">String ID: {list.stringid}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => testAddContact(list.id)}
                      disabled={loading}
                      size="sm"
                      className="w-full"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Mail className="h-4 w-4 mr-2" />
                      )}
                      Test Add Contact
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Contact Result */}
      {testContactResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="h-5 w-5 mr-2" />
              Test Contact Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {testContactResult.error ? (
                <div>
                  <Badge variant="destructive">Failed</Badge>
                  <p className="text-red-500 text-sm mt-2">{testContactResult.error}</p>
                  {testContactResult.details && (
                    <p className="text-red-400 text-xs mt-1">{testContactResult.details}</p>
                  )}
                </div>
              ) : (
                <div>
                  <Badge variant="default">Success</Badge>
                  <p className="text-green-600 text-sm mt-2">{testContactResult.message}</p>
                  {testContactResult.contactId && (
                    <p className="text-muted-foreground text-xs mt-1">
                      Contact ID: {testContactResult.contactId}
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Info */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Base URL:</strong>
              <p className="text-muted-foreground">https://innovareai.api-us1.com</p>
            </div>
            <div>
              <strong>API Key:</strong>
              <p className="text-muted-foreground">Configured via environment</p>
            </div>
            <div>
              <strong>Integration Status:</strong>
              <p className="text-muted-foreground">
                New users will automatically be added to ActiveCampaign when invited
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default dynamic(() => Promise.resolve(ActiveCampaignAdminPage), {
  ssr: false,
});