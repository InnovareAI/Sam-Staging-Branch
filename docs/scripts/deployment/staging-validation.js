#!/usr/bin/env node

/**
 * STAGING ENVIRONMENT VALIDATION SCRIPT
 * Comprehensive pre-production deployment validation
 */

import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import https from 'https';

const execAsync = promisify(exec);

// Configuration
const STAGING_URL = process.env.STAGING_URL || 'https://staging--sam-new-sep-7.netlify.app';
const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://app.meet-sam.com';

class StagingValidator {
  constructor() {
    this.results = [];
    this.errors = [];
    this.warnings = [];
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    console.log(logEntry);
    this.results.push(logEntry);
    
    if (level === 'error') this.errors.push(message);
    if (level === 'warning') this.warnings.push(message);
  }

  async validateEnvironmentVariables() {
    this.log('🔍 Validating environment variables...');
    
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'POSTMARK_INNOVAREAI_API_KEY',
      'OPENROUTER_API_KEY'
    ];

    let valid = true;
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        this.log(`Missing required environment variable: ${varName}`, 'error');
        valid = false;
      }
    }

    if (valid) {
      this.log('✅ All required environment variables present');
    }
    return valid;
  }

  async validateDatabaseConnections() {
    this.log('🔍 Validating database connections...');
    
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Test basic connection
      const { data, error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);

      if (error) {
        this.log(`Database connection failed: ${error.message}`, 'error');
        return false;
      }

      this.log('✅ Database connection successful');
      
      // Validate critical tables exist
      const criticalTables = ['profiles', 'workspaces', 'invitations', 'organizations'];
      for (const table of criticalTables) {
        const { error: tableError } = await supabase
          .from(table)
          .select('count')
          .limit(1);
          
        if (tableError) {
          this.log(`Critical table '${table}' not accessible: ${tableError.message}`, 'error');
          return false;
        }
      }
      
      this.log('✅ All critical tables accessible');
      return true;
    } catch (error) {
      this.log(`Database validation failed: ${error.message}`, 'error');
      return false;
    }
  }

  async validateAPIEndpoints() {
    this.log('🔍 Validating API endpoints...');
    
    const endpoints = [
      '/api/admin/stats',
      '/api/admin/check-db',
      '/api/check-tables',
      '/api/test-simple'
    ];

    let allValid = true;
    
    for (const endpoint of endpoints) {
      try {
        const response = await this.makeRequest(`${STAGING_URL}${endpoint}`);
        
        if (response.statusCode >= 200 && response.statusCode < 400) {
          this.log(`✅ ${endpoint} - Status: ${response.statusCode}`);
        } else {
          this.log(`❌ ${endpoint} - Status: ${response.statusCode}`, 'error');
          allValid = false;
        }
      } catch (error) {
        this.log(`❌ ${endpoint} - Error: ${error.message}`, 'error');
        allValid = false;
      }
    }
    
    return allValid;
  }

  async validateInvitationSystem() {
    this.log('🔍 Validating invitation system functionality...');
    
    try {
      // Test invitation creation endpoint
      const testData = {
        email: 'staging-test@innovareai.com',
        organization: 'InnovareAI',
        role: 'member',
        test: true
      };
      
      const response = await this.makeRequest(
        `${STAGING_URL}/api/admin/invite-user`,
        'POST',
        testData
      );
      
      if (response.statusCode === 200) {
        this.log('✅ Invitation system endpoint responding');
      } else {
        this.log(`❌ Invitation system test failed - Status: ${response.statusCode}`, 'error');
        return false;
      }
      
      return true;
    } catch (error) {
      this.log(`❌ Invitation system validation failed: ${error.message}`, 'error');
      return false;
    }
  }

  async validateBuildProcess() {
    this.log('🔍 Validating build process...');
    
    try {
      // Check if build artifacts exist
      await fs.access('.next');
      this.log('✅ Build artifacts present');
      
      // Validate critical build files
      const criticalFiles = [
        '.next/server/app/api/admin/invite-user/route.js',
        '.next/server/app/api/invites/accept/route.js',
        '.next/server/app/layout.js'
      ];
      
      for (const file of criticalFiles) {
        try {
          await fs.access(file);
          this.log(`✅ ${file} exists`);
        } catch {
          this.log(`❌ Missing critical build file: ${file}`, 'error');
          return false;
        }
      }
      
      return true;
    } catch (error) {
      this.log(`❌ Build validation failed: ${error.message}`, 'error');
      return false;
    }
  }

  async validatePerformance() {
    this.log('🔍 Running performance validation...');
    
    try {
      const startTime = Date.now();
      const response = await this.makeRequest(STAGING_URL);
      const loadTime = Date.now() - startTime;
      
      if (loadTime < 3000) {
        this.log(`✅ Page load time: ${loadTime}ms`);
      } else {
        this.log(`⚠️  Slow page load time: ${loadTime}ms`, 'warning');
      }
      
      return true;
    } catch (error) {
      this.log(`❌ Performance validation failed: ${error.message}`, 'error');
      return false;
    }
  }

  makeRequest(url, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'StagingValidator/1.0'
        }
      };

      const req = https.request(url, options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        });
      });

      req.on('error', reject);
      
      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  async generateReport() {
    this.log('📊 Generating validation report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      stagingUrl: STAGING_URL,
      productionUrl: PRODUCTION_URL,
      totalTests: this.results.length,
      errors: this.errors.length,
      warnings: this.warnings.length,
      status: this.errors.length === 0 ? 'PASSED' : 'FAILED',
      results: this.results,
      errors: this.errors,
      warnings: this.warnings
    };
    
    await fs.writeFile('staging-validation-report.json', JSON.stringify(report, null, 2));
    this.log('📄 Report saved to staging-validation-report.json');
    
    return report;
  }

  async run() {
    this.log('🚀 Starting staging environment validation...');
    
    const validations = [
      this.validateEnvironmentVariables(),
      this.validateDatabaseConnections(),
      this.validateAPIEndpoints(),
      this.validateInvitationSystem(),
      this.validateBuildProcess(),
      this.validatePerformance()
    ];
    
    const results = await Promise.allSettled(validations);
    const failed = results.filter(r => r.status === 'rejected' || r.value === false).length;
    
    const report = await this.generateReport();
    
    this.log(`🏁 Validation complete: ${results.length - failed}/${results.length} passed`);
    
    if (failed > 0) {
      this.log(`❌ ${failed} validations failed - NOT READY for production`, 'error');
      process.exit(1);
    } else {
      this.log('✅ All validations passed - READY for production deployment');
      process.exit(0);
    }
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new StagingValidator();
  validator.run().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

export default StagingValidator;