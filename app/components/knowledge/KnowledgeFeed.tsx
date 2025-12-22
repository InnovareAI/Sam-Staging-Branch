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

export function KnowledgeFeed({ workspaceId, userId }: { workspaceId?: string; userId?: string }) {
    const [memories, setMemories] = useState<MemoryItem[]>([]);
    const [uploads, setUploads] = useState<RecentUpload[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!workspaceId) {
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch Sam's Memories
                const memoryResponse = await fetch(`/api/sam/extract-knowledge?limit=10${userId ? `&user_id=${userId}` : ''}`);
                if (memoryResponse.ok) {
                    const data = await memoryResponse.json();
                    setMemories(data.knowledge || []);
                }

                // Fetch Recent Uploads
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
            case 'products': return <Package size={16} className="text-brand-primary" />;
            case 'competitors': return <Target size={16} className="text-brand-secondary" />;
            case 'icp': return <Users size={16} className="text-purple-400" />;
            default: return <Brain size={16} className="text-brand-primary" />;
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
            {/* Main Feed: Sam's Memory */}
            <div className="lg:col-span-8 space-y-6">
                <div className="bg-surface-card border border-border rounded-2xl p-8 h-full flex flex-col shadow-sm relative overflow-hidden group/card">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />

                    <div className="flex items-center justify-between mb-8 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-brand-primary/10 rounded-xl shadow-inner">
                                <Brain className="text-brand-primary" size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-foreground tracking-tight">Sam's Memory</h2>
                                <p className="text-sm text-muted-foreground font-medium">Real-time facts learned from engagement</p>
                            </div>
                        </div>
                        <button className="px-4 py-2 bg-surface-muted/50 hover:bg-surface-muted border border-border rounded-xl text-xs font-bold text-foreground transition-all active:scale-95 flex items-center gap-2 group">
                            Full Log <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar relative z-10">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                                <div className="w-10 h-10 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin" />
                                <span className="text-sm font-semibold tracking-wide">Synthesizing memories...</span>
                            </div>
                        ) : memories.length === 0 ? (
                            <div className="text-center py-20 bg-surface-muted/20 rounded-2xl border border-dashed border-border/60">
                                <Sparkles className="mx-auto mb-4 text-brand-primary/30" size={40} />
                                <p className="text-foreground font-bold text-lg">Knowledge Void</p>
                                <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">Engage with Sam to build a repository of business insights.</p>
                            </div>
                        ) : (
                            memories.map((item) => (
                                <div key={item.id} className="group p-5 bg-surface-card border border-border/80 rounded-2xl hover:border-brand-primary/40 hover:bg-surface-hover/50 transition-all duration-300 shadow-sm hover:shadow-md">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="mt-1 p-2 bg-surface-muted/50 rounded-lg border border-border group-hover:bg-brand-primary/5 group-hover:border-brand-primary/20 transition-all">
                                                {getIconForCategory(item.category)}
                                            </div>
                                            <div>
                                                <p className="text-md text-foreground font-semibold leading-snug mb-2">
                                                    {typeof item.content === 'object' ? JSON.stringify(item.content) : item.content}
                                                </p>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand-primary/80 bg-brand-primary/5 px-2.5 py-1 rounded-md border border-brand-primary/10">
                                                        {item.category}
                                                    </span>
                                                    <span className="text-[11px] text-muted-foreground/80 font-medium flex items-center gap-1.5">
                                                        <Clock size={12} className="text-muted-foreground/40" />
                                                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <button className="p-2 text-muted-foreground/40 hover:text-brand-primary hover:bg-brand-primary/5 rounded-xl transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100">
                                            <MessageSquare size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Sidebar: Recent Activity & Uploads */}
            <div className="lg:col-span-4 space-y-6">
                {/* Stats Container - Boxed CTA Style */}
                <div className="grid grid-cols-1 gap-4">
                    <div className="bg-brand-primary/5 border border-brand-primary/20 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                        <div className="flex items-center justify-between mb-2">
                            <Brain size={20} className="text-brand-primary opacity-60 group-hover:scale-110 transition-transform" />
                            <span className="text-[11px] font-bold text-brand-primary uppercase tracking-widest px-2 py-0.5 bg-brand-primary/10 rounded">Global</span>
                        </div>
                        <p className="text-3xl font-black text-foreground">{memories.length}</p>
                        <p className="text-sm font-bold text-muted-foreground mt-1 tracking-tight">Active Inferences</p>
                    </div>
                </div>

                {/* Upload Board */}
                <div className="bg-surface-card border border-border rounded-2xl p-6 shadow-sm overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-lg text-foreground flex items-center gap-3">
                            <FileText size={20} className="text-brand-secondary" />
                            Resources
                        </h3>
                    </div>

                    <div className="space-y-3 mb-6">
                        {uploads.map((file) => (
                            <div key={file.id} className="flex items-center justify-between p-4 bg-surface-muted/30 rounded-xl border border-border/50 hover:bg-surface-muted/60 transition-all cursor-pointer group/item">
                                <div className="flex items-center gap-4 overflow-hidden">
                                    <div className="p-2 bg-surface-card rounded-lg text-brand-primary shadow-sm border border-border group-hover/item:border-brand-primary/30 transition-colors">
                                        <FileText size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-foreground truncate group-hover/item:text-brand-primary transition-colors">{file.title}</p>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider opacity-60">{file.section}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-muted-foreground/40 whitespace-nowrap">
                                    {formatDistanceToNow(new Date(file.created_at))}
                                </span>
                            </div>
                        ))}
                    </div>

                    <button className="w-full py-4 bg-brand-primary text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/20 hover:shadow-xl hover:shadow-brand-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        <Upload size={14} /> Add Resource
                    </button>
                </div>

                {/* System Status - Chat Box Style */}
                <div className="bg-surface-muted/40 border border-border rounded-2xl p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-3 w-3 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </div>
                        <p className="text-sm font-bold text-foreground">Sync Engine Active</p>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                        Last integrity check <span className="text-foreground animate-pulse font-bold">Just now</span>.
                    </p>
                </div>
            </div>
        </div>
    );
}
