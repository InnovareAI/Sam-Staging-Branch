# Deploy Billing Migration to Supabase

## Status: ⚠️ BILLING TABLES NOT DEPLOYED

The billing system tables are missing from the production database and need to be deployed manually.

## Missing Tables

The following 6 tables from the billing system need to be created:

1. `tenants` - Multi-tenant organization management
2. `tenant_subscriptions` - Stripe subscription tracking
3. `tenant_invoices` - Invoice records
4. `stripe_products` - Product catalog
5. `stripe_prices` - Pricing plans
6. `workspace_tier_mapping` - Workspace to billing tier mapping

## Deployment Instructions

### Option 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**:
   - Go to https://supabase.com/dashboard
   - Select project: `latxadqrvrrrcvkktrog`

2. **Open SQL Editor**:
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Copy Migration SQL**:
   - Open file: `supabase/migrations/20251005000002_create_3cubed_billing.sql`
   - Copy entire contents

4. **Run Migration**:
   - Paste SQL into query editor
   - Click "Run" button
   - Verify "Success" message

5. **Verify Tables Created**:
   - Go to "Table Editor" in left sidebar
   - Check that all 6 tables appear in the list

### Option 2: Supabase CLI

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to project
supabase link --project-ref latxadqrvrrrcvkktrog

# Run migration
supabase db push
```

### Option 3: Direct SQL Connection

```bash
# Use psql with correct connection string
# (Get connection string from Supabase Dashboard > Project Settings > Database)

psql "postgresql://postgres:[PASSWORD]@db.latxadqrvrrrcvkktrog.supabase.co:5432/postgres" \
  -f supabase/migrations/20251005000002_create_3cubed_billing.sql
```

## Verification

After deployment, run the verification script:

```bash
node scripts/js/test-database-tables.js
```

Expected output:
```
✅ EXISTING TABLES:
   ✓ tenants (0 sample rows)
   ✓ tenant_subscriptions (0 sample rows)
   ✓ tenant_invoices (0 sample rows)
   ✓ stripe_products (0 sample rows)
   ✓ stripe_prices (0 sample rows)
   ✓ workspace_tier_mapping (0 sample rows)
   ✓ crm_connections (0 sample rows)
   ✓ crm_field_mappings (0 sample rows)
   ✓ crm_sync_logs (0 sample rows)
   ✓ magic_link_tokens (0 sample rows)
   ✓ workspaces (1 sample rows)
   ✓ workspace_members (1 sample rows)
   ✓ users (1 sample rows)

📊 Summary: 13/13 tables exist
```

## Migration File Location

```
/supabase/migrations/20251005000002_create_3cubed_billing.sql
```

## Tables Schema Summary

### 1. tenants
```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  billing_email TEXT,
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  payment_status TEXT DEFAULT 'active' CHECK (payment_status IN ('active', 'past_due', 'canceled')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. tenant_subscriptions
```sql
CREATE TABLE tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_price_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. tenant_invoices
```sql
CREATE TABLE tenant_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  stripe_invoice_id TEXT UNIQUE NOT NULL,
  amount_due INTEGER NOT NULL,
  amount_paid INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  invoice_pdf TEXT,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. stripe_products
```sql
CREATE TABLE stripe_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT NOT NULL CHECK (brand IN ('innovare', '3cubed')),
  stripe_product_id TEXT UNIQUE NOT NULL,
  description TEXT,
  features JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. stripe_prices
```sql
CREATE TABLE stripe_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES stripe_products(id) ON DELETE CASCADE NOT NULL,
  stripe_price_id TEXT UNIQUE NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  interval TEXT NOT NULL CHECK (interval IN ('month', 'year')),
  interval_count INTEGER DEFAULT 1,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6. workspace_tier_mapping
```sql
CREATE TABLE workspace_tier_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  tier_name TEXT NOT NULL CHECK (tier_name IN ('startup', 'sme', 'enterprise')),
  stripe_product_id TEXT REFERENCES stripe_products(stripe_product_id),
  stripe_price_id TEXT REFERENCES stripe_prices(stripe_price_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id)
);
```

## Security Features

All tables have:
- ✅ Row Level Security (RLS) enabled
- ✅ Service role bypass for admin operations
- ✅ Automatic `updated_at` triggers
- ✅ Performance indexes on key columns
- ✅ Foreign key constraints with CASCADE deletes

## Post-Deployment Steps

1. **Verify Tables**: Run `node scripts/js/test-database-tables.js`
2. **Test API Endpoints**: Test billing API endpoints work
3. **Configure Stripe**: Create products and prices in Stripe dashboard
4. **Add Initial Data**: Optionally seed stripe_products table

## Troubleshooting

### Error: "permission denied for table"
- Ensure you're using the service role key or admin credentials
- Check RLS policies are correctly configured

### Error: "relation already exists"
- Tables may be partially created
- Drop existing tables first: `DROP TABLE IF EXISTS table_name CASCADE;`
- Or modify migration to use `CREATE TABLE IF NOT EXISTS`

### Error: "could not connect to database"
- Check database credentials
- Verify IP whitelist in Supabase dashboard
- Try using connection pooler port (6543) instead of direct (5432)

## Support

For issues deploying this migration:
1. Check Supabase logs in dashboard
2. Verify connection string is correct
3. Ensure database is not in read-only mode
4. Contact Supabase support if persistent issues

---

**Created**: October 5, 2025
**Priority**: HIGH - Required for billing system to function
**Estimated Time**: 5 minutes
