'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function FixAuthPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Clearing corrupted session...');

  useEffect(() => {
    // Clear ALL storage
    try {
      // 1. Clear all cookies
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      setStatus('✅ Cookies cleared');

      // 2. Clear localStorage
      localStorage.clear();
      setStatus('✅ LocalStorage cleared');

      // 3. Clear sessionStorage
      sessionStorage.clear();
      setStatus('✅ SessionStorage cleared');

      // 4. Clear IndexedDB (Supabase uses this)
      indexedDB.databases().then((dbs) => {
        dbs.forEach((db) => {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
          }
        });
      });
      setStatus('✅ IndexedDB cleared');

      // 5. Wait a moment then redirect
      setTimeout(() => {
        setStatus('✅ All cleared! Redirecting to sign in...');
        setTimeout(() => {
          window.location.href = '/signin';
        }, 1000);
      }, 1500);

    } catch (error) {
      setStatus('❌ Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '500px',
        padding: '40px',
        backgroundColor: '#1e293b',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ fontSize: '24px', marginBottom: '20px', textAlign: 'center' }}>
          🔧 Fixing Authentication
        </h1>
        <p style={{
          fontSize: '18px',
          textAlign: 'center',
          color: '#94a3b8',
          marginBottom: '30px'
        }}>
          {status}
        </p>
        <div style={{
          width: '100%',
          height: '4px',
          backgroundColor: '#334155',
          borderRadius: '2px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#3b82f6',
            animation: 'progress 2s ease-in-out'
          }} />
        </div>
      </div>
      <style>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
