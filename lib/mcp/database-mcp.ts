/**
 * Database MCP Server for SAM AI Platform
 * 
 * Provides secure database connectivity and operations through MCP protocol
 * Supports Supabase, PostgreSQL, MySQL, and SQLite databases
 */

import { pool } from '@/lib/db';
import { 
  MCPTool, 
  MCPCallToolRequest, 
  MCPCallToolResult,
  DatabaseMCPConfig,
  DatabaseQueryRequest,
  DatabaseSchemaInfo
} from './types'

export class DatabaseMCPServer {
  private config: DatabaseMCPConfig
  private supabaseClient: any
  private isInitialized = false

  constructor(config: DatabaseMCPConfig) {
    this.config = config
    this.initializeConnection()
  }

  private async initializeConnection(): Promise<void> {
    try {
      if (this.config.databaseType === 'supabase') {
        // Extract URL and anon key from connection string
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY
        
        if (url && key) {
          this.supabaseClient = createClient(url, key)
          this.isInitialized = true
          console.log('✅ Database MCP: Supabase connection initialized')
        } else {
          console.error('❌ Database MCP: Missing Supabase credentials')
        }
      }
      // Add support for other database types here
      else {
        console.warn(`⚠️ Database MCP: ${this.config.databaseType} not yet implemented`)
      }
    } catch (error) {
      console.error('❌ Database MCP: Connection initialization failed:', error)
    }
  }

