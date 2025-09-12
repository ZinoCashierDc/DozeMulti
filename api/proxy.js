// api/proxy.js
export default async function handler(req, res) {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).send("Missing url");

    const target = decodeURIComponent(url);

    const r = await fetch(target, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) " +
          "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15A372 Safari/604.1",
      },
    });

    const body = await r.text();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(body);
  } catch (err) {
    res.status(500).send("Proxy error: " + err.message);
  }
}
