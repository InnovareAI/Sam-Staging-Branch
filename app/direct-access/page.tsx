'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function DirectAccessPage() {
  const [organizationName, setOrganizationName] = useState('');
  const [userName, setUserName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const createDirectAccess = async () => {
    if (!organizationName.trim() || !userName.trim()) {
      setError('Please enter both organization name and your name');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      // Create a mock user session directly in localStorage
      const mockUser = {
        id: 'direct-' + Date.now(),
        email: 'direct@samia.com',
        profile: {
          id: 'profile-' + Date.now(),
          first_name: userName.split(' ')[0] || userName,
          last_name: userName.split(' ')[1] || '',
          email: 'direct@samia.com',
          current_workspace_id: 'workspace-' + Date.now()
        },
        currentWorkspace: {
          id: 'workspace-' + Date.now(),
          name: `${organizationName} Workspace`,
          organization_id: 'org-' + Date.now()
        },
        organizations: [{
          id: 'org-' + Date.now(),
          name: organizationName,
          role: 'owner'
        }]
      };

      // Store in localStorage for the app to use
      localStorage.setItem('sam_direct_user', JSON.stringify(mockUser));
      localStorage.setItem('sam_direct_mode', 'true');

      // Redirect to main app
      setTimeout(() => {
        window.location.href = '/';
      }, 500);

    } catch (error) {
      setError('Failed to create access. Please try again.');
      console.error('Error:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <img 
            src="/SAM.jpg" 
            alt="Sam AI" 
            className="w-24 h-24 rounded-full object-cover mx-auto mb-6"
            style={{ objectPosition: 'center 30%' }}
          />
          <h1 className="text-foreground text-3xl font-bold mb-2">SAM AI - Direct Access</h1>
          <p className="text-muted-foreground mb-8">Skip authentication and go straight to the application</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Your name (e.g., 'John Doe')"
              disabled={isCreating}
            />
            <Input
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Organization name (e.g., 'Acme Corp')"
              disabled={isCreating}
            />
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button 
              onClick={createDirectAccess}
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? 'Setting up...' : 'Access SAM AI Now'}
            </Button>
          </CardContent>
        </Card>
        
        <div className="text-center">
          <p className="text-muted-foreground text-sm">
            This bypasses authentication for testing purposes
          </p>
          <p className="text-muted-foreground text-xs mt-2">
            Regular auth: <a href="/signin" className="text-primary hover:underline">Sign In</a> | <a href="/signup" className="text-primary hover:underline">Sign Up</a>
          </p>
        </div>
      </div>
    </div>
  );
}