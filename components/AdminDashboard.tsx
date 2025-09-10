'use client';

import React, { useState, useEffect } from 'react';
import { Users, Building2, MessageCircle, TrendingUp, Activity } from 'lucide-react';

interface Stats {
  users: {
    total: number;
    today: number;
    thisWeek: number;
    growth: number;
  };
  organizations: {
    total: number;
    active: number;
  };
  conversations: {
    total: number;
    today: number;
    thisWeek: number;
    avgPerUser: number;
  };
  orgUsage: Array<{
    id: string;
    name: string;
    users: number;
    conversations: number;
  }>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/admin/stats');
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch admin stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <Activity className="animate-spin mx-auto mb-4 text-blue-600" size={32} />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">📊 Platform Metrics</h2>
          <div className="text-sm text-gray-500">
            Updates every 30s
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Users</p>
                <p className="text-2xl font-bold text-blue-900">{stats?.users.total || 0}</p>
                <p className="text-xs text-blue-600">+{stats?.users.thisWeek || 0} this week</p>
              </div>
              <Users size={32} className="text-blue-500" />
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium">Organizations</p>
                <p className="text-2xl font-bold text-purple-900">{stats?.organizations.total || 0}</p>
                <p className="text-xs text-purple-600">{stats?.organizations.active || 0} active</p>
              </div>
              <Building2 size={32} className="text-purple-500" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">Conversations</p>
                <p className="text-2xl font-bold text-green-900">{stats?.conversations.total || 0}</p>
                <p className="text-xs text-green-600">{stats?.conversations.today || 0} today</p>
              </div>
              <MessageCircle size={32} className="text-green-500" />
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-600 text-sm font-medium">Engagement</p>
                <p className="text-2xl font-bold text-yellow-900">
                  {stats?.conversations.avgPerUser.toFixed(1) || '0.0'}
                </p>
                <p className="text-xs text-yellow-600">avg per user</p>
              </div>
              <Activity size={32} className="text-yellow-500" />
            </div>
          </div>
        </div>

        {/* Today's Activity */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <TrendingUp className="mr-2" size={20} />
            Today's Activity
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats?.users.today || 0}</p>
              <p className="text-sm text-gray-600">New Users</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats?.conversations.today || 0}</p>
              <p className="text-sm text-gray-600">Conversations</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${
                (stats?.users.growth || 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {stats?.users.growth > 0 ? '+' : ''}{stats?.users.growth.toFixed(1) || 0}%
              </p>
              <p className="text-sm text-gray-600">Growth</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Organizations */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">🏢 Top Organizations</h3>
        <div className="space-y-3">
          {stats?.orgUsage.slice(0, 5).map((org) => (
            <div key={org.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
              <div>
                <p className="font-medium text-gray-800">{org.name}</p>
                <p className="text-sm text-gray-600">{org.users} users</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-600">{org.conversations}</p>
                <p className="text-xs text-gray-500">chats</p>
              </div>
            </div>
          ))}
          {(!stats?.orgUsage || stats.orgUsage.length === 0) && (
            <p className="text-gray-500 text-center py-4">No organization data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}