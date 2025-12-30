'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Search as SearchIcon, FileText, Loader2, Upload, Plus, Building2 } from 'lucide-react'

export type ImportTab = 'search' | 'paste' | 'csv' | 'company-csv' | 'quick-add'

interface ImportProspectsModalProps {
  open: boolean
  onClose: () => void
  initialTab?: ImportTab
  onPaste: (text: string) => Promise<void> | void
  onLinkedInUrl: (url: string) => Promise<void> | void
  onCsvUpload: (file: File) => Promise<void> | void
  onQuickAdd: (url: string) => Promise<void> | void
  onCompanySearch?: (companyName: string, jobTitles?: string) => Promise<void> | void
  onCompanyCsvUpload?: (file: File) => Promise<void> | void
  isProcessingPaste?: boolean
  isProcessingUrl?: boolean
  isProcessingCsv?: boolean
  isProcessingQuickAdd?: boolean
  isProcessingCompany?: boolean
  isProcessingCompanyCsv?: boolean
}

export default function ImportProspectsModal({
  open,
  onClose,
  initialTab = 'search',
  onPaste,
  onLinkedInUrl,
  onCsvUpload,
  onQuickAdd,
  onCompanySearch,
  onCompanyCsvUpload,
  isProcessingPaste = false,
  isProcessingUrl = false,
  isProcessingCsv = false,
  isProcessingQuickAdd = false,
  isProcessingCompany = false,
  isProcessingCompanyCsv = false,
}: ImportProspectsModalProps) {
  const [tab, setTab] = useState<ImportTab>(initialTab === 'url' ? 'search' : initialTab as ImportTab)
  const [searchType, setSearchType] = useState<'people' | 'company' | 'companyUrl'>('people')
  const [url, setUrl] = useState('')
  const [companySearchUrl, setCompanySearchUrl] = useState('')
  const [text, setText] = useState('')
  const [quickAddUrl, setQuickAddUrl] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedCompanyFile, setSelectedCompanyFile] = useState<File | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [jobTitles, setJobTitles] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const companyFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTab(initialTab === 'url' ? 'search' : initialTab as ImportTab)
      setSearchType('people')
      setUrl('')
      setCompanySearchUrl('')
      setText('')
      setQuickAddUrl('')
      setSelectedFile(null)
      setSelectedCompanyFile(null)
      setCompanyName('')
      setJobTitles('')
    }
  }, [open, initialTab])

  const handleSubmitUrl = async () => {
    if (!url.trim()) return
    await onLinkedInUrl(url.trim())
    if (!isProcessingUrl) onClose()
  }

  const handleSubmitCompanyUrl = async () => {
    if (!companySearchUrl.trim()) return
    // Company URL uses the same handler as people URL - the backend will detect the URL type
    await onLinkedInUrl(companySearchUrl.trim())
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

  const handleCompanySearch = async () => {
    if (!companyName.trim() || !onCompanySearch) return
    await onCompanySearch(companyName.trim(), jobTitles.trim() || undefined)
    if (!isProcessingCompany) onClose()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e || !e.target || !e.target.files) {
      console.error('File input event is invalid:', e)
      return
    }
    const file = e.target.files[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleCompanyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e || !e.target || !e.target.files) {
      console.error('File input event is invalid:', e)
      return
    }
    const file = e.target.files[0]
    if (file) {
      setSelectedCompanyFile(file)
    }
  }

  const handleCompanyCsvUpload = async () => {
    if (!selectedCompanyFile || !onCompanyCsvUpload) return
    await onCompanyCsvUpload(selectedCompanyFile)
    if (!isProcessingCompanyCsv) onClose()
  }

  const isProcessingSearch = searchType === 'people' ? isProcessingUrl : isProcessingCompany

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Import Prospects</DialogTitle>
          <DialogDescription>Search LinkedIn, upload a CSV, paste data, or add a single profile.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as ImportTab)} className="mt-2">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="search" className="flex items-center gap-1.5 text-xs">
              <SearchIcon className="h-3.5 w-3.5" />
              LinkedIn
            </TabsTrigger>
            <TabsTrigger value="csv" className="flex items-center gap-1.5 text-xs">
              <Upload className="h-3.5 w-3.5" />
              CSV
            </TabsTrigger>
            <TabsTrigger value="company-csv" className="flex items-center gap-1.5 text-xs">
              <Building2 className="h-3.5 w-3.5" />
              Companies
            </TabsTrigger>
            <TabsTrigger value="paste" className="flex items-center gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" />
              Paste
            </TabsTrigger>
            <TabsTrigger value="quick-add" className="flex items-center gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Quick Add
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4 pt-4">
            {/* Search Type Toggle */}
            <div className="flex gap-2 flex-wrap">
              <Button
                type="button"
                variant={searchType === 'people' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType('people')}
                disabled={isProcessingSearch}
              >
                People URL
              </Button>
              <Button
                type="button"
                variant={searchType === 'companyUrl' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType('companyUrl')}
                disabled={isProcessingSearch}
              >
                Company URL
              </Button>
              <Button
                type="button"
                variant={searchType === 'company' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType('company')}
                disabled={isProcessingSearch}
              >
                Company Name
              </Button>
            </div>

            {searchType === 'people' ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Sales Navigator People Search URL</label>
                  <Input
                    placeholder="https://www.linkedin.com/sales/search/people?..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isProcessingUrl}
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste the full Sales Navigator people search URL after results load.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={onClose} disabled={isProcessingUrl}>Cancel</Button>
                  <Button onClick={handleSubmitUrl} disabled={!url.trim() || isProcessingUrl}>
                    {isProcessingUrl && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Import
                  </Button>
                </div>
              </>
            ) : searchType === 'companyUrl' ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Sales Navigator Company Search URL</label>
                  <Input
                    placeholder="https://www.linkedin.com/sales/search/company?..."
                    value={companySearchUrl}
                    onChange={(e) => setCompanySearchUrl(e.target.value)}
                    disabled={isProcessingUrl}
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste the full Sales Navigator company search URL to import companies and their employees.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={onClose} disabled={isProcessingUrl}>Cancel</Button>
                  <Button onClick={handleSubmitCompanyUrl} disabled={!companySearchUrl.trim() || isProcessingUrl}>
                    {isProcessingUrl && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Import
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Company Name or LinkedIn URL</label>
                    <Input
                      placeholder="e.g., Microsoft or https://linkedin.com/company/microsoft"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      disabled={isProcessingCompany}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Job Title Keywords (optional)</label>
                    <Input
                      placeholder="e.g., VP Sales, Director of Marketing, CTO"
                      value={jobTitles}
                      onChange={(e) => setJobTitles(e.target.value)}
                      disabled={isProcessingCompany}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Search for decision-makers at a company by name.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={onClose} disabled={isProcessingCompany}>Cancel</Button>
                  <Button onClick={handleCompanySearch} disabled={!companyName.trim() || isProcessingCompany || !onCompanySearch}>
                    {isProcessingCompany && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Search Company
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="csv" className="space-y-3 pt-4">
            <label className="text-sm text-muted-foreground">Upload CSV file</label>
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
                  <p className="text-sm">{selectedFile.name}</p>
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
                  <p className="text-sm">Click to upload CSV file</p>
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
            <label className="text-sm text-muted-foreground">Rows (CSV or tab separated)</label>
            <Textarea
              placeholder="Full Name, Title, Company, Email, LinkedIn URL&#10;Jane Doe, CEO, Acme Inc, jane@acme.com, https://linkedin.com/in/janedoe"
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isProcessingPaste}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Tip: You can paste from Excel/Sheets (tab-separated also works)</span>
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
            <label className="text-sm text-muted-foreground">LinkedIn profile URL</label>
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

          <TabsContent value="company-csv" className="space-y-3 pt-4">
            <label className="text-sm text-muted-foreground">Upload Company List CSV</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                ref={companyFileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCompanyFileChange}
                className="hidden"
                disabled={isProcessingCompanyCsv}
              />
              {selectedCompanyFile ? (
                <div className="space-y-2">
                  <Building2 className="h-8 w-8 mx-auto text-green-500" />
                  <p className="text-sm">{selectedCompanyFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedCompanyFile.size / 1024).toFixed(2)} KB</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => companyFileInputRef.current?.click()}
                    disabled={isProcessingCompanyCsv}
                  >
                    Choose Different File
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Building2 className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm">Click to upload company list CSV</p>
                  <p className="text-xs text-muted-foreground">Include: Company Name, Website (optional), LinkedIn URL (optional)</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => companyFileInputRef.current?.click()}
                    disabled={isProcessingCompanyCsv}
                  >
                    Select File
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Companies will appear in the Companies tab. You can then discover decision-makers for each company.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={onClose} disabled={isProcessingCompanyCsv}>Cancel</Button>
              <Button onClick={handleCompanyCsvUpload} disabled={!selectedCompanyFile || isProcessingCompanyCsv || !onCompanyCsvUpload}>
                {isProcessingCompanyCsv && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import Companies
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
