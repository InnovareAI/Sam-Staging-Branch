# SendingCell Magic Link Fix

## Issue
Magic link authentication not working on sendingcell.com domain

## Root Cause
Supabase Auth redirect URLs may not include sendingcell.com domain

## Fix Steps

### 1. Add Redirect URLs in Supabase Dashboard

Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/auth/url-configuration

Add these URLs to **Redirect URLs**:
```
https://www.sendingcell.com/**
https://sendingcell.com/**
https://app.meet-sam.com/**
http://localhost:3000/**
```

### 2. Update Site URL (if needed)

Set **Site URL** to:
```
https://www.sendingcell.com
```

Or use a wildcard:
```
https://*.sendingcell.com
```

### 3. Check Magic Link Email Template

Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/auth/templates

Ensure the magic link template uses the correct redirect:
```html
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

## User Details

**Jim Heim:**
- Email: jim.heim@sendingcell.com
- User ID: 7ca2fb4e-469e-464f-84b6-62171dd90eaf
- Workspace: Sendingcell Workspace (b070d94f-11e2-41d4-a913-cc5a8c017208)
- Role: member
- Status: ✅ Properly set up in database

## Testing

After configuration:
1. Go to sendingcell.com
2. Enter jim.heim@sendingcell.com
3. Click magic link in email
4. Should redirect to sendingcell.com and log in successfully

## Alternative: Update DNS/Routing

If sendingcell.com should redirect to app.meet-sam.com:
1. Update DNS CNAME: sendingcell.com → app.meet-sam.com
2. Or use Netlify domain aliasing
3. Update magic link template to always use app.meet-sam.com
