const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 }
  });

  try {
    const page = await browser.newPage();

    console.log('Navigating to localhost:3001...');
    await page.goto('http://localhost:3001', {
      waitUntil: 'networkidle2',
      timeout: 10000
    });

    // Wait for page to load
    await page.waitForTimeout(3000);

    // Look for Workspace menu item and click it
    console.log('Looking for Workspace menu item...');
    const workspaceLink = await page.$('text=Workspace');
    if (workspaceLink) {
      await workspaceLink.click();
      console.log('Clicked Workspace menu item');
      await page.waitForTimeout(2000);
    }

    // Take screenshot
    console.log('Taking screenshot...');
    const screenshotPath = `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/temp/workspace-tiles-${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.png`;
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    console.log('✅ Screenshot saved to:', screenshotPath);

    await page.waitForTimeout(5000);
    await browser.close();
  } catch (error) {
    console.error('Error:', error);
    await browser.close();
  }
})();
