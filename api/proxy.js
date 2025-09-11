// api/proxy.js
export default async function handler(req, res) {
  try {
    const target = req.query.url;

    if (!target) {
      return res.status(400).json({ error: "Missing ?url parameter" });
    }

    // Fetch the target site
    const response = await fetch(target, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    // Pass through the content
    const data = await response.text();

    res.setHeader("Content-Type", response.headers.get("content-type") || "text/html");
    res.setHeader("Access-Control-Allow-Origin", "*"); // so your frontend can use it
    res.status(200).send(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Proxy error", details: err.message });
  }
      }
