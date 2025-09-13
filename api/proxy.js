// pages/api/proxy.js

// Keep per-session cookies (so Facebook1 and Facebook2 don’t share state)
const cookieJars = new Map();

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

export default async function handler(req, res) {
  try {
    const url =
      req.query.url ||
      (req.url &&
        new URL(req.url, `http://${req.headers.host}`).searchParams.get("url"));
    const session =
      req.query.session ||
      (req.url &&
        new URL(req.url, `http://${req.headers.host}`).searchParams.get("session")) ||
      "default";

    if (!url) {
      res.status(400).send("Missing url parameter");
      return;
    }

    const target = new URL(url);
    if (!["http:", "https:"].includes(target.protocol)) {
      res.status(400).send("Invalid protocol");
      return;
    }

    // ✅ Build outgoing headers
    const outHeaders = {
      "user-agent":
        req.headers["user-agent"] ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/129.0 Safari/537.36",
      "accept-language": req.headers["accept-language"] || "en-US,en;q=0.9",
    };

    for (const [k, v] of Object.entries(req.headers || {})) {
      if (HOP_BY_HOP.has(k.toLowerCase())) continue;
      if (["host", "user-agent", "accept-language"].includes(k.toLowerCase()))
        continue;
      outHeaders[k] = v;
    }

    // ✅ Attach cookies for this session
    const jar = cookieJars.get(session) || {};
    const cookieHeader = Object.values(jar).join("; ");
    if (cookieHeader) outHeaders["cookie"] = cookieHeader;

    // ✅ Body handling
    let body = null;
    if (!["GET", "HEAD"].includes(req.method)) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = Buffer.concat(chunks);
    }

    const fetchOptions = {
      method: req.method,
      headers: outHeaders,
      body,
      redirect: "manual",
    };

    const upstream = await fetch(target.toString(), fetchOptions);

    // ✅ Save cookies for this session
    const setCookieHeaders = upstream.headers.get("set-cookie");
    if (setCookieHeaders) {
      const cur = cookieJars.get(session) || {};
      setCookieHeaders.split(",").forEach((sc) => {
        const pair = sc.split(";")[0].trim();
        const i = pair.indexOf("=");
        if (i > -1) {
          const name = pair.slice(0, i);
          cur[name] = pair;
        }
      });
      cookieJars.set(session, cur);
    }

    // ✅ Forward headers (strip blocking ones)
    upstream.headers.forEach((val, key) => {
      if (HOP_BY_HOP.has(key.toLowerCase())) return;
      if (
        ["content-security-policy", "x-frame-options"].includes(
          key.toLowerCase()
        )
      )
        return;
      res.setHeader(key, val);
    });

    res.removeHeader("content-security-policy");
    res.removeHeader("x-frame-options");

    // ✅ Special case: if HTML, rewrite asset links
    if (upstream.headers.get("content-type")?.includes("text/html")) {
      let text = await upstream.text();

      // Remove meta blockers
      text = text.replace(
        /<meta[^>]+http-equiv=["']?X-Frame-Options["']?[^>]*>/gi,
        ""
      );
      text = text.replace(
        /<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi,
        ""
      );

      // Rewrite all links
      text = text.replace(
        /(href|src)=["']([^"']+)["']/gi,
        (match, attr, link) => {
          try {
            if (link.startsWith("http")) {
              return `${attr}="/api/proxy?session=${session}&url=${encodeURIComponent(
                link
              )}"`;
            }
            const absolute = new URL(link, target).href;
            return `${attr}="/api/proxy?session=${session}&url=${encodeURIComponent(
              absolute
            )}"`;
          } catch {
            return match;
          }
        }
      );

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(upstream.status).send(text);
    } else {
      // ✅ Non-HTML → forward as-is
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.status(upstream.status).send(buf);
    }
  } catch (err) {
    console.error("Proxy error", err);
    res
      .status(500)
      .send("Proxy error: " + (err && err.message ? err.message : String(err)));
  }
}
