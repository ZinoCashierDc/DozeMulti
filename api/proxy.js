export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send("Missing url parameter");
  }

  try {
    const targetUrl = decodeURIComponent(url);

    if (!/^https?:\/\//.test(targetUrl)) {
      return res.status(400).send("Invalid URL");
    }

    // Force Facebook to always use mobile/lite
    let finalUrl = targetUrl
      .replace("www.facebook.com", "m.facebook.com")
      .replace("facebook.com", "m.facebook.com")
      .replace("mbasic.m.facebook.com", "mbasic.facebook.com");

    const response = await fetch(finalUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    });

    const text = await response.text();

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.status(response.status).send(text);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy request failed: " + err.message);
  }
}
