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
        <h1 className="text-2xl font-semibold tracking-tight">Super Admin Panel</h1>
        <div className="flex gap-2">
          <Button variant="outline">Help</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-xl">Company: InnovareAI</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">Company emails will be sent from: <span className="font-medium">sp@innovareai.com</span></div>
          <div className="flex gap-2"><Button>Create Tenant</Button><Button variant="secondary">Invite User</Button><Button variant="outline">Manage Users</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-xl">All Workspaces (4)</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] border rounded p-3">
            {["WT Matchmaker","Sendingcell","3cubed","InnovareAI"].map((w,i)=> (
              <Card key={w} className="mb-3">
                <CardHeader><CardTitle className="flex items-center justify-between text-base">{w}<Badge variant="secondary">Owner: tl@innovareai.com</Badge></CardTitle></CardHeader>
                <CardContent className="text-sm">Members: { [0,3,3,11][i] } <Button size="sm" className="ml-3">Invite</Button></CardContent>
              </Card>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

    </div>
  )
}
