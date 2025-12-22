'use client';

import React, { useState } from 'react';
import { LayoutDashboard, Package, Target, Users, BookOpen, Settings, Upload, Menu, Sparkles } from 'lucide-react';
import { KnowledgeFeed } from './KnowledgeFeed';
import { ICPConfiguration } from './ICPConfiguration';
import { DocumentUpload } from './DocumentUpload';
import { cn } from '@/lib/utils';

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


export function KnowledgeLayout({ workspaceId, userId }: { workspaceId?: string; userId?: string }) {
    const [activeTab, setActiveTab] = useState<'feed' | 'products' | 'competitors' | 'icp'>('feed');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const navItems = [
        { id: 'feed', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'products', label: 'Products & Services', icon: Package },
        { id: 'competitors', label: 'Market Competitors', icon: Target },
        { id: 'icp', label: 'Target Profiles', icon: Users },
    ];

    return (
        <div className="flex h-[calc(100vh-120px)] bg-background rounded-2xl overflow-hidden border border-border shadow-2xl">
            {/* Sidebar */}
            <aside className={cn(
                "bg-surface-card border-r border-border transition-all duration-300 flex flex-col z-10",
                isSidebarOpen ? "w-64" : "w-16"
            )}>
                <div className="p-4 flex items-center justify-between border-b border-border h-16">
                    {isSidebarOpen && (
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                                <BookOpen className="text-brand-primary" size={18} />
                            </div>
                            <span className="font-bold text-lg tracking-tight text-foreground">OneBase</span>
                        </div>
                    )}
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 rounded-lg hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-all active:scale-95"
                    >
                        <Menu size={20} />
                    </button>
                </div>

                <nav className="flex-1 p-3 space-y-1.5 mt-2">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as any)}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative",
                                activeTab === item.id
                                    ? "bg-brand-primary/5 text-brand-primary shadow-sm border border-brand-primary/10"
                                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground border border-transparent"
                            )}
                            title={!isSidebarOpen ? item.label : undefined}
                        >
                            <item.icon size={20} className={cn(
                                "transition-transform group-hover:scale-110",
                                activeTab === item.id ? "text-brand-primary" : "text-muted-foreground group-hover:text-foreground"
                            )} />
                            {isSidebarOpen && <span>{item.label}</span>}
                            {activeTab === item.id && isSidebarOpen && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-primary" />
                            )}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-border">
                    {isSidebarOpen ? (
                        <div className="bg-surface-muted/30 rounded-2xl p-4 border border-border/50">
                            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Knowledge Health</h4>
                            <div className="w-full bg-surface-muted rounded-full h-2 mb-2 overflow-hidden border border-border/20">
                                <div className="bg-gradient-to-r from-brand-primary to-brand-secondary h-full w-[65%] transition-all duration-1000" />
                            </div>
                            <div className="flex justify-between items-center">
                                <p className="text-[10px] text-muted-foreground font-medium">65% optimized</p>
                                <Sparkles className="text-brand-primary/40" size={12} />
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-center">
                            <div className="w-10 h-10 rounded-xl border border-brand-primary/20 flex items-center justify-center bg-brand-primary/5">
                                <div className="text-[11px] font-bold text-brand-primary">65%</div>
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto bg-surface-muted/5 relative">
                <div className="p-8 max-w-7xl mx-auto h-full">
                    {activeTab === 'feed' && <KnowledgeFeed workspaceId={workspaceId} userId={userId} />}
                    {activeTab === 'products' && <ProductsView />}
                    {activeTab === 'competitors' && <CompetitorsView />}
                    {activeTab === 'icp' && <ICPConfiguration />}
                </div>
            </main>
        </div>
    );
}
