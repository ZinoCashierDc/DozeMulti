// api/proxy.js

export default async function handler(req, res) {
  try {
    const targetUrl = req.query.url;

    if (!targetUrl) {
      return res.status(400).send("Missing ?url=");
    }

    // Block unsafe URLs
    if (targetUrl.startsWith("file:") || targetUrl.includes("localhost")) {
      return res.status(400).send("Invalid URL");
    }

    // Use built-in fetch (Node 18 on Vercel has it)
    const response = await fetch(targetUrl, {
      headers: {
        "user-agent": req.headers["user-agent"] || "Mozilla/5.0",
        "accept": req.headers["accept"] || "*/*"
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
