// /api/proxy.js
const cookieJars = new Map();
const HOP_BY_HOP = new Set([
  'connection','keep-alive','proxy-authenticate','proxy-authorization',
  'te','trailers','transfer-encoding','upgrade'
]);

function parseSetCookieHeader(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return raw.toString().split(/,(?=[^;]*=)/g).map(s => s.trim()).filter(Boolean);
}

function randomUAVariant(baseVersion = 127) {
  // slight randomization to reduce correlation between sessions
  const minor = Math.floor(Math.random()*5); // 0-4
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${baseVersion}.0.${minor}.0 Safari/537.36`;
}

module.exports = async (req, res) => {
  try {
    const rawUrl = req.query.url || (req.url && new URL(req.url, `http://${req.headers.host}`).searchParams.get('url'));
    const session = req.query.session || (req.url && new URL(req.url, `http://${req.headers.host}`).searchParams.get('session')) || `s_${Date.now()}`;

    if (!rawUrl) {
      res.status(400).send('Missing url parameter');
      return;
    }
    const target = new URL(rawUrl);
    if (!['http:', 'https:'].includes(target.protocol)) {
      res.status(400).send('Invalid protocol');
      return;
    }

    // per-session UA (stable per session)
    let jar = cookieJars.get(session);
    if (!jar) {
      jar = { ua: randomUAVariant(), cookies: {} };
      cookieJars.set(session, jar);
    }

    // Build realistic headers
    const outHeaders = {
      'user-agent': jar.ua,
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'accept-language': req.headers['accept-language'] || 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
      'upgrade-insecure-requests': '1',
      'sec-ch-ua': req.headers['sec-ch-ua'] || '"Not/A)Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
      'sec-ch-ua-mobile': req.headers['sec-ch-ua-mobile'] || '?0',
      'sec-ch-ua-platform': req.headers['sec-ch-ua-platform'] || '"Windows"',
      'sec-fetch-site': 'none',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-dest': 'document',
      'sec-fetch-user': '?1',
      'referer': req.headers.referer || undefined
    };

    // forward other non hop-by-hop headers without overwriting the important ones
    for (const [k, v] of Object.entries(req.headers || {})) {
      const lk = k.toLowerCase();
      if (HOP_BY_HOP.has(lk)) continue;
      if (['host','user-agent','accept','accept-language','accept-encoding','referer'].includes(lk)) continue;
      outHeaders[k] = v;
    }

    // attach cookies for session
    const cookieHeader = Object.values(jar.cookies || {}).join('; ');
    if (cookieHeader) outHeaders['cookie'] = cookieHeader;

    // body if any
    let body = null;
    if (['POST','PUT','PATCH'].includes(req.method)) {
      body = req.rawBody || req.body || null;
    }

    const fetchOptions = {
      method: req.method,
      headers: outHeaders,
      body,
      redirect: 'follow' // follow redirects
    };

    const upstream = await fetch(target.toString(), fetchOptions);

    // capture set-cookie headers robustly
    let setCookies = null;
    try {
      if (upstream.headers.raw) {
        setCookies = upstream.headers.raw()['set-cookie'];
      } else {
        const s = upstream.headers.get('set-cookie');
        setCookies = s ? parseSetCookieHeader(s) : null;
      }
    } catch (e) { /* ignore */ }

    if (setCookies && Array.isArray(setCookies)) {
      const cur = jar.cookies || {};
      setCookies.forEach(sc => {
        const pair = sc.split(';')[0].trim();
        const i = pair.indexOf('=');
        if (i > -1) {
          const name = pair.slice(0,i);
          cur[name] = pair;
        }
      });
      jar.cookies = cur;
      cookieJars.set(session, jar);
    }

    // copy headers except hop-by-hop and strip frame-blocking
    const responseHeaders = {};
    upstream.headers.forEach((val, key) => {
      const lk = key.toLowerCase();
      if (HOP_BY_HOP.has(lk)) return;
      if (lk === 'x-frame-options') return;
      if (lk === 'content-security-policy') {
        // if it contains frame-ancestors remove that directive, keep the rest
        if (/frame-ancestors/i.test(val)) {
          const cleaned = val.split(';').map(s => s.trim()).filter(s => !/^frame-ancestors/i.test(s)).join('; ');
          if (cleaned) responseHeaders[key] = cleaned;
          return;
        }
      }
      responseHeaders[key] = val;
    });

    // CORS so your front-end can load iframe src from same origin
    responseHeaders['Access-Control-Allow-Origin'] = '*';
    responseHeaders['Access-Control-Allow-Headers'] = '*';

    // read body buffer
    const buffer = Buffer.from(await upstream.arrayBuffer());
    const contentType = (upstream.headers.get('content-type') || '').toLowerCase();

    // If HTML, inject a tiny, non-invasive script to reduce client-side detection
    if (contentType.includes('text/html')) {
      let html = buffer.toString('utf8');

      // remove meta CSP tags to avoid frame-ancestors meta
      html = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '');

      // minimal script: override navigator.webdriver and set platform/languages (non-destructive)
      const inject = `<script>
try{
  Object.defineProperty(navigator, 'webdriver', {get: () => false, configurable: true});
  if (!navigator.languages) { Object.defineProperty(navigator, 'languages',{get:()=>['en-US','en']}); }
  if (!navigator.platform) { Object.defineProperty(navigator, 'platform',{get:()=> 'Win32'}); }
  window.__proxy_session_id = ${JSON.stringify(session)};
  // prevent simple top-level frame busters
  try { Object.defineProperty(window, 'top', { get: function(){ return window; }, configurable: true }); } catch(e){}
} catch(e){}
</script>`;

      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/<head[^>]*>/i, match => match + inject);
      } else {
        html = inject + html;
      }

      // set headers and send
      Object.entries(responseHeaders).forEach(([k,v]) => res.setHeader(k, v));
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(upstream.status).send(html);
      return;
    }

    // Non-HTML: forward normally
    Object.entries(responseHeaders).forEach(([k,v]) => res.setHeader(k, v));
    if (contentType) res.setHeader('Content-Type', contentType);
    res.status(upstream.status).send(buffer);

  } catch (err) {
    console.error('Proxy error', err);
    res.status(500).send('Proxy error: ' + (err && err.message ? err.message : String(err)));
  }
};
