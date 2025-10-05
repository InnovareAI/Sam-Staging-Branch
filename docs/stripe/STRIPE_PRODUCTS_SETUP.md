# Stripe Products Setup - InnovareAI

**Created:** October 5, 2025
**Stripe Account:** InnovareAI
**Mode:** Live (Production)

---

## Products Created

### 1. SAM AI - Per Seat

**Product ID:** `prod_TB2mOzAlCcFxdG`
**Description:** 2,000 AI enrichments + 2,000 sent messages per month per seat. Unlimited contact uploads (LinkedIn and/or Email).
**Billing:** Per seat (user)

**Dual Quota System:**
- **2,000 enrichments/month:** AI processing (scraping, email finding, scoring, qualification)
- **2,000 sends/month:** Outreach messages (LinkedIn + Email combined)
- **Unlimited uploads:** Customer's own data doesn't count toward quotas

**Prices:**

| Plan | Interval | Price | Price ID | Discount |
|------|----------|-------|----------|----------|
| Monthly (Promotional) | month | $99/seat | `price_1SEghYIuNCeYpEByY7TlnTkP` | Base promotional price |
| Annual (20% off) | year | $950.40/seat/year | `price_1SEghiIuNCeYpEByHtAt1Uwa` | $99 × 12 × 0.8 |

**Future Pricing:**
- Regular monthly price will be $199/seat
- Use coupon `LAUNCH99` to reduce $199 to $99 during promotions

---

### 2. SAM AI - SME

**Product ID:** `prod_TB2nj4ahrl2CrH`
**Description:** 5,000 AI enrichments + 5,000 sent messages per month across 2 accounts. Unlimited contact uploads (LinkedIn and/or Email).
**Billing:** Flat rate (not per seat)

**Dual Quota System:**
- **5,000 enrichments/month:** AI processing shared across team
- **5,000 sends/month:** Outreach messages across 2 accounts (LinkedIn + Email)
- **Unlimited uploads:** Customer's own data doesn't count toward quotas

**Prices:**

| Plan | Interval | Price | Price ID | Discount |
|------|----------|-------|----------|----------|
| Monthly | month | $499/month | `price_1SEgi2IuNCeYpEByghbiiGe0` | - |
| Annual (20% off) | year | $4,790.40/year | `price_1SEgiCIuNCeYpEByNrOcyCZa` | $499 × 12 × 0.8 |

---

## Promotional Coupons

### MULTISEAT10
- **Type:** Percent off
- **Discount:** 10% off
- **Duration:** Forever
- **Use Case:** Apply to customers with 2+ seats
- **Example:** 2 seats at $99/seat = $198/month → $178.20/month with MULTISEAT10

### LAUNCH99
- **Type:** Amount off
- **Discount:** $100 off per month
- **Duration:** Forever
- **Currency:** USD
- **Use Case:** When base price increases to $199/seat, use this code to offer $99/seat promotional pricing
- **Example:** $199/seat → $99/seat with LAUNCH99

---

## Trial Configuration

**All products include:**
- 14-day free trial
- Payment method required upfront (Setup Intent)
- No charge during trial
- Auto-charge on day 14

---

## Environment Variables

Added to `.env.local`:

```bash
# Stripe Configuration (InnovareAI)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_34pDSKjlunhRaF79QDWodhrJ00gv7MchuB
STRIPE_SECRET_KEY=sk_live_nH6K8J6NzSZVGrbAMdSJHOVE00sa9acXiU

# Stripe Price IDs - Per Seat Plan
NEXT_PUBLIC_STRIPE_PERSEAT_MONTHLY_PRICE_ID=price_1SEghYIuNCeYpEByY7TlnTkP
NEXT_PUBLIC_STRIPE_PERSEAT_ANNUAL_PRICE_ID=price_1SEghiIuNCeYpEByHtAt1Uwa

# Stripe Price IDs - SME Plan
NEXT_PUBLIC_STRIPE_SME_MONTHLY_PRICE_ID=price_1SEgi2IuNCeYpEByghbiiGe0
NEXT_PUBLIC_STRIPE_SME_ANNUAL_PRICE_ID=price_1SEgiCIuNCeYpEByNrOcyCZa
```

---

## Pricing Strategy

### Current Launch Pricing (Promotional)
- **Per Seat:** $99/month per user
- **SME:** $499/month flat rate

### Discounts
1. **Multi-Seat Discount:** 10% off for 2+ seats (applied via `MULTISEAT10` coupon)
2. **Annual Discount:** 20% off (pre-calculated in annual price IDs)

### Future Regular Pricing
- **Per Seat:** Will increase to $199/month per user
- **Promotional Access:** Use `LAUNCH99` coupon to reduce $199 → $99

---

## Usage in Code

### For SignupFlow component:

Update the plan selector to use per-seat pricing instead of "Startup" plan:

```typescript
// Current (needs update)
const PLAN_DETAILS = {
  startup: { amount: 99, name: 'Startup' },  // ❌ Old
  sme: { amount: 399, name: 'SME' }          // ❌ Old amount
}

// New (per-seat + updated SME)
const PLAN_DETAILS = {
  perseat: { amount: 99, name: 'Per Seat', priceId: process.env.NEXT_PUBLIC_STRIPE_PERSEAT_MONTHLY_PRICE_ID },
  sme: { amount: 499, name: 'SME', priceId: process.env.NEXT_PUBLIC_STRIPE_SME_MONTHLY_PRICE_ID }
}
```

### For subscription creation API:

```typescript
const priceId = plan === 'perseat'
  ? process.env.NEXT_PUBLIC_STRIPE_PERSEAT_MONTHLY_PRICE_ID
  : process.env.NEXT_PUBLIC_STRIPE_SME_MONTHLY_PRICE_ID

// For per-seat: quantity = number of seats
// For SME: quantity = 1 (flat rate)
const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [{
    price: priceId,
    quantity: plan === 'perseat' ? seatCount : 1
  }],
  trial_period_days: 14,
  // ... other config
})
```

---

## Stripe Dashboard Links

- **Products:** https://dashboard.stripe.com/products
- **Prices:** https://dashboard.stripe.com/prices
- **Coupons:** https://dashboard.stripe.com/coupons
- **Customers:** https://dashboard.stripe.com/customers
- **Subscriptions:** https://dashboard.stripe.com/subscriptions

---

## Next Steps

1. ✅ Products and prices created
2. ✅ Coupons created
3. ✅ Environment variables configured
4. ⏳ Update SignupFlow to support per-seat vs flat-rate plans
5. ⏳ Update Stripe subscription API to handle seat quantity
6. ⏳ Add seat management UI for per-seat customers
7. ⏳ Implement coupon code application during checkout

---

**Note:** This is production (live mode). Test all flows thoroughly before directing real customers to signup.
