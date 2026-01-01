#!/usr/bin/env python3
"""
Complete removal of Supabase dependencies - Migrates to Firebase + PostgreSQL pool
"""

import os
import re
import sys

def replace_in_file(filepath, replacements):
    """Apply multiple replacements to a file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        for pattern, replacement in replacements:
            content = re.sub(pattern, replacement, content)
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def process_files(root_dir):
    """Process all TypeScript files."""
    
    # Replacements for imports
    import_replacements = [
        # Replace @supabase/ssr imports
        (r"import \{ createServerClient \} from '@supabase/ssr';?", 
         "import { pool } from '@/lib/db';"),
        (r"import \{ createBrowserClient \} from '@supabase/ssr';?", 
         "import { getFirebaseAuth } from '@/lib/firebase';"),
        
        # Replace @supabase/supabase-js imports
        (r"import \{ createClient \} from '@supabase/supabase-js';?", 
         "import { pool } from '@/lib/db';"),
        (r"import \{ createClient as createServiceClient \} from '@supabase/supabase-js';?",
         "import { pool } from '@/lib/db';"),
        (r"import \{ createClient as createServerClient \} from '@supabase/supabase-js';?",
         "import { pool } from '@/lib/db';"),
        (r"import \{ createClient as createAdminClient \} from '@supabase/supabase-js';?",
         "import { pool } from '@/lib/db';"),
        (r"import type \{ SupabaseClient \} from '@supabase/supabase-js';?",
         "import type { Pool } from 'pg';"),
        (r"import \{ SupabaseClient \} from '@supabase/supabase-js';?",
         "import { Pool } from 'pg';"),
        
        # Replace @supabase/auth-helpers-nextjs imports
        (r"import \{ createClientComponentClient \} from '@supabase/auth-helpers-nextjs';?",
         "import { getFirebaseAuth } from '@/lib/firebase';"),
        (r"import \{ createRouteHandlerClient \} from '@supabase/auth-helpers-nextjs';?",
         "import { pool } from '@/lib/db';"),
    ]
    
    changed_files = []
    
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Skip node_modules and .next
        dirnames[:] = [d for d in dirnames if d not in ['node_modules', '.next', '.git']]
        
        for filename in filenames:
            if filename.endswith(('.ts', '.tsx')) and not filename.endswith('.d.ts'):
                filepath = os.path.join(dirpath, filename)
                if replace_in_file(filepath, import_replacements):
                    changed_files.append(filepath)
    
    return changed_files

if __name__ == '__main__':
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    
    print("Processing app/ and lib/ directories...")
    
    app_changes = process_files(os.path.join(root, 'app'))
    lib_changes = process_files(os.path.join(root, 'lib'))
    
    all_changes = app_changes + lib_changes
    
    print(f"\nModified {len(all_changes)} files:")
    for f in all_changes[:20]:
        print(f"  - {f}")
    if len(all_changes) > 20:
        print(f"  ... and {len(all_changes) - 20} more")
    
    print("\nDone!")
