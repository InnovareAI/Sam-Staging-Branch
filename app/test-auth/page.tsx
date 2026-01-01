'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/app/lib/supabase';

export default function TestAuthPage() {
  const [results, setResults] = useState<string[]>([]);
  const [clearing, setClearing] = useState(false);

  const log = (msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setResults(prev => [...prev, JSON.stringify({ msg, type })]);
    console.log(msg);
  };

  const clearAllStorage = async () => {
    setClearing(true);
    setResults([]);
    log('🧹 Clearing all storage...', 'warning');

    try {
      // 1. Clear cookies
      let cookieCount = 0;
      document.cookie.split(";").forEach((c) => {
        const name = c.split("=")[0].trim();
        document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
        cookieCount++;
      });
      log(`  ✅ Cleared ${cookieCount} cookies`, 'success');

      // 2. Clear localStorage
      const lsCount = localStorage.length;
      localStorage.clear();
      log(`  ✅ Cleared ${lsCount} localStorage items`, 'success');

      // 3. Clear sessionStorage
      const ssCount = sessionStorage.length;
      sessionStorage.clear();
      log(`  ✅ Cleared ${ssCount} sessionStorage items`, 'success');

      // 4. Clear IndexedDB
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
          log(`  ✅ Deleted IndexedDB: ${db.name}`, 'success');
        }
      }

      log('\n✅ ALL STORAGE CLEARED!', 'success');
      log('Redirecting to sign in in 2 seconds...', 'info');

      setTimeout(() => {
        window.location.href = '/signin';
      }, 2000);
    } catch (error) {
      log(`❌ Error clearing storage: ${error}`, 'error');
    } finally {
      setClearing(false);
    }
  };

  const runTests = async () => {
    setResults([]);
    log('🔬 Starting Authentication Flow Tests\n', 'info');

    // Test 1: Cookie corruption check
    log('Test 1: Cookie Corruption Check', 'info');
    const cookies = document.cookie.split(';');
    let corruptedCount = 0;

    cookies.forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (value && value.startsWith('base64-')) {
        corruptedCount++;
        log(`  ❌ CORRUPTED: ${name} starts with "base64-"`, 'error');
      }
    });

    if (corruptedCount === 0) {
      log('  ✅ No corrupted cookies found!', 'success');
    } else {
      log(`  ⚠️ Found ${corruptedCount} corrupted cookie(s)`, 'warning');
    }

    // Test 2: Supabase auth cookies
    log('\nTest 2: Supabase Auth Cookies', 'info');
    const authCookies = cookies.filter(c =>
      c.includes('sb-') || c.includes('supabase')
    );
    log(`  Found ${authCookies.length} Supabase auth cookies`, 'info');
    authCookies.forEach(cookie => {
      const [name] = cookie.trim().split('=');
      log(`    - ${name}`, 'info');
    });

    // Test 3: localStorage
    log('\nTest 3: localStorage Check', 'info');
    const lsKeys = Object.keys(localStorage);
    log(`  Found ${lsKeys.length} localStorage items`, 'info');
    lsKeys.forEach(key => {
      if (key.includes('supabase') || key.includes('auth')) {
        const value = localStorage.getItem(key);
        log(`    - ${key}: ${value?.substring(0, 50)}...`, 'info');
      }
    });

    // Test 4: Supabase client
    log('\nTest 4: Supabase Authentication', 'info');
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        log(`  ❌ Auth error: ${error.message}`, 'error');
      } else if (user) {
        log('  ✅ User authenticated!', 'success');
        log(`  Email: ${user.email}`, 'success');
        log(`  User ID: ${user.id}`, 'info');
      } else {
        log('  ℹ️ No active session', 'info');
      }
    } catch (error) {
      log(`  ❌ Error: ${error}`, 'error');
    }

    // Test 5: Workspace access
    log('\nTest 5: Workspace Access', 'info');
    try {
      const response = await fetch('/api/admin/diagnose-user');
      const data = await response.json();

      if (data.authenticated) {
        log('  ✅ Authentication confirmed', 'success');
        log(`  Workspaces: ${data.diagnosis.workspaceCount}`,
          data.diagnosis.workspaceCount > 0 ? 'success' : 'warning');
        log(`  Memberships: ${data.diagnosis.membershipCount}`,
          data.diagnosis.membershipCount > 0 ? 'success' : 'warning');

        if (data.workspaces && data.workspaces.length > 0) {
          log('\n  Workspaces:', 'info');
          data.workspaces.forEach((ws: any) => {
            log(`    - ${ws.name} (${ws.id})`, 'info');
          });
        }
      } else {
        log('  ℹ️ Not authenticated', 'info');
        log(`  Reason: ${data.error || 'No session'}`, 'info');
      }
    } catch (error) {
      log(`  ❌ Error checking workspace: ${error}`, 'error');
    }

    log('\n✅ All tests complete!', 'success');
  };

  useEffect(() => {
    // Install cookie write monitor
    const originalDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    if (originalDescriptor) {
      Object.defineProperty(document, 'cookie', {
        get: function() {
          return originalDescriptor.get!.call(this);
        },
        set: function(value) {
          if (value.includes('base64-')) {
            console.warn('⚠️ INTERCEPTED CORRUPTED COOKIE WRITE:', value.substring(0, 100));
          }
          return originalDescriptor.set!.call(this, value);
        }
      });
    }

    // Auto-run tests
    runTests();
  }, []);

  return (
    <div style={{
      fontFamily: 'system-ui',
      maxWidth: '900px',
      margin: '50px auto',
      padding: '20px',
      background: '#0f172a',
      color: 'white',
      minHeight: '100vh'
    }}>
      <h1>🧪 SAM AI Authentication Test</h1>
      <p>This page tests the complete authentication flow and cookie handling.</p>

      <div style={{
        padding: '20px',
        margin: '20px 0',
        borderRadius: '8px',
        background: '#1e293b',
        borderLeft: '4px solid #3b82f6'
      }}>
        <h3>Actions</h3>
        <button
          onClick={runTests}
          style={{
            padding: '12px 24px',
            background: '#3b82f6',
            border: 'none',
            color: 'white',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px',
            margin: '5px'
          }}
        >
          🔬 Run All Tests
        </button>
        <button
          onClick={clearAllStorage}
          disabled={clearing}
          style={{
            padding: '12px 24px',
            background: clearing ? '#64748b' : '#ef4444',
            border: 'none',
            color: 'white',
            borderRadius: '6px',
            cursor: clearing ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            margin: '5px'
          }}
        >
          {clearing ? '🧹 Clearing...' : '🧹 Clear All Storage'}
        </button>
        <button
          onClick={() => window.location.href = '/signin'}
          style={{
            padding: '12px 24px',
            background: '#10b981',
            border: 'none',
            color: 'white',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px',
            margin: '5px'
          }}
        >
          🔐 Go to Sign In
        </button>
      </div>

      <div id="results">
        {results.map((result, i) => {
          const { msg, type } = JSON.parse(result);
          const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
          };

          return (
            <div
              key={i}
              style={{
                padding: '15px',
                margin: '10px 0',
                borderRadius: '8px',
                background: '#1e293b',
                borderLeft: `4px solid ${colors[type as keyof typeof colors]}`,
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: '14px'
              }}
            >
              {msg}
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: '40px',
        padding: '20px',
        background: '#1e293b',
        borderRadius: '8px',
        borderLeft: '4px solid #8b5cf6'
      }}>
        <h3>📋 Instructions</h3>
        <ol style={{ lineHeight: '1.8' }}>
          <li>If you see corrupted cookies: Click <strong>"Clear All Storage"</strong></li>
          <li>You'll be redirected to sign in automatically</li>
          <li>Sign in with your credentials</li>
          <li>Watch console for <code style={{ background: '#0f172a', padding: '2px 6px', borderRadius: '3px' }}>🔧 Fixed corrupted cookie</code> messages</li>
          <li>Return to this page and click <strong>"Run All Tests"</strong> again</li>
          <li>Verify workspaces shows &gt; 0</li>
        </ol>
      </div>

      <div style={{
        marginTop: '20px',
        padding: '15px',
        background: '#1e293b',
        borderRadius: '8px',
        fontSize: '14px',
        opacity: 0.7
      }}>
        <strong>Cookie Write Monitor Active</strong><br/>
        Any cookie writes with "base64-" prefix will be logged to console with ⚠️ warning.
      </div>
    </div>
  );
}
