========================================================================
                          PAGESPEED AUDITOR
              Fast & Free Website Performance Analyzer
========================================================================

Welcome to PageSpeed Auditor! This tool tests any website and tells you 
how fast it loads, how healthy its code is, and what you can do to make 
it faster.

Everything runs privately on your own computer using the official Google 
Lighthouse engine, wrapped in a sleek, dark anime/manga-inspired interface.


========================================================================
1. QUICK START GUIDE (How to Run It)
========================================================================

Before starting, make sure you have:
- Node.js installed (download from https://nodejs.org if you don't have it)
- Google Chrome browser installed on your computer

Step-by-step instructions:

1. Open your terminal / command prompt and navigate to this folder:
   cd C:\DISK\projects\pagespeed-clone

2. Install the required files (only needed the first time):
   npm install

3. Start the application:
   npm start

4. Open your web browser (Chrome, Edge, Firefox, etc.) and go to:
   http://localhost:3000

5. Type or paste any website link (for example: https://example.com) 
   and click "ANALYZE".


========================================================================
2. WHAT DO THE SCORES MEAN?
========================================================================

When the test finishes, you will see four main score circles (from 0 to 100):

* ⚡ PERFORMANCE (0-100)
  How fast your website loads and how smoothly it runs for visitors.

* 🎯 ACCESSIBILITY (0-100)
  How easy the website is to use for everyone, including people using 
  screen readers, keyboards, or high-contrast modes.

* 🛡️ BEST PRACTICES (0-100)
  Checks if the website follows modern web security, HTTPS standards, 
  and error-free code guidelines.

* 🔍 SEO (0-100)
  How well the website is set up to be discovered and ranked on Google 
  and search engines.

SCORE COLOR GUIDE:
* 🟢 Green  (90 - 100) : Excellent! Fast and well-optimized.
* 🟠 Orange (50 - 89)  : Average. Has room for improvement.
* 🔴 Red    (0 - 49)   : Slow / Needs immediate optimization.


========================================================================
3. UNDERSTANDING CORE WEB VITALS
========================================================================

These 6 boxes show real-world speed benchmarks:

1. First Contentful Paint (FCP):
   The exact second when the first piece of text or image appears on screen.
   Goal: Under 1.8 seconds.

2. Largest Contentful Paint (LCP):
   When the main image or biggest content block finishes loading.
   Goal: Under 2.5 seconds.

3. Total Blocking Time (TBT):
   How long the page freezes before you can click buttons or scroll freely.
   Goal: Under 200 milliseconds.

4. Cumulative Layout Shift (CLS):
   How much elements jump or shift around while loading.
   Goal: Under 0.1 (minimal movement).

5. Speed Index (SI):
   How quickly the visible parts of the page populate with content.

6. Time to Interactive (TTI):
   When the webpage is 100% fully loaded and responsive to all user actions.


========================================================================
4. KEY FEATURES
========================================================================

* Mobile & Desktop Switching:
  Easily test how your site loads on mobile phones (with 4G network 
  simulation) versus desktop computers with one click.

* Actionable Fixes & Battle Report:
  Click any issue in the diagnostics list below the scores to see 
  practical steps to speed up your website (like resizing heavy images, 
  removing unused scripts, or enabling caching).

* Anti-Bot Prewarming:
  Automatically handles security interstitial screens (such as Cloudflare 
  waiting rooms) before auditing, giving you real, accurate scores.

* 100% Private & Unlimited:
  No daily scan limits, no API quotas, and no data tracking.


========================================================================
5. TROUBLESHOOTING & COMMON QUESTIONS
========================================================================

Q: The scan says "Connection timed out" or "Analysis failed".
A: Double check that the website is online and accessible. If the URL 
   redirects (like zoho.com to www.zoho.com), try entering the final URL 
   with "https://www." directly.

Q: How do I stop the server?
A: In your terminal window, press Ctrl + C on your keyboard.

Q: Can I change the port from 3000 to something else?
A: Yes! You can set the PORT environment variable before starting, or 
   edit line 10 in server.js.


========================================================================
                   THANK YOU FOR USING PAGESPEED AUDITOR!
========================================================================
