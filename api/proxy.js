// api/proxy.js
export default async function handler(req, res) {
  try {
    const targetUrl = req.query.url;

    if (!targetUrl) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    // Only allow http/https links for security
    if (!/^https?:\/\//.test(targetUrl)) {
      return res.status(400).json({ error: "Invalid URL" });
    }

    // Fetch the target website
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DozaMulti/1.0)"
      }
    });

    // Stream the response back
    const contentType = response.headers.get("content-type") || "text/html";
    res.setHeader("Content-Type", contentType);

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Proxy request failed" });
  }
}
