import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db';
import { readFileSync } from 'fs'
import { join } from 'path'

export async function POST(request: NextRequest) {
  try {
    // Read the SQL schema file
    const sqlPath = join(process.cwd(), 'sql', 'prospect-approval-schema.sql')
    const sqlSchema = readFileSync(sqlPath, 'utf8')

    // Split the SQL into individual statements (simple split by semicolon)
    const statements = sqlSchema
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0 && !statement.startsWith('--') && !statement.startsWith('/*'))

    const results = []
    
    // Execute each statement
    for (const statement of statements) {
      try {
        if (statement.includes('CREATE TABLE') || statement.includes('CREATE INDEX') || statement.includes('CREATE TRIGGER') || statement.includes('CREATE OR REPLACE FUNCTION')) {
          const { error } = await supabase.rpc('exec_sql', { sql: statement })
          if (error) {
            console.error(`Error executing statement: ${statement}`, error)
            results.push({ statement: statement.substring(0, 100) + '...', error: error.message })
          } else {
            results.push({ statement: statement.substring(0, 100) + '...', success: true })
          }
        }
      } catch (statementError) {
        console.error(`Statement execution error: ${statement}`, statementError)
        results.push({ statement: statement.substring(0, 100) + '...', error: statementError })
      }
    }

    // Verify tables were created
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', [
        'prospect_approval_sessions',
        'prospect_approval_data', 
        'prospect_approval_decisions',
        'prospect_learning_logs',
        'prospect_exports',
        'sam_learning_models'
      ])

    if (tablesError) {
      console.error('Error checking tables:', tablesError)
    }

    return NextResponse.json({
      success: true,
      message: 'Prospect approval database schema setup completed',
      execution_results: results,
      tables_created: tables?.map(t => t.table_name) || [],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Schema setup error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if tables exist
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', [
        'prospect_approval_sessions',
        'prospect_approval_data', 
        'prospect_approval_decisions',
        'prospect_learning_logs',
        'prospect_exports',
        'sam_learning_models'
      ])

    if (error) {
      throw error
    }

    const existingTables = tables?.map(t => t.table_name) || []
    const requiredTables = [
      'prospect_approval_sessions',
      'prospect_approval_data', 
      'prospect_approval_decisions',
      'prospect_learning_logs',
      'prospect_exports',
      'sam_learning_models'
    ]

    const missingTables = requiredTables.filter(table => !existingTables.includes(table))

    return NextResponse.json({
      success: true,
      tables_exist: existingTables,
      missing_tables: missingTables,
      schema_complete: missingTables.length === 0,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Schema check error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}