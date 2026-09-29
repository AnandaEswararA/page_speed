const express = require('express');
const cors = require('cors');
const lighthouseModule = require('lighthouse');
const lighthouse = lighthouseModule.default || lighthouseModule;
const chromeLauncher = require('chrome-launcher');
const CDP = require('chrome-remote-interface');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting - simple in-memory
const activeScans = new Map();
const MAX_CONCURRENT = 3;
const TIMEOUT_MS = 150000; // 2.5 minute timeout per scan

// Uncaught exception handler - keep server alive
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (server stays alive):', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection (server stays alive):', err.message || err);
});

// Timeout wrapper
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

// Real browser user agents
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

// Pre-warm: navigate to URL first to pass JS challenges (Cloudflare, hCDN, etc.)
// Then Lighthouse can analyze the already-cleared session
async function prewarmPage(port, targetUrl, userAgent) {
  const cdp = await CDP({ port });
  try {
    await cdp.Network.enable();
    await cdp.Network.setUserAgentOverride({ userAgent });
    await cdp.Page.enable();
    
    // Patch anti-bot detection
    await cdp.Page.addScriptToEvaluateOnNewDocument({
      source: `
        Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
        window.chrome = { runtime: {}, loadTimes: function(){}, csi: function(){} };
        Object.defineProperty(navigator, 'plugins', {get: () => [1,2,3,4,5]});
        Object.defineProperty(navigator, 'languages', {get: () => ['en-US','en']});
        const origQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (p) => p.name === 'notifications'
          ? Promise.resolve({state: Notification.permission})
          : origQuery(p);
      `
    });

    // Navigate and wait for JS challenge to resolve
    await cdp.Page.navigate({ url: targetUrl });
    
    // Wait up to 15 seconds for the page to fully load past any challenge
    await new Promise((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => { if (!resolved) { resolved = true; resolve(); } }, 15000);
      cdp.Page.loadEventFired(() => {
        // Wait an extra 2s after load for JS challenge redirects to complete
        setTimeout(() => { if (!resolved) { resolved = true; clearTimeout(timeout); resolve(); } }, 3000);
      });
    });

    // Extract cleared cookies and preserve across Lighthouse
    const { cookies } = await cdp.Network.getCookies({ urls: [targetUrl] });

    // Check final URL and status
    const { result } = await cdp.Runtime.evaluate({
      expression: 'document.readyState + "|" + document.title'
    });
    console.log(`  Prewarm result: ${result ? result.value : 'unknown'}, Cookies set: ${cookies ? cookies.length : 0}`);
  } finally {
    await cdp.close();
  }
}

// API: Run Lighthouse audit
app.get('/api/analyze', async (req, res) => {
  const url = req.query.url;
  const strategy = req.query.strategy || 'mobile';
  const categories = (req.query.category || 'performance,accessibility,best-practices,seo').split(',');

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  // Validate URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL provided' });
  }

  const targetUrl = parsedUrl.href;

  if (activeScans.size >= MAX_CONCURRENT) {
    return res.status(429).json({ error: 'Too many concurrent scans. Please try again shortly.' });
  }

  const scanId = Date.now().toString();
  activeScans.set(scanId, true);

  let chrome;
  try {
    console.log(`[${scanId}] Starting analysis: ${targetUrl} (${strategy})`);

    const userAgent = strategy === 'desktop' ? DESKTOP_UA : MOBILE_UA;

    chrome = await withTimeout(
      chromeLauncher.launch({
        chromeFlags: [
          '--headless=new',
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--no-first-run',
          '--ignore-certificate-errors',
          '--disable-blink-features=AutomationControlled',
        ],
      }),
      30000,
      'Chrome launch'
    );

    console.log(`[${scanId}] Chrome launched on port ${chrome.port}`);

    // Pre-warm: pass JS challenges before Lighthouse runs
    console.log(`[${scanId}] Pre-warming page to pass JS challenges...`);
    await withTimeout(
      prewarmPage(chrome.port, targetUrl, userAgent),
      20000,
      'Page prewarm'
    );
    console.log(`[${scanId}] Pre-warm done, running Lighthouse...`);

    const options = {
      logLevel: 'error',
      output: 'json',
      port: chrome.port,
      maxWaitForLoad: 60000,
      disableStorageReset: true,
      onlyCategories: categories,
      formFactor: strategy === 'desktop' ? 'desktop' : 'mobile',
      screenEmulation: strategy === 'desktop'
        ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }
        : { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
      throttling: strategy === 'desktop'
        ? { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 }
        : undefined,
      emulatedUserAgent: userAgent,
    };

    const result = await withTimeout(
      lighthouse(targetUrl, options),
      TIMEOUT_MS,
      'Lighthouse analysis'
    );

    if (!result || !result.report) {
      throw new Error('Lighthouse returned empty result');
    }

    const report = JSON.parse(result.report);
    console.log(`[${scanId}] Analysis complete for ${targetUrl}`);

    // Check for warnings
    const warnings = report.runWarnings || [];

    // Extract essential data
    const response = {
      lighthouseVersion: report.lighthouseVersion,
      requestedUrl: report.requestedUrl,
      finalUrl: report.finalUrl,
      fetchTime: report.fetchTime,
      environment: report.environment,
      runWarnings: warnings,
      categories: {},
      audits: {},
      timing: report.timing,
    };

    // Process categories
    for (const [key, cat] of Object.entries(report.categories || {})) {
      response.categories[key] = {
        id: cat.id,
        title: cat.title,
        score: cat.score,
        auditRefs: cat.auditRefs,
      };
    }

    // Process audits
    for (const [key, audit] of Object.entries(report.audits || {})) {
      response.audits[key] = {
        id: audit.id,
        title: audit.title,
        description: audit.description,
        score: audit.score,
        scoreDisplayMode: audit.scoreDisplayMode,
        displayValue: audit.displayValue,
        numericValue: audit.numericValue,
        numericUnit: audit.numericUnit,
        details: audit.details,
      };
    }

    // Core Web Vitals extraction
    response.coreWebVitals = {
      fcp: response.audits['first-contentful-paint'],
      lcp: response.audits['largest-contentful-paint'],
      tbt: response.audits['total-blocking-time'],
      cls: response.audits['cumulative-layout-shift'],
      si: response.audits['speed-index'],
      tti: response.audits['interactive'],
    };

    res.json(response);
  } catch (err) {
    console.error(`[${scanId}] Error:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Analysis failed: ' + err.message });
    }
  } finally {
    activeScans.delete(scanId);
    if (chrome) {
      try { await chrome.kill(); } catch (e) { /* ignore */ }
    }
  }
});

// API: Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeScans: activeScans.size, maxConcurrent: MAX_CONCURRENT });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PageSpeed Clone running at http://localhost:${PORT}`);
});
