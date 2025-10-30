# Single LinkedIn URL Import Guide

## Problem

When trying to import a single LinkedIn profile, you get:
```
Error: Connection degree is required. Please specify "1st", "2nd", or "3rd" degree connections.
```

## Why This Happens

This error comes from the **LinkedIn Search API**, which requires specifying connection degree. However, you don't want to search - you want to import a specific URL.

## Solution: Use CSV Import (No Connection Degree Needed)

### Method 1: Single URL CSV

**Create a simple CSV file** with just the LinkedIn URL:

```csv
linkedin_url
https://linkedin.com/in/johndoe
```

**Or with more details:**

```csv
name,title,company,linkedin_url
John Doe,CEO,Acme Corp,https://linkedin.com/in/johndoe
```

**Then upload:**
1. Go to Campaign Hub
2. Click "Upload CSV"
3. Select your CSV file
4. System will import without requiring connection degree

### Method 2: Copy-Paste Multiple URLs

If you have multiple URLs, create a CSV:

```csv
linkedin_url
https://linkedin.com/in/person1
https://linkedin.com/in/person2
https://linkedin.com/in/person3
```

### Method 3: Use Existing Prospects

If you've already connected with this person on LinkedIn:
1. Go to "Select Prospects" tab
2. System will show your existing 1st degree connections
3. Select the person directly (no CSV needed)

---

## CSV Format Options

The CSV parser is flexible and accepts many formats:

### Minimal (LinkedIn URL only)
```csv
linkedin_url
https://linkedin.com/in/johndoe
```

### Standard (Name + LinkedIn)
```csv
name,linkedin_url
John Doe,https://linkedin.com/in/johndoe
Jane Smith,https://linkedin.com/in/janesmith
```

### Full Details
```csv
name,title,company,email,phone,linkedin_url
John Doe,CEO,Acme Corp,john@acme.com,555-1234,https://linkedin.com/in/johndoe
Jane Smith,CTO,Tech Inc,jane@tech.com,555-5678,https://linkedin.com/in/janesmith
```

### Alternative Header Names (All Supported)

The system recognizes these column headers:
- **LinkedIn**: `linkedin_url`, `linkedin`, `linkedin profile`, `profile_link`, `profile_url`, `profile`
- **Name**: `name`, `full name`, `fullname`, OR `first_name` + `last_name`
- **Title**: `title`, `job title`, `position`
- **Company**: `company`, `company name`, `organization`

---

## When Connection Degree IS Required

Connection degree is ONLY needed for:
- ✅ **LinkedIn Search** (searching for new prospects you don't have URLs for)
- ✅ **SAM AI Search** ("find me 25 CEOs in San Francisco")

Connection degree is NOT needed for:
- ❌ **CSV Upload** (you already have the URLs)
- ❌ **Select Existing Prospects** (they're already in your network)

---

## Quick Reference

| Import Method | Connection Degree Required? | Use Case |
|---------------|----------------------------|----------|
| **CSV Upload** | ❌ No | You have LinkedIn URLs |
| **LinkedIn Search** | ✅ Yes (1st/2nd/3rd) | Search for new prospects |
| **SAM AI Search** | ✅ Yes (1st/2nd/3rd) | AI-powered prospect discovery |
| **Select Existing** | ❌ No | Use prospects already in system |

---

## Example: Import Single Prospect

**Step 1:** Create `prospect.csv`
```csv
linkedin_url
https://linkedin.com/in/johndoe
```

**Step 2:** Upload in Campaign Hub
- Click "Upload CSV"
- Select `prospect.csv`
- System imports immediately

**Step 3:** Create Campaign
- Prospect appears in campaign builder
- No connection degree needed
- Ready to send messages

---

## Troubleshooting

### Error: "Connection degree is required"
**Cause:** You're using LinkedIn Search instead of CSV Upload
**Solution:** Use CSV Upload feature instead

### Error: "CSV must contain linkedin_url column"
**Cause:** CSV doesn't have a recognized LinkedIn column header
**Solution:** Use one of: `linkedin_url`, `linkedin`, `profile_link`

### Error: "No valid prospects found"
**Cause:** LinkedIn URL column is empty or malformed
**Solution:** Ensure URLs start with `https://linkedin.com/in/`

---

**Last Updated:** October 30, 2025
**Quick Summary:** CSV uploads don't need connection degree - just upload URLs directly!
