'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Link as LinkIcon, FileText, Loader2 } from 'lucide-react'

export type ImportTab = 'url' | 'paste'

interface ImportProspectsModalProps {
  open: boolean
  onClose: () => void
  initialTab?: ImportTab
  onPaste: (text: string) => Promise<void> | void
  onLinkedInUrl: (url: string) => Promise<void> | void
  isProcessingPaste?: boolean
  isProcessingUrl?: boolean
}

export default function ImportProspectsModal({
  open,
  onClose,
  initialTab = 'url',
  onPaste,
  onLinkedInUrl,
  isProcessingPaste = false,
  isProcessingUrl = false,
}: ImportProspectsModalProps) {
  const [tab, setTab] = useState<ImportTab>(initialTab)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')

  useEffect(() => {
    if (open) {
      setTab(initialTab)
      setUrl('')
      setText('')
    }
  }, [open, initialTab])

  const handleSubmitUrl = async () => {
    if (!url.trim()) return
    await onLinkedInUrl(url.trim())
    // Keep modal open while processing; close when not processing
    if (!isProcessingUrl) onClose()
  }

  const handleSubmitPaste = async () => {
    if (!text.trim()) return
    await onPaste(text.trim())
    if (!isProcessingPaste) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Import Prospects</DialogTitle>
          <DialogDescription>Use a LinkedIn search URL or paste rows of contacts. We’ll validate and add them to your approval queue.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as ImportTab)} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url" className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              LinkedIn URL
            </TabsTrigger>
            <TabsTrigger value="paste" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Copy & Paste
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-3 pt-4">
            <label className="text-sm font-medium">LinkedIn search URL</label>
            <Input
              placeholder="https://www.linkedin.com/sales/search/people?..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isProcessingUrl}
            />
            <p className="text-xs text-muted-foreground">
              Paste the full Sales Navigator/Recruiter URL after results have loaded (must include query and filters).
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={onClose} disabled={isProcessingUrl}>Cancel</Button>
              <Button onClick={handleSubmitUrl} disabled={!url.trim() || isProcessingUrl}>
                {isProcessingUrl && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="paste" className="space-y-3 pt-4">
            <label className="text-sm font-medium">Rows (CSV or tab separated)</label>
            <Textarea
              placeholder="Full Name, Title, Company, Email, LinkedIn URL\nJane Doe, CEO, Acme Inc, jane@acme.com, https://linkedin.com/in/janedoe"
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isProcessingPaste}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Tip: You can paste from Excel/Sheets (tab-separated also supported)</span>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={onClose} disabled={isProcessingPaste}>Cancel</Button>
              <Button onClick={handleSubmitPaste} disabled={!text.trim() || isProcessingPaste}>
                {isProcessingPaste && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
