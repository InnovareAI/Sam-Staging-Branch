import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

// SAM AI Knowledge Base API - Immediate Access to Preserved Memory
// This provides SAM with instant access to all restored knowledge without database dependencies

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  subcategory?: string;
  tags: string[];
  source: string;
  filePath: string;
  priority: number;
  lastModified: Date;
}

// Knowledge source configurations with restored content
const KNOWLEDGE_SOURCES = [
  {
    name: 'Modern Technical Knowledge',
    path: '/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/docs/knowledge-base',
    priority: 1,
    category: 'technical'
  },
  {
    name: 'SAM Core Playbook v4.4',
    path: '/Users/tvonlinz/Desktop/Manual Library/SAM_Full_Playbook_v4_4_master',
    priority: 2,
    category: 'core'
  },
  {
    name: 'SAM Training Data',
    path: '/Users/tvonlinz/Desktop/Manual Library/SAM - Training Data',
    priority: 3,
    category: 'training'
  },
  {
    name: 'Conversational Design v4.3',
    path: '/Users/tvonlinz/Desktop/Manual Library/SAM_Conversational_Design_v4_3',
    priority: 4,
    category: 'conversational-design'
  },
  {
    name: 'Product Knowledge v4.2',
    path: '/Users/tvonlinz/Desktop/Manual Library/SAM_Product_Knowledge_v4_2-1',
    priority: 5,
    category: 'product'
  }
];

