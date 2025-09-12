// api/proxy.js

const HOP_BY_HOP_HEADERS = [
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade',
  'content-security-policy', 'x-frame-options',
];

export default async function handler(req, res) {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing ?url= parameter" });
    }

    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";

    // ** NEW: Prepare headers for the fetch request **
    const fetchHeaders = { 'User-Agent': userAgent };
    
    // ** NEW: Get cookies from the client and add them to the request **
    const clientCookies = req.headers['x-proxy-cookies'];
    if (clientCookies) {
      fetchHeaders['Cookie'] = clientCookies;
    }

    const response = await fetch(targetUrl, {
      headers: fetchHeaders,
      redirect: 'follow'
    });

    const finalUrl = response.url;

    // ** NEW: Capture the 'set-cookie' headers from Facebook **
    // Vercel's Edge runtime provides this helper to get all set-cookie headers
    // Note: For standard Node.js, you might need `response.headers.raw()['set-cookie']`
    const setCookieHeaders = response.headers.get('set-cookie');

    // Copy and filter headers from Facebook to our response
    response.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // ** NEW: Send the captured cookies back to the client in a custom header **
    if (setCookieHeaders) {
      // We send them as a single string, separated by a specific delimiter
      res.setHeader('x-set-proxy-cookies', setCookieHeaders);
    }
    
    res.setHeader("Access-Control-Allow-Origin", "*");
    // We also need to expose our custom header to the client-side script
    res.setHeader("Access-Control-Expose-Headers", "x-set-proxy-cookies");


    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('text/html')) {
      let body = await response.text();
      const baseTag = `<base href="${finalUrl}">`;
      body = body.replace(/<head[^>]*>/i, `$&${baseTag}`);
      res.status(response.status).send(body);
    } else {
      const body = await response.arrayBuffer();
      res.status(response.status).send(Buffer.from(body));
    }

  } catch (error) {
    console.error("--- PROXY FAILED ---", error);
    res.status(500).json({ error: "Proxy request failed", details: error.message });
  }
}
