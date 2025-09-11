// api/proxy.js
export default async function handler(req, res) {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "DozeMultiBot/1.0",
      },
    });

    const html = await response.text();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/html");
    res.status(200).send(html);

  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).json({ error: "Proxy failed", details: error.message });
  }
}
