// api/proxy.js
export default async function handler(req, res) {
  const target = req.query.url;
  if (!target) return res.status(400).send("Missing url");

  try {
    const response = await fetch(target, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; Mobile; rv:109.0) Gecko/110.0 Firefox/110.0",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Connection": "keep-alive",
      },
    });

    // Pass raw HTML but strip frame-blocking headers
    const html = await response.text();
    res.setHeader("Content-Type", "text/html");
    res.setHeader("X-Frame-Options", ""); // override
    res.setHeader("Content-Security-Policy", ""); // override
    res.status(200).send(html);
  } catch (e) {
    res.status(500).send("Proxy error: " + e.message);
  }
}
