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

    // Build outgoing headers
    const outHeaders = {
      'user-agent':
        req.headers['user-agent'] ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/129.0 Safari/537.36',
      'accept-language': req.headers['accept-language'] || 'en-US,en;q=0.9',
    };

    for (const [k, v] of Object.entries(req.headers || {})) {
      if (HOP_BY_HOP.has(k.toLowerCase())) continue;
      if (['host','user-agent','accept-language'].includes(k.toLowerCase())) continue;
      outHeaders[k] = v;
    }

    // Attach cookies for this session
    const jar = cookieJars.get(session) || {};
    const cookieHeader = Object.values(jar).join('; ');
    if (cookieHeader) outHeaders['cookie'] = cookieHeader;

    // Request body
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

    // Forward headers, but REMOVE frame-blocking headers
    let contentType = upstream.headers.get('content-type') || '';
    upstream.headers.forEach((val, key) => {
      const lowerKey = key.toLowerCase();
      if (HOP_BY_HOP.has(lowerKey)) return;
      if (['x-frame-options', 'content-security-policy', 'frame-options'].includes(lowerKey)) return;
      res.setHeader(key, val);
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;");

    // If HTML, inject anti-framebust script
    if (contentType.includes('text/html')) {
      let html = await upstream.text();
      html = html.replace(
        /<head[^>]*>/i,
        match =>
          match +
          `<script>
            try {
              Object.defineProperty(window, 'top', {get: () => window});
              Object.defineProperty(window, 'parent', {get: () => window});
              window.frameElement = true;
              window.self = window;
              window.top = window;
              window.parent = window;
            } catch(e){}
            window.addEventListener('DOMContentLoaded', function() {
              // Remove framebusting scripts
              document.querySelectorAll('script').forEach(s => {
                if (s.textContent.match(/top\\.location|window\\.top|parent\\.location|window\\.parent/)) {
                  s.remove();
                }
              });
            });
          </script>`
      );
      res.status(upstream.status);
      res.send(html);
      return;
    }

    // Otherwise, just proxy as buffer
    res.status(upstream.status);
    const arrayBuffer = await upstream.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));

  } catch (err) {
    console.error('Proxy error', err);
    res.status(500).send('Proxy error: ' + (err && err.message ? err.message : String(err)));
  }
};
