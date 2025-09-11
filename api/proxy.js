// api/proxy.js
export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send("Missing url parameter");
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
      },
    });

    //Copy response body as buffer
    const body = await response.arrayBuffer();

    // Clone headers, but strip X-Frame-Options & CSP
    const headers = {};
    response.headers.forEach((value, key) => {
      if (
        !["x-frame-options", "content-security-policy", "content-security-policy-report-only"].includes(
          key.toLowerCase()
        )
      ) {
        headers[key] = value;
      }
    });

    // Always allow embedding
    headers["X-Frame-Options"] = "ALLOWALL";

    res.writeHead(response.status, headers);
    res.end(Buffer.from(body));
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy error");
  }
}
