# HelloSign Integration for DPA Management

**Status**: Ready to implement
**Timeline**: 3-4 days
**Existing Account**: Yes (HelloSign/Dropbox Sign)

---

## **Step 1: Install HelloSign SDK**

```bash
npm install hellosign-sdk
npm install @types/hellosign-sdk --save-dev
```

---

## **Step 2: Environment Variables**

Add to `.env.local`:

```bash
# HelloSign/Dropbox Sign
HELLOSIGN_API_KEY=your_api_key_here
HELLOSIGN_CLIENT_ID=your_client_id_here
HELLOSIGN_DPA_TEMPLATE_ID=  # Will be created in Step 4

# Webhook verification
HELLOSIGN_WEBHOOK_SECRET=your_webhook_key_here
```

**Where to find these:**
1. Go to https://app.hellosign.com/home/myAccount#integrations
2. API tab → Copy API Key
3. Client ID tab → Copy Client ID
4. Webhooks tab → Create webhook → Copy Event Hash

---

## **Step 3: Create HelloSign Client**

```typescript
// lib/hellosign/client.ts

import HelloSign from 'hellosign-sdk';

// Initialize client
export const helloSignClient = new HelloSign({
  key: process.env.HELLOSIGN_API_KEY!
});

// Type definitions
export interface DPASignatureRequest {
  workspace_id: string;
  company_name: string;
  company_address: string;
  signer_name: string;
  signer_email: string;
  signer_title: string;
  dpa_version: string;
}

export interface HelloSignWebhookEvent {
  event: {
    event_type: string;
    event_time: string;
    event_hash: string;
    event_metadata: Record<string, any>;
  };
  signature_request: {
    signature_request_id: string;
    signatures: Array<{
      signature_id: string;
      signer_email_address: string;
      signer_name: string;
      signed_at: number;
      status_code: string;
    }>;
    custom_fields: Array<{
      name: string;
      value: string;
    }>;
    is_complete: boolean;
    has_error: boolean;
    files_url: string;
  };
}
```

---

## **Step 4: Create DPA Template**

### **Option A: Via HelloSign Dashboard (Recommended)**

1. Go to https://app.hellosign.com/home/templates
2. Click "Create Template"
3. Upload `/public/legal/dpa-template-v1.3.pdf`
4. Add merge fields:
   - `{{company_name}}`
   - `{{company_address}}`
   - `{{workspace_id}}`
   - `{{effective_date}}`
5. Add signature field for "Company Representative"
6. Save template → Copy Template ID

### **Option B: Programmatically**

```typescript
// scripts/hellosign/create-dpa-template.ts

import { helloSignClient } from '@/lib/hellosign/client';
import fs from 'fs';

async function createDPATemplate() {
  try {
    const template = await helloSignClient.template.create({
      test_mode: process.env.NODE_ENV !== 'production',

      // Upload DPA PDF
      files: [fs.createReadStream('./public/legal/dpa-template-v1.3.pdf')],

      title: 'SAM AI - Data Processing Agreement v1.3',
      subject: 'Data Processing Agreement - Signature Required',
      message: `Please review and sign the Data Processing Agreement to comply with GDPR requirements.

This agreement governs how SAM AI processes personal data on your behalf.

If you have any questions, contact legal@meet-sam.com`,

      // Define signer role
      signer_roles: [{
        name: 'Company Representative',
        order: 0
      }],

      // Merge fields (variable data per signature request)
      merge_fields: [
        { name: 'company_name', type: 'text' },
        { name: 'company_address', type: 'text' },
        { name: 'workspace_id', type: 'text' },
        { name: 'effective_date', type: 'text' }
      ]
    });

    console.log('✅ Template created successfully!');
    console.log('Template ID:', template.template.template_id);
    console.log('Add this to .env.local:');
    console.log(`HELLOSIGN_DPA_TEMPLATE_ID=${template.template.template_id}`);

    return template;
  } catch (error) {
    console.error('❌ Template creation failed:', error);
    throw error;
  }
}

// Run it
createDPATemplate();
```

**Run:**
```bash
npx tsx scripts/hellosign/create-dpa-template.ts
```

---

## **Step 5: API Route - Initiate Signature**

