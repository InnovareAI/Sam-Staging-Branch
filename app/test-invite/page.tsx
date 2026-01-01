'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function TestInvitePage() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    company: 'InnovareAI',
    role: 'member',
    workspaceId: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setIsLoading(false);
    };
    getUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/simple-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok) {
        setMessage(`✅ Invitation sent successfully to ${formData.email}!`);
        setFormData({
          email: '',
          firstName: '',
          lastName: '',
          company: 'InnovareAI',
          role: 'member',
          workspaceId: ''
        });
      } else {
        setMessage(`❌ Failed to send invitation: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Authentication Required</CardTitle>
            <CardDescription>Please sign in to access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl font-semibold">Test User Invitation</CardTitle>
              <CardDescription>Send invitations to test users</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">First Name</label>
                    <Input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Last Name</label>
                    <Input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Company</label>
                    <Select 
                      value={formData.company} 
                      onValueChange={(value) => setFormData({ ...formData, company: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="InnovareAI">InnovareAI</SelectItem>
                        <SelectItem value="3cubedai">3CubedAI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role</label>
                    <Select 
                      value={formData.role} 
                      onValueChange={(value) => setFormData({ ...formData, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="owner">Owner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Workspace ID (Optional)</label>
                  <Input
                    type="text"
                    value={formData.workspaceId}
                    onChange={(e) => setFormData({ ...formData, workspaceId: e.target.value })}
                    placeholder="Leave empty for general invitation"
                  />
                </div>

                <div className="flex justify-between items-center">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-8"
                  >
                    {isSubmitting ? 'Sending Invitation...' : 'Send Invitation'}
                  </Button>
                  
                  <Button variant="ghost" asChild>
                    <a href="/">← Back to App</a>
                  </Button>
                </div>
              </form>

              {message && (
                <div className="mt-6">
                  <Alert variant={message.includes('✅') ? 'default' : 'destructive'}>
                    <AlertDescription>{message}</AlertDescription>
                  </Alert>
                </div>
              )}

              <Card className="mt-8">
                <CardHeader>
                  <CardTitle className="text-base">User Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-sm text-muted-foreground">Email: {user.email}</p>
                  <p className="text-sm text-muted-foreground">User ID: {user.id}</p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}