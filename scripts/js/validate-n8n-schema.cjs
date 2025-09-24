/**
 * Validate N8N Funnel Schema Syntax
 * Checks for common PostgreSQL syntax errors
 */

const fs = require('fs');

console.log('🔍 Validating N8N Funnel Schema...');

try {
  const schemaPath = './sql/n8n-dual-funnel-schema.sql';
  
  if (!fs.existsSync(schemaPath)) {
    console.error('❌ Schema file not found:', schemaPath);
    process.exit(1);
  }

  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  console.log('📄 Reading schema file...');
  console.log(`📊 File size: ${schema.length} characters`);
  console.log(`📊 Line count: ${schema.split('\n').length} lines`);
  
  // Check for common syntax issues
  const issues = [];
  
  // 1. Check for JavaScript code
  if (schema.includes('const ') || schema.includes('require(') || schema.includes('module.')) {
    issues.push('Contains JavaScript code (const, require, module)');
  }
  
  // 2. Check for inline INDEX definitions in CREATE TABLE
  const inlineIndexMatches = schema.match(/CREATE TABLE[^;]*INDEX\s+\w+/gi);
  if (inlineIndexMatches) {
    issues.push(`Found ${inlineIndexMatches.length} inline INDEX definitions in CREATE TABLE statements`);
  }
  
  // 3. Check for unmatched parentheses
  const openParens = (schema.match(/\(/g) || []).length;
  const closeParens = (schema.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    issues.push(`Unmatched parentheses: ${openParens} open, ${closeParens} close`);
  }
  
  // 4. Check for proper SQL statement termination
  const statements = schema.split(';').filter(stmt => stmt.trim().length > 0);
  console.log(`📊 SQL statements found: ${statements.length}`);
  
  // 5. Check for CREATE TABLE statements
  const createTableMatches = schema.match(/CREATE TABLE/gi);
  console.log(`📊 CREATE TABLE statements: ${createTableMatches ? createTableMatches.length : 0}`);
  
  // 6. Check for CREATE INDEX statements
  const createIndexMatches = schema.match(/CREATE INDEX/gi);
  console.log(`📊 CREATE INDEX statements: ${createIndexMatches ? createIndexMatches.length : 0}`);
  
  if (issues.length === 0) {
    console.log('✅ Schema validation passed!');
    console.log('');
    console.log('📋 **SCHEMA SUMMARY:**');
    console.log(`  • Total SQL statements: ${statements.length}`);
    console.log(`  • CREATE TABLE statements: ${createTableMatches ? createTableMatches.length : 0}`);
    console.log(`  • CREATE INDEX statements: ${createIndexMatches ? createIndexMatches.length : 0}`);
    console.log('  • No syntax issues detected');
    console.log('');
    console.log('🚀 **READY FOR DEPLOYMENT:**');
    console.log('  • Copy schema to Supabase Dashboard > SQL Editor');
    console.log('  • Execute to create N8N funnel tables');
    console.log('  • File: sql/n8n-dual-funnel-schema.sql');
  } else {
    console.log('❌ Schema validation failed!');
    console.log('');
    console.log('🔧 **ISSUES FOUND:**');
    issues.forEach((issue, index) => {
      console.log(`  ${index + 1}. ${issue}`);
    });
  }
  
} catch (error) {
  console.error('💥 Validation error:', error.message);
  process.exit(1);
}