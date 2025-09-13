// pages/api/proxy.js
export default async function handler(req, res) {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    res.status(400).send("Missing url param");
    return;
  }

  try {
    // Build fetch options
    const options = {
      method: req.method,
      headers: {
        ...req.headers,
        host: new URL(targetUrl).host,
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
    };

    // Add body if not GET/HEAD
    if (!["GET", "HEAD"].includes(req.method)) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      options.body = Buffer.concat(chunks);
    }

    // Fetch target
    const response = await fetch(targetUrl, options);

    // Copy headers, strip blocking
    response.headers.forEach((value, key) => {
      if (
        ["content-security-policy", "x-frame-options"].includes(key.toLowerCase())
      )
        return;
      res.setHeader(key, value);
    });
    res.removeHeader("content-security-policy");
    res.removeHeader("x-frame-options");

    // Handle HTML rewriting
    if (response.headers.get("content-type")?.includes("text/html")) {
      let text = await response.text();

      // Strip meta tags
      text = text.replace(
        /<meta[^>]+http-equiv=["']?X-Frame-Options["']?[^>]*>/gi,
        ""
      );
      text = text.replace(
        /<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi,
        ""
      );

      // Rewrite links (important for Facebook assets)
      text = text.replace(
        /(href|src)=["']([^"']+)["']/gi,
        (match, attr, url) => {
          if (url.startsWith("http")) {
            return `${attr}="/api/proxy?url=${encodeURIComponent(url)}"`;
          }
          const absolute = new URL(url, targetUrl).href;
          return `${attr}="/api/proxy?url=${encodeURIComponent(absolute)}"`;
        }
      );

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(text);
    } else {
      // Non-HTML: just forward as buffer
      const buf = Buffer.from(await response.arrayBuffer());
      res.status(response.status).send(buf);
    }
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy error: " + err.message);
  }
}
