'use client';

import React, { useState } from 'react';
import { Brain, MessageCircle, Send, TrendingUp, Search, MessageSquare, FileText, Settings, Edit, Plug } from 'lucide-react';
import LLMConfigModal from '@/components/LLMConfigModal';
import ReplyAgentModal from '@/app/components/ReplyAgentModal';

interface AIConfigurationProps {
  workspaceId: string | null;
  workspaceName?: string;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  icon: any;
  status: 'active' | 'coming-soon';
  badge?: 'upgrade';
  color: string;
  onClick: () => void;
}

export default function AIConfiguration({ workspaceId, workspaceName }: AIConfigurationProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showLLMModal, setShowLLMModal] = useState(false);
  const [showReplyAgentModal, setShowReplyAgentModal] = useState(false);

  const agents: Agent[] = [
    {
      id: 'llm-config',
      name: 'AI Model Configuration',
      description: 'Configure AI models, providers, and API keys for all agents',
      icon: Brain,
      status: 'active',
      color: 'purple',
      onClick: () => setShowLLMModal(true),
    },
    {
      id: 'byoa',
      name: 'Bring Your Own Agents',
      description: 'Connect SAM to your own AI agents and have them interact seamlessly via MCP',
      icon: Plug,
      status: 'coming-soon',
      color: 'cyan',
      onClick: () => {},
    },
    {
      id: 'orchestration-agent',
      name: 'SAM - Orchestration Agent',
      description: 'Your AI sales assistant coordinating all agents and managing conversations',
      icon: Settings,
      status: 'active',
      color: 'cyan',
      onClick: () => {}, // TODO: Link to SAM chat
    },
    {
      id: 'reply-agent',
      name: 'Reply Agent',
      description: 'Automatically respond to prospect replies with personalized messages',
      icon: MessageCircle,
      status: 'active',
      color: 'blue',
      onClick: () => setShowReplyAgentModal(true),
    },
    {
      id: 'follow-up-agent',
      name: 'Follow-Up Agent',
      description: 'Automatically send follow-up messages based on prospect behavior',
      icon: Send,
      status: 'active',
      color: 'green',
      onClick: () => {}, // TODO: Link to follow-up config
    },
    {
      id: 'inbox-agent',
      name: 'Inbox Agent',
      description: 'Monitor and categorize incoming messages from prospects',
      icon: Search,
      status: 'active',
      badge: 'upgrade',
      color: 'yellow',
      onClick: () => {}, // TODO: Link to inbox agent config
    },
    {
      id: 'ai-search-agent',
      name: 'AI Search Agent',
      description: 'Optimize content for AI search engines and generate search-friendly copy',
      icon: TrendingUp,
      status: 'coming-soon',
      color: 'orange',
      onClick: () => {},
    },
    {
      id: 'commenting-agent',
      name: 'Commenting Agent',
      description: 'Engage with LinkedIn posts and comments to build relationships',
      icon: MessageSquare,
      status: 'coming-soon',
      color: 'pink',
      onClick: () => {},
    },
    {
      id: 'content-agent',
      name: 'LinkedIn Content Agent',
      description: 'Generate and schedule LinkedIn posts to grow your presence',
      icon: FileText,
      status: 'coming-soon',
      color: 'indigo',
      onClick: () => {},
    },
    {
      id: 'blog-writer-agent',
      name: 'Blog Writer Agent',
      description: 'Generate high-quality blog posts and articles optimized for engagement',
      icon: Edit,
      status: 'coming-soon',
      color: 'teal',
      onClick: () => {},
    },
  ];

  const getStatusBadge = (status: string, badge?: string) => {
    if (badge === 'upgrade') {
      return (
        <span className="px-2 py-1 bg-purple-600/20 text-purple-400 text-xs rounded-full border border-purple-500/30">
          Upgrade
        </span>
      );
    }
    if (status === 'active') {
      return (
        <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded-full border border-green-500/30">
          Active
        </span>
      );
    }
    return (
      <span className="px-2 py-1 bg-gray-600/20 text-gray-400 text-xs rounded-full border border-gray-500/30">
        Coming Soon
        </span>
    );
  };

  return (
    <>
      <div className="min-h-screen p-8">
        <div className="max-w-[1400px] mx-auto">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <Brain className="h-8 w-8 text-primary" />
                  <h1 className="text-4xl font-bold">AI Configuration</h1>
                </div>
                <p className="text-xl text-muted-foreground mb-4">
                  Agent Management & Automation
                </p>
                <p className="text-sm text-muted-foreground">
                  Configure and manage all AI agents for {workspaceName || 'your workspace'}.
                </p>
              </div>
            </div>
          </div>

        {/* Agent Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => {
            const Icon = agent.icon;
            const isActive = agent.status === 'active';
            const colorClasses = {
              purple: 'from-purple-600/20 to-purple-900/20 border-purple-500/30 hover:border-purple-400/50',
              cyan: 'from-cyan-600/20 to-cyan-900/20 border-cyan-500/30 hover:border-cyan-400/50',
              blue: 'from-blue-600/20 to-blue-900/20 border-blue-500/30 hover:border-blue-400/50',
              green: 'from-green-600/20 to-green-900/20 border-green-500/30 hover:border-green-400/50',
              yellow: 'from-yellow-600/20 to-yellow-900/20 border-yellow-500/30 hover:border-yellow-400/50',
              orange: 'from-orange-600/20 to-orange-900/20 border-orange-500/30 hover:border-orange-400/50',
              pink: 'from-pink-600/20 to-pink-900/20 border-pink-500/30 hover:border-pink-400/50',
              indigo: 'from-indigo-600/20 to-indigo-900/20 border-indigo-500/30 hover:border-indigo-400/50',
              teal: 'from-teal-600/20 to-teal-900/20 border-teal-500/30 hover:border-teal-400/50',
            };

            return (
              <div
                key={agent.id}
                onClick={isActive ? agent.onClick : undefined}
                className={`
                  relative bg-gradient-to-br ${colorClasses[agent.color as keyof typeof colorClasses]}
                  rounded-xl p-6 border transition-all duration-200
                  ${isActive ? 'cursor-pointer hover:scale-105 hover:shadow-xl' : 'cursor-not-allowed opacity-60'}
                `}
              >
                {/* Icon */}
                <div className="flex items-start justify-between mb-4">
                  <div className={`
                    w-12 h-12 rounded-lg flex items-center justify-center
                    ${isActive ? 'bg-white/10' : 'bg-gray-700/50'}
                  `}>
                    <Icon className={`h-6 w-6 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                  </div>
                  {getStatusBadge(agent.status, agent.badge)}
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold text-white mb-2">
                  {agent.name}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {agent.description}
                </p>

                {/* Configure Button for Active Agents */}
                {isActive && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <button
                      onClick={agent.onClick}
                      className="w-full py-2 px-4 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Configure
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

          {/* Info Box */}
          <div className="mt-8 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-2">About AI Agents</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  AI agents automate repetitive tasks and enhance your outreach campaigns. Configure each agent's
                  behavior, tone, and automation rules to match your workflow. Active agents are ready to use,
                  while "Coming Soon" features are currently in development.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showLLMModal && workspaceId && (
        <LLMConfigModal
          isOpen={showLLMModal}
          onClose={() => setShowLLMModal(false)}
          workspaceId={workspaceId}
        />
      )}

      {showReplyAgentModal && workspaceId && (
        <ReplyAgentModal
          isOpen={showReplyAgentModal}
          onClose={() => setShowReplyAgentModal(false)}
          workspaceId={workspaceId}
        />
      )}
    </>
  );
}
