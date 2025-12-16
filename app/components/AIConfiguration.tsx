'use client';

import React, { useState } from 'react';
import { Brain, MessageCircle, Send, TrendingUp, Search, MessageSquare, FileText, Settings, Edit, Plug, Calendar } from 'lucide-react';
import LLMConfigModal from '@/components/LLMConfigModal';
import ReplyAgentModal from '@/app/components/ReplyAgentModal';
import FollowUpAgentModal from '@/app/components/FollowUpAgentModal';
import CommentingAgentModal from '@/app/components/CommentingAgentModal';
import AISearchAgentModal from '@/app/components/AISearchAgentModal';
import InboxAgentModal from '@/app/components/InboxAgentModal';
import MeetingAgentModal from '@/app/components/MeetingAgentModal';
import { TileCard } from '@/components/TileCard';

interface AIConfigurationProps {
  workspaceId: string | null;
  workspaceName?: string;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string; }>;
  status: 'active' | 'coming-soon';
  badge?: 'upgrade';
  color: 'purple' | 'cyan' | 'blue' | 'green' | 'yellow' | 'orange' | 'pink' | 'indigo' | 'teal';
  onClick: () => void;
}

export default function AIConfiguration({ workspaceId, workspaceName }: AIConfigurationProps) {
  const [showLLMModal, setShowLLMModal] = useState(false);
  const [showReplyAgentModal, setShowReplyAgentModal] = useState(false);
  const [showFollowUpAgentModal, setShowFollowUpAgentModal] = useState(false);
  const [showCommentingAgentModal, setShowCommentingAgentModal] = useState(false);
  const [showAISearchAgentModal, setShowAISearchAgentModal] = useState(false);
  const [showInboxAgentModal, setShowInboxAgentModal] = useState(false);
  const [showMeetingAgentModal, setShowMeetingAgentModal] = useState(false);

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
      onClick: () => setShowFollowUpAgentModal(true),
    },
    {
      id: 'inbox-agent',
      name: 'Inbox Agent',
      description: 'Monitor and categorize incoming messages from prospects',
      icon: Search,
      status: 'active',
      color: 'yellow',
      onClick: () => setShowInboxAgentModal(true),
    },
    {
      id: 'ai-search-agent',
      name: 'AI Search Agent',
      description: 'Optimize content for AI search engines (GEO) and generate search-friendly copy',
      icon: TrendingUp,
      status: 'active',
      color: 'orange',
      onClick: () => setShowAISearchAgentModal(true),
    },
    {
      id: 'commenting-agent',
      name: 'Commenting Agent',
      description: 'Engage with LinkedIn posts and comments to build relationships',
      icon: MessageSquare,
      status: 'active',
      color: 'pink',
      onClick: () => setShowCommentingAgentModal(true),
    },
    {
      id: 'meeting-agent',
      name: 'Meeting Agent',
      description: 'Book meetings from Calendly links, send reminders, handle no-shows and follow-ups',
      icon: Calendar,
      status: 'active',
      color: 'purple',
      onClick: () => setShowMeetingAgentModal(true),
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


  return (
    <>
      <div>
        <div className="w-full">
        {/* Agent Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <TileCard
              key={agent.id}
              title={agent.name}
              description={agent.description}
              icon={agent.icon}
              color={agent.color}
              status={agent.badge === 'upgrade' ? 'upgrade' : agent.status}
              onClick={agent.onClick}
            />
          ))}
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

      {showFollowUpAgentModal && workspaceId && (
        <FollowUpAgentModal
          isOpen={showFollowUpAgentModal}
          onClose={() => setShowFollowUpAgentModal(false)}
          workspaceId={workspaceId}
        />
      )}

      {showCommentingAgentModal && workspaceId && (
        <CommentingAgentModal
          isOpen={showCommentingAgentModal}
          onClose={() => setShowCommentingAgentModal(false)}
          workspaceId={workspaceId}
        />
      )}

      {showAISearchAgentModal && workspaceId && (
        <AISearchAgentModal
          isOpen={showAISearchAgentModal}
          onClose={() => setShowAISearchAgentModal(false)}
          workspaceId={workspaceId}
        />
      )}

      {showInboxAgentModal && workspaceId && (
        <InboxAgentModal
          isOpen={showInboxAgentModal}
          onClose={() => setShowInboxAgentModal(false)}
          workspaceId={workspaceId}
        />
      )}

      {showMeetingAgentModal && workspaceId && (
        <MeetingAgentModal
          isOpen={showMeetingAgentModal}
          onClose={() => setShowMeetingAgentModal(false)}
          workspaceId={workspaceId}
        />
      )}
    </>
  );
}
