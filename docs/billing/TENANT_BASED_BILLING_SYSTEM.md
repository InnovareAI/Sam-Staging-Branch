# Tenant-Based Billing System Design

## Overview
Sam platform uses a sophisticated billing system that handles different payment methods based on tenant type and account configuration.

---

## 🏢 Tenant Types & Payment Methods

### 1. **InnovareAI Clients**
**Default Payment Method**: Credit Card (Stripe)
- 2,000 free enrichment credits per month
- After quota exceeded: Pay-per-enrichment via Stripe
- Real-time CC charging for overages

**Alternative Payment Method**: Invoice Billing (Optional)
- If account is flagged as `billing_method: "invoice"`
- Monthly invoices sent via email
- Net 30 payment terms
- No real-time CC charging

### 2. **3cubed Clients**
**Payment Method**: Invoice Billing (Always)
- Monthly consolidated invoice
- Usage tracked but not charged in real-time
- Net 30 payment terms
- No credit card integration
- Unlimited enrichment credits (no quota enforcement)

---

## 💳 Payment Flow Decision Tree

```
User uploads prospect data for enrichment
    ↓
Check tenant type (workspace.company)
    ↓
┌─────────────────────────┬──────────────────────────┐
│   InnovareAI Client     │     3cubed Client        │
└─────────────────────────┴──────────────────────────┘
         ↓                            ↓
    Check billing_method         Skip billing check
         ↓                            ↓
┌────────────────┬─────────┐    Add to invoice queue
│ "credit_card"  │ "invoice"│         ↓
└────────────────┴─────────┘    Process enrichment
         ↓              ↓              ↓
    Check quota    Track usage    Return enriched data
         ↓              ↓
    Under 2000?   Add to invoice
         ↓              ↓
    Yes │ No      Send monthly
        │  │           ↓
    Free  │      Return data
          │
    Charge via Stripe
          ↓
    Return enriched data
```

---

## 🗄️ Database Schema

### Table: `workspaces`
```sql
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS company VARCHAR(50) DEFAULT 'InnovareAI',
ADD COLUMN IF NOT EXISTS billing_method VARCHAR(20) DEFAULT 'credit_card',
ADD COLUMN IF NOT EXISTS billing_contact_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS invoice_terms VARCHAR(50) DEFAULT 'net_30';

-- Constraints
-- billing_method: 'credit_card' | 'invoice'
-- company: 'InnovareAI' | '3cubed'
```

### Table: `enrichment_credits`
```sql
CREATE TABLE IF NOT EXISTS enrichment_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Credit tracking
  monthly_quota INTEGER DEFAULT 2000,
  credits_used INTEGER DEFAULT 0,
  credits_remaining INTEGER GENERATED ALWAYS AS (monthly_quota - credits_used) STORED,
  
  -- Billing period
  billing_period_start TIMESTAMPTZ DEFAULT date_trunc('month', NOW()),
  billing_period_end TIMESTAMPTZ DEFAULT (date_trunc('month', NOW()) + INTERVAL '1 month'),
  
  -- Reset tracking
  last_reset_at TIMESTAMPTZ DEFAULT NOW(),
  next_reset_at TIMESTAMPTZ DEFAULT (date_trunc('month', NOW()) + INTERVAL '1 month'),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enrichment_credits_workspace ON enrichment_credits(workspace_id);
CREATE INDEX idx_enrichment_credits_user ON enrichment_credits(user_id);
CREATE INDEX idx_enrichment_credits_period ON enrichment_credits(billing_period_start, billing_period_end);
```

