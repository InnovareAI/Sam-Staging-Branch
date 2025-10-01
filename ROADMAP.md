# Sam AI Platform - Development Roadmap

## 🎯 Current Sprint (Priority 1)

### LinkedIn Campaign System
- [x] LinkedIn OAuth integration
- [x] LinkedIn proxy management with Bright Data
- [x] LinkedIn account status monitoring
- [x] Campaign builder UI at `/campaigns`
- [ ] **LinkedIn/Sales Nav Search Integration**
  - [ ] Integrate Apify LinkedIn scraper
  - [ ] ICP-based search query generation
  - [ ] Search results preview & approval UI
  - [ ] Results validation and enrichment
- [ ] **CSV Upload for Prospects**
  - [x] CSV parsing and field mapping
  - [x] Data validation
  - [x] Duplicate detection
  - [ ] Upload UI component
  - [ ] Preview and approval workflow
  - [ ] Integration with campaign builder
- [ ] **Prospect Approval Workflow**
  - [ ] Unified approval UI for both LinkedIn search and CSV upload
  - [ ] Bulk approve/reject functionality
  - [ ] Individual prospect review
  - [ ] Quality scoring display
  - [ ] Export approved prospects to campaign

---

## 💳 Next Sprint (Priority 2)

### Tenant-Based Billing System

**Design Doc**: `/docs/billing/TENANT_BASED_BILLING_SYSTEM.md`

#### Phase 1: Database & Infrastructure (Week 1-2)
- [ ] Create billing database schema
  - [ ] `enrichment_credits` table
  - [ ] `enrichment_usage_log` table
  - [ ] `monthly_invoices` table
- [ ] Add billing fields to `workspaces` table
  - [ ] `company` (InnovareAI | 3cubed)
  - [ ] `billing_method` (credit_card | invoice)
  - [ ] `stripe_customer_id`
  - [ ] `billing_contact_email`
- [ ] Configure Stripe account
  - [ ] Create Stripe account (if needed)
  - [ ] Add API keys to environment
  - [ ] Set up webhook endpoints

#### Phase 2: API Development (Week 3-4)
- [ ] **Billing API Endpoints**
  - [ ] `/api/billing/check-enrichment-eligibility` - Check if user can enrich
  - [ ] `/api/billing/process-enrichment` - Process payment/logging
  - [ ] `/api/billing/dashboard` - Get billing info for user
  - [ ] `/api/billing/stripe/webhook` - Handle Stripe events
  - [ ] `/api/billing/invoices` - Generate and retrieve invoices

#### Phase 3: Stripe Integration (Week 5)
- [ ] **Payment Flow**
  - [ ] Customer creation on workspace setup
  - [ ] Payment method attachment
  - [ ] Payment intent creation for overages
  - [ ] Charge processing
  - [ ] Webhook signature verification
  - [ ] Failed payment handling

#### Phase 4: Invoice System (Week 6)
- [ ] **Invoice Generation**
  - [ ] Monthly invoice generation cron job
  - [ ] PDF invoice generation
  - [ ] Email delivery via Postmark
  - [ ] Invoice tracking (sent, paid, overdue)
  - [ ] Payment reconciliation

#### Phase 5: UI/UX (Week 7-8)
- [ ] **Billing Dashboard**
  - [ ] Credit usage widget
  - [ ] Current period summary
  - [ ] Overage warnings
  - [ ] Payment method management
  - [ ] Invoice history
- [ ] **Pre-Enrichment Checks**
  - [ ] Show credit cost before CSV upload
  - [ ] Show estimated charges
  - [ ] Payment confirmation modal (if charging)
  - [ ] Add payment method flow

#### Phase 6: Testing & Launch (Week 9-10)
- [ ] **Testing**
  - [ ] Test InnovareAI CC billing flow
  - [ ] Test InnovareAI invoice billing flow
  - [ ] Test 3cubed invoice billing flow
  - [ ] Test monthly credit resets
  - [ ] Test invoice generation
  - [ ] Test webhook handling
- [ ] **Documentation**
  - [ ] User billing guide
  - [ ] Admin billing management guide
  - [ ] Troubleshooting guide
- [ ] **Soft Launch**
  - [ ] Enable for select test workspaces
  - [ ] Monitor for issues
  - [ ] Full production rollout

---

## 🔮 Future Features (Priority 3)

### Advanced Enrichment
- [ ] Multiple data provider integration (Apollo, ZoomInfo, etc.)
- [ ] Real-time enrichment status tracking
- [ ] Enrichment quality scoring
- [ ] Custom enrichment fields

### Campaign Analytics
- [ ] Response rate tracking
- [ ] ROI calculation
- [ ] A/B testing framework
- [ ] Predictive analytics

### Team Collaboration
- [ ] Shared prospect lists
- [ ] Campaign templates
- [ ] Commenting and notes
- [ ] Activity feed

### Integrations
- [ ] CRM sync (Salesforce, HubSpot)
- [ ] Calendar integration (Google, Outlook)
- [ ] Slack notifications
- [ ] Zapier integration

---

## 📋 Backlog

### Performance Optimization
- [ ] Database query optimization
- [ ] Caching layer implementation
- [ ] CDN for static assets
- [ ] Background job processing

### Security Enhancements
- [ ] 2FA implementation
- [ ] Audit logging
- [ ] Role-based access control (RBAC)
- [ ] Compliance certifications (SOC 2, GDPR)

### Developer Experience
- [ ] API documentation
- [ ] Webhook documentation
- [ ] SDK development
- [ ] Code examples and tutorials

---

## 🚀 Completed Features

### Authentication & Multi-Tenancy
- [x] Supabase authentication
- [x] Multi-tenant workspace system
- [x] User invitations
- [x] Role management (super admin, workspace admin, member)

### Sam AI Chat
- [x] Conversation threading
- [x] Message persistence
- [x] Knowledge base integration
- [x] File uploads (PDFs, documents)
- [x] Memory system

### LinkedIn Integration
- [x] Unipile OAuth flow
- [x] Account connection
- [x] Account status monitoring
- [x] Proxy IP assignment
- [x] Dedicated IP management

### System Administration
- [x] Workspace management
- [x] User management
- [x] MCP health monitoring
- [x] Activity logging

---

## 📊 Metrics & KPIs

### Development Velocity
- Sprint velocity: Track story points per sprint
- Bug resolution time: < 24 hours for critical, < 3 days for normal
- Feature completion rate: 80% of planned features per sprint

### Product Quality
- Test coverage: > 80%
- Uptime: 99.9% SLA
- Page load time: < 2 seconds
- API response time: < 500ms p95

### Business Metrics
- User activation rate: 70% within first week
- Feature adoption: 60% of users trying new features within first month
- Customer retention: 90% monthly retention
- Revenue per workspace: Track MRR growth

---

**Last Updated**: October 1, 2025  
**Current Sprint**: Priority 1 - LinkedIn Campaign System  
**Next Sprint**: Priority 2 - Tenant-Based Billing System
