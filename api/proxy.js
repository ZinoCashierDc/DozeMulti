// /api/proxy.js
const cookieJars = new Map();
const HOP_BY_HOP = new Set([
  'connection','keep-alive','proxy-authenticate','proxy-authorization',
  'te','trailers','transfer-encoding','upgrade'
]);

// small helper to safely split set-cookie headers (some servers return multiple)
function parseSetCookieHeader(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  // sometimes fetch returns single string with commas — naive split
  return raw.toString().split(/,(?=[^;]*=)/g).map(s => s.trim()).filter(Boolean);
}

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

    // Build browser-like headers (pretend to be Chrome mobile/desktop as needed)
    const outHeaders = {
      'user-agent':
        req.headers['user-agent'] ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
      'accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'accept-language': req.headers['accept-language'] || 'en-US,en;q=0.9',
      'upgrade-insecure-requests': '1',
      // include common sec-ch headers so server thinks it's real Chrome
      'sec-ch-ua': req.headers['sec-ch-ua'] || '"Not/A)Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
      'sec-ch-ua-mobile': req.headers['sec-ch-ua-mobile'] || '?0',
      'sec-ch-ua-platform': req.headers['sec-ch-ua-platform'] || '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'referer': req.headers.referer || undefined
    };

    // forward other headers except hop-by-hop and those we explicitly set
    for (const [k, v] of Object.entries(req.headers || {})) {
      const lk = k.toLowerCase();
      if (HOP_BY_HOP.has(lk)) continue;
      if (['host','user-agent','accept-language','referer','sec-ch-ua','sec-ch-ua-mobile','sec-ch-ua-platform'].includes(lk)) continue;
      outHeaders[k] = v;
    }

    // Attach cookies for session
    const jar = cookieJars.get(session) || {};
    const cookieHeader = Object.values(jar).join('; ');
    if (cookieHeader) outHeaders['cookie'] = cookieHeader;

    // Handle body for POST/PUT/PATCH
    let body = null;
    if (['POST','PUT','PATCH'].includes(req.method)) {
      body = req.rawBody || req.body || null;
    }

    // Follow redirects so login flows can complete
    const fetchOptions = {
      method: req.method,
      headers: outHeaders,
      body: body,
      redirect: 'follow'
    };

    const upstream = await fetch(target.toString(), fetchOptions);

    // Save cookies into per-session jar
    // fetch Headers.get('set-cookie') may be null or a single string; try both raw and get
    let setCookies = null;
    try {
      // Node fetch might expose .headers.raw() in some envs
      if (upstream.headers.raw) {
        setCookies = upstream.headers.raw()['set-cookie'];
      } else {
        const s = upstream.headers.get('set-cookie');
        setCookies = s ? parseSetCookieHeader(s) : null;
      }
    } catch (e) {
      // ignore
    }
    if (setCookies && Array.isArray(setCookies)) {
      const cur = cookieJars.get(session) || {};
      setCookies.forEach(sc => {
        const pair = sc.split(';')[0].trim();
        const i = pair.indexOf('=');
        if (i > -1) {
          const name = pair.slice(0,i);
          cur[name] = pair; // store "name=value"
        }
      });
      cookieJars.set(session, cur);
    }

    // copy response headers, but strip frame-blocking/security headers
    // We'll build a headers object to set after we maybe rewrite HTML
    const responseHeaders = {};
    upstream.headers.forEach((val, key) => {
      const lk = key.toLowerCase();
      if (HOP_BY_HOP.has(lk)) return;
      // strip frame-blocking headers
      if (lk === 'x-frame-options') return;
      if (lk === 'content-security-policy') {
        // remove frame-ancestors directive if present
        // naive removal: drop the header if it contains frame-ancestors, otherwise keep cleaned
        if (val && /frame-ancestors/i.test(val)) {
          // remove the frame-ancestors directive from CSP value
          const cleaned = val.split(';').map(s => s.trim()).filter(s => !/^frame-ancestors/i.test(s)).join('; ');
          if (cleaned) responseHeaders[key] = cleaned;
          return;
        }
      }
      // forward others
      responseHeaders[key] = val;
    });

    // default CORS so front-end can load the iframe/src and make requests
    responseHeaders['Access-Control-Allow-Origin'] = '*';
    responseHeaders['Access-Control-Allow-Headers'] = '*';

    // read body as buffer and decide whether to inject
    const contentType = upstream.headers.get('content-type') || '';
    const buffer = Buffer.from(await upstream.arrayBuffer());

    // If HTML, rewrite: remove <meta http-equiv="Content-Security-Policy"> and inject anti-frame-bust script
    if (contentType.includes('text/html')) {
      let html = buffer.toString('utf8');

      // remove meta CSP tags (very naive but effective for many pages)
      html = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '');

      // Inject a small script *near the top of <head>* to neutralize common frame-busters.
      // Note: this is best effort and may not work for every site. It runs BEFORE most site JS.
      const antiFrameScript = `
<script>
(function(){
  try {
    // prevent top-level redirects from inside the frame by making top === self in checks
    Object.defineProperty(window, 'top', { get: function(){ return window; }, configurable: true });
  } catch(e) {
    // some browsers disallow; ignore
  }
  // override location assignment on top / parent
  try {
    window.__do_not_bust__ = true;
    var originalAssign = window.top && window.top.location && window.top.location.assign;
    if (originalAssign) {
      window.top.location.assign = function(){ /* blocked by proxy */ };
    }
  } catch(e){}
  // prevent common quick scripts that check top !== self
  window.addEventListener('beforeunload', function(){});
  // override window.open to avoid escaping the frame
  window.open = function(){ return null; };
})();
</script>
`;

      // try to inject after <head> open tag, otherwise at top of document
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/<head[^>]*>/i, match => match + antiFrameScript);
      } else {
        html = antiFrameScript + html;
      }

      // set headers and send HTML
      Object.entries(responseHeaders).forEach(([k,v]) => res.setHeader(k, v));
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(upstream.status).send(html);
      return;
    }

    // Non-HTML (images, CSS, JS, etc.) — just forward with cleaned headers
    Object.entries(responseHeaders).forEach(([k,v]) => res.setHeader(k, v));
    if (contentType) res.setHeader('Content-Type', contentType);
    res.status(upstream.status).send(buffer);

  } catch (err) {
    console.error('Proxy error', err);
    res.status(500).send('Proxy error: ' + (err && err.message ? err.message : String(err)));
  }
};
