'use client'

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';

interface HealthStatus {
  healthy: boolean;
  timestamp: string;
  critical_issues?: Array<{
    type: string;
    table?: string;
    message: string;
    fix?: string;
  }>;
  warnings?: Array<{
    type: string;
    message: string;
  }>;
  immediate_actions?: string[];
}

export default function HealthStatusChecker() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkHealth = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/check-db', {
        cache: 'no-cache'
      });
      const data = await response.json();
      setHealth(data);
      setLastCheck(new Date());
    } catch (error) {
      console.error('Health check failed:', error);
      setHealth({
        healthy: false,
        timestamp: new Date().toISOString(),
        critical_issues: [{
          type: 'HEALTH_CHECK_FAILED',
          message: 'Unable to check system health. This could indicate a serious system issue.',
          fix: 'Check network connection and try again. Contact admin if problem persists.'
        }],
        immediate_actions: ['Contact system administrator immediately']
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    // Check every 5 minutes
    const interval = setInterval(checkHealth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !health) {
    return (
      <div className="flex items-center gap-2 text-blue-600 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>Checking system health...</span>
      </div>
    );
  }

  if (!health) {
    return null;
  }

  // Healthy state
  if (health.healthy) {
    return (
      <div className="flex items-center gap-2 text-green-600 text-sm">
        <CheckCircle className="w-4 h-4" />
        <span>System healthy</span>
        <button
          onClick={checkHealth}
          disabled={loading}
          className="text-gray-500 hover:text-gray-700 ml-2"
          title="Refresh health check"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    );
  }

  // Critical issues
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-800 mb-2">
            🚨 CRITICAL: System Issues Detected
          </h3>
          
          {health.critical_issues && health.critical_issues.length > 0 && (
            <div className="mb-3">
              <p className="text-red-700 font-medium mb-2">Critical Issues:</p>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                {health.critical_issues.map((issue, index) => (
                  <li key={index}>
                    <span className="font-medium">{issue.table ? `${issue.table}: ` : ''}</span>
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {health.warnings && health.warnings.length > 0 && (
            <div className="mb-3">
              <p className="text-orange-700 font-medium mb-2 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                Warnings:
              </p>
              <ul className="list-disc list-inside text-sm text-orange-700 space-y-1">
                {health.warnings.map((warning, index) => (
                  <li key={index}>{warning.message}</li>
                ))}
              </ul>
            </div>
          )}

          {health.immediate_actions && health.immediate_actions.length > 0 && (
            <div className="bg-red-100 border border-red-300 rounded p-3 mb-3">
              <p className="font-medium text-red-800 mb-2">Immediate Actions Required:</p>
              <ol className="list-decimal list-inside text-sm text-red-700 space-y-1">
                {health.immediate_actions.map((action, index) => (
                  <li key={index}>{action}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <button
              onClick={checkHealth}
              disabled={loading}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Recheck
            </button>
            <a
              href="/api/admin/setup-chat-tables"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              Get SQL Fix
            </a>
            <a
              href="https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              Supabase SQL Editor
            </a>
          </div>

          {lastCheck && (
            <p className="text-xs text-gray-500 mt-2">
              Last checked: {lastCheck.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}