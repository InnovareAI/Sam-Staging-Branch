-- Migration: Import Legacy Data into Structured KB Tables
-- Description: Migrates ICP, Product, Competitor, and Persona data into new schema
-- Author: Production Migration Script
-- Date: 2025-09-30

-- ==============================================================================
-- IMPORTANT: Customize this script based on your legacy data sources
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Starting legacy data import process...';
    RAISE NOTICE 'This script contains template queries - adjust based on your actual legacy tables';
END $$;

-- ==============================================================================
-- STEP 1: Import Legacy ICP Data
-- ==============================================================================

DO $$
DECLARE
    imported_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Importing ICP data...';
    
    -- Example: Assuming you have a legacy_icp_data table
    -- Adjust column names and logic based on your actual schema
    
    INSERT INTO knowledge_base (
        workspace_id,
        section_id,
        title,
        content,
        metadata,
        created_by,
        created_at,
        updated_at
    )
    SELECT 
        l.workspace_id,
        kbs.id as section_id,
        COALESCE(l.title, 'ICP: ' || l.company_name) as title,
        COALESCE(
            l.description || E'\n\n' ||
            'Industry: ' || COALESCE(l.industry, 'N/A') || E'\n' ||
            'Company Size: ' || COALESCE(l.company_size, 'N/A') || E'\n' ||
            'Revenue Range: ' || COALESCE(l.revenue_range, 'N/A') || E'\n' ||
            'Pain Points: ' || COALESCE(l.pain_points, 'N/A'),
            l.description,
            'No description available'
        ) as content,
        jsonb_build_object(
            'imported_from', 'legacy_icp_data',
            'import_date', NOW(),
            'original_id', l.id,
            'industry', l.industry,
            'company_size', l.company_size,
            'revenue_range', l.revenue_range,
            'legacy_metadata', l.metadata
        ) as metadata,
        COALESCE(l.created_by, l.user_id) as created_by,
        COALESCE(l.created_at, NOW()) as created_at,
        NOW() as updated_at
    FROM legacy_icp_data l
    JOIN knowledge_base_sections kbs 
        ON kbs.workspace_id = l.workspace_id 
        AND kbs.name = 'ICP'
    WHERE NOT EXISTS (
        SELECT 1 
        FROM knowledge_base kb 
        WHERE kb.metadata->>'original_id' = l.id::text
        AND kb.metadata->>'imported_from' = 'legacy_icp_data'
    )
    ON CONFLICT DO NOTHING;
    
    GET DIAGNOSTICS imported_count = ROW_COUNT;
    RAISE NOTICE '✅ Imported % ICP records', imported_count;
    
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE '⚠️  legacy_icp_data table not found - skipping ICP import';
    WHEN OTHERS THEN
        RAISE WARNING 'Error importing ICP data: %', SQLERRM;
END $$;

-- ==============================================================================
-- STEP 2: Import Legacy Product Data
-- ==============================================================================

DO $$
DECLARE
    imported_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Importing Product data...';
    
    INSERT INTO knowledge_base (
        workspace_id,
        section_id,
        title,
        content,
        metadata,
        created_by,
        created_at,
        updated_at
    )
    SELECT 
        l.workspace_id,
        kbs.id as section_id,
        COALESCE(l.product_name, l.title) as title,
        COALESCE(
            l.description || E'\n\n' ||
            'Price: ' || COALESCE(l.price::text, 'N/A') || E'\n' ||
            'Features: ' || COALESCE(l.features, 'N/A') || E'\n' ||
            'Benefits: ' || COALESCE(l.benefits, 'N/A'),
            l.description,
            'No description available'
        ) as content,
        jsonb_build_object(
            'imported_from', 'legacy_product_data',
            'import_date', NOW(),
            'original_id', l.id,
            'price', l.price,
            'sku', l.sku,
            'category', l.category,
            'legacy_metadata', l.metadata
        ) as metadata,
        COALESCE(l.created_by, l.user_id) as created_by,
        COALESCE(l.created_at, NOW()) as created_at,
        NOW() as updated_at
    FROM legacy_product_data l
    JOIN knowledge_base_sections kbs 
        ON kbs.workspace_id = l.workspace_id 
        AND kbs.name = 'Products'
    WHERE NOT EXISTS (
        SELECT 1 
        FROM knowledge_base kb 
        WHERE kb.metadata->>'original_id' = l.id::text
        AND kb.metadata->>'imported_from' = 'legacy_product_data'
    )
    ON CONFLICT DO NOTHING;
    
    GET DIAGNOSTICS imported_count = ROW_COUNT;
    RAISE NOTICE '✅ Imported % Product records', imported_count;
    
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE '⚠️  legacy_product_data table not found - skipping Product import';
    WHEN OTHERS THEN
        RAISE WARNING 'Error importing Product data: %', SQLERRM;
END $$;

-- ==============================================================================
-- STEP 3: Import Legacy Competitor Data
-- ==============================================================================

