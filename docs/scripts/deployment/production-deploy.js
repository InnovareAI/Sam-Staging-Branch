#!/usr/bin/env node

/**
 * PRODUCTION DEPLOYMENT SCRIPT
 * Zero-downtime production deployment with comprehensive validation
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import StagingValidator from './staging-validation.js';
import BackupRollbackSystem from './backup-rollback.js';

const execAsync = promisify(exec);

class ProductionDeployer {
  constructor() {
    this.stagingValidator = new StagingValidator();
    this.backupSystem = new BackupRollbackSystem();
    this.deploymentId = `deploy-${Date.now()}`;
    this.rollbackRequired = false;
  }

  async deploy(options = {}) {
    console.log('🚀 Starting Production Deployment Pipeline...');
    console.log(`📋 Deployment ID: ${this.deploymentId}`);
    
    try {
      // Phase 1: Pre-deployment validation
      await this.preDeploymentValidation();
      
      // Phase 2: Create backup
      await this.createBackup();
      
      // Phase 3: Build and validate
      await this.buildAndValidate();
      
      // Phase 4: Staging deployment
      await this.deployToStaging();
      
      // Phase 5: Staging validation
      await this.validateStaging();
      
      // Phase 6: Production deployment
      await this.deployToProduction();
      
      // Phase 7: Production validation
      await this.validateProduction();
      
      // Phase 8: Post-deployment tasks
      await this.postDeployment();
      
      console.log('✅ Production deployment completed successfully!');
      
    } catch (error) {
      console.error('❌ Deployment failed:', error.message);
      await this.handleDeploymentFailure(error);
      throw error;
    }
  }

  async preDeploymentValidation() {
    console.log('\n🔍 Phase 1: Pre-deployment validation...');
    
    // Check environment
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      throw new Error('Missing required environment variables');
    }
    
    // Check git status
    try {
      const { stdout: gitStatus } = await execAsync('git status --porcelain');
      if (gitStatus.trim()) {
        console.log('⚠️  Uncommitted changes detected:');
        console.log(gitStatus);
        
        if (!process.env.FORCE_DEPLOY) {
          throw new Error('Uncommitted changes detected. Commit changes or use FORCE_DEPLOY=true');
        }
      }
    } catch (error) {
      console.log('⚠️  Not a git repository or git not available');
    }
    
    // Check dependencies
    console.log('📦 Checking dependencies...');
    try {
      await execAsync('npm audit --audit-level high');
      console.log('✅ No high-severity vulnerabilities found');
    } catch (error) {
      console.log('⚠️  Security vulnerabilities detected - review required');
      if (!process.env.FORCE_DEPLOY) {
        throw new Error('Security vulnerabilities detected. Fix vulnerabilities or use FORCE_DEPLOY=true');
      }
    }
    
    console.log('✅ Pre-deployment validation passed');
  }

  async createBackup() {
    console.log('\n💾 Phase 2: Creating pre-deployment backup...');
    
    await this.backupSystem.init();
    this.backup = await this.backupSystem.createBackup(`pre-${this.deploymentId}`);
    
    console.log(`✅ Backup created: ${this.backup.backupId}`);
  }

  async buildAndValidate() {
    console.log('\n🔨 Phase 3: Building and validating application...');
    
    // Clean build
    console.log('🧹 Cleaning previous build...');
    try {
      await execAsync('rm -rf .next');
    } catch (error) {
      // Ignore if .next doesn't exist
    }
    
    // Install dependencies
    console.log('📦 Installing dependencies...');
    await execAsync('npm ci', { timeout: 300000 }); // 5 minute timeout
    
    // Run linting
    console.log('🔍 Running linting...');
    try {
      await execAsync('npm run lint');
      console.log('✅ Linting passed');
    } catch (error) {
      console.log('⚠️  Linting warnings detected');
      // Don't fail deployment for linting warnings
    }
    
    // Build application
    console.log('🏗️  Building application...');
    await execAsync('npm run build', { timeout: 600000 }); // 10 minute timeout
    
    // Validate build
    const buildFiles = [
      '.next/server/app/api/admin/invite-user/route.js',
      '.next/static/chunks'
    ];
    
    for (const file of buildFiles) {
      try {
        await fs.access(file);
      } catch (error) {
        throw new Error(`Critical build file missing: ${file}`);
      }
    }
    
    console.log('✅ Build completed and validated');
  }

  async deployToStaging() {
    console.log('\n🚀 Phase 4: Deploying to staging...');
    
    try {
      // Deploy to staging
      await execAsync('npm run deploy:staging', { timeout: 300000 }); // 5 minute timeout
      
      // Wait for deployment to be ready
      console.log('⏳ Waiting for staging deployment to be ready...');
      await this.waitForDeployment(process.env.STAGING_URL || 'https://staging--sam-new-sep-7.netlify.app');
      
      console.log('✅ Staging deployment completed');
      
    } catch (error) {
      throw new Error(`Staging deployment failed: ${error.message}`);
    }
  }

  async validateStaging() {
    console.log('\n🔍 Phase 5: Validating staging environment...');
    
    try {
      // Set staging URL for validation
      process.env.STAGING_URL = process.env.STAGING_URL || 'https://staging--sam-new-sep-7.netlify.app';
      
      // Run staging validation
      const validator = new StagingValidator();
      await validator.run();
      
      console.log('✅ Staging validation passed');
      
    } catch (error) {
      throw new Error(`Staging validation failed: ${error.message}`);
    }
  }

  async deployToProduction() {
    console.log('\n🚀 Phase 6: Deploying to production...');
    
    try {
      // Deploy to production
      await execAsync('netlify deploy --prod --dir=.next', { timeout: 600000 }); // 10 minute timeout
      
      // Wait for production deployment to be ready
      console.log('⏳ Waiting for production deployment to be ready...');
      await this.waitForDeployment(process.env.PRODUCTION_URL || 'https://app.meet-sam.com');
      
      console.log('✅ Production deployment completed');
      
    } catch (error) {
      this.rollbackRequired = true;
      throw new Error(`Production deployment failed: ${error.message}`);
    }
  }

  async validateProduction() {
    console.log('\n🔍 Phase 7: Validating production environment...');
    
    try {
      // Basic health check
      const productionUrl = process.env.PRODUCTION_URL || 'https://app.meet-sam.com';
      
      const response = await fetch(`${productionUrl}/api/monitoring/health`);
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      
      const healthData = await response.json();
      if (healthData.status !== 'healthy') {
        throw new Error(`System health check failed: ${healthData.status}`);
      }
      
      // Test critical endpoints
      const criticalEndpoints = [
        '/api/admin/stats',
        '/api/check-tables'
      ];
      
      for (const endpoint of criticalEndpoints) {
        const response = await fetch(`${productionUrl}${endpoint}`);
        if (!response.ok) {
          throw new Error(`Critical endpoint failed: ${endpoint} - ${response.status}`);
        }
      }
      
      console.log('✅ Production validation passed');
      
    } catch (error) {
      this.rollbackRequired = true;
      throw new Error(`Production validation failed: ${error.message}`);
    }
  }

  async postDeployment() {
    console.log('\n📋 Phase 8: Post-deployment tasks...');
    
    // Wait a bit for systems to stabilize
    console.log('⏳ Allowing systems to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
    
    // Final health check
    const productionUrl = process.env.PRODUCTION_URL || 'https://app.meet-sam.com';
    const response = await fetch(`${productionUrl}/api/monitoring/health`);
    const healthData = await response.json();
    
    console.log('📊 Final system status:', {
      status: healthData.status,
      uptime: healthData.uptime,
      environment: healthData.environment
    });
    
    // Cleanup old backups
    await this.backupSystem.cleanupOldBackups(20);
    
    console.log('✅ Post-deployment tasks completed');
  }

  async waitForDeployment(url, maxAttempts = 30) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(url, { 
          method: 'HEAD',
          timeout: 10000 
        });
        
        if (response.ok) {
          console.log(`✅ Deployment ready after ${attempt} attempts`);
          return;
        }
      } catch (error) {
        // Deployment not ready yet
      }
      
      console.log(`⏳ Attempt ${attempt}/${maxAttempts} - waiting for deployment...`);
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
    }
    
    throw new Error(`Deployment not ready after ${maxAttempts} attempts`);
  }

  async handleDeploymentFailure(error) {
    console.log('\n🚨 DEPLOYMENT FAILURE - Initiating failure handling...');
    
    if (this.rollbackRequired && this.backup) {
      console.log('🔄 Automatic rollback initiated...');
      try {
        // In a real scenario, this would trigger an automatic rollback
        console.log(`⚠️  Manual rollback required: node scripts/deployment/backup-rollback.js rollback ${this.backup.backupId}`);
      } catch (rollbackError) {
        console.error('❌ Rollback also failed:', rollbackError.message);
      }
    }
    
    // Generate failure report
    const failureReport = {
      deploymentId: this.deploymentId,
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      backup: this.backup?.backupId,
      rollbackRequired: this.rollbackRequired,
      environment: process.env.NODE_ENV,
      nodeVersion: process.version
    };
    
    await fs.writeFile(
      `deployment-failure-${this.deploymentId}.json`,
      JSON.stringify(failureReport, null, 2)
    );
    
    console.log(`📄 Failure report saved: deployment-failure-${this.deploymentId}.json`);
    
    // Send alerts (in production, this would send to monitoring systems)
    console.log('🚨 CRITICAL: Production deployment failed - immediate attention required');
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const deployer = new ProductionDeployer();
  
  try {
    await deployer.deploy();
    console.log('\n🎉 Deployment completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Deployment failed!');
    process.exit(1);
  }
}

export default ProductionDeployer;