// In-memory knowledge cache for fast access
let knowledgeCache: KnowledgeItem[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Find all markdown files recursively
function findMarkdownFiles(dir: string, source: any): KnowledgeItem[] {
  const items: KnowledgeItem[] = [];
  
  try {
    const files = readdirSync(dir);
    
    for (const file of files) {
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        items.push(...findMarkdownFiles(fullPath, source));
      } else if (extname(file) === '.md' && !file.startsWith('.')) {
        try {
          const content = readFileSync(fullPath, 'utf8');
          const metadata = extractMetadata(content, fullPath);
          
          items.push({
            id: generateId(fullPath),
            title: metadata.title,
            content: content,
            category: metadata.category,
            subcategory: metadata.subcategory,
            tags: metadata.tags,
            source: source.name,
            filePath: fullPath.replace(source.path, '').replace(/^\//, ''),
            priority: source.priority,
            lastModified: stat.mtime
          });
        } catch (fileError) {
          console.error(`Error reading file ${fullPath}:`, fileError);
        }
      }
    }
  } catch (dirError) {
    console.error(`Error reading directory ${dir}:`, dirError);
  }
  
  return items;
}

// Extract metadata from markdown content
function extractMetadata(content: string, filePath: string) {
  const lines = content.split('\n');
  const title = lines.find(line => line.startsWith('# '))?.replace('# ', '') || 
                filePath.split('/').pop()?.replace('.md', '') || 'Untitled';
  
  // Enhanced category detection
  let category = 'general';
  let subcategory = '';
  
  const contentLower = content.toLowerCase();
  
  // Primary category detection
  if (contentLower.includes('sam ai') || contentLower.includes('identity') || contentLower.includes('capabilities')) {
    category = 'core';
    subcategory = 'identity';
  } else if (contentLower.includes('conversation') || contentLower.includes('dialogue') || contentLower.includes('chat')) {
    category = 'conversational-design';
    if (contentLower.includes('onboarding')) subcategory = 'onboarding';
    else if (contentLower.includes('error')) subcategory = 'error-handling';
    else if (contentLower.includes('mode')) subcategory = 'conversation-modes';
  } else if (contentLower.includes('strategy') || contentLower.includes('objection') || contentLower.includes('case stud')) {
    category = 'strategy';
    if (contentLower.includes('objection')) subcategory = 'objection-handling';
    else if (contentLower.includes('case')) subcategory = 'case-studies';
  } else if (contentLower.includes('icp') || contentLower.includes('persona') || contentLower.includes('target')) {
    category = 'icp-management';
    if (contentLower.includes('framework')) subcategory = 'frameworks';
    else if (contentLower.includes('persona')) subcategory = 'personas';
  } else if (contentLower.includes('campaign') || contentLower.includes('n8n') || contentLower.includes('workflow')) {
    category = 'campaign-integration';
    if (contentLower.includes('n8n')) subcategory = 'workflows';
    else if (contentLower.includes('approval')) subcategory = 'approval-systems';
  } else if (contentLower.includes('market') || contentLower.includes('competitive') || contentLower.includes('intelligence')) {
    category = 'market-intelligence';
    if (contentLower.includes('competitive')) subcategory = 'competitive-analysis';
  } else if (contentLower.includes('technical') || contentLower.includes('api') || contentLower.includes('integration')) {
    category = 'technical';
    if (contentLower.includes('api')) subcategory = 'api-specs';
  } else if (contentLower.includes('vertical') || contentLower.includes('industry')) {
    category = 'verticals';
  }
  
  // Extract tags
  const tags: string[] = [];
  if (contentLower.includes('sam')) tags.push('sam');
  if (contentLower.includes('linkedin')) tags.push('linkedin');
  if (contentLower.includes('campaign')) tags.push('campaign');
  if (contentLower.includes('icp')) tags.push('icp');
  if (contentLower.includes('objection')) tags.push('objection-handling');
  if (contentLower.includes('conversation')) tags.push('conversation');
  if (contentLower.includes('error')) tags.push('error-handling');
  if (contentLower.includes('integration')) tags.push('integration');
  if (contentLower.includes('onboarding')) tags.push('onboarding');
  if (contentLower.includes('strategy')) tags.push('strategy');
  if (contentLower.includes('technical')) tags.push('technical');
  if (contentLower.includes('workflow')) tags.push('workflow');
  
  return { title, category, subcategory, tags };
}

// Generate unique ID for knowledge item
function generateId(filePath: string): string {
  return Buffer.from(filePath).toString('base64').substring(0, 16);
}

// Load all knowledge into cache
function loadKnowledgeCache(): KnowledgeItem[] {
  console.log('Loading SAM knowledge cache...');
  const allKnowledge: KnowledgeItem[] = [];
  
  for (const source of KNOWLEDGE_SOURCES) {
    try {
      const items = findMarkdownFiles(source.path, source);
      allKnowledge.push(...items);
      console.log(`Loaded ${items.length} items from ${source.name}`);
    } catch (error) {
      console.error(`Failed to load from ${source.name}:`, error);
    }
  }
  
  // Sort by priority and title
  allKnowledge.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.title.localeCompare(b.title);
  });
  
  console.log(`Total knowledge items loaded: ${allKnowledge.length}`);
  return allKnowledge;
}

// Get knowledge cache with refresh check
function getKnowledgeCache(): KnowledgeItem[] {
  const now = Date.now();
  
  if (!knowledgeCache || (now - cacheTimestamp) > CACHE_DURATION) {
    knowledgeCache = loadKnowledgeCache();
    cacheTimestamp = now;
  }
  
  return knowledgeCache;
}

// Search knowledge base
function searchKnowledge(query: string, category?: string, limit: number = 10): KnowledgeItem[] {
  const knowledge = getKnowledgeCache();
  const queryLower = query.toLowerCase();
  
  // Score items based on relevance
  const scored = knowledge.map(item => {
    let score = 0;
    
    // Title match (highest priority)
    if (item.title.toLowerCase().includes(queryLower)) score += 10;
    
    // Category match
    if (category && item.category === category) score += 5;
    
    // Tag match
    if (item.tags.some(tag => tag.toLowerCase().includes(queryLower))) score += 3;
    
    // Content match (basic)
    if (item.content.toLowerCase().includes(queryLower)) score += 1;
    
    // Priority bonus (lower priority number = higher score)
    score += (6 - item.priority);
    
    return { item, score };
  });
  
  // Filter items with score > 0 and sort by score
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.item);
}

