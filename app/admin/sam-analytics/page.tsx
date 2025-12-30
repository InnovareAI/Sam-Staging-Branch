'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Clock, 
  Target, 
  BarChart3, 
  PieChart,
  Activity,
  Lightbulb,
  AlertCircle,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Eye,
  Download,
  RefreshCw
} from 'lucide-react';

interface ConversationAnalytics {
  totalConversations: number;
  uniqueUsers: number;
  averageConversationLength: number;
  successfulConversions: number;
  scriptPositionDistribution: Record<string, number>;
  industryBreakdown: Record<string, number>;
  personaBreakdown: Record<string, number>;
  conversationModeUsage: Record<string, number>;
  topicDistribution: Record<string, number>;
  userEngagementMetrics: {
    averageSessionDuration: number;
    messageVelocity: number;
    returnUserRate: number;
    fileUploadRate: number;
  };
  samPerformanceMetrics: {
    responseAccuracy: number;
    userSatisfactionScore: number;
    knowledgeExtractionSuccess: number;
    errorRecoveryRate: number;
  };
  optimizationInsights: {
    mostEffectiveScriptPositions: string[];
    highestEngagementTopics: string[];
    industrySpecificPatterns: Record<string, any>;
    commonUserPainPoints: string[];
    improvementRecommendations: string[];
  };
}

interface UserBehaviorMetrics {
  sessionPatterns: {
    peakUsageHours: number[];
    averageSessionLength: number;
    conversationsPerSession: number;
    mostActiveTimeRanges: Record<string, number>;
  };
  engagementDepth: {
    scriptProgressionRate: number;
    discoveryCompletionRate: number;
    icpResearchAdoptionRate: number;
    knowledgeBaseUsage: number;
  };
  contentInteraction: {
    fileUploadFrequency: number;
    topUploadedContentTypes: Record<string, number>;
    knowledgeQueryPatterns: string[];
    mostRequestedInformation: string[];
  };
  conversionFunnels: {
    greetingToDiscovery: number;
    discoveryToICP: number;
    icpToAction: number;
    abandonmentPoints: Record<string, number>;
  };
}

