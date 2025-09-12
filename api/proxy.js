// api/proxy.js (Node serverless for Vercel)
const { Readable } = require('stream');

const cookieJars = new Map();
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade']);

// Headers to remove from the upstream response before sending to the client
const RESPONSE_HEADERS_TO_STRIP = [
    'content-security-policy',
    'x-frame-options',
    'strict-transport-security',
    'content-encoding', // We let fetch decompress and we send uncompressed
    'transfer-encoding',
];

module.exports = async (req, res) => {
    try {
        const urlParam = req.query.url || (req.url && new URL(req.url, `http://${req.headers.host}`).searchParams.get('url'));
        const session = req.query.session || (req.url && new URL(req.url, `http://${req.headers.host}`).searchParams.get('session')) || 'default';

        if (!urlParam) {
            return res.status(400).send('Missing url parameter');
        }

        // Prepend a protocol if one is not present
        const url = urlParam.includes('://') ? urlParam : `https://` + urlParam;

        const target = new URL(url);
        if (!['http:', 'https:'].includes(target.protocol)) {
            return res.status(400).send('Invalid protocol');
        }

        // Build outgoing request headers
        const outHeaders = {};
        for (const [k, v] of Object.entries(req.headers)) {
            if (!HOP_BY_HOP.has(k.toLowerCase()) && k.toLowerCase() !== 'host') {
                outHeaders[k] = v;
            }
        }
        // Set essential headers to mimic a real browser request
        outHeaders['host'] = target.hostname;
        outHeaders['origin'] = target.origin;
        outHeaders['referer'] = target.href;
        outHeaders['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';

        // Attach cookies for the session
        const jar = cookieJars.get(session) || {};
        const cookieHeader = Object.values(jar).join('; ');
        if (cookieHeader) {
            outHeaders['cookie'] = cookieHeader;
        }

        const fetchOptions = {
            method: req.method,
            headers: outHeaders,
            body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : null,
            redirect: 'manual', // We handle redirects to rewrite the proxy URL
        };

        const upstream = await fetch(target.toString(), fetchOptions);

        // Handle redirects manually
        if ([301, 302, 303, 307, 308].includes(upstream.status)) {
            const location = upstream.headers.get('location');
            if (location) {
                const newProxyUrl = new URL(req.url, `http://${req.headers.host}`);
                newProxyUrl.searchParams.set('url', new URL(location, target.href).href);
                res.setHeader('location', newProxyUrl.href);
                return res.status(upstream.status).send(`Redirecting to ${location}`);
            }
        }

        // Capture and store cookies from the response
        const rawCookies = upstream.headers.raw ? upstream.headers.raw()['set-cookie'] : [];
        if (rawCookies.length > 0) {
            const cur = cookieJars.get(session) || {};
            rawCookies.forEach(sc => {
                const pair = sc.split(';')[0].trim();
                const i = pair.indexOf('=');
                if (i > -1) cur[pair.slice(0, i)] = pair;
            });
            cookieJars.set(session, cur);
            // Forward the Set-Cookie headers to the client
            res.setHeader('set-cookie', rawCookies);
        }

        // Copy response headers, filtering out problematic ones
        upstream.headers.forEach((val, key) => {
            const lowerKey = key.toLowerCase();
            if (!HOP_BY_HOP.has(lowerKey) && !RESPONSE_HEADERS_TO_STRIP.includes(lowerKey)) {
                res.setHeader(key, val);
            }
        });
        
        res.status(upstream.status);

        // Stream the response body directly to the client
        if (upstream.body) {
            const bodyStream = Readable.fromWeb(upstream.body);
            bodyStream.pipe(res);
        } else {
            res.end();
        }

    } catch (err) {
        console.error('Proxy error', err);
        res.status(500).send('Proxy error: ' + (err.message || String(err)));
    }
};
