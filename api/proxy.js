// /api/proxy.js
const cookieJars = new Map();
const HOP_BY_HOP = new Set([
  'connection','keep-alive','proxy-authenticate','proxy-authorization',
  'te','trailers','transfer-encoding','upgrade'
]);

module.exports = async (req, res) => {
  try {
    const url =
      req.query.url ||
      (req.url && new URL(req.url, `http://${req.headers.host}`).searchParams.get('url'));
    const session =
      req.query.session ||
      (req.url && new URL(req.url, `http://${req.headers.host}`).searchParams.get('session')) ||
      'default';

    if (!url) {
      res.status(400).send('Missing url parameter');
      return;
    }

    const target = new URL(url);
    if (!['http:', 'https:'].includes(target.protocol)) {
      res.status(400).send('Invalid protocol');
      return;
    }

    // Browser-like headers
    const outHeaders = {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
      'accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'upgrade-insecure-requests': '1',
      'sec-ch-ua':
        '"Not/A)Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
    };

    // Forward other headers except hop-by-hop
    for (const [k, v] of Object.entries(req.headers || {})) {
      if (HOP_BY_HOP.has(k.toLowerCase())) continue;
      if (outHeaders[k.toLowerCase()]) continue; // don’t overwrite
      outHeaders[k] = v;
    }

    // Attach cookies
    const jar = cookieJars.get(session) || {};
    const cookieHeader = Object.values(jar).join('; ');
    if (cookieHeader) outHeaders['cookie'] = cookieHeader;

    // Handle body
    let body = null;
    if (['POST','PUT','PATCH'].includes(req.method)) {
      body = req.rawBody || req.body;
    }

    const fetchOptions = {
      method: req.method,
      headers: outHeaders,
      body: body,
      redirect: 'manual'
    };

    const upstream = await fetch(target.toString(), fetchOptions);

    // Save cookies
    const setCookieHeaders = upstream.headers.get('set-cookie');
    if (setCookieHeaders) {
      const cur = cookieJars.get(session) || {};
      setCookieHeaders.split(',').forEach(sc => {
        const pair = sc.split(';')[0].trim();
        const i = pair.indexOf('=');
        if (i > -1) {
          const name = pair.slice(0,i);
          cur[name] = pair;
        }
      });
      cookieJars.set(session, cur);
    }

    // Forward headers
    upstream.headers.forEach((val, key) => {
      if (HOP_BY_HOP.has(key.toLowerCase())) return;
      res.setHeader(key, val);
    });

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // Send status + body
    res.status(upstream.status);
    const arrayBuffer = await upstream.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));

  } catch (err) {
    console.error('Proxy error', err);
    res.status(500).send('Proxy error: ' + (err && err.message ? err.message : String(err)));
  }
};
