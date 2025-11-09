'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Link as LinkIcon, FileText, Loader2, Upload, Plus } from 'lucide-react'

export type ImportTab = 'url' | 'paste' | 'csv' | 'quick-add'

interface ImportProspectsModalProps {
  open: boolean
  onClose: () => void
  initialTab?: ImportTab
  onPaste: (text: string) => Promise<void> | void
  onLinkedInUrl: (url: string) => Promise<void> | void
  onCsvUpload: (file: File) => Promise<void> | void
  onQuickAdd: (url: string) => Promise<void> | void
  isProcessingPaste?: boolean
  isProcessingUrl?: boolean
  isProcessingCsv?: boolean
  isProcessingQuickAdd?: boolean
}

export default function ImportProspectsModal({
  open,
  onClose,
  initialTab = 'url',
  onPaste,
  onLinkedInUrl,
  onCsvUpload,
  onQuickAdd,
  isProcessingPaste = false,
  isProcessingUrl = false,
  isProcessingCsv = false,
  isProcessingQuickAdd = false,
}: ImportProspectsModalProps) {
  const [tab, setTab] = useState<ImportTab>(initialTab)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [quickAddUrl, setQuickAddUrl] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTab(initialTab)
      setUrl('')
      setText('')
      setQuickAddUrl('')
      setSelectedFile(null)
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

  const handleCsvUpload = async () => {
    if (!selectedFile) return
    await onCsvUpload(selectedFile)
    if (!isProcessingCsv) onClose()
  }

  const handleQuickAdd = async () => {
    if (!quickAddUrl.trim()) return
    await onQuickAdd(quickAddUrl.trim())
    if (!isProcessingQuickAdd) onClose()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Import Prospects</DialogTitle>
          <DialogDescription>Choose your import method: LinkedIn search, CSV upload, copy & paste, or add a single profile.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as ImportTab)} className="mt-2">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="url" className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              LinkedIn URL
            </TabsTrigger>
            <TabsTrigger value="csv" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              CSV Upload
            </TabsTrigger>
            <TabsTrigger value="paste" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Copy & Paste
            </TabsTrigger>
            <TabsTrigger value="quick-add" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Quick Add
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

          <TabsContent value="csv" className="space-y-3 pt-4">
            <label className="text-sm font-medium">Upload CSV file</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                disabled={isProcessingCsv}
              />
              {selectedFile ? (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-green-500" />
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingCsv}
                  >
                    Choose Different File
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium">Click to upload CSV file</p>
                  <p className="text-xs text-muted-foreground">Must include: Name, Title, Company Name, Email, Profile URL</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingCsv}
                  >
                    Select File
                  </Button>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={onClose} disabled={isProcessingCsv}>Cancel</Button>
              <Button onClick={handleCsvUpload} disabled={!selectedFile || isProcessingCsv}>
                {isProcessingCsv && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Upload
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

          <TabsContent value="quick-add" className="space-y-3 pt-4">
            <label className="text-sm font-medium">LinkedIn profile URL</label>
            <Input
              placeholder="https://linkedin.com/in/username"
              value={quickAddUrl}
              onChange={(e) => setQuickAddUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isProcessingQuickAdd && quickAddUrl.trim()) {
                  handleQuickAdd()
                }
              }}
              disabled={isProcessingQuickAdd}
            />
            <p className="text-xs text-muted-foreground">
              Add a single LinkedIn profile. We'll automatically detect if they're a 1st degree connection.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={onClose} disabled={isProcessingQuickAdd}>Cancel</Button>
              <Button onClick={handleQuickAdd} disabled={!quickAddUrl.trim() || isProcessingQuickAdd}>
                {isProcessingQuickAdd && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Profile
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
