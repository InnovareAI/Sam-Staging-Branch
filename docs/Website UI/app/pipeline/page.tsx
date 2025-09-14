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
        <h1 className="text-2xl font-semibold tracking-tight">Lead Pipeline</h1>
        <div className="flex gap-2">
          <Button variant="outline">Help</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {['Prospects','Enriched','Qualified','Opportunities'].map((col) => (
          <Card key={col}><CardHeader><CardTitle className="text-sm">{col}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="border rounded p-2"><div className="text-sm">Acme Inc.</div><Badge variant="secondary">score 78</Badge></div>
              <div className="border rounded p-2"><div className="text-sm">Beta LLC</div><Badge variant="secondary">score 72</Badge></div>
            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  )
}
