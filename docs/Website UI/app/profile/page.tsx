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
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <div className="flex gap-2">
          <Button variant="outline">Help</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-xl">Profile</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          <Input placeholder="Full name" />
          <Input placeholder="Email" />
          <div className="col-span-full"><Button>Save</Button></div>
        </CardContent>
      </Card>

    </div>
  )
}
