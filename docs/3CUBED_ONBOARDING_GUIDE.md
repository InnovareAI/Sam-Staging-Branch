# 3cubed Enterprise Customer Onboarding Guide

## Overview

3cubed enterprise customers use a magic link onboarding system that bypasses self-service signup and Stripe payment collection. This system provides a white-glove onboarding experience.

## Onboarding Flow

```
Admin creates user → Magic link sent via email → User clicks link →
Auto-login → Password setup → Redirect to SAM AI
```

## How to Onboard a New 3cubed Customer

### Step 1: Create Magic Link

Call the magic link creation API with customer details:

```bash
curl -X POST https://app.meet-sam.com/api/auth/magic-link/create \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@company.com",
    "firstName": "John",
    "lastName": "Doe",
    "workspaceName": "Acme Corporation",
    "organizationId": "3cubed-org-id"
  }'
```

**Response:**
```json
{
  "success": true,
  "userId": "uuid-here",
  "workspaceId": "uuid-here",
  "magicLink": "https://app.meet-sam.com/auth/magic/TOKEN",
  "expiresAt": "2025-10-06T10:00:00Z",
  "emailSent": true
}
```

### Step 2: Customer Receives Email

The customer will receive an email from **3cubed domain** (e.g., `noreply@3cubed.com`) with:
- Welcome message
- Magic link button
- Expiration notice (24 hours)
- Instructions

### Step 3: Customer Clicks Magic Link

When the customer clicks the magic link:
1. **Auto-login** - Session created automatically (no password required yet)
2. **One-time use** - Token marked as "used" in database
3. **Redirect** - Sent to `/auth/setup-password`

### Step 4: Customer Sets Password

Customer creates a secure password with requirements:
- Minimum 8 characters
- One uppercase letter
- One lowercase letter
- One number
- One special character

### Step 5: Access Granted

After setting password, customer is redirected to main SAM AI interface at `/` (app.meet-sam.com)

## Database Tables

### `magic_link_tokens`

Stores one-time use magic links for enterprise onboarding.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `token` | TEXT | Unique magic link token |
| `user_id` | UUID | References auth.users |
| `used` | BOOLEAN | Whether token has been used |
| `expires_at` | TIMESTAMPTZ | Expiration time (24 hours) |
| `used_at` | TIMESTAMPTZ | When token was used |
| `created_at` | TIMESTAMPTZ | Creation time |

### Migration

Apply the migration:

```bash
psql -h <supabase-host> -U postgres -d postgres -f supabase/migrations/20251005000001_create_magic_link_tokens.sql
```

Or via Supabase dashboard → SQL Editor → paste migration content.

## Email Configuration

### Environment Variables

Add to `.env.local`:

```bash
# 3cubed Postmark (separate from InnovareAI)
POSTMARK_3CUBED_SERVER_TOKEN=your-3cubed-postmark-token
POSTMARK_3CUBED_FROM_EMAIL=noreply@3cubed.com

# InnovareAI Postmark (separate from 3cubed)
POSTMARK_SERVER_TOKEN=your-innovareai-postmark-token
POSTMARK_FROM_EMAIL=noreply@innovareai.com
```

### Email Template

The magic link email includes:
- Branded header (SAM AI + 3cubed)
- Call-to-action button
- Security warning (24-hour expiration)
- Plain text fallback
- Footer with 3cubed attribution

## Security Features

1. **One-time use** - Token cannot be reused after first click
2. **Time-limited** - Links expire after 24 hours
3. **Email verification** - Only sent to provided email address
4. **Auto-confirmed** - Email automatically confirmed for enterprise users
5. **Password requirements** - Strong password enforced on setup

## Differences from InnovareAI Signup

| Feature | 3cubed Enterprise | InnovareAI Self-Service |
|---------|-------------------|------------------------|
| **Entry Point** | Admin creates account | User self-signup |
| **Payment** | None (invoice-based) | Stripe (credit card) |
| **Email Domain** | 3cubed.com | innovareai.com |
| **Workspace** | Pre-created | Created during signup |
| **Trial** | None | 14-day trial |
| **Initial Login** | Magic link | Email/password |
| **Password** | Set after first login | Set during signup |

## Troubleshooting

### Magic Link Expired

If customer waits >24 hours, create a new magic link for them.

### Magic Link Already Used

Token can only be used once. Create a new magic link if needed.

### Email Not Received

1. Check spam/junk folder
2. Verify email address is correct
3. Check Postmark logs for delivery status
4. Manually send magic link URL if email failed

### Customer Can't Access `/auth/setup-password`

This page requires:
- Active session (authenticated via magic link)
- User metadata: `onboarding_type = '3cubed_enterprise'`

If customer tries to access directly without magic link, they'll be redirected to `/`.

## API Reference

### POST `/api/auth/magic-link/create`

**Purpose**: Create enterprise user account and send magic link

**Authentication**: Service role (admin only)

**Request Body**:
```json
{
  "email": "string (required)",
  "firstName": "string (required)",
  "lastName": "string (required)",
  "workspaceName": "string (optional)",
  "organizationId": "string (optional)"
}
```

**Response**: See Step 1 above

### POST `/api/auth/magic-link/verify`

**Purpose**: Verify magic link token and create session

**Authentication**: None (public endpoint)

**Request Body**:
```json
{
  "token": "string (required)"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Magic link verified successfully"
}
```

**Errors**:
- `400` - Token already used
- `400` - Token expired
- `404` - Invalid token

## Support

For issues with the onboarding system, contact the SAM AI development team.
