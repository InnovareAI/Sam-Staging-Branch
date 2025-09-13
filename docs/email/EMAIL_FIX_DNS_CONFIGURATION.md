# 🚨 URGENT EMAIL FIX - DNS CONFIGURATION

## IMMEDIATE ACTIONS REQUIRED

### 1. UPDATE SPF RECORD (5 MINUTES)

**Current SPF Record:**
```
Name: innovareai.com
Type: TXT
Value: "v=spf1 include:_spf.google.com include:emsd1.com ~all"
```

**NEW SPF Record (Replace existing):**
```
Name: innovareai.com
Type: TXT
Value: "v=spf1 include:_spf.google.com include:emsd1.com include:spf.postmarkapp.com ~all"
```

### 2. ADD POSTMARK DKIM RECORD (CRITICAL)

**Steps to get DKIM record:**
1. Login to Postmark Dashboard: https://account.postmarkapp.com/
2. Go to "Domains" section
3. Find "innovareai.com" domain
4. Copy the DKIM TXT record (something like):

**Expected DKIM Record Format:**
```
Name: 20240228185946pm._domainkey.innovareai.com
Type: TXT
Value: "k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC..." (long key)
```

### 3. ADD DMARC RECORD (RECOMMENDED)
```
Name: _dmarc.innovareai.com
Type: TXT
Value: "v=DMARC1; p=quarantine; rua=mailto:postmaster@innovareai.com"
```

---

## 📝 STEP-BY-STEP DNS CONFIGURATION

### AWS Route 53 Configuration:

1. **Login to AWS Console**
   - Go to Route 53
   - Select "innovareai.com" hosted zone

2. **Update SPF Record**
   - Find existing TXT record with SPF
   - Edit and replace value with new SPF (above)
   - Save changes

3. **Add DKIM Record**
   - Create new TXT record
   - Name: `20240228185946pm._domainkey.innovareai.com`
   - Value: [Get from Postmark dashboard]
   - TTL: 300
   - Save

4. **Add DMARC Record**
   - Create new TXT record  
   - Name: `_dmarc.innovareai.com`
   - Value: `"v=DMARC1; p=quarantine; rua=mailto:postmaster@innovareai.com"`
   - TTL: 300
   - Save

---

## ⚡ POSTMARK DASHBOARD ACCESS

**To get DKIM records:**
1. Go to: https://account.postmarkapp.com/servers/bf9e070d-eec7-4c41-8fb5-1d37fe384723/domains
2. Find "innovareai.com" domain
3. Click "Verify" or "DNS Settings"
4. Copy the exact DKIM TXT record values

**If domain not found in Postmark:**
1. Add "innovareai.com" as a verified domain
2. Follow Postmark's domain verification process
3. Get DKIM keys and add to DNS

---

## 🔍 VERIFICATION COMMANDS

**After DNS changes, test with:**

```bash
# Check SPF record
dig TXT innovareai.com | grep spf

# Check DKIM record (replace with actual selector)
dig TXT 20240228185946pm._domainkey.innovareai.com

# Check DMARC record  
dig TXT _dmarc.innovareai.com

# Test email authentication
curl -X POST "https://api.postmarkapp.com/email" \
  -H "X-Postmark-Server-Token: bf9e070d-eec7-4c41-8fb5-1d37fe384723" \
  -d '{
    "From": "sp@innovareai.com",
    "To": "test@gmail.com", 
    "Subject": "DNS Fix Test",
    "HtmlBody": "<p>Testing after DNS changes</p>"
  }'
```

---

## ⏰ EXPECTED TIMELINE

- **DNS Propagation**: 15-30 minutes
- **Email delivery improvement**: Immediate after propagation
- **Full deliverability**: 1-2 hours

---

## 🎯 SUCCESS METRICS

**Before DNS fixes:**
- Emails sent: ✅ Working
- Inbox delivery: ❌ Going to spam

**After DNS fixes:**  
- Emails sent: ✅ Working
- Inbox delivery: ✅ Should work
- DKIM authentication: ✅ Passing
- SPF authentication: ✅ Passing

---

**URGENT**: Complete these DNS changes immediately to fix email delivery issues!