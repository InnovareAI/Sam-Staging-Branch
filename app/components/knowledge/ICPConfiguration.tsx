'use client';

import React, { useState } from 'react';
import { Target, Building2, Users, AlertCircle, GitBranch, MessageSquare, BarChart, Settings, ArrowLeft, Plus, Upload } from 'lucide-react';
import { ICPProfile, transformICPResponse } from './types';

export function ICPConfiguration({
    onBack,
    onProfilesUpdated,
    onRefresh
}: {
    onBack?: () => void;
    onProfilesUpdated?: (profiles: Record<string, ICPProfile>) => void;
    onRefresh?: () => void;
}) {
    const [selectedICP, setSelectedICP] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>('overview');
    const [icpProfiles, setIcpProfiles] = useState<Record<string, ICPProfile>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);

    const currentICP = selectedICP && icpProfiles[selectedICP] ? icpProfiles[selectedICP] : null;

    // Fetch ICP profiles on component mount
    React.useEffect(() => {
        const fetchICPProfiles = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('/api/knowledge-base/icps');
                if (response.ok) {
                    const payload = await response.json();
                    const entries = Array.isArray(payload?.icps) ? payload.icps : [];
                    const mapped = entries.reduce((acc: Record<string, ICPProfile>, item: Record<string, unknown>) => {
                        const profile = transformICPResponse(item);
                        acc[profile.id] = profile;
                        return acc;
                    }, {});

                    setIcpProfiles(mapped);
                    onProfilesUpdated?.(mapped);
                    onRefresh?.();

                    if (!selectedICP && Object.keys(mapped).length > 0) {
                        setSelectedICP(Object.keys(mapped)[0]);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch ICP profiles:', error);
                setIcpProfiles({});
            } finally {
                setIsLoading(false);
            }
        };

        fetchICPProfiles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCreateICP = () => {
        setShowCreateForm(true);
    };

    const handleCreateICPSubmit = async (icpName: string) => {
        try {
            const response = await fetch('/api/knowledge-base/icps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: icpName
                })
            });

            if (response.ok) {
                const payload = await response.json();
                const createdRaw = (payload?.icp ?? {}) as Record<string, unknown>;
                const createdProfile = transformICPResponse(createdRaw);

                setIcpProfiles(prev => {
                    const updated = { ...prev, [createdProfile.id]: createdProfile };
                    onProfilesUpdated?.(updated);
                    return updated;
                });
                onRefresh?.();
                setSelectedICP(createdProfile.id);
                setShowCreateForm(false);
            }
        } catch (error) {
            console.error('Failed to create ICP profile:', error);
        }
    };

    // Comprehensive ICP Categories
    const icpCategories = [
        { id: 'overview', label: 'Overview', icon: Target, description: 'ICP summary and key metrics' },
        { id: 'target_profile', label: 'Target Profile', icon: Building2, description: 'Company size, industry, geography, technology requirements' },
        { id: 'decision_makers', label: 'Decision Makers', icon: Users, description: 'Authority levels, influence patterns, stakeholder hierarchies' },
        { id: 'pain_points', label: 'Pain Points & Signals', icon: AlertCircle, description: 'Operational challenges, buying signals, growth pressures' },
        { id: 'buying_process', label: 'Buying Process', icon: GitBranch, description: 'Stakeholder analysis, approval workflows, evaluation stages' },
        { id: 'messaging', label: 'Messaging Strategy', icon: MessageSquare, description: 'Value propositions, competitive positioning, role-based communication' },
        { id: 'success_metrics', label: 'Success Metrics', icon: BarChart, description: 'Industry KPIs, ROI models, performance benchmarks' },
        { id: 'advanced', label: 'Advanced Classification', icon: Settings, description: 'Technology adoption, compliance, market trends, culture' }
    ];

    return (
        <div className="bg-surface-card rounded-xl p-6 border border-border/40">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="mr-4 p-2 text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded-lg transition-colors"
                            title="Back to Knowledgebase"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <h2 className="text-2xl font-semibold text-foreground flex items-center">
                        <Target className="mr-2 text-brand-primary" size={24} />
                        ICP Configuration
                    </h2>
                </div>
                <div className="flex space-x-2">
                    <button
                        onClick={handleCreateICP}
                        className="bg-brand-primary hover:bg-brand-primary/90 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center"
                    >
                        <Plus className="mr-1" size={16} />
                        New ICP
                    </button>
                    <button className="bg-surface-muted hover:bg-surface-hover text-foreground px-4 py-2 rounded-lg text-sm transition-colors flex items-center">
                        <Upload className="mr-1" size={16} />
                        Import
                    </button>
                </div>
            </div>

            {/* Create ICP Form Modal */}
            {showCreateForm && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-in fade-in">
                    <div className="bg-surface-card border border-border rounded-lg p-6 w-96 shadow-2xl">
                        <h3 className="text-xl font-semibold text-foreground mb-4">Create New ICP Profile</h3>
                        <input
                            type="text"
                            placeholder="Enter ICP profile name..."
                            className="w-full bg-surface-input border border-border px-3 py-2 rounded text-foreground placeholder-muted-foreground mb-4"
                            onKeyPress={(e) => {
                                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                    handleCreateICPSubmit(e.currentTarget.value.trim());
                                }
                            }}
                            autoFocus
                        />
                        <div className="flex space-x-2">
                            <button
                                onClick={() => {
                                    const input = document.querySelector('input[placeholder="Enter ICP profile name..."]') as HTMLInputElement;
                                    if (input?.value.trim()) {
                                        handleCreateICPSubmit(input.value.trim());
                                    }
                                }}
                                className="bg-brand-primary hover:bg-brand-primary/90 text-white px-4 py-2 rounded transition-colors"
                            >
                                Create
                            </button>
                            <button
                                onClick={() => setShowCreateForm(false)}
                                className="bg-surface-muted hover:bg-surface-hover text-foreground px-4 py-2 rounded transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Navigation - Always Show (Box Design) */}
            <div className="mb-6">
                {/* Loading indicator - small and non-blocking */}
                {isLoading && (
                    <div className="text-center mb-4">
                        <div className="text-muted-foreground text-sm">Loading ICP profiles...</div>
                    </div>
                )}

                {/* ICP Profile Selector - Only if profiles exist */}
                {Object.keys(icpProfiles).length > 0 && (
                    <div className="flex space-x-1 mb-4 bg-surface-muted rounded-lg p-1">
                        {Object.entries(icpProfiles).map(([key, profile]) => (
                            <button
                                key={key}
                                onClick={() => setSelectedICP(key)}
                                className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${selectedICP === key
                                        ? 'text-white bg-surface-hover shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {profile?.name || profile?.icp_name || 'Unnamed Profile'}
                            </button>
                        ))}
                    </div>
                )}

                {/* Category Navigation - Always Visible (Box Design) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
                    {icpCategories.map((category) => {
                        const IconComponent = category.icon;
                        return (
                            <button
                                key={category.id}
                                onClick={() => setActiveCategory(category.id)}
                                className={`p-3 rounded-lg text-left transition-all border ${activeCategory === category.id
                                        ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                                        : 'bg-surface-muted/30 border-transparent text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                                    }`}
                            >
                                <div className="flex items-center mb-2">
                                    <IconComponent size={16} className="mr-2" />
                                    <span className="text-sm font-medium">{category.label}</span>
                                </div>
                                <p className="text-xs opacity-70 line-clamp-2">{category.description}</p>
                            </button>
                        );
                    })}
                </div>

                {/* No Profiles Message - Only if no profiles */}
                {Object.keys(icpProfiles).length === 0 && (
                    <div className="bg-surface-muted/30 border border-border/60 rounded-lg p-8 mb-6 text-center">
                        <Target size={48} className="mx-auto text-muted-foreground/40 mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-2">No ICP Profiles Created Yet</h3>
                        <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                            Create your first ICP profile to define your ideal customers. Use the categories below to see the fields you'll be able to configure once you create a profile.
                        </p>
                        <button
                            onClick={handleCreateICP}
                            className="bg-brand-primary hover:bg-brand-primary/90 text-white px-5 py-2.5 rounded-lg text-sm transition-colors shadow-lg shadow-brand-primary/20"
                        >
                            <Plus className="mr-2 inline" size={18} />
                            Create Your First ICP Profile
                        </button>
                    </div>
                )}
            </div>

            {/* Category Content */}
            <div className="space-y-6">
                {/* Show content for current ICP if available, otherwise show structure */}
                {(currentICP || Object.keys(icpProfiles).length === 0) && (
                    <>
                        {activeCategory === 'overview' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* ICP Performance Card */}
                                <div className="bg-surface-muted/30 border border-border/60 rounded-lg p-4">
                                    <h3 className="text-foreground font-medium mb-3 flex items-center">
                                        <BarChart className="mr-2 text-brand-secondary" size={16} />
                                        Performance Metrics
                                    </h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Response Rate:</span>
                                            <span className="text-emerald-400 font-medium">8.5% ↗️</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Meeting Rate:</span>
                                            <span className="text-blue-400 font-medium">3.2% ↗️</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Conversion:</span>
                                            <span className="text-brand-primary font-medium">12% ↗️</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">ROI Score:</span>
                                            <span className="text-amber-400 font-medium">⭐⭐⭐⭐⭐</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Market Size Card */}
                                <div className="bg-surface-muted/30 border border-border/60 rounded-lg p-4">
                                    <h3 className="text-foreground font-medium mb-3 flex items-center">
                                        <Target className="mr-2 text-brand-secondary" size={16} />
                                        Market Opportunity
                                    </h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">TAM:</span>
                                            <span className="text-foreground">~45,000 companies</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">SAM:</span>
                                            <span className="text-foreground">~12,000 companies</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Confidence:</span>
                                            <span className="text-emerald-400">92%</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Last Updated:</span>
                                            <span className="text-muted-foreground/70">2 days ago</span>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        )}

                        {activeCategory === 'target_profile' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Company Demographics */}
                                <div className="bg-surface-muted/30 border border-border/60 rounded-lg p-4">
                                    <h3 className="text-foreground font-medium mb-4 flex items-center">
                                        <Building2 className="mr-2 text-brand-secondary" size={16} />
                                        Company Demographics
                                    </h3>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-muted-foreground text-sm font-medium block mb-1">Employee Count</label>
                                            <div className="flex flex-wrap gap-2">
                                                {['50-100', '100-500', '500-1000', '1000+'].map(range => (
                                                    <span key={range} className="bg-surface-muted text-foreground border border-border px-3 py-1 rounded-full text-xs">
                                                        {range}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-muted-foreground text-sm font-medium block mb-1">Revenue Range</label>
                                            <div className="flex flex-wrap gap-2">
                                                {['$10M-$50M', '$50M-$100M'].map(range => (
                                                    <span key={range} className="bg-surface-muted text-foreground border border-border px-3 py-1 rounded-full text-xs">
                                                        {range}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-muted-foreground text-sm font-medium block mb-1">Growth Stage</label>
                                            <div className="flex flex-wrap gap-2">
                                                {['Series A', 'Series B', 'Growth'].map(stage => (
                                                    <span key={stage} className="bg-brand-primary/20 text-brand-primary border border-brand-primary/30 px-3 py-1 rounded-full text-xs">
                                                        {stage}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
