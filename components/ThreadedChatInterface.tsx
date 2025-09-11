/**
 * Threaded Chat Interface for SAM AI
 * 
 * Main chat interface with threaded conversations, tagging, and filtering
 */

'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  Send, 
  Paperclip, 
  Hash, 
  Calendar,
  Filter
} from 'lucide-react'
import ThreadSidebar from './ThreadSidebar'
import TagFilterPanel from './TagFilterPanel'
import { SamConversationThread, useSamThreadedChat } from '@/lib/hooks/useSamThreadedChat'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  has_prospect_intelligence?: boolean
  prospect_intelligence_data?: any
}

export default function ThreadedChatInterface() {
  const {
    threads,
    loadThreads,
    sendMessage,
    isLoading
  } = useSamThreadedChat()

  const [currentThread, setCurrentThread] = useState<SamConversationThread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [showTagFilter, setShowTagFilter] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load threads on mount
  useEffect(() => {
    loadThreads()
  }, [loadThreads])

  // Load messages when thread changes
  useEffect(() => {
    if (currentThread) {
      loadThreadMessages(currentThread.id)
    } else {
      setMessages([])
    }
  }, [currentThread])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages, isSending])

  const loadThreadMessages = async (threadId: string) => {
    setIsLoadingMessages(true)
    try {
      const response = await fetch(`/api/sam/threads/${threadId}/messages`)
      if (!response.ok) {
        throw new Error('Failed to load thread messages')
      }
      
      const data = await response.json()
      setMessages(data.messages || [])
    } catch (error) {
      console.error('Failed to load messages:', error)
      setMessages([])
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !currentThread || isSending) return

    setIsSending(true)
    try {
      const response = await sendMessage(currentThread.id, inputMessage.trim())
      if (response.success) {
        // Add both user and assistant messages to the local state
        const newMessages = [
          ...messages,
          response.userMessage,
          response.samMessage
        ]
        setMessages(newMessages)
        setInputMessage('')
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleThreadSelect = (thread: SamConversationThread) => {
    setCurrentThread(thread)
  }

  // Get all unique tags from threads for filtering
  const allTags = Array.from(new Set(
    threads.flatMap(thread => thread.tags || [])
  ))

  // Calculate thread counts for tags
  const threadCounts = allTags.reduce((acc, tag) => {
    acc[tag] = threads.filter(thread => thread.tags?.includes(tag)).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="flex h-full bg-gray-900">
      {/* Thread Sidebar */}
      <div className="w-80 border-r border-gray-700">
        <ThreadSidebar
          onThreadSelect={handleThreadSelect}
          currentThreadId={currentThread?.id}
          className="h-full"
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentThread ? (
          <>
            {/* Chat Header */}
            <div className="bg-gray-800 border-b border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div>
                    <h1 className="text-lg font-semibold text-white">
                      {currentThread.title}
                    </h1>
                    <div className="flex items-center space-x-2 text-sm text-gray-400">
                      {currentThread.prospect_name && (
                        <span>{currentThread.prospect_name}</span>
                      )}
                      {currentThread.prospect_company && (
                        <span>• {currentThread.prospect_company}</span>
                      )}
                      <span>• {currentThread.thread_type}</span>
                      <span>• {currentThread.priority} priority</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowTagFilter(!showTagFilter)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <Filter size={20} />
                  </button>
                </div>
              </div>

              {/* Thread Tags */}
              {currentThread.tags && currentThread.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {currentThread.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium"
                    >
                      <Hash size={10} className="mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {isLoadingMessages ? (
                <div className="flex justify-center py-8">
                  <div className="text-gray-400">Loading messages...</div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <img 
                    src="/SAM.jpg" 
                    alt="Sam AI" 
                    className="w-24 h-24 rounded-full object-cover mb-4"
                    style={{ objectPosition: 'center 30%' }}
                  />
                  <h3 className="text-white text-lg font-medium mb-2">
                    Start a conversation with Sam
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Ask about prospects, strategies, or anything sales-related.
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                      {message.role === 'assistant' && (
                        <div className="flex items-start space-x-3">
                          <img 
                            src="/SAM.jpg" 
                            alt="Sam AI" 
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1"
                            style={{ objectPosition: 'center 30%' }}
                          />
                          <div className="bg-gray-700 text-white px-4 py-3 rounded-2xl">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                            {message.has_prospect_intelligence && (
                              <div className="mt-2 p-2 bg-purple-600 bg-opacity-20 rounded-lg border border-purple-600 border-opacity-30">
                                <div className="flex items-center space-x-1 text-xs text-purple-300">
                                  <Calendar size={12} />
                                  <span>Prospect intelligence gathered</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {message.role === 'user' && (
                        <>
                          <div className="flex items-center justify-end space-x-2 mb-1">
                            <span className="text-gray-400 text-sm font-medium">You</span>
                          </div>
                          <div className="bg-gray-800 text-white px-4 py-3 rounded-2xl">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
              
              {isSending && (
                <div className="flex justify-start">
                  <div className="max-w-[70%]">
                    <div className="flex items-start space-x-3">
                      <img 
                        src="/SAM.jpg" 
                        alt="Sam AI" 
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1"
                        style={{ objectPosition: 'center 30%' }}
                      />
                      <div className="bg-gray-700 text-white px-4 py-3 rounded-2xl">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                          <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                          <span className="text-sm text-gray-300 ml-2">Sam is thinking...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="flex-shrink-0 p-6">
              <div className="bg-black text-white px-4 py-3 rounded-t-lg max-w-4xl mx-auto">
                <div className="flex items-center space-x-3">
                  <span className="text-sm">
                    {isSending ? 'Processing...' : 'Ready'}
                  </span>
                  <div className="flex space-x-1">
                    <div className={`w-2 h-2 rounded-full ${isSending ? 'bg-purple-400 animate-pulse' : 'bg-green-400'}`}></div>
                    <div className={`w-2 h-2 rounded-full ${isSending ? 'bg-purple-500 animate-pulse' : 'bg-green-500'}`} style={{animationDelay: '0.2s'}}></div>
                    <div className={`w-2 h-2 rounded-full ${isSending ? 'bg-purple-600 animate-pulse' : 'bg-green-600'}`} style={{animationDelay: '0.4s'}}></div>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {isSending ? 'Sam is thinking...' : 'Ready to chat with Sam AI'}
                </div>
              </div>
              
              <div className="bg-gray-700 p-4 rounded-b-lg max-w-4xl mx-auto">
                <div className="flex items-end bg-gray-600 rounded-lg px-4 py-2">
                  <button className="text-gray-400 hover:text-gray-200 transition-colors p-1 mr-2">
                    <Paperclip size={18} />
                  </button>
                  <textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Continue the conversation..."
                    className="flex-1 bg-transparent text-white placeholder-gray-400 text-base pl-3 pr-3 py-2 outline-none resize-vertical min-h-[96px] max-h-48"
                    style={{ textAlign: 'left' }}
                    rows={4}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isSending || !inputMessage.trim()}
                    className="text-gray-400 hover:text-gray-200 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors ml-2 px-3 py-1 flex items-center space-x-1"
                  >
                    <span className="text-sm font-medium">
                      {isSending ? 'Sending...' : 'Send'}
                    </span>
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* No Thread Selected */
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="text-center max-w-md">
              <img 
                src="/SAM.jpg" 
                alt="Sam AI" 
                className="w-32 h-32 rounded-full object-cover mx-auto mb-6"
                style={{ objectPosition: 'center 30%' }}
              />
              <h2 className="text-2xl font-semibold text-white mb-4">
                Welcome to Sam AI
              </h2>
              <p className="text-gray-400 mb-6">
                Select a conversation from the sidebar or create a new one to start chatting with your AI sales assistant.
              </p>
              <div className="text-sm text-gray-500">
                <p>💡 Tips:</p>
                <ul className="mt-2 space-y-1 text-left">
                  <li>• Share LinkedIn profiles for instant prospect research</li>
                  <li>• Use tags to organize your conversations</li>
                  <li>• Filter conversations by type, priority, or tags</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tag Filter Panel (Overlay) */}
      {showTagFilter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="max-w-md w-full mx-4">
            <TagFilterPanel
              allTags={allTags}
              selectedTags={selectedTags}
              onTagsChange={setSelectedTags}
              threadCounts={threadCounts}
              className="max-h-96"
            />
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowTagFilter(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}