# Handover: Supabase to Firebase Migration
**Date:** December 31, 2025
**Session Focus:** Complete migration from Supabase Auth to Firebase Auth + Firebase Storage

---

## Summary

Completed a major migration of the SAM AI platform from Supabase authentication and storage to Firebase. This involved migrating ~150 API routes and 2 storage endpoints.

---

## What Was Done

### 1. API Routes Migration (Auth)

Migrated ~150 API routes from legacy Supabase auth patterns to Firebase auth:

**Before:**
```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const supabase = createRouteHandlerClient({ cookies });
const { data: { session } } = await supabase.auth.getSession();
const { data } = await supabase.from('table').select().eq('id', id);
```

**After:**
```typescript
import { verifyAuth, pool, AuthError } from '@/lib/auth';

const { userId, workspaceId } = await verifyAuth(request);
const { rows } = await pool.query('SELECT * FROM table WHERE id = $1', [id]);
```

**Routes migrated by directory:**
- `campaigns/` - 17 routes
- `linkedin/` - 15+ routes
- `linkedin-commenting/` - 10 routes
- `knowledge-base/` - 14 routes
- `prospect-approval/` - 11 routes
- `prospects/` - 10 routes
- `companies/` - 3 routes
- `admin/` - 7+ routes
- `workspace/` - 5 routes
- `unipile/` - 6 routes
- `sam/` - 5+ routes
- Plus many more misc routes

**Routes NOT migrated (intentionally):**
- `auth/session`, `auth/signin`, `auth/signup` - Handle Firebase auth flow itself
- `webhooks/*` - Use API key/webhook signature authentication

### 2. Middleware/Proxy Update

Fixed Next.js 16 middleware conflict:
- Deleted `middleware.ts` (legacy Supabase-based)
- Updated `proxy.ts` to use Firebase session cookie authentication
- Proxy now checks for `session` cookie instead of Supabase auth

### 3. Firebase Storage Migration

Migrated file storage from Supabase Storage to Firebase Storage:

**Files changed:**
- `lib/firebase-admin.ts` - Added `getAdminStorage()` and `getStorageBucket()`
- `app/api/sam/attachments/route.ts` - SAM AI file attachments
- `app/api/dpa/generate-pdf/route.ts` - Signed DPA PDF storage

**Storage paths:**
- `sam-attachments/{userId}/{threadId}/{timestamp}_{filename}` - User file uploads
- `legal-documents/{workspaceId}_{version}.pdf` - Signed legal documents

---

## Key Files Modified

### Core Auth Library
- **`lib/auth.ts`** - Firebase auth verification + PostgreSQL pool
  - `verifyAuth(request)` - Returns `{ userId, workspaceId, userEmail, workspaceRole, permissions }`
  - `pool` - PostgreSQL connection pool for direct queries

### Firebase Admin
- **`lib/firebase-admin.ts`** - Firebase Admin SDK
  - `getAdminAuth()` - For session verification
  - `getAdminFirestore()` - For Firestore (if needed)
  - `getAdminStorage()` - For file storage
  - `getStorageBucket()` - Get default storage bucket

### Proxy
- **`proxy.ts`** - Next.js 16 proxy/middleware
  - Checks Firebase `session` cookie
  - Handles URL rewrites for `/chat` and `/`
  - Admin route protection

---

## Environment Variables Required

```bash
# Firebase Auth (already configured)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=   # <-- Required for storage
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (already configured)
FIREBASE_SERVICE_ACCOUNT_KEY=   # Base64 encoded service account JSON
# OR
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# PostgreSQL (already configured)
DATABASE_URL=
```

---

## Packages to Remove (Future Cleanup)

After verifying production works correctly, these can be removed from `package.json`:

```json
{
  "@supabase/auth-helpers-nextjs": "^0.10.0",  // Remove
  "@supabase/ssr": "^0.7.0"                     // Remove
}
```

**Keep:**
- `@supabase/supabase-js` - Still used by `supabaseAdmin()` for some admin operations

---

## Testing Checklist

Before deploying to production:

- [ ] Test login/logout flow
- [ ] Test workspace switching
- [ ] Test file upload in SAM chat
- [ ] Test campaign creation and execution
- [ ] Test LinkedIn search functionality
- [ ] Test admin routes (with super admin email)
- [ ] Verify all API routes return proper auth errors when unauthorized

---

## Known Issues / Remaining Work

1. **Auth routes still use legacy patterns** - `auth/session`, `auth/signin`, `auth/signup` intentionally kept as-is since they handle the Firebase auth flow

2. **Some helper files still reference Supabase** - Files like `lib/supabase-route-client.ts` may still exist but aren't used by migrated routes

3. **Storage bucket permissions** - Firebase Storage bucket needs proper security rules configured

---

## Commits

1. `2e3729ac` - Migrate API routes from Supabase auth to Firebase auth (159 files)
2. `5c32bfcf` - Migrate storage from Supabase to Firebase Storage (3 files)

---

## Contact

For questions about this migration, check:
- `lib/auth.ts` - Auth pattern reference
- `lib/firebase-admin.ts` - Firebase Admin SDK setup
- Any migrated route for query pattern examples
