#!/usr/bin/env node
/**
 * Visual Testing Script for Sam AI Platform
 *
 * Takes screenshots, logs errors, and navigates pages for visual verification.
 * Can run headed (visible browser) or headless.
 *
 * Usage:
 *   node scripts/js/visual-test.mjs [url] [options]
 *
 * Examples:
 *   npm run visual-test -- --prod --headed              # Open visible browser on prod
 *   npm run visual-test -- --prod --login               # Login and screenshot
 *   npm run visual-test -- --prod --all --headed        # All pages, visible
 *   npm run visual-test -- --prod /workspace/x/campaigns --headed
 *
 * Options:
 *   --headed          Open visible browser window
 *   --login           Perform login before screenshots
 *   --prod            Use production URL
 *   --staging         Use staging URL
 *   --all             Screenshot all key pages
 *   --workspace ID    Use specific workspace ID
 *   --slow            Slow down actions (for watching)
 *   --pause           Pause after each page (press Enter to continue)
 *   --report          Generate detailed error report
 *
 * Added Dec 30, 2025
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Configuration
const CONFIG = {
  localhost: 'http://localhost:3000',
  staging: 'https://staging.meet-sam.com',
  production: 'https://app.meet-sam.com',
  screenshotDir: 'temp/screenshots',
  reportDir: 'temp/reports',
  defaultWorkspaceId: 'babdcab8-1a78-4b2f-913e-6e9fd9821009', // InnovareAI production
  // Login credentials - set via environment variables
  loginEmail: process.env.SAM_TEST_EMAIL || '',
  loginPassword: process.env.SAM_TEST_PASSWORD || '',
};

// Key pages to screenshot when using --all
const KEY_PAGES = [
  { path: '/', name: 'home', requiresAuth: false },
  { path: '/workspace/{workspaceId}', name: 'workspace-dashboard', requiresAuth: true },
  { path: '/workspace/{workspaceId}/campaigns', name: 'campaigns', requiresAuth: true },
  { path: '/workspace/{workspaceId}/commenting-agent', name: 'commenting-agent', requiresAuth: true },
  { path: '/workspace/{workspaceId}/commenting-agent/settings', name: 'commenting-settings', requiresAuth: true },
  { path: '/workspace/{workspaceId}/prospects', name: 'prospects', requiresAuth: true },
];

// Error collection
const collectedErrors = {
  console: [],
  network: [],
  visual: [],
  uncaught: [],
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: null,
    baseUrl: CONFIG.localhost,
    screenshotAll: false,
    login: false,
    headed: false,
    slow: false,
    pause: false,
    report: false,
    workspaceId: CONFIG.defaultWorkspaceId,
    viewport: { width: 1440, height: 900 },
    fullPage: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--staging') {
      options.baseUrl = CONFIG.staging;
    } else if (arg === '--prod' || arg === '--production') {
      options.baseUrl = CONFIG.production;
    } else if (arg === '--all') {
      options.screenshotAll = true;
    } else if (arg === '--login') {
      options.login = true;
    } else if (arg === '--headed') {
      options.headed = true;
    } else if (arg === '--slow') {
      options.slow = true;
    } else if (arg === '--pause') {
      options.pause = true;
    } else if (arg === '--report') {
      options.report = true;
    } else if (arg === '--workspace' && args[i + 1]) {
      options.workspaceId = args[++i];
    } else if (arg === '--width' && args[i + 1]) {
      options.viewport.width = parseInt(args[++i], 10);
    } else if (arg === '--height' && args[i + 1]) {
      options.viewport.height = parseInt(args[++i], 10);
    } else if (arg === '--no-fullpage') {
      options.fullPage = false;
    } else if (!arg.startsWith('--')) {
      options.url = arg;
    }
  }

  return options;
}

// Ensure directories exist
function ensureDirs() {
  [CONFIG.screenshotDir, CONFIG.reportDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Generate screenshot filename
function getScreenshotPath(name, baseUrl) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const env = baseUrl.includes('localhost') ? 'local' :
              baseUrl.includes('staging') ? 'staging' : 'prod';
  return path.join(CONFIG.screenshotDir, `${name}_${env}_${timestamp}.png`);
}

// Wait for user input (for --pause mode)
async function waitForEnter(prompt = 'Press Enter to continue...') {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

// Setup error listeners on page
function setupErrorListeners(page) {
  // Console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      collectedErrors.console.push({
        text: msg.text(),
        location: msg.location(),
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Page errors (uncaught exceptions)
  page.on('pageerror', error => {
    collectedErrors.uncaught.push({
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  });

  // Network failures
  page.on('requestfailed', request => {
    collectedErrors.network.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure()?.errorText,
      timestamp: new Date().toISOString(),
    });
  });
}

// Perform login
async function performLogin(page, options) {
  console.log('🔐 Performing login...');

  const email = CONFIG.loginEmail;
  const password = CONFIG.loginPassword;

  if (!email || !password) {
    console.log('   ⚠️  No credentials set. Set SAM_TEST_EMAIL and SAM_TEST_PASSWORD env vars.');
    console.log('   💡 Or login manually in the browser window and press Enter when ready.');

    if (options.headed) {
      await page.goto(`${options.baseUrl}/`, { waitUntil: 'networkidle' });
      await waitForEnter('   Press Enter after logging in manually...');
      return true;
    }
    return false;
  }

  try {
    // Go to home page (triggers login modal or redirects to login)
    await page.goto(`${options.baseUrl}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Fill in email
    const emailInput = await page.$('input[type="email"], input[placeholder*="email" i]');
    if (emailInput) {
      await emailInput.fill(email);
    }

    // Fill in password
    const passwordInput = await page.$('input[type="password"]');
    if (passwordInput) {
      await passwordInput.fill(password);
    }

    // Click sign in button
    const signInButton = await page.$('button:has-text("Sign In"), button:has-text("Login")');
    if (signInButton) {
      await signInButton.click();
      await page.waitForTimeout(3000); // Wait for auth
    }

    console.log('   ✅ Login attempted');
    return true;
  } catch (error) {
    console.error('   ❌ Login failed:', error.message);
    return false;
  }
}

// Take a screenshot of a page
async function takeScreenshot(page, url, name, options) {
  const fullUrl = url.startsWith('http') ? url : `${options.baseUrl}${url}`;
  console.log(`📸 Capturing: ${name}`);
  console.log(`   URL: ${fullUrl}`);

  const result = {
    name,
    url: fullUrl,
    success: false,
    screenshotPath: null,
    errors: {
      console: [],
      network: [],
      uncaught: [],
    },
    timing: {},
  };

  try {
    const startTime = Date.now();

    // Clear error collectors for this page
    const pageErrors = { console: [], network: [], uncaught: [] };

    // Navigate
    await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
    result.timing.navigation = Date.now() - startTime;

    // Wait for any animations/lazy loading
    await page.waitForTimeout(options.slow ? 2000 : 1000);
    result.timing.settle = Date.now() - startTime;

    // Collect any errors that occurred on this page
    result.errors.console = [...collectedErrors.console];
    result.errors.network = [...collectedErrors.network];
    result.errors.uncaught = [...collectedErrors.uncaught];

    // Clear global collectors
    collectedErrors.console = [];
    collectedErrors.network = [];
    collectedErrors.uncaught = [];

    // Take screenshot
    const screenshotPath = getScreenshotPath(name, options.baseUrl);
    await page.screenshot({
      path: screenshotPath,
      fullPage: options.fullPage
    });
    result.screenshotPath = screenshotPath;
    result.timing.total = Date.now() - startTime;

    result.success = true;
    console.log(`   ✅ Saved: ${screenshotPath}`);

    // Report errors if any
    const errorCount = result.errors.console.length + result.errors.network.length + result.errors.uncaught.length;
    if (errorCount > 0) {
      console.log(`   ⚠️  ${errorCount} error(s) detected on this page`);
    }

    // Pause if requested
    if (options.pause) {
      await waitForEnter('   Press Enter to continue to next page...');
    }

  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    result.error = error.message;
  }

  return result;
}

// Generate error report
function generateReport(results, options) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportPath = path.join(CONFIG.reportDir, `visual-test-report_${timestamp}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: options.baseUrl,
    totalPages: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    pagesWithErrors: results.filter(r =>
      r.errors.console.length > 0 ||
      r.errors.network.length > 0 ||
      r.errors.uncaught.length > 0
    ).length,
    results,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📋 Report saved: ${reportPath}`);

  return reportPath;
}

// Print summary for Claude to read
function printClaudeSummary(results) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 VISUAL TEST SUMMARY (for Claude analysis)');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const withErrors = results.filter(r =>
    r.errors.console.length > 0 ||
    r.errors.network.length > 0 ||
    r.errors.uncaught.length > 0
  );

  console.log(`\nPages tested: ${results.length}`);
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`⚠️  With errors: ${withErrors.length}`);

  if (failed.length > 0) {
    console.log('\n🔴 FAILED PAGES:');
    failed.forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }

  if (withErrors.length > 0) {
    console.log('\n🟡 PAGES WITH ERRORS:');
    withErrors.forEach(r => {
      console.log(`\n   ${r.name} (${r.url}):`);
      if (r.errors.console.length > 0) {
        console.log(`   Console errors (${r.errors.console.length}):`);
        r.errors.console.forEach(e => console.log(`      - ${e.text}`));
      }
      if (r.errors.network.length > 0) {
        console.log(`   Network errors (${r.errors.network.length}):`);
        r.errors.network.forEach(e => console.log(`      - ${e.method} ${e.url}: ${e.failure}`));
      }
      if (r.errors.uncaught.length > 0) {
        console.log(`   Uncaught errors (${r.errors.uncaught.length}):`);
        r.errors.uncaught.forEach(e => console.log(`      - ${e.message}`));
      }
    });
  }

  if (successful.length > 0) {
    console.log('\n📁 Screenshots saved:');
    successful.forEach(r => {
      if (r.screenshotPath) {
        console.log(`   ${r.screenshotPath}`);
      }
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('💡 To analyze visuals, ask Claude to read the screenshot files.');
  console.log('='.repeat(60));
}

// Main function
async function main() {
  const options = parseArgs();
  ensureDirs();

  console.log('\n🔍 Visual Testing Script');
  console.log('========================');
  console.log(`Base URL: ${options.baseUrl}`);
  console.log(`Viewport: ${options.viewport.width}x${options.viewport.height}`);
  console.log(`Headed: ${options.headed}`);
  console.log(`Login: ${options.login}`);
  console.log(`Slow mode: ${options.slow}`);
  console.log('');

  const browser = await chromium.launch({
    headless: !options.headed,
    slowMo: options.slow ? 100 : 0,
  });

  const context = await browser.newContext({
    viewport: options.viewport,
  });

  const page = await context.newPage();

  // Setup error listeners
  setupErrorListeners(page);

  const results = [];

  try {
    // Login if requested
    if (options.login) {
      await performLogin(page, options);
    }

    if (options.screenshotAll) {
      // Screenshot all key pages
      console.log('📋 Capturing all key pages...\n');

      for (const pageConfig of KEY_PAGES) {
        // Skip auth-required pages if not logged in
        if (pageConfig.requiresAuth && !options.login) {
          console.log(`⏭️  Skipping ${pageConfig.name} (requires auth)`);
          continue;
        }

        const pagePath = pageConfig.path.replace('{workspaceId}', options.workspaceId);
        const result = await takeScreenshot(page, pagePath, pageConfig.name, options);
        results.push(result);
      }
    } else if (options.url) {
      // Screenshot specific URL
      const pagePath = options.url.replace('{workspaceId}', options.workspaceId);
      const name = pagePath.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const result = await takeScreenshot(page, pagePath, name || 'page', options);
      results.push(result);
    } else {
      // Default: screenshot home page
      const result = await takeScreenshot(page, '/', 'home', options);
      results.push(result);
    }

    // Generate report if requested
    if (options.report) {
      generateReport(results, options);
    }

    // Print summary
    printClaudeSummary(results);

  } finally {
    if (options.pause && options.headed) {
      await waitForEnter('\n🏁 Testing complete. Press Enter to close browser...');
    }
    await browser.close();
  }
}

main().catch(console.error);
