// api/proxy.js

const HOP_BY_HOP_HEADERS = [
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade',
  'content-security-policy', 'x-frame-options',
];

export default async function handler(req, res) {
  try {
    let targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing ?url= parameter" });
    }

    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";

    const response = await fetch(targetUrl, {
      headers: { 'User-Agent': userAgent },
      redirect: 'follow' // Allow fetch to handle redirects automatically
    });

    // After fetch handles redirects, response.url will be the final destination URL
    const finalUrl = response.url;

    // Copy and filter headers
    response.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    res.setHeader("Access-Control-Allow-Origin", "*");

    const contentType = response.headers.get('content-type') || '';
    
    // IMPORTANT: Only modify HTML responses
    if (contentType.includes('text/html')) {
      let body = await response.text();

      // Inject the <base> tag to fix relative URLs
      const baseTag = `<base href="${finalUrl}">`;
      
      // Add the base tag right after the <head> tag
      body = body.replace(/<head[^>]*>/i, `$&${baseTag}`);
      
      res.status(response.status).send(body);
    } else {
      // For non-HTML content (CSS, JS, images), stream it directly
      const body = await response.arrayBuffer();
      res.status(response.status).send(Buffer.from(body));
    }

  } catch (error) {
    console.error("Proxy Error:", error);
    res.status(500).json({ error: "Proxy request failed", details: error.message });
  }
}
