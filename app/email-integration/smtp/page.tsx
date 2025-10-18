'use client';

import React, { useState } from 'react';
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function SMTPIntegrationPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [form, setForm] = useState({
    email: '',
    host: '',
    port: '587',
    username: '',
    password: '',
    useTLS: true,
    useSSL: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/email-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider_type: 'smtp',
          provider_name: 'Custom SMTP',
          email_address: form.email,
          config: {
            host: form.host,
            port: parseInt(form.port),
            username: form.username,
            password: form.password,
            use_tls: form.useTLS,
            use_ssl: form.useSSL
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        setStatus('success');
        setMessage('SMTP account connected successfully!');
        setTimeout(() => window.location.href = '/', 2000);
      } else {
        throw new Error(data.error || 'Failed to connect');
      }
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Failed to configure SMTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail size={40} className="text-gray-300" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">SMTP Configuration</h1>
          <p className="text-gray-400">Configure a custom email server</p>
        </div>

        <div className="bg-gray-800 rounded-2xl shadow-2xl p-8">
          {status === 'success' ? (
            <div className="text-center py-6">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-green-400 mb-2">Connected!</h3>
              <p className="text-gray-400">Redirecting to SAM AI...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({...form, email: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="your@email.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">SMTP Host</label>
                  <input
                    type="text"
                    required
                    value={form.host}
                    onChange={(e) => setForm({...form, host: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="smtp.example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Port</label>
                  <input
                    type="number"
                    required
                    value={form.port}
                    onChange={(e) => setForm({...form, port: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
                <input
                  type="text"
                  required
                  value={form.username}
                  onChange={(e) => setForm({...form, username: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({...form, password: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={form.useTLS}
                    onChange={(e) => setForm({...form, useTLS: e.target.checked})}
                    className="rounded"
                  />
                  <span className="text-gray-300 text-sm">Use TLS</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={form.useSSL}
                    onChange={(e) => setForm({...form, useSSL: e.target.checked})}
                    className="rounded"
                  />
                  <span className="text-gray-300 text-sm">Use SSL</span>
                </label>
              </div>

              {message && (
                <div className={`p-4 rounded-lg flex items-center space-x-2 ${
                  status === 'error' ? 'bg-red-900/20 border border-red-500/30' : 'bg-blue-900/20 border border-blue-500/30'
                }`}>
                  {status === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                  <span className={status === 'error' ? 'text-red-300' : 'text-blue-300'}>{message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <span>Connect SMTP Account</span>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => window.location.href = '/'}
            className="text-gray-400 hover:text-gray-300 text-sm underline"
          >
            ← Back to SAM AI
          </button>
        </div>
      </div>
    </div>
  );
}
