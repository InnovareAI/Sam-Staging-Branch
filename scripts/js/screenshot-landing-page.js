import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set viewport to desktop size
  await page.setViewportSize({ width: 1920, height: 1080 });

  // Navigate to the landing page
  console.log('Loading https://innovareai.com/sam...');
  await page.goto('https://innovareai.com/sam', { waitUntil: 'networkidle' });

  // Take full page screenshot
  console.log('Taking screenshot...');
  await page.screenshot({
    path: 'temp/innovareai-landing-page.png',
    fullPage: true
  });

  console.log('Screenshot saved to: temp/innovareai-landing-page.png');

  await browser.close();
})();
