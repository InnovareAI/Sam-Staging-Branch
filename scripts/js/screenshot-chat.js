#!/usr/bin/env node

/**
 * Screenshot the SAM AI Chat Interface with sample conversation
 */

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function screenshotChat() {
  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 2
    }
  });

  try {
    const page = await browser.newPage();

    console.log('Navigating to localhost:3000...');
    await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait a bit for the page to fully load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Try to find and click the Agent menu item
    console.log('Looking for Agent chat link...');
    const agentClicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button, div[role="button"]'));
      const agentLink = links.find(el =>
        el.textContent?.includes('Agent') ||
        el.textContent?.includes('Collaborate with Sam')
      );
      if (agentLink) {
        agentLink.click();
        return true;
      }
      return false;
    });

    if (agentClicked) {
      console.log('Clicked Agent link, waiting for chat to load...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Take screenshot
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const outputDir = path.join(__dirname, '../../temp');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `chat-interface-${timestamp}.png`);

    console.log('Taking screenshot...');
    await page.screenshot({
      path: outputPath,
      fullPage: true
    });

    console.log(`✅ Screenshot saved to: ${outputPath}`);

    // Keep browser open for manual inspection
    console.log('\nBrowser will stay open for 10 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 10000));

  } catch (error) {
    console.error('❌ Screenshot failed:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

screenshotChat();
