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
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <div className="flex gap-2">
          <Button variant="outline">Help</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card><CardHeader><CardTitle className="text-sm">Readiness</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">82%</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Reply Rate</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">9.8%</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Meetings / Mo</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">34</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">ROI (90d)</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">9.6x</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-xl">Campaign Performance</CardTitle></CardHeader>
        <CardContent><div className="h-64 border rounded bg-background" /></CardContent>
      </Card>

    </div>
  )
}
