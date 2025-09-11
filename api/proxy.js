export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    res.status(400).json({ error: "Missing URL" });
    return;
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });

    const data = await response.text();

    res.setHeader("Content-Type", response.headers.get("content-type") || "text/html");
    res.status(200).send(data);
  } catch (err) {
    res.status(500).json({ error: "Proxy error", details: err.message });
  }
}
