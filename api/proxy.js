// api/proxy.js

const HOP_BY_HOP_HEADERS = [
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade',
  'content-security-policy', 'x-frame-options',
];

export default async function handler(req, res) {
  console.log("Proxy function started.");

  try {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      console.error("Error: Missing ?url= parameter");
      return res.status(400).json({ error: "Missing ?url= parameter" });
    }
    
    console.log(`Target URL: ${targetUrl}`);

    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";

    const response = await fetch(targetUrl, {
      headers: { 'User-Agent': userAgent },
      redirect: 'follow'
    });

    const finalUrl = response.url;
    console.log(`Fetched from final URL: ${finalUrl}`);

    // Copy and filter headers
    response.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    res.setHeader("Access-Control-Allow-Origin", "*");

    const contentType = response.headers.get('content-type') || '';
    console.log(`Content-Type: ${contentType}`);
    
    if (contentType.includes('text/html')) {
      let body = await response.text();
      const baseTag = `<base href="${finalUrl}">`;
      body = body.replace(/<head[^>]*>/i, `$&${baseTag}`);
      
      console.log("Processed HTML and sending response.");
      res.status(response.status).send(body);
    } else {
      const body = await response.arrayBuffer();
      console.log("Streaming non-HTML content and sending response.");
      res.status(response.status).send(Buffer.from(body));
    }

  } catch (error) {
    // Log the detailed error on the server
    console.error("--- PROXY FAILED ---");
    console.error("Error Message:", error.message);
    console.error("Error Stack:", error.stack);
    console.error("--- END OF ERROR ---");

    // Send a generic error response to the client
    res.status(500).json({ 
      error: "Proxy request failed", 
      details: error.message 
    });
  }
}
