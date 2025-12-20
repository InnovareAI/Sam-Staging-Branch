'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ConfirmModal } from '@/components/ui/CustomModal';
import {
    Building2,
    Plus,
    Search,
    MoreVertical,
    Play,
    Pause,
    Trash2,
    Edit,
    MessageSquare,
    Users,
    Clock,
    Loader2,
    ArrowLeft,
    ChevronDown,
    AlertCircle
} from 'lucide-react';
import CommentingCampaignModal from '@/app/components/CommentingCampaignModal';

interface Monitor {
    id: string;
    name: string;
    hashtags: string[];
    keywords: string[];
    status: 'active' | 'paused' | 'draft';
    created_at: string;
    posts_discovered?: number;
    comments_generated?: number;
    comments_posted?: number;
}

export default function CompaniesListPage() {
    const params = useParams();
    const router = useRouter();
    const workspaceId = params.workspaceId as string;

    const [loading, setLoading] = useState(true);
    const [monitors, setMonitors] = useState<Monitor[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Confirm modal state
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    useEffect(() => {
        loadMonitors();
    }, [workspaceId]);

    const loadMonitors = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/linkedin-commenting/monitors?workspace_id=${workspaceId}`);
            if (response.ok) {
                const data = await response.json();
                const allMonitors = data.monitors || [];
                // Filter for COMPANY monitors
                const companyMonitors = allMonitors.filter((m: Monitor) =>
                    m.hashtags && m.hashtags.some(h => h.startsWith('COMPANY:'))
                );
                setMonitors(companyMonitors);
            }
        } catch (error) {
            console.error('Failed to load company monitors:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (monitor: Monitor) => {
        setActionLoading(monitor.id);
        try {
            const newStatus = monitor.status === 'active' ? 'paused' : 'active';
            const response = await fetch(`/api/linkedin-commenting/monitors/${monitor.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                setMonitors(prev =>
                    prev.map(p => p.id === monitor.id ? { ...p, status: newStatus } : p)
                );
            }
        } catch (error) {
            console.error('Failed to update monitor:', error);
        } finally {
            setActionLoading(null);
            setOpenMenuId(null);
        }
    };

    const deleteMonitor = (monitorId: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Company Monitor',
            message: 'Are you sure you want to delete this monitor? This cannot be undone.',
            onConfirm: async () => {
                setActionLoading(monitorId);
                try {
                    const response = await fetch(`/api/linkedin-commenting/monitors/${monitorId}`, {
                        method: 'DELETE'
                    });

                    if (response.ok) {
                        setMonitors(prev => prev.filter(p => p.id !== monitorId));
                    }
                } catch (error) {
                    console.error('Failed to delete monitor:', error);
                } finally {
                    setActionLoading(null);
                    setOpenMenuId(null);
                }
            }
        });
    };

    const filteredMonitors = monitors.filter(monitor => {
        const matchesSearch = monitor.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            monitor.hashtags?.some(h => h.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || monitor.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getTargetDisplay = (monitor: Monitor): string => {
        const targets = monitor.hashtags
            ?.filter(h => h.startsWith('COMPANY:'))
            .map(h => h.replace('COMPANY:', ''));

        if (targets?.length > 0) {
            return targets.slice(0, 2).join(', ') + (targets.length > 2 ? ` +${targets.length - 2}` : '');
        }
        return 'No companies';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 size={32} className="animate-spin text-pink-500" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent`)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={20} className="text-gray-400" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Building2 className="text-blue-500" />
                            Monitored Companies
                        </h1>
                        <p className="text-gray-400 text-sm">{monitors.length} company campaigns</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-medium transition-colors"
                >
                    <Plus size={18} />
                    Add Company Campaign
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search company monitors..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                </div>
                <div className="relative">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="appearance-none px-4 py-2.5 pr-10 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 cursor-pointer"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
            </div>

            {/* Monitors List */}
            {filteredMonitors.length === 0 ? (
                <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
                    <Building2 size={48} className="mx-auto text-gray-600 mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">
                        {searchQuery || statusFilter !== 'all' ? 'No company monitors found' : 'No company monitors yet'}
                    </h3>
                    <p className="text-gray-400 mb-6">
                        {searchQuery || statusFilter !== 'all'
                            ? 'Try adjusting your search or filters'
                            : 'Add LinkedIn company pages to start monitoring their posts'}
                    </p>
                    {!searchQuery && statusFilter === 'all' && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-medium transition-colors"
                        >
                            <Plus size={18} />
                            Add Your First Company
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredMonitors.map((monitor) => (
                        <div
                            key={monitor.id}
                            onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/monitor/${monitor.id}`)}
                            className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-blue-500/50 hover:bg-gray-800/80 transition-all cursor-pointer group"
                        >
                            <div className="flex items-center justify-between">
                                {/* Info */}
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${monitor.status === 'active' ? 'bg-green-600/20' : 'bg-gray-700'
                                        }`}>
                                        <Building2 size={24} className={monitor.status === 'active' ? 'text-green-400' : 'text-gray-500'} />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-white font-semibold truncate group-hover:text-blue-400 transition-colors">{monitor.name || 'Unnamed Campaign'}</h3>
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${monitor.status === 'active'
                                                    ? 'bg-green-600/20 text-green-400'
                                                    : 'bg-gray-600/20 text-gray-400'
                                                }`}>
                                                {monitor.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-400">
                                            <span className="flex items-center gap-1">
                                                <Users size={14} />
                                                {getTargetDisplay(monitor)}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock size={14} />
                                                {new Date(monitor.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="hidden md:flex items-center gap-6 mx-6">
                                    <div className="text-center">
                                        <p className="text-xl font-semibold text-white">{monitor.posts_discovered || 0}</p>
                                        <p className="text-xs text-gray-500">Posts Found</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xl font-semibold text-white">{monitor.comments_generated || 0}</p>
                                        <p className="text-xs text-gray-500">Generated</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xl font-semibold text-white">{monitor.comments_posted || 0}</p>
                                        <p className="text-xs text-gray-500">Posted</p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => toggleStatus(monitor)}
                                        disabled={actionLoading === monitor.id}
                                        className={`p-2 rounded-lg transition-colors ${monitor.status === 'active'
                                                ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-400'
                                                : 'bg-green-600/20 hover:bg-green-600/30 text-green-400'
                                            } disabled:opacity-50`}
                                        title={monitor.status === 'active' ? 'Pause monitoring' : 'Resume monitoring'}
                                    >
                                        {actionLoading === monitor.id ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : monitor.status === 'active' ? (
                                            <Pause size={18} />
                                        ) : (
                                            <Play size={18} />
                                        )}
                                    </button>

                                    <div className="relative">
                                        <button
                                            onClick={() => setOpenMenuId(openMenuId === monitor.id ? null : monitor.id)}
                                            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                                        >
                                            <MoreVertical size={18} className="text-gray-400" />
                                        </button>

                                        {openMenuId === monitor.id && (
                                            <>
                                                <div
                                                    className="fixed inset-0 z-10"
                                                    onClick={() => setOpenMenuId(null)}
                                                />
                                                <div className="absolute right-0 top-full mt-1 w-48 bg-gray-700 rounded-lg shadow-xl border border-gray-600 py-1 z-20">
                                                    <button
                                                        onClick={() => {
                                                            setEditingMonitor(monitor);
                                                            setShowCreateModal(true);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="w-full px-4 py-2 text-left text-gray-200 hover:bg-gray-600 flex items-center gap-2"
                                                    >
                                                        <Edit size={16} />
                                                        Edit Campaign
                                                    </button>
                                                    <button
                                                        onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/approve?profile=${monitor.id}`)}
                                                        className="w-full px-4 py-2 text-left text-gray-200 hover:bg-gray-600 flex items-center gap-2"
                                                    >
                                                        <MessageSquare size={16} />
                                                        View Comments
                                                    </button>
                                                    <hr className="my-1 border-gray-600" />
                                                    <button
                                                        onClick={() => deleteMonitor(monitor.id)}
                                                        className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-600 flex items-center gap-2"
                                                    >
                                                        <Trash2 size={16} />
                                                        Delete Campaign
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Info Banner */}
            <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                <div className="flex items-start gap-3">
                    <AlertCircle size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-blue-200 font-medium">Company Monitoring Tips</p>
                        <ul className="text-blue-200/70 text-sm mt-1 space-y-1">
                            <li>Add competitors or partners to engage with their updates</li>
                            <li>Use the full company URL or handle (e.g., linkedin.com/company/microsoft)</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {showCreateModal && (
                <CommentingCampaignModal
                    isOpen={showCreateModal}
                    onClose={() => {
                        setShowCreateModal(false);
                        setEditingMonitor(null);
                        loadMonitors();
                    }}
                    workspaceId={workspaceId}
                    editMode={!!editingMonitor}
                    existingMonitor={editingMonitor || undefined}
                    defaultTab="companies"
                />
            )}

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText="Delete"
                confirmVariant="danger"
            />
        </div>
    );
}