export default function SAMAnalyticsPage() {
  const [analytics, setAnalytics] = useState<ConversationAnalytics | null>(null);
  const [userBehavior, setUserBehavior] = useState<UserBehaviorMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('30');
  const [organizationId, setOrganizationId] = useState<string>('');
  const [activeTab, setActiveTab] = useState('overview');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch overview analytics
      const overviewParams = new URLSearchParams({
        action: 'overview',
        timeframe,
        ...(organizationId && { organization_id: organizationId })
      });
      
      const overviewResponse = await fetch(`/api/admin/sam-analytics?${overviewParams}`);
      const overviewData = await overviewResponse.json();
      
      if (overviewData.success) {
        setAnalytics(overviewData.analytics);
      }

      // Fetch user behavior metrics
      const behaviorParams = new URLSearchParams({
        action: 'user_behavior',
        timeframe,
        ...(organizationId && { organization_id: organizationId })
      });
      
      const behaviorResponse = await fetch(`/api/admin/sam-analytics?${behaviorParams}`);
      const behaviorData = await behaviorResponse.json();
      
      if (behaviorData.success) {
        setUserBehavior(behaviorData.behavior);
      }

      setLastUpdated(new Date().toLocaleString());
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeframe, organizationId]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const getChangeIndicator = (current: number, previous: number) => {
    const change = ((current - previous) / previous * 100);
    if (change > 0) {
      return (
        <div className="flex items-center text-green-600">
          <ArrowUp className="h-3 w-3 mr-1" />
          <span className="text-xs">{change.toFixed(1)}%</span>
        </div>
      );
    } else if (change < 0) {
      return (
        <div className="flex items-center text-red-600">
          <ArrowDown className="h-3 w-3 mr-1" />
          <span className="text-xs">{Math.abs(change).toFixed(1)}%</span>
        </div>
      );
    }
    return <span className="text-xs text-gray-500">No change</span>;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading SAM Analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-2">
            <Brain className="h-8 w-8 text-blue-600" />
            SAM AI Analytics & Optimization
          </h1>
          <p className="text-gray-600 mt-1">
            Comprehensive insights to optimize SAM AI performance and user experience
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchAnalytics} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-sm text-gray-500">
        Last updated: {lastUpdated}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="behavior">User Behavior</TabsTrigger>
          <TabsTrigger value="performance">SAM Performance</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
          <TabsTrigger value="patterns">Conversation Patterns</TabsTrigger>
          <TabsTrigger value="insights">Learning Insights</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{formatNumber(analytics?.totalConversations || 0)}</div>
                {getChangeIndicator(analytics?.totalConversations || 0, 1200)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{formatNumber(analytics?.uniqueUsers || 0)}</div>
                {getChangeIndicator(analytics?.uniqueUsers || 0, 450)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Session Length</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {(analytics?.userEngagementMetrics.averageSessionDuration || 0).toFixed(1)}m
                </div>
                {getChangeIndicator(analytics?.userEngagementMetrics.averageSessionDuration || 0, 3.2)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {(analytics?.samPerformanceMetrics.responseAccuracy || 0).toFixed(1)}%
                </div>
                {getChangeIndicator(analytics?.samPerformanceMetrics.responseAccuracy || 0, 82)}
              </CardContent>
            </Card>
          </div>

          {/* Engagement Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  User Engagement Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Return User Rate</span>
                    <span>{(analytics?.userEngagementMetrics.returnUserRate || 0).toFixed(1)}%</span>
                  </div>
                  <Progress value={analytics?.userEngagementMetrics.returnUserRate || 0} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>File Upload Rate</span>
                    <span>{(analytics?.userEngagementMetrics.fileUploadRate || 0).toFixed(1)}%</span>
                  </div>
                  <Progress value={analytics?.userEngagementMetrics.fileUploadRate || 0} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Message Velocity</span>
                    <span>{(analytics?.userEngagementMetrics.messageVelocity || 0).toFixed(1)}</span>
                  </div>
                  <Progress value={Math.min((analytics?.userEngagementMetrics.messageVelocity || 0) * 20, 100)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  SAM Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Response Accuracy</span>
                    <span>{(analytics?.samPerformanceMetrics.responseAccuracy || 0).toFixed(1)}%</span>
                  </div>
                  <Progress value={analytics?.samPerformanceMetrics.responseAccuracy || 0} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Knowledge Extraction</span>
                    <span>{(analytics?.samPerformanceMetrics.knowledgeExtractionSuccess || 0).toFixed(1)}%</span>
                  </div>
                  <Progress value={analytics?.samPerformanceMetrics.knowledgeExtractionSuccess || 0} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Error Recovery Rate</span>
                    <span>{(analytics?.samPerformanceMetrics.errorRecoveryRate || 0).toFixed(1)}%</span>
                  </div>
                  <Progress value={analytics?.samPerformanceMetrics.errorRecoveryRate || 0} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Distribution Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Industry Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(analytics?.industryBreakdown || {}).slice(0, 5).map(([industry, count]) => (
                    <div key={industry} className="flex justify-between items-center">
                      <span className="text-sm capitalize">{industry}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Script Positions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(analytics?.scriptPositionDistribution || {}).slice(0, 5).map(([position, count]) => (
                    <div key={position} className="flex justify-between items-center">
                      <span className="text-sm capitalize">{position}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conversation Topics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(analytics?.topicDistribution || {}).slice(0, 5).map(([topic, count]) => (
                    <div key={topic} className="flex justify-between items-center">
                      <span className="text-sm capitalize">{topic}</span>
                      <Badge variant="default">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* User Behavior Tab */}
        <TabsContent value="behavior" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Session Patterns</CardTitle>
                <CardDescription>User activity and session analytics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-semibold">
                      {(userBehavior?.sessionPatterns.averageSessionLength || 0).toFixed(1)}m
                    </div>
                    <div className="text-sm text-gray-600">Average Session</div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">
                      {(userBehavior?.sessionPatterns.conversationsPerSession || 0).toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-600">Messages/Session</div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-2">Peak Hours</div>
                  <div className="flex gap-2">
                    {(userBehavior?.sessionPatterns.peakUsageHours || []).map(hour => (
                      <Badge key={hour} variant="outline">
                        {hour}:00
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Engagement Depth</CardTitle>
                <CardDescription>How deeply users engage with SAM</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Script Progression</span>
                      <span>{(userBehavior?.engagementDepth.scriptProgressionRate || 0).toFixed(1)}%</span>
                    </div>
                    <Progress value={userBehavior?.engagementDepth.scriptProgressionRate || 0} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Discovery Completion</span>
                      <span>{(userBehavior?.engagementDepth.discoveryCompletionRate || 0).toFixed(1)}%</span>
                    </div>
                    <Progress value={userBehavior?.engagementDepth.discoveryCompletionRate || 0} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>ICP Research Adoption</span>
                      <span>{(userBehavior?.engagementDepth.icpResearchAdoptionRate || 0).toFixed(1)}%</span>
                    </div>
                    <Progress value={userBehavior?.engagementDepth.icpResearchAdoptionRate || 0} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Conversion Funnels</CardTitle>
              <CardDescription>User journey progression through SAM's conversation flow</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-semibold text-green-600">
                    {(userBehavior?.conversionFunnels.greetingToDiscovery || 0)}%
                  </div>
                  <div className="text-sm text-gray-600">Greeting → Discovery</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-semibold text-blue-600">
                    {(userBehavior?.conversionFunnels.discoveryToICP || 0)}%
                  </div>
                  <div className="text-sm text-gray-600">Discovery → ICP</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-semibold text-purple-600">
                    {(userBehavior?.conversionFunnels.icpToAction || 0)}%
                  </div>
                  <div className="text-sm text-gray-600">ICP → Action</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Optimization Tab */}
        <TabsContent value="optimization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                SAM Optimization Recommendations
              </CardTitle>
              <CardDescription>
                Data-driven insights to improve SAM's performance and user experience
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(analytics?.optimizationInsights.improvementRecommendations || []).map((recommendation, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <div className="font-medium text-blue-900">{recommendation}</div>
                      <div className="text-sm text-blue-700 mt-1">
                        Based on conversation analysis and user behavior patterns
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Most Effective Script Positions</CardTitle>
                <CardDescription>Script sections with highest user engagement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(analytics?.optimizationInsights.mostEffectiveScriptPositions || []).map((position, index) => (
                    <div key={position} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{index + 1}</Badge>
                        <span className="capitalize">{position}</span>
                      </div>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Common Pain Points</CardTitle>
                <CardDescription>Areas where users need more support</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(analytics?.optimizationInsights.commonUserPainPoints || []).map((painPoint, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      <span className="text-sm">{painPoint}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Other tabs can be implemented similarly */}
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>SAM Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                Performance metrics dashboard coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns">
          <Card>
            <CardHeader>
              <CardTitle>Conversation Patterns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                Conversation pattern analysis coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights">
          <Card>
            <CardHeader>
              <CardTitle>Learning Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                Learning insights dashboard coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}