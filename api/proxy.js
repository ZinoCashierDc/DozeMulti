// api/proxy.js

export default async function handler(req, res) {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).send("Missing ?url=");
    }

    if (targetUrl.startsWith("file:") || targetUrl.includes("localhost")) {
      return res.status(400).send("Invalid URL");
    }

    const response = await fetch(targetUrl, {
      headers: {
        "user-agent":
          req.headers["user-agent"] ||
          "Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "upgrade-insecure-requests": "1",
        "sec-fetch-mode": "navigate",
        "sec-fetch-user": "?1",
        "sec-fetch-dest": "document"
      }
    });

    const contentType = response.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);

    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy failed: " + err.message);
  }
}
