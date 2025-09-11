import fetch from "node-fetch";

export default async function handler(req, res) {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    res.status(400).send("Missing url parameter");
    return;
  }

  try {
    // Fetch the requested page
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });

    // Copy headers
    res.setHeader("Content-Type", response.headers.get("content-type") || "text/html");
    const body = await response.text();

    res.status(200).send(body);
  } catch (err) {
    console.error(err);
    res.status(500).send("Proxy error: " + err.message);
  }
}
