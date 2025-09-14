'use client';

import React, { useState, useEffect } from 'react';
import { Users, Building2, MessageCircle, TrendingUp, Activity, Timer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
      <Card>
        <CardContent className="p-8">
          <div className="text-center space-y-4">
            <Activity className="animate-spin mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              📊 Platform Metrics
            </CardTitle>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Timer className="h-3 w-3" />
              Updates every 30s
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Users</p>
                    <p className="text-2xl font-bold">{stats?.users.total || 0}</p>
                    <p className="text-xs text-muted-foreground">
                      +{stats?.users.thisWeek || 0} this week
                    </p>
                  </div>
                  <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded-full">
                    <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Organizations</p>
                    <p className="text-2xl font-bold">{stats?.organizations.total || 0}</p>
                    <p className="text-xs text-muted-foreground">
                      {stats?.organizations.active || 0} active
                    </p>
                  </div>
                  <div className="p-2 bg-muted rounded-full">
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Conversations</p>
                    <p className="text-2xl font-bold">{stats?.conversations.total || 0}</p>
                    <p className="text-xs text-muted-foreground">
                      {stats?.conversations.today || 0} today
                    </p>
                  </div>
                  <div className="p-2 bg-green-50 dark:bg-green-950 rounded-full">
                    <MessageCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Engagement</p>
                    <p className="text-2xl font-bold">
                      {stats?.conversations.avgPerUser.toFixed(1) || '0.0'}
                    </p>
                    <p className="text-xs text-muted-foreground">avg per user</p>
                  </div>
                  <div className="p-2 bg-amber-50 dark:bg-amber-950 rounded-full">
                    <Activity className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Today's Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Today's Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {stats?.users.today || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">New Users</p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {stats?.conversations.today || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Conversations</p>
                </div>
                <div className="space-y-1">
                  <p className={`text-2xl font-bold ${
                    (stats?.users.growth || 0) >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {stats?.users.growth > 0 ? '+' : ''}{stats?.users.growth?.toFixed(1) || 0}%
                  </p>
                  <p className="text-sm text-muted-foreground">Growth</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Top Organizations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            🏢 Top Organizations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats?.orgUsage && stats.orgUsage.length > 0 ? (
              stats.orgUsage.slice(0, 5).map((org) => (
                <Card key={org.id} className="border-l-4 border-l-primary/20">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="font-medium">{org.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {org.users} users
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge variant="secondary" className="text-sm font-bold">
                          {org.conversations}
                        </Badge>
                        <p className="text-xs text-muted-foreground">conversations</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No organization data available yet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}