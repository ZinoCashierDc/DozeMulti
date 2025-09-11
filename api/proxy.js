// api/proxy.js
export default async function handler(req, res) {
  try {
    const targetUrl = req.query.url;

    if (!targetUrl) {
      return res.status(400).json({ error: "Missing ?url= parameter" });
    }

    // fetch the target URL
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      },
    });

    const contentType = response.headers.get("content-type") || "text/html";

    // pipe response
    const body = await response.text();
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).send(body);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Proxy request failed", details: error.message });
  }
}
