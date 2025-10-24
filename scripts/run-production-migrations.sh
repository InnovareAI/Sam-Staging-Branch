#!/bin/bash

# Run all pending database migrations on production
# This ensures all workspaces have the latest schema

set -e

echo "🚀 Running production database migrations..."
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it with:"
    echo "   brew install supabase/tap/supabase"
    exit 1
fi

# Check if we're linked to the project
echo "1️⃣ Linking to production project..."
supabase link --project-ref latxadqrvrrrcvkktrog

# Run the migrations
echo ""
echo "2️⃣ Pushing all migrations to production..."
echo "   This will apply all pending migrations in supabase/migrations/"
echo ""

supabase db push --include-all

echo ""
echo "✅ Migrations applied successfully!"
echo ""
echo "3️⃣ Verifying migration status..."
supabase migration list

echo ""
echo "🎉 All done! Database schema is now up to date across all workspaces."
