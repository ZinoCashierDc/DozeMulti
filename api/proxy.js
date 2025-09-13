// /api/proxy.js
import fetch from 'node-fetch';

const cookieJars = new Map();
const HOP_BY_HOP = new Set([
  'connection','keep-alive','proxy-authenticate','proxy-authorization',
  'te','trailers','transfer-encoding','upgrade'
]);

export default async (req, res) => {
  try {
    const urlParam =
      req.query.url ||
      (req.url && new URL(req.url, `http://${req.headers.host}`).searchParams.get('url'));
    const session =
      req.query.session ||
      (req.url && new URL(req.url, `http://${req.headers.host}`).searchParams.get('session')) ||
      'default';

    if (!urlParam) {
      res.status(400).send('Missing url parameter');
      return;
    }

    const target = new URL(urlParam);
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

    // Request body handling
    let body = null;
    if (['POST','PUT','PATCH'].includes(req.method)) {
      // Use req.read() or req.body depending on environment
      if (req.body) {
        body = req.body;
      } else {
        // fallback: read raw body (Vercel streams request body)
        body = await new Promise((resolve, reject) => {
          const chunks = [];
          req.on('data', chunk => chunks.push(chunk));
          req.on('end', () => resolve(Buffer.concat(chunks)));
          req.on('error', reject);
        });
      }
    }

    const fetchOptions = {
      method: req.method,
      headers: outHeaders,
      body: body,
      redirect: 'manual'
    };

    const upstream = await fetch(target.toString(), fetchOptions);

    // Save cookies
    const setCookieHeaders = upstream.headers.raw()['set-cookie'];
    if (setCookieHeaders) {
      // set-cookie headers are an array of strings
      const cur = cookieJars.get(session) || {};
      setCookieHeaders.forEach(sc => {
        const parts = sc.split(';');
        const [name, value] = parts[0].split('=');
        if (name && value) {
          cur[name.trim()] = `${name}=${value}`;
        }
      });
      cookieJars.set(session, cur);
    }

    // Forward headers
    upstream.headers.forEach((val, key) => {
      if (HOP_BY_HOP.has(key.toLowerCase())) return;
      res.setHeader(key, val);
    });

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // Send response
    res.status(upstream.status);
    const buffer = await upstream.buffer();
    res.send(buffer);

  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).send('Proxy error: ' + (err && err.message ? err.message : String(err)));
  }
};