```typescript
// app/api/workspace/dpa/initiate-signature/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { helloSignClient } from '@/lib/hellosign/client';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspace_id, signer_details } = await request.json();

    // Get workspace info
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspace_id)
      .single();

    if (workspaceError) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Create embedded signature request using template
    const signatureRequest = await helloSignClient.signatureRequest.createEmbeddedWithTemplate({
      test_mode: process.env.NODE_ENV !== 'production',
      template_id: process.env.HELLOSIGN_DPA_TEMPLATE_ID!,

      subject: 'SAM AI - Data Processing Agreement v1.3',
      message: 'Please review and sign the DPA to activate your workspace.',

      // Signer info
      signers: [{
        role: 'Company Representative',
        email_address: signer_details.email,
        name: signer_details.name
      }],

      // Populate merge fields
      custom_fields: [
        { name: 'company_name', value: workspace.company_legal_name || workspace.name },
        { name: 'company_address', value: workspace.company_address || 'N/A' },
        { name: 'workspace_id', value: workspace_id },
        { name: 'effective_date', value: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}
      ],

      // Metadata for webhook processing
      metadata: {
        workspace_id,
        user_id: user.id,
        dpa_version: '1.3',
        signer_title: signer_details.title
      }
    });

    // Get embedded sign URL
    const signUrl = await helloSignClient.embedded.getSignUrl(
      signatureRequest.signature_request.signatures[0].signature_id
    );

    // Store pending DPA in database
    const { data: dpaRecord, error: dpaError } = await supabase
      .from('workspace_dpa_agreements')
      .insert({
        workspace_id,
        dpa_version: '1.3',
        status: 'pending_signature',
        company_legal_name: workspace.company_legal_name || workspace.name,
        company_address: workspace.company_address,
        signed_by_name: signer_details.name,
        signed_by_email: signer_details.email,
        signed_by_title: signer_details.title,
        signature_method: 'hellosign_embedded',
        hellosign_request_id: signatureRequest.signature_request.signature_request_id
      })
      .select()
      .single();

    if (dpaError) {
      console.error('Failed to store DPA record:', dpaError);
    }

    return NextResponse.json({
      success: true,
      sign_url: signUrl.sign_url,
      signature_request_id: signatureRequest.signature_request.signature_request_id,
      dpa_id: dpaRecord?.id
    });

  } catch (error: any) {
    console.error('HelloSign signature initiation error:', error);
    return NextResponse.json({
      error: 'Failed to initiate signature',
      details: error.message
    }, { status: 500 });
  }
}
```

---

## **Step 6: Embedded Signing Component**