### Table: `enrichment_usage_log`
```sql
CREATE TABLE IF NOT EXISTS enrichment_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Enrichment details
  prospect_count INTEGER NOT NULL,
  enrichment_type VARCHAR(50) NOT NULL, -- 'csv_upload', 'linkedin_search', 'manual'
  credits_consumed INTEGER NOT NULL,
  
  -- Billing details
  was_charged BOOLEAN DEFAULT false,
  charge_amount DECIMAL(10,2),
  stripe_charge_id VARCHAR(100),
  invoice_id VARCHAR(100),
  
  -- Metadata
  session_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enrichment_usage_workspace ON enrichment_usage_log(workspace_id);
CREATE INDEX idx_enrichment_usage_period ON enrichment_usage_log(created_at);
CREATE INDEX idx_enrichment_usage_billing ON enrichment_usage_log(was_charged, invoice_id);
```

### Table: `monthly_invoices`
```sql
CREATE TABLE IF NOT EXISTS monthly_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Invoice period
  billing_period_start TIMESTAMPTZ NOT NULL,
  billing_period_end TIMESTAMPTZ NOT NULL,
  
  -- Amounts
  total_enrichments INTEGER DEFAULT 0,
  subtotal DECIMAL(10,2) DEFAULT 0.00,
  tax DECIMAL(10,2) DEFAULT 0.00,
  total_amount DECIMAL(10,2) DEFAULT 0.00,
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'sent', 'paid', 'overdue'
  sent_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  -- Contact
  bill_to_email VARCHAR(255),
  bill_to_name VARCHAR(255),
  
  -- Metadata
  notes TEXT,
  pdf_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_workspace ON monthly_invoices(workspace_id);
CREATE INDEX idx_invoices_status ON monthly_invoices(status);
CREATE INDEX idx_invoices_period ON monthly_invoices(billing_period_start, billing_period_end);
```

---

## 🔧 API Endpoints

### 1. Check Enrichment Eligibility
```
POST /api/billing/check-enrichment-eligibility
```

**Request:**
```json
{
  "workspace_id": "uuid",
  "prospect_count": 150
}
```

**Response:**
```json
{
  "eligible": true,
  "billing_method": "credit_card",
  "tenant_type": "InnovareAI",
  "credits_available": 1850,
  "credits_needed": 150,
  "will_charge": false,
  "estimated_charge": 0.00,
  "message": "Within free quota"
}
```

### 2. Process Enrichment Payment
```
POST /api/billing/process-enrichment
```

**Request:**
```json
{
  "workspace_id": "uuid",
  "session_id": "csv_upload_123",
  "prospect_count": 2500,
  "enrichment_type": "csv_upload"
}
```

**Response (3cubed - Invoice):**
```json
{
  "success": true,
  "billing_method": "invoice",
  "tenant_type": "3cubed",
  "credits_consumed": 2500,
  "charged": false,
  "message": "Usage logged. Will be invoiced monthly.",
  "can_proceed": true
}
```

**Response (InnovareAI - CC, Over Quota):**
```json
{
  "success": true,
  "billing_method": "credit_card",
  "tenant_type": "InnovareAI",
  "credits_consumed": 2500,
  "free_credits_used": 2000,
  "overage_credits": 500,
  "charged": true,
  "charge_amount": 25.00,
  "stripe_charge_id": "ch_xxx",
  "message": "Charged $25.00 for 500 credits",
  "can_proceed": true
}
```

**Response (InnovareAI - Invoice):**
```json
{
  "success": true,
  "billing_method": "invoice",
  "tenant_type": "InnovareAI",
  "credits_consumed": 2500,
  "charged": false,
  "message": "Usage logged. Will be invoiced on Nov 1, 2025.",
  "invoice_due_date": "2025-11-30",
  "can_proceed": true
}
```

### 3. Get Billing Dashboard
```
GET /api/billing/dashboard?workspace_id=uuid
```

**Response:**
```json
{
  "workspace": {
    "id": "uuid",
    "name": "Acme Corp",
    "company": "InnovareAI",
    "billing_method": "credit_card"
  },
  "current_period": {
    "start": "2025-10-01",
    "end": "2025-10-31",
    "monthly_quota": 2000,
    "credits_used": 1250,
    "credits_remaining": 750,
    "overage_charges": 0.00
  },
  "payment_method": {
    "type": "credit_card",
    "last4": "4242",
    "brand": "visa"
  },
  "recent_usage": [
    {
      "date": "2025-10-01",
      "type": "csv_upload",
      "prospects": 150,
      "credits": 150,
      "charged": false
    }
  ]
}
```

