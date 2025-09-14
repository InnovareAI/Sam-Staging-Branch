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
        <h1 className="text-2xl font-semibold tracking-tight">Contact Center</h1>
        <div className="flex gap-2">
          <Button variant="outline">Help</Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <Card className="col-span-4">
          <CardHeader><CardTitle className="text-xl">Inbox</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Search…" />
              <Select><SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent><SelectItem value="replied">Replied</SelectItem><SelectItem value="unread">Unread</SelectItem></SelectContent>
              </Select>
            </div>
            <ScrollArea className="h-[60vh] border rounded p-2">
              <Button variant="outline" className="w-full justify-start mb-2">Greg Miller — Replied</Button>
              <Button variant="outline" className="w-full justify-start">Jenni Graff — No Interaction</Button>
            </ScrollArea>
          </CardContent>
        </Card>
        <Card className="col-span-8">
          <CardHeader><CardTitle className="text-xl">Conversation</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-[60vh] border rounded p-3">
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">Fri, May 28</div>
                <div className="bg-muted rounded p-3">Can we connect on LinkedIn?</div>
                <div className="bg-primary text-primary-foreground rounded p-3 ml-auto max-w-[60%]">Absolutely, Greg.</div>
              </div>
            </ScrollArea>
            <div className="mt-3 flex gap-2"><Input placeholder="Type a reply…" /><Button>Send</Button></div>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
