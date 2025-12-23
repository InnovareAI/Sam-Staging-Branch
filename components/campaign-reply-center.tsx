'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Clock, User, MessageCircle, Filter, RefreshCw, Zap, Heart, AlertCircle } from 'lucide-react'

interface CampaignReplyMessage {
  id: string
  type: 'linkedin' | 'email' | 'gmail' | 'outlook'
  subject: string
  from: string
  company: string
  time: string
  details: string
  source: string
  platform: string
  // Campaign reply specific fields
  is_campaign_reply: boolean
  campaign_id?: string
  campaign_name?: string
  reply_priority: 'high' | 'medium' | 'low'
  reply_sentiment?: 'positive' | 'neutral' | 'negative' | 'interested' | 'not_interested'
  confidence_score?: number
  requires_action: boolean
}

interface CampaignStats {
  total_replies: number
  unprocessed_replies: number
  high_priority_replies: number
  positive_sentiment_replies: number
  avg_response_time_hours: number
}

export function CampaignReplyCenter() {
  const [messages, setMessages] = useState<CampaignReplyMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [campaignStats, setCampaignStats] = useState<CampaignStats | null>(null)
  const [selectedPriority, setSelectedPriority] = useState<string>('all')
  const [selectedSentiment, setSelectedSentiment] = useState<string>('all')
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('high-priority')

  // Fetch campaign replies
  useEffect(() => {
    fetchCampaignReplies()
  }, [selectedPriority, selectedSentiment, selectedCampaign])

  const fetchCampaignReplies = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        filter: 'campaign_replies',
        batch_size: '100'
      })
      
      if (selectedPriority !== 'all') params.append('priority', selectedPriority)
      if (selectedSentiment !== 'all') params.append('sentiment', selectedSentiment)
      if (selectedCampaign !== 'all') params.append('campaign_id', selectedCampaign)

      const response = await fetch(`/api/inbox/messages?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setMessages(data.messages)
        setCampaignStats(data.campaign_stats)
      }
    } catch (error) {
      console.error('Failed to fetch campaign replies:', error)
    } finally {
      setLoading(false)
    }
  }

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'linkedin': return '💼'
      case 'gmail': return '📧'
      case 'outlook': return '📨'
      default: return '💬'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getSentimentIcon = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return <Heart className="h-4 w-4 text-green-600" />
      case 'interested': return <Zap className="h-4 w-4 text-blue-600" />
      case 'negative': return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'not_interested': return <AlertCircle className="h-4 w-4 text-gray-600" />
      default: return <MessageCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const filterMessagesByPriority = (priority: string) => {
    return messages.filter(msg => {
      if (priority === 'requires-action') return msg.requires_action
      return msg.reply_priority === priority
    })
  }

  const StatsCard = ({ title, value, icon, color }: { 
    title: string; 
    value: number; 
    icon: React.ReactNode; 
    color: string 
  }) => (
    <Card className={`border-l-4 ${color}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )

  const MessageCard = ({ message }: { message: CampaignReplyMessage }) => (
    <Card className="mb-3 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-sm">
                {message.from.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-medium">{message.from}</span>
                <Badge className={`text-xs ${getPriorityColor(message.reply_priority)}`}>
                  {message.reply_priority}
                </Badge>
                {message.reply_sentiment && getSentimentIcon(message.reply_sentiment)}
                <span className="text-xs">{getMessageIcon(message.type)}</span>
              </div>
              <div className="text-sm text-gray-600">{message.company}</div>
              {message.campaign_name && (
                <div className="text-xs text-blue-600">Campaign: {message.campaign_name}</div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500 flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              {message.time}
            </div>
            {message.confidence_score && (
              <div className="text-xs text-gray-400">
                Confidence: {Math.round(message.confidence_score * 100)}%
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-3">
          <div className="font-medium text-sm mb-1">{message.subject}</div>
          <div className="text-sm text-gray-700 line-clamp-2">
            {message.details}
          </div>
        </div>

        <div className="mt-3 flex justify-between items-center">
          <div className="flex space-x-2">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-foreground">
              Reply
            </Button>
            <Button size="sm" variant="outline">
              Schedule Follow-up
            </Button>
            <Button size="sm" variant="outline">
              Mark as Processed
            </Button>
          </div>
          {message.requires_action && (
            <Badge className="bg-orange-100 text-orange-800">
              Action Required
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading campaign replies...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaign Reply Center</h1>
          <p className="text-gray-600">Manage replies to your campaign messages</p>
        </div>
        <Button onClick={fetchCampaignReplies} className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Campaign Statistics */}
      {campaignStats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatsCard
            title="Total Replies"
            value={campaignStats.total_replies}
            icon={<MessageCircle className="h-4 w-4 text-blue-600" />}
            color="border-blue-500"
          />
          <StatsCard
            title="Unprocessed"
            value={campaignStats.unprocessed_replies}
            icon={<AlertCircle className="h-4 w-4 text-orange-600" />}
            color="border-orange-500"
          />
          <StatsCard
            title="High Priority"
            value={campaignStats.high_priority_replies}
            icon={<Zap className="h-4 w-4 text-red-600" />}
            color="border-red-500"
          />
          <StatsCard
            title="Positive/Interested"
            value={campaignStats.positive_sentiment_replies}
            icon={<Heart className="h-4 w-4 text-green-600" />}
            color="border-green-500"
          />
          <StatsCard
            title="Avg Response Time"
            value={Math.round(campaignStats.avg_response_time_hours)}
            icon={<Clock className="h-4 w-4 text-purple-600" />}
            color="border-purple-500"
          />
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Priority:</label>
              <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Sentiment:</label>
              <Select value={selectedSentiment} onValueChange={setSelectedSentiment}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="interested">Interested</SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                  <SelectItem value="not_interested">Not Interested</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reply Messages Organized by Priority */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="high-priority" className="flex items-center space-x-2">
            <Zap className="h-4 w-4" />
            <span>High Priority ({filterMessagesByPriority('high').length})</span>
          </TabsTrigger>
          <TabsTrigger value="medium-priority" className="flex items-center space-x-2">
            <MessageCircle className="h-4 w-4" />
            <span>Medium ({filterMessagesByPriority('medium').length})</span>
          </TabsTrigger>
          <TabsTrigger value="low-priority" className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Low ({filterMessagesByPriority('low').length})</span>
          </TabsTrigger>
          <TabsTrigger value="requires-action" className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4" />
            <span>Action Required ({filterMessagesByPriority('requires-action').length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="high-priority" className="space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            High-priority replies from interested prospects that require immediate attention
          </div>
          {filterMessagesByPriority('high').length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No high-priority campaign replies at the moment</p>
              </CardContent>
            </Card>
          ) : (
            filterMessagesByPriority('high').map(message => (
              <MessageCard key={message.id} message={message} />
            ))
          )}
        </TabsContent>

        <TabsContent value="medium-priority" className="space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            Medium-priority replies that should be addressed within 24 hours
          </div>
          {filterMessagesByPriority('medium').length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No medium-priority campaign replies</p>
              </CardContent>
            </Card>
          ) : (
            filterMessagesByPriority('medium').map(message => (
              <MessageCard key={message.id} message={message} />
            ))
          )}
        </TabsContent>

        <TabsContent value="low-priority" className="space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            Low-priority replies that can be addressed when convenient
          </div>
          {filterMessagesByPriority('low').length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No low-priority campaign replies</p>
              </CardContent>
            </Card>
          ) : (
            filterMessagesByPriority('low').map(message => (
              <MessageCard key={message.id} message={message} />
            ))
          )}
        </TabsContent>

        <TabsContent value="requires-action" className="space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            All replies that require some form of action or response
          </div>
          {filterMessagesByPriority('requires-action').length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No campaign replies requiring action</p>
              </CardContent>
            </Card>
          ) : (
            filterMessagesByPriority('requires-action').map(message => (
              <MessageCard key={message.id} message={message} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Empty State for No Campaign Replies */}
      {messages.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageCircle className="h-16 w-16 text-gray-400 mx-auto mb-6" />
            <h3 className="text-lg font-semibold mb-2">No Campaign Replies Yet</h3>
            <p className="text-gray-600 mb-4">
              Once your campaigns start generating replies, they'll appear here organized by priority and sentiment.
            </p>
            <Button onClick={fetchCampaignReplies} className="flex items-center space-x-2 mx-auto">
              <RefreshCw className="h-4 w-4" />
              <span>Check Again</span>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}