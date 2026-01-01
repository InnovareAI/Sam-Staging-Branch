#!/usr/bin/env python3
"""
Phase 2: Replace createClient() calls with pool usage
"""

import os
import re

def process_file(filepath):
    """Process a single file to replace createClient patterns."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        
        # Remove createClient variable assignments like:
        # const supabase = createClient(...)
        # const pool = createClient(...)
        content = re.sub(
            r'const\s+(?:supabase|poolClient|adminClient|serviceClient)\s*=\s*createClient\([^)]*\)[;\n\s]*',
            '',
            content
        )
        
        # Remove multi-line createClient calls
        content = re.sub(
            r'const\s+(?:supabase|poolClient|adminClient|serviceClient)\s*=\s*createClient\(\s*\n[^)]*\)[;\n\s]*',
            '',
            content, 
            flags=re.MULTILINE
        )
        
        # Replace createServerClient calls
        content = re.sub(
            r'const\s+supabase\s*=\s*createServerClient\([^)]*\{[^}]*\}[^)]*\)[;\n\s]*',
            '',
            content,
            flags=re.DOTALL
        )
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    changed = 0
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.next', '.git']]
        for f in files:
            if f.endswith(('.ts', '.tsx')) and not f.endswith('.d.ts'):
                path = os.path.join(root, f)
                if process_file(path):
                    changed += 1
                    print(f"Fixed: {path}")
    
    print(f"\nModified {changed} files")

if __name__ == '__main__':
    main()
