'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
    <div className="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <img 
            src="/SAM.jpg" 
            alt="Sam AI" 
            className="w-24 h-24 rounded-full object-cover mx-auto mb-6"
            style={{ objectPosition: 'center 30%' }}
          />
          <h1 className="text-white text-3xl font-bold mb-2">SAM AI - Direct Access</h1>
          <p className="text-gray-400 mb-8">Skip authentication and go straight to the application</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-white font-medium mb-4">Quick Setup</h3>
          <div className="space-y-4">
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Your name (e.g., 'John Doe')"
              className="w-full px-3 py-2 border border-gray-600 placeholder-gray-500 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              disabled={isCreating}
            />
            <input
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Organization name (e.g., 'Acme Corp')"
              className="w-full px-3 py-2 border border-gray-600 placeholder-gray-500 text-white bg-gray-700 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              disabled={isCreating}
            />
            {error && (
              <div className="text-red-400 text-sm">{error}</div>
            )}
            <button 
              onClick={createDirectAccess}
              disabled={isCreating}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {isCreating ? 'Setting up...' : 'Access SAM AI Now'}
            </button>
          </div>
        </div>
        
        <div className="text-center">
          <p className="text-gray-500 text-sm">
            This bypasses authentication for testing purposes
          </p>
          <p className="text-gray-500 text-xs mt-2">
            Regular auth: <a href="/signin" className="text-purple-400 hover:text-purple-300">Sign In</a> | <a href="/signup" className="text-purple-400 hover:text-purple-300">Sign Up</a>
          </p>
        </div>
      </div>
    </div>
  );
}