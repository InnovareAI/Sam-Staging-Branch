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
        <h1 className="text-2xl font-semibold tracking-tight">Invite Team</h1>
        <div className="flex gap-2">
          <Button variant="outline">Help</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-xl">Invite Member</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <Input placeholder="Email address" />
            <Select><SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger><SelectContent><SelectItem value="member">Member</SelectItem><SelectItem value="manager">Manager</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select>
          </div>
          <Button>Send Invite</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-xl">Team</CardTitle></CardHeader>
        <CardContent>
          <Table><TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody><TableRow><TableCell>user@example.com</TableCell><TableCell><Badge>Member</Badge></TableCell><TableCell><Badge variant="secondary">Pending</Badge></TableCell><TableCell className="text-right"><Button size="sm" variant="outline">Resend</Button></TableCell></TableRow></TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  )
}
