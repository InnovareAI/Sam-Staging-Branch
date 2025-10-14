#!/usr/bin/env python3
import re

files = [
    'app/api/knowledge-base/competitors/route.ts',
    'app/api/knowledge-base/data/route.ts',
    'app/api/knowledge-base/icps/route.ts',
    'app/api/knowledge-base/personas/route.ts',
    'app/api/knowledge-base/products/route.ts',
]

for file_path in files:
    with open(file_path, 'r') as f:
        content = f.read()

    # Replace imports
    content = re.sub(
        r"import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';",
        "",
        content
    )
    content = re.sub(
        r"import { cookies } from 'next/headers';",
        "",
        content
    )
    content = re.sub(
        r"type RouteSupabaseClient = ReturnType<typeof createRouteHandlerClient>;",
        "",
        content
    )

    # Add new imports after NextRequest import
    content = re.sub(
        r"(import { NextRequest, NextResponse } from 'next/server';)",
        r"\1\nimport { createSupabaseRouteClient } from '@/lib/supabase-route-client';",
        content
    )

    # Replace client creation
    content = re.sub(
        r"// cookieStore removed;\s*const supabase = createRouteHandlerClient\({ cookies: await cookies\(\) }\);",
        "const supabase = await createSupabaseRouteClient();",
        content
    )
    content = re.sub(
        r"const supabase = createRouteHandlerClient\({ cookies: await cookies\(\) }\);",
        "const supabase = await createSupabaseRouteClient();",
        content
    )

    # Clean up extra blank lines
    content = re.sub(r'\n\n\n+', '\n\n', content)

    with open(file_path, 'w') as f:
        f.write(content)

    print(f"✅ Updated {file_path}")

print("\n✨ All KB routes updated!")
