#!/usr/bin/env python3
"""
Fix ALL workspace_accounts queries to use supabaseAdmin() client.
This is version 2 with better pattern matching.
"""

import os
import re
from pathlib import Path

def fix_file(file_path: Path) -> bool:
    """Fix workspace_accounts queries in a file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    changes_made = False

    # Find all lines with .from('workspace_accounts') or .from("workspace_accounts")
    lines = content.split('\n')
    new_lines = []
    admin_client_declared = 'const adminClient = supabaseAdmin()' in content

    for i, line in enumerate(lines):
        if (".from('workspace_accounts')" in line or '.from("workspace_accounts")' in line):
            # Extract the variable name being used
            # Pattern: await <var>.from('workspace_accounts') or <var>.from('workspace_accounts')
            match = re.search(r'(\w+)\.from\([\'"]workspace_accounts[\'"]\)', line)

            if match:
                var_name = match.group(1)
                # Skip if already using admin client
                if var_name in ['adminClient', 'supabaseAdmin', 'adminSupabase']:
                    new_lines.append(line)
                    continue

                # Replace with admin client
                if not admin_client_declared:
                    # Need to declare adminClient first
                    # Find a good place (after auth check usually)
                    indent = len(line) - len(line.lstrip())
                    admin_declaration = ' ' * indent + 'const adminClient = supabaseAdmin()'

                    # Insert admin_declaration before this line
                    new_lines.append(admin_declaration)
                    admin_client_declared = True
                    changes_made = True

                # Now replace the query
                new_line = line.replace(f'{var_name}.from(\'workspace_accounts\')', 'adminClient.from(\'workspace_accounts\')')
                new_line = new_line.replace(f'{var_name}.from("workspace_accounts")', 'adminClient.from("workspace_accounts")')
                new_lines.append(new_line)
                changes_made = True
                print(f"   🔧 Line {i+1}: {var_name}.from('workspace_accounts') -> adminClient.from('workspace_accounts')")
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)

    if changes_made:
        new_content = '\n'.join(new_lines)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    return False

def main():
    """Main function."""
    print("🔧 Fixing workspace_accounts queries (v2 - better pattern matching)...")
    print("=" * 70)

    # Find all files already modified by v1 script (they have the import)
    api_dir = Path("app/api")
    files_with_import = []

    for ts_file in api_dir.rglob("*.ts"):
        if ts_file.is_file():
            try:
                with open(ts_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if "from '@/app/lib/supabase'" in content and "supabaseAdmin" in content:
                        if (".from('workspace_accounts')" in content or '.from("workspace_accounts")' in content):
                            files_with_import.append(ts_file)
            except:
                pass

    print(f"📊 Found {len(files_with_import)} files with import but needing query fixes\n")

    fixed_count = 0
    for file_path in files_with_import:
        print(f"\n📝 Processing: {file_path}")
        if fix_file(file_path):
            fixed_count += 1
            print(f"   ✅ Fixed!")
        else:
            print(f"   ⏭️  No changes needed (already using admin client)")

    print("\n" + "=" * 70)
    print(f"📊 Summary:")
    print(f"   ✅ Fixed: {fixed_count} files")
    print("\n✅ Done! Review changes with: git diff app/api")

if __name__ == "__main__":
    main()
