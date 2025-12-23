'use client';

/**
 * LLM Usage Dashboard
 * Displays token usage, costs, and performance metrics for BYOK customers
 */

import React, { useState, useEffect } from 'react';

interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  errorRate: number;
  byModel: Array<{
    modelId: string;
    modelName: string;
    provider: string;
    requests: number;
    tokens: number;
    cost: number;
    avgLatency: number;
  }>;
  byDay: Array<{
    date: string;
    requests: number;
    tokens: number;
    cost: number;
  }>;
}

interface LLMUsageDashboardProps {
  onConfigureClick?: () => void;
}

export default function LLMUsageDashboard({ onConfigureClick }: LLMUsageDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [preferences, setPreferences] = useState<any>(null);

  useEffect(() => {
    loadUsage();
  }, [timeRange]);

  const loadUsage = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/llm/usage?range=${timeRange}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
          setPreferences(data.preferences);
        }
      }
    } catch (error) {
      console.error('Failed to load usage:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-background rounded-lg border">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6 bg-white dark:bg-background rounded-lg border text-center">
        <p className="text-gray-500">No usage data available</p>
      </div>
    );
  }

  const formatCost = (cost: number) => {
    return cost < 0.01 ? '<$0.01' : `$${cost.toFixed(2)}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">AI Usage Statistics</h2>
          <p className="text-sm text-gray-500 mt-1">
            {preferences?.isBYOK 
              ? '🔑 Using your own API key' 
              : preferences?.isCustom 
                ? '🏢 Using enterprise endpoint'
                : '☁️ Using platform AI'}
          </p>
        </div>
        
        <div className="flex gap-3">
          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>
          
          {onConfigureClick && (
            <button
              onClick={onConfigureClick}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Configure AI
            </button>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-surface-muted rounded-lg border">
          <div className="text-sm text-gray-500 mb-1">Total Conversations</div>
          <div className="text-2xl font-bold">{formatNumber(stats.totalRequests)}</div>
          <div className="text-xs text-gray-500 mt-1">AI interactions</div>
        </div>
        
        <div className="p-4 bg-white dark:bg-surface-muted rounded-lg border">
          <div className="text-sm text-gray-500 mb-1">Total Tokens</div>
          <div className="text-2xl font-bold">{formatNumber(stats.totalTokens)}</div>
          <div className="text-xs text-gray-500 mt-1">Processed</div>
        </div>
        
        <div className="p-4 bg-white dark:bg-surface-muted rounded-lg border">
          <div className="text-sm text-gray-500 mb-1">Reliability</div>
          <div className={`text-2xl font-bold ${stats.errorRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
            {(100 - stats.errorRate).toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">Success rate</div>
        </div>
      </div>

      {/* Usage by Model */}
      {stats.byModel.length > 0 && (
        <div className="bg-white dark:bg-surface-muted rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Usage by Model</h3>
          <div className="space-y-3">
            {stats.byModel.map(model => (
              <div key={model.modelId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-background rounded-md">
                <div className="flex-1">
                  <div className="font-medium">{model.modelName}</div>
                  <div className="text-xs text-gray-500">{model.provider}</div>
                </div>
                
                <div className="flex gap-6 text-sm">
                  <div className="text-center">
                    <div className="text-gray-500 text-xs">Requests</div>
                    <div className="font-medium">{formatNumber(model.requests)}</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-gray-500 text-xs">Tokens</div>
                    <div className="font-medium">{formatNumber(model.tokens)}</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-gray-500 text-xs">Avg Response</div>
                    <div className="font-medium">{model.avgLatency.toFixed(0)}ms</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage Over Time (Simple Bar Chart) */}
      {stats.byDay.length > 0 && (
        <div className="bg-white dark:bg-surface-muted rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Usage Over Time</h3>
          <div className="space-y-2">
            {stats.byDay.slice(-14).map(day => {
              const maxCost = Math.max(...stats.byDay.map(d => d.cost));
              const width = maxCost > 0 ? (day.cost / maxCost) * 100 : 0;
              
              return (
                <div key={day.date} className="flex items-center gap-3">
                  <div className="text-xs text-gray-500 w-24">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  
                  <div className="flex-1 bg-gray-100 dark:bg-background rounded-full h-6 relative overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all"
                      style={{ width: `${width}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-between px-3 text-xs">
                      <span className="font-medium">{formatNumber(day.requests)} requests</span>
                      <span className="font-medium">{formatNumber(day.tokens)} tokens</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info Card for BYOK customers */}
      {preferences?.isBYOK && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-blue-600 dark:text-blue-400 text-xl">💡</div>
            <div className="flex-1">
              <div className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                Using Your Own API Key
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                You're using your own OpenRouter API key. Usage statistics are tracked here for monitoring performance.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <div className="flex justify-center">
        <button
          onClick={loadUsage}
          disabled={loading}
          className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50 dark:hover:bg-surface-muted"
        >
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>
    </div>
  );
}
