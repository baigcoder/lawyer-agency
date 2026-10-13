import { chromium } from 'playwright';

async function capture() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto('http://localhost:3002/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const sections = ['film', 'front-door', 'formation', 'intelligence', 'voice', 'handoff', 'command', 'control', 'security', 'faq'];
  for (const s of sections) {
    const el = await page.$(`#${s}`);
    if (el) {
      await el.screenshot({ path: `audit-results/sec-${s}.png` });
      console.log(`Captured ${s}`);
    }
  }
  await browser.close();
  console.log('Done!');
}

capture().catch(console.error);
