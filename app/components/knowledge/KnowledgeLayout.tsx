'use client';

import React, { useState } from 'react';
import { LayoutDashboard, Package, Target, Users, BookOpen, Settings, Upload, Menu } from 'lucide-react';
import { KnowledgeFeed } from './KnowledgeFeed';
import { ICPConfiguration } from './ICPConfiguration';
import { DocumentUpload } from './DocumentUpload';
import { cn } from '@/lib/utils';
import { useSamContext } from '../chat/SamContextProvider'; // Assuming context is available or passing props

// Mock components for Products/Competitors for now
const ProductsView = () => (
    <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Products & Services</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-surface-card border border-border rounded-xl p-6 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
                    <Package className="text-blue-500" size={32} />
                </div>
                <h3 className="text-lg font-semibold mb-2">My Core Product</h3>
                <p className="text-sm text-muted-foreground mb-4">Main AI platform for sales automation.</p>
                <button className="text-sm text-brand-primary font-medium hover:underline">Edit Details</button>
            </div>
            <div className="bg-surface-muted/20 border border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-muted/30 transition-colors group">
                <div className="w-16 h-16 bg-surface-muted rounded-full flex items-center justify-center mb-4 group-hover:bg-brand-primary/10 transition-colors">
                    <Upload className="text-muted-foreground group-hover:text-brand-primary" size={24} />
                </div>
                <h3 className="text-base font-semibold text-muted-foreground group-hover:text-foreground">Add Product</h3>
            </div>
        </div>
    </div>
);

const CompetitorsView = () => (
    <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Competitors</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-surface-muted/20 border border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-muted/30 transition-colors group">
                <div className="w-16 h-16 bg-surface-muted rounded-full flex items-center justify-center mb-4 group-hover:bg-brand-primary/10 transition-colors">
                    <Upload className="text-muted-foreground group-hover:text-brand-primary" size={24} />
                </div>
                <h3 className="text-base font-semibold text-muted-foreground group-hover:text-foreground">Add Competitor</h3>
            </div>
        </div>
    </div>
);


export function KnowledgeLayout({ workspaceId }: { workspaceId?: string }) {
    const [activeTab, setActiveTab] = useState<'feed' | 'products' | 'competitors' | 'icp'>('feed');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const navItems = [
        { id: 'feed', label: 'Updates Feed', icon: LayoutDashboard },
        { id: 'products', label: 'Products', icon: Package },
        { id: 'competitors', label: 'Competitors', icon: Target },
        { id: 'icp', label: 'Ideal Customer Profile', icon: Users },
    ];

    return (
        <div className="flex h-[calc(100vh-120px)] bg-surface-muted/10 rounded-2xl overflow-hidden border border-border/40 shadow-xl">
            {/* Sidebar */}
            <div className={cn(
                "bg-surface-card border-r border-border/40 transition-all duration-300 flex flex-col z-10",
                isSidebarOpen ? "w-64" : "w-16"
            )}>
                <div className="p-4 flex items-center justify-between border-b border-border/40 h-16">
                    {isSidebarOpen && <span className="font-semibold text-lg tracking-tight">OneBase</span>}
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-1.5 rounded-md hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Menu size={18} />
                    </button>
                </div>

                <nav className="flex-1 p-3 space-y-1">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as any)}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                                activeTab === item.id
                                    ? "bg-brand-primary/10 text-brand-primary"
                                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                            )}
                            title={!isSidebarOpen ? item.label : undefined}
                        >
                            <item.icon size={20} className={cn(
                                activeTab === item.id ? "text-brand-primary" : "text-muted-foreground group-hover:text-foreground"
                            )} />
                            {isSidebarOpen && <span>{item.label}</span>}
                            {activeTab === item.id && isSidebarOpen && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                            )}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-border/40">
                    {isSidebarOpen ? (
                        <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-xl p-4 border border-white/5">
                            <h4 className="text-xs font-semibold text-white/80 mb-1">Knowledge Health</h4>
                            <div className="w-full bg-surface-muted/50 rounded-full h-1.5 mb-2 overflow-hidden">
                                <div className="bg-gradient-to-r from-brand-primary to-brand-secondary h-full w-[65%]" />
                            </div>
                            <p className="text-[10px] text-muted-foreground">65% optimized</p>
                        </div>
                    ) : (
                        <div className="flex justify-center">
                            <div className="w-8 h-8 rounded-full border-2 border-brand-primary/30 flex items-center justify-center">
                                <div className="text-[10px] font-bold text-brand-primary">65%</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto bg-surface-muted/5 relative">
                <div className="p-6 min-h-full">
                    {activeTab === 'feed' && <KnowledgeFeed workspaceId={workspaceId} />}
                    {activeTab === 'products' && <ProductsView />}
                    {activeTab === 'competitors' && <CompetitorsView />}
                    {activeTab === 'icp' && <ICPConfiguration />}
                </div>
            </div>
        </div>
    );
}
