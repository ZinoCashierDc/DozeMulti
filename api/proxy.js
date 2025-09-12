const cookieJars = new Map();
const HOP_BY_HOP = new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailers','transfer-encoding','upgrade']);

// List of response headers to remove or modify for proxying
const RESPONSE_HEADERS_TO_STRIP = [
  'content-security-policy',
  'x-frame-options',
  'strict-transport-security',
  'content-encoding', // Let the proxy handle compression
  'transfer-encoding',
];

module.exports = async (req, res) => {
  try {
    const urlParam = req.query.url || (req.url && new URL(req.url, `http://${req.headers.host}`).searchParams.get('url'));
    const session = req.query.session || (req.url && new URL(req.url, `http://${req.headers.host}`).searchParams.get('session')) || 'default';
    if (!urlParam) {
      res.status(400).send('Missing url parameter');
      return;
    }

    // Prepend a protocol if missing for convenience
    const url = urlParam.startsWith('http') ? urlParam : `http://${urlParam}`;

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
      // Overwrite the host header to match the target
      if (k.toLowerCase() === 'host') continue;
      outHeaders[k] = v;
    }
    outHeaders['host'] = target.hostname;
    // Some sites might check the origin or referer
    outHeaders['origin'] = target.origin;
    outHeaders['referer'] = target.href;


    // attach cookies stored for this session
    const jar = cookieJars.get(session) || {};
    const cookieHeader = Object.values(jar).join('; ');
    if (cookieHeader) outHeaders['cookie'] = cookieHeader;

    // body for POST/PUT/PATCH
    let body = null;
    if (['POST','PUT','PATCH'].includes(req.method)) {
      body = req.rawBody || req.body;
    }

    const fetchOptions = {
      method: req.method,
      headers: outHeaders,
      body: body,
      redirect: 'manual' // We will handle redirects manually
    };

    // use global fetch (Node 18+ on Vercel)
    const upstream = await fetch(target.toString(), fetchOptions);

    // Manual redirect handling
    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
        const location = upstream.headers.get('location');
        if (location) {
            // Reconstruct the proxy URL for the redirect
            const newProxyUrl = new URL(req.url, `http://${req.headers.host}`);
            newProxyUrl.searchParams.set('url', new URL(location, target.href).href);
            res.setHeader('location', newProxyUrl.href);
            res.status(upstream.status).send(`Redirecting to ${location}`);
            return;
        }
    }


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

    // copy response headers, excluding hop-by-hop and security headers
    upstream.headers.forEach((val, key) => {
      const lowerKey = key.toLowerCase();
      if (HOP_BY_HOP.has(lowerKey)) return;
      if (RESPONSE_HEADERS_TO_STRIP.includes(lowerKey)) return;
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
