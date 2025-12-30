'use client';

import * as React from "react";
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, ChevronsUpDown, MoreHorizontal, Star, Linkedin, Mail, CheckCircle, XCircle, Trash2, Eye, Upload, Plus, Download, Users, Filter } from "lucide-react";
import { ProspectData } from "./types";

interface ProspectsTableProps {
    data: ProspectData[];
    onApprove: (ids: string[]) => void;
    onReject: (ids: string[]) => void;
    onDelete: (id: string) => void;
    onViewDetails: (prospect: ProspectData) => void;
    onImportClick?: () => void;
    onAddToCampaign?: (ids: string[]) => void;
    onCreateCampaign?: () => void;
    onDeleteSelected?: (ids: string[]) => void;
    title?: string;
    // Pagination props (controlled by parent)
    page?: number;
    pageSize?: number;
    totalPages?: number;
    totalCount?: number;
    hasNextPage?: boolean;
    hasPrevPage?: boolean;
    onNextPage?: () => void;
    onPrevPage?: () => void;
    onPageSizeChange?: (size: number) => void;
}

export const columns: ColumnDef<ProspectData>[] = [
    {
        id: "select",
        size: 40,
        header: ({ table }) => (
            <Checkbox
                checked={
                    table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="Select all"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
            />
        ),
        enableSorting: false,
        enableHiding: false
    },
    {
        accessorKey: "name",
        size: 200,
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    className="-ml-4"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Prospect
                    <ChevronsUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const prospect = row.original;
            return (
                <div className="flex flex-col">
                    <span className="font-medium">{prospect.name}</span>
                    <span className="text-xs text-muted-foreground">{prospect.title}</span>
                </div>
            );
        }
    },
    {
        accessorKey: "company",
        size: 150,
        header: ({ column }) => (
            <Button
                variant="ghost"
                className="-ml-4"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                Company
                <ChevronsUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => <div className="font-medium">{row.getValue("company")}</div>
    },
    {
        accessorKey: "campaignTag",
        size: 120,
        header: ({ column }) => (
            <Button
                variant="ghost"
                className="-ml-4"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                Search Name
                <ChevronsUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => <div className="text-sm text-muted-foreground">{row.getValue("campaignTag") || '-'}</div>
    },
    {
        accessorKey: "qualityScore",
        size: 80,
        header: "Quality",
        cell: ({ row }) => {
            const score = row.getValue("qualityScore") as number;
            let colorClass = "text-muted-foreground";
            if (score >= 80) colorClass = "text-green-500";
            else if (score >= 50) colorClass = "text-yellow-500";
            else if (score < 50) colorClass = "text-red-500";

            return (
                <div className="flex items-center gap-1">
                    <Star className={`h-3 w-3 fill-current ${colorClass}`} />
                    <span className="text-sm">{score}</span>
                </div>
            );
        }
    },
    {
        accessorKey: "status",
        size: 100,
        header: ({ column }) => (
            <Button
                variant="ghost"
                className="-ml-4 hover:bg-transparent"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                Status
                <ChevronsUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => {
            const status = row.original.approvalStatus;
            const statusConfig = {
                approved: {
                    label: 'Approved',
                    class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]',
                    dot: 'bg-emerald-500'
                },
                rejected: {
                    label: 'Rejected',
                    class: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                    dot: 'bg-rose-500'
                },
                pending: {
                    label: 'Pending',
                    class: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                    dot: 'bg-amber-500'
                }
            };
            const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

            return (
                <div className="flex items-center">
                    <Badge variant="outline" className={cn("px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-tighter flex items-center gap-1.5", config.class)}>
                        <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", config.dot)} />
                        {config.label}
                    </Badge>
                </div>
            );
        }
    },
    {
        id: "contacts",
        size: 80,
        header: "Contacts",
        cell: ({ row }) => {
            const p = row.original;
            return (
                <div className="flex gap-2">
                    {p.linkedinUrl && <Linkedin className="h-4 w-4 text-blue-500" />}
                    {p.email && <Mail className="h-4 w-4 text-muted-foreground" />}
                </div>
            );
        }
    },
    {
        id: "actions",
        size: 160,
        enableHiding: false,
        cell: ({ table, row }) => {
            const prospect = row.original;
            // @ts-ignore - meta injected via useReactTable
            const meta = table.options.meta as {
                onApprove?: (ids: string[]) => void;
                onReject?: (ids: string[]) => void;
                onDelete?: (id: string) => void;
                onViewDetails?: (prospect: ProspectData) => void;
                onAddToCampaign?: (ids: string[]) => void;
                onDismiss?: (id: string) => void;
            };

            return (
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20 transition-all duration-300"
                        onClick={() => meta.onApprove?.([prospect.id])}
                        disabled={prospect.approvalStatus === 'approved'}
                        title="Approve"
                    >
                        <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all duration-300"
                        onClick={() => meta.onReject?.([prospect.id])}
                        disabled={prospect.approvalStatus === 'rejected'}
                        title="Reject"
                    >
                        <XCircle className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/20 transition-all duration-300"
                        onClick={() => meta.onViewDetails?.(prospect)}
                        title="View Details"
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-surface-highlight/50 transition-colors">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border shadow-xl backdrop-blur-xl">
                            <DropdownMenuItem onClick={() => meta.onAddToCampaign?.([prospect.id])} className="text-blue-400 focus:text-blue-300 focus:bg-blue-500/10 cursor-pointer">
                                <Upload className="mr-2 h-4 w-4" /> Add to Campaign
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => meta.onDelete?.(prospect.id)} className="text-rose-400 focus:text-rose-300 focus:bg-rose-500/10 cursor-pointer">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            );
        }
    }
];

export function ProspectsTable({
    data, onApprove, onReject, onDelete, onViewDetails, onImportClick, onAddToCampaign, onCreateCampaign, onDeleteSelected, title,
    // Pagination props (optional - use internal if not provided)
    page, pageSize: externalPageSize, totalPages, totalCount, hasNextPage, hasPrevPage, onNextPage, onPrevPage, onPageSizeChange
}: ProspectsTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [globalFilter, setGlobalFilter] = React.useState('');
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});
    const [minQuality, setMinQuality] = React.useState(0);
    const [contactFilters, setContactFilters] = React.useState({
        hasEmail: false,
        hasLinkedIn: false,
        hasPhone: false
    });
    const [degreeFilters, setDegreeFilters] = React.useState<string[]>([]);
    const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(new Set());
    const [showDismissed, setShowDismissed] = React.useState(false);
    const [selectedList, setSelectedList] = React.useState<string>('all');

    // Persistence for columns
    React.useEffect(() => {
        const saved = localStorage.getItem('prospect_table_columns');
        if (saved) {
            try {
                setColumnVisibility(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse saved columns', e);
            }
        }
    }, []);

    React.useEffect(() => {
        if (Object.keys(columnVisibility).length > 0) {
            localStorage.setItem('prospect_table_columns', JSON.stringify(columnVisibility));
        }
    }, [columnVisibility]);

    // Get unique lists (campaignTag or sessionId) for the filter
    const uniqueLists = React.useMemo(() => {
        const lists = new Map<string, { id: string; name: string; count: number }>();
        data.forEach(p => {
            const listId = p.sessionId || 'unknown';
            const listName = p.campaignTag || p.sessionId || 'Unnamed List';
            if (!lists.has(listId)) {
                lists.set(listId, { id: listId, name: listName, count: 0 });
            }
            lists.get(listId)!.count++;
        });
        return Array.from(lists.values());
    }, [data]);

    // Filter out dismissed prospects and by selected list
    const filteredData = React.useMemo(() => {
        let result = data;
        // Filter by list if not 'all'
        if (selectedList !== 'all') {
            result = result.filter(p => (p.sessionId || 'unknown') === selectedList);
        }
        // Filter out dismissed unless showing dismissed
        if (!showDismissed) {
            result = result.filter(p => !dismissedIds.has(p.id));
        }
        // Advanced filters
        if (minQuality > 0) {
            result = result.filter(p => (p.qualityScore || 0) >= minQuality);
        }
        if (contactFilters.hasEmail) result = result.filter(p => !!p.email);
        if (contactFilters.hasLinkedIn) result = result.filter(p => !!p.linkedinUrl);
        if (contactFilters.hasPhone) result = result.filter(p => !!p.phone);
        if (degreeFilters.length > 0) {
            result = result.filter(p => {
                const deg = String(p.connectionDegree);
                return degreeFilters.some(f => deg.includes(f[0])); // Match '1' in '1st' or '1'
            });
        }
        return result;
    }, [data, dismissedIds, showDismissed, selectedList, minQuality, contactFilters, degreeFilters]);

    const dismissedCount = dismissedIds.size;

    const table = useReactTable({
        data: filteredData,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        onGlobalFilterChange: setGlobalFilter,
        globalFilterFn: (row, columnId, filterValue) => {
            const val = filterValue.toLowerCase();
            const p = row.original;
            return (
                p.name?.toLowerCase().includes(val) ||
                p.company?.toLowerCase().includes(val) ||
                p.title?.toLowerCase().includes(val) ||
                p.email?.toLowerCase().includes(val) ||
                p.linkedinUrl?.toLowerCase().includes(val)
            );
        },
        meta: {
            onApprove,
            onReject,
            onDelete,
            onViewDetails,
            onAddToCampaign,
            onDismiss: (prospectId: string) => {
                setDismissedIds(prev => {
                    const newSet = new Set(prev);
                    newSet.add(prospectId);
                    return newSet;
                });
            }
        },
        state: {
            sorting,
            columnFilters,
            globalFilter,
            columnVisibility,
            rowSelection
        }
    });

    // Download CSV function
    const downloadCSV = () => {
        const rows = table.getFilteredRowModel().rows;
        if (rows.length === 0) return;

        const headers = ['Name', 'Title', 'Company', 'Email', 'LinkedIn URL', 'Location', 'Status', 'Quality Score'];
        const csvContent = [
            headers.join(','),
            ...rows.map(row => {
                const p = row.original;
                return [
                    `"${p.name || ''}"`,
                    `"${p.title || ''}"`,
                    `"${p.company || ''}"`,
                    `"${p.email || ''}"`,
                    `"${p.linkedinUrl || ''}"`,
                    `"${p.location || ''}"`,
                    `"${p.approvalStatus || ''}"`,
                    `"${p.qualityScore || 0}"`
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `prospects_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Smart selection functions
    const selectAllVisible = () => {
        const newSelection: Record<string, boolean> = {};
        table.getFilteredRowModel().rows.forEach(row => {
            newSelection[row.id] = true;
        });
        setRowSelection(newSelection);
    };

    const selectTopQuality = (minScore: number = 80) => {
        const newSelection: Record<string, boolean> = {};
        table.getFilteredRowModel().rows.forEach(row => {
            if (row.original.qualityScore >= minScore) {
                newSelection[row.id] = true;
            }
        });
        setRowSelection(newSelection);
    };

    const selectWithEmail = () => {
        const newSelection: Record<string, boolean> = {};
        table.getFilteredRowModel().rows.forEach(row => {
            if (row.original.email && row.original.email.trim() !== '') {
                newSelection[row.id] = true;
            }
        });
        setRowSelection(newSelection);
    };

    const selectFirstDegree = () => {
        const newSelection: Record<string, boolean> = {};
        table.getFilteredRowModel().rows.forEach(row => {
            const deg = String(row.original.connectionDegree);
            if (deg === '1' || deg === '1st') {
                newSelection[row.id] = true;
            }
        });
        setRowSelection(newSelection);
    };

    const clearSelection = () => {
        setRowSelection({});
    };

    return (
        <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
            {title && (
                <div className="px-6 pt-6 pb-2 relative z-10">
                    <h2 className="text-xl font-black tracking-tight text-foreground">{title}</h2>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
                        {table.getFilteredRowModel().rows.length} {table.getFilteredRowModel().rows.length === data.length ? 'total leads' : 'matching results'}
                    </p>
                </div>
            )}
            <CardContent className="pt-4 relative z-10">
                <div className="mb-4 flex items-center gap-2 flex-wrap">
                    {/* List Selector */}
                    <Select value={selectedList} onValueChange={setSelectedList}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="All Lists" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Lists ({uniqueLists.length})</SelectItem>
                            {uniqueLists.map((list) => (
                                <SelectItem key={list.id} value={list.id}>
                                    {list.name} ({list.count})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input
                        placeholder="Search prospects..."
                        value={globalFilter ?? ""}
                        onChange={(event) => setGlobalFilter(event.target.value)}
                        className="max-w-sm"
                    />
                    {onImportClick && (
                        <Button
                            onClick={onImportClick}
                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20"
                        >
                            <Upload className="mr-2 h-4 w-4" />
                            Import Prospects
                        </Button>
                    )}
                    {onCreateCampaign && (
                        <Button
                            onClick={onCreateCampaign}
                            variant="outline"
                            className="border-border hover:bg-surface-muted text-foreground"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Create Campaign
                        </Button>
                    )}
                    {/* Download CSV Button */}
                    <Button
                        onClick={downloadCSV}
                        variant="outline"
                        className="border-border hover:bg-surface-muted text-foreground"
                        disabled={table.getFilteredRowModel().rows.length === 0}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV ({table.getFilteredRowModel().rows.length})
                    </Button>
                    {/* Smart Selection Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <Users className="mr-2 h-4 w-4" />
                                Select <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={selectAllVisible}>
                                Select All Visible
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => selectTopQuality(80)}>
                                Select Top Quality (80+)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={selectWithEmail}>
                                Select With Email
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={selectFirstDegree}>
                                Select 1st Degree
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={clearSelection} className="text-red-600">
                                Clear Selection
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={minQuality > 0 || contactFilters.hasEmail || contactFilters.hasLinkedIn || contactFilters.hasPhone || degreeFilters.length > 0 ? "border-blue-500 text-blue-500" : ""}>
                                <Filter className="mr-2 h-4 w-4" />
                                Filters
                                {(minQuality > 0 || contactFilters.hasEmail || contactFilters.hasLinkedIn || contactFilters.hasPhone || degreeFilters.length > 0) && (
                                    <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                                        !
                                    </Badge>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-4 bg-card border-border">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <h4 className="font-medium text-sm">Quality Score (&gt;= {minQuality})</h4>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="5"
                                        value={minQuality}
                                        onChange={(e) => setMinQuality(parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-medium text-sm">Contact Availability</h4>
                                    <div className="grid gap-2">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="hasEmail"
                                                checked={contactFilters.hasEmail}
                                                onCheckedChange={(checked) => setContactFilters(p => ({ ...p, hasEmail: !!checked }))}
                                            />
                                            <label htmlFor="hasEmail" className="text-sm">Has Email</label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="hasLinkedIn"
                                                checked={contactFilters.hasLinkedIn}
                                                onCheckedChange={(checked) => setContactFilters(p => ({ ...p, hasLinkedIn: !!checked }))}
                                            />
                                            <label htmlFor="hasLinkedIn" className="text-sm">Has LinkedIn</label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="hasPhone"
                                                checked={contactFilters.hasPhone}
                                                onCheckedChange={(checked) => setContactFilters(p => ({ ...p, hasPhone: !!checked }))}
                                            />
                                            <label htmlFor="hasPhone" className="text-sm">Has Phone</label>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-medium text-sm">Connection Degree</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {['1st', '2nd', '3rd'].map(deg => (
                                            <Button
                                                key={deg}
                                                variant={degreeFilters.includes(deg) ? "default" : "outline"}
                                                size="sm"
                                                className="h-7 px-2"
                                                onClick={() => {
                                                    setDegreeFilters(prev =>
                                                        prev.includes(deg) ? prev.filter(d => d !== deg) : [...prev, deg]
                                                    );
                                                }}
                                            >
                                                {deg}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full text-xs text-muted-foreground h-7"
                                    onClick={() => {
                                        setMinQuality(0);
                                        setContactFilters({ hasEmail: false, hasLinkedIn: false, hasPhone: false });
                                        setDegreeFilters([]);
                                    }}
                                >
                                    Clear Filters
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="ml-auto">
                                Columns <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {table
                                .getAllColumns()
                                .filter((column) => column.getCanHide())
                                .map((column) => {
                                    return (
                                        <DropdownMenuCheckboxItem
                                            key={column.id}
                                            className="capitalize"
                                            checked={column.getIsVisible()}
                                            onCheckedChange={(value) => column.toggleVisibility(!!value)}>
                                            {column.id}
                                        </DropdownMenuCheckboxItem>
                                    );
                                })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="rounded-xl border border-border/40 bg-background/40 backdrop-blur-sm max-h-[600px] overflow-auto relative shadow-inner">
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-surface-muted/90 backdrop-blur-md shadow-sm border-b border-border/40">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                                    {headerGroup.headers.map((header) => {
                                        return (
                                            <TableHead
                                                key={header.id}
                                                style={{ width: header.getSize() }}
                                                className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 h-12"
                                            >
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(header.column.columnDef.header, header.getContext())}
                                            </TableHead>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                        className="group transition-colors hover:bg-surface-highlight/40 border-border/20"
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell
                                                key={cell.id}
                                                style={{ width: cell.column.getSize() }}
                                                className="py-3 px-4"
                                            >
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-48 text-center text-muted-foreground italic">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-surface-muted flex items-center justify-center">
                                                <Filter className="h-6 w-6 opacity-20" />
                                            </div>
                                            <span>No prospects found matching your current filters.</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                <div className="flex items-center justify-between space-x-2 pt-4">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm font-medium">
                            {table.getFilteredRowModel().rows.length} {table.getFilteredRowModel().rows.length === data.length ? 'leads' : 'results'}
                        </span>
                        <span className="text-muted-foreground text-sm">
                            • {table.getFilteredSelectedRowModel().rows.length} selected
                        </span>
                        {dismissedCount > 0 && (
                            <span className="text-muted-foreground text-sm flex items-center gap-1">
                                • {dismissedCount} hidden
                                <Button
                                    variant="link"
                                    size="sm"
                                    className="h-auto py-0 px-1 text-blue-600 hover:text-blue-700"
                                    onClick={() => setShowDismissed(!showDismissed)}
                                >
                                    {showDismissed ? 'Hide' : 'Show'}
                                </Button>
                                <Button
                                    variant="link"
                                    size="sm"
                                    className="h-auto py-0 px-1 text-red-600 hover:text-red-700"
                                    onClick={() => setDismissedIds(new Set())}
                                >
                                    Clear
                                </Button>
                            </span>
                        )}
                        {table.getFilteredSelectedRowModel().rows.length > 0 && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="ml-2 text-green-600 border-green-200 hover:bg-green-50"
                                    onClick={() => {
                                        const ids = table.getFilteredSelectedRowModel().rows.map(r => r.original.id);
                                        onApprove(ids);
                                        setRowSelection({});
                                    }}
                                >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Approve ({table.getFilteredSelectedRowModel().rows.length})
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => {
                                        const ids = table.getFilteredSelectedRowModel().rows.map(r => r.original.id);
                                        onReject(ids);
                                        setRowSelection({});
                                    }}
                                >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Reject ({table.getFilteredSelectedRowModel().rows.length})
                                </Button>
                                {onAddToCampaign && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="ml-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                                        onClick={() => {
                                            const ids = table.getFilteredSelectedRowModel().rows.map(r => r.original.id);
                                            onAddToCampaign(ids);
                                            // Don't clear selection immediately, let modal handle success
                                        }}
                                    >
                                        <Upload className="mr-2 h-4 w-4" />
                                        Add to Campaign
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => {
                                        const ids = table.getFilteredSelectedRowModel().rows.map(r => r.original.id);
                                        if (onDeleteSelected) {
                                            onDeleteSelected(ids);
                                        } else {
                                            // Fallback if prop not provided
                                            ids.forEach(id => onDelete(id));
                                        }
                                        setRowSelection({});
                                    }}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete ({table.getFilteredSelectedRowModel().rows.length})
                                </Button>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Rows per page</span>
                        <Select
                            value={`${onPageSizeChange ? (externalPageSize || 50) : table.getState().pagination.pageSize}`}
                            onValueChange={(value) => {
                                if (onPageSizeChange) {
                                    onPageSizeChange(Number(value));
                                } else {
                                    table.setPageSize(Number(value));
                                }
                            }}
                        >
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue placeholder={externalPageSize || table.getState().pagination.pageSize} />
                            </SelectTrigger>
                            <SelectContent side="top">
                                {[10, 25, 50, 100].map((ps) => (
                                    <SelectItem key={ps} value={`${ps}`}>
                                        {ps}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {/* Show page info when externally controlled */}
                        {page && totalPages && (
                            <span className="text-sm text-muted-foreground mx-2">
                                Page {page} of {totalPages}
                            </span>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPrevPage ? onPrevPage() : table.previousPage()}
                            disabled={onPrevPage ? !hasPrevPage : !table.getCanPreviousPage()}>
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onNextPage ? onNextPage() : table.nextPage()}
                            disabled={onNextPage ? !hasNextPage : !table.getCanNextPage()}>
                            Next
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card >
    );
}
