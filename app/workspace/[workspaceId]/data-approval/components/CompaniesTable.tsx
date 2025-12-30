'use client';

import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Building2, Users, Search, Loader2, Trash2, ExternalLink, MapPin, Briefcase } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface Company {
    id: string;
    name: string;
    linkedin_url?: string;
    linkedin_id?: string;
    industry?: string;
    employee_count?: string;
    location?: string;
    status: 'pending' | 'processing' | 'processed' | 'archived';
    prospects_found: number;
    created_at: string;
}

interface CompaniesTableProps {
    companies: Company[];
    isLoading: boolean;
    onDiscoverDecisionMakers: (companyIds: string[], jobTitles?: string) => Promise<void>;
    onDeleteCompanies: (companyIds: string[]) => Promise<void>;
    onImportClick: () => void;
}

export function CompaniesTable({
    companies,
    isLoading,
    onDiscoverDecisionMakers,
    onDeleteCompanies,
    onImportClick
}: CompaniesTableProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showDiscoverModal, setShowDiscoverModal] = useState(false);
    const [jobTitles, setJobTitles] = useState('');
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === companies.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(companies.map(c => c.id)));
        }
    };

    const handleDiscover = async () => {
        if (selectedIds.size === 0) return;
        setIsDiscovering(true);
        try {
            await onDiscoverDecisionMakers(Array.from(selectedIds), jobTitles || undefined);
            setShowDiscoverModal(false);
            setJobTitles('');
            setSelectedIds(new Set());
        } finally {
            setIsDiscovering(false);
        }
    };

    const handleDelete = async () => {
        if (selectedIds.size === 0) return;
        setIsDeleting(true);
        try {
            await onDeleteCompanies(Array.from(selectedIds));
            setSelectedIds(new Set());
        } finally {
            setIsDeleting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pending</Badge>;
            case 'processing':
                return <Badge variant="outline" className="text-blue-600 border-blue-600">Processing</Badge>;
            case 'processed':
                return <Badge variant="outline" className="text-green-600 border-green-600">Processed</Badge>;
            case 'archived':
                return <Badge variant="outline" className="text-gray-600 border-gray-600">Archived</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (isLoading && companies.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header Actions */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h3 className="text-lg flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Companies ({companies.length})
                    </h3>
                    {selectedIds.size > 0 && (
                        <span className="text-sm text-muted-foreground">
                            {selectedIds.size} selected
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="text-red-600 hover:text-red-700"
                            >
                                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                Delete
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => setShowDiscoverModal(true)}
                                className="bg-primary"
                            >
                                <Users className="h-4 w-4 mr-2" />
                                Find Decision-Makers
                            </Button>
                        </>
                    )}
                    <Button variant="outline" size="sm" onClick={onImportClick}>
                        <Building2 className="h-4 w-4 mr-2" />
                        Import Companies
                    </Button>
                </div>
            </div>

            {/* Table */}
            {companies.length === 0 ? (
                <div className="border rounded-lg p-12 text-center">
                    <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg mb-2">No companies yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Import companies from Sales Navigator to find decision-makers
                    </p>
                    <Button onClick={onImportClick}>
                        <Building2 className="h-4 w-4 mr-2" />
                        Import Companies
                    </Button>
                </div>
            ) : (
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="w-12">
                                    <Checkbox
                                        checked={selectedIds.size === companies.length && companies.length > 0}
                                        onCheckedChange={toggleSelectAll}
                                    />
                                </TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead>Industry</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Prospects</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {companies.map((company) => (
                                <TableRow
                                    key={company.id}
                                    className={selectedIds.has(company.id) ? 'bg-primary/5' : ''}
                                >
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedIds.has(company.id)}
                                            onCheckedChange={() => toggleSelect(company.id)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm">{company.name}</span>
                                                    {company.linkedin_url && (
                                                        <a
                                                            href={company.linkedin_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-muted-foreground hover:text-primary"
                                                        >
                                                            <ExternalLink className="h-3 w-3" />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {company.industry && (
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                <Briefcase className="h-3 w-3" />
                                                {company.industry}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground">
                                            {company.employee_count || '-'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {company.location && (
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                <MapPin className="h-3 w-3" />
                                                {company.location}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>{getStatusBadge(company.status)}</TableCell>
                                    <TableCell className="text-right">
                                        {company.prospects_found > 0 ? (
                                            <Badge variant="secondary">{company.prospects_found}</Badge>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Discover Decision-Makers Modal */}
            <Dialog open={showDiscoverModal} onOpenChange={setShowDiscoverModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Find Decision-Makers
                        </DialogTitle>
                        <DialogDescription>
                            Search for decision-makers at {selectedIds.size} selected {selectedIds.size === 1 ? 'company' : 'companies'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm text-muted-foreground">Job Title Keywords (optional)</label>
                            <Input
                                placeholder="e.g., VP Sales, Director of Marketing, CTO"
                                value={jobTitles}
                                onChange={(e) => setJobTitles(e.target.value)}
                                disabled={isDiscovering}
                            />
                            <p className="text-xs text-muted-foreground">
                                Leave blank to find all available contacts, or specify titles to filter results.
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setShowDiscoverModal(false)} disabled={isDiscovering}>
                            Cancel
                        </Button>
                        <Button onClick={handleDiscover} disabled={isDiscovering}>
                            {isDiscovering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Search className="mr-2 h-4 w-4" />
                            Find Decision-Makers
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
