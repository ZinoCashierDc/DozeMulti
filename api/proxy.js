// api/proxy.js

// A list of headers that should be removed from the target's response.
// These are often security-related or connection-specific.
const HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  // Security headers that prevent embedding
  'content-security-policy',
  'x-frame-options',
];

export default async function handler(req, res) {
  try {
    const targetUrl = req.query.url;

    if (!targetUrl) {
      return res.status(400).json({ error: "Missing ?url= parameter" });
    }

    // Use a common browser User-Agent
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";

    const response = await fetch(targetUrl, {
      headers: { 'User-Agent': userAgent },
      // IMPORTANT: Redirects must be handled manually to rewrite the location header.
      redirect: 'manual'
    });
    
    // Handle redirects manually to ensure the proxied URL is in the location
    if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
      const redirectUrl = new URL(response.headers.get('location'), targetUrl).href;
      // Re-proxy the redirect URL
      const selfUrl = new URL(req.url, `http://${req.headers.host}`).searchParams.get('url');
      const proxiedRedirect = selfUrl.replace(encodeURIComponent(targetUrl), encodeURIComponent(redirectUrl));
      
      res.setHeader('Location', proxiedRedirect);
      res.status(response.status).end();
      return;
    }


    // Copy headers from the target response to our response, filtering out the bad ones.
    response.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    
    // Set our own headers.
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Send the response body from the target.
    const body = await response.arrayBuffer();
    res.status(response.status).send(Buffer.from(body));

  } catch (error) {
    console.error("Proxy Error:", error);
    res.status(500).json({ error: "Proxy request failed", details: error.message });
  }
}
