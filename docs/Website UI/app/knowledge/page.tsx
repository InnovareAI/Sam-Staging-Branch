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
        <h1 className="text-2xl font-semibold tracking-tight">Knowledge Base</h1>
        <div className="flex gap-2">
          <Button variant="outline">Help</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-xl">Upload Document</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input type="file" />
            <div className="flex gap-2"><Button>Upload</Button><Button variant="outline">Classify</Button></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-xl">Test Knowledge Retrieval</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Search KB…" className="flex-1" />
              <Button variant="outline">Run</Button>
            </div>
            <ScrollArea className="h-48 border rounded p-3">
              <div className="space-y-2">
                <div className="text-sm">Score 0.87 — Our ICP are B2B SaaS… <Badge variant="secondary">icp</Badge></div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-xl">Documents</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            <Input placeholder="Search documents…" className="max-w-sm" />
            <Select><SelectTrigger className="w-48"><SelectValue placeholder="Filter by tag" /></SelectTrigger>
              <SelectContent><SelectItem value="icp">ICP</SelectItem><SelectItem value="competitive">Competitive</SelectItem></SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Tags</TableHead><TableHead>Uploaded By</TableHead><TableHead>Updated</TableHead><TableHead className="text-right">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell>ICP_SaaS.pdf</TableCell><TableCell><Badge variant="secondary">icp</Badge></TableCell><TableCell>alex</TableCell><TableCell>today</TableCell><TableCell className="text-right"><Button size="sm" variant="outline">View</Button></TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  )
}
