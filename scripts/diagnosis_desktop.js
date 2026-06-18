const puppeteer = require('puppeteer');
const http = require('http');
const handler = require('serve-handler');

async function run() {
  console.log('Starting local server on port 3006...');
  const server = http.createServer((request, response) => {
    return handler(request, response, { public: 'out' });
  });

  server.listen(3006, async () => {
    console.log('Server is running. Launching Puppeteer...');
    try {
      const browser = await puppeteer.launch({ headless: "new" });
      const page = await browser.newPage();
      
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(`Console Error: ${msg.text()}`);
          console.log(`[Caught Error] ${msg.text()}`);
        }
      });
      page.on('pageerror', err => {
        errors.push(`Page Error: ${err.message}`);
        console.log(`[Caught Page Error] ${err.message}`);
      });
      
      console.log('Navigating to http://localhost:3006 ...');
      // Wait for DOMContentLoaded instead of networkidle0, because Firebase keeps websockets open
      await page.goto('http://localhost:3006', { waitUntil: 'domcontentloaded', timeout: 10000 });
      
      // Wait an additional 3 seconds to let React mount and Firebase init
      await new Promise(r => setTimeout(r, 3000));
      
      console.log('--- DIAGNOSIS RESULTS ---');
      if (errors.length > 0) {
        console.log('Found Errors:');
        errors.forEach(e => console.log(e));
      } else {
        console.log('No errors found during page load.');
      }
      
      await browser.close();
    } catch (e) {
      console.error('Puppeteer Script Error:', e);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

run();
