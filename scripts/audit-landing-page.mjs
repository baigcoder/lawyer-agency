import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE_URL = 'http://localhost:3002';
const OUTPUT_DIR = resolve(process.cwd(), 'audit-results');
mkdirSync(OUTPUT_DIR, { recursive: true });

const axeSource = readFileSync(resolve(process.cwd(), 'node_modules/axe-core/axe.min.js'), 'utf-8');

async function runAudit() {
  console.log('🚀 Starting Comprehensive Playwright Audit for Landing Page at:', BASE_URL);

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const consoleMessages = [];
  const networkErrors = [];
  const auditReport = {
    url: BASE_URL,
    timestamp: new Date().toISOString(),
    viewports: {},
    accessibility: {},
    interactiveChecks: {},
    headingStructure: [],
    seoMeta: {},
    networkErrors: [],
    consoleMessages: [],
  };

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  page.on('requestfailed', req => {
    networkErrors.push({
      url: req.url(),
      failure: req.failure()?.errorText || 'Failed',
    });
  });

  page.on('response', res => {
    if (res.status() >= 400) {
      networkErrors.push({
        url: res.url(),
        status: res.status(),
        statusText: res.statusText(),
      });
    }
  });

  console.log('📄 Navigating to landing page...');
  const response = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  auditReport.httpStatus = response?.status();

  // 1. SEO & Metadata
  console.log('🔍 Checking SEO & Head tags...');
  auditReport.seoMeta = await page.evaluate(() => {
    return {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') || null,
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null,
      viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') || null,
      ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || null,
      ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content') || null,
      ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null,
      charset: document.characterSet,
      htmlLang: document.documentElement.lang,
      htmlDir: document.documentElement.dir,
    };
  });

  // 2. Heading Structure
  console.log('📑 Checking Heading Hierarchy...');
  auditReport.headingStructure = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    return headings.map(h => ({
      tag: h.tagName.toLowerCase(),
      text: h.textContent?.trim().replace(/\s+/g, ' ').substring(0, 80),
      isVisible: h.offsetWidth > 0 && h.offsetHeight > 0,
    }));
  });

  // 3. Desktop Axe Accessibility Audit
  console.log('♿ Running Axe-Core Accessibility Audit (Desktop)...');
  await page.evaluate(axeSource);
  const axeResults = await page.evaluate(async () => {
    // @ts-ignore
    return await window.axe.run({
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
      },
    });
  });

  auditReport.accessibility.desktop = {
    violationsCount: axeResults.violations.length,
    violations: axeResults.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodesCount: v.nodes.length,
      sampleNode: v.nodes[0] ? {
        html: v.nodes[0].html.substring(0, 150),
        target: v.nodes[0].target,
        failureSummary: v.nodes[0].failureSummary,
      } : null,
    })),
    passesCount: axeResults.passes.length,
  };

  await page.screenshot({ path: resolve(OUTPUT_DIR, 'desktop-1440.png'), fullPage: true });

  // 4. Viewport & Overflow Tests
  const viewportsToTest = [
    { name: 'desktop-wide', width: 1440, height: 900 },
    { name: 'laptop', width: 1280, height: 800 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
    { name: 'mobile-small', width: 360, height: 740 },
  ];

  for (const vp of viewportsToTest) {
    console.log(`📱 Testing Viewport: ${vp.name} (${vp.width}x${vp.height})...`);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(500);

    const overflowCheck = await page.evaluate(() => {
      const docWidth = document.documentElement.offsetWidth;
      const scrollWidth = document.documentElement.scrollWidth;
      const hasHorizontalScroll = scrollWidth > docWidth;

      const overflowingElements = [];
      if (hasHorizontalScroll) {
        document.querySelectorAll('*').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > docWidth + 1) {
            overflowingElements.push({
              tag: el.tagName.toLowerCase(),
              className: (el.className || '').toString().substring(0, 60),
              right: Math.round(rect.right),
              excess: Math.round(rect.right - docWidth),
            });
          }
        });
      }

      return {
        hasHorizontalScroll,
        docWidth,
        scrollWidth,
        overflowCount: overflowingElements.length,
        sampleOverflow: overflowingElements.slice(0, 5),
      };
    });

    auditReport.viewports[vp.name] = overflowCheck;
    await page.screenshot({ path: resolve(OUTPUT_DIR, `${vp.name}.png`), fullPage: false });
  }

  // 5. Mobile Accessibility Audit
  console.log('♿ Running Axe-Core Accessibility Audit (Mobile 390px)...');
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileAxeResults = await page.evaluate(async () => {
    // @ts-ignore
    return await window.axe.run({
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa'],
      },
    });
  });

  auditReport.accessibility.mobile = {
    violationsCount: mobileAxeResults.violations.length,
    violations: mobileAxeResults.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      sampleTarget: v.nodes[0]?.target,
    })),
  };

  // 6. Interactive Testing: Language Toggle (English -> Urdu -> English)
  console.log('🌐 Testing Language Switcher & RTL layout...');
  await page.setViewportSize({ width: 1440, height: 900 });
  const langTrigger = await page.$('button[aria-label="Language"], button[aria-label="زبان"], button:has-text("English")');
  if (langTrigger) {
    console.log('Opening language dropdown...');
    await langTrigger.click();
    await page.waitForTimeout(400);

    const urduOption = await page.$('[role="menuitem"]:has-text("اردو"), [role="menuitem"]:has-text("Urdu")');
    if (urduOption) {
      console.log('Selecting Urdu language...');
      await urduOption.click();
      await page.waitForTimeout(800);

      const urduState = await page.evaluate(() => ({
        dir: document.documentElement.dir || document.body.dir,
        lang: document.documentElement.lang,
        hasRtlClass: document.documentElement.classList.contains('rtl') || document.body.classList.contains('rtl'),
      }));
      auditReport.interactiveChecks.languageUrdu = urduState;
      await page.screenshot({ path: resolve(OUTPUT_DIR, 'urdu-mode.png'), fullPage: false });

      // Click back to English
      const langTriggerBack = await page.$('button[aria-label="Language"], button[aria-label="زبان"]');
      if (langTriggerBack) {
        await langTriggerBack.click();
        await page.waitForTimeout(400);
        const englishOption = await page.$('[role="menuitem"]:has-text("English")');
        if (englishOption) {
          await englishOption.click();
          await page.waitForTimeout(500);
        }
      }
    } else {
      auditReport.interactiveChecks.languageUrdu = { error: 'Urdu menuitem not found' };
    }
  } else {
    auditReport.interactiveChecks.languageUrdu = { error: 'Language button not found' };
  }

  // 7. Interactive Testing: MatterFrame Sequence
  console.log('⚖️ Testing MatterFrame Interactive Sequence...');
  const matterButtons = await page.$$('.matter-frame ol button, .matter-frame [aria-current], button[data-step]');
  auditReport.interactiveChecks.matterFrameButtonsCount = matterButtons.length;

  // 8. Interactive Testing: Film Player
  console.log('🎬 Testing Film Player element...');
  const filmVideo = await page.$('video');
  const filmPoster = await page.$('video, [data-slot="film-player"], img[src*="film"]');
  auditReport.interactiveChecks.filmPlayer = {
    hasVideoTag: !!filmVideo,
    videoSrc: filmVideo ? await filmVideo.getAttribute('src') : null,
    posterSrc: filmVideo ? await filmVideo.getAttribute('poster') : null,
  };

  // 9. Links & CTAs audit
  console.log('🔗 Checking Links & Action buttons...');
  auditReport.interactiveChecks.links = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'));
    const linkData = links.map(a => ({
      text: a.textContent?.trim().replace(/\s+/g, ' ').substring(0, 50),
      href: a.getAttribute('href'),
      isExternal: (a.getAttribute('href') || '').startsWith('http'),
    }));

    const emptyLinks = linkData.filter(l => !l.text && !l.href?.includes('#'));
    const buttonsWithoutText = Array.from(document.querySelectorAll('button')).filter(b => {
      return !b.textContent?.trim() && !b.getAttribute('aria-label') && !b.querySelector('svg[aria-label]');
    });

    return {
      totalLinks: linkData.length,
      sampleLinks: linkData.slice(0, 10),
      emptyLinksCount: emptyLinks.length,
      buttonsWithoutLabelCount: buttonsWithoutText.length,
    };
  });

  // 10. Performance & DOM Metrics
  console.log('⚡ Checking DOM Metrics & Weights...');
  auditReport.domMetrics = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const images = Array.from(document.querySelectorAll('img'));
    const svgs = Array.from(document.querySelectorAll('svg'));
    return {
      totalDomElements: all.length,
      imagesCount: images.length,
      imagesWithoutAlt: images.filter(img => !img.hasAttribute('alt')).length,
      svgCount: svgs.length,
      svgWithoutAria: svgs.filter(s => !s.hasAttribute('aria-hidden') && !s.hasAttribute('aria-label')).length,
    };
  });

  auditReport.consoleMessages = consoleMessages;
  auditReport.networkErrors = networkErrors;

  await browser.close();

  const reportPath = resolve(OUTPUT_DIR, 'audit-report.json');
  writeFileSync(reportPath, JSON.stringify(auditReport, null, 2), 'utf-8');
  console.log(`✅ Audit complete! Results written to: ${reportPath}`);
}

runAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
