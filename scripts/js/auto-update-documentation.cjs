#!/usr/bin/env node
/**
 * Auto-Update Documentation System
 * Automatically updates CLAUDE.md when significant changes are made
 * 
 * Usage: Run this after major implementations or when prompted
 */

const fs = require('fs');
const path = require('path');

class DocumentationUpdater {
  constructor() {
    this.projectRoot = process.cwd();
    this.claudeFile = path.join(this.projectRoot, 'CLAUDE.md');
    this.currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    this.currentDateShort = new Date().toISOString().split('T')[0];
  }

  // Detect recent file changes that should trigger documentation updates
  detectSignificantChanges() {
    const significantPaths = [
      'app/api/**/*.ts',
      'supabase/migrations/**/*.sql', 
      'docs/**/*.md',
      'sql/**/*.sql'
    ];

    const recentChanges = [];
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

    // Check for recently modified files
    const checkDirectory = (dir) => {
      if (!fs.existsSync(dir)) return;
      
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        
        if (file.isDirectory()) {
          checkDirectory(fullPath);
        } else if (file.isFile()) {
          const stats = fs.statSync(fullPath);
          if (stats.mtime.getTime() > oneDayAgo) {
            // Check if it's a significant file type
            if (fullPath.includes('/api/') || 
                fullPath.includes('migrations/') ||
                fullPath.includes('.sql') ||
                fullPath.includes('docs/')) {
              recentChanges.push({
                path: fullPath.replace(this.projectRoot, ''),
                modified: stats.mtime,
                type: this.categorizeChange(fullPath)
              });
            }
          }
        }
      }
    };

    checkDirectory(path.join(this.projectRoot, 'app'));
    checkDirectory(path.join(this.projectRoot, 'supabase'));
    checkDirectory(path.join(this.projectRoot, 'docs'));
    checkDirectory(path.join(this.projectRoot, 'sql'));

    return recentChanges;
  }

  categorizeChange(filePath) {
    if (filePath.includes('/api/campaigns/email/')) return 'EMAIL_CAMPAIGN';
    if (filePath.includes('/api/campaigns/linkedin/')) return 'LINKEDIN_CAMPAIGN';
    if (filePath.includes('/api/workspaces/')) return 'WORKSPACE_MANAGEMENT';
    if (filePath.includes('/api/hitl/')) return 'HITL_SYSTEM';
    if (filePath.includes('migrations/')) return 'DATABASE_SCHEMA';
    if (filePath.includes('docs/integrations/')) return 'INTEGRATION_DOCS';
    if (filePath.includes('sql/')) return 'DATABASE_SCRIPT';
    return 'GENERAL';
  }

  // Generate update entry for CLAUDE.md
  generateUpdateEntry(changes) {
    const changesByType = {};
    changes.forEach(change => {
      if (!changesByType[change.type]) {
        changesByType[change.type] = [];
      }
      changesByType[change.type].push(change);
    });

    let updateEntry = `## 🔄 RECENT UPDATES (${this.currentDate})\n\n`;
    updateEntry += `**Auto-Generated Update**: ${this.currentDate}\n\n`;

    Object.entries(changesByType).forEach(([type, typeChanges]) => {
      const typeLabel = this.getTypeLabel(type);
      updateEntry += `### ${typeLabel}\n`;
      
      typeChanges.forEach(change => {
        updateEntry += `- **Modified**: \`${change.path}\`\n`;
        updateEntry += `  - **Date**: ${change.modified.toLocaleDateString()}\n`;
      });
      updateEntry += '\n';
    });

    return updateEntry;
  }

  getTypeLabel(type) {
    const labels = {
      'EMAIL_CAMPAIGN': '📧 Email Campaign System',
      'LINKEDIN_CAMPAIGN': '🔗 LinkedIn Campaign System', 
      'WORKSPACE_MANAGEMENT': '🏢 Workspace Management',
      'HITL_SYSTEM': '👤 Human-in-the-Loop System',
      'DATABASE_SCHEMA': '🗄️ Database Schema Changes',
      'INTEGRATION_DOCS': '📚 Integration Documentation',
      'DATABASE_SCRIPT': '📜 Database Scripts',
      'GENERAL': '⚙️ General Updates'
    };
    return labels[type] || '⚙️ System Updates';
  }

  // Update the CLAUDE.md file with new information
  updateClaudeFile(changes) {
    if (!fs.existsSync(this.claudeFile)) {
      console.error('CLAUDE.md not found');
      return false;
    }

    let content = fs.readFileSync(this.claudeFile, 'utf8');
    
    // Update the "LAST UPDATED" line
    content = content.replace(
      /\*\*LAST UPDATED\*\*:.*$/m,
      `**LAST UPDATED**: ${this.currentDate} - Auto-updated with recent changes`
    );

    // Add recent updates section after current focus
    const updateEntry = this.generateUpdateEntry(changes);
    const focusLineRegex = /(\*\*📍 CURRENT FOCUS:.*?)\n/s;
    
    if (focusLineRegex.test(content)) {
      content = content.replace(
        focusLineRegex,
        `$1\n\n---\n\n${updateEntry}`
      );
    }

    fs.writeFileSync(this.claudeFile, content);
    return true;
  }

  // Main execution function
  async run() {
    console.log('🔄 Checking for significant changes...');
    
    const changes = this.detectSignificantChanges();
    
    if (changes.length === 0) {
      console.log('✅ No significant changes detected in the last 24 hours');
      return;
    }

    console.log(`📝 Found ${changes.length} significant changes:`);
    changes.forEach(change => {
      console.log(`  - ${change.path} (${change.type})`);
    });

    console.log('📚 Updating CLAUDE.md...');
    const success = this.updateClaudeFile(changes);
    
    if (success) {
      console.log('✅ Documentation updated successfully');
      console.log(`📅 Updated on: ${this.currentDate}`);
    } else {
      console.error('❌ Failed to update documentation');
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const updater = new DocumentationUpdater();
  updater.run().catch(console.error);
}

module.exports = DocumentationUpdater;