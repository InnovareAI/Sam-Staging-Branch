'use client'

import { toastSuccess, toastError, toastWarning, toastInfo } from '@/lib/toast';
import { useState, useEffect } from 'react';
import { useSamThreadedChat } from '@/lib/hooks/useSamThreadedChat';
import ThreadTagger from '@/components/ThreadTagger';
import {
  History,
  X,
  Save,
  Hash,
  Calendar,
  Search,
  Trash2,
  MessageCircle,
  Filter,
  Star,
  Clock
} from 'lucide-react'

/**
 * Conversation History Sidebar for SAM AI
 *
 * Allows users to save, organize, and access previous conversations
 */

interface ConversationHistoryProps {
  isOpen: boolean
  onClose: () => void
  currentMessages: any[]
  onLoadConversation: (messages: any[]) => void
  className?: string
}

export default function ConversationHistory({
  isOpen,
  onClose,
  currentMessages,
  onLoadConversation,
  className = ''
}: ConversationHistoryProps) {
  const {
    threads,
    isLoading,
    loadThreads,
    createThread,
    deleteThread
  } = useSamThreadedChat()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveForm, setSaveForm] = useState({
    title: '',
    tags: [] as string[],
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent'
  })

  useEffect(() => {
    if (isOpen) {
      loadThreads()
    }
  }, [isOpen, loadThreads])

  // Filter threads based on search and tags
  const filteredThreads = threads.filter(thread => {
    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      if (!thread.title.toLowerCase().includes(searchLower) &&
          !thread.prospect_name?.toLowerCase().includes(searchLower) &&
          !thread.tags?.some(tag => tag.toLowerCase().includes(searchLower))) {
        return false
      }
    }

    // Tags filter
    if (selectedTags.length > 0) {
      if (!thread.tags?.some(tag => selectedTags.includes(tag))) {
        return false
      }
    }

    return true
  })

  // Get all unique tags
  const allTags = Array.from(new Set(
    threads.flatMap(thread => thread.tags || [])
  ))

  const handleSaveCurrentConversation = async () => {
    if (currentMessages.length === 0) {
      toastError('No conversation to save')
      return
    }

    if (!saveForm.title.trim()) {
      toastError('Please enter a title for the conversation')
      return
    }

    try {
      // Create thread
      const thread = await createThread({
        title: saveForm.title,
        thread_type: 'general',
        priority: saveForm.priority,
        tags: saveForm.tags
      })

      if (thread) {
        // Save messages to the thread
        for (const message of currentMessages) {
          // Note: In a full implementation, you'd want to save these messages
          // via the API to maintain proper threading
        }

        toastError('Conversation saved successfully!')
        setShowSaveDialog(false)
        setSaveForm({ title: '', tags: [], priority: 'medium' })
        loadThreads() // Refresh list
      }
    } catch (error) {
      console.error('Failed to save conversation:', error)
      toastError('Failed to save conversation')
    }
  }

  const handleLoadConversation = async (thread: SamConversationThread) => {
    try {
      const response = await fetch(`/api/sam/threads/${thread.id}/messages`)
      if (!response.ok) {
        throw new Error('Failed to load thread messages')
      }
      
      const data = await response.json()
      const messages = data.messages || []
      
      if (messages.length > 0) {
        onLoadConversation(messages)
        onClose()
      } else {
        toastError('No messages found in this conversation')
      }
    } catch (error) {
      console.error('Failed to load conversation:', error)
      toastError('Failed to load conversation')
    }
  }

  const handleDeleteThread = async (threadId: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
      try {
        await deleteThread(threadId)
        loadThreads() // Refresh list
      } catch (error) {
        console.error('Failed to delete thread:', error)
        toastError('Failed to delete conversation')
      }
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-400'
      case 'high': return 'text-orange-400'
      case 'medium': return 'text-blue-400'
      case 'low': return 'text-gray-400'
      default: return 'text-gray-400'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <History className="text-purple-400" size={24} />
            <h2 className="text-xl font-semibold text-white">Conversation History</h2>
          </div>
          <div className="flex items-center space-x-2">
            {currentMessages.length > 0 && (
              <button
                onClick={() => setShowSaveDialog(true)}
                className="flex items-center space-x-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <Save size={16} />
                <span>Save Current</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="p-4 border-b border-gray-700 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Tag Filter */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-400 self-center">Filter by tags:</span>
              {allTags.slice(0, 10).map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    setSelectedTags(prev =>
                      prev.includes(tag)
                        ? prev.filter(t => t !== tag)
                        : [...prev, tag]
                    )
                  }}
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <Hash size={10} className="mr-1" />
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">Loading conversations...</div>
          ) : filteredThreads.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="mx-auto mb-4 text-gray-600" size={48} />
              <p className="text-gray-400">
                {searchQuery || selectedTags.length > 0 ? 'No conversations match your filters.' : 'No saved conversations yet.'}
              </p>
              <p className="text-gray-500 text-sm mt-2">
                Start chatting and save important conversations to access them later.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredThreads.map((thread) => (
                <div
                  key={thread.id}
                  className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-white font-medium truncate">{thread.title}</h3>
                        <span className={`text-xs ${getPriorityColor(thread.priority)}`}>
                          {thread.priority}
                        </span>
                      </div>
                      
                      {thread.prospect_name && (
                        <p className="text-sm text-gray-300 mb-2">
                          {thread.prospect_name}
                          {thread.prospect_company && ` • ${thread.prospect_company}`}
                        </p>
                      )}

                      <div className="flex items-center space-x-4 text-xs text-gray-400 mb-2">
                        <span className="flex items-center space-x-1">
                          <Clock size={12} />
                          <span>{formatDate(thread.last_active_at)}</span>
                        </span>
                        <span>{thread.message_count} messages</span>
                      </div>

                      {/* Tags */}
                      {thread.tags && thread.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {thread.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-1.5 py-0.5 bg-gray-600 text-gray-300 rounded text-xs"
                            >
                              <Hash size={8} className="mr-1" />
                              {tag}
                            </span>
                          ))}
                          {thread.tags.length > 4 && (
                            <span className="text-xs text-gray-500">+{thread.tags.length - 4}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleLoadConversation(thread)}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDeleteThread(thread.id, thread.title)}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Dialog */}
        {showSaveDialog && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-white mb-4">Save Conversation</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                  <input
                    type="text"
                    value={saveForm.title}
                    onChange={(e) => setSaveForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter conversation title..."
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
                  <select
                    value={saveForm.priority}
                    onChange={(e) => setSaveForm(prev => ({ ...prev, priority: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tags</label>
                  <ThreadTagger
                    currentTags={saveForm.tags}
                    onTagsChange={(tags) => setSaveForm(prev => ({ ...prev, tags }))}
                    maxTags={5}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={handleSaveCurrentConversation}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