---

## 💰 Pricing Model

### Credit Costs
- **1 enrichment = 1 credit**
- **Price per credit (overage)**: $0.05/credit
- **Examples**:
  - 100 enrichments = 100 credits = $5.00 (if over quota)
  - 500 enrichments = 500 credits = $25.00 (if over quota)
  - 1,000 enrichments = 1,000 credits = $50.00 (if over quota)

### Free Tier (InnovareAI only)
- 2,000 credits/month free
- Resets on 1st of each month

### Invoice Terms
- **Net 30**: Payment due 30 days after invoice date
- **Monthly billing**: Invoices generated on 1st of each month
- **Grace period**: 5-day grace before account suspension

---

## 🔄 Monthly Reset Process

```sql
-- Automated cron job (runs 1st of each month at midnight)
CREATE OR REPLACE FUNCTION reset_monthly_credits()
RETURNS void AS $$
BEGIN
  -- Reset credit counters for InnovareAI clients with credit_card billing
  UPDATE enrichment_credits
  SET 
    credits_used = 0,
    billing_period_start = date_trunc('month', NOW()),
    billing_period_end = date_trunc('month', NOW()) + INTERVAL '1 month',
    last_reset_at = NOW(),
    next_reset_at = date_trunc('month', NOW()) + INTERVAL '1 month',
    updated_at = NOW()
  WHERE workspace_id IN (
    SELECT id FROM workspaces 
    WHERE company = 'InnovareAI' 
    AND billing_method = 'credit_card'
  );
  
  -- Generate invoices for invoice-based clients
  PERFORM generate_monthly_invoices();
END;
$$ LANGUAGE plpgsql;
```

---

## 🎯 Implementation Priority

**Priority**: **Second Priority** (after core campaign features)

### Phase 1: Database Setup
- [ ] Create billing tables
- [ ] Add tenant type & billing method to workspaces
- [ ] Create credit tracking system

### Phase 2: API Endpoints
- [ ] Eligibility check endpoint
- [ ] Payment processing endpoint
- [ ] Dashboard data endpoint
- [ ] Stripe webhook handler

### Phase 3: UI Components
- [ ] Billing dashboard page
- [ ] Credit usage widget
- [ ] Payment method management
- [ ] Invoice history view

### Phase 4: Stripe Integration
- [ ] Customer creation
- [ ] Payment intent flow
- [ ] Subscription management
- [ ] Webhook processing

### Phase 5: Invoice Generation
- [ ] Invoice PDF generation
- [ ] Email delivery
- [ ] Payment tracking
- [ ] Overdue notifications

---

## 🔐 Security Considerations

1. **Tenant Isolation**: Strict RLS policies on all billing tables
2. **Stripe Webhooks**: Verify signatures on all webhook events
3. **Credit Checking**: Server-side validation before enrichment
4. **Rate Limiting**: Prevent abuse of free tier
5. **Audit Logging**: Track all billing events

---

## 📊 Monitoring & Analytics

### Key Metrics
- Monthly recurring revenue (MRR)
- Average credits used per workspace
- Overage rate by tenant
- Invoice payment rate
- Churn rate

### Alerts
- High credit usage (80% of quota)
- Failed payments
- Overdue invoices
- Unusual usage spikes

---

## 📝 Notes

- 3cubed clients have **unlimited** enrichment (no quota enforcement)
- InnovareAI clients can switch billing methods via account settings
- Super admins can override billing rules for specific workspaces
- System supports future tiered pricing models

---

**Document Status**: Design Complete - Awaiting Implementation  
**Last Updated**: October 1, 2025  
**Priority Level**: Second Priority
