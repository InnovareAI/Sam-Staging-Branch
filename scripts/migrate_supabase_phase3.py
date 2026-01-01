#!/usr/bin/env python3
"""
Remove multi-line createClient calls
"""
import os
import re

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        
        # Multi-line createClient patterns
        patterns = [
            # const x = createClient(\n  url,\n  key\n)
            r'const\s+(?:supabaseAdmin|supabaseAdminClient|userSupabase|adminClient|serviceClient|supabase)\s*=\s*createClient\s*\([^)]+\)\s*;?\s*\n?',
        ]
        
        for p in patterns:
            content = re.sub(p, '// Pool imported from lib/db\n', content, flags=re.DOTALL | re.MULTILINE)
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"Error: {filepath}: {e}")
        return False

def main():
    changed = 0
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.next', '.git']]
        for f in files:
            if f.endswith('.ts') or f.endswith('.tsx'):
                path = os.path.join(root, f)
                if process_file(path):
                    changed += 1
                    print(f"Fixed: {path}")
    print(f"\nModified {changed} files")

if __name__ == '__main__':
    main()
