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
        <h1 className="text-2xl font-semibold tracking-tight">Campaign Hub</h1>
        <div className="flex gap-2">
          <Button variant="outline">Help</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card><CardHeader><CardTitle>Medtech CTOs DACH</CardTitle></CardHeader><CardContent><Badge variant="secondary">draft</Badge></CardContent></Card>
        <Card><CardHeader><CardTitle>VP Sales SaaS NA</CardTitle></CardHeader><CardContent><Badge>active</Badge></CardContent></Card>
        <Card><CardHeader><CardTitle>RIAs $500M–$2B</CardTitle></CardHeader><CardContent><Badge variant="outline">paused</Badge></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-xl">Create Campaign</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <Input placeholder="Name" />
            <Input placeholder="Audience (e.g., SaaS VP Sales, NA)" />
          </div>
          <Input placeholder="Message step 1…" />
          <div className="flex gap-2"><Button>Create Draft</Button><Button variant="outline">Save Template</Button></div>
        </CardContent>
      </Card>

    </div>
  )
}
