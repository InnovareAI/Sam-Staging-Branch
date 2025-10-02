# 🚨 DIRECTORY SAFETY CHECKLIST

## Before Starting ANY Task

```bash
# 1. Check where you are
pwd

# 2. Verify it shows this EXACT path:
/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7

# 3. Run the safety verification script
./scripts/shell/verify-safe-directory.sh

# 4. Only proceed if you see: ✅ SAFE
```

## Before EVERY File Operation

- [ ] Path contains `/Sam-New-Sep-7/`
- [ ] NOT using `cd ..` or `cd ~`
- [ ] NOT using `../../` in paths
- [ ] NOT accessing `/3cubed/` or `/SEO_Platform/`
- [ ] When in doubt, ASK the user

## Red Flags - STOP Immediately If You See

❌ `cd /Users/tvonlinz/Dev_Master/3cubed/`
❌ `cd /Users/tvonlinz/Dev_Master/SEO_Platform/`
❌ `Read /Users/tvonlinz/Dev_Master/3cubed/...`
❌ `Edit ../../3cubed/...`
❌ Any path WITHOUT `/Sam-New-Sep-7/`

## Safe Patterns - These Are OK

✅ `cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7`
✅ `Read /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/package.json`
✅ `Edit app/api/test.ts` (relative within project)
✅ `ls components/` (relative within project)

## Emergency Stop Command

If Claude starts doing something in the wrong directory:

**Type immediately**: STOP - Wrong directory!

Then:
```bash
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
pwd
```

## Quick Reminder for Claude

> "You are working on Sam-New-Sep-7 ONLY.
> You have killed 2 projects before by working in wrong directories.
> Always verify with `pwd` before file operations.
> Never touch /3cubed/ or /SEO_Platform/."

---

**Print this checklist and keep it visible during Claude sessions!**
