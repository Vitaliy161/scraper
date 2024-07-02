const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize a browser instance
let browser;
(async () => {
  browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 },
  });
})();

app.post('/scrape', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const page = await browser.newPage();

    // Intercept and block CSS, images, and fonts
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (['stylesheet', 'image', 'font'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Disable JavaScript (optional, but can speed things up further)
    await page.setJavaScriptEnabled(false);

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Scrape the page title
    const title = await page.title();

    // Scrape all text from the body
    const bodyText = await page.evaluate(() => document.body.innerText);

    // Scrape metadata
    const metadata = await page.evaluate(() => {
      const metaTags = document.getElementsByTagName('meta');
      const data = {};
      for (let i = 0; i < metaTags.length; i++) {
        const name = metaTags[i].getAttribute('name') || metaTags[i].getAttribute('property');
        if (name) {
          data[name] = metaTags[i].getAttribute('content');
        }
      }
      return data;
    });

    await page.close();

    res.json({ title, bodyText, metadata });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  if (browser) await browser.close();
  process.exit();
});