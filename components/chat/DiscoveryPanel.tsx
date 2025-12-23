'use client';

import React, { useState, useRef } from 'react';
import {
    Users, Building2, Upload, Sparkles, Globe,
    ChevronRight, Filter, Settings2, Link as LinkIcon,
    CheckCircle, Search, Loader2
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toastSuccess, toastError } from '@/lib/toast';

export function DiscoveryPanel() {
    const [searchMode, setSearchMode] = useState<'people' | 'companies' | 'nested' | 'import'>('people');

    // Joint / Mode States
    const [companyUrl, setCompanyUrl] = useState('');
    const [companyKeywords, setCompanyKeywords] = useState('');
    const [companyIndustry, setCompanyIndustry] = useState('');
    const [companySize, setCompanySize] = useState('');
    const [companyType, setCompanyType] = useState('any');

    const [personaTitle, setPersonaTitle] = useState('');
    const [personaKeywords, setPersonaKeywords] = useState('');
    const [personaSeniority, setPersonaSeniority] = useState('');
    const [location, setLocation] = useState('');

    const [discoveryLimit, setDiscoveryLimit] = useState(25);
    const [connectionDegree, setConnectionDegree] = useState('2nd');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const queryClient = useQueryClient();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
    };

    // Mutation for "Nested Discovery" (Company -> Decision Makers)
    const nestedDiscoveryMutation = useMutation({
        mutationFn: async (params: any) => {
            const response = await fetch('/api/linkedin/discover-decision-makers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });
            if (!response.ok) throw new Error('Discovery failed');
            return response.json();
        },
        onSuccess: (data) => {
            toastSuccess(`🎯 Discovery Complete! Found ${data.prospect_count} prospects.`);
            queryClient.invalidateQueries(['approval-sessions']);
        },
        onError: (error) => {
            console.error('Discovery error:', error);
            toastError('Discovery failed. Please try again.');
        },
        onSettled: () => setIsLoading(false)
    });

    // Mutation for Standard Searches (People / Companies / URL)
    const searchJobMutation = useMutation({
        mutationFn: async (params: any) => {
            const response = await fetch('/api/linkedin/search/create-job', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });
            if (!response.ok) throw new Error('Search job failed');
            return response.json();
        },
        onSuccess: (data) => {
            toastSuccess(`🚀 Search Queued! Job ID: ${data.job_id.substring(0, 8)}`);
            queryClient.invalidateQueries(['approval-sessions']);
        },
        onError: (error) => {
            console.error('Search job error:', error);
            toastError('Failed to start search. Please try again.');
        },
        onSettled: () => setIsLoading(false)
    });

    const handleDiscoverySubmit = () => {
        if ((!companyKeywords && !companyUrl) || !personaTitle) return;
        setIsLoading(true);
        nestedDiscoveryMutation.mutate({
            company_filters: companyUrl ? { url: companyUrl } : { keywords: companyKeywords, industry: companyIndustry, company_headcount: companySize ? [companySize] : undefined },
            persona_filters: { title: personaTitle, seniority_level: personaSeniority ? [personaSeniority] : undefined },
            max_companies: discoveryLimit,
            campaign_name: `Discovery: ${companyUrl ? 'URL Search' : companyKeywords} - ${personaTitle}`
        });
    };

    const handleStandardSearch = (category: 'people' | 'companies') => {
        if (category === 'people' && !personaTitle && !personaKeywords) return;
        if (category === 'companies' && !companyKeywords) return;

        setIsLoading(true);
        searchJobMutation.mutate({
            category,
            search_criteria: category === 'people' ? {
                title: personaTitle,
                keywords: personaKeywords,
                location: location,
                network_distance: [connectionDegree === '1st' ? 1 : connectionDegree === '2nd' ? 2 : 3],
                seniority_level: personaSeniority ? [personaSeniority] : undefined
            } : {
                keywords: companyKeywords,
                industry: [companyIndustry].filter(Boolean),
                company_headcount: companySize ? [companySize] : undefined,
                company_type: companyType !== 'any' ? [companyType] : undefined
            },
            target_count: discoveryLimit
        });
    };

    const handleUrlImport = () => {
        if (!companyUrl) return;
        setIsLoading(true);
        searchJobMutation.mutate({
            url: companyUrl,
            target_count: discoveryLimit
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 px-1 pb-4">
            {/* Mode Selector */}
            <div className="flex bg-surface/50 p-1 rounded-xl border border-border/40">
                {(['people', 'companies', 'nested', 'import'] as const).map((mode) => (
                    <button
                        key={mode}
                        onClick={() => setSearchMode(mode)}
                        className={`flex-1 px-2 py-1.5 text-[10px] font-bold rounded-lg transition-all capitalize ${searchMode === mode ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        {mode}
                    </button>
                ))}
            </div>

            <Separator className="bg-border/40" />

            {/* People Search Mode */}
            {searchMode === 'people' && (
                <div className="space-y-4">
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            <Users size={12} className="text-purple-400" /> People Filters
                        </label>
                        <div className="space-y-2">
                            <Input
                                value={personaTitle}
                                onChange={(e) => setPersonaTitle(e.target.value)}
                                placeholder="Job Title (e.g. CEO, VP Sales)"
                                className="bg-background border-border/60 h-9 text-xs"
                            />
                            <Input
                                value={personaKeywords}
                                placeholder="Skills / Keywords"
                                className="bg-background border-border/60 h-9 text-xs"
                            />
                            <Input
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="Location (e.g. London, NY)"
                                className="bg-background border-border/60 h-9 text-xs"
                            />

                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline"
                            >
                                <Settings2 size={12} />
                                {showAdvanced ? "Hide Advanced Filters" : "Show Advanced Filters"}
                            </button>

                            {showAdvanced && (
                                <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1">
                                    <Select value={personaSeniority} onValueChange={setPersonaSeniority}>
                                        <SelectTrigger className="bg-background border-border/60 h-9 text-xs">
                                            <SelectValue placeholder="Seniority" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CXO">C-Level</SelectItem>
                                            <SelectItem value="VP">VP</SelectItem>
                                            <SelectItem value="Director">Director</SelectItem>
                                            <SelectItem value="Manager">Manager</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={connectionDegree} onValueChange={setConnectionDegree}>
                                        <SelectTrigger className="bg-background border-border/60 h-9 text-xs">
                                            <SelectValue placeholder="Connection" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1st">1st Degree</SelectItem>
                                            <SelectItem value="2nd">2nd Degree</SelectItem>
                                            <SelectItem value="3rd">3rd Degree</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    </div>
                    <Button
                        className="w-full text-xs font-bold h-10 shadow-lg"
                        onClick={() => handleStandardSearch('people')}
                        disabled={isLoading || (!personaTitle && !personaKeywords)}
                    >
                        {isLoading ? <Loader2 className="animate-spin mr-2" size={14} /> : <Search size={14} className="mr-2" />}
                        Run People Search
                    </Button>
                </div>
            )}

            {/* Companies Search Mode */}
            {searchMode === 'companies' && (
                <div className="space-y-4">
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            <Building2 size={12} className="text-blue-400" /> Company Filters
                        </label>
                        <div className="space-y-2">
                            <Input
                                value={companyKeywords}
                                onChange={(e) => setCompanyKeywords(e.target.value)}
                                placeholder="Company Name / Keywords"
                                className="bg-background border-border/60 h-9 text-xs"
                            />
                            <Input
                                value={companyIndustry}
                                onChange={(e) => setCompanyIndustry(e.target.value)}
                                placeholder="Industry (e.g. Fintech)"
                                className="bg-background border-border/60 h-9 text-xs"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <Select value={companySize} onValueChange={setCompanySize}>
                                    <SelectTrigger className="bg-background border-border/60 h-9 text-xs">
                                        <SelectValue placeholder="Size" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="B">11-50</SelectItem>
                                        <SelectItem value="C">51-200</SelectItem>
                                        <SelectItem value="D">201-500</SelectItem>
                                        <SelectItem value="E">501-1k</SelectItem>
                                        <SelectItem value="F">1k+</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={companyType} onValueChange={setCompanyType}>
                                    <SelectTrigger className="bg-background border-border/60 h-9 text-xs">
                                        <SelectValue placeholder="Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="any">Any Type</SelectItem>
                                        <SelectItem value="C">Public</SelectItem>
                                        <SelectItem value="D">Private</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <Button
                        className="w-full text-xs font-bold h-10 shadow-lg bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleStandardSearch('companies')}
                        disabled={isLoading || !companyKeywords}
                    >
                        {isLoading ? <Loader2 className="animate-spin mr-2" size={14} /> : <Building2 size={14} className="mr-2" />}
                        Search Companies
                    </Button>
                </div>
            )}

            {/* Nested Mode */}
            {searchMode === 'nested' && (
                <div className="space-y-4">
                    <div className="p-3 bg-primary/10 rounded-lg border border-primary/20 flex gap-2">
                        <Sparkles className="text-primary shrink-0" size={14} />
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                            SAM identifies organizations, then finds decision-makers within them.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Step 1: Companies</label>
                        <Input
                            value={companyUrl}
                            onChange={(e) => setCompanyUrl(e.target.value)}
                            placeholder="LinkedIn Company Search URL..."
                            className="bg-background border-border/60 h-8 text-xs"
                        />
                        <Input
                            value={companyKeywords}
                            onChange={(e) => setCompanyKeywords(e.target.value)}
                            disabled={!!companyUrl}
                            placeholder="Or keywords (e.g. Fintech)"
                            className="bg-background border-border/60 h-8 text-xs"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Step 2: Personas</label>
                        <Input
                            value={personaTitle}
                            onChange={(e) => setPersonaTitle(e.target.value)}
                            placeholder="e.g. CEO, Founder"
                            className="bg-background border-border/60 h-8 text-xs"
                        />
                        <Select value={personaSeniority} onValueChange={setPersonaSeniority}>
                            <SelectTrigger className="bg-background border-border/60 h-8 text-xs">
                                <SelectValue placeholder="Seniority" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CXO">C-Level</SelectItem>
                                <SelectItem value="VP">VP</SelectItem>
                                <SelectItem value="Director">Director</SelectItem>
                                <SelectItem value="Manager">Manager</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button
                        className="w-full text-xs font-bold h-10 bg-amber-600 hover:bg-amber-700 shadow-md"
                        onClick={handleDiscoverySubmit}
                        disabled={isLoading || ((!companyKeywords && !companyUrl) || !personaTitle)}
                    >
                        {isLoading ? <Loader2 className="animate-spin mr-2" size={14} /> : <Sparkles size={14} className="mr-2" />}
                        Run Deep Discovery
                    </Button>
                </div>
            )}

            {/* Import / URL Mode */}
            {searchMode === 'import' && (
                <div className="space-y-4">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <Upload size={12} className="text-green-400" /> Bulk Import & URL
                    </label>

                    {/* LinkedIn URL Section */}
                    <div className="space-y-2 pb-2">
                        <Input
                            value={companyUrl}
                            onChange={(e) => setCompanyUrl(e.target.value)}
                            placeholder="Paste LinkedIn Search URL..."
                            className="bg-background border-border/60 h-9 text-xs"
                        />
                        <Button
                            className="w-full bg-blue-600 hover:bg-blue-700 text-xs font-bold h-9 rounded-lg"
                            onClick={handleUrlImport}
                            disabled={isLoading || !companyUrl}
                        >
                            {isLoading ? <Loader2 className="animate-spin mr-2" size={14} /> : <LinkIcon size={14} className="mr-2" />}
                            Import from URL
                        </Button>
                    </div>

                    <Separator className="bg-border/40" />

                    <div className="grid grid-cols-1 gap-3 p-3 bg-surface/30 rounded-xl border border-border/40 mt-2">
                        <div className="text-[10px] text-muted-foreground italic mb-1">CSV Bulk Upload</div>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex flex-col items-center justify-center p-4 bg-background border border-border/60 border-dashed rounded-lg hover:border-green-500/50 transition-all group"
                        >
                            <Upload size={24} className="text-muted-foreground mb-1 group-hover:text-green-400" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Upload .CSV</span>
                        </button>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="hidden"
                    />

                    {selectedFile && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <CheckCircle className="text-green-400 shrink-0" size={14} />
                                <span className="text-xs truncate">{selectedFile.name}</span>
                            </div>
                            <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-[10px] h-7 px-3"
                                onClick={() => {
                                    toastSuccess(`Processed ${selectedFile.name}`);
                                    setSelectedFile(null);
                                }}
                            >
                                Process
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Global Settings / Limit */}
            <div className="pt-4 border-t border-border/40">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <Settings2 size={12} className="text-slate-400" /> Job Limit
                    </label>
                    <span className="text-[10px] font-bold text-primary">{discoveryLimit} leads</span>
                </div>
                <Select value={discoveryLimit.toString()} onValueChange={(v) => setDiscoveryLimit(parseInt(v))}>
                    <SelectTrigger className="bg-surface/50 border-border/40 h-8 text-xs font-medium">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="10">10 Leads</SelectItem>
                        <SelectItem value="25">25 Leads</SelectItem>
                        <SelectItem value="50">50 Leads</SelectItem>
                        <SelectItem value="100">100 Leads</SelectItem>
                        <SelectItem value="250">250 Leads</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