// Get knowledge by category
function getKnowledgeByCategory(category: string, limit: number = 20): KnowledgeItem[] {
  const knowledge = getKnowledgeCache();
  
  return knowledge
    .filter(item => item.category === category)
    .slice(0, limit);
}

// Get all categories with counts
function getKnowledgeCategories(): { [category: string]: number } {
  const knowledge = getKnowledgeCache();
  const categories: { [category: string]: number } = {};
  
  knowledge.forEach(item => {
    categories[item.category] = (categories[item.category] || 0) + 1;
  });
  
  return categories;
}

// API Routes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'search';
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || undefined;
    const limit = parseInt(searchParams.get('limit') || '10');
    
    console.log(`SAM Knowledge API: ${action}`, { query, category, limit });
    
    switch (action) {
      case 'search':
        if (!query) {
          return NextResponse.json({
            success: false,
            error: 'Query parameter required for search'
          }, { status: 400 });
        }
        
        const searchResults = searchKnowledge(query, category, limit);
        return NextResponse.json({
          success: true,
          action: 'search',
          query,
          category,
          results: searchResults.map(item => ({
            id: item.id,
            title: item.title,
            category: item.category,
            subcategory: item.subcategory,
            tags: item.tags,
            source: item.source,
            preview: item.content.substring(0, 200) + '...',
            priority: item.priority
          })),
          total: searchResults.length,
          timestamp: new Date().toISOString()
        });
      
      case 'category':
        if (!category) {
          const categories = getKnowledgeCategories();
          return NextResponse.json({
            success: true,
            action: 'categories',
            categories,
            timestamp: new Date().toISOString()
          });
        }
        
        const categoryResults = getKnowledgeByCategory(category, limit);
        return NextResponse.json({
          success: true,
          action: 'category',
          category,
          results: categoryResults.map(item => ({
            id: item.id,
            title: item.title,
            subcategory: item.subcategory,
            tags: item.tags,
            source: item.source,
            preview: item.content.substring(0, 200) + '...',
            priority: item.priority
          })),
          total: categoryResults.length,
          timestamp: new Date().toISOString()
        });
      
      case 'get':
        const id = searchParams.get('id');
        if (!id) {
          return NextResponse.json({
            success: false,
            error: 'ID parameter required for get action'
          }, { status: 400 });
        }
        
        const knowledge = getKnowledgeCache();
        const item = knowledge.find(k => k.id === id);
        
        if (!item) {
          return NextResponse.json({
            success: false,
            error: 'Knowledge item not found'
          }, { status: 404 });
        }
        
        return NextResponse.json({
          success: true,
          action: 'get',
          item: {
            id: item.id,
            title: item.title,
            content: item.content,
            category: item.category,
            subcategory: item.subcategory,
            tags: item.tags,
            source: item.source,
            filePath: item.filePath,
            priority: item.priority,
            lastModified: item.lastModified
          },
          timestamp: new Date().toISOString()
        });
      
      case 'stats':
        const stats = {
          totalItems: getKnowledgeCache().length,
          categories: getKnowledgeCategories(),
          sources: KNOWLEDGE_SOURCES.map(s => s.name),
          lastCacheUpdate: new Date(cacheTimestamp).toISOString(),
          cacheValid: (Date.now() - cacheTimestamp) < CACHE_DURATION
        };
        
        return NextResponse.json({
          success: true,
          action: 'stats',
          stats,
          timestamp: new Date().toISOString()
        });
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Available: search, category, get, stats'
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('SAM Knowledge API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      debug: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, queries } = body;
    
    if (action === 'batch_search' && Array.isArray(queries)) {
      const results = queries.map(queryObj => {
        const { query, category, limit = 5 } = queryObj;
        return {
          query,
          results: searchKnowledge(query, category, limit)
        };
      });
      
      return NextResponse.json({
        success: true,
        action: 'batch_search',
        results,
        timestamp: new Date().toISOString()
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid POST action'
    }, { status: 400 });
    
  } catch (error) {
    console.error('SAM Knowledge API POST error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}