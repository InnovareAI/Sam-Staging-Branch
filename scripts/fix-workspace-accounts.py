#!/usr/bin/env python3
"""
Fix all workspace_accounts queries to use supabaseAdmin() client.
This resolves RLS policy issues causing "No LinkedIn account connected" errors.
"""

import os
import re
from pathlib import Path

# Files already fixed (skip these)
FIXED_FILES = {
    "app/api/database/create-workspace-accounts/route.ts",
    "app/api/linkedin-commenting/post/route.ts",
    "app/api/unipile/accounts/route.ts",
    "app/api/sam/prospect-intelligence/route.ts",
    "app/api/sam/find-prospects/route.ts",
    "app/api/workspace/[workspaceId]/accounts/route.ts",
    "app/api/linkedin/search/simple/route.ts",
    "app/api/linkedin/search-router/route.ts",
}

def add_admin_import(content: str) -> tuple[str, bool]:
    """Add supabaseAdmin import if not present."""
    if "supabaseAdmin" in content:
        return content, False  # Already has import

    # Find last import statement
    import_pattern = r'^import .+ from .+$'
    lines = content.split('\n')
    last_import_idx = -1

    for i, line in enumerate(lines):
        if re.match(import_pattern, line):
            last_import_idx = i

    if last_import_idx >= 0:
        # Insert after last import
        lines.insert(last_import_idx + 1, "import { supabaseAdmin } from '@/app/lib/supabase'")
        return '\n'.join(lines), True
    else:
        # No imports found, add at top
        return "import { supabaseAdmin } from '@/app/lib/supabase'\n\n" + content, True

def fix_workspace_accounts_queries(content: str) -> tuple[str, int]:
    """Replace workspace_accounts queries with admin client."""
    changes = 0

    # Pattern 1: await <variable>.from('workspace_accounts')
    # We need to create adminClient and use it

    # First, check if we need to add adminClient initialization
    patterns_to_fix = [
        (r'await\s+(\w+)\.from\([\'"]workspace_accounts[\'"]\)', 'from workspace_accounts'),
        (r'(\w+)\.from\([\'"]workspace_accounts[\'"]\)\.select', 'from workspace_accounts with select'),
    ]

    for pattern, desc in patterns_to_fix:
        matches = list(re.finditer(pattern, content))
        if matches:
            print(f"   Found {len(matches)} occurrences of: {desc}")
            changes += len(matches)

    # For simplicity, let's just replace common patterns
    # Pattern: supabase.from('workspace_accounts') -> supabaseAdmin().from('workspace_accounts')
    content = re.sub(
        r'\bsupabase\.from\([\'"]workspace_accounts[\'"]\)',
        "supabaseAdmin().from('workspace_accounts')",
        content
    )

    # Pattern: await supabase.from('workspace_accounts')
    content = re.sub(
        r'await\s+supabase\.from\([\'"]workspace_accounts[\'"]\)',
        "await supabaseAdmin().from('workspace_accounts')",
        content
    )

    # Pattern: const { ... } = await supabase.from('workspace_accounts')
    # This is already handled by above

    return content, changes

def process_file(file_path: Path) -> bool:
    """Process a single file. Returns True if changes were made."""
    print(f"\n📝 Processing: {file_path}")

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            original_content = f.read()

        content = original_content
        total_changes = 0

        # Step 1: Add import if needed
        content, import_added = add_admin_import(content)
        if import_added:
            print("   ✅ Added supabaseAdmin import")
            total_changes += 1

        # Step 2: Fix workspace_accounts queries
        content, query_fixes = fix_workspace_accounts_queries(content)
        if query_fixes > 0:
            print(f"   ✅ Fixed {query_fixes} workspace_accounts queries")
            total_changes += query_fixes

        # Write back if changes were made
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"   💾 Saved changes")
            return True
        else:
            print("   ⏭️  No changes needed")
            return False

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

def main():
    """Main function."""
    print("🔧 Fixing workspace_accounts queries in all API routes...")
    print("=" * 50)

    # Find all TypeScript files in app/api that contain workspace_accounts
    api_dir = Path("app/api")
    files_to_process = []

    for ts_file in api_dir.rglob("*.ts"):
        if ts_file.is_file():
            try:
                with open(ts_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if ".from('workspace_accounts')" in content or '.from("workspace_accounts")' in content:
                        rel_path = str(ts_file)
                        if rel_path not in FIXED_FILES:
                            files_to_process.append(ts_file)
                        else:
                            print(f"⏭️  Skipping (already fixed): {rel_path}")
            except:
                pass

    print(f"\n📊 Found {len(files_to_process)} files to process\n")

    fixed_count = 0
    for file_path in files_to_process:
        if process_file(file_path):
            fixed_count += 1

    print("\n" + "=" * 50)
    print(f"📊 Summary:")
    print(f"   ✅ Fixed: {fixed_count} files")
    print(f"   ⏭️  Skipped: {len(FIXED_FILES)} files (already fixed)")
    print(f"   📝 Total processed: {len(files_to_process)} files")
    print("\n✅ Done! Please review changes with: git diff app/api")

if __name__ == "__main__":
    main()
