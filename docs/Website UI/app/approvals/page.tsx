import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function Page() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
        <div className="flex gap-2">
          <Button variant="outline">Help</Button>
        </div>
      </div>

      <Card className="bg-card border-border shadow-sm">
        <CardHeader><CardTitle className="text-xl">Approval Queue</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
            <Input placeholder="Search requests…" className="w-full md:w-1/3" />
            <Select><SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent>
            </Select>
            <Select><SelectTrigger className="w-48"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="campaign">Campaign</SelectItem><SelectItem value="message">Message</SelectItem><SelectItem value="document">Document</SelectItem></SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Type</TableHead><TableHead>Submitted By</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell>LinkedIn message to VP Sales</TableCell><TableCell>Message</TableCell><TableCell>Sam</TableCell><TableCell>2025-09-12</TableCell><TableCell><Badge variant="secondary">Pending</Badge></TableCell><TableCell className="text-right space-x-2"><Button size="sm" variant="outline">View</Button><Button size="sm">Approve</Button><Button size="sm" variant="destructive">Reject</Button></TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  )
}
