const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const app = express();

app.get('/', (req, res) => {
  res.send('DozeMulti is running 🚀');
});

// Browse endpoint
app.get('/browse', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('Missing url');

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const html = await page.content();
    await browser.close();

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
});

// Screenshot endpoint
app.get('/screenshot', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('Missing url');

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const buffer = await page.screenshot({ fullPage: true });
    await browser.close();

    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`DozeMulti running on port ${PORT}`));