  async listTools(): Promise<{ tools: MCPTool[] }> {
    const tools: MCPTool[] = [
      {
        name: 'db_query',
        description: 'Execute a SELECT query on the database with safety constraints',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'SQL query to execute (SELECT statements only for safety)'
            },
            parameters: {
              type: 'object',
              description: 'Query parameters for prepared statements'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of rows to return (default: 100, max: 1000)',
              maximum: 1000,
              default: 100
            }
          },
          required: ['query']
        }
      },
      {
        name: 'db_get_schema',
        description: 'Get database schema information including tables, columns, and relationships',
        inputSchema: {
          type: 'object',
          properties: {
            tableFilter: {
              type: 'string',
              description: 'Optional filter for specific table names (supports wildcards)'
            },
            includeViews: {
              type: 'boolean',
              description: 'Include database views in the schema',
              default: false
            },
            includeFunctions: {
              type: 'boolean',
              description: 'Include database functions in the schema',
              default: false
            }
          }
        }
      },
      {
        name: 'db_search_records',
        description: 'Search records across specified tables with intelligent filters',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Table name to search in'
            },
            searchTerm: {
              type: 'string',
              description: 'Search term to find across text columns'
            },
            columns: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific columns to search in (optional)'
            },
            filters: {
              type: 'object',
              description: 'Additional filters as column: value pairs'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results',
              default: 50,
              maximum: 500
            }
          },
          required: ['table', 'searchTerm']
        }
      },
      {
        name: 'db_get_table_info',
        description: 'Get detailed information about a specific table including sample data',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Table name to analyze'
            },
            includeSample: {
              type: 'boolean',
              description: 'Include sample rows from the table',
              default: true
            },
            sampleSize: {
              type: 'number',
              description: 'Number of sample rows to return',
              default: 5,
              maximum: 20
            }
          },
          required: ['table']
        }
      },
      {
        name: 'db_analyze_relationships',
        description: 'Analyze relationships between tables based on foreign keys and data patterns',
        inputSchema: {
          type: 'object',
          properties: {
            fromTable: {
              type: 'string',
              description: 'Starting table for relationship analysis'
            },
            maxDepth: {
              type: 'number',
              description: 'Maximum depth of relationship traversal',
              default: 3,
              maximum: 5
            }
          },
          required: ['fromTable']
        }
      },
      {
        name: 'db_check_status',
        description: 'Check database connection status and performance metrics',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]

    return { tools }
  }

  async callTool(request: MCPCallToolRequest): Promise<MCPCallToolResult> {
    if (!this.isInitialized) {
      return {
        content: [{
          type: 'text',
          text: 'Database connection not initialized'
        }],
        isError: true
      }
    }

    const { name, arguments: args } = request.params

    try {
      switch (name) {
        case 'db_query':
          return await this.executeQuery(args)
        
        case 'db_get_schema':
          return await this.getSchema(args)
        
        case 'db_search_records':
          return await this.searchRecords(args)
        
        case 'db_get_table_info':
          return await this.getTableInfo(args)
        
        case 'db_analyze_relationships':
          return await this.analyzeRelationships(args)
        
        case 'db_check_status':
          return await this.checkStatus()

        default:
          return {
            content: [{
              type: 'text',
              text: `Unknown database tool: ${name}`
            }],
            isError: true
          }
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Database operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async executeQuery(args: any): Promise<MCPCallToolResult> {
    const { query, parameters = {}, limit = 100 } = args

    // Security: Only allow SELECT statements
    const trimmedQuery = query.trim().toLowerCase()
    if (!trimmedQuery.startsWith('select')) {
      return {
        content: [{
          type: 'text',
          text: 'Only SELECT queries are allowed for security reasons'
        }],
        isError: true
      }
    }

    // Apply row limit
    const safeLimit = Math.min(limit, this.config.maxRows || 1000)
    const queryWithLimit = query.includes('limit') ? query : `${query} LIMIT ${safeLimit}`

    try {
      const { data, error } = await this.supabaseClient
        .rpc('execute_sql', { 
          sql_query: queryWithLimit,
          query_params: parameters 
        })

      if (error) {
        return {
          content: [{
            type: 'text',
            text: `Query execution failed: ${error.message}`
          }],
          isError: true
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query: queryWithLimit,
            rowCount: data?.length || 0,
            results: data || [],
            executedAt: new Date().toISOString()
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Database query error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async getSchema(args: any): Promise<MCPCallToolResult> {
    const { tableFilter, includeViews = false, includeFunctions = false } = args

    try {
      // Get table information from information_schema
      let query = `
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default,
          ordinal_position
        FROM information_schema.columns 
        WHERE table_schema = 'public'
      `

      if (tableFilter) {
        query += ` AND table_name LIKE '%${tableFilter}%'`
      }

      query += ` ORDER BY table_name, ordinal_position`

      const { data: columns, error } = await this.supabaseClient
        .rpc('execute_sql', { sql_query: query })

      if (error) {
        return {
          content: [{
            type: 'text',
            text: `Schema query failed: ${error.message}`
          }],
          isError: true
        }
      }

      // Group columns by table
      const tables: { [key: string]: any } = {}
      columns?.forEach((col: any) => {
        if (!tables[col.table_name]) {
          tables[col.table_name] = {
            name: col.table_name,
            columns: []
          }
        }
        tables[col.table_name].columns.push({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          primaryKey: false, // Would need additional query to determine
          default: col.column_default
        })
      })

      const schema: DatabaseSchemaInfo = {
        tables: Object.values(tables)
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            schema,
            tableCount: schema.tables.length,
            generatedAt: new Date().toISOString()
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Schema retrieval error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async searchRecords(args: any): Promise<MCPCallToolResult> {
    const { table, searchTerm, columns, filters = {}, limit = 50 } = args

    // Validate table name for security
    if (!this.isValidTableName(table)) {
      return {
        content: [{
          type: 'text',
          text: 'Invalid table name'
        }],
        isError: true
      }
    }

    try {
      let query = this.supabaseClient.from(table).select('*')

      // Apply text search if columns specified
      if (columns && columns.length > 0) {
        // Use textSearch for full-text search
        query = query.textSearch(columns[0], searchTerm)
      } else {
        // Search across common text columns
        query = query.or(`name.ilike.%${searchTerm}%,title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`)
      }

      // Apply additional filters
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value)
      })

      // Apply limit
      const safeLimit = Math.min(limit, 500)
      query = query.limit(safeLimit)

      const { data, error } = await query

      if (error) {
        return {
          content: [{
            type: 'text',
            text: `Search failed: ${error.message}`
          }],
          isError: true
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            table,
            searchTerm,
            resultCount: data?.length || 0,
            results: data || [],
            searchedAt: new Date().toISOString()
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Search error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async getTableInfo(args: any): Promise<MCPCallToolResult> {
    const { table, includeSample = true, sampleSize = 5 } = args

    if (!this.isValidTableName(table)) {
      return {
        content: [{
          type: 'text',
          text: 'Invalid table name'
        }],
        isError: true
      }
    }

    try {
      const tableInfo: any = {
        tableName: table,
        analyzedAt: new Date().toISOString()
      }

      // Get row count
      const { count, error: countError } = await this.supabaseClient
        .from(table)
        .select('*', { count: 'exact', head: true })

      if (!countError) {
        tableInfo.rowCount = count
      }

      // Get sample data if requested
      if (includeSample) {
        const safeSize = Math.min(sampleSize, 20)
        const { data: sampleData, error: sampleError } = await this.supabaseClient
          .from(table)
          .select('*')
          .limit(safeSize)

        if (!sampleError) {
          tableInfo.sampleData = sampleData
          tableInfo.sampleSize = sampleData?.length || 0
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(tableInfo, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Table analysis error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async analyzeRelationships(args: any): Promise<MCPCallToolResult> {
    const { fromTable, maxDepth = 3 } = args

    // This would require more complex schema analysis
    // For now, return a basic implementation
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          fromTable,
          relationships: [],
          message: 'Relationship analysis not yet fully implemented',
          analyzedAt: new Date().toISOString()
        }, null, 2)
      }]
    }
  }

  private async checkStatus(): Promise<MCPCallToolResult> {
    try {
      const startTime = Date.now()
      
      // Simple connectivity test
      const { error } = await this.supabaseClient
        .from('users')
        .select('id')
        .limit(1)

      const responseTime = Date.now() - startTime

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: error ? 'error' : 'connected',
            databaseType: this.config.databaseType,
            responseTime: `${responseTime}ms`,
            readOnly: this.config.readOnly || false,
            checkedAt: new Date().toISOString(),
            error: error?.message
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            checkedAt: new Date().toISOString()
          }, null, 2)
        }],
        isError: true
      }
    }
  }

  private isValidTableName(tableName: string): boolean {
    // Basic validation for table names
    const validPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/
    return validPattern.test(tableName) && tableName.length <= 63
  }
}