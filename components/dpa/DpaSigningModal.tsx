'use client'

import { useState, useEffect, useRef } from 'react'
import { Shield, CheckCircle, AlertTriangle, Download, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface DpaSigningModalProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: string
  onSuccess?: () => void
}

/**
 * DPA Signing Modal Component
 *
 * Click-through signature modal for Data Processing Agreement
 * Legally valid under EU eIDAS and US E-SIGN Act
 *
 * Features:
 * - Full DPA text display with scroll tracking
 * - Required fields: name, title, consent checkbox
 * - Signature metadata capture (IP, timestamp, user agent)
 * - Instant PDF generation with signature certificate
 */
export default function DpaSigningModal({
  isOpen,
  onClose,
  workspaceId,
  onSuccess
}: DpaSigningModalProps) {
  const [step, setStep] = useState<'review' | 'sign' | 'complete'>('review')
  const [dpaContent, setDpaContent] = useState('')
  const [signerName, setSignerName] = useState('')
  const [signerTitle, setSignerTitle] = useState('')
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [signedPdfUrl, setSignedPdfUrl] = useState('')

  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      fetchDpaContent()
      resetForm()
    }
  }, [isOpen])

  const fetchDpaContent = async () => {
    try {
      // Fetch current DPA version content
      // For now using placeholder, will load from database
      setDpaContent(`SAM AI DATA PROCESSING AGREEMENT

Version 1.0
Effective Date: ${new Date().toLocaleDateString()}

BETWEEN:
SAM AI, LLC ("Processor")
AND
[Customer Name] ("Controller")

1. PURPOSE AND SCOPE

This Data Processing Agreement ("DPA") governs the processing of personal data by SAM AI on behalf of the Customer in connection with the use of SAM AI's sales automation platform.

This DPA is entered into pursuant to Article 28 of the General Data Protection Regulation (GDPR) and forms part of the Terms of Service between SAM AI and the Customer.

2. DEFINITIONS

2.1 "Personal Data" means any information relating to an identified or identifiable natural person that is processed by SAM AI on behalf of the Customer.

2.2 "Data Subject" means the individual to whom Personal Data relates.

2.3 "Processing" has the meaning given in GDPR Article 4(2).

3. DATA PROCESSING DETAILS

3.1 Subject Matter: Sales automation and campaign management services

3.2 Duration: For the term of the Customer's subscription

3.3 Nature and Purpose of Processing:
- Storage and management of prospect contact information
- AI-powered conversation assistance and content generation
- Campaign message delivery via LinkedIn and email
- Analytics and reporting on campaign performance

3.4 Categories of Personal Data:
- Contact information (names, email addresses, LinkedIn profiles)
- Professional information (job titles, companies, industries)
- Communication history and engagement data
- Campaign interaction metadata

3.5 Categories of Data Subjects:
- Business prospects and leads
- Customer employees and team members
- Third-party contacts engaged through campaigns

4. PROCESSOR OBLIGATIONS

4.1 SAM AI shall:
  a) Process Personal Data only on documented instructions from the Customer
  b) Ensure that persons authorized to process Personal Data have committed to confidentiality
  c) Implement appropriate technical and organizational measures to ensure data security
  d) Assist the Customer in responding to Data Subject rights requests
  e) Assist the Customer in ensuring compliance with GDPR Articles 32-36
  f) Delete or return Personal Data upon termination of services
  g) Make available all information necessary to demonstrate compliance

4.2 SAM AI shall not:
  a) Process Personal Data for purposes other than those instructed by the Customer
  b) Transfer Personal Data to third countries without appropriate safeguards
  c) Engage sub-processors without prior written authorization

5. SUB-PROCESSORS

5.1 The Customer authorizes SAM AI to engage the following sub-processors:

- Supabase (PostgreSQL): Database and authentication services
- Anthropic: AI model inference (Claude)
- OpenRouter: LLM routing and inference
- Unipile: LinkedIn and email integration services
- Postmark: Transactional email delivery
- Netlify: Application hosting and CDN services

5.2 SAM AI shall:
  a) Enter into written agreements with each sub-processor imposing data protection obligations
  b) Provide 30 days' notice before adding or replacing sub-processors
  c) Remain fully liable for sub-processor performance

6. DATA SUBJECT RIGHTS

6.1 SAM AI shall assist the Customer in fulfilling Data Subject requests for:
  a) Access to Personal Data
  b) Rectification of inaccurate Personal Data
  c) Erasure ("right to be forgotten")
  d) Restriction of processing
  e) Data portability
  f) Objection to processing

6.2 SAM AI shall notify the Customer within 48 hours of receiving any Data Subject request.

7. SECURITY MEASURES

7.1 SAM AI implements the following security measures:

Technical Measures:
- Data encryption in transit (TLS 1.3) and at rest (AES-256)
- Role-based access control (RBAC) with multi-tenancy isolation
- Regular security audits and penetration testing
- Automated vulnerability scanning and patching
- Secure API authentication and authorization
- Database row-level security (RLS) policies

Organizational Measures:
- Employee confidentiality agreements
- Security awareness training for all staff
- Incident response and breach notification procedures
- Regular backup and disaster recovery testing
- Access logging and audit trails

8. DATA BREACH NOTIFICATION

8.1 SAM AI shall notify the Customer without undue delay (and in any event within 72 hours) upon becoming aware of a Personal Data breach.

8.2 The notification shall include:
  a) Nature of the breach and categories/approximate numbers affected
  b) Name and contact details of the data protection officer
  c) Likely consequences of the breach
  d) Measures taken or proposed to address the breach

9. INTERNATIONAL DATA TRANSFERS

9.1 The Customer acknowledges that SAM AI processes Personal Data in the United States.

9.2 For transfers from the EU/EEA, SAM AI relies on:
  a) Standard Contractual Clauses (SCCs) approved by the European Commission
  b) Supplementary measures as outlined in the Transfer Impact Assessment

9.3 SAM AI shall not transfer Personal Data to third countries without:
  a) Ensuring an adequate level of protection
  b) Implementing appropriate safeguards (SCCs, BCRs, or other approved mechanisms)

10. AUDITS AND INSPECTIONS

10.1 Upon reasonable notice, the Customer may:
  a) Request information to demonstrate SAM AI's compliance with this DPA
  b) Conduct audits or inspections (maximum once per year)

10.2 SAM AI shall provide:
  a) SOC 2 Type II reports (when available)
  b) Security questionnaire responses
  c) Third-party audit reports

11. DATA DELETION AND RETURN

11.1 Upon termination or expiration of services, SAM AI shall:
  a) Delete all Personal Data within 30 days, or
  b) Return Personal Data to the Customer in a commonly used format

11.2 SAM AI may retain Personal Data to the extent required by law, provided that:
  a) Processing is limited to compliance purposes only
  b) Data is securely isolated from active systems
  c) Data is deleted once the legal retention period expires

12. LIABILITY AND INDEMNIFICATION

12.1 Each party shall be liable for damages caused by processing Personal Data in violation of this DPA.

12.2 SAM AI's total liability under this DPA shall not exceed the amounts paid by the Customer in the 12 months preceding the claim.

12.3 SAM AI shall indemnify the Customer against fines imposed by supervisory authorities resulting from SAM AI's breach of this DPA.

13. TERM AND TERMINATION

13.1 This DPA shall remain in effect for the duration of the Terms of Service.

13.2 This DPA may be terminated:
  a) By either party for material breach with 30 days' written notice
  b) Automatically upon termination of the Terms of Service

13.3 Sections 7, 8, 11, and 12 shall survive termination.

14. AMENDMENTS

14.1 SAM AI may update this DPA to reflect:
  a) Changes in data protection laws or regulations
  b) Guidance from supervisory authorities
  c) Industry best practices

14.2 Material changes shall be communicated to the Customer with 30 days' notice.

15. GOVERNING LAW AND DISPUTE RESOLUTION

15.1 This DPA shall be governed by the laws of the jurisdiction specified in the Terms of Service.

15.2 Any disputes shall be resolved in accordance with the dispute resolution provisions in the Terms of Service.

15.3 Nothing in this DPA shall limit the rights of Data Subjects under GDPR or other applicable data protection laws.

16. CONTACT INFORMATION

Data Protection Officer:
Email: privacy@meet-sam.com
Address: [SAM AI Business Address]

For data subject requests or privacy inquiries, please contact: privacy@meet-sam.com

---

ACCEPTANCE

By electronically signing this Data Processing Agreement, the Customer acknowledges that:

1. The Customer has read and understood this DPA
2. The Customer consents to electronic signature under EU eIDAS Regulation and US E-SIGN Act
3. The Customer agrees to be legally bound by the terms of this DPA
4. The Customer represents and warrants that they have authority to bind their organization

Electronic signatures are legally binding and enforceable.

---

Last Updated: ${new Date().toLocaleDateString()}
Version: 1.0`)
    } catch (error) {
      console.error('Failed to fetch DPA content:', error)
      setError('Failed to load DPA content. Please try again.')
    }
  }

  const resetForm = () => {
    setStep('review')
    setSignerName('')
    setSignerTitle('')
    setAgreeToTerms(false)
    setScrolledToBottom(false)
    setError('')
    setSignedPdfUrl('')
  }

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement
    const scrollPercentage =
      (target.scrollTop / (target.scrollHeight - target.clientHeight)) * 100

    if (scrollPercentage > 95) {
      setScrolledToBottom(true)
    }
  }

  const handleProceedToSign = () => {
    if (!scrolledToBottom) {
      setError('Please scroll to the bottom of the DPA to continue')
      return
    }
    setStep('sign')
    setError('')
  }

  const handleSignDpa = async () => {
    // Validate fields
    if (!signerName.trim()) {
      setError('Please enter your full name')
      return
    }
    if (!signerTitle.trim()) {
      setError('Please enter your job title')
      return
    }
    if (!agreeToTerms) {
      setError('You must agree to the terms to sign the DPA')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/dpa/sign-click-through', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          workspaceId,
          signerName: signerName.trim(),
          signerTitle: signerTitle.trim(),
          consentText: 'I have read and agree to the Data Processing Agreement',
          scrolledToBottom
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sign DPA')
      }

      // Success - move to complete step
      setStep('complete')
      setSignedPdfUrl(data.pdfUrl || '')

      // Call onSuccess callback after short delay
      setTimeout(() => {
        onSuccess?.()
      }, 2000)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to sign DPA. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        {/* Review Step */}
        {step === 'review' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Shield className="h-6 w-6 text-indigo-600" />
                Data Processing Agreement (DPA)
              </DialogTitle>
              <DialogDescription>
                Please review the full agreement. You must scroll to the bottom to proceed.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <ScrollArea
                className="h-[400px] w-full rounded-md border p-4 bg-slate-50"
                onScroll={handleScroll}
                ref={scrollAreaRef}
              >
                <div className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
                  {dpaContent}
                </div>
              </ScrollArea>

              {!scrolledToBottom && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Please scroll to the bottom of the agreement to continue
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleProceedToSign}
                disabled={!scrolledToBottom}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                I Have Read the DPA - Proceed to Sign
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Sign Step */}
        {step === 'sign' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Shield className="h-6 w-6 text-indigo-600" />
                Sign Data Processing Agreement
              </DialogTitle>
              <DialogDescription>
                Enter your details to electronically sign the DPA
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="signerName">Full Legal Name *</Label>
                <Input
                  id="signerName"
                  placeholder="John Smith"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="signerTitle">Job Title *</Label>
                <Input
                  id="signerTitle"
                  placeholder="Chief Technology Officer"
                  value={signerTitle}
                  onChange={(e) => setSignerTitle(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border">
                <h4 className="font-semibold text-sm mb-2">Electronic Signature Notice</h4>
                <p className="text-xs text-slate-600 mb-3">
                  By signing electronically, you agree that your electronic signature is legally
                  binding under EU eIDAS Regulation and US E-SIGN Act. Your signature will include:
                </p>
                <ul className="text-xs text-slate-600 space-y-1">
                  <li>• Timestamp of signature</li>
                  <li>• IP address and device information</li>
                  <li>• Confirmation that you scrolled through and read the full agreement</li>
                </ul>
              </div>

              <div className="flex items-start gap-3 p-4 border-2 border-indigo-200 rounded-lg bg-indigo-50">
                <Checkbox
                  id="agreeToTerms"
                  checked={agreeToTerms}
                  onCheckedChange={(checked) => setAgreeToTerms(checked as boolean)}
                  disabled={loading}
                />
                <Label htmlFor="agreeToTerms" className="text-sm leading-relaxed cursor-pointer">
                  I have read and agree to the Data Processing Agreement. I consent to electronically
                  sign this document and understand that my electronic signature is legally binding.
                </Label>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('review')} disabled={loading}>
                Back to Review
              </Button>
              <Button
                onClick={handleSignDpa}
                disabled={!agreeToTerms || loading}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Signing Agreement...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Sign Agreement
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl text-green-600">
                <CheckCircle className="h-6 w-6" />
                DPA Successfully Signed!
              </DialogTitle>
              <DialogDescription>
                Your Data Processing Agreement has been signed and stored
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-6">
              <div className="p-6 bg-green-50 border-2 border-green-200 rounded-lg text-center">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-green-900 mb-2">
                  Agreement Signed Successfully
                </h3>
                <p className="text-sm text-green-800 mb-4">
                  Signed by {signerName} ({signerTitle}) on{' '}
                  {new Date().toLocaleDateString()}
                </p>
                <p className="text-xs text-green-700">
                  Your workspace is now GDPR compliant. A signed PDF certificate has been generated
                  and can be downloaded from the Compliance settings page.
                </p>
              </div>

              {signedPdfUrl && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(signedPdfUrl, '_blank')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Signed DPA PDF
                </Button>
              )}
            </div>

            <DialogFooter>
              <Button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-700">
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
