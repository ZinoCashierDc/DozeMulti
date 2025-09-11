// api/proxy.js
export default async function handler(req, res) {
  const target = req.query.url;

  if (!target) {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  try {
    const response = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });

    // Copy headers, but remove security ones
    const headers = {};
    response.headers.forEach((value, key) => {
      if (!["x-frame-options", "content-security-policy"].includes(key.toLowerCase())) {
        headers[key] = value;
      }
    });

    res.writeHead(response.status, headers);
    response.body.pipe(res);
  } catch (e) {
    res.status(500).json({ error: "Proxy error", details: e.message });
  }
}
