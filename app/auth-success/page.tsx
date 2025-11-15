'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AuthSuccessPage() {
  const searchParams = useSearchParams();
  const closePopup = searchParams.get('close_popup');
  const provider = searchParams.get('provider');

  useEffect(() => {
    // If this page is loaded in a popup window, close it
    if (closePopup === 'true' && window.opener) {
      // Give the parent window time to detect the connection
      setTimeout(() => {
        window.close();
      }, 1000);
    } else if (closePopup === 'true') {
      // If not in a popup (shouldn't happen), redirect to workspace
      const workspaceId = window.location.pathname.split('/')[2];
      if (workspaceId) {
        window.location.href = `/workspace/${workspaceId}`;
      }
    }
  }, [closePopup]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="text-center text-white p-8">
        <div className="text-6xl mb-4">✓</div>
        <h1 className="text-2xl font-bold mb-2">
          {provider === 'google' ? 'Google' : provider === 'microsoft' ? 'Outlook' : 'Email'} Account Connected!
        </h1>
        <p className="opacity-90">This window will close automatically...</p>
      </div>
    </div>
  );
}
