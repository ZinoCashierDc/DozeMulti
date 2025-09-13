// pages/api/proxy.js
export default async function handler(req, res) {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    res.status(400).send("Missing url param");
    return;
  }

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        ...req.headers,
        host: new URL(targetUrl).host,
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
      body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
    });

    // copy headers
    response.headers.forEach((value, key) => {
      if (
        ["content-security-policy", "x-frame-options"].includes(key.toLowerCase())
      ) {
        return; // strip CSP + frame protections
      }
      res.setHeader(key, value);
    });

    res.removeHeader("content-security-policy");
    res.removeHeader("x-frame-options");

    // Handle HTML rewriting
    if (response.headers.get("content-type")?.includes("text/html")) {
      let text = await response.text();

      // Strip frame-blocking meta
      text = text.replace(
        /<meta[^>]+http-equiv=["']?X-Frame-Options["']?[^>]*>/gi,
        ""
      );
      text = text.replace(
        /<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi,
        ""
      );

      // Rewrite relative links to go back through proxy
      text = text.replace(
        /(href|src)=["']([^"']+)["']/gi,
        (match, attr, url) => {
          if (url.startsWith("http")) {
            return `${attr}="/api/proxy?url=${encodeURIComponent(url)}"`;
          }
          // relative URL → join with target host
          const absolute = new URL(url, targetUrl).href;
          return `${attr}="/api/proxy?url=${encodeURIComponent(absolute)}"`;
        }
      );

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(text);
    } else {
      // Non-HTML → stream directly
      res.status(response.status);
      response.body.pipe(res);
    }
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy error: " + err.message);
  }
}
