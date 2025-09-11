// api/proxy.js
export default async function handler(req, res) {
  const target = req.query.url;

  if (!target) {
    return res.status(400).send("Missing url parameter");
  }

  try {
    const response = await fetch(target, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
      },
    });

    const contentType = response.headers.get("content-type");
    res.setHeader("content-type", contentType || "text/html");

    const text = await response.text();
    res.send(text);
  } catch (err) {
    res.status(500).send("Proxy error: " + err.message);
  }
}
