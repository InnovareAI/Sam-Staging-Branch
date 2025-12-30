'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import {
    Users,
    BarChart3,
    CheckCircle,
    XCircle,
    ArrowRight,
    Building,
    Mail,
    Calendar,
    TrendingUp,
    Clock,
    Target
} from 'lucide-react';

interface ProspectData {
    name: string;
    title: string;
    company: string;
    status?: 'new' | 'contacted' | 'replied' | 'meeting';
}

interface CampaignStatsData {
    name: string;
    sent: number;
    opened: number;
    replied: number;
    meetings: number;
    responseRate: string;
}

interface ActionData {
    label: string;
    action: string;
    variant?: 'primary' | 'secondary' | 'danger';
}

// Parse structured blocks from message content
function parseStructuredContent(content: string): React.ReactNode[] {
    const blocks: React.ReactNode[] = [];
    const blockRegex = /:::(\w+[-\w]*)\n([\s\S]*?):::/g;
    let lastIndex = 0;
    let match;

    while ((match = blockRegex.exec(content)) !== null) {
        // Add text before this block
        if (match.index > lastIndex) {
            const textBefore = content.slice(lastIndex, match.index).trim();
            if (textBefore) {
                blocks.push(<span key={`text-${lastIndex}`} className="whitespace-pre-wrap">{textBefore}</span>);
            }
        }

        const blockType = match[1];
        const blockContent = match[2].trim();

        try {
            switch (blockType) {
                case 'prospect-list':
                    const prospects: ProspectData[] = JSON.parse(blockContent);
                    blocks.push(<ProspectListCard key={`prospect-${match.index}`} prospects={prospects} />);
                    break;
                case 'campaign-stats':
                    const stats: CampaignStatsData = JSON.parse(blockContent);
                    blocks.push(<CampaignStatsCard key={`stats-${match.index}`} stats={stats} />);
                    break;
                case 'actions':
                    const actions: ActionData[] = JSON.parse(blockContent);
                    blocks.push(<ActionButtonsCard key={`actions-${match.index}`} actions={actions} />);
                    break;
                case 'progress':
                    const progress = JSON.parse(blockContent);
                    blocks.push(<ProgressCard key={`progress-${match.index}`} {...progress} />);
                    break;
                default:
                    // Unknown block type, render as text
                    blocks.push(<span key={`unknown-${match.index}`} className="whitespace-pre-wrap">{match[0]}</span>);
            }
        } catch (e) {
            // JSON parse error, render as text
            blocks.push(<span key={`error-${match.index}`} className="whitespace-pre-wrap">{match[0]}</span>);
        }

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last block
    if (lastIndex < content.length) {
        const remainingText = content.slice(lastIndex).trim();
        if (remainingText) {
            blocks.push(<span key={`text-end`} className="whitespace-pre-wrap">{remainingText}</span>);
        }
    }

    // If no blocks found, return original content
    if (blocks.length === 0) {
        return [<span key="plain" className="whitespace-pre-wrap">{content}</span>];
    }

    return blocks;
}

// Prospect List Card Component
function ProspectListCard({ prospects }: { prospects: ProspectData[] }) {
    const statusColors: Record<string, string> = {
        new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        contacted: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        replied: 'bg-green-500/20 text-green-400 border-green-500/30',
        meeting: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    };

    return (
        <div className="my-3 rounded-xl border border-border/60 bg-surface/50 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-highlight/50 border-b border-border/40">
                <Users size={16} className="text-primary" />
                <span className="text-sm font-medium text-foreground">Prospects ({prospects.length})</span>
            </div>
            <div className="divide-y divide-border/30">
                {prospects.slice(0, 5).map((prospect, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-highlight/30 transition-colors">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/40 to-purple-500/40 flex items-center justify-center text-sm font-medium text-foreground">
                            {prospect.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-foreground truncate">{prospect.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{prospect.title} @ {prospect.company}</div>
                        </div>
                        {prospect.status && (
                            <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize",
                                statusColors[prospect.status] || 'bg-slate-500/20 text-slate-400'
                            )}>
                                {prospect.status}
                            </span>
                        )}
                    </div>
                ))}
                {prospects.length > 5 && (
                    <div className="px-4 py-2 text-xs text-muted-foreground text-center">
                        +{prospects.length - 5} more prospects
                    </div>
                )}
            </div>
        </div>
    );
}

// Campaign Stats Card Component
function CampaignStatsCard({ stats }: { stats: CampaignStatsData }) {
    return (
        <div className="my-3 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-purple-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={18} className="text-primary" />
                <span className="font-semibold text-foreground">{stats.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-surface/50 border border-border/30">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                        <Mail size={12} /> Sent
                    </div>
                    <div className="text-xl font-semibold text-foreground">{stats.sent}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-surface/50 border border-border/30">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                        <TrendingUp size={12} /> Replied
                    </div>
                    <div className="text-xl font-semibold text-green-400">{stats.replied}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-surface/50 border border-border/30">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                        <Calendar size={12} /> Meetings
                    </div>
                    <div className="text-xl font-semibold text-purple-400">{stats.meetings}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-surface/50 border border-border/30">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
                        <Target size={12} /> Response Rate
                    </div>
                    <div className="text-xl font-semibold text-primary">{stats.responseRate}</div>
                </div>
            </div>
        </div>
    );
}

// Action Buttons Card Component
function ActionButtonsCard({ actions }: { actions: ActionData[] }) {
    const variantStyles: Record<string, string> = {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-surface border border-border/60 text-foreground hover:bg-surface-highlight',
        danger: 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30',
    };

    return (
        <div className="my-3 flex flex-wrap gap-2">
            {actions.map((action, idx) => (
                <button
                    key={idx}
                    onClick={() => console.log('Action:', action.action)}
                    className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                        variantStyles[action.variant || 'secondary']
                    )}
                >
                    {action.variant === 'primary' && <CheckCircle size={14} />}
                    {action.variant === 'danger' && <XCircle size={14} />}
                    {action.label}
                    {action.variant === 'primary' && <ArrowRight size={14} />}
                </button>
            ))}
        </div>
    );
}

// Progress Card Component
function ProgressCard({ label, current, total, percentage }: { label: string; current: number; total: number; percentage: number }) {
    return (
        <div className="my-3 p-4 rounded-xl border border-border/60 bg-surface/50">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Clock size={14} className="text-primary" />
                    {label}
                </span>
                <span className="text-sm font-semibold text-primary">{percentage}%</span>
            </div>
            <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-primary to-purple-400 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <div className="text-xs text-muted-foreground mt-1.5">{current} of {total} completed</div>
        </div>
    );
}

// Main Renderer Component
export function RichMessageRenderer({ content }: { content: string }) {
    const elements = parseStructuredContent(content);

    return (
        <div className="text-base leading-relaxed">
            {elements}
        </div>
    );
}