```tsx
// components/compliance/DPASigningModal.tsx

'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface DPASigningModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onSigningComplete?: () => void;
}

export function DPASigningModal({
  isOpen,
  onClose,
  workspaceId,
  onSigningComplete
}: DPASigningModalProps) {
  const [step, setStep] = useState<'details' | 'signing'>('details');
  const [loading, setLoading] = useState(false);
  const [signUrl, setSignUrl] = useState<string | null>(null);

  const [signerDetails, setSignerDetails] = useState({
    name: '',
    email: '',
    title: ''
  });

  // Reset on modal close
  useEffect(() => {
    if (!isOpen) {
      setStep('details');
      setSignUrl(null);
      setSignerDetails({ name: '', email: '', title: '' });
    }
  }, [isOpen]);

  // Listen for HelloSign events
  useEffect(() => {
    if (step === 'signing') {
      const handleHelloSignEvent = (event: MessageEvent) => {
        if (event.data && event.data.type === 'signature_request_signed') {
          // Signature completed
          onSigningComplete?.();
          onClose();
        }
      };

      window.addEventListener('message', handleHelloSignEvent);
      return () => window.removeEventListener('message', handleHelloSignEvent);
    }
  }, [step, onSigningComplete, onClose]);

  async function handleInitiateSignature() {
    setLoading(true);

    try {
      const response = await fetch('/api/workspace/dpa/initiate-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          signer_details: signerDetails
        })
      });

      const data = await response.json();

      if (data.success) {
        setSignUrl(data.sign_url);
        setStep('signing');
      } else {
        alert('Failed to initiate signature: ' + data.error);
      }
    } catch (error) {
      console.error('Error initiating signature:', error);
      alert('Failed to initiate signature. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh]">
        <DialogHeader>
          <DialogTitle>
            {step === 'details' ? 'Signer Information' : 'Sign Data Processing Agreement'}
          </DialogTitle>
        </DialogHeader>

        {step === 'details' && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">
              Please provide the details of the authorized signatory for your organization.
            </p>

            <div className="space-y-3">
              <div>
                <Label htmlFor="signer-name">Full Name *</Label>
                <Input
                  id="signer-name"
                  placeholder="John Smith"
                  value={signerDetails.name}
                  onChange={(e) => setSignerDetails({...signerDetails, name: e.target.value})}
                />
              </div>

              <div>
                <Label htmlFor="signer-email">Email Address *</Label>
                <Input
                  id="signer-email"
                  type="email"
                  placeholder="john@company.com"
                  value={signerDetails.email}
                  onChange={(e) => setSignerDetails({...signerDetails, email: e.target.value})}
                />
              </div>

              <div>
                <Label htmlFor="signer-title">Title/Position *</Label>
                <Input
                  id="signer-title"
                  placeholder="CEO, Legal Counsel, etc."
                  value={signerDetails.title}
                  onChange={(e) => setSignerDetails({...signerDetails, title: e.target.value})}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleInitiateSignature}
                disabled={
                  !signerDetails.name ||
                  !signerDetails.email ||
                  !signerDetails.title ||
                  loading
                }
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue to Signing
              </Button>
            </div>
          </div>
        )}

        {step === 'signing' && (
          <div className="w-full h-[700px]">
            {signUrl ? (
              <iframe
                src={signUrl}
                width="100%"
                height="100%"
                className="border rounded-lg"
                title="Sign DPA"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

---

## **Step 7: Webhook Handler**

```typescript
// app/api/webhooks/hellosign/route.ts

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { helloSignClient, type HelloSignWebhookEvent } from '@/lib/hellosign/client';

