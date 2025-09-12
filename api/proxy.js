// api/proxy.js (Node serverless for Vercel)
// This is the final, single-file solution that manually handles decompression.
// It is designed specifically to fix the garbled text problem.
const { Readable } = require('stream');
const zlib = require('zlib'); // Node.js's built-in decompression library.

// Headers that should NOT be forwarded from the target server back to the client.
const RESPONSE_HEADERS_TO_STRIP = new Set([
    'content-encoding',       // CRITICAL: We are decompressing, so this is no longer valid.
    'content-length',         // The length will change after decompression.
    'content-security-policy',
    'x-frame-options',
    'strict-transport-security',
    'connection',
    'keep-alive',
    'transfer-encoding',
    'upgrade'
]);

// In-memory storage for cookies.
const cookieJars = new Map();

module.exports = async (req, res) => {
    try {
        const urlParam = req.query.url;
        if (!urlParam) {
            return res.status(400).send('Error: The "url" query parameter is missing.');
        }

        const targetUrl = urlParam.includes('://') ? urlParam : `https://` + urlParam;
        const target = new URL(targetUrl);

        // --- Step 1: Prepare the request to the target server ---
        const outHeaders = {
            'host': target.hostname,
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            // IMPORTANT: Tell the server what compressions we can handle.
            'accept-encoding': 'gzip, deflate, br'
        };

        for (const [key, value] of Object.entries(req.headers)) {
            if (key.toLowerCase() !== 'host') {
                outHeaders[key] = value;
            }
        }
        
        const session = req.query.session || 'default';
        const cookieJar = cookieJars.get(session) || {};
        const cookieHeader = Object.values(cookieJar).join('; ');
        if (cookieHeader) {
            outHeaders['cookie'] = cookieHeader;
        }

        // --- Step 2: Make the request using Node's built-in fetch ---
        const upstreamResponse = await fetch(target.toString(), {
            method: req.method,
            headers: outHeaders,
            body: req.body,
            redirect: 'manual',
        });

        // --- Step 3: Handle the response headers ---

        // Handle redirects
        if ([301, 302, 307, 308].includes(upstreamResponse.status)) {
            const location = upstreamResponse.headers.get('location');
            if (location) {
                const newProxyUrl = new URL(req.url, `https://${req.headers.host}`);
                newProxyUrl.searchParams.set('url', new URL(location, target.href).href);
                res.setHeader('location', newProxyUrl.toString());
                return res.status(upstreamResponse.status).send(`Redirecting to: ${location}`);
            }
        }

        // Capture and store cookies
        const setCookieHeaders = [];
        upstreamResponse.headers.forEach((value, key) => {
            if (key.toLowerCase() === 'set-cookie') setCookieHeaders.push(value);
        });
        if (setCookieHeaders.length > 0) {
            setCookieHeaders.forEach(cookieStr => {
                const [cookiePair] = cookieStr.split(';');
                const [cookieName] = cookiePair.split('=');
                if (cookieName) cookieJar[cookieName.trim()] = cookiePair.trim();
            });
            cookieJars.set(session, cookieJar);
        }

        // Copy and filter headers for the final response
        upstreamResponse.headers.forEach((value, key) => {
            if (!RESPONSE_HEADERS_TO_STRIP.has(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        });
        res.status(upstreamResponse.status);

        // --- Step 4: Decompress and stream the response body ---
        // This is the critical part that fixes the garbled text.
        const encoding = upstreamResponse.headers.get('content-encoding');
        const bodyStream = Readable.fromWeb(upstreamResponse.body);

        if (encoding === 'gzip') {
            bodyStream.pipe(zlib.createGunzip()).pipe(res);
        } else if (encoding === 'deflate') {
            bodyStream.pipe(zlib.createInflate()).pipe(res);
        } else if (encoding === 'br') {
            bodyStream.pipe(zlib.createBrotliDecompress()).pipe(res);
        } else {
            // No compression, just send it through.
            bodyStream.pipe(res);
        }

    } catch (err) {
        console.error('PROXY FATAL ERROR:', err);
        res.status(500).send(`Proxy Error: ${err.message}`);
    }
};
