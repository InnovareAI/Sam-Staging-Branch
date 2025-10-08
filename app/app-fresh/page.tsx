'use client';

// FRESH VERSION - Oct 8 2025 - Bypasses cache completely
import { toastSuccess, toastError, toastWarning, toastInfo } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function FreshRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Clear all caches and redirect to main app
    if (typeof window !== 'undefined') {
      // Clear service workers
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(reg => reg.unregister());
        });
      }

      // Clear caches
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name));
        });
      }

      // Redirect with cache bust
      setTimeout(() => {
        window.location.href = '/?v=' + Date.now();
      }, 500);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-white text-xl mb-4">Clearing cache and reloading...</div>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
      </div>
    </div>
  );
}
