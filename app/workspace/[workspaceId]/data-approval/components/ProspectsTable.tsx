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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronsUpDown, MoreHorizontal, Star, Linkedin, Mail, CheckCircle, XCircle, Trash2, Eye } from "lucide-react";
import { ProspectData } from "./types";

interface ProspectsTableProps {
    data: ProspectData[];
    onApprove: (ids: string[]) => void;
    onReject: (ids: string[]) => void;
    onDelete: (id: string) => void;
    onViewDetails: (prospect: ProspectData) => void;
}

export const columns: ColumnDef<ProspectData>[] = [
    {
        id: "select",
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
        header: "Company",
        cell: ({ row }) => <div className="font-medium">{row.getValue("company")}</div>
    },
    {
        accessorKey: "campaignTag",
        header: "Search Name",
        cell: ({ row }) => <div className="text-sm text-gray-400">{row.getValue("campaignTag") || '-'}</div>
    },
    {
        accessorKey: "qualityScore",
        header: "Quality",
        cell: ({ row }) => {
            const score = row.getValue("qualityScore") as number;
            let colorClass = "text-gray-500";
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
        header: "Status",
        cell: ({ row }) => {
            const status = row.original.approvalStatus;
            return (
                <div className="flex items-center gap-2">
                    <Badge variant={status === 'approved' ? 'default' : status === 'rejected' ? 'destructive' : 'secondary'}>
                        {status}
                    </Badge>
                </div>
            );
        }
    },
    {
        id: "contacts",
        header: "Contacts",
        cell: ({ row }) => {
            const p = row.original;
            return (
                <div className="flex gap-2">
                    {p.linkedinUrl && <Linkedin className="h-4 w-4 text-blue-500" />}
                    {p.email && <Mail className="h-4 w-4 text-gray-500" />}
                </div>
            );
        }
    },
    {
        id: "actions",
        enableHiding: false,
        cell: ({ table, row }) => {
            const prospect = row.original;
            // @ts-ignore - meta injected via useReactTable
            // @ts-ignore - meta injected via useReactTable
            const meta = table.options.meta as {
                onApprove?: (ids: string[]) => void;
                onReject?: (ids: string[]) => void;
                onDelete?: (id: string) => void;
                onViewDetails?: (prospect: ProspectData) => void;
            };

            return (
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => meta.onApprove?.([prospect.id])}
                        disabled={prospect.approvalStatus === 'approved'}
                        title="Approve"
                    >
                        <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => meta.onReject?.([prospect.id])}
                        disabled={prospect.approvalStatus === 'rejected'}
                        title="Reject"
                    >
                        <XCircle className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => meta.onViewDetails?.(prospect)}
                        title="View Details"
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(prospect.email)}>
                                Copy Email
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => meta.onDelete?.(prospect.id)} className="text-red-600 focus:text-red-700 cursor-pointer">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            );
        }
    }
];

export function ProspectsTable({ data, onApprove, onReject, onDelete, onViewDetails }: ProspectsTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        meta: {
            onApprove,
            onReject,
            onDelete,
            onViewDetails
        },
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection
        }
    });

    return (
        <Card>
            <CardContent className="pt-6">
                <div className="mb-4 flex items-center gap-2">
                    <Input
                        placeholder="Filter by company..."
                        value={(table.getColumn("company")?.getFilterValue() as string) ?? ""}
                        onChange={(event) => table.getColumn("company")?.setFilterValue(event.target.value)}
                        className="max-w-sm"
                    />
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
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        return (
                                            <TableHead key={header.id}>
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
                                    <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id}>
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center">
                                        No results.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                <div className="flex items-center justify-end space-x-2 pt-4">
                    <div className="text-muted-foreground flex-1 text-sm">
                        {table.getFilteredSelectedRowModel().rows.length} of{" "}
                        {table.getFilteredRowModel().rows.length} row(s) selected.
                    </div>
                    <div className="space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}>
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}>
                            Next
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
