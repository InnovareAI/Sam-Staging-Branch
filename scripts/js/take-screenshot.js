#!/usr/bin/env node

/**
 * Screenshot Utility for SAM AI Chat Interface
 * Takes screenshots of the app for visual review
 */

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function takeScreenshot(url, outputPath, options = {}) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Set viewport size
    await page.setViewport({
      width: options.width || 1920,
      height: options.height || 1080,
      deviceScaleFactor: 2
    });

    console.log(`Navigating to ${url}...`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for any additional loading
    if (options.waitFor) {
      await page.waitForSelector(options.waitFor, { timeout: 10000 });
    }

    console.log(`Taking screenshot...`);
    await page.screenshot({
      path: outputPath,
      fullPage: options.fullPage || false
    });

    console.log(`✅ Screenshot saved to: ${outputPath}`);
  } catch (error) {
    console.error('❌ Screenshot failed:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Main execution
(async () => {
  const url = process.argv[2] || 'http://localhost:3000';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const outputDir = path.join(__dirname, '../../temp');

  // Create temp directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `screenshot-${timestamp}.png`);

  await takeScreenshot(url, outputPath, {
    fullPage: true,
    width: 1920,
    height: 1080
  });

  console.log('\nTo take a screenshot with authentication:');
  console.log('1. Log in to the app manually');
  console.log('2. Copy the authentication cookies');
  console.log('3. Modify this script to inject cookies');
})();