DO $$
DECLARE
    imported_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Importing Competitor data...';
    
    INSERT INTO knowledge_base (
        workspace_id,
        section_id,
        title,
        content,
        metadata,
        created_by,
        created_at,
        updated_at
    )
    SELECT 
        l.workspace_id,
        kbs.id as section_id,
        COALESCE(l.competitor_name, l.company_name, l.title) as title,
        COALESCE(
            l.description || E'\n\n' ||
            'Strengths: ' || COALESCE(l.strengths, 'N/A') || E'\n' ||
            'Weaknesses: ' || COALESCE(l.weaknesses, 'N/A') || E'\n' ||
            'Market Share: ' || COALESCE(l.market_share, 'N/A') || E'\n' ||
            'Pricing: ' || COALESCE(l.pricing_info, 'N/A'),
            l.description,
            'No description available'
        ) as content,
        jsonb_build_object(
            'imported_from', 'legacy_competitor_data',
            'import_date', NOW(),
            'original_id', l.id,
            'website', l.website,
            'market_position', l.market_position,
            'legacy_metadata', l.metadata
        ) as metadata,
        COALESCE(l.created_by, l.user_id) as created_by,
        COALESCE(l.created_at, NOW()) as created_at,
        NOW() as updated_at
    FROM legacy_competitor_data l
    JOIN knowledge_base_sections kbs 
        ON kbs.workspace_id = l.workspace_id 
        AND kbs.name = 'Competitors'
    WHERE NOT EXISTS (
        SELECT 1 
        FROM knowledge_base kb 
        WHERE kb.metadata->>'original_id' = l.id::text
        AND kb.metadata->>'imported_from' = 'legacy_competitor_data'
    )
    ON CONFLICT DO NOTHING;
    
    GET DIAGNOSTICS imported_count = ROW_COUNT;
    RAISE NOTICE '✅ Imported % Competitor records', imported_count;
    
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE '⚠️  legacy_competitor_data table not found - skipping Competitor import';
    WHEN OTHERS THEN
        RAISE WARNING 'Error importing Competitor data: %', SQLERRM;
END $$;

-- ==============================================================================
-- STEP 4: Import Legacy Persona Data
-- ==============================================================================

DO $$
DECLARE
    imported_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Importing Persona data...';
    
    INSERT INTO knowledge_base (
        workspace_id,
        section_id,
        title,
        content,
        metadata,
        created_by,
        created_at,
        updated_at
    )
    SELECT 
        l.workspace_id,
        kbs.id as section_id,
        COALESCE(l.persona_name, l.title) as title,
        COALESCE(
            l.description || E'\n\n' ||
            'Role/Title: ' || COALESCE(l.job_title, 'N/A') || E'\n' ||
            'Goals: ' || COALESCE(l.goals, 'N/A') || E'\n' ||
            'Challenges: ' || COALESCE(l.challenges, 'N/A') || E'\n' ||
            'Demographics: ' || COALESCE(l.demographics, 'N/A'),
            l.description,
            'No description available'
        ) as content,
        jsonb_build_object(
            'imported_from', 'legacy_persona_data',
            'import_date', NOW(),
            'original_id', l.id,
            'job_title', l.job_title,
            'seniority_level', l.seniority_level,
            'department', l.department,
            'legacy_metadata', l.metadata
        ) as metadata,
        COALESCE(l.created_by, l.user_id) as created_by,
        COALESCE(l.created_at, NOW()) as created_at,
        NOW() as updated_at
    FROM legacy_persona_data l
    JOIN knowledge_base_sections kbs 
        ON kbs.workspace_id = l.workspace_id 
        AND kbs.name = 'Personas'
    WHERE NOT EXISTS (
        SELECT 1 
        FROM knowledge_base kb 
        WHERE kb.metadata->>'original_id' = l.id::text
        AND kb.metadata->>'imported_from' = 'legacy_persona_data'
    )
    ON CONFLICT DO NOTHING;
    
    GET DIAGNOSTICS imported_count = ROW_COUNT;
    RAISE NOTICE '✅ Imported % Persona records', imported_count;
    
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE '⚠️  legacy_persona_data table not found - skipping Persona import';
    WHEN OTHERS THEN
        RAISE WARNING 'Error importing Persona data: %', SQLERRM;
END $$;

-- ==============================================================================
-- STEP 5: Import Summary and Verification
-- ==============================================================================

DO $$
DECLARE
    total_imported INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_imported
    FROM knowledge_base
    WHERE metadata->>'imported_from' LIKE 'legacy_%';
    
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Legacy Data Import Summary';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Total records imported: %', total_imported;
    RAISE NOTICE '====================================';
END $$;

-- Show breakdown by section
SELECT 
    kbs.name as section,
    COUNT(kb.id) as imported_count,
    kb.metadata->>'imported_from' as source
FROM knowledge_base kb
JOIN knowledge_base_sections kbs ON kbs.id = kb.section_id
WHERE kb.metadata->>'imported_from' LIKE 'legacy_%'
GROUP BY kbs.name, kb.metadata->>'imported_from'
ORDER BY kbs.name, imported_count DESC;

-- ==============================================================================
-- STEP 6: Create Cleanup Function for Failed Imports
-- ==============================================================================

-- Function to rollback imports if needed
CREATE OR REPLACE FUNCTION rollback_legacy_import(import_source TEXT DEFAULT NULL)
RETURNS TABLE (deleted_count BIGINT) AS $$
BEGIN
    IF import_source IS NULL THEN
        -- Delete all legacy imports
        DELETE FROM knowledge_base
        WHERE metadata->>'imported_from' LIKE 'legacy_%'
        RETURNING COUNT(*) INTO deleted_count;
    ELSE
        -- Delete specific import source
        DELETE FROM knowledge_base
        WHERE metadata->>'imported_from' = import_source
        RETURNING COUNT(*) INTO deleted_count;
    END IF;
    
    RETURN QUERY SELECT deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION rollback_legacy_import IS 'Rollback legacy data imports. Call with specific source or NULL for all.';

RAISE NOTICE '✅ Legacy data import completed';
RAISE NOTICE 'To rollback: SELECT rollback_legacy_import(); or SELECT rollback_legacy_import(''legacy_icp_data'');';