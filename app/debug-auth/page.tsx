'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/app/lib/supabase';

export default function DebugAuthPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [cookies, setCookies] = useState<string>('');
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[DEBUG] ${message}`);
  };

  useEffect(() => {
    addLog('🚀 Debug page loaded');

    // Check cookies
    const allCookies = document.cookie;
    setCookies(allCookies);
    addLog(`📦 Cookies: ${allCookies.substring(0, 100)}...`);

    // Create Supabase client
    const supabase = createClient();
    addLog('✅ Supabase client created');

    // Check current session
    const checkAuth = async () => {
      try {
        addLog('🔍 Checking current user...');
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) {
          addLog(`❌ User error: ${userError.message}`);
        } else if (user) {
          addLog(`✅ User found: ${user.email} (${user.id})`);
          setUser(user);
        } else {
          addLog('⚠️ No user found');
        }

        addLog('🔍 Checking session...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          addLog(`❌ Session error: ${sessionError.message}`);
        } else if (session) {
          addLog(`✅ Session found - expires: ${new Date(session.expires_at! * 1000).toLocaleString()}`);
          setSession(session);
        } else {
          addLog('⚠️ No session found');
        }
      } catch (error: any) {
        addLog(`🚨 Fatal error: ${error.message}`);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      addLog(`🔔 Auth state change: ${event}`);
      if (session) {
        addLog(`   User: ${session.user.email}`);
        setSession(session);
        setUser(session.user);
      } else {
        addLog(`   No session`);
        setSession(null);
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const testSignin = async () => {
    const email = (document.getElementById('email') as HTMLInputElement).value;
    const password = (document.getElementById('password') as HTMLInputElement).value;

    addLog(`🔐 Attempting signin: ${email}`);
    const supabase = createClient();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        addLog(`❌ Signin error: ${error.message}`);
      } else {
        addLog(`✅ Signin successful!`);
        addLog(`   User: ${data.user?.email}`);
        addLog(`   Session expires: ${new Date(data.session?.expires_at! * 1000).toLocaleString()}`);

        // Check cookies after signin
        setTimeout(() => {
          const newCookies = document.cookie;
          setCookies(newCookies);
          addLog(`📦 Cookies after signin: ${newCookies.substring(0, 100)}...`);
        }, 500);
      }
    } catch (error: any) {
      addLog(`🚨 Fatal signin error: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🔍 Auth Debug Console</h1>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">👤 User Status</h2>
            {user ? (
              <div className="text-green-400">
                ✅ Authenticated<br/>
                Email: {user.email}<br/>
                ID: {user.id?.substring(0, 8)}...
              </div>
            ) : (
              <div className="text-red-400">❌ Not Authenticated</div>
            )}
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">🎫 Session Status</h2>
            {session ? (
              <div className="text-green-400">
                ✅ Session Active<br/>
                Expires: {new Date(session.expires_at * 1000).toLocaleString()}
              </div>
            ) : (
              <div className="text-red-400">❌ No Session</div>
            )}
          </div>
        </div>

        {/* Test Signin */}
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-bold mb-4">🧪 Test Signin</h2>
          <div className="space-y-4">
            <input
              id="email"
              type="email"
              placeholder="Email"
              className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 text-white"
            />
            <input
              id="password"
              type="password"
              placeholder="Password"
              className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 text-white"
            />
            <button
              onClick={testSignin}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold"
            >
              Test Signin
            </button>
          </div>
        </div>

        {/* Cookies */}
        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <h2 className="text-lg font-semibold mb-2">🍪 Cookies</h2>
          <pre className="text-xs overflow-x-auto bg-gray-900 p-3 rounded">
            {cookies || 'No cookies'}
          </pre>
        </div>

        {/* Debug Logs */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">📝 Debug Logs</h2>
          <div className="bg-gray-900 p-4 rounded font-mono text-xs overflow-y-auto max-h-96">
            {logs.map((log, i) => (
              <div key={i} className="mb-1">{log}</div>
            ))}
          </div>
        </div>

        <div className="mt-6 text-center">
          <a href="/" className="text-blue-400 hover:text-blue-300">← Back to Home</a>
        </div>
      </div>
    </div>
  );
}
