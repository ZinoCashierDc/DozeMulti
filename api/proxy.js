// api/proxy.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    const targetUrl = req.query.url;

    if (!targetUrl) {
      return res.status(400).send("Missing ?url=");
    }

    // Block localhost / file:// for safety
    if (targetUrl.startsWith("file:") || targetUrl.includes("localhost")) {
      return res.status(400).send("Invalid URL");
    }

    const response = await fetch(targetUrl, {
      headers: {
        "user-agent": req.headers["user-agent"] || "Mozilla/5.0",
        "accept": req.headers["accept"] || "*/*"
      }
    });

    const contentType = response.headers.get("content-type");
    res.setHeader("Content-Type", contentType || "text/html");

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy failed: " + err.message);
  }
}
