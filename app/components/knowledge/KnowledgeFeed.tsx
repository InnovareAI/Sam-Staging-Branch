'use client';

import React, { useState, useEffect } from 'react';
import { Brain, FileText, Target, Clock, MessageSquare, ArrowRight, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type MemoryItem = {
    id: string;
    category: string;
    content: any;
    confidence: number;
    created_at: string;
};

type RecentUpload = {
    id: string;
    title: string;
    section: string;
    created_at: string;
};

export function KnowledgeFeed({ workspaceId }: { workspaceId?: string }) {
    const [memories, setMemories] = useState<MemoryItem[]>([]);
    const [uploads, setUploads] = useState<RecentUpload[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!workspaceId) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch Sam's Memories
                const memoryResponse = await fetch(`/api/sam/extract-knowledge?limit=10`);
                if (memoryResponse.ok) {
                    const data = await memoryResponse.json();
                    setMemories(data.knowledge || []);
                }

                // Fetch Recent Uploads (Mocked for now as endpoint needs to be verified)
                // In a real scenario, we'd hit /api/knowledge-base/recent
                setUploads([
                    { id: '1', title: 'Q3 Sales Deck.pdf', section: 'products', created_at: new Date().toISOString() },
                    { id: '2', title: 'Competitor Analysis - Acme Corp', section: 'competitors', created_at: new Date(Date.now() - 86400000).toISOString() }
                ]);

            } catch (error) {
                console.error('Failed to load knowledge feed:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [workspaceId]);

    const getIconForCategory = (category: string) => {
        switch (category.toLowerCase()) {
            case 'products': return <FileText size={16} className="text-blue-400" />;
            case 'competitors': return <Target size={16} className="text-red-400" />;
            case 'icp': return <Target size={16} className="text-purple-400" />;
            default: return <Brain size={16} className="text-emerald-400" />;
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Main Feed: Sam's Memory */}
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-surface-card border border-border/40 rounded-xl p-6 h-full overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-brand-primary/10 rounded-lg">
                                <Brain className="text-brand-primary" size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-foreground">Sam's Memory</h2>
                                <p className="text-sm text-muted-foreground">Real-time facts Sam has learned from conversation</p>
                            </div>
                        </div>
                        <button className="text-xs font-medium text-brand-primary hover:text-brand-primary/80 flex items-center gap-1">
                            View All <ArrowRight size={14} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                        {isLoading ? (
                            <div className="text-center py-10 text-muted-foreground">Loading memories...</div>
                        ) : memories.length === 0 ? (
                            <div className="text-center py-10 bg-surface-muted/20 rounded-lg border border-dashed border-border/50">
                                <Sparkles className="mx-auto mb-3 text-muted-foreground/50" size={32} />
                                <p className="text-muted-foreground">Sam hasn't learned any specific facts yet.</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Chat with Sam to teach him about your business.</p>
                            </div>
                        ) : (
                            memories.map((item) => (
                                <div key={item.id} className="group p-4 bg-surface-muted/30 border border-border/40 rounded-lg hover:bg-surface-muted/50 transition-all hover:border-brand-primary/30 hover:shadow-sm">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1 p-1.5 bg-surface-card rounded-md border border-border/50 text-muted-foreground group-hover:text-brand-primary group-hover:border-brand-primary/30 transition-colors">
                                                {getIconForCategory(item.category)}
                                            </div>
                                            <div>
                                                <p className="text-sm text-foreground font-medium mb-1">
                                                    {typeof item.content === 'object' ? JSON.stringify(item.content) : item.content}
                                                </p>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-muted-foreground/70 bg-surface-muted px-2 py-0.5 rounded-full border border-border/30">
                                                        {item.category}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
                                                        <Clock size={10} />
                                                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-card rounded-md">
                                                <MessageSquare size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Sidebar: Recent Activity & Uploads */}
            <div className="space-y-6">

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-surface-card border border-border/40 p-4 rounded-xl">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Total Facts</p>
                        <p className="text-2xl font-bold text-foreground">{memories.length}</p>
                    </div>
                    <div className="bg-surface-card border border-border/40 p-4 rounded-xl">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Documents</p>
                        <p className="text-2xl font-bold text-foreground">{uploads.length + 12}</p>
                    </div>
                </div>

                {/* Recent Uploads */}
                <div className="bg-surface-card border border-border/40 rounded-xl p-5 h-fit">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                            <FileText size={18} className="text-brand-secondary" />
                            Recent Uploads
                        </h3>
                    </div>
                    <div className="space-y-3">
                        {uploads.map((file) => (
                            <div key={file.id} className="flex items-center justify-between p-3 bg-surface-muted/30 rounded-lg border border-border/30 hover:bg-surface-muted/50 transition-colors cursor-pointer group">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="p-1.5 bg-surface-card rounded-md text-blue-400">
                                        <FileText size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate group-hover:text-brand-primary transition-colors">{file.title}</p>
                                        <p className="text-xs text-muted-foreground capitalize">{file.section}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">
                                    {formatDistanceToNow(new Date(file.created_at))}
                                </span>
                            </div>
                        ))}
                        <button className="w-full mt-2 py-2 text-xs font-medium text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg hover:bg-surface-muted transition-all">
                            + Upload New Document
                        </button>
                    </div>
                </div>

                {/* System Status */}
                <div className="bg-gradient-to-br from-brand-primary/10 to-brand-secondary/5 border border-brand-primary/20 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                        <p className="text-sm font-medium text-foreground">Knowledge System Active</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Sam is actively learning from conversations and documents.
                        Last sync: <span className="text-foreground">Just now</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
