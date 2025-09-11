/**
 * Thread Sidebar Component for SAM AI
 * 
 * Displays organized conversation threads with tagging, filtering, and management
 */

'use client'

import React, { useState, useEffect } from 'react'
import { 
  MessageCircle, 
  Plus, 
  Search, 
  Filter, 
  Archive, 
  Trash2, 
  Hash, 
  Clock, 
  User, 
  Building, 
  Target,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { SamConversationThread, useSamThreadedChat } from '@/lib/hooks/useSamThreadedChat'
import ThreadTagger from './ThreadTagger'

interface ThreadSidebarProps {
  onThreadSelect: (thread: SamConversationThread) => void
  currentThreadId?: string
  className?: string
}

export default function ThreadSidebar({ 
  onThreadSelect, 
  currentThreadId, 
  className = '' 
}: ThreadSidebarProps) {
  const {
    threads,
    isLoading,
    error,
    loadThreads,
    createThread,
    updateThread,
    archiveThread,
    deleteThread,
    getThreadsByType,
    getRecentThreads
  } = useSamThreadedChat()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<{
    type?: string
    status?: string
    priority?: string
    tags?: string[]
  }>({})
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['recent']))
  const [editingThread, setEditingThread] = useState<string | null>(null)

  // Load threads on mount
  useEffect(() => {
    loadThreads()
  }, [loadThreads])

  // Filter threads based on search and filters
  const filteredThreads = threads.filter(thread => {
    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      if (!thread.title.toLowerCase().includes(searchLower) &&
          !thread.prospect_name?.toLowerCase().includes(searchLower) &&
          !thread.prospect_company?.toLowerCase().includes(searchLower) &&
          !thread.tags?.some(tag => tag.toLowerCase().includes(searchLower))) {
        return false
      }
    }

    // Type filter
    if (selectedFilter.type && thread.thread_type !== selectedFilter.type) {
      return false
    }

    // Status filter
    if (selectedFilter.status && thread.status !== selectedFilter.status) {
      return false
    }

    // Priority filter
    if (selectedFilter.priority && thread.priority !== selectedFilter.priority) {
      return false
    }

    // Tags filter
    if (selectedFilter.tags?.length) {
      if (!thread.tags?.some(tag => selectedFilter.tags!.includes(tag))) {
        return false
      }
    }

    return true
  })

  const threadsByType = getThreadsByType()
  const recentThreads = getRecentThreads(5)

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName)
    } else {
      newExpanded.add(groupName)
    }
    setExpandedGroups(newExpanded)
  }

  const handleCreateThread = async (data: any) => {
    const thread = await createThread(data)
    if (thread) {
      setShowCreateForm(false)
      onThreadSelect(thread)
    }
  }

  const handleUpdateTags = async (threadId: string, tags: string[]) => {
    await updateThread(threadId, { tags })
    setEditingThread(null)
  }

  const getThreadIcon = (type: string) => {
    switch (type) {
      case 'prospect': return <User size={16} />
      case 'company_analysis': return <Building size={16} />
      case 'campaign': return <Target size={16} />
      case 'linkedin_research': return <Hash size={16} />
      default: return <MessageCircle size={16} />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500'
      case 'high': return 'border-l-orange-500'
      case 'medium': return 'border-l-blue-500'
      case 'low': return 'border-l-gray-500'
      default: return 'border-l-gray-300'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className={`flex flex-col h-full bg-gray-50 border-r border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Conversations</h2>
          <button
            onClick={() => setShowCreateForm(true)}
            className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Quick Filters */}
        <div className="flex space-x-2">
          <select
            value={selectedFilter.type || ''}
            onChange={(e) => setSelectedFilter(prev => ({ ...prev, type: e.target.value || undefined }))}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="">All Types</option>
            <option value="prospect">Prospects</option>
            <option value="linkedin_research">LinkedIn</option>
            <option value="campaign">Campaigns</option>
            <option value="company_analysis">Companies</option>
            <option value="general">General</option>
          </select>
          
          <select
            value={selectedFilter.priority || ''}
            onChange={(e) => setSelectedFilter(prev => ({ ...prev, priority: e.target.value || undefined }))}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">Loading conversations...</div>
        ) : error ? (
          <div className="p-4 text-center text-red-500">Error: {error}</div>
        ) : filteredThreads.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchQuery ? 'No conversations match your search.' : 'No conversations yet.'}
          </div>
        ) : (
          <div className="space-y-1">
            {/* Recent Threads */}
            {!searchQuery && (
              <div>
                <button
                  onClick={() => toggleGroup('recent')}
                  className="w-full flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  {expandedGroups.has('recent') ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <Clock size={16} />
                  <span>Recent ({recentThreads.length})</span>
                </button>
                
                {expandedGroups.has('recent') && (
                  <div className="space-y-1">
                    {recentThreads.map((thread) => (
                      <ThreadItem
                        key={thread.id}
                        thread={thread}
                        isSelected={thread.id === currentThreadId}
                        isEditing={editingThread === thread.id}
                        onSelect={() => onThreadSelect(thread)}
                        onEdit={() => setEditingThread(thread.id)}
                        onUpdateTags={(tags) => handleUpdateTags(thread.id, tags)}
                        onArchive={() => archiveThread(thread.id)}
                        onDelete={() => deleteThread(thread.id)}
                        formatDate={formatDate}
                        getThreadIcon={getThreadIcon}
                        getPriorityColor={getPriorityColor}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* All Filtered Threads */}
            {(searchQuery || Object.keys(selectedFilter).some(key => selectedFilter[key as keyof typeof selectedFilter])) && (
              <div className="space-y-1">
                {filteredThreads.map((thread) => (
                  <ThreadItem
                    key={thread.id}
                    thread={thread}
                    isSelected={thread.id === currentThreadId}
                    isEditing={editingThread === thread.id}
                    onSelect={() => onThreadSelect(thread)}
                    onEdit={() => setEditingThread(thread.id)}
                    onUpdateTags={(tags) => handleUpdateTags(thread.id, tags)}
                    onArchive={() => archiveThread(thread.id)}
                    onDelete={() => deleteThread(thread.id)}
                    formatDate={formatDate}
                    getThreadIcon={getThreadIcon}
                    getPriorityColor={getPriorityColor}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Thread Modal */}
      {showCreateForm && (
        <CreateThreadModal
          onClose={() => setShowCreateForm(false)}
          onCreate={handleCreateThread}
        />
      )}
    </div>
  )
}

// Thread Item Component
interface ThreadItemProps {
  thread: SamConversationThread
  isSelected: boolean
  isEditing: boolean
  onSelect: () => void
  onEdit: () => void
  onUpdateTags: (tags: string[]) => void
  onArchive: () => void
  onDelete: () => void
  formatDate: (date: string) => string
  getThreadIcon: (type: string) => React.ReactNode
  getPriorityColor: (priority: string) => string
}

function ThreadItem({
  thread,
  isSelected,
  isEditing,
  onSelect,
  onEdit,
  onUpdateTags,
  onArchive,
  onDelete,
  formatDate,
  getThreadIcon,
  getPriorityColor
}: ThreadItemProps) {
  return (
    <div className={`border-l-4 ${getPriorityColor(thread.priority)} ${isSelected ? 'bg-purple-50' : 'hover:bg-gray-100'}`}>
      <div
        onClick={onSelect}
        className="p-3 cursor-pointer"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-2 flex-1">
            <div className="text-gray-500 mt-1">
              {getThreadIcon(thread.thread_type)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {thread.title}
              </h3>
              
              {thread.prospect_name && (
                <p className="text-xs text-gray-600 mt-1">
                  {thread.prospect_name}
                  {thread.prospect_company && ` • ${thread.prospect_company}`}
                </p>
              )}
              
              {thread.last_sam_message && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {thread.last_sam_message}
                </p>
              )}
              
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span>{formatDate(thread.last_active_at)}</span>
                  <span>•</span>
                  <span>{thread.message_count} messages</span>
                </div>
              </div>
              
              {/* Tags */}
              {isEditing ? (
                <div className="mt-2">
                  <ThreadTagger
                    currentTags={thread.tags || []}
                    onTagsChange={onUpdateTags}
                    maxTags={5}
                    className="text-xs"
                  />
                </div>
              ) : thread.tags && thread.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {thread.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                    >
                      <Hash size={8} className="mr-1" />
                      {tag}
                    </span>
                  ))}
                  {thread.tags.length > 3 && (
                    <span className="text-xs text-gray-500">+{thread.tags.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <Hash size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onArchive()
              }}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <Archive size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Create Thread Modal Component
interface CreateThreadModalProps {
  onClose: () => void
  onCreate: (data: any) => void
}

function CreateThreadModal({ onClose, onCreate }: CreateThreadModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    thread_type: 'general' as SamConversationThread['thread_type'],
    prospect_name: '',
    prospect_company: '',
    campaign_name: '',
    priority: 'medium' as SamConversationThread['priority'],
    tags: [] as string[]
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.title.trim()) {
      onCreate(formData)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Create New Conversation</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Enter conversation title..."
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={formData.thread_type}
              onChange={(e) => setFormData(prev => ({ ...prev, thread_type: e.target.value as any }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="general">General</option>
              <option value="prospect">Prospect</option>
              <option value="linkedin_research">LinkedIn Research</option>
              <option value="campaign">Campaign</option>
              <option value="company_analysis">Company Analysis</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Tags</label>
            <ThreadTagger
              currentTags={formData.tags}
              onTagsChange={(tags) => setFormData(prev => ({ ...prev, tags }))}
              maxTags={5}
            />
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Create
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}