// Use service role for webhook
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-hellosign-signature');

    // Verify webhook authenticity
    const expectedSignature = crypto
      .createHmac('sha256', process.env.HELLOSIGN_API_KEY!)
      .update(rawBody)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('Invalid HelloSign webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event: HelloSignWebhookEvent = JSON.parse(rawBody);

    console.log('HelloSign webhook received:', event.event.event_type);

    // Handle different event types
    switch (event.event.event_type) {
      case 'signature_request_signed':
        await handleSignatureCompleted(event);
        break;

      case 'signature_request_all_signed':
        await handleAllSigned(event);
        break;

      case 'signature_request_declined':
        await handleSignatureDeclined(event);
        break;

      case 'signature_request_invalid':
        await handleSignatureInvalid(event);
        break;
    }

    return NextResponse.json({ status: 'received' });

  } catch (error) {
    console.error('HelloSign webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleAllSigned(event: HelloSignWebhookEvent) {
  const { signature_request } = event;
  const workspace_id = signature_request.custom_fields.find(f => f.name === 'workspace_id')?.value;

  if (!workspace_id) {
    console.error('No workspace_id in HelloSign metadata');
    return;
  }

  try {
    // Download signed PDF
    const response = await helloSignClient.signatureRequest.download(
      signature_request.signature_request_id,
      { file_type: 'pdf' }
    );

    // Upload to Supabase Storage
    const fileName = `dpa-signed-${workspace_id}-${Date.now()}.pdf`;
    const { data: upload, error: uploadError } = await supabaseAdmin.storage
      .from('legal-documents')
      .upload(fileName, response, {
        contentType: 'application/pdf',
        cacheControl: '31536000' // 1 year
      });

    if (uploadError) {
      console.error('Failed to upload signed DPA:', uploadError);
      return;
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('legal-documents')
      .getPublicUrl(fileName);

    // Update DPA agreement record
    const { error: updateError } = await supabaseAdmin
      .from('workspace_dpa_agreements')
      .update({
        status: 'signed',
        signed_at: new Date(signature_request.signatures[0].signed_at * 1000),
        signed_dpa_pdf_url: publicUrl,
        hellosign_envelope_id: signature_request.signature_request_id
      })
      .eq('hellosign_request_id', signature_request.signature_request_id);

    if (updateError) {
      console.error('Failed to update DPA record:', updateError);
      return;
    }

    // Remove DPA requirement (enable workspace)
    await supabaseAdmin
      .from('workspace_dpa_requirements')
      .update({ dpa_required: false })
      .eq('workspace_id', workspace_id);

    // Send confirmation email
    await sendDPASignedEmail({
      workspace_id,
      signer_email: signature_request.signatures[0].signer_email_address,
      signed_dpa_url: publicUrl
    });

    console.log('✅ DPA signing completed for workspace:', workspace_id);

  } catch (error) {
    console.error('Error processing signed DPA:', error);
  }
}

async function handleSignatureDeclined(event: HelloSignWebhookEvent) {
  const { signature_request } = event;

  await supabaseAdmin
    .from('workspace_dpa_agreements')
    .update({
      status: 'declined',
      notes: 'Signature declined by signer'
    })
    .eq('hellosign_request_id', signature_request.signature_request_id);

  console.log('⚠️ DPA signature declined:', signature_request.signature_request_id);
}

async function handleSignatureInvalid(event: HelloSignWebhookEvent) {
  const { signature_request } = event;

  await supabaseAdmin
    .from('workspace_dpa_agreements')
    .update({
      status: 'invalid',
      notes: 'Signature request became invalid'
    })
    .eq('hellosign_request_id', signature_request.signature_request_id);

  console.log('❌ DPA signature invalid:', signature_request.signature_request_id);
}

async function handleSignatureCompleted(event: HelloSignWebhookEvent) {
  // Individual signature completed (but not all signers)
  console.log('Individual signature completed');
}

// Helper function
async function sendDPASignedEmail(data: {
  workspace_id: string;
  signer_email: string;
  signed_dpa_url: string;
}) {
  // TODO: Implement email sending
  console.log('Sending DPA signed confirmation email to:', data.signer_email);
}
```

---

## **Step 8: Configure HelloSign Webhook**

1. Go to https://app.hellosign.com/home/myAccount#integrations
2. Click "Webhooks" tab
3. Add webhook URL: `https://app.meet-sam.com/api/webhooks/hellosign`
4. Copy "Event Hash" → Add to `.env.local` as `HELLOSIGN_WEBHOOK_SECRET`

---

## **Step 9: Database Migration**

Add HelloSign-specific columns:

```sql
-- Add HelloSign columns to workspace_dpa_agreements
ALTER TABLE workspace_dpa_agreements
ADD COLUMN IF NOT EXISTS hellosign_request_id TEXT,
ADD COLUMN IF NOT EXISTS hellosign_envelope_id TEXT;

CREATE INDEX IF NOT EXISTS idx_dpa_hellosign_request
ON workspace_dpa_agreements(hellosign_request_id);
```

---

## **Step 10: Testing**

### **Test Mode Setup:**

```typescript
// When NODE_ENV !== 'production', all HelloSign requests use test_mode: true
// This allows testing without real signatures or costs

// Test the flow:
1. Initiate signature in test mode
2. Sign using HelloSign test signer
3. Verify webhook receives event
4. Check database updated correctly
```

### **Test Checklist:**

- [ ] Template created successfully
- [ ] Embedded signature URL generated
- [ ] Signing flow works in iframe
- [ ] Webhook receives signature events
- [ ] Signed PDF uploaded to storage
- [ ] Database updated with signed status
- [ ] Email confirmation sent
- [ ] Workspace DPA requirement removed

---

## **Production Deployment**

1. Create production DPA template (test_mode: false)
2. Update `HELLOSIGN_DPA_TEMPLATE_ID` in production env
3. Configure production webhook URL
4. Test with real signature
5. Monitor HelloSign dashboard for events

---

## **Cost Monitoring**

**HelloSign Standard Plan: $30/user/month**
- Unlimited signature requests
- No per-signature cost
- Cost scales with team size, not customer count

**Expected usage:**
- 100 EU customers/month = $0 extra cost
- 1000 EU customers/month = $0 extra cost
- Only pay $30/month regardless of volume

---

## **Next Steps**

1. ✅ Install hellosign-sdk
2. ✅ Add environment variables
3. ✅ Create HelloSign client
4. ⏳ Create DPA template
5. ⏳ Build signature initiation API
6. ⏳ Build signing modal component
7. ⏳ Set up webhook handler
8. ⏳ Test end-to-end flow

**Timeline: 3-4 days for full implementation**
