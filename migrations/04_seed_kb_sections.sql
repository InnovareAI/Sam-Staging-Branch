-- Migration: Seed Knowledge Base Sections for All Workspaces
-- Description: Creates default KB section categories for each workspace
-- Author: Production Migration Script
-- Date: 2025-09-30

-- ==============================================================================
-- STEP 1: Define Default Sections Template
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Starting KB sections seeding process...';
END $$;

-- ==============================================================================
-- STEP 2: Insert Default Sections for Each Workspace
-- ==============================================================================

INSERT INTO knowledge_base_sections (
    workspace_id, 
    name, 
    description, 
    display_order, 
    icon,
    is_active,
    created_at, 
    updated_at
)
SELECT 
    w.id as workspace_id,
    section.name,
    section.description,
    section.display_order,
    section.icon,
    true as is_active,
    NOW() as created_at,
    NOW() as updated_at
FROM workspaces w
CROSS JOIN (
    VALUES 
        ('ICP', 'Ideal Customer Profile - Target audience and customer characteristics', 1, '🎯'),
        ('Products', 'Product Information - Features, pricing, and specifications', 2, '📦'),
        ('Competitors', 'Competitive Analysis - Market positioning and competitor insights', 3, '⚔️'),
        ('Personas', 'User Personas - Detailed user profiles and behavior patterns', 4, '👤'),
        ('Value Props', 'Value Propositions - Key benefits and differentiators', 5, '💎'),
        ('Use Cases', 'Use Cases - Real-world applications and scenarios', 6, '📋'),
        ('Objections', 'Common Objections - FAQ and objection handling strategies', 7, '🛡️'),
        ('Resources', 'Sales Resources - Case studies, white papers, and materials', 8, '📚'),
        ('General', 'General Knowledge - Miscellaneous information and notes', 9, '📝')
) AS section(name, description, display_order, icon)
WHERE w.is_active = true  -- Only seed for active workspaces
AND NOT EXISTS (
    SELECT 1 
    FROM knowledge_base_sections kbs 
    WHERE kbs.workspace_id = w.id 
    AND kbs.name = section.name
);

-- ==============================================================================
-- STEP 3: Verification and Statistics
-- ==============================================================================

DO $$
DECLARE
    workspace_count INTEGER;
    section_count INTEGER;
    avg_sections_per_workspace NUMERIC;
BEGIN
    -- Count total workspaces
    SELECT COUNT(*) INTO workspace_count FROM workspaces WHERE is_active = true;
    
    -- Count total sections created
    SELECT COUNT(*) INTO section_count FROM knowledge_base_sections;
    
    -- Calculate average
    SELECT ROUND(AVG(section_ct), 2) INTO avg_sections_per_workspace
    FROM (
        SELECT COUNT(*) as section_ct
        FROM knowledge_base_sections
        GROUP BY workspace_id
    ) sub;
    
    RAISE NOTICE 'Seeded sections for % active workspaces', workspace_count;
    RAISE NOTICE 'Total sections in database: %', section_count;
    RAISE NOTICE 'Average sections per workspace: %', avg_sections_per_workspace;
END $$;

-- Show detailed breakdown per workspace
SELECT 
    w.name as workspace_name,
    w.id as workspace_id,
    COUNT(kbs.id) as section_count,
    array_agg(kbs.name ORDER BY kbs.display_order) as section_names
FROM workspaces w
LEFT JOIN knowledge_base_sections kbs ON kbs.workspace_id = w.id
WHERE w.is_active = true
GROUP BY w.id, w.name
ORDER BY w.name;

-- ==============================================================================
-- STEP 4: Validate Section Completeness
-- ==============================================================================

DO $$
DECLARE
    incomplete_workspaces INTEGER;
    expected_sections INTEGER := 9; -- Update this if you change the default sections
BEGIN
    -- Check for workspaces with fewer sections than expected
    SELECT COUNT(*) INTO incomplete_workspaces
    FROM (
        SELECT workspace_id, COUNT(*) as section_count
        FROM knowledge_base_sections
        GROUP BY workspace_id
        HAVING COUNT(*) < expected_sections
    ) sub;
    
    IF incomplete_workspaces > 0 THEN
        RAISE WARNING '% workspace(s) have fewer than % sections', incomplete_workspaces, expected_sections;
        
        -- Show which workspaces are incomplete
        RAISE NOTICE 'Incomplete workspaces:';
        PERFORM w.name, COUNT(kbs.id) as sections
        FROM workspaces w
        LEFT JOIN knowledge_base_sections kbs ON kbs.workspace_id = w.id
        WHERE w.is_active = true
        GROUP BY w.id, w.name
        HAVING COUNT(kbs.id) < expected_sections;
    ELSE
        RAISE NOTICE 'All workspaces have complete section sets ✅';
    END IF;
END $$;

-- ==============================================================================
-- STEP 5: Create Indexes for Performance (if not exists)
-- ==============================================================================

-- Index on workspace_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_kb_sections_workspace_id 
ON knowledge_base_sections(workspace_id);

-- Index on display_order for sorted queries
CREATE INDEX IF NOT EXISTS idx_kb_sections_display_order 
ON knowledge_base_sections(workspace_id, display_order);

-- Index on name for searches
CREATE INDEX IF NOT EXISTS idx_kb_sections_name 
ON knowledge_base_sections(name);

-- Composite index for active sections queries
CREATE INDEX IF NOT EXISTS idx_kb_sections_active 
ON knowledge_base_sections(workspace_id, is_active, display_order);

RAISE NOTICE '✅ KB sections seeding completed successfully';

-- ==============================================================================
-- STEP 6: Optional - Create View for Easy Section Access
-- ==============================================================================

CREATE OR REPLACE VIEW vw_workspace_sections AS
SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    kbs.id as section_id,
    kbs.name as section_name,
    kbs.description,
    kbs.display_order,
    kbs.icon,
    kbs.is_active,
    COUNT(kb.id) as entry_count
FROM workspaces w
JOIN knowledge_base_sections kbs ON kbs.workspace_id = w.id
LEFT JOIN knowledge_base kb ON kb.section_id = kbs.id
WHERE w.is_active = true AND kbs.is_active = true
GROUP BY w.id, w.name, kbs.id, kbs.name, kbs.description, kbs.display_order, kbs.icon, kbs.is_active
ORDER BY w.name, kbs.display_order;

COMMENT ON VIEW vw_workspace_sections IS 'Convenient view showing all sections per workspace with entry counts';

RAISE NOTICE '✅ Created helper view: vw_workspace_sections';