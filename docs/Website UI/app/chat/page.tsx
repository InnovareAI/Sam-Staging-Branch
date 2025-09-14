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
        <h1 className="text-2xl font-semibold tracking-tight">Chat with Sam</h1>
        <div className="flex gap-2">
          <Button variant="outline">Help</Button>
        </div>
      </div>

      <Card className="bg-card border-border shadow-sm">
        <CardHeader><CardTitle className="text-xl">Conversation</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 gap-6">
            <ScrollArea className="col-span-9 h-[70vh] border rounded p-4 bg-background">
              <div className="space-y-3">
                <div className="max-w-[60%] bg-muted rounded-lg p-3">Hi, I’m Sam. How’s your day going?</div>
                <div className="max-w-[60%] bg-primary text-primary-foreground rounded-lg p-3 ml-auto">Good — need help with lead research.</div>
              </div>
            </ScrollArea>
            <Card className="col-span-3">
              <CardHeader><CardTitle className="text-sm">Sessions</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start">Today</Button>
                <Button variant="outline" className="w-full justify-start">Yesterday</Button>
              </CardContent>
            </Card>
          </div>
          <div className="mt-4 flex gap-2">
            <Input placeholder="Type your message…" />
            <Button>Send</Button>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
