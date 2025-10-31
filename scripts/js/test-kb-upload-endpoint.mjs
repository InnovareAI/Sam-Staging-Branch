#!/usr/bin/env node
import https from 'https'
import fs from 'fs'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '../../.env.local') })

// Create a test text file
const testContent = 'This is a test document for Blue Label Labs.\n\nWe are testing the KB upload functionality.'
const testFile = '/tmp/test-kb-upload.txt'
fs.writeFileSync(testFile, testContent)

console.log('🧪 Testing KB Upload Endpoint\n')
console.log('Test file created:', testFile)
console.log('File size:', fs.statSync(testFile).size, 'bytes\n')

// Note: This test requires authentication which we don't have here
console.log('⚠️  Cannot test upload endpoint without user session cookie')
console.log('')
console.log('To test manually:')
console.log('1. Login as Stan: stan01@signali.ai')
console.log('2. Open DevTools (F12)')
console.log('3. Go to Knowledge Base')
console.log('4. Try to upload a file')
console.log('5. Check Console tab for errors')
console.log('6. Check Network tab for failed API calls')
console.log('')
console.log('Common upload issues:')
console.log('  - CORS errors (cross-origin)')
console.log('  - Authentication failures (401/403)')
console.log('  - File size limits (413)')
console.log('  - Missing Gemini API key')
console.log('  - Supabase RLS policy blocking insert')

fs.unlinkSync(testFile)
