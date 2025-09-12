/ api/proxy.js  (Node serverless for Vercel)
const cookieJars = new Map();
const HOP_BY_HOP = new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailers','transfer-encoding','upgrade']);

module.exports = async (req, res) => {
  try {
    const url = req.query.url || (req.url && new URL(req.url, `http://${req.headers.host}`).searchParams.get('url'));
    const session = req.query.session || (req.url && new URL(req.url, `http://${req.headers.host}`).searchParams.get('session')) || 'default';
    if (!url) {
      res.status(400).send('Missing url parameter');
      return;
    }

    // parse and allow only http/https
    const target = new URL(url);
    if (!['http:', 'https:'].includes(target.protocol)) {
      res.status(400).send('Invalid protocol');
      return;
    }

    // build outgoing headers
    const outHeaders = {};
    for (const [k, v] of Object.entries(req.headers || {})) {
      if (HOP_BY_HOP.has(k.toLowerCase())) continue;
      if (k.toLowerCase() === 'host') continue;
      outHeaders[k] = v;
    }

    // attach cookies stored for this session
    const jar = cookieJars.get(session) || {};
    const cookieHeader = Object.values(jar).join('; ');
    if (cookieHeader) outHeaders['cookie'] = cookieHeader;

    // body for POST/PUT/PATCH
    let body = null;
    if (['POST','PUT','PATCH'].includes(req.method)) {
      body = req.rawBody || req.body;
      // express sometimes parse body; ensure Buffer if available
      if (!body && req.pipe) {
        // rarely happens in serverless; ignore
      }
    }

    const fetchOptions = {
      method: req.method,
      headers: outHeaders,
      body: body,
      redirect: 'manual'
    };

    // use global fetch (Node 18+ on Vercel)
    const upstream = await fetch(target.toString(), fetchOptions);

    // capture set-cookie headers and store in jar
    const setCookies = upstream.headers.raw ? upstream.headers.raw()['set-cookie'] : null;
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

    // copy response headers, excluding hop-by-hop
    upstream.headers.forEach((val, key) => {
      if (HOP_BY_HOP.has(key.toLowerCase())) return;
      // Do not strip security headers here — forward them (some sites need them).
      res.setHeader(key, val);
    });

    // pipe status and body
    res.status(upstream.status);
    const arrayBuffer = await upstream.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('Proxy error', err);
    res.status(500).send('Proxy error: ' + (err && err.message ? err.message : String(err)));
  }
};
