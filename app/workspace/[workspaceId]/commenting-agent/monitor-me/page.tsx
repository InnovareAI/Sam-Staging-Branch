'use client';

import React, { useState, useEffect } from 'react';
import {
    User,
    MessageSquare,
    Heart,
    RefreshCw,
    ArrowRight,
    ExternalLink,
    Target,
    Clock,
    LayoutDashboard,
    ShieldCheck
} from 'lucide-react';
import { useParams } from 'next/navigation';

interface MyPost {
    social_id: string;
    content: string;
    posted_at: string;
    likes_count: number;
    comments_count: number;
    url: string;
}

export default function MyProfileMonitorPage() {
    const { workspaceId } = useParams();
    const [loading, setLoading] = useState(true);
    const [posts, setPosts] = useState<MyPost[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const loadPosts = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/linkedin-commenting/fetch-my-posts?workspace_id=${workspaceId}`);
            if (!res.ok) {
                throw new Error('Failed to fetch your posts');
            }
            const data = await res.json();
            setPosts(data.posts || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (workspaceId) {
            loadPosts();
        }
    }, [workspaceId]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadPosts();
        setRefreshing(false);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-pink-900/20 text-white">
                        <LayoutDashboard size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">My Profile Monitor</h1>
                        <p className="text-gray-400 text-sm">Monitor engagement on your own LinkedIn posts</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg border border-gray-700 transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Refreshing...' : 'Refresh Feed'}
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Recent Posts', value: posts.length, icon: Target, color: 'text-pink-400', bg: 'bg-pink-400/10' },
                    { label: 'Total Reactions', value: posts.reduce((acc, p) => acc + p.likes_count, 0), icon: Heart, color: 'text-red-400', bg: 'bg-red-400/10' },
                    { label: 'Comments Found', value: posts.reduce((acc, p) => acc + p.comments_count, 0), icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-400/10' },
                ].map((stat, i) => (
                    <div key={i} className="bg-gray-800/50 border border-gray-700 p-5 rounded-xl flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${stat.bg} ${stat.color}`}>
                            <stat.icon size={22} />
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{stat.label}</p>
                            <h3 className="text-2xl font-bold text-white mt-0.5">{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-xl">
                <div className="p-5 border-b border-gray-700 flex items-center justify-between bg-gray-800/50">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Clock size={18} className="text-pink-500" />
                        Recent Posts
                    </h2>
                    <span className="text-xs text-gray-500 font-medium px-2 py-1 bg-gray-900/50 rounded-full border border-gray-700">
                        Auto-Sync Active
                    </span>
                </div>

                {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center text-gray-500 space-y-4">
                        <RefreshCw className="w-10 h-10 animate-spin text-pink-500" />
                        <p className="text-lg animate-pulse">Syncing with LinkedIn...</p>
                    </div>
                ) : error ? (
                    <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-16 h-16 bg-red-900/20 text-red-400 rounded-full flex items-center justify-center mb-2">
                            <ShieldCheck size={32} />
                        </div>
                        <h3 className="text-xl font-semibold text-white">Connection Error</h3>
                        <p className="text-gray-400 max-w-sm">{error}</p>
                        <button
                            onClick={loadPosts}
                            className="mt-4 px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors border border-gray-600"
                        >
                            Try Again
                        </button>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="p-20 flex flex-col items-center justify-center text-gray-500 text-center space-y-4">
                        <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mb-2">
                            <User size={32} />
                        </div>
                        <h3 className="text-lg font-semibold text-white">No Recent Activity</h3>
                        <p className="text-sm max-w-xs">We couldn't find any recent posts on your LinkedIn profile. Post something new and refresh!</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-700">
                        {posts.map((post) => (
                            <div key={post.social_id} className="p-6 hover:bg-gray-700/30 transition-all group">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <Clock size={14} />
                                            {new Date(post.posted_at).toLocaleDateString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </div>
                                        <p className="text-gray-200 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                                            {post.content}
                                        </p>
                                        <div className="flex items-center gap-6 pt-2">
                                            <div className="flex items-center gap-1.5 text-gray-400 group-hover:text-red-400 transition-colors">
                                                <Heart size={16} />
                                                <span className="text-sm font-medium">{post.likes_count}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-gray-400 group-hover:text-blue-400 transition-colors">
                                                <MessageSquare size={16} />
                                                <span className="text-sm font-medium">{post.comments_count}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <a
                                            href={post.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 bg-gray-700 hover:bg-pink-600 text-gray-300 hover:text-white rounded-lg transition-all shadow-sm border border-gray-600"
                                            title="View on LinkedIn"
                                        >
                                            <ExternalLink size={18} />
                                        </a>
                                        <button
                                            className="p-2 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-all border border-gray-600 opacity-0 group-hover:opacity-100"
                                            title="Monitor Comments"
                                            onClick={() => alert('Future Feature: Auto-reply to comments on this post')}
                                        >
                                            <ArrowRight size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Help Note */}
            <div className="p-4 bg-pink-900/10 border border-pink-900/30 rounded-lg">
                <p className="text-xs text-pink-400 leading-relaxed">
                    <span className="font-bold">Note:</span> This section specifically monitors engagement on your personal profile. To monitor competitors 또는 company pages, use the "Monitored Profiles" section.
                </p>
            </div>
        </div>
    );
}
