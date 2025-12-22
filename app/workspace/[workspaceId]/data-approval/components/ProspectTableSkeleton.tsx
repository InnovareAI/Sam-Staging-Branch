import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function ProspectTableSkeleton() {
    return (
        <Card>
            <CardHeader>
                <CardTitle><Skeleton className="h-8 w-32" /></CardTitle>
                <CardDescription><Skeleton className="h-4 w-64" /></CardDescription>
            </CardHeader>
            <CardContent>
                <div className="mb-4 flex items-center justify-between">
                    <Skeleton className="h-10 w-64" /> {/* Search input */}
                    <Skeleton className="h-10 w-24" /> {/* Columns button */}
                </div>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px]"><Skeleton className="h-4 w-4" /></TableHead>
                                <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                                <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                                <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                                <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                                <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                                <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                                <TableHead className="w-[100px] text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <Skeleton className="h-5 w-32" />
                                            <Skeleton className="h-3 w-24" />
                                        </div>
                                    </TableCell>
                                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Skeleton className="h-4 w-4" />
                                            <Skeleton className="h-4 w-4" />
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-end gap-2">
                                            <Skeleton className="h-8 w-8 rounded-md" />
                                            <Skeleton className="h-8 w-8 rounded-md" />
                                            <Skeleton className="h-8 w-8 rounded-md" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <div className="flex items-center justify-end space-x-2 pt-4">
                    <Skeleton className="h-4 w-32" />
                    <div className="space-x-2 flex">
                        <Skeleton className="h-9 w-20" />
                        <Skeleton className="h-9 w-20" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
