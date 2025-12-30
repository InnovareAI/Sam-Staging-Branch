'use client';

import { useEffect } from 'react';

export default function AuthSuccessPage() {
  useEffect(() => {
    // Immediately close this popup window
    // The parent window's modal polling will detect the connection
    if (window.opener) {
      setTimeout(() => {
        window.close();
      }, 500);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="text-center text-white p-8">
        <div className="text-6xl mb-4">✓</div>
        <h1 className="text-2xl font-semibold mb-2">Account Connected!</h1>
        <p className="opacity-90">Closing window...</p>
      </div>
    </div>
  );
}
