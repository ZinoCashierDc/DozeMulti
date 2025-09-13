// Import necessary modules
const express = require('express');
const fetch = require('node-fetch');

const app = express();

// Enable CORS if needed (optional)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// Proxy endpoint
app.get('/api/proxy', async (req, res) => {
  const targetUrl = req.query.url;

  // Validate the presence of the 'url' parameter
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing "url" query parameter.' });
  }

  // Validate the URL format (optional but recommended)
  try {
    new URL(targetUrl);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid URL format.' });
  }

  try {
    // Fetch the target URL
    const response = await fetch(targetUrl);

    // Forward status code and headers
    res.status(response.status);
    response.headers.forEach((value, key) => {
      // Exclude some headers if needed (like 'transfer-encoding')
      if (key.toLowerCase() !== 'transfer-encoding') {
        res.setHeader(key, value);
      }
    });

    // Stream the response body to the client
    response.body.pipe(res);
  } catch (error) {
    console.error('Error fetching target URL:', error);
    res.status(500).json({ error: 'Error fetching the target URL.' });
  }
});

// Start the server (if running locally)